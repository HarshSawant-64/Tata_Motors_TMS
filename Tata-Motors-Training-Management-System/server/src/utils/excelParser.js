// Dynamic workbook reader.
//
// This does NOT assume a fixed template. It reads whatever sheet looks most
// useful (the one with the most rows/columns), detects every column header
// present, and additionally tries to map common column-name aliases onto a
// normalized set of fields (employeeId, name, department, grade, attendance,
// category, faculty) WITHOUT discarding the original/unknown columns. All
// raw row data is preserved in `rawData` on each record so nothing is lost.
//
// Matching happens in two layers so that new/unseen company Excel formats
// keep working without code changes:
//   1. An exact alias dictionary for common, known header spellings.
//   2. A pattern-based fallback (regex over the normalized header) for the
//      two fields the rest of the system actually depends on structurally
//      (employeeId, name), since those show up under dozens of company-
//      specific spellings (Pers.no., Personnel Number, Emp Code, Staff ID,
//      Worker ID, etc). Every other column - mapped or not - is always kept
//      verbatim in `raw` so no information is ever lost.

const XLSX = require('xlsx');

// Alias dictionaries -> normalized field name.
// Matching is case-insensitive and ignores spaces/underscores/punctuation.
const ALIASES = {
  employeeId: [
    'employeeid', 'employeeno', 'employeenumber', 'employeecode',
    'personnelno', 'personnelnumber', 'personnelid', 'personnelcode',
    'persno', 'pno', 'pno.', 'pno#',
    'empid', 'empno', 'empnumber', 'empcode',
    'staffid', 'staffno', 'staffcode', 'staffnumber',
    'workerid', 'workerno', 'workercode', 'workernumber',
    'facultyid', 'facultycode',
    'id', 'code',
  ],
  name: [
    'name', 'employeename', 'empname', 'personnelname', 'staffname',
    'workername', 'facultyname', 'fullname', 'traineename', 'employeefullname',
  ],
  department: [
    'department', 'dept', 'departmentname', 'function', 'section',
    'division', 'costcenter', 'costctr', 'plant',
  ],
  grade: ['grade', 'employeegrade', 'gradecode', 'level', 'designation'],
  attendance: ['attendance', 'present', 'status', 'attendancestatus', 'employmentstatus'],
  category: [
    'category', 'type', 'employeecategory', 'employeegroup',
    'employeesubgroup', 'workercategory',
  ],
};

// Regex fallbacks (applied to the normalized, alphanumeric-only header) for
// the two structurally-required fields. These catch variants that aren't in
// the exact alias list above without needing a code change per new format.
// e.g. "persno" (Pers.no.), "personnelnumber", "empcode", "workerid", ...
const ID_PATTERN = /^(pers|personnel|emp|employee|staff|worker|faculty)(no|num|number|code|id)$/;
const NAME_PATTERN = /^(emp|employee|personnel|staff|worker|faculty|full|trainee)?name$/;

function normalizeKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function buildAliasLookup() {
  const lookup = {};
  for (const [normalizedField, aliasList] of Object.entries(ALIASES)) {
    for (const alias of aliasList) {
      lookup[normalizeKey(alias)] = normalizedField;
    }
  }
  return lookup;
}

const ALIAS_LOOKUP = buildAliasLookup();

/**
 * Resolves a normalized header to a canonical field name, first via the
 * exact alias dictionary, then (for employeeId/name only) via pattern
 * matching so unfamiliar-but-recognizable header spellings still map.
 */
function resolveField(normalized) {
  if (ALIAS_LOOKUP[normalized]) return ALIAS_LOOKUP[normalized];
  if (ID_PATTERN.test(normalized)) return 'employeeId';
  if (NAME_PATTERN.test(normalized)) return 'name';
  return null;
}

/**
 * Pick the "useful" sheet: the one with the greatest number of non-empty
 * rows * columns. Falls back to the first sheet.
 */
function pickBestSheet(workbook) {
  let best = null;
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    const colCount = json.length > 0 ? Object.keys(json[0]).length : 0;
    const score = json.length * Math.max(colCount, 1);
    if (score > bestScore) {
      bestScore = score;
      best = { sheetName, rows: json };
    }
  }

  return best || { sheetName: workbook.SheetNames[0], rows: [] };
}

/**
 * Parses a workbook buffer (xlsx/xls/csv) dynamically.
 * Returns { sheetName, columns, rowCount, rows, mappedRows, preview }
 */
function parseWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const { sheetName, rows } = pickBestSheet(workbook);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  const mappedRows = rows.map((row) => {
    const mapped = {};
    const mappedFrom = {}; // canonical field -> original Excel header (for transparency)
    const unmapped = {};

    for (const [originalKey, value] of Object.entries(row)) {
      const normalized = normalizeKey(originalKey);
      const mappedField = resolveField(normalized);
      const isBlank = value === '' || value === null || value === undefined;

      if (mappedField && mapped[mappedField] === undefined && !isBlank) {
        mapped[mappedField] = value;
        mappedFrom[mappedField] = originalKey;
      } else {
        unmapped[originalKey] = value;
      }
    }

    return {
      mapped,
      mappedFrom,
      raw: row, // full original row, nothing discarded
    };
  });

  const preview = rows.slice(0, 10);

  return {
    sheetName,
    columns,
    rowCount: rows.length,
    mappedRows,
    preview,
  };
}

/**
 * True if the given original Excel header normalizes to a known
 * identifier-like or name-like field. Used by stats/aggregation code to
 * skip high-cardinality columns (IDs, names) that make poor "breakdown"
 * statistics (e.g. "Employees by Employee ID" is meaningless).
 */
function isIdentifierOrNameHeader(header) {
  const normalized = normalizeKey(header);
  const field = resolveField(normalized);
  return field === 'employeeId' || field === 'name';
}

module.exports = {
  parseWorkbookBuffer,
  normalizeKey,
  resolveField,
  isIdentifierOrNameHeader,
  ALIASES,
};
