const express = require('express');
const path = require('path');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');

const router = express.Router();

// Generic document/photo/video upload attached to a program and/or session.
router.post('/document', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const { programId, sessionId, category } = req.body || {};
  const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');

  const record = await prisma.upload.create({
    data: {
      originalName: req.file.originalname,
      storedName: req.file.filename,
      fileType: ext,
      fileSize: req.file.size,
      category: category || 'document',
      programId: programId ? Number(programId) : null,
      sessionId: sessionId ? Number(sessionId) : null,
    },
  });

  res.status(201).json(record);
});

router.get('/', requireAuth, async (req, res) => {
  const { programId, sessionId, category } = req.query;
  const where = {};
  if (programId) where.programId = Number(programId);
  if (sessionId) where.sessionId = Number(sessionId);
  if (category) where.category = String(category);

  const uploads = await prisma.upload.findMany({ where, orderBy: { uploadedAt: 'desc' } });
  res.json(uploads);
});

// Restricted to Admin — permanent record deletion, HR keeps full read/write.
// For an "employee" category upload, the Employee records that were
// imported/last-updated by it (Employee.uploadId) are removed automatically
// via the database's ON DELETE CASCADE foreign key, so the Employee tab
// never keeps showing data whose source Excel upload was deleted.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.upload.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Upload record not found.' });

    let removedEmployees = 0;
    if (existing.category === 'employee') {
      removedEmployees = await prisma.employee.count({ where: { uploadId: id } });
    }

    await prisma.upload.delete({ where: { id } });

    if (removedEmployees > 0) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'DELETE_EMPLOYEE_UPLOAD',
          details: `Deleted employee upload "${existing.originalName}" and its ${removedEmployees} linked employee record(s).`,
        },
      });
    }

    res.json({ ok: true, removedEmployees });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Upload record not found.' });
  }
});

// Serves an uploaded file for download/preview. Files are never executed -
// they are always sent with a forced content-disposition / static handling.
router.get('/file/:storedName', requireAuth, (req, res) => {
  const storedName = req.params.storedName;
  // Prevent path traversal: only allow filenames already sanitized by multer.
  if (storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename.' });
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).json({ error: 'File not found.' });
  });
});

module.exports = router;
