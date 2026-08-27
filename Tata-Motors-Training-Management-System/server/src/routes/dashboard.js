const express = require('express');
const prisma = require('../prismaClient');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/kpis', requireAuth, async (req, res) => {
  const [
    totalPrograms,
    planned,
    completed,
    cancelled,
    postponed,
    scheduledSessions,
    facultyCount,
    employeeCount,
    sessions,
  ] = await Promise.all([
    prisma.program.count(),
    prisma.program.count({ where: { status: 'Planned' } }),
    prisma.program.count({ where: { status: 'Completed' } }),
    prisma.program.count({ where: { status: 'Cancelled' } }),
    prisma.program.count({ where: { status: 'Postponed' } }),
    prisma.session.count(),
    prisma.faculty.count(),
    prisma.employee.count(),
    prisma.session.findMany({ select: { studentCount: true, presentCount: true, facultyId: true } }),
  ]);

  const totalParticipants = sessions.reduce((sum, s) => sum + (s.studentCount || 0), 0);
  const totalPresent = sessions.reduce((sum, s) => sum + (s.presentCount || 0), 0);
  const assignedFacultyIds = new Set(sessions.filter((s) => s.facultyId).map((s) => s.facultyId));

  res.json({
    totalPrograms,
    plannedPrograms: planned,
    completedPrograms: completed,
    cancelledPrograms: cancelled,
    postponedPrograms: postponed,
    scheduledSessions,
    facultyAssigned: assignedFacultyIds.size,
    employees: employeeCount,
    totalParticipants,
    totalPresent,
    totalFaculty: facultyCount,
  });
});

router.get('/completed-programs', requireAuth, async (req, res) => {
  const programs = await prisma.program.findMany({
    where: { status: 'Completed' },
    include: { sessions: true },
    orderBy: { updatedAt: 'desc' },
  });

  const result = programs.map((p) => {
    const sessionCount = p.sessions.length;
    const participants = p.sessions.reduce((sum, s) => sum + (s.studentCount || 0), 0);
    const present = p.sessions.reduce((sum, s) => sum + (s.presentCount || 0), 0);
    const attendancePct = participants > 0 ? Math.round((present / participants) * 100) : 0;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      sessions: sessionCount,
      participants,
      attendancePct,
      status: p.status,
    };
  });

  res.json(result);
});

router.get('/faculty-panel', requireAuth, async (req, res) => {
  const facultyList = await prisma.faculty.findMany();
  const total = facultyList.length;
  const present = facultyList.filter((f) => (f.attendance || '').toLowerCase() === 'present').length;

  const sessions = await prisma.session.findMany({ select: { facultyId: true } });
  const assigned = new Set(sessions.filter((s) => s.facultyId).map((s) => s.facultyId)).size;

  const byDepartment = {};
  for (const f of facultyList) {
    const dept = f.department || 'Unassigned';
    byDepartment[dept] = (byDepartment[dept] || 0) + 1;
  }

  const imported = facultyList.filter((f) => f.rawData).length;

  res.json({
    totalFaculty: total,
    assignedFaculty: assigned,
    facultyImported: imported,
    presentFaculty: present,
    byDepartment: Object.entries(byDepartment).map(([department, count]) => ({ department, count })),
  });
});

router.get('/program-status-graph', requireAuth, async (req, res) => {
  const statuses = ['Planned', 'Completed', 'Cancelled', 'Postponed'];
  const counts = await Promise.all(
    statuses.map((status) => prisma.program.count({ where: { status } }))
  );
  res.json(statuses.map((status, i) => ({ status, count: counts[i] })));
});

router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ employees: [], faculty: [], programs: [] });

  const [employees, faculty, programs] = await Promise.all([
    prisma.employee.findMany({
      where: {
        OR: [
          { employeeId: { contains: q } },
          { name: { contains: q } },
          { department: { contains: q } },
          { category: { contains: q } },
          { grade: { contains: q } },
          { rawData: { contains: q } }, // any Excel column, mapped or not (e.g. Plant, Skill, Shift)
        ],
      },
      take: 25,
    }),
    prisma.faculty.findMany({
      where: {
        OR: [
          { facultyCode: { contains: q } },
          { name: { contains: q } },
          { department: { contains: q } },
        ],
      },
      take: 25,
    }),
    prisma.program.findMany({
      where: {
        OR: [
          { code: { contains: q } },
          { name: { contains: q } },
          { category: { contains: q } },
        ],
      },
      take: 25,
    }),
  ]);

  res.json({ employees, faculty, programs });
});

module.exports = router;
