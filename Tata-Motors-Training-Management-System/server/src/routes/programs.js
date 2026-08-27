const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['Planned', 'Completed', 'Cancelled', 'Postponed'];

// ---------------------------------------------------------------------------
// Calendar "Create Program" feature
// ---------------------------------------------------------------------------
// The calendar lets HR/Admin create a program directly from a date, picking
// one of four main programs (SHE / Induction / F&T / C&B) and one or more
// trainings. Rather than creating a brand-new Program record every time
// (which would duplicate master data), every calendar-created session for a
// given main program is attached to a single, auto-managed "container"
// Program for that category. This endpoint finds or creates that container.
const CALENDAR_MAIN_PROGRAMS = ['SHE', 'Induction', 'F&T', 'C&B'];
const CALENDAR_PROGRAM_CODE_PREFIX = 'CAL-';

function calendarContainerCode(category) {
  return `${CALENDAR_PROGRAM_CODE_PREFIX}${category.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}`;
}

router.post('/calendar-container', requireAuth, async (req, res) => {
  const { category } = req.body || {};
  // Accept the four built-in main programs plus any manually-added main
  // program (see routes/mainPrograms.js), so calendar-created sessions for
  // a manually-added main program can find-or-create their container just
  // like the built-in ones.
  let allowed = CALENDAR_MAIN_PROGRAMS.includes(category);
  if (!allowed && category) {
    const custom = await prisma.mainProgram.findUnique({ where: { value: String(category) } });
    allowed = !!custom;
  }
  if (!category || !allowed) {
    return res.status(400).json({ error: 'category must be a valid main program.' });
  }

  const code = calendarContainerCode(category);
  try {
    let program = await prisma.program.findUnique({ where: { code } });
    if (!program) {
      const startDate = new Date();
      const endDate = new Date(startDate.getFullYear() + 10, 11, 31);
      program = await prisma.program.create({
        data: {
          code,
          name: `${category} — Calendar Programs`,
          category,
          description: `Auto-managed container for ${category} trainings scheduled directly from the calendar. Do not delete.`,
          status: 'Planned',
          startDate,
          endDate,
        },
      });
    }
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Failed to prepare calendar program container.' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { status, category, q } = req.query;
  const where = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (q) {
    where.OR = [
      { code: { contains: String(q) } },
      { name: { contains: String(q) } },
      { category: { contains: String(q) } },
      { description: { contains: String(q) } },
    ];
  }

  const programs = await prisma.program.findMany({
    where,
    include: { sessions: true, _count: { select: { sessions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(programs);
});

router.get('/:id', requireAuth, async (req, res) => {
  const program = await prisma.program.findUnique({
    where: { id: Number(req.params.id) },
    include: { sessions: { include: { faculty: true } }, uploads: true },
  });
  if (!program) return res.status(404).json({ error: 'Program not found.' });
  res.json(program);
});

router.post('/', requireAuth, async (req, res) => {
  const { code, name, category, description, status, startDate, endDate } = req.body || {};

  if (!code || !name || !category || !status || !startDate || !endDate) {
    return res.status(400).json({ error: 'code, name, category, status, startDate, endDate are required.' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const program = await prisma.program.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
        category: String(category).trim(),
        description: description ? String(description).trim() : null,
        status,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'CREATE_PROGRAM', details: `Created program ${program.code}` },
    });
    res.status(201).json(program);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'A program with this code already exists.' });
    }
    res.status(500).json({ error: 'Failed to create program.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { code, name, category, description, status, startDate, endDate } = req.body || {};

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const program = await prisma.program.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: String(code).trim() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(category !== undefined && { category: String(category).trim() }),
        ...(description !== undefined && { description: String(description).trim() }),
        ...(status !== undefined && { status }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
      },
    });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'UPDATE_PROGRAM', details: `Updated program ${program.code}` },
    });
    res.json(program);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Program not found.' });
    res.status(500).json({ error: 'Failed to update program.' });
  }
});

// Deleting a program permanently removes it (and cascades to its sessions),
// so this is restricted to Admin — HR retains full create/update access.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const program = await prisma.program.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DELETE_PROGRAM', details: `Deleted program ${program.code}` },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Program not found.' });
    res.status(500).json({ error: 'Failed to delete program.' });
  }
});

module.exports = router;
