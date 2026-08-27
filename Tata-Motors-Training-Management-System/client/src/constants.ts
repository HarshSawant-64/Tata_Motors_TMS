export const PROGRAM_CATEGORIES = [
  'Staff', 'Technician', 'Trainee', 'Lakshya Trainee', 'Temporary', 'MTB', 'NAOPS',
  'Diploma', 'ITF Diploma', 'Fuic HR', 'Paint', 'Transport', 'Engine', 'Weld',
  'JWeld', 'KWeld', 'TCP-1', 'TCP-2', 'SHE', 'C&B', 'F&T', 'Induction', 'Calendar Program',
];

export const PROGRAM_STATUSES = ['Planned', 'Completed', 'Cancelled', 'Postponed'];

export const CATEGORY_DEFINITIONS: Record<string, string> = {
  SHE: 'Safety, Health & Environment',
  'C&B': 'Cultural & Behavioural',
  'F&T': 'Functional & Technical',
};

// ---------------------------------------------------------------------------
// Calendar "Create Program" feature
// ---------------------------------------------------------------------------
// The four main programs that can be created directly from the Scheduling
// calendar, and the training master list belonging to each one. `value`
// matches the existing PROGRAM_CATEGORIES entries so calendar-created
// programs stay consistent with the rest of the app (Programs page filters,
// reports, etc). `label` is only what is displayed in the calendar dropdown.
export const CALENDAR_MAIN_PROGRAMS: { value: string; label: string }[] = [
  { value: 'SHE', label: 'SHE' },
  { value: 'Induction', label: 'INDUCTION' },
  { value: 'F&T', label: 'F&T' },
  { value: 'C&B', label: 'CB' },
];

export const CALENDAR_TRAINING_CATALOG: Record<string, string[]> = {
  SHE: [
    'Action Employee Can Take (AECT)',
    'Basic Environment Management',
    'Behavior Based Safety (AECT)',
    'CPR & AED',
    'Chemical Safety Standard',
    'Confined Space Entry',
    'Defensive Driving & Vehicle Traffic Safety',
    'Electric Safety Management',
    'Emergency Preparedness Plan',
    'Fire Safety Management System',
    'First Aid Assistant Training',
    'Hand & Cut Injury Prevention',
    'Hazard Identification and Risk Assessment',
    'HIRA Refresher Training',
    'Hearing Conservation',
    'Heat Stress',
    'Job Safety Analysis',
    'Lifestyle Diseases',
    'Lifting and Support to Load',
    'Lock Out Tag Out',
    'Machine Guarding',
    'Management of Change',
    'Material Handling',
    'Monsoon Disease Prevention',
    'One to One Help — Monsoon Diseases',
    'Overcoming Failures',
    'Permit to Work',
    'Personal Protective Equipments',
    'Precaution of Heat Stress Disorder & Importance of Flu Vaccination',
    'Prevention of Osteoporosis',
    'Safe Driving & Vehicle Traffic Safety',
    'Work At Height',
  ],
  Induction: [
    'Company Overview',
    'Employee Facilities & Amenities Orientation',
    'Fire Safety',
    'HR Policies & Code of Conduct',
    'Know Your Company',
    'Plant Safety Walkthrough',
    'POSH',
    'Quality Orientation',
    'Safety Orientation',
    'Vision / Mission / Values (VMV)',
    'Workplace Orientation',
  ],
  'F&T': [
    '5S',
    'ADAS',
    'Advanced Vehicle Features',
    'Basic CNC Machines Workshop',
    'Basics of PLC',
    'COMMWIP',
    'Data Driven Problem Solving',
    'Financial Management',
    'FST Training Workshop',
    'Industry 4.0',
    'Leadership Board Document',
    'Mechatronics Module 1',
    'Mechatronics Module 2',
    'Mechatronics Module 3',
    'MS Excel Workshop',
    'NOVA Punch EV Product Training',
    'Orientation of CEES',
    'Orientation to Automobile Electrical & Electronics',
    'PLC & VFD Training',
    'Self Directed Teams',
    'SMART Engine Sensors & Actuators',
    'TPM Awareness',
    'Understanding Modern Vehicle Features',
    'Upskilling in Auto Electrical & Electronics Module 1',
    'Upskilling in Auto Electrical & Electronics Module 2',
    'Upskilling in Auto Electrical & Electronics Module 3',
    'Upskilling in Auto Electrical & Electronics Module 4',
    'Welding Technology',
    'World Class Quality',
  ],
  'C&B': [
    'Attendance Awareness',
    'Culture Credo Workshop',
    'Mission, Vision & Values',
    'POSH',
    'TCOC',
  ],
};

// Prefix used for the auto-managed "container" Program records that back
// calendar-created programs (see server/src/routes/programs.js). Sessions
// whose program.code starts with this prefix are rendered using the
// compact multi-training calendar UI instead of the regular session form.
export const CALENDAR_PROGRAM_CODE_PREFIX = 'CAL-';
