'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { PATHS } = require('../config');

const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

let sharedDb = null;

function openDatabase(dbPath = PATHS.dbFile) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA_SQL);
  return db;
}

function getSharedDatabase() {
  if (!sharedDb) {
    sharedDb = openDatabase(PATHS.dbFile);
  }
  return sharedDb;
}

function closeSharedDatabase() {
  if (sharedDb) {
    try {
      sharedDb.close();
    } catch {}
    sharedDb = null;
  }
}

function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  }
}

/**
 * Synchronizes both Public FTS5 (strictly approved_public + available, zero private data)
 * and CRM Private FTS5 (all properties + private vault columns) for a single property_id.
 */
function syncPropertyFts(db, propertyId) {
  db.prepare('DELETE FROM properties_public_fts WHERE property_id = ?').run(propertyId);
  db.prepare('DELETE FROM properties_crm_fts WHERE property_id = ?').run(propertyId);

  const row = db.prepare(`
    SELECT
      p.*,
      pv.owner_name_cache,
      pv.owner_phone_cache,
      pv.owner_email_cache,
      pv.broker_name_cache,
      pv.broker_phone_cache,
      pv.source_group_name,
      pv.exact_unit_or_plot_no,
      pv.commission_terms,
      pv.payment_structure_notes,
      pv.encumbrance_notes,
      pv.raw_whatsapp_text,
      pv.internal_advisor_notes
    FROM properties p
    LEFT JOIN property_private pv ON pv.property_id = p.property_id
    WHERE p.property_id = ?
  `).get(propertyId);

  if (!row) return;

  const locationText = [row.city, row.corridor, row.locality, row.sector, row.micro_location]
    .filter(Boolean)
    .join(' ');
  const categoryText = [row.property_type, row.category, row.transaction_type]
    .filter(Boolean)
    .join(' ');
  const specsText = [
    row.configuration,
    row.bedrooms ? `${row.bedrooms} BHK` : null,
    row.area_value ? `${row.area_value} ${row.area_unit || ''}` : null,
    row.facing,
    row.road_width,
    row.price_text
  ]
    .filter(Boolean)
    .join(' ');
  const descText = [row.key_features, row.public_description, row.public_features]
    .filter(Boolean)
    .join(' ');

  // 1. Public FTS ONLY indexes approved_public + available mandates and ONLY public columns
  if (row.publication_state === 'approved_public' && row.availability_state === 'available') {
    db.prepare(`
      INSERT INTO properties_public_fts (
        property_id, listing_title, project_name, corridor, location_text, category_text, specs_text, description_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.property_id,
      row.listing_title || '',
      row.project_name || '',
      row.corridor || '',
      locationText,
      categoryText,
      specsText,
      descText
    );
  }

  // 2. CRM FTS indexes every mandate across all states + fiduciary vault
  const publicCombined = [
    row.property_id,
    row.listing_title,
    row.project_name,
    locationText,
    categoryText,
    specsText,
    descText
  ]
    .filter(Boolean)
    .join(' ');

  const ownerText = [row.owner_name_cache, row.owner_phone_cache, row.owner_email_cache]
    .filter(Boolean)
    .join(' ');
  const brokerText = [row.broker_name_cache, row.broker_phone_cache, row.source_group_name]
    .filter(Boolean)
    .join(' ');
  const privateNotesText = [
    row.commission_terms,
    row.payment_structure_notes,
    row.encumbrance_notes,
    row.internal_advisor_notes
  ]
    .filter(Boolean)
    .join(' ');

  db.prepare(`
    INSERT INTO properties_crm_fts (
      property_id, public_text, owner_text, broker_text, exact_unit_no, private_notes_text, raw_whatsapp_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.property_id,
    publicCombined,
    ownerText,
    brokerText,
    row.exact_unit_or_plot_no || '',
    privateNotesText,
    row.raw_whatsapp_text || ''
  );
}

function rebuildAllFts(db) {
  db.exec('DELETE FROM properties_public_fts;');
  db.exec('DELETE FROM properties_crm_fts;');
  const ids = db.prepare('SELECT property_id FROM properties ORDER BY property_id').all();
  for (const { property_id } of ids) {
    syncPropertyFts(db, property_id);
  }
}

function recordAuditLog(db, {
  actorUserId = null,
  actorLabel = 'system',
  entityType,
  entityId,
  action,
  summary = null,
  before = null,
  after = null
}) {
  db.prepare(`
    INSERT INTO audit_logs (
      actor_user_id, actor_label, entity_type, entity_id, action, summary, before_json, after_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actorUserId,
    actorLabel,
    entityType,
    String(entityId),
    action,
    summary,
    before != null ? JSON.stringify(before) : null,
    after != null ? JSON.stringify(after) : null
  );
}

module.exports = {
  openDatabase,
  getSharedDatabase,
  closeSharedDatabase,
  withTransaction,
  syncPropertyFts,
  rebuildAllFts,
  recordAuditLog
};
