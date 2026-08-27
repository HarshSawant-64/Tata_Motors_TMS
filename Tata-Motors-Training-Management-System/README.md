# Tata Motors Training Management Portal

An internal web application for managing training programs, scheduling, faculty,
employees, attendance and analytics on a company network.

## Technology Stack

| Layer      | Technology                    |
|------------|--------------------------------|
| OS         | Windows                        |
| Node.js    | v22.x                          |
| npm        | 10.x                           |
| Frontend   | Vite + React + TypeScript      |
| Backend    | Node.js + Express              |
| ORM        | Prisma                         |
| Database   | SQLite (local file)            |
| Charts     | Recharts                       |
| Excel      | XLSX / SheetJS                 |

## Project Structure

```
/
├── client/          Vite + React + TypeScript frontend
├── server/          Express + Prisma backend API
│   ├── prisma/      schema.prisma, seed.js
│   └── uploads/     stored uploaded files (created at runtime)
├── setup.bat        one-time install + database setup
├── start.bat        starts backend + frontend and opens the browser
├── stop.bat         stops both processes
└── README.md
```

## Quick Start (Windows)

1. Install **Node.js v22.x** if not already installed: https://nodejs.org
2. Double-click **`setup.bat`**. This will:
   - Install server and client dependencies
   - Generate the Prisma client
   - Create the SQLite database (`server/dev.db`) and run migrations
   - Seed the database with a default admin user and sample data
3. Double-click **`start.bat`**. This opens two windows (backend on port
   4000, frontend on port 5173) and opens the app in your browser at
   `http://localhost:5173`.
4. Log in with the demo credentials below.
5. When finished, double-click **`stop.bat`**.

### Upgrading an existing installation

If you already had a previous version of this project set up (with data in
`server/prisma/dev.db`), this update adds two small database changes: a new
`Training` table (manually-added trainings) and a link from `Employee` to
the `Upload` record it was imported from. Your existing data is **not**
touched or lost — you just need to apply the new migration once:

```bash
cd server
npx prisma migrate deploy
```

(Re-running `setup.bat` also does this automatically, in step 3.)

### Demo Credentials

```
Admin — Username: admin   Password: admin123
HR    — Username: hr      Password: hr123
```

Passwords are hashed with bcrypt in the database and are never returned by
any API response. Change these before any real internal deployment — see
"Security Notes" below.

## Manual Setup (any OS)

```bash
# Backend
cd server
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start          # http://localhost:4000

# Frontend (in a second terminal)
cd client
npm install
npm run dev             # http://localhost:5173
```

## Environment Variables

`server/.env`
```
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET="<generate a strong random value — see below>"
UPLOAD_MAX_SIZE_MB=25
CLIENT_ORIGIN="http://localhost:5173"
COOKIE_SECURE=false
NODE_ENV=development
```

`client/.env`
```
VITE_API_BASE_URL=http://localhost:4000/api
```

Generate a strong `JWT_SECRET` for every deployment (never reuse the one
shipped in this repo, and never commit a real production secret):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Set `COOKIE_SECURE=true` and `NODE_ENV=production` once the app is served
over HTTPS — the server will refuse to start in production with a
missing/default `JWT_SECRET`.

## Core Features

- **Dashboard** — KPI cards (programs by status, sessions, faculty, employees,
  participants, attendance), a Completed Programs panel, a Faculty Assigned
  panel, a Program Status chart, and cross-entity search — all values are
  computed live from the SQLite database, never hard-coded.
- **Programs** — create/edit/view/delete/search/filter training programs
  across 23 built-in categories (new categories can be typed directly into
  the category field). New/edited/deleted programs are reflected in
  Scheduling immediately — Scheduling always reads the live program list,
  so there's nothing to keep in sync manually.
- **Scheduling** — a month-view calendar (previous/next/today, click a date
  to see/add/edit/delete sessions for that day). The training list for
  each main program (SHE / Induction / F&T / C&B) can be extended on the
  spot with **+ Add New Training Manually** — the new training is saved,
  selected immediately, and stays available for all future scheduling
  without editing any code.
- **Faculty search** — every place a faculty member is selected (creating a
  session, the calendar Create/Edit Program flow) now has a live search box
  instead of one long dropdown — search by employee ID/number, name, or any
  other identifying Excel column, with results filtering as you type.
- **Session Details** — full session information, attendance upload, and
  document/photo upload, all tied to the session.
- **Faculty / Employees** — registries with manual entry and dynamic Excel/CSV
  import. The Employee table itself is schema-driven: its columns are
  generated from whatever headers were in the most recently imported Excel
  file (not a fixed list), with a column-visibility toggle for wide sheets
  and pagination for large datasets. Every employee has a full **Profile**
  page showing all Excel columns for that row, split into Basic Information
  and Additional Information. The Dashboard shows dynamic breakdown charts
  (e.g. "Employees by Plant", "Employees by Skill") for whichever
  categorical columns are actually present in the data — a column that
  wasn't uploaded simply doesn't produce a chart. Search covers every
  column, mapped or not (e.g. searching a Skill or Location value works
  even though those aren't dedicated database columns). Import is a
  two-step **Preview → Confirm** flow: selecting a file shows the detected
  sheet, columns, row count, and the first rows before anything is written
  to the database. A **Delete All Employees** button (with a double
  confirmation) clears the entire registry at once instead of one-by-one.
  Deleting an employee-import record from the Uploads tab also removes the
  employee data that import brought in, so the Employee tab never keeps
  showing records whose source Excel file was deleted.
- **Attendance** — manual entry or Excel/CSV import per session, with
  present/absent/online counts recalculated automatically.
- **Analytics** — bar-chart-only, data-driven analytics (weekly / monthly /
  6-month) for sessions, participants, attendance, programs by
  category/status, faculty allocation, and department distribution — every
  figure is computed live from Scheduling/program data, never static or
  placeholder.
- **Uploads** — a central log of every file uploaded to the system.
- **Reports (PDF)** — Weekly / Monthly / 6-Month reports with a clean,
  consistent professional layout (margins, headings, tables, page breaks)
  and **live bar-graph charts** (sessions by program, programs by category,
  programs by status) rendered directly from the current database on every
  download — never a static image, and always matching what the Analytics
  screen shows for the same data.

## Dynamic Excel/CSV Import — No Fixed Template

Faculty, Employee, and Attendance imports do **not** require a specific
column layout. For every uploaded workbook the server:

1. Reads the workbook and automatically picks the most populated sheet.
2. Detects every column header present.
3. Detects every row.
4. Recognizes common aliases (case/spacing-insensitive), e.g.:
   - `Employee ID` / `Employee No` / `Personnel No` / `P No` → `employeeId`
   - `Name` / `Employee Name` / `Faculty Name` → `name`
   - `Department` / `Dept` → `department`
   - `Grade` / `Designation` → `grade`
   - `Attendance` / `Present` / `Status` → `attendance`
   - `Category` / `Type` → `category`
5. Preserves the full original row (including unmapped/unknown columns) as
   raw JSON alongside the normalized fields — nothing is discarded.
6. Returns the detected column names, row count, and a preview to the UI
   before/after import.

A file is **never rejected** just because its columns differ from a
previous upload.

### Employee Import Specifics

- `POST /api/employees/import/preview` — dry run. Parses the file and
  returns the detected sheet, columns, row count, identifier column, and
  the first rows. **Nothing is written to the database** at this step.
- `POST /api/employees/import` — commits the import: creates new employees,
  updates existing ones (matched by the detected identifier column), and
  never deletes anyone automatically. Returns a full summary (created /
  updated / skipped / auto-ID-assigned / per-row notes).
- `GET /api/employees/columns` — the exact Excel headers from the most
  recent import, used to render the dynamic employee table.
- `GET /api/employees/stats` — dynamically detected categorical fields
  (distinct values between 2 and 40, reasonable coverage, and not an
  ID/name column) with a value breakdown, used for the Dashboard charts.
- `GET /api/employees/:id` — full employee profile: every column from that
  employee's Excel row, plus attendance/training statistics if any exist.
- Uploading the **same file twice** never creates duplicates — matching is
  done by the detected identifier column (e.g. `Employee ID`, `Pers.No.`,
  `Emp Code`, ...). If no identifier-like column can be found, a row still
  imports (never silently dropped) using an auto-generated ID, and this is
  reported back in the import summary.
- Column order, renames, additions, and removals between uploads are all
  handled automatically — no code change is required when tomorrow's Excel
  looks different from today's.

## File Uploads

Supported types: XLSX, XLS, CSV, PDF, PNG, JPG/JPEG, DOC/DOCX, PPT/PPTX,
MP4, ZIP.

- Filenames are sanitized and given a unique, timestamped stored name.
- Extension is validated against an allow-list; unrecognized types are
  rejected.
- Uploaded files are **stored only** — the server never executes them.
- Files are served back only through an authenticated download route with
  path-traversal protection.

## Security Notes — Please Read

Running this application on `localhost` or an internal company network
**does not by itself make it secure**. This project implements the
following protections:

- **Two separate roles/accounts**: Admin and HR, each with their own
  username/password. Destructive actions (deleting programs, sessions,
  faculty, employees, and uploads) are restricted to Admin; HR has full
  create/read/update access for day-to-day use.
- **httpOnly session cookies** — the login token is never exposed to
  client-side JavaScript (mitigates token theft via XSS), with
  `SameSite=Lax` cookies and a locked-down CORS origin as CSRF defense.
- **Account lockout** — 5 consecutive failed login attempts locks that
  account for 15 minutes, logged to the audit trail.
- **Rate limiting** — a strict per-IP limit on the login endpoint plus a
  general limit across the API, to slow down brute-force/credential-
  stuffing and scripted abuse.
- **Password policy** — new/changed passwords must be 8+ characters with
  at least one letter and one number.
- **Security response headers** via Helmet (CSP, HSTS, X-Frame-Options,
  disabled `X-Powered-By`, etc).
- Input validation, filename sanitization, path-traversal protection,
  environment-based secrets with a startup check against default/missing
  values, no password hash exposure via the API, Prisma parameterized
  queries, MIME/extension allowlisting on uploads (multer 2.x), and a
  full audit log (logins, failures, lockouts, CRUD actions, report
  downloads).
- A generic error handler that never leaks internal error details/stack
  traces to the client.

Before any real internal or production rollout, IT should additionally put
in place:

- Corporate SSO / Active Directory integration for authentication
- HTTPS (TLS) for all traffic, including within the internal network — and
  set `COOKIE_SECURE=true` / `NODE_ENV=production` once TLS is in place
- Antivirus / malware scanning of all uploaded files
- Centralized audit logging and log retention policy
- Scheduled backups of the SQLite database file
- IT-approved network segmentation and access controls
- Routine `npm audit` / dependency scanning as part of the deployment
  pipeline

## Database Model (Prisma)

`User`, `Program`, `Session`, `Faculty`, `Employee`, `Upload`, `Training`,
`AttendanceRecord`, `AuditLog` — see `server/prisma/schema.prisma` for the
full schema and relationships (`Program → Session`, `Program → Upload`,
`Session → Faculty`, `Session → AttendanceRecord`, `Employee → AttendanceRecord`,
`Upload → Employee` — an employee-category upload cascades to the employees
it imported if that upload record is deleted).

## Troubleshooting

- **`prisma generate` / `prisma migrate` fails to download an engine
  binary** — this needs outbound internet access to `binaries.prisma.sh`
  on first install. If your machine is on a restricted network, run setup
  once from a machine/network with normal internet access, or configure an
  npm/Prisma mirror per Prisma's offline-installation docs.
- **"No recognizable employee-identifier column" notice after import** —
  the uploaded sheet didn't have a header matching a known ID pattern
  (Employee ID, Pers.No., Emp Code, etc.). Rows still import using an
  auto-generated ID; if this happens by mistake, check for a typo in the
  ID column header, or rename it to something like `Employee ID`.
- **A column I expected on the Dashboard chart isn't showing** — dynamic
  charts only appear for columns with a reasonable number of repeating
  values (2–40 distinct values) and reasonable coverage (roughly 30%+ of
  rows non-blank). Free-text or all-unique columns (like Name or ID) are
  intentionally excluded, since a chart of all-unique values isn't useful.
- **Employee table looks different after a new import** — this is
  expected: the table columns are generated from the most recently
  imported file's headers. Use the "Columns" control to show/hide columns
  for very wide sheets.
- **Server won't start / `@prisma/client did not initialize` error** — run
  `npx prisma generate` inside `server/` (this is done automatically by
  `setup.bat`) before `npm start`.

## Notes

- The UI is an original, minimal, formal corporate design (charcoal / deep
  maroon / muted green / amber / warm beige) and does not copy any
  reference screenshots.
- This is a real, working full-stack application — not a mockup. All
  buttons and navigation items are wired to the backend API and the SQLite
  database.
