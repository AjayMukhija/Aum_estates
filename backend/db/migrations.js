'use strict';

// Versioned data/schema upgrades run transactionally on existing databases.
function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const migrations = [
    [1, () => {
      db.exec(`CREATE TABLE inventory_undo (
        change_id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL,
        undone INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
      // Disable known compromised bootstrap accounts, without resetting any
      // real password. The operator can provision a replacement with setup:admin.
      const { verifyPassword } = require('../auth');
      for (const user of db.prepare('SELECT * FROM users').all()) {
        if (verifyPassword('AumAdvisory@2026', user.password_hash, user.password_salt)) {
          db.prepare('UPDATE users SET is_active = 0 WHERE user_id = ?').run(user.user_id);
          db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.user_id);
        }
      }
      for (const [wrong, correct, expected] of [
        ['AUM-WEB-000142', 'AUM-WEB-000137', 'Arbour'],
        ['AUM-WEB-000095', 'AUM-WEB-000169', 'Quartier']
      ]) {
        const row = db.prepare('SELECT * FROM properties WHERE property_id = ?').get(wrong);
        if (row?.is_featured_approved && (row.featured_card_override_json || '').includes(expected) && db.prepare('SELECT 1 FROM properties WHERE property_id = ?').get(correct)) {
          db.prepare('UPDATE properties SET is_featured_approved = 1, featured_sort_order = ? WHERE property_id = ?').run(row.featured_sort_order, correct);
          db.prepare('UPDATE properties SET is_featured_approved = 0, featured_card_override_json = NULL WHERE property_id = ?').run(wrong);
        }
      }
      // Existing links remain revocable and now have a bounded lifetime.
      db.exec("UPDATE client_shortlists SET expires_at = datetime(created_at, '+30 days') WHERE expires_at IS NULL");
    }],
    [2, () => {
      const { cleanListingTitle, slugify } = require('../domain/normalizer');
      for (const row of db.prepare('SELECT property_id,listing_title,project_name FROM properties').all()) {
        const title = cleanListingTitle(row.listing_title, row.project_name);
        if (title !== row.listing_title) {
          db.prepare("UPDATE property_private SET exact_unit_or_plot_no = COALESCE(exact_unit_or_plot_no, ?) WHERE property_id = ?").run(row.listing_title, row.property_id);
          db.prepare('UPDATE properties SET listing_title = ?, slug = ? WHERE property_id = ?').run(title, slugify(`${row.property_id}-${title}`), row.property_id);
        }
      }
      db.exec("UPDATE property_private SET title_deed_verified = 0 WHERE source_group_name = 'Master Workbook v13 (10 Oct 2026)' AND encumbrance_notes IS NULL");
      // Retain historical demo records for accountability, while clearly removing
      // their mandates and buyer pipeline from active operational work.
      db.exec(`UPDATE properties SET publication_state='archived',is_featured_approved=0
        WHERE property_id IN (SELECT property_id FROM property_private WHERE owner_email_cache='vsinghania@example.org' OR raw_whatsapp_text LIKE 'Elevate Hines Sec 59 | 3395 sqft%')
        AND property_id IN ('AUM-OFF-000001','AUM-DRF-000001')`);
      db.exec("UPDATE leads SET stage='closed_lost',lead_title='[DEMO] ' || lead_title WHERE client_email='s.malhotra@example.org' AND lead_id='LEAD-2026-0001' AND lead_title NOT LIKE '[DEMO]%'");
      db.exec("UPDATE contacts SET trust_tier='demo_fixture',full_name='[DEMO] ' || full_name WHERE (email IN ('vsinghania@example.org','s.malhotra@example.org') OR (contact_id='CNT-BRK-001' AND phone_norm='9810277310')) AND full_name NOT LIKE '[DEMO]%'");
    }]
  ];
  let changed = false;
  for (const [version, run] of migrations) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version)) continue;
    db.exec('BEGIN IMMEDIATE');
    try { run(); db.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version); db.exec('COMMIT'); changed = true; }
    catch (err) { db.exec('ROLLBACK'); throw err; }
  }
  return changed;
}

module.exports = { migrate };
