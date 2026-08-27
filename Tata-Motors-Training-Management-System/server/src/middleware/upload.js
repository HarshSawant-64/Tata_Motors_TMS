const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set([
  '.xlsx', '.xls', '.csv', '.pdf', '.png', '.jpg', '.jpeg',
  '.doc', '.docx', '.ppt', '.pptx', '.mp4', '.zip',
]);

function sanitizeBaseName(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_') // path traversal protection (no "..")
    .slice(0, 100);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = sanitizeBaseName(path.basename(file.originalname, ext));
    const unique = crypto.randomBytes(6).toString('hex');
    const stamped = `${Date.now()}_${unique}_${base}${ext}`;
    cb(null, stamped);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File type "${ext}" is not permitted.`));
  }
  cb(null, true);
}

const maxSizeMb = Number(process.env.UPLOAD_MAX_SIZE_MB) || 25;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_EXTENSIONS };
