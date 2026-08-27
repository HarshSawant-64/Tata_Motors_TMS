// Seed script: creates the default admin user and a small set of sample
// records so the dashboard is populated the first time the app is run.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- Admin user ---
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash,
        fullName: 'System Administrator',
        role: 'ADMIN',
      },
    });
    console.log('Created default admin user (admin / admin123)');
  } else {
    console.log('Admin user already exists, skipping.');
  }

  // --- HR user ---
  const existingHr = await prisma.user.findUnique({ where: { username: 'hr' } });
  if (!existingHr) {
    const passwordHash = await bcrypt.hash('hr123', 10);
    await prisma.user.create({
      data: {
        username: 'hr',
        passwordHash,
        fullName: 'HR Executive',
        role: 'HR',
      },
    });
    console.log('Created default HR user (hr / hr123)');
  } else {
    console.log('HR user already exists, skipping.');
  }

  // --- Sample faculty ---
  const facultyCount = await prisma.faculty.count();
  if (facultyCount === 0) {
    await prisma.faculty.createMany({
      data: [
        { facultyCode: 'FAC-001', name: 'R. Sharma', department: 'Weld', grade: 'Senior', status: 'Active', attendance: 'Present' },
        { facultyCode: 'FAC-002', name: 'S. Iyer', department: 'Paint', grade: 'Senior', status: 'Active', attendance: 'Present' },
        { facultyCode: 'FAC-003', name: 'A. Khan', department: 'SHE', grade: 'Mid', status: 'Active', attendance: 'Absent' },
        { facultyCode: 'FAC-004', name: 'P. Deshmukh', department: 'C&B', grade: 'Junior', status: 'Active', attendance: 'Present' },
      ],
    });
    console.log('Created sample faculty records.');
  }

  // --- Sample employees ---
  const employeeCount = await prisma.employee.count();
  if (employeeCount === 0) {
    await prisma.employee.createMany({
      data: [
        { employeeId: 'EMP-1001', name: 'V. Patil', department: 'Engine', category: 'Staff', grade: 'G3' },
        { employeeId: 'EMP-1002', name: 'N. Kulkarni', department: 'Transport', category: 'Technician', grade: 'G2' },
        { employeeId: 'EMP-1003', name: 'D. Joshi', department: 'Weld', category: 'Trainee', grade: 'G1' },
        { employeeId: 'EMP-1004', name: 'M. Rane', department: 'Paint', category: 'MTB', grade: 'G2' },
      ],
    });
    console.log('Created sample employee records.');
  }

  // --- Sample programs ---
  const programCount = await prisma.program.count();
  if (programCount === 0) {
    const faculty = await prisma.faculty.findMany();
    const prog1 = await prisma.program.create({
      data: {
        code: 'PRG-2026-001',
        name: 'Weld Safety Induction',
        category: 'Weld',
        description: 'Basic weld shop safety induction for new trainees.',
        status: 'Completed',
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-03'),
      },
    });
    const prog2 = await prisma.program.create({
      data: {
        code: 'PRG-2026-002',
        name: 'Paint Shop SHE Refresher',
        category: 'SHE',
        description: 'Annual Safety, Health & Environment refresher.',
        status: 'Planned',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-11'),
      },
    });
    const prog3 = await prisma.program.create({
      data: {
        code: 'PRG-2026-003',
        name: 'Cultural & Behavioural Workshop',
        category: 'C&B',
        description: 'Soft-skills and behavioural workshop for staff.',
        status: 'Postponed',
        startDate: new Date('2026-07-15'),
        endDate: new Date('2026-07-16'),
      },
    });
    const prog4 = await prisma.program.create({
      data: {
        code: 'PRG-2026-004',
        name: 'Engine Assembly Technical Training',
        category: 'Engine',
        description: 'Functional & technical training for engine assembly.',
        status: 'Cancelled',
        startDate: new Date('2026-05-20'),
        endDate: new Date('2026-05-21'),
      },
    });

    await prisma.session.create({
      data: {
        programId: prog1.id,
        date: new Date('2026-06-01'),
        endDate: new Date('2026-06-01'),
        startTime: '09:00',
        endTime: '13:00',
        facultyId: faculty[0]?.id,
        hall: 'Hall A',
        trainingTopic: 'Introduction to Weld Shop Safety',
        studentCount: 25,
        presentCount: 23,
        absentCount: 1,
        onlineCount: 1,
        status: 'Completed',
      },
    });
    await prisma.session.create({
      data: {
        programId: prog2.id,
        date: new Date('2026-09-10'),
        endDate: new Date('2026-09-10'),
        startTime: '10:00',
        endTime: '12:00',
        facultyId: faculty[2]?.id,
        hall: 'Hall B',
        trainingTopic: 'SHE Refresher Session 1',
        studentCount: 30,
        presentCount: 0,
        absentCount: 0,
        onlineCount: 0,
        status: 'Planned',
      },
    });
    console.log('Created sample programs and sessions.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
