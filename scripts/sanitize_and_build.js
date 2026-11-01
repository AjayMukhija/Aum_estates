#!/usr/bin/env node
'use strict';

// One publication contract: SQLite master -> validated public projections.
const { PATHS } = require('../backend/config');
const { openDatabase } = require('../backend/db/connection');
const { seedDatabaseIfEmpty } = require('../backend/db/seed');
const { compileAndPublishStaticFeeds } = require('../backend/domain/publisher');
if (process.argv[2]) throw new Error('Direct JSON-to-public export is disabled. Import through the authenticated CRM, review, and approve records first.');
const db = openDatabase(PATHS.dbFile);
try {
  seedDatabaseIfEmpty(db);
  const release = compileAndPublishStaticFeeds(db, { actorLabel: 'cli_build' });
  console.log(`Built ${release.counts.publicProperties} public references; release ${release.releaseId}`);
} finally { db.close(); }
