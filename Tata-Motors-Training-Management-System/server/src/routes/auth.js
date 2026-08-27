const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
const { requireAuth, JWT_SECRET, COOKIE_NAME } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const TOKEN_TTL = '8h';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

// Cookie attributes for the session token. httpOnly keeps it out of reach of
// any injected/malicious JavaScript (the main defense against XSS-based
// token theft); sameSite=lax means it is never sent on cross-site
// POST/PUT/DELETE requests, which covers CSRF for this single-origin app.
// COOKIE_SECURE should be "true" once the app is served over HTTPS.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: TOKEN_TTL_MS,
    path: '/',
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

// Enforced on every password set/change: at least 8 characters, containing
// both a letter and a number. Deliberately not requiring symbols too, to
// keep it usable, while still ruling out trivially weak passwords.
function passwordPolicyError(password) {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Same generic error whether the username doesn't exist or the password is
  // wrong, so an attacker can't use this endpoint to enumerate valid
  // usernames.
  const invalidCredentials = () => res.status(401).json({ error: 'Invalid username or password.' });

  if (!user) {
    return invalidCredentials();
  }

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: `This account is temporarily locked after too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: shouldLock ? 'LOGIN_LOCKOUT' : 'LOGIN_FAILED',
        details: shouldLock
          ? `Account "${user.username}" locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} consecutive failed login attempts.`
          : `Failed login attempt for "${user.username}" (${attempts}/${MAX_FAILED_ATTEMPTS}).`,
      },
    });

    if (shouldLock) {
      return res.status(423).json({
        error: `Too many failed attempts. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
      });
    }
    return invalidCredentials();
  }

  // Successful login: clear any lockout state.
  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  const token = signToken(user);

  await prisma.auditLog.create({
    data: { userId: user.id, action: 'LOGIN', details: `User ${user.username} logged in.` },
  });

  res.cookie(COOKIE_NAME, token, cookieOptions());

  // The token now lives only in the httpOnly cookie (unreachable from JS),
  // so it is intentionally not included in the JSON body.
  res.json({
    user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
  });
});

router.post('/logout', requireAuth, async (req, res) => {
  await prisma.auditLog.create({
    data: { userId: req.user.id, action: 'LOGOUT', details: `User ${req.user.username} logged out.` },
  });
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// Allows the currently logged-in admin to change their own username and/or
// password. Requires the current password to be supplied for verification.
router.put('/account', requireAuth, async (req, res) => {
  const { currentPassword, newUsername, newPassword, confirmPassword } = req.body || {};

  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const validCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!validCurrent) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const trimmedUsername = typeof newUsername === 'string' ? newUsername.trim() : '';
  const wantsUsernameChange = trimmedUsername.length > 0 && trimmedUsername !== user.username;
  const wantsPasswordChange = !!newPassword || !!confirmPassword;

  if (typeof newUsername === 'string' && newUsername.trim().length === 0 && newUsername.length > 0) {
    return res.status(400).json({ error: 'Username cannot be empty.' });
  }

  if (!wantsUsernameChange && !wantsPasswordChange) {
    return res.status(400).json({ error: 'Enter a new username or password to update.' });
  }

  const data = {};

  if (wantsUsernameChange) {
    const existing = await prisma.user.findUnique({ where: { username: trimmedUsername } });
    if (existing && existing.id !== user.id) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    data.username = trimmedUsername;
  }

  if (wantsPasswordChange) {
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Enter and confirm the new password.' });
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return res.status(400).json({ error: policyError });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  try {
    const updated = await prisma.user.update({ where: { id: user.id }, data });

    await prisma.auditLog.create({
      data: {
        userId: updated.id,
        action: 'ACCOUNT_UPDATE',
        details: `User ${user.username} updated their account credentials.`,
      },
    });

    // Username/password may have changed, so issue a fresh session cookie
    // reflecting it.
    const token = signToken(updated);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    res.json({
      message: 'Account credentials updated successfully.',
      user: { id: updated.id, username: updated.username, role: updated.role, fullName: updated.fullName },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account.' });
  }
});

module.exports = router;
