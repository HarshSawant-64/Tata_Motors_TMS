const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// List sessions, optionally filtered by month (?year=2026&month=9) or by date
router.get('/', requireAuth, async (req, res) => {
  const { year, month, date } = req.query;
  const where = {};

  if (date) {
    const start = new Date(String(date));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    where.date = { gte: start, lt: end };
  } else if (year && month) {
    const y = Number(year);
    const m = Number(month); // 1-12
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    where.date = { gte: start, lt: end };
  }

  const sessions = await prisma.session.findMany({
    where,
    include: { program: true, faculty: true },
    orderBy: { date: 'asc' },
  });
  res.json(sessions);
});

router.get('/:id', requireAuth, async (req, res) => {
  const session = await prisma.session.findUnique({
    where: { id: Number(req.params.id) },
    include: { program: true, faculty: true, uploads: true, attendanceRecords: true },
  });
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  res.json(session);
});

router.post('/', requireAuth, async (req, res) => {
  const {
    programId, date, endDate, startTime, endTime, facultyId, hall,
    trainingTopic, studentCount, status,
  } = req.body || {};

  if (!programId || !date) {
    return res.status(400).json({ error: 'programId and date are required.' });
  }

  try {
    const session = await prisma.session.create({
      data: {
        programId: Number(programId),
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        startTime: startTime || null,
        endTime: endTime || null,
        facultyId: facultyId ? Number(facultyId) : null,
        hall: hall || null,
        trainingTopic: trainingTopic || null,
        studentCount: studentCount ? Number(studentCount) : 0,
        status: status || 'Planned',
      },
    });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const data = {};

  const passthroughFields = ['startTime', 'endTime', 'hall', 'trainingTopic', 'status',
    'attendanceDocument', 'managementAttendanceDoc'];
  for (const field of passthroughFields) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
  if (body.facultyId !== undefined) data.facultyId = body.facultyId ? Number(body.facultyId) : null;
  if (body.programId !== undefined) data.programId = Number(body.programId);
  for (const field of ['studentCount', 'presentCount', 'absentCount', 'onlineCount']) {
    if (body[field] !== undefined) data[field] = Number(body[field]);
  }

  try {
    const session = await prisma.session.update({ where: { id }, data });
    res.json(session);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Session not found.' });
    res.status(500).json({ error: 'Failed to update session.' });
  }
});

// Restricted to Admin — permanent record deletion, HR keeps full read/write.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.session.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Session not found.' });
    res.status(500).json({ error: 'Failed to delete session.' });
  }
});

module.exports = router;
