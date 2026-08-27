const express = require('express');
const fs = require('fs');
const prisma = require('../prismaClient');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { parseWorkbookBuffer, isIdentifierOrNameHeader } = require('../utils/excelParser');

const router = express.Router();

// Fields already represented as dedicated (normalized) columns on the
// Employee model. Used to avoid double-counting the same information both
// as "Department" (normalized) and again as whatever the raw Excel header
// happened to be (e.g. "Dept", "Section").
const NORMALIZED_STAT_FIELDS = ['Department', 'Category', 'Grade'];

// Preferred ordering for dynamic dashboard/profile stat cards — purely
// cosmetic; any column not listed here still gets included, just after
// these known-common ones.
const STAT_FIELD_PRIORITY = [
  'department', 'category', 'grade', 'plant', 'location', 'skill',
  'shift', 'section', 'designation', 'status',
];

router.get('/', requireAuth, async (req, res) => {
  const { q, page, pageSize } = req.query;
  const where = q
    ? {
        OR: [
          { employeeId: { contains: String(q) } },
          { name: { contains: String(q) } },
          { department: { contains: String(q) } },
          { category: { contains: String(q) } },
          { grade: { contains: String(q) } },
          { rawData: { contains: String(q) } }, // covers any Excel column, mapped or not
        ],
      }
    : {};

  const take = pageSize ? Math.min(Math.max(Number(pageSize) || 50, 1), 500) : undefined;
  const skip = page && take ? (Math.max(Number(page) || 1, 1) - 1) * take : undefined;

  const [items, total] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
    prisma.employee.count({ where }),
  ]);

  // Backward compatible: if no pagination params were given, return the
  // plain array (existing behavior). If pagination params were given,
  // return the richer paged shape.
  if (!take) return res.json(items);
  res.json({ items, total, page: Number(page) || 1, pageSize: take });
});

// Dynamic table columns: the actual Excel headers from the most recent
// employee import, so the UI can render exactly what was last uploaded
// instead of a hardcoded column set. Falls back to the union of columns
// seen across currently-stored employees if no upload record exists yet
// (e.g. records added manually via the "Add Employee" form only).
router.get('/columns', requireAuth, async (req, res) => {
  const lastUpload = await prisma.upload.findFirst({
    where: { category: 'employee', detectedColumns: { not: null } },
    orderBy: { uploadedAt: 'desc' },
  });

  if (lastUpload?.detectedColumns) {
    try {
      const columns = JSON.parse(lastUpload.detectedColumns);
      if (Array.isArray(columns) && columns.length > 0) {
        return res.json({ columns, source: 'last-import', uploadedAt: lastUpload.uploadedAt });
      }
    } catch {
      // fall through to derived columns
    }
  }

  const employees = await prisma.employee.findMany({ select: { rawData: true }, take: 500 });
  const seen = new Set();
  const columns = [];
  for (const e of employees) {
    if (!e.rawData) continue;
    try {
      const raw = JSON.parse(e.rawData);
      for (const key of Object.keys(raw)) {
        if (!seen.has(key)) {
          seen.add(key);
          columns.push(key);
        }
      }
    } catch {
      // ignore malformed rawData
    }
  }

  if (columns.length === 0) {
    // No Excel import has ever happened — fall back to the base fields.
    return res.json({ columns: ['Employee ID', 'Name', 'Department', 'Category', 'Grade'], source: 'default' });
  }

  res.json({ columns, source: 'derived' });
});

// Dynamic, data-driven breakdown statistics (e.g. "Employees by Plant") —
// computed from whatever categorical-looking columns are actually present
// in the imported data. High-cardinality columns (IDs, names, free text)
// are automatically excluded because every value is unique.
router.get('/stats', requireAuth, async (req, res) => {
  const employees = await prisma.employee.findMany({
    select: { department: true, category: true, grade: true, rawData: true },
  });
  const total = employees.length;

  const counts = {}; // header -> Map(value -> count)
  const coverage = {}; // header -> non-blank count

  function bump(header, value) {
    if (value === undefined || value === null) return;
    const v = String(value).trim();
    if (!v) return;
    if (!counts[header]) counts[header] = new Map();
    counts[header].set(v, (counts[header].get(v) || 0) + 1);
    coverage[header] = (coverage[header] || 0) + 1;
  }

  for (const e of employees) {
    bump('Department', e.department);
    bump('Category', e.category);
    bump('Grade', e.grade);
    if (!e.rawData) continue;
    try {
      const raw = JSON.parse(e.rawData);
      for (const [header, value] of Object.entries(raw)) {
        if (isIdentifierOrNameHeader(header)) continue; // skip IDs/names
        if (NORMALIZED_STAT_FIELDS.some((f) => f.toLowerCase() === header.trim().toLowerCase())) continue;
        bump(header, value);
      }
    } catch {
      // ignore malformed rawData
    }
  }

  const fields = Object.keys(counts)
    .map((header) => {
      const distinct = counts[header].size;
      const covered = coverage[header];
      return { header, distinct, covered };
    })
    // A categorical/statistical column repeats values; a column where every
    // value is unique (e.g. an ID, a free-text remark) isn't one — skip it.
    .filter((f) => f.distinct > 1 && f.distinct < f.covered && f.distinct <= 40)
    // Require reasonable coverage so a near-empty column doesn't produce a
    // near-empty, misleading chart.
    .filter((f) => total === 0 || f.covered / total >= 0.3)
    .sort((a, b) => {
      const pa = STAT_FIELD_PRIORITY.indexOf(a.header.toLowerCase());
      const pb = STAT_FIELD_PRIORITY.indexOf(b.header.toLowerCase());
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      return b.covered - a.covered;
    })
    .slice(0, 8);

  const stats = fields.map(({ header, covered }) => {
    const entries = [...counts[header].entries()].sort((a, b) => b[1] - a[1]);
    const top = entries.slice(0, 10).map(([value, count]) => ({ value, count }));
    const otherCount = entries.slice(10).reduce((sum, [, c]) => sum + c, 0);
    if (otherCount > 0) top.push({ value: 'Other', count: otherCount });
    return { field: header, covered, distinct: entries.length, breakdown: top };
  });

  res.json({ totalEmployees: total, stats });
});

router.get('/:id', requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: Number(req.params.id) },
    include: { attendance: true },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found.' });

  let raw = {};
  if (employee.rawData) {
    try {
      raw = JSON.parse(employee.rawData);
    } catch {
      raw = {};
    }
  }

  const attendanceSummary = employee.attendance.length > 0
    ? {
        totalSessions: employee.attendance.length,
        present: employee.attendance.filter((a) => a.status === 'Present').length,
        absent: employee.attendance.filter((a) => a.status === 'Absent').length,
        online: employee.attendance.filter((a) => a.status === 'Online').length,
      }
    : null;

  res.json({
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    department: employee.department,
    category: employee.category,
    grade: employee.grade,
    createdAt: employee.createdAt,
    rawFields: raw, // every column from the Excel row this employee last imported from
    attendanceSummary,
  });
});

router.post('/', requireAuth, async (req, res) => {
  const { employeeId, name, department, category, grade } = req.body || {};
  if (!employeeId || !name) return res.status(400).json({ error: 'employeeId and name are required.' });
  try {
    const e = await prisma.employee.create({ data: { employeeId, name, department, category, grade } });
    res.status(201).json(e);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'An employee with this ID already exists.' });
    res.status(500).json({ error: 'Failed to create employee record.' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const e = await prisma.employee.update({ where: { id: Number(req.params.id) }, data: req.body || {} });
    res.json(e);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Employee not found.' });
    res.status(500).json({ error: 'Failed to update employee record.' });
  }
});

// Restricted to Admin — permanent record deletion, HR keeps full read/write.
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: Number(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Employee not found.' });
    res.status(500).json({ error: 'Failed to delete employee record.' });
  }
});

// Delete ALL employee records at once ("Delete All Employees"). Restricted
// to Admin, same as single-record deletion. Related AttendanceRecord rows
// are not deleted (attendance history is preserved) — their employeeId is
// automatically set to NULL by the existing ON DELETE SET NULL foreign key,
// so no stale/broken references remain.
router.delete('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { count } = await prisma.employee.deleteMany({});
    await prisma.auditLog.create({
      data: { userId: req.user.id, action: 'DELETE_ALL_EMPLOYEES', details: `Deleted all ${count} employee record(s).` },
    });
    res.json({ ok: true, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete all employee records.' });
  }
});

// Dry-run preview: parses the workbook and reports what would happen
// without writing anything to the database, so an admin can verify a new
// Excel structure before committing it. The temp upload is deleted
// immediately afterwards — nothing is persisted at preview time.
router.post('/import/preview', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = req.file.originalname.toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Employee import only supports .xlsx, .xls, or .csv files.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = parseWorkbookBuffer(buffer);

    const identifiedRow = parsed.mappedRows.find((r) => r.mapped.employeeId);
    const detectedIdentifierColumn = identifiedRow ? identifiedRow.mappedFrom.employeeId : null;

    res.json({
      fileName: req.file.originalname,
      sheetName: parsed.sheetName,
      rowCount: parsed.rowCount,
      columns: parsed.columns,
      columnCount: parsed.columns.length,
      preview: parsed.preview,
      detectedIdentifierColumn,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse the uploaded file.', details: err.message });
  } finally {
    fs.unlink(req.file.path, () => {}); // preview never persists the file
  }
});

// Dynamic Excel/CSV import
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  const ext = req.file.originalname.toLowerCase().split('.').pop();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    return res.status(400).json({ error: 'Employee import only supports .xlsx, .xls, or .csv files.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const parsed = parseWorkbookBuffer(buffer);

    // Create the Upload record up front (instead of after the loop) so
    // every employee created/updated by this import can be linked to it via
    // uploadId. That link is what lets deleting this Upload record (from
    // the Uploads tab) also remove the employee data it brought in, instead
    // of leaving stale records behind — see routes/uploads.js.
    const uploadRecord = await prisma.upload.create({
      data: {
        originalName: req.file.originalname,
        storedName: req.file.filename,
        fileType: ext,
        fileSize: req.file.size,
        category: 'employee',
        detectedColumns: JSON.stringify(parsed.columns),
        rowCount: parsed.rowCount,
        previewData: JSON.stringify(parsed.preview),
      },
    });

    let created = 0;
    let updated = 0;
    let autoIdAssigned = 0;
    const rowIssues = []; // { row, reason } — visible, never silent

    // Pre-load existing employees once (id lookup by employeeId) instead of
    // issuing a findUnique for every single row. For large files (10,000+
    // rows) this cuts the import from ~2 DB round-trips/row to ~1, which
    // matters a lot on a single-file SQLite database.
    const existingEmployees = await prisma.employee.findMany({ select: { id: true, employeeId: true } });
    const idIndex = new Map(existingEmployees.map((e) => [e.employeeId, e.id]));

    // Every row that has ANY data is processed. Rows are never dropped just
    // because a column is missing, extra, renamed, or reordered — the only
    // thing this loop needs is *some* way to identify the record, and if the
    // Excel truly has nothing usable for that we still keep the row by
    // generating a stable fallback id rather than discarding it.
    for (let i = 0; i < parsed.mappedRows.length; i += 1) {
      const rowNumber = i + 2; // +1 for header row, +1 for 1-based numbering
      const row = parsed.mappedRows[i];
      const values = Object.values(row.raw);
      const isEntirelyBlank = values.every((v) => v === '' || v === null || v === undefined);
      if (isEntirelyBlank) continue; // genuinely empty row, nothing to import

      try {
        let id = row.mapped.employeeId;
        let idWasAutoGenerated = false;

        if (!id) {
          // No column matched a known/likely employee-identifier pattern.
          // Fall back to the first non-blank cell in the row so the record
          // still gets a usable, stable-ish key instead of being dropped.
          const firstNonBlank = Object.values(row.raw).find(
            (v) => v !== '' && v !== null && v !== undefined
          );
          id = firstNonBlank !== undefined ? String(firstNonBlank) : `ROW-${rowNumber}`;
          idWasAutoGenerated = true;
        }
        id = String(id).trim();

        const data = {
          name: row.mapped.name ? String(row.mapped.name) : String(id),
          department: row.mapped.department != null ? String(row.mapped.department) : null,
          category: row.mapped.category != null ? String(row.mapped.category) : null,
          grade: row.mapped.grade != null ? String(row.mapped.grade) : null,
          rawData: JSON.stringify(row.raw),
          uploadId: uploadRecord.id,
        };

        const existingId = idIndex.get(id);
        if (existingId !== undefined) {
          await prisma.employee.update({ where: { id: existingId }, data });
          updated += 1;
        } else {
          const createdEmployee = await prisma.employee.create({ data: { employeeId: id, ...data } });
          idIndex.set(id, createdEmployee.id); // so a duplicate ID later in the SAME file updates, not double-creates
          created += 1;
        }

        if (idWasAutoGenerated) {
          autoIdAssigned += 1;
          rowIssues.push({
            row: rowNumber,
            reason: `No recognizable employee-identifier column was found for this row; imported using an auto-assigned ID ("${id}") derived from the first available cell.`,
          });
        }
      } catch (rowErr) {
        // Report the real reason instead of silently skipping the row.
        rowIssues.push({ row: rowNumber, reason: rowErr.message || 'Unknown error while importing this row.' });
      }
    }

    res.json({
      fileName: req.file.originalname,
      sheetName: parsed.sheetName,
      detectedColumns: parsed.columns,
      columnsDetected: parsed.columns.length,
      rowCount: parsed.rowCount,
      rowsDetected: parsed.rowCount,
      rowsImported: created + updated,
      preview: parsed.preview,
      created,
      updated,
      skipped: parsed.rowCount - (created + updated),
      autoIdAssigned,
      rowIssues,
      uploadId: uploadRecord.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to parse or import the uploaded file.', details: err.message });
  }
});

module.exports = router;
