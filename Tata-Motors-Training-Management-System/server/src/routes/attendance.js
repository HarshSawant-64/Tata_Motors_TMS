const express = require('express');
const fs = require('fs');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { parseWorkbookBuffer } = require('../utils/excelParser');

const router = express.Router();

router.get('/session/:sessionId', requireAuth, async (req, res) => {
  const records = await prisma.attendanceRecord.findMany({
    where: { sessionId: Number(req.params.sessionId) },
    include: { employee: true },
  });
  res.json(records);
});

// Manual attendance entry (single record or counts update)
router.post('/manual', requireAuth, async (req, res) => {
  const { sessionId, name, department, status, employeeId } = req.body || {};
  if (!sessionId || !status) return res.status(400).json({ error: 'sessionId and status are required.' });

  let employeeRecordId = null;
  if (employeeId) {
    const emp = await prisma.employee.findUnique({ where: { employeeId: String(employeeId) } });
    employeeRecordId = emp ? emp.id : null;
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      sessionId: Number(sessionId),
      employeeId: employeeRecordId,
      name: name || null,
      department: department || null,
      status,
    },
  });

  await recalculateSessionCounts(Number(sessionId));
  res.status(201).json(record);
});

router.put('/session/:sessionId/counts', requireAuth, async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  const { presentCount, absentCount, onlineCount, studentCount } = req.body || {};
  const data = {};
  if (presentCount !== undefined) data.presentCount = Number(presentCount);
  if (absentCount !== undefined) data.absentCount = Number(absentCount);
  if (onlineCount !== undefined) data.onlineCount = Number(onlineCount);
  if (studentCount !== undefined) data.studentCount = Number(studentCount);

  try {
    const session = await prisma.session.update({ where: { id: sessionId }, data });
    res.json(session);
  } catch (err) {
    res.status(404).json({ error: 'Session not found.' });
  }
});

// Dynamic Excel/CSV attendance import tied to a session
router.post('/import/:sessionId', requireAuth, upload.single('file'), async (req, res) => {
  const sessionId = Number(req.params.sessionId);
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = req.file.originalname.toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    return res.status(400).json({ error: 'Attendance import only supports .xlsx, .xls, or .csv files.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = parseWorkbookBuffer(buffer);

    let count = 0;
    for (const row of parsed.mappedRows) {
      const status = row.mapped.attendance || 'Present';
      let employeeRecordId = null;
      if (row.mapped.employeeId) {
        const emp = await prisma.employee.findUnique({ where: { employeeId: String(row.mapped.employeeId) } });
        employeeRecordId = emp ? emp.id : null;
      }
      await prisma.attendanceRecord.create({
        data: {
          sessionId,
          employeeId: employeeRecordId,
          name: row.mapped.name || null,
          department: row.mapped.department || null,
          status: String(status),
          rawData: JSON.stringify(row.raw),
        },
      });
      count += 1;
    }

    await recalculateSessionCounts(sessionId);

    await prisma.upload.create({
      data: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileType: ext,
        fileSize: req.file.size,
        category: 'attendance',
        sessionId,
        detectedColumns: JSON.stringify(parsed.columns),
        rowCount: parsed.rowCount,
        previewData: JSON.stringify(parsed.preview),
      },
    });

    res.json({
      detectedColumns: parsed.columns,
      rowCount: parsed.rowCount,
      preview: parsed.preview,
      imported: count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse or import the attendance file.' });
  }
});

async function recalculateSessionCounts(sessionId) {
  const records = await prisma.attendanceRecord.findMany({ where: { sessionId } });
  const present = records.filter((r) => /present/i.test(r.status)).length;
  const absent = records.filter((r) => /absent/i.test(r.status)).length;
  const online = records.filter((r) => /online/i.test(r.status)).length;

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      presentCount: present,
      absentCount: absent,
      onlineCount: online,
      studentCount: Math.max(records.length, 0),
    },
  });
}

module.exports = router;
