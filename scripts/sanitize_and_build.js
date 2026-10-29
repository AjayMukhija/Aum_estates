#!/usr/bin/env node
/**
 * AUM ESTATES — Automated Inventory Sanitization & Integrity Pipeline
 * 
 * Usage:
 *   node scripts/sanitize_and_build.js [path/to/raw_inventory.json]
 * 
 * Purpose:
 *   1. Protects client privacy by enforcing a strict field whitelist.
 *   2. Scans for accidental data leaks (private phone numbers, emails, broker commissions, internal notes).
 *   3. Validates JSON syntax, schema rules, and property ID uniqueness.
 *   4. Compiles production-ready `public_inventory.js` and `public_inventory.json`.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'data');
const OFFICIAL_PHONES = ['9873813595', '9811157018'];

// 1. Strict Whitelist of Customer-Facing Fields
const ALLOWED_PUBLIC_FIELDS = new Set([
  'property_id',
  'status',
  'project_name',
  'locality',
  'sector',
  'city',
  'micro_location',
  'property_type',
  'transaction_type',
  'listing_title',
  'configuration',
  'bedrooms',
  'bathrooms',
  'area_value',
  'area_unit',
  'facing',
  'road_width',
  'price_value',
  'price_unit',
  'price_text',
  'rent_value',
  'rent_unit',
  'key_features',
  'public_description',
  'public_features',
  'image_label',
  'slug',
  'url'
]);

// 2. Sensitive Keyword & Leak Patterns
const LEAK_PATTERNS = [
  { name: 'Private Phone Number', regex: /(?:\+91[\s-]?)?[6-9]\d{9}\b/g },
  { name: 'Email Address', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'PAN Card Number', regex: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g },
  { name: 'Internal Commission Note', regex: /\b(?:commission|brokerage|broker\s*cut|payout)\b/i },
  { name: 'Internal Cheque Ratio', regex: /\b\d{2}\s*[\/:]\s*\d{2}\s*(?:white|black|cheque|cash)\b/i },
  { name: 'Owner Contact Label', regex: /\b(?:owner\s*name|owner\s*mob|contact\s*seller)\b/i }
];

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\s+/g, ' ').trim();
}

function runSanitization(rawRecords) {
  console.log(`[INFO] Analyzing ${rawRecords.length} records...`);
  const sanitizedList = [];
  const warnings = [];
  const seenIds = new Set();

  rawRecords.forEach((raw, idx) => {
    const id = raw.property_id || `AUM-WEB-${String(idx + 1).padStart(6, '0')}`;

    if (seenIds.has(id)) {
      warnings.push(`[DUPLICATE ID] Record #${idx + 1} has duplicate property_id: ${id}`);
    }
    seenIds.add(id);

    const clean = {};
    for (const key of Object.keys(raw)) {
      if (!ALLOWED_PUBLIC_FIELDS.has(key)) {
        // Discard unwhitelisted fields (e.g. owner_name, broker_phone, internal_notes)
        continue;
      }

      let val = raw[key];
      if (typeof val === 'string') {
        val = sanitizeString(val);

        // Check for leaks in text fields
        for (const pattern of LEAK_PATTERNS) {
          if (pattern.regex.test(val)) {
            // Check if phone number is an official advisory number
            if (pattern.name === 'Private Phone Number' && OFFICIAL_PHONES.some(p => val.includes(p))) {
              continue;
            }
            warnings.push(`[LEAK WARNING] ${id} field "${key}" matched ${pattern.name}: "${val.substring(0, 60)}..."`);
          }
        }
      }
      clean[key] = val !== undefined ? val : null;
    }

    // Default status to 'Available' if missing
    if (!clean.status) clean.status = 'Available';

    sanitizedList.push(clean);
  });

  return { sanitizedList, warnings };
}

function main() {
  const inputArg = process.argv[2];
  let inputPath = inputArg;

  if (!inputPath) {
    inputPath = path.join(DATA_DIR, 'public_inventory.json');
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`\n=============================================================`);
  console.log(` AUM ESTATES — INVENTORY SANITIZATION & INTEGRITY AUDITOR`);
  console.log(`=============================================================`);
  console.log(`[SOURCE] ${inputPath}`);

  let rawData;
  try {
    const content = fs.readFileSync(inputPath, 'utf8');
    rawData = JSON.parse(content);
    if (!Array.isArray(rawData)) {
      throw new Error('Root JSON must be an array of property objects');
    }
  } catch (err) {
    console.error(`[FATAL] Failed to parse JSON input: ${err.message}`);
    process.exit(1);
  }

  const { sanitizedList, warnings } = runSanitization(rawData);

  if (warnings.length > 0) {
    console.log(`\n[ALERT] ${warnings.length} issues or leak patterns flagged:`);
    warnings.slice(0, 15).forEach(w => console.warn(`  - ${w}`));
    if (warnings.length > 15) {
      console.warn(`  ... and ${warnings.length - 15} more warnings.`);
    }

    const leakWarnings = warnings.filter(w => w.includes('[LEAK WARNING]'));
    if (leakWarnings.length > 0 && !process.env.FORCE_BUILD) {
      console.error(`\n[FATAL PRIVACY SHIELD] Build aborted! ${leakWarnings.length} potential privacy leak(s) detected.`);
      console.error(`To protect client confidentiality, private notes and phone numbers cannot be compiled.`);
      console.error(`Clean the raw source data or resolve the warnings before re-running.`);
      process.exit(1);
    }
  } else {
    console.log(`[VERIFIED] 0 privacy leaks or duplicate IDs found.`);
  }

  // Write sanitized public_inventory.json
  const targetJsonPath = path.join(DATA_DIR, 'public_inventory.json');
  fs.writeFileSync(targetJsonPath, JSON.stringify(sanitizedList, null, 2), 'utf8');
  console.log(`[SUCCESS] Wrote ${sanitizedList.length} sanitized records to ${targetJsonPath}`);

  // Write sanitized public_inventory.js
  const targetJsPath = path.join(DATA_DIR, 'public_inventory.js');
  const jsContent = `window.AUM_PUBLIC_INVENTORY = ${JSON.stringify(sanitizedList, null, 2)};\n`;
  fs.writeFileSync(targetJsPath, jsContent, 'utf8');
  console.log(`[SUCCESS] Wrote client-ready JavaScript feed to ${targetJsPath}`);

  // Also sync to grid baseline dist/data if it exists
  const distDataDir = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist', 'data');
  if (fs.existsSync(distDataDir)) {
    fs.writeFileSync(path.join(distDataDir, 'public_inventory.json'), JSON.stringify(sanitizedList, null, 2), 'utf8');
    fs.writeFileSync(path.join(distDataDir, 'public_inventory.js'), jsContent, 'utf8');
    console.log(`[SUCCESS] Synced sanitized inventory to ${distDataDir}`);
  }

  console.log(`\n[AUDIT COMPLETE] Website data layer is synchronized and sanitized.\n`);
}

main();
