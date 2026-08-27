const rateLimit = require('express-rate-limit');

// Tight limit specifically on the login endpoint: slows down credential
// stuffing / brute-force attempts regardless of the per-account lockout
// tracked in the database (defense in depth — this one is per-IP).
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this network. Please wait a few minutes and try again.' },
});

// Loose limit across the whole API as a basic safety net against scripted
// abuse/denial-of-service; generous enough not to affect normal usage.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});

module.exports = { loginLimiter, apiLimiter };
