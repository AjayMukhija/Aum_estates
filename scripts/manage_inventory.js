#!/usr/bin/env node
/**
 * AUM ESTATES — Inventory Management & Operator CLI
 * Safe, atomic, and strictly validated inventory operations across all synchronized
 * frontend targets (and Master SQLite Database when present).
 *
 * Usage:
 *   node scripts/manage_inventory.js status
 *   node scripts/manage_inventory.js interactive
 *   node scripts/manage_inventory.js add <property.json>
 *   node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer|Leased|Draft>
 *   node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]
 *   node scripts/manage_inventory.js rollback
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const HOSTINGER_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');
const DATA_DIR = path.join(HOSTINGER_DIR, 'data');
const CONCEPT_DATA_DIR = path.join(HOSTINGER_DIR, 'concepts', 'aum-grid-study', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DIST_DATA_DIR = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist', 'data');
const V16_DIST_DIR = path.join(ROOT_DIR, 'AUM_Estates_Brand_Study_v16_Local', 'dist');
const JSON_PATH = path.join(DATA_DIR, 'public_inventory.json');

const OFFICIAL_PHONES = ['9873813595', '9811157018'];
const PROPERTY_ID_REGEX = /^[A-Z0-9][A-Z0-9-]{2,47}$/;
const ALLOWED_PRICE_UNITS = new Set([
  'Cr', 'Crore', 'Lakh', 'Lac', 'INR', 'per sq yd', 'per sq ft', 'Lakh / month', '/ month'
]);

const NUMERIC_FIELDS = new Set([
  'area_value', 'area_sqft_norm', 'price_value', 'price_inr_norm', 'rent_value', 'rent_inr_monthly_norm'
]);

const ALLOWED_FIELDS = new Set([
  'property_id', 'status', 'project_id', 'project_name', 'locality', 'sector', 'city',
  'micro_location', 'corridor', 'property_type', 'category', 'transaction_type', 'listing_title',
  'configuration', 'bedrooms', 'bathrooms', 'area_value', 'area_unit', 'area_sqft_norm',
  'facing', 'road_width', 'price_value', 'price_unit', 'price_text', 'price_inr_norm',
  'rent_value', 'rent_unit', 'rent_inr_monthly_norm', 'key_features', 'public_description',
  'public_features', 'image_file', 'image_label', 'verification_status', 'last_verified',
  'things_to_confirm', 'slug', 'url'
]);

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function loadInventory() {
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`[ERROR] public_inventory.json not found at ${JSON_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
}

function findPrivatePhones(text) {
  if (typeof text !== 'string' || !text) return [];
  const found = [];
  const re = /(?:₹|rs\.?\s*|inr\s*)?(?:\+?91[\s.-]?|0)?([6-9]\d(?:[\s.-]?\d){8})\b/gi;
  for (const m of text.matchAll(re)) {
    if (/^(?:₹|rs|inr)/i.test(m[0].trim())) continue;
    const digits = m[1].replace(/\D/g, '');
    if (digits.length === 10 && !OFFICIAL_PHONES.includes(digits)) found.push(digits);
  }
  return found;
}

function sanitizeRecord(rawInput) {
  const clean = {};
  const warnings = [];

  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { clean, warnings: ['Record must be a plain JSON object'] };
  }

  const raw = (rawInput.public_listing_data && typeof rawInput.public_listing_data === 'object')
    ? { ...rawInput.public_listing_data, property_id: rawInput.property_id || rawInput.public_listing_data.property_id, status: rawInput.status || rawInput.public_listing_data.status }
    : rawInput;

  if (rawInput.publication_approved === false || (rawInput.visibility && String(rawInput.visibility).toLowerCase() !== 'public')) {
    warnings.push('Private or unapproved record cannot be added to public feed');
  }

  for (const k of Object.keys(raw)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    let val = raw[k];
    if (val == null) {
      clean[k] = null;
      continue;
    }

    if (NUMERIC_FIELDS.has(k)) {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        warnings.push(`Field "${k}" must be a non-negative finite number`);
      }
      clean[k] = val;
      continue;
    }

    if (k === 'things_to_confirm') {
      if (!Array.isArray(val) || val.some((x) => typeof x !== 'string')) {
        warnings.push('Field "things_to_confirm" must be an array of strings');
      }
      clean[k] = val;
      continue;
    }

    if (typeof val !== 'string') {
      warnings.push(`Field "${k}" must be a string (received ${typeof val})`);
      continue;
    }

    val = val.replace(/\s+/g, ' ').trim();
    for (const ph of findPrivatePhones(val)) {
      warnings.push(`Field "${k}" matched Private Phone Number: "${ph}"`);
    }
    for (const m of val.matchAll(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
      if (m[1].toLowerCase() !== 'aumestates.com') {
        warnings.push(`Field "${k}" matched Email Address: "${m[0]}"`);
      }
    }
    if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(val)) {
      warnings.push(`Field "${k}" matched PAN Card Number`);
    }
    if (/\b(?:commission|brokerage|broker\s*cut|payout|passback)\b/i.test(val)) {
      warnings.push(`Field "${k}" matched Internal Commission Note`);
    }
    if (
      /\b(?:cheque|cash\s*(?:part|deal|component|payment|ratio)|black\s*(?:part|money|component)|white\s*(?:deal|entry|component|part|payment|ratio))\b/i.test(val) ||
      /\b\d{1,3}\s*[/:]\s*\d{1,3}\s*(?:white|black|cheque|cash)\b/i.test(val)
    ) {
      warnings.push(`Field "${k}" matched Private Payment / Cheque Structure`);
    }
    if (/\b(?:owner\s*(?:name|mob|mobile|phone|contact|number)|contact\s*seller|direct\s*party|keys?\s*in\s*hand|confirm\s*unit\s*number)\b/i.test(val)) {
      warnings.push(`Field "${k}" matched Internal Owner / Keys Note`);
    }

    clean[k] = val;
  }

  if (!clean.property_id || !PROPERTY_ID_REGEX.test(String(clean.property_id))) {
    warnings.push(`Invalid or missing property_id: "${clean.property_id || ''}"`);
  }
  if (typeof clean.listing_title !== 'string' || !clean.listing_title.trim()) {
    warnings.push('Field "listing_title" is required and must be a non-empty string');
  }

  return { clean, warnings };
}

function writeAllTargetsAtomically(publicList) {
  // Only Available records belong in the live public feeds
  const availableOnly = publicList.filter((x) => String(x.status || 'Available').toLowerCase() === 'available');
  const jsonContent = `${JSON.stringify(availableOnly, null, 2)}\n`;
  const jsContent = `window.AUM_PUBLIC_INVENTORY = ${JSON.stringify(availableOnly, null, 2)};\n`;

  const targets = [
    [JSON_PATH, jsonContent],
    [path.join(DATA_DIR, 'public_inventory.js'), jsContent]
  ];

  if (fs.existsSync(path.dirname(CONCEPT_DATA_DIR))) {
    fs.mkdirSync(CONCEPT_DATA_DIR, { recursive: true });
    targets.push(
      [path.join(CONCEPT_DATA_DIR, 'public_inventory.json'), jsonContent],
      [path.join(CONCEPT_DATA_DIR, 'public_inventory.js'), jsContent]
    );
  }
  if (fs.existsSync(DIST_DATA_DIR)) {
    targets.push(
      [path.join(DIST_DATA_DIR, 'public_inventory.json'), jsonContent],
      [path.join(DIST_DATA_DIR, 'public_inventory.js'), jsContent]
    );
  }
  if (fs.existsSync(V16_DIST_DIR)) {
    targets.push([path.join(V16_DIST_DIR, 'public_inventory.js'), jsContent]);
  }

  const staged = [];
  try {
    for (const [finalPath, content] of targets) {
      fs.mkdirSync(path.dirname(finalPath), { recursive: true });
      const tmpPath = path.join(
        path.dirname(finalPath),
        `.${path.basename(finalPath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
      );
      fs.writeFileSync(tmpPath, content, 'utf8');
      staged.push([tmpPath, finalPath]);
    }
    for (const [tmpPath, finalPath] of staged) {
      fs.renameSync(tmpPath, finalPath);
    }
  } catch (err) {
    for (const [tmpPath] of staged) {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    }
    throw err;
  }
}

function saveInventoryWithBackup(list, reason = 'update', createBackup = true) {
  ensureBackupDir();
  let backupFile = null;
  if (createBackup && fs.existsSync(JSON_PATH)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupFile = path.join(BACKUP_DIR, `public_inventory_${timestamp}_${reason}.json`);
    fs.copyFileSync(JSON_PATH, backupFile);
  }

  try {
    writeAllTargetsAtomically(list);
  } catch (err) {
    if (backupFile && fs.existsSync(backupFile)) {
      try { fs.unlinkSync(backupFile); } catch {}
    }
    throw err;
  }

  if (backupFile) {
    console.log(`[BACKUP] Safety snapshot created: ${path.basename(backupFile)}`);
  }
  console.log(`[SUCCESS] Atomically wrote ${list.length} records across all synchronized targets`);

  const allBackups = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
  if (allBackups.length > 15) {
    allBackups.slice(0, allBackups.length - 15).forEach((f) => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
    });
  }
}

function syncMasterDatabaseIfPresent(mutatorFn) {
  const dbPath = path.join(ROOT_DIR, 'private_master_store', 'db', 'aum_master_crm.sqlite');
  const connPath = path.join(ROOT_DIR, 'backend', 'db', 'connection.js');
  if (fs.existsSync(dbPath) && fs.existsSync(connPath)) {
    try {
      const { openDatabase, syncPropertyFts } = require(connPath);
      const db = openDatabase(dbPath);
      mutatorFn(db, syncPropertyFts);
      db.close();
    } catch (err) {
      console.warn(`[WARN] Master SQLite DB sync warning: ${err.message}`);
    }
  }
}

function cmdStatus() {
  const list = loadInventory();
  console.log('\n=============================================================');
  console.log(' AUM ESTATES — INVENTORY STATUS REPORT');
  console.log('=============================================================');
  console.log(`Total Verified Public Mandates: ${list.length}`);

  const statusCount = {};
  const catCount = {};
  const corridorCount = {};

  list.forEach((o) => {
    const s = o.status || 'Available';
    statusCount[s] = (statusCount[s] || 0) + 1;
    const t = o.property_type || 'Other';
    catCount[t] = (catCount[t] || 0) + 1;
    const loc = o.corridor || o.locality || o.sector || 'Gurgaon';
    corridorCount[loc] = (corridorCount[loc] || 0) + 1;
  });

  console.log('\nStatus Breakdown:');
  Object.entries(statusCount).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  console.log('\nTop Property Categories:');
  Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 7).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  console.log('\nTop Corridors / Micro-Locations:');
  Object.entries(corridorCount).sort((a, b) => b[1] - a[1]).slice(0, 7).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  const lastItem = list[list.length - 1];
  console.log(`\nLatest Listing ID: ${lastItem ? lastItem.property_id : 'None'}`);
  console.log('=============================================================\n');
}

function cmdAdd(inputPath) {
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error(`[ERROR] File not found: ${inputPath}`);
    console.log('Usage: node scripts/manage_inventory.js add <path_to_property.json>');
    process.exit(1);
  }

  const list = loadInventory();
  let rawRecord;
  try {
    rawRecord = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(`[ERROR] Failed to parse JSON: ${err.message}`);
    process.exit(1);
  }

  if (!rawRecord || typeof rawRecord !== 'object' || Array.isArray(rawRecord)) {
    console.error('[ERROR] Input JSON must be a single property object');
    process.exit(1);
  }

  if (!rawRecord.property_id) {
    const maxNum = list.reduce((max, x) => {
      const m = String(x.property_id || '').match(/AUM-WEB-(\d+)/i);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    rawRecord.property_id = `AUM-WEB-${String(maxNum + 1).padStart(6, '0')}`;
  }

  if (list.some((x) => x.property_id === rawRecord.property_id)) {
    console.error(`[ERROR] Property ID already exists: ${rawRecord.property_id}`);
    process.exit(1);
  }

  const { clean, warnings } = sanitizeRecord(rawRecord);
  if (warnings.length > 0) {
    console.error('\n[SECURITY & SCHEMA BLOCK] Input rejected:');
    warnings.forEach((w) => console.error(`  - ${w}`));
    process.exit(1);
  }

  if (clean.status && String(clean.status).toLowerCase() !== 'available') {
    console.error(`[ERROR] Only Available records may be published directly to public feeds (got "${clean.status}")`);
    process.exit(1);
  }
  clean.status = 'Available';

  list.push(clean);
  saveInventoryWithBackup(list, `add_${clean.property_id}`);

  syncMasterDatabaseIfPresent((db) => {
    const serverPath = path.join(ROOT_DIR, 'backend', 'server.js');
    if (fs.existsSync(serverPath)) {
      const { upsertPropertyMaster } = require(serverPath);
      upsertPropertyMaster(db, { ...clean, publication_state: 'approved_public', availability_state: 'available' }, { label: 'cli_manage_add' });
    }
  });

  console.log(`\n[SUCCESS] Property ${clean.property_id} (${clean.listing_title}) safely added to production.\n`);
}

function cmdUpdateStatus(id, newStatus) {
  if (!id || !newStatus) {
    console.error('Usage: node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer|Leased|Draft>');
    process.exit(1);
  }

  const validStatuses = new Set(['Available', 'Sold', 'Under Offer', 'Leased', 'Draft']);
  if (!validStatuses.has(newStatus)) {
    console.error(`Invalid status "${newStatus}". Must be one of: ${[...validStatuses].join(', ')}`);
    process.exit(1);
  }

  const list = loadInventory();
  const item = list.find((x) => x.property_id === id);
  if (!item) {
    console.error(`[ERROR] Property ID not found: ${id}`);
    process.exit(1);
  }

  const oldStatus = item.status;
  item.status = newStatus;
  saveInventoryWithBackup(list, `status_${id}`);

  syncMasterDatabaseIfPresent((db, syncPropertyFts) => {
    const mapAvail = { Available: 'available', Sold: 'sold', 'Under Offer': 'under_offer', Leased: 'leased', Draft: 'available' };
    const pubState = newStatus === 'Draft' ? 'draft' : 'approved_public';
    db.prepare(`
      UPDATE properties
      SET publication_state = ?, availability_state = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE property_id = ?
    `).run(pubState, mapAvail[newStatus] || 'available', id);
    syncPropertyFts(db, id);
  });

  console.log(`\n[SUCCESS] Updated ${id} status: "${oldStatus}" → "${newStatus}"\n`);
}

function cmdUpdatePrice(id, newPriceValue, newUnit) {
  if (!id || newPriceValue === undefined) {
    console.error('Usage: node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]');
    process.exit(1);
  }

  const num = Number(newPriceValue);
  if (!Number.isFinite(num) || num <= 0) {
    console.error(`[ERROR] Price value must be a positive finite number (received "${newPriceValue}")`);
    process.exit(1);
  }

  const list = loadInventory();
  const item = list.find((x) => x.property_id === id);
  if (!item) {
    console.error(`[ERROR] Property ID not found: ${id}`);
    process.exit(1);
  }

  const unitToUse = newUnit !== undefined ? String(newUnit).trim() : (item.price_unit || 'Cr');
  if (!ALLOWED_PRICE_UNITS.has(unitToUse)) {
    console.error(`[SECURITY BLOCK] Invalid or disallowed price_unit "${unitToUse}". Allowed units: ${[...ALLOWED_PRICE_UNITS].join(', ')}`);
    process.exit(1);
  }

  item.price_value = num;
  item.price_unit = unitToUse;
  item.price_text = `₹${num} ${unitToUse}`;

  const { warnings } = sanitizeRecord(item);
  if (warnings.length > 0) {
    console.error(`[SECURITY BLOCK] Price update failed validation:\n  - ${warnings.join('\n  - ')}`);
    process.exit(1);
  }

  saveInventoryWithBackup(list, `price_${id}`);

  syncMasterDatabaseIfPresent((db, syncPropertyFts) => {
    const normPath = path.join(ROOT_DIR, 'backend', 'domain', 'normalizer.js');
    let priceInrNorm = null;
    if (fs.existsSync(normPath)) {
      const { normalizePriceInr } = require(normPath);
      priceInrNorm = normalizePriceInr({ priceValue: num, priceUnit: unitToUse, priceText: item.price_text });
    }
    db.prepare(`
      UPDATE properties
      SET price_value = ?, price_unit = ?, price_text = ?, price_inr_norm = COALESCE(?, price_inr_norm),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE property_id = ?
    `).run(num, unitToUse, item.price_text, priceInrNorm, id);
    syncPropertyFts(db, id);
  });

  console.log(`\n[SUCCESS] Updated ${id} price: ₹${num} ${unitToUse}\n`);
}

function cmdRollback() {
  ensureBackupDir();
  const allBackups = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json')).sort();
  if (allBackups.length === 0) {
    console.log('[INFO] No backup snapshots found in data/backups.');
    return;
  }

  const latestBackup = allBackups[allBackups.length - 1];
  const backupFilePath = path.join(BACKUP_DIR, latestBackup);
  console.log(`[ROLLBACK] Restoring from: ${latestBackup}`);

  const restoredData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  // Pop from the active undo stack instead of pushing the undone state back on top!
  saveInventoryWithBackup(restoredData, 'rollback', false);
  try {
    fs.renameSync(backupFilePath, `${backupFilePath}.restored`);
  } catch {
    try { fs.unlinkSync(backupFilePath); } catch {}
  }
  console.log(`[SUCCESS] Restored ${restoredData.length} records from backup snapshot.\n`);
}

function cmdInteractiveAdd() {
  const readline = require('node:readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (ans) => res(ans.trim())));

  (async () => {
    console.log('\n=============================================================');
    console.log(' AUM ESTATES — INTERACTIVE LISTING REGISTRATION WIZARD');
    console.log('=============================================================');

    const title = await ask('1. Listing Title (e.g. DLF The Arbour 4 BHK Luxury Residence): ');
    if (!title) {
      console.log('[CANCELLED] Listing title cannot be empty.');
      rl.close();
      return;
    }

    const project = (await ask('2. Project Name (e.g. DLF The Arbour): ')) || title;
    const locality = (await ask('3. Micro-Market / Corridor (e.g. Golf Course Extension Road): ')) || 'Gurgaon';
    const sector = (await ask('4. Sector (e.g. Sector 63): ')) || '';
    const propType = (await ask('5. Property Type [Apartment / Builder Floor / Plot / Villa / Commercial]: ')) || 'Apartment';
    const txType = (await ask('6. Transaction Type [Sale / Rent]: ')) || 'Sale';
    const config = (await ask('7. Configuration (e.g. 4 BHK + Servant): ')) || '4 BHK';
    const bedrooms = (await ask('8. Number of Bedrooms (e.g. 4): ')) || '4';
    const areaVal = (await ask('9. Built-up / Plot Area Value (e.g. 3950): ')) || '';
    const areaUnit = (await ask('10. Area Unit [Sq Ft / Sq Yd]: ')) || 'Sq Ft';
    const priceVal = await ask('11. Price in Crores (e.g. 8.5): ');
    const features = (await ask('12. Key Public Features (semicolon separated): ')) || 'Higher floor; Luxury specifications; 2 dedicated parkings';
    const desc = (await ask('13. Public Advisory Description (optional): ')) || `${config} luxury residence in ${project}, ${locality}.`;

    const list = loadInventory();
    const maxNum = list.reduce((max, x) => {
      const m = String(x.property_id || '').match(/AUM-WEB-(\d+)/i);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const nextId = `AUM-WEB-${String(maxNum + 1).padStart(6, '0')}`;
    const numPrice = priceVal ? Number(priceVal) : null;
    const priceText = numPrice && numPrice > 0 ? `₹${numPrice} Cr` : 'Price on Request';

    const newRecord = {
      property_id: nextId,
      status: 'Available',
      project_name: project,
      locality,
      sector,
      city: 'Gurgaon',
      micro_location: locality,
      property_type: propType,
      transaction_type: txType,
      listing_title: title,
      configuration: config,
      bedrooms,
      bathrooms: bedrooms,
      area_value: areaVal ? Number(areaVal) : null,
      area_unit: areaUnit,
      facing: 'North-East',
      road_width: '24 m',
      price_value: numPrice && numPrice > 0 ? numPrice : null,
      price_unit: 'Cr',
      price_text: priceText,
      rent_value: null,
      rent_unit: null,
      key_features: features,
      public_description: desc,
      public_features: features,
      image_label: 'Representative Image',
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      url: `https://aumestates.com/properties/detail.html?id=${nextId}`
    };

    const { clean, warnings } = sanitizeRecord(newRecord);
    if (warnings.length > 0) {
      console.error('\n[SECURITY SHIELD BLOCKED]');
      warnings.forEach((w) => console.error(`  - ${w}`));
      rl.close();
      return;
    }

    const confirm = await ask('\nPublish this listing to production website? (y/N): ');
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      list.push(clean);
      saveInventoryWithBackup(list, `interactive_${clean.property_id}`);
      console.log(`\n[SUCCESS] Listing ${clean.property_id} is LIVE in public inventory!`);
    } else {
      console.log('\n[ABORTED] No changes written to inventory.');
    }
    rl.close();
  })();
}

function main() {
  const [cmd, arg1, arg2, arg3] = process.argv.slice(2);
  switch (cmd) {
    case 'status':
    case 'list':
      cmdStatus();
      break;
    case 'add':
      cmdAdd(arg1);
      break;
    case 'interactive':
    case 'wizard':
    case 'new':
      cmdInteractiveAdd();
      break;
    case 'update-status':
      cmdUpdateStatus(arg1, arg2);
      break;
    case 'update-price':
      cmdUpdatePrice(arg1, arg2, arg3);
      break;
    case 'rollback':
      cmdRollback();
      break;
    default:
      console.log(`
AUM ESTATES — Inventory Management CLI
Commands:
  node scripts/manage_inventory.js status
  node scripts/manage_inventory.js interactive
  node scripts/manage_inventory.js add <property.json>
  node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer|Leased|Draft>
  node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]
  node scripts/manage_inventory.js rollback
`);
      break;
  }
}

main();
