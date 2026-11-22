#!/usr/bin/env node
'use strict';

// SQLite is the sole inventory authority. Public files are generated artifacts.
const fs = require('node:fs');
const { PATHS } = require('../backend/config');
const { openDatabase, withTransaction, syncPropertyFts, recordAuditLog } = require('../backend/db/connection');
const { seedDatabaseIfEmpty } = require('../backend/db/seed');
const { upsertPropertyMaster } = require('../backend/server');
const { compileAndPublishStaticFeeds } = require('../backend/domain/publisher');
const actor = { userId: null, label: 'local_inventory_cli', role: 'principal' };
const priceUnits = new Set(['Cr', 'Crore', 'Lakh', 'Lac', 'INR', 'per sq yd', 'per sq ft', 'Lakh / month', '/ month']);

function property(db, id) {
  const row = db.prepare('SELECT * FROM properties WHERE property_id = ?').get(id);
  if (!row) throw new Error(`Property not found: ${id}`);
  return row;
}

function mutate(db, payload, id = null, options = {}) {
  return withTransaction(db, () => {
    const before = id ? property(db, id) : null;
    const result = upsertPropertyMaster(db, payload, actor, id);
    const after = property(db, result.property_id);
    db.prepare('INSERT INTO inventory_undo(property_id,before_json,after_json) VALUES(?,?,?)')
      .run(after.property_id, before ? JSON.stringify(before) : null, JSON.stringify(after));
    compileAndPublishStaticFeeds(db, { ...options, actorLabel: actor.label });
    return after;
  });
}

function rollback(db, options = {}) {
  return withTransaction(db, () => {
    const undo = db.prepare('SELECT * FROM inventory_undo WHERE undone = 0 ORDER BY change_id DESC LIMIT 1').get();
    if (!undo) throw new Error('No inventory CLI changes to undo');
    const current = property(db, undo.property_id);
    if (JSON.stringify(current) !== undo.after_json) throw new Error('This property changed after the CLI operation. Review it in the CRM before restoring an older version.');
    if (undo.before_json) {
      const before = JSON.parse(undo.before_json);
      const keys = Object.keys(before).filter((k) => k !== 'property_id');
      db.prepare(`UPDATE properties SET ${keys.map((k) => `"${k}" = ?`).join(', ')} WHERE property_id = ?`)
        .run(...keys.map((k) => before[k]), undo.property_id);
    } else {
      // Preserve IDs and any references instead of deleting the added mandate.
      db.prepare("UPDATE properties SET publication_state = 'archived', is_featured_approved = 0 WHERE property_id = ?").run(undo.property_id);
    }
    syncPropertyFts(db, undo.property_id);
    db.prepare('UPDATE inventory_undo SET undone = 1 WHERE change_id = ?').run(undo.change_id);
    recordAuditLog(db, { actorLabel: actor.label, entityType: 'property', entityId: undo.property_id, action: 'rollback_inventory', before: current, after: undo.before_json ? JSON.parse(undo.before_json) : { publication_state: 'archived' } });
    compileAndPublishStaticFeeds(db, { ...options, actorLabel: actor.label });
    console.log(`Restored master inventory and regenerated all public feeds: ${undo.property_id}`);
  });
}

async function interactive() {
  const readline = require('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = {};
    for (const [field, label] of [
      ['listing_title', 'Listing title'], ['project_name', 'Project'], ['locality', 'Locality'],
      ['sector', 'Sector'], ['property_type', 'Property type'], ['transaction_type', 'Sale or Rent'],
      ['configuration', 'Configuration'], ['area_value', 'Area value (optional)'], ['area_unit', 'Area unit'],
      ['price_value', 'Price value (optional)'], ['price_unit', 'Price unit (Cr / Lakh / INR)'],
      ['key_features', 'Confirmed public features (optional)']
    ]) {
      const answer = (await rl.question(`${label}: `)).trim();
      if (answer) raw[field] = ['area_value', 'price_value'].includes(field) ? Number(answer) : answer;
    }
    if (!raw.listing_title) throw new Error('A listing title is required');
    console.log(JSON.stringify(raw, null, 2));
    if (!/^y(es)?$/i.test((await rl.question('Approve this record and regenerate the local release? (y/N): ')).trim())) return;
    const db = openDatabase();
    try { seedDatabaseIfEmpty(db); console.log(mutate(db, { ...raw, publication_state: 'approved_public' }).property_id); }
    finally { db.close(); }
  } finally { rl.close(); }
}

async function main() {
  const [cmd = 'status', id, value, unit] = process.argv.slice(2);
  if (['interactive', 'wizard', 'new'].includes(cmd)) return interactive();
  const db = openDatabase();
  try {
    seedDatabaseIfEmpty(db);
    if (['status', 'list'].includes(cmd)) {
      console.table(db.prepare('SELECT publication_state, availability_state, COUNT(*) AS count FROM properties GROUP BY publication_state, availability_state').all());
    } else if (cmd === 'rollback') rollback(db);
    else if (cmd === 'update-price') {
      const price = Number(value);
      const record = property(db, id);
      const priceUnit = unit || record.price_unit || 'Cr';
      if (!Number.isFinite(price) || price <= 0 || !priceUnits.has(priceUnit)) throw new Error('Provide a positive price and supported unit');
      mutate(db, { price_value: price, price_unit: priceUnit, price_text: `₹${price} ${priceUnit}` }, id);
      console.log(`Updated ${id} in the master and all public feeds`);
    } else if (cmd === 'update-status') {
      const states = { Available: 'available', Sold: 'sold', 'Under Offer': 'under_offer', Leased: 'leased', Withdrawn: 'withdrawn', Draft: 'available' };
      if (!Object.hasOwn(states, value)) throw new Error('Use Available, Sold, Under Offer, Leased, Withdrawn or Draft');
      const current = property(db, id);
      mutate(db, { publication_state: value === 'Draft' ? 'draft' : current.publication_state, availability_state: states[value] }, id);
      console.log(`Updated ${id} in the master and all public feeds`);
    } else if (cmd === 'add') {
      const raw = JSON.parse(fs.readFileSync(id, 'utf8'));
      if (!raw || Array.isArray(raw) || typeof raw !== 'object') throw new Error('Input must be one property object');
      if (raw.publication_approved === false || (raw.visibility && String(raw.visibility).toLowerCase() !== 'public')) throw new Error('Private or unapproved input cannot be published by this command');
      const record = raw.public_listing_data || raw.public || raw;
      if (record.status && record.status !== 'Available') throw new Error('New public records must be Available');
      console.log(mutate(db, { ...record, property_id: raw.property_id || record.property_id, publication_state: 'approved_public' }).property_id);
    } else throw new Error('Commands: status, add <json>, interactive, update-price <id> <value> [unit], update-status <id> <status>, rollback');
  } finally { db.close(); }
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exitCode = 1; });
module.exports = { mutate, rollback };
