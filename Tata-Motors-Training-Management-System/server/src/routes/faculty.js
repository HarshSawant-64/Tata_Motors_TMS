const express = require('express');
const fs = require('fs');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { parseWorkbookBuffer } = require('../utils/excelParser');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { q } = req.query;
  // Search across every existing faculty field the UI shows/edits — ID,
  // name, department, grade, and status — plus any raw/unmapped columns
  // preserved from Excel import (rawData), so a search matches whatever
  // detail the user actually types, not just name/ID.
  const where = q
    ? {
        OR: [
          { facultyCode: { contains: String(q) } },
          { name: { contains: String(q) } },
          { department: { contains: String(q) } },
          { grade: { contains: String(q) } },
          { status: { contains: String(q) } },
          { rawData: { contains: String(q) } },
        ],
      }
    : {};
  const faculty = await prisma.faculty.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(faculty);
});

router.post('/', requireAuth, async (req, res) => {
  const { facultyCode, name, department, grade, status, attendance } = req.body || {};
  if (!facultyCode || !name) return res.status(400).json({ error: 'facultyCode and name are required.' });
  try {
    const f = await prisma.faculty.create({
      data: { facultyCode, name, department, grade, status: status || 'Active', attendance },
    });
    res.status(201).json(f);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A faculty member with this code already exists.' });
    res.status(500).json({ error: 'Failed to create faculty record.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const f = await prisma.faculty.update({ where: { id: Number(req.params.id) }, data: req.body || {} });
    res.json(f);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Faculty record not found.' });
    res.status(500).json({ error: 'Failed to update faculty record.' });
  }
});

// Restricted to Admin — permanent record deletion, HR keeps full read/write.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.faculty.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Faculty record not found.' });
    res.status(500).json({ error: 'Failed to delete faculty record.' });
  }
});

// Delete ALL faculty records at once ("Delete All Faculty"). Restricted to
// Admin, same as single-record deletion. Sessions referencing a deleted
// faculty member have their facultyId safely set to NULL by the existing
// ON DELETE SET NULL foreign key (see Session.facultyId in schema.prisma),
// so no scheduling records are broken or orphaned by this action.
router.delete('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { count } = await prisma.faculty.deleteMany({});
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DELETE_ALL_FACULTY', details: `Deleted all ${count} faculty record(s).` },
    });
    res.json({ ok: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete all faculty records.' });
  }
});

// Dynamic Excel/CSV import - auto-detects columns, does not require a fixed template.
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = req.file.originalname.toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    return res.status(400).json({ error: 'Faculty import only supports .xlsx, .xls, or .csv files.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = parseWorkbookBuffer(buffer);

    let created = 0;
    let updated = 0;

    for (const row of parsed.mappedRows) {
      const code = row.mapped.employeeId || row.mapped.name;
      if (!code) continue; // skip rows with no identifiable key

      const data = {
        name: row.mapped.name || String(code),
        department: row.mapped.department || null,
        grade: row.mapped.grade || null,
        attendance: row.mapped.attendance || null,
        rawData: JSON.stringify(row.raw),
      };

      const existing = await prisma.faculty.findUnique({ where: { facultyCode: String(code) } });
      if (existing) {
        await prisma.faculty.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.faculty.create({ data: { facultyCode: String(code), ...data } });
        created += 1;
      }
    }

    await prisma.upload.create({
      data: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileType: ext,
        fileSize: req.file.size,
        category: 'faculty',
        detectedColumns: JSON.stringify(parsed.columns),
        rowCount: parsed.rowCount,
        previewData: JSON.stringify(parsed.preview),
      },
    });

    res.json({
      detectedColumns: parsed.columns,
      rowCount: parsed.rowCount,
      preview: parsed.preview,
      created,
      updated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse or import the uploaded file.' });
  }
});

module.exports = router;
