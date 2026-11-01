#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PATHS, SERVER_CONFIG } = require('../backend/config');
const { openDatabase, withTransaction, recordAuditLog } = require('../backend/db/connection');
const { hashPassword } = require('../backend/auth');

const generated = process.argv.includes('--generate');
const password = generated ? crypto.randomBytes(30).toString('base64url') : process.env.AUM_ADMIN_PASSWORD;
if (!password || password.length < 16 || password === 'AumAdvisory@2026') {
  throw new Error('Set AUM_ADMIN_PASSWORD to a new password of at least 16 characters, or use --generate');
}
const db = openDatabase();
try {
  const { hash, salt } = hashPassword(password);
  withTransaction(db, () => {
    db.prepare(`INSERT INTO users(email,full_name,role,password_hash,password_salt,is_active)
      VALUES(?,?,'principal',?,?,1) ON CONFLICT(email) DO UPDATE SET
      password_hash=excluded.password_hash,password_salt=excluded.password_salt,role='principal',is_active=1`)
      .run(SERVER_CONFIG.defaultAdminEmail, SERVER_CONFIG.defaultAdminName, hash, salt);
    const user = db.prepare('SELECT user_id FROM users WHERE email = ?').get(SERVER_CONFIG.defaultAdminEmail);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.user_id);
    recordAuditLog(db, { actorLabel: 'local_admin_setup', entityType: 'user', entityId: user.user_id, action: 'provision_principal', summary: 'Provisioned principal credentials and revoked previous sessions' });
  });
  if (generated) {
    const file = path.join(path.dirname(PATHS.dbFile), 'admin-credentials.json');
    fs.writeFileSync(file, JSON.stringify({ email: SERVER_CONFIG.defaultAdminEmail, password }, null, 2) + '\n', { mode: 0o600 });
    fs.chmodSync(file, 0o600);
    console.log(`Principal provisioned. Generated credentials saved locally to ${file} (owner access only).`);
  } else console.log('Principal provisioned; previous sessions revoked.');
} finally { db.close(); }
