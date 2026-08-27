// Builds a periodic (weekly / monthly / 6-month) PDF report entirely from
// live project data — programs, sessions, faculty, employees and the audit
// log. No placeholder or hard-coded figures are used: every number and every
// sentence in the text summary is derived from what is actually in the
// database for the requested period.
//
// The PDF is streamed straight to the HTTP response by the caller (see
// routes/reports.js) using pdfkit, which needs no native dependencies.

const PDFDocument = require('pdfkit');
const prisma = require('../prismaClient');

const PERIOD_LABELS = {
  weekly: 'Weekly Report',
  monthly: 'Monthly Report',
  sixmonth: '6-Month Report',
};

function rangeStartFor(period, now = new Date()) {
  const start = new Date(now);
  if (period === 'weekly') start.setDate(now.getDate() - 7);
  else if (period === 'monthly') start.setMonth(now.getMonth() - 1);
  else start.setMonth(now.getMonth() - 6); // 'sixmonth'
  return start;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

function formatDateTime(d) {
  return new Date(d).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// Pulls every figure the report needs from the database for the given
// [start, now] window. Kept separate from the PDF drawing code so the data
// shape is easy to reason about / unit test independently of layout.
async function collectReportData(period, generatedBy) {
  const now = new Date();
  const start = rangeStartFor(period, now);

  const [sessionsInPeriod, programsCreated, programsUpdated, auditLogsInPeriod, allPrograms, faculty, employees] =
    await Promise.all([
      prisma.session.findMany({
        where: { date: { gte: start, lte: now } },
        include: { program: true, faculty: true },
        orderBy: { date: 'asc' },
      }),
      prisma.program.findMany({
        where: { createdAt: { gte: start, lte: now } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.program.findMany({
        where: { updatedAt: { gte: start, lte: now } },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: start, lte: now } },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.program.findMany(),
      prisma.faculty.findMany(),
      prisma.employee.findMany(),
    ]);

  const sessionsConducted = sessionsInPeriod.length;
  const totalParticipants = sessionsInPeriod.reduce((sum, s) => sum + (s.studentCount || 0), 0);
  const totalPresent = sessionsInPeriod.reduce((sum, s) => sum + (s.presentCount || 0), 0);
  const totalAbsent = sessionsInPeriod.reduce((sum, s) => sum + (s.absentCount || 0), 0);
  const totalOnline = sessionsInPeriod.reduce((sum, s) => sum + (s.onlineCount || 0), 0);
  const attendancePct = totalParticipants > 0 ? Math.round((totalPresent / totalParticipants) * 100) : 0;

  const programsByStatus = {};
  for (const p of allPrograms) programsByStatus[p.status] = (programsByStatus[p.status] || 0) + 1;

  const programsByCategory = {};
  for (const p of allPrograms) programsByCategory[p.category] = (programsByCategory[p.category] || 0) + 1;

  // Sessions conducted/scheduled in this period, grouped by program — the
  // same real data (not fake/static figures) that powers the "Sessions by
  // Program" bar graph embedded in the PDF (see drawBarChart / drawReport
  // below), matching what the Analytics screen shows for the same period.
  const sessionsByProgram = {};
  for (const s of sessionsInPeriod) {
    const label = s.program ? (s.program.code || s.program.name) : 'Unassigned';
    sessionsByProgram[label] = (sessionsByProgram[label] || 0) + 1;
  }

  // Update-audit rows already double as "program updated" events; exclude any
  // program that was also created in this window so it isn't counted twice.
  const createdIds = new Set(programsCreated.map((p) => p.id));
  const updatedOnly = programsUpdated.filter((p) => !createdIds.has(p.id));

  const auditByAction = {};
  for (const log of auditLogsInPeriod) {
    auditByAction[log.action] = (auditByAction[log.action] || 0) + 1;
  }

  const loginCount = auditByAction['LOGIN'] || 0;
  const distinctActiveUsers = new Set(
    auditLogsInPeriod.filter((l) => l.action === 'LOGIN').map((l) => l.userId)
  ).size;

  return {
    period,
    label: PERIOD_LABELS[period],
    start,
    end: now,
    generatedBy,
    sessionsInPeriod,
    sessionsConducted,
    totalParticipants,
    totalPresent,
    totalAbsent,
    totalOnline,
    attendancePct,
    programsCreated,
    programsUpdated: updatedOnly,
    auditLogsInPeriod,
    auditByAction,
    loginCount,
    distinctActiveUsers,
    programsByStatus,
    programsByCategory,
    sessionsByProgram,
    totalPrograms: allPrograms.length,
    totalFaculty: faculty.length,
    totalEmployees: employees.length,
  };
}

// Composes the dynamic, plain-English text summary that goes inside the PDF.
// Every clause is built from the collected data — nothing here is static
// filler text.
function buildSummary(data) {
  const parts = [];

  parts.push(
    `This ${data.label.toLowerCase()} covers the period from ${formatDate(data.start)} to ${formatDate(data.end)}. ` +
    `During this time, ${data.sessionsConducted} training session${data.sessionsConducted === 1 ? '' : 's'} ` +
    `${data.sessionsConducted === 1 ? 'was' : 'were'} conducted, recording ${data.totalParticipants} total ` +
    `participant${data.totalParticipants === 1 ? '' : 's'} with ${data.totalPresent} marked present ` +
    `(${data.attendancePct}% attendance)${data.totalOnline > 0 ? `, including ${data.totalOnline} attending online` : ''}.`
  );

  if (data.programsCreated.length > 0 || data.programsUpdated.length > 0) {
    const bits = [];
    if (data.programsCreated.length > 0) {
      bits.push(`${data.programsCreated.length} new program${data.programsCreated.length === 1 ? '' : 's'} ${data.programsCreated.length === 1 ? 'was' : 'were'} created (${data.programsCreated.map((p) => p.code).join(', ')})`);
    }
    if (data.programsUpdated.length > 0) {
      bits.push(`${data.programsUpdated.length} existing program${data.programsUpdated.length === 1 ? '' : 's'} ${data.programsUpdated.length === 1 ? 'was' : 'were'} updated (${data.programsUpdated.map((p) => p.code).join(', ')})`);
    }
    parts.push(`In terms of program activity, ${bits.join(', and ')}.`);
  } else {
    parts.push('No programs were created or updated during this period; activity was limited to existing programs and scheduled sessions.');
  }

  if (data.auditLogsInPeriod.length > 0) {
    parts.push(
      `The system recorded ${data.auditLogsInPeriod.length} audit-log ` +
      `event${data.auditLogsInPeriod.length === 1 ? '' : 's'} in this period, including ${data.loginCount} ` +
      `login${data.loginCount === 1 ? '' : 's'} from ${data.distinctActiveUsers} distinct user account${data.distinctActiveUsers === 1 ? '' : 's'}.`
    );
  } else {
    parts.push('No user activity was recorded in the audit log for this period.');
  }

  parts.push(
    `As of ${formatDate(data.end)}, the portal holds ${data.totalPrograms} program${data.totalPrograms === 1 ? '' : 's'} in total, ` +
    `${data.totalFaculty} faculty record${data.totalFaculty === 1 ? '' : 's'}, and ${data.totalEmployees} employee ` +
    `record${data.totalEmployees === 1 ? '' : 's'} on file.`
  );

  return parts.join(' ');
}

// Draws the PDF into the given pdfkit document. Returns nothing; the caller
// pipes `doc` to the HTTP response and calls doc.end().
function drawReport(doc, data) {
  // -- Header ---------------------------------------------------------
  doc.fontSize(18).fillColor('#0a2647').font('Helvetica-Bold')
    .text('Tata Motors Training Management Portal', { align: 'left' });
  doc.fontSize(14).fillColor('#0b63ce')
    .text(data.label, { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555').font('Helvetica')
    .text(`Reporting period: ${formatDate(data.start)} – ${formatDate(data.end)}`)
    .text(`Generated: ${formatDateTime(new Date())}${data.generatedBy ? ` by ${data.generatedBy.fullName} (${data.generatedBy.role})` : ''}`);
  doc.moveDown();
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#d7e3f0').stroke();
  doc.moveDown();

  // -- Text summary -----------------------------------------------------
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.3);
  doc.fontSize(10.5).fillColor('#222').font('Helvetica').text(buildSummary(data), { align: 'justify' });
  doc.moveDown();

  // -- Key statistics table ---------------------------------------------
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Key Statistics');
  doc.moveDown(0.3);
  const stats = [
    ['Sessions conducted', data.sessionsConducted],
    ['Total participants', data.totalParticipants],
    ['Total present', data.totalPresent],
    ['Total absent', data.totalAbsent],
    ['Attending online', data.totalOnline],
    ['Attendance rate', `${data.attendancePct}%`],
    ['Programs created', data.programsCreated.length],
    ['Programs updated', data.programsUpdated.length],
    ['Audit-log events', data.auditLogsInPeriod.length],
    ['Total programs (all-time)', data.totalPrograms],
    ['Total faculty on file', data.totalFaculty],
    ['Total employees on file', data.totalEmployees],
  ];
  drawKeyValueTable(doc, stats);
  doc.x = doc.page.margins.left;
  doc.moveDown();

  // -- Live analytics bar graphs ------------------------------------------
  // Generated fresh from the current database on every report download —
  // never a static/placeholder image — and reflect the exact same figures
  // shown on the Analytics screen for the corresponding data.
  maybeAddPage(doc, 220);
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Analytics', doc.page.margins.left, doc.y);
  doc.moveDown(0.4);

  const sessionsByProgramEntries = Object.entries(data.sessionsByProgram).sort((a, b) => b[1] - a[1]);
  drawBarChart(doc, {
    title: 'Sessions by Program (this period)',
    caption: sessionsByProgramEntries.length > 0
      ? 'Number of training sessions in the reporting period, grouped by program.'
      : 'No sessions were scheduled in this period.',
    data: sessionsByProgramEntries.map(([label, value]) => ({ label, value })),
    color: '#0b63ce',
  });
  doc.moveDown();

  maybeAddPage(doc, 220);
  const programsByCategoryEntries = Object.entries(data.programsByCategory).sort((a, b) => b[1] - a[1]);
  drawBarChart(doc, {
    title: 'Programs by Category (all-time)',
    caption: 'Total number of programs currently on file, grouped by category.',
    data: programsByCategoryEntries.map(([label, value]) => ({ label, value })),
    color: '#2e7d46',
  });
  doc.moveDown();

  const programsByStatusEntries = Object.entries(data.programsByStatus).sort((a, b) => b[1] - a[1]);
  if (programsByStatusEntries.length > 0) {
    maybeAddPage(doc, 220);
    drawBarChart(doc, {
      title: 'Programs by Status (all-time)',
      caption: 'Current status breakdown across every program on file.',
      data: programsByStatusEntries.map(([label, value]) => ({ label, value })),
      color: '#b6862c',
    });
    doc.moveDown();
  }

  // -- Sessions table -----------------------------------------------------
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Sessions in Period');
  doc.moveDown(0.3);
  if (data.sessionsInPeriod.length === 0) {
    doc.fontSize(10).fillColor('#666').font('Helvetica-Oblique').text('No sessions were scheduled or conducted in this period.');
  } else {
    const rows = data.sessionsInPeriod.map((s) => [
      formatDate(s.date),
      s.program ? s.program.code : '—',
      s.trainingTopic || '—',
      s.faculty ? s.faculty.name : 'Unassigned',
      String(s.studentCount || 0),
      String(s.presentCount || 0),
      s.status,
    ]);
    drawTable(doc, ['Date', 'Program', 'Topic', 'Faculty', 'Part.', 'Present', 'Status'], rows, [62, 70, 118, 78, 40, 48, 58]);
  }
  doc.moveDown();

  // -- Program activity table -----------------------------------------
  maybeAddPage(doc);
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Program Activity');
  doc.moveDown(0.3);
  if (data.programsCreated.length === 0 && data.programsUpdated.length === 0) {
    doc.fontSize(10).fillColor('#666').font('Helvetica-Oblique').text('No programs were created or updated in this period.');
  } else {
    const rows = [
      ...data.programsCreated.map((p) => [p.code, p.name, p.category, p.status, 'Created', formatDate(p.createdAt)]),
      ...data.programsUpdated.map((p) => [p.code, p.name, p.category, p.status, 'Updated', formatDate(p.updatedAt)]),
    ];
    drawTable(doc, ['Code', 'Name', 'Category', 'Status', 'Action', 'Date'], rows, [70, 115, 62, 62, 55, 60]);
  }
  doc.moveDown();

  // -- Audit log activity -----------------------------------------------
  maybeAddPage(doc);
  doc.fontSize(12).fillColor('#0a2647').font('Helvetica-Bold').text('Audit Log Activity');
  doc.moveDown(0.3);
  if (data.auditLogsInPeriod.length === 0) {
    doc.fontSize(10).fillColor('#666').font('Helvetica-Oblique').text('No activity was recorded during this period.');
  } else {
    const actionRows = Object.entries(data.auditByAction).map(([action, count]) => [action, String(count)]);
    drawKeyValueTable(doc, actionRows, 'Action', 'Count');
    doc.moveDown(0.5);
    doc.fontSize(9.5).fillColor('#0a2647').font('Helvetica-Bold').text('Recent events');
    doc.moveDown(0.2);
    const recent = data.auditLogsInPeriod.slice(-20).reverse();
    const rows = recent.map((l) => [formatDateTime(l.createdAt), l.user ? l.user.username : 'system', l.action, l.details || '']);
    drawTable(doc, ['When', 'User', 'Action', 'Details'], rows, [95, 65, 85, 190]);
  }

  // -- Footer -------------------------------------------------------------
  doc.moveDown();
  doc.fontSize(8).fillColor('#999').font('Helvetica-Oblique')
    .text('This report was generated automatically from live project data. All figures reflect the database at the time of generation.', { align: 'center' });
}

// Draws a clean, dynamically-generated bar chart directly with pdfkit's
// vector primitives (rectangles + text) rather than embedding a rasterized
// image — this avoids any extra native/canvas dependency (important for a
// portable Windows/offline deployment) while still producing a crisp,
// properly-sized, properly-positioned graph built from the exact numbers
// passed in via `data`. Every call site supplies real, current data — see
// drawReport, which builds `data` from collectReportData().
function drawBarChart(doc, { title, caption, data, color = '#0b63ce' }) {
  // Anchor to the page's left margin rather than the current doc.x, which
  // can be left offset by a preceding call that positioned text at an
  // explicit x (e.g. the right-hand column of drawKeyValueTable) — using
  // the margin directly guarantees the chart is always drawn full-width
  // and never clipped against the right edge of the page.
  const startX = doc.page.margins.left;
  const chartWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const chartHeight = 140;
  const labelAreaHeight = 26;
  const valueAreaHeight = 14;
  const plotHeight = chartHeight - labelAreaHeight - valueAreaHeight;

  doc.fontSize(10.5).fillColor('#0a2647').font('Helvetica-Bold').text(title, startX, doc.y);
  doc.moveDown(0.3);
  const plotTop = doc.y;

  if (!data || data.length === 0) {
    doc.fontSize(9).fillColor('#666').font('Helvetica-Oblique')
      .text(caption || 'No data available.', startX, plotTop);
    doc.moveDown(0.6);
    return;
  }

  // Cap how many bars are drawn on one chart so labels stay legible; any
  // remainder is folded into an "Other" bar rather than silently dropped.
  const MAX_BARS = 10;
  let bars = data;
  if (data.length > MAX_BARS) {
    const top = data.slice(0, MAX_BARS - 1);
    const restTotal = data.slice(MAX_BARS - 1).reduce((sum, d) => sum + d.value, 0);
    bars = [...top, { label: 'Other', value: restTotal }];
  }

  const maxValue = Math.max(...bars.map((d) => d.value), 1);
  const gap = 8;
  const barWidth = Math.max(14, Math.min(60, (chartWidth - gap * (bars.length - 1)) / bars.length));
  const totalBarsWidth = bars.length * barWidth + (bars.length - 1) * gap;
  const originX = startX + Math.max(0, (chartWidth - totalBarsWidth) / 2);
  const baselineY = plotTop + valueAreaHeight + plotHeight;

  // Baseline axis
  doc.moveTo(startX, baselineY).lineTo(startX + chartWidth, baselineY).strokeColor('#d7e3f0').stroke();

  bars.forEach((d, i) => {
    const barHeight = Math.round((d.value / maxValue) * plotHeight);
    const x = originX + i * (barWidth + gap);
    const y = baselineY - barHeight;

    doc.rect(x, y, barWidth, Math.max(barHeight, 1)).fill(color);

    doc.fontSize(8).fillColor('#111').font('Helvetica-Bold')
      .text(String(d.value), x, y - 11, { width: barWidth, align: 'center' });

    doc.fontSize(7).fillColor('#333').font('Helvetica')
      .text(String(d.label), x - 4, baselineY + 3, { width: barWidth + 8, align: 'center', height: labelAreaHeight, ellipsis: true });
  });

  doc.x = startX;
  doc.y = baselineY + labelAreaHeight;

  if (caption) {
    doc.fontSize(8).fillColor('#888').font('Helvetica-Oblique').text(caption, startX, doc.y, { width: chartWidth });
  }
}

function maybeAddPage(doc, needed = 150) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function drawKeyValueTable(doc, rows, keyHeader, valueHeader) {
  const startX = doc.x;
  const colWidth = 220;
  doc.fontSize(9.5).font('Helvetica');
  if (keyHeader) {
    doc.font('Helvetica-Bold').fillColor('#0a2647');
    doc.text(keyHeader, startX, doc.y, { continued: true, width: colWidth });
    doc.text(valueHeader, startX + colWidth);
    doc.font('Helvetica').fillColor('#222');
    doc.moveDown(0.2);
  }
  for (const [k, v] of rows) {
    maybeAddPage(doc, 30);
    const y = doc.y;
    doc.fillColor('#333').text(String(k), startX, y, { width: colWidth });
    doc.fillColor('#111').font('Helvetica-Bold').text(String(v), startX + colWidth, y);
    doc.font('Helvetica');
    doc.moveDown(0.15);
  }
  // Explicit-x text calls above (drawing the value column) leave pdfkit's
  // internal cursor at that x — reset it back to the left margin so
  // whatever is drawn next (a heading, a chart, ...) isn't unexpectedly
  // offset or clipped against the right edge of the page.
  doc.x = startX;
}

// Minimal, dependency-free table renderer (pdfkit has no built-in tables).
function drawTable(doc, headers, rows, colWidths) {
  const startX = doc.x;
  let y = doc.y;
  const rowHeight = 16;

  function drawRow(cells, opts = {}) {
    let x = startX;
    doc.fontSize(8.5);
    for (let i = 0; i < cells.length; i++) {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(opts.bold ? '#0a2647' : '#222')
        .text(String(cells[i] ?? ''), x, y, { width: colWidths[i] - 4, ellipsis: true });
      x += colWidths[i];
    }
  }

  drawRow(headers, { bold: true });
  y += rowHeight;
  doc.moveTo(startX, y - 3).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y - 3).strokeColor('#d7e3f0').stroke();

  for (const row of rows) {
    if (y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage();
      y = doc.y;
    }
    drawRow(row);
    y += rowHeight;
  }
  doc.y = y;
  doc.x = startX;
}

module.exports = { collectReportData, buildSummary, drawReport, rangeStartFor, PERIOD_LABELS };
