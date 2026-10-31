'use strict';

const crypto = require('node:crypto');
const { SERVER_CONFIG } = require('./config');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, expectedHash, salt) {
  if (!password || !expectedHash || !salt) return false;
  const computed = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of String(cookieHeader).split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function createSession(db, userId, ipAddress = null) {
  // Purge expired sessions opportunistically
  db.prepare("DELETE FROM sessions WHERE expires_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now')").run();

  const sessionId = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + SERVER_CONFIG.sessionTtlHours * 3600 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (session_id, user_id, csrf_token, expires_at, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, csrfToken, expiresAt, ipAddress);

  return { sessionId, csrfToken, expiresAt };
}

function getAuthenticatedSession(db, req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SERVER_CONFIG.sessionCookieName] || req.headers['x-aum-session'];
  if (!sid) return null;

  const row = db.prepare(`
    SELECT
      s.session_id,
      s.csrf_token,
      s.expires_at,
      u.user_id,
      u.email,
      u.full_name,
      u.role,
      u.is_active
    FROM sessions s
    JOIN users u ON u.user_id = s.user_id
    WHERE s.session_id = ?
  `).get(sid);

  if (!row || !row.is_active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sid);
    return null;
  }

  return row;
}

function destroySession(db, req) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SERVER_CONFIG.sessionCookieName] || req.headers['x-aum-session'];
  if (sid) {
    db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sid);
  }
}

function buildSessionCookie(sessionId, maxAgeSeconds) {
  const parts = [
    `${SERVER_CONFIG.sessionCookieName}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  return parts.join('; ');
}

function verifyCsrf(req, session) {
  if (!session) return false;
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  // If authenticated via explicit API session header (CLI/integration), allow; if via cookie, require matching CSRF token
  if (req.headers['x-aum-session']) return true;
  const provided = req.headers['x-csrf-token'];
  if (!provided || typeof provided !== 'string') return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(session.csrf_token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  hashPassword,
  verifyPassword,
  parseCookies,
  createSession,
  getAuthenticatedSession,
  destroySession,
  buildSessionCookie,
  verifyCsrf
};
