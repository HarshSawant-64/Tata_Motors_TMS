const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function rangeStartFor(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === 'weekly') start.setDate(now.getDate() - 7);
  else if (period === 'monthly') start.setMonth(now.getMonth() - 1);
  else start.setMonth(now.getMonth() - 6); // '6months' default
  return start;
}

router.get('/overview', requireAuth, async (req, res) => {
  const period = String(req.query.period || '6months');
  const start = rangeStartFor(period);

  const sessions = await prisma.session.findMany({
    where: { date: { gte: start } },
    include: { program: true, faculty: true },
  });

  // Sessions & participants & attendance over time (grouped by month label)
  const byMonth = {};
  for (const s of sessions) {
    const label = s.date.toISOString().slice(0, 7); // YYYY-MM
    if (!byMonth[label]) byMonth[label] = { month: label, sessions: 0, participants: 0, present: 0 };
    byMonth[label].sessions += 1;
    byMonth[label].participants += s.studentCount || 0;
    byMonth[label].present += s.presentCount || 0;
  }
  const timeline = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));

  // Programs by category (all programs, not time-filtered, for a full picture)
  const programs = await prisma.program.findMany();
  const byCategory = {};
  for (const p of programs) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  // Programs by status
  const byStatus = {};
  for (const p of programs) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
  }

  // Faculty / session allocation
  const facultyAllocation = {};
  for (const s of sessions) {
    const key = s.faculty ? s.faculty.name : 'Unassigned';
    facultyAllocation[key] = (facultyAllocation[key] || 0) + 1;
  }

  // Department distribution (from employees)
  const employees = await prisma.employee.findMany();
  const byDepartment = {};
  for (const e of employees) {
    const dept = e.department || 'Unassigned';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  }

  res.json({
    period,
    timeline,
    programsByCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
    programsByStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    facultyAllocation: Object.entries(facultyAllocation).map(([faculty, count]) => ({ faculty, count })),
    departmentDistribution: Object.entries(byDepartment).map(([department, count]) => ({ department, count })),
  });
});

module.exports = router;
