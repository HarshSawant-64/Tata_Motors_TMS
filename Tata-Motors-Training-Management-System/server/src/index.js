require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const { apiLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const programRoutes = require('./routes/programs');
const sessionRoutes = require('./routes/sessions');
const trainingRoutes = require('./routes/trainings');
const mainProgramRoutes = require('./routes/mainPrograms');
const facultyRoutes = require('./routes/faculty');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const uploadRoutes = require('./routes/uploads');
const analyticsRoutes = require('./routes/analytics');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 4000;

// Sets a battery of protective HTTP response headers (X-Content-Type-Options,
// X-Frame-Options, disables X-Powered-By, etc). crossOriginResourcePolicy is
// relaxed since uploaded files/PDFs are legitimately fetched cross-port by
// the separately-served client during local/LAN deployment.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://192.168.31.198:5173',
    credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Baseline abuse/DoS protection across the whole API. The login route has
// its own, much stricter limiter layered on top (see routes/auth.js).
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'TMTP API' }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/main-programs', mainProgramRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);

// Central error handler (e.g. Multer file-type/size errors). Multer/known
// client-input errors have user-safe messages and are passed through;
// anything else is logged server-side only and a generic message is
// returned, so internal details (stack traces, file paths, SQL, etc.) never
// reach the client.
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof multer.MulterError || (err && err.status && err.status < 500)) {
    return res.status(400).json({ error: err.message });
  }
  if (err && /not permitted|is required|must be/i.test(err.message || '')) {
    // Known validation-style errors thrown by our own upload/file-type
    // checks (see middleware/upload.js) — safe to show verbatim.
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Unexpected server error. Please try again or contact support.' });
});

app.listen(PORT, () => {
  console.log(`Tata Motors Training Management Portal API running on http://localhost:${PORT}`);
});
