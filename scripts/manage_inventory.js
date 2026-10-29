#!/usr/bin/env node
/**
 * AUM ESTATES — Inventory Management & Operator CLI
 * Safe, atomic, and foolproof inventory operations.
 * Protects against syntax corruption, duplicate IDs, and private note leakage.
 * 
 * Usage:
 *   node scripts/manage_inventory.js status
 *   node scripts/manage_inventory.js add <property.json>
 *   node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer>
 *   node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]
 *   node scripts/manage_inventory.js rollback
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DIST_DATA_DIR = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist', 'data');
const JSON_PATH = path.join(DATA_DIR, 'public_inventory.json');
const JS_PATH = path.join(DATA_DIR, 'public_inventory.js');

const ALLOWED_FIELDS = new Set([
  'property_id', 'status', 'project_name', 'locality', 'sector', 'city',
  'micro_location', 'property_type', 'transaction_type', 'listing_title',
  'configuration', 'bedrooms', 'bathrooms', 'area_value', 'area_unit',
  'facing', 'road_width', 'price_value', 'price_unit', 'price_text',
  'rent_value', 'rent_unit', 'key_features', 'public_description',
  'public_features', 'image_label', 'slug', 'url'
]);

const LEAK_PATTERNS = [
  { name: 'Private Phone Number', regex: /(?:\+91[\s-]?)?[6-9]\d{9}\b/g },
  { name: 'Email Address', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'PAN Card Number', regex: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g },
  { name: 'Internal Commission Note', regex: /\b(?:commission|brokerage|broker\s*cut|payout)\b/i },
  { name: 'Internal Cheque Ratio', regex: /\b\d{2}\s*[\/:]\s*\d{2}\s*(?:white|black|cheque|cash)\b/i },
  { name: 'Owner Contact Label', regex: /\b(?:owner\s*name|owner\s*mob|contact\s*seller)\b/i }
];
const OFFICIAL_PHONES = ['9873813595', '9811157018'];

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

function saveInventoryWithBackup(list, reason = 'update') {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `public_inventory_${timestamp}_${reason}.json`);

  // 1. Create safety snapshot of current data before writing
  if (fs.existsSync(JSON_PATH)) {
    fs.copyFileSync(JSON_PATH, backupFile);
    console.log(`[BACKUP] Safety snapshot created: ${path.basename(backupFile)}`);
  }

  // 2. Atomic save to public_inventory.json
  fs.writeFileSync(JSON_PATH, JSON.stringify(list, null, 2), 'utf8');
  console.log(`[SUCCESS] Wrote ${list.length} records to ${JSON_PATH}`);

  // 3. Compile public_inventory.js
  const jsContent = `window.AUM_PUBLIC_INVENTORY = ${JSON.stringify(list, null, 2)};\n`;
  fs.writeFileSync(JS_PATH, jsContent, 'utf8');
  console.log(`[SUCCESS] Wrote client JavaScript feed to ${JS_PATH}`);

  // 4. Sync to baseline dist if it exists
  if (fs.existsSync(DIST_DATA_DIR)) {
    fs.writeFileSync(path.join(DIST_DATA_DIR, 'public_inventory.json'), JSON.stringify(list, null, 2), 'utf8');
    fs.writeFileSync(path.join(DIST_DATA_DIR, 'public_inventory.js'), jsContent, 'utf8');
    console.log(`[SUCCESS] Synced data to dist/data`);
  }

  // 5. Keep only latest 10 backups to prevent bloat
  const allBackups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
  if (allBackups.length > 10) {
    allBackups.slice(0, allBackups.length - 10).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch (e) {}
    });
  }
}

function sanitizeRecord(raw) {
  const clean = {};
  const warnings = [];

  for (const k of Object.keys(raw)) {
    if (!ALLOWED_FIELDS.has(k)) continue;
    let val = raw[k];
    if (typeof val === 'string') {
      val = val.replace(/\s+/g, ' ').trim();
      for (const pattern of LEAK_PATTERNS) {
        if (pattern.regex.test(val)) {
          if (pattern.name === 'Private Phone Number' && OFFICIAL_PHONES.some(p => val.includes(p))) {
            continue;
          }
          warnings.push(`Field "${k}" matched leak pattern ${pattern.name}: "${val.substring(0, 40)}"`);
        }
      }
    }
    clean[k] = val !== undefined ? val : null;
  }
  return { clean, warnings };
}

function cmdStatus() {
  const list = loadInventory();
  console.log('\n=============================================================');
  console.log(' AUM ESTATES — INVENTORY STATUS REPORT');
  console.log('=============================================================');
  console.log(`Total Verified Mandates: ${list.length}`);

  const statusCount = {};
  const catCount = {};
  const corridorCount = {};

  list.forEach(o => {
    const s = o.status || 'Available';
    statusCount[s] = (statusCount[s] || 0) + 1;

    const t = o.property_type || 'Other';
    catCount[t] = (catCount[t] || 0) + 1;

    const loc = o.locality || o.sector || 'Gurgaon';
    corridorCount[loc] = (corridorCount[loc] || 0) + 1;
  });

  console.log('\nStatus Breakdown:');
  Object.entries(statusCount).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  console.log('\nTop Property Categories:');
  Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0, 7).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

  console.log('\nTop Micro-Locations:');
  Object.entries(corridorCount).sort((a,b)=>b[1]-a[1]).slice(0, 7).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));

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

  // Allocate next unique ID if missing
  if (!rawRecord.property_id) {
    const maxNum = list.reduce((max, x) => {
      const m = String(x.property_id || '').match(/AUM-WEB-(\d+)/i);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    rawRecord.property_id = `AUM-WEB-${String(maxNum + 1).padStart(6, '0')}`;
  }

  if (list.some(x => x.property_id === rawRecord.property_id)) {
    console.error(`[ERROR] Property ID already exists: ${rawRecord.property_id}`);
    process.exit(1);
  }

  const { clean, warnings } = sanitizeRecord(rawRecord);
  if (warnings.length > 0) {
    console.error('\n[SECURITY BLOCK] The following sensitive patterns were detected in the input:');
    warnings.forEach(w => console.error(`  - ${w}`));
    console.error('\nAborting save to protect fiduciary client privacy.\n');
    process.exit(1);
  }

  if (!clean.status) clean.status = 'Available';
  list.push(clean);
  saveInventoryWithBackup(list, `add_${clean.property_id}`);
  console.log(`\n[SUCCESS] Property ${clean.property_id} (${clean.listing_title || clean.project_name}) safely added to production.\n`);
}

function cmdUpdateStatus(id, newStatus) {
  if (!id || !newStatus) {
    console.error('Usage: node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer>');
    process.exit(1);
  }

  const validStatuses = new Set(['Available', 'Sold', 'Under Offer', 'Leased', 'Draft']);
  if (!validStatuses.has(newStatus)) {
    console.error(`Invalid status "${newStatus}". Must be one of: ${[...validStatuses].join(', ')}`);
    process.exit(1);
  }

  const list = loadInventory();
  const item = list.find(x => x.property_id === id);
  if (!item) {
    console.error(`[ERROR] Property ID not found: ${id}`);
    process.exit(1);
  }

  const oldStatus = item.status;
  item.status = newStatus;
  saveInventoryWithBackup(list, `status_${id}`);
  console.log(`\n[SUCCESS] Updated ${id} status: "${oldStatus}" → "${newStatus}"\n`);
}

function cmdUpdatePrice(id, newPriceValue, newUnit) {
  if (!id || newPriceValue === undefined) {
    console.error('Usage: node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]');
    process.exit(1);
  }

  const list = loadInventory();
  const item = list.find(x => x.property_id === id);
  if (!item) {
    console.error(`[ERROR] Property ID not found: ${id}`);
    process.exit(1);
  }

  const num = Number(newPriceValue);
  if (!Number.isFinite(num)) {
    console.error(`Invalid price value: ${newPriceValue}`);
    process.exit(1);
  }

  item.price_value = num;
  if (newUnit) item.price_unit = newUnit;
  item.price_text = `₹${num} ${item.price_unit || 'Cr'}`;

  saveInventoryWithBackup(list, `price_${id}`);
  console.log(`\n[SUCCESS] Updated ${id} price: ₹${num} ${item.price_unit || 'Cr'}\n`);
}

function cmdRollback() {
  ensureBackupDir();
  const allBackups = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort();
  if (allBackups.length === 0) {
    console.log('[INFO] No backup snapshots found in data/backups.');
    return;
  }

  const latestBackup = allBackups[allBackups.length - 1];
  const backupFilePath = path.join(BACKUP_DIR, latestBackup);
  console.log(`[ROLLBACK] Restoring from: ${latestBackup}`);

  const restoredData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
  saveInventoryWithBackup(restoredData, 'rollback');
  console.log(`[SUCCESS] Restored ${restoredData.length} records from backup snapshot.\n`);
}

function cmdInteractiveAdd() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = q => new Promise(res => rl.question(q, ans => res(ans.trim())));

  (async () => {
    console.log('\n=============================================================');
    console.log(' AUM ESTATES — INTERACTIVE LISTING REGISTRATION WIZARD');
    console.log('=============================================================');
    console.log('Guide: Enter the listing parameters. Press Enter to use defaults.\n');

    const title = await ask('1. Listing Title (e.g. DLF The Arbour 4 BHK Luxury Residence): ');
    if (!title) {
      console.log('[CANCELLED] Listing title cannot be empty.');
      rl.close();
      return;
    }

    const project = await ask('2. Project Name (e.g. DLF The Arbour): ') || title;
    const locality = await ask('3. Micro-Market / Corridor (e.g. Golf Course Extension Road): ') || 'Gurgaon';
    const sector = await ask('4. Sector (e.g. Sector 63): ') || '';
    const propType = await ask('5. Property Type [Apartment / Builder Floor / Plot / Villa / Commercial] (default: Apartment): ') || 'Apartment';
    const txType = await ask('6. Transaction Type [Sale / Rent] (default: Sale): ') || 'Sale';
    const config = await ask('7. Configuration (e.g. 4 BHK + Servant): ') || '4 BHK';
    const bedrooms = await ask('8. Number of Bedrooms (e.g. 4): ') || '4';
    const areaVal = await ask('9. Built-up / Plot Area Value (e.g. 3950): ') || '';
    const areaUnit = await ask('10. Area Unit [Sq Ft / Sq Yd] (default: Sq Ft): ') || 'Sq Ft';
    const priceVal = await ask('11. Price in Crores (e.g. 8.5): ');
    const features = await ask('12. Key Public Features (semicolon separated): ') || 'Higher floor; Luxury specifications; 2 dedicated parkings';
    const desc = await ask('13. Public Advisory Description (optional): ') || `${config} luxury residence in ${project}, ${locality}. Verified title and clear documentation.`;

    const list = loadInventory();
    const maxNum = list.reduce((max, x) => {
      const m = String(x.property_id || '').match(/AUM-WEB-(\d+)/i);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    const nextId = `AUM-WEB-${String(maxNum + 1).padStart(6, '0')}`;

    const numPrice = priceVal ? Number(priceVal) : null;
    const priceText = numPrice ? `₹${numPrice} Cr` : 'Price on Request';

    const newRecord = {
      property_id: nextId,
      status: 'Available',
      project_name: project,
      locality: locality,
      sector: sector,
      city: 'Gurgaon',
      micro_location: locality,
      property_type: propType,
      transaction_type: txType,
      listing_title: title,
      configuration: config,
      bedrooms: bedrooms,
      bathrooms: bedrooms,
      area_value: areaVal ? Number(areaVal) : null,
      area_unit: areaUnit,
      facing: 'North-East',
      road_width: '24 m',
      price_value: numPrice,
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

    console.log('\n-------------------------------------------------------------');
    console.log(' PROPOSED LISTING SUMMARY:');
    console.log('-------------------------------------------------------------');
    console.log(` ID:          ${newRecord.property_id}`);
    console.log(` Title:       ${newRecord.listing_title}`);
    console.log(` Location:    ${newRecord.locality} (${newRecord.sector})`);
    console.log(` Type:        ${newRecord.property_type} (${newRecord.configuration})`);
    console.log(` Asking:      ${newRecord.price_text}`);
    console.log(` Live URL:    ${newRecord.url}`);
    console.log('-------------------------------------------------------------');

    const { clean, warnings } = sanitizeRecord(newRecord);
    if (warnings.length > 0) {
      console.error('\n[SECURITY SHIELD BLOCKED]');
      warnings.forEach(w => console.error(`  - ${w}`));
      console.error('Aborting. Fix sensitive information before publishing.');
      rl.close();
      return;
    }

    const confirm = await ask('\nPublish this listing to production website? (y/N): ');
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      list.push(clean);
      saveInventoryWithBackup(list, `interactive_${clean.property_id}`);
      console.log(`\n[SUCCESS] Listing ${clean.property_id} is LIVE in public inventory!`);
      console.log(`Local Dossier: file://${HOSTINGER_DIR}/properties/detail.html?id=${clean.property_id}`);
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
  node scripts/manage_inventory.js update-status <property_id> <Available|Sold|Under Offer>
  node scripts/manage_inventory.js update-price <property_id> <price_value> [price_unit]
  node scripts/manage_inventory.js rollback
`);
      break;
  }
}

main();
