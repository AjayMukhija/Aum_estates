#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PATHS } = require('../backend/config');
const dir = path.join(path.dirname(PATHS.dbFile), 'backups');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, `master-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
const db = new DatabaseSync(PATHS.dbFile, { readOnly: true });
try {
  db.prepare('VACUUM INTO ?').run(file);
  fs.chmodSync(file, 0o600);
  console.log(`Consistent SQLite backup: ${file}`);
} finally { db.close(); }
