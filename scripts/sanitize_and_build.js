#!/usr/bin/env node
/**
 * AUM ESTATES — Automated Inventory Sanitization & Atomic Feed Compiler
 *
 * Usage:
 *   node scripts/sanitize_and_build.js [path/to/raw_inventory.json]
 *
 * When invoked with no positional input inside the full AUM workspace, compiles
 * directly from the Master SQLite Database via backend/domain/publisher.js.
 * When invoked with an explicit JSON array file, runs the standalone Fiduciary
 * Privacy Gate and writes atomically across all synchronized frontend targets.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'data');
const CONCEPT_DATA_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger', 'concepts', 'aum-grid-study', 'data');
const GRID_DIST_DATA_DIR = path.join(ROOT_DIR, 'aum-grid-local-baseline-2026-10-27', 'dist', 'data');
const V16_DIST_DIR = path.join(ROOT_DIR, 'AUM_Estates_Brand_Study_v16_Local', 'dist');

const OFFICIAL_PHONES = ['9873813595', '9811157018'];
const PROPERTY_ID_REGEX = /^[A-Z0-9][A-Z0-9-]{2,47}$/;

const NUMERIC_FIELDS = new Set([
  'area_value',
  'area_sqft_norm',
  'price_value',
  'price_inr_norm',
  'rent_value',
  'rent_inr_monthly_norm'
]);

const ALLOWED_PUBLIC_FIELDS = new Set([
  'property_id',
  'status',
  'project_id',
  'project_name',
  'locality',
  'sector',
  'city',
  'micro_location',
  'corridor',
  'property_type',
  'category',
  'transaction_type',
  'listing_title',
  'configuration',
  'bedrooms',
  'bathrooms',
  'area_value',
  'area_unit',
  'area_sqft_norm',
  'facing',
  'road_width',
  'price_value',
  'price_unit',
  'price_text',
  'price_inr_norm',
  'rent_value',
  'rent_unit',
  'rent_inr_monthly_norm',
  'key_features',
  'public_description',
  'public_features',
  'image_file',
  'image_label',
  'verification_status',
  'last_verified',
  'things_to_confirm',
  'slug',
  'url'
]);

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\s+/g, ' ').trim();
}

function findPrivatePhones(text) {
  if (typeof text !== 'string' || !text) return [];
  const found = [];
  const re = /(?:₹|rs\.?\s*|inr\s*)?(?:\+?91[\s.-]?|0)?([6-9]\d(?:[\s.-]?\d){8})\b/gi;
  for (const m of text.matchAll(re)) {
    if (/^(?:₹|rs|inr)/i.test(m[0].trim())) continue;
    const digits = m[1].replace(/\D/g, '');
    if (digits.length === 10 && !OFFICIAL_PHONES.includes(digits)) {
      found.push(digits);
    }
  }
  return found;
}

function scanValueForLeaks(id, key, val) {
  const issues = [];
  if (val == null) return issues;

  if (NUMERIC_FIELDS.has(key)) {
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      issues.push(`[SCHEMA ERROR] ${id} field "${key}" must be a non-negative finite number`);
      return issues;
    }
    if (key === 'area_value' || key === 'area_sqft_norm') {
      const digits = String(Math.trunc(Math.abs(val)));
      if (/^[6-9]\d{9}$/.test(digits) && !OFFICIAL_PHONES.includes(digits)) {
        issues.push(`[LEAK WARNING] ${id} field "${key}" contains suspicious 10-digit phone number: ${digits}`);
      }
    }
    return issues;
  }

  if (key === 'things_to_confirm') {
    if (!Array.isArray(val) || val.some((x) => typeof x !== 'string')) {
      issues.push(`[SCHEMA ERROR] ${id} field "things_to_confirm" must be an array of strings`);
      return issues;
    }
    val.forEach((entry, i) => {
      issues.push(...scanValueForLeaks(id, `things_to_confirm[${i}]`, entry));
    });
    return issues;
  }

  if (typeof val !== 'string') {
    issues.push(`[LEAK WARNING] ${id} field "${key}" contains disallowed ${typeof val} value (strings only)`);
    return issues;
  }

  const phones = findPrivatePhones(val);
  for (const ph of phones) {
    issues.push(`[LEAK WARNING] ${id} field "${key}" matched Private Phone Number: "${ph}"`);
  }

  for (const m of val.matchAll(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
    if (m[1].toLowerCase() !== 'aumestates.com') {
      issues.push(`[LEAK WARNING] ${id} field "${key}" matched Email Address: "${m[0]}"`);
    }
  }

  if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(val)) {
    issues.push(`[LEAK WARNING] ${id} field "${key}" matched PAN Card Number`);
  }
  if (/\b(?:commission|brokerage|broker\s*cut|payout|passback|sub[\s-]*broker)\b/i.test(val)) {
    issues.push(`[LEAK WARNING] ${id} field "${key}" matched Internal Commission Note`);
  }
  if (
    /\b(?:cheque|cash\s*(?:part|deal|component|payment|ratio)|black\s*(?:part|money|component)|white\s*(?:deal|entry|component|part|payment|ratio))\b/i.test(val) ||
    /\b\d{1,3}\s*[/:]\s*\d{1,3}\s*(?:white|black|cheque|cash)\b/i.test(val)
  ) {
    issues.push(`[LEAK WARNING] ${id} field "${key}" matched Private Payment / Cheque Structure`);
  }
  if (/\b(?:owner\s*(?:name|mob|mobile|phone|contact|number)|contact\s*seller|direct\s*party|keys?\s*in\s*hand|confirm\s*unit\s*number)\b/i.test(val)) {
    issues.push(`[LEAK WARNING] ${id} field "${key}" matched Internal Owner / Keys Note`);
  }

  return issues;
}

function unwrapCandidateRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.public_listing_data && typeof raw.public_listing_data === 'object' && !Array.isArray(raw.public_listing_data)) {
    return {
      ...raw.public_listing_data,
      property_id: raw.property_id || raw.public_listing_data.property_id,
      status: raw.status || raw.public_listing_data.status,
      visibility: raw.visibility ?? raw.public_listing_data.visibility,
      publication_state: raw.publication_state ?? raw.public_listing_data.publication_state,
      publication_approved: raw.publication_approved ?? raw.public_listing_data.publication_approved
    };
  }
  if (raw.public && typeof raw.public === 'object' && !Array.isArray(raw.public)) {
    return {
      ...raw.public,
      property_id: raw.property_id || raw.public.property_id,
      status: raw.status || raw.public.status,
      visibility: raw.visibility ?? raw.public.visibility,
      publication_state: raw.publication_state ?? raw.public.publication_state,
      publication_approved: raw.publication_approved ?? raw.public.publication_approved
    };
  }
  return raw;
}

function runSanitization(rawRecords) {
  console.log(`[INFO] Analyzing ${Array.isArray(rawRecords) ? rawRecords.length : 0} records...`);
  const sanitizedList = [];
  const warnings = [];
  const seenIds = new Set();

  if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
    warnings.push('[EMPTY INPUT] Export aborted: candidate inventory array is empty');
    return { sanitizedList, warnings };
  }

  rawRecords.forEach((item, idx) => {
    const raw = unwrapCandidateRecord(item);
    if (!raw) {
      warnings.push(`[SCHEMA ERROR] Record #${idx + 1} is not a valid object`);
      return;
    }

    // Enforce visibility / publication approval gates BEFORE stripping unwhitelisted metadata
    if (raw.publication_approved === false) {
      warnings.push(`[VISIBILITY BLOCK] Record #${idx + 1} has publication_approved=false`);
      return;
    }
    const vis = String(raw.visibility || raw.publication_state || '').trim().toLowerCase();
    if (vis && !['public', 'approved_public'].includes(vis)) {
      warnings.push(`[VISIBILITY BLOCK] Record #${idx + 1} has non-public visibility "${raw.visibility || raw.publication_state}"`);
      return;
    }

    const rawStatus = raw.status !== undefined && raw.status !== null ? String(raw.status).trim() : 'Available';
    if (rawStatus.toLowerCase() !== 'available') {
      warnings.push(`[STATUS BLOCK] Record #${idx + 1} has non-public status "${rawStatus}"`);
      return;
    }

    const id = typeof raw.property_id === 'string' ? raw.property_id.trim() : '';
    if (!id || !PROPERTY_ID_REGEX.test(id)) {
      warnings.push(`[SCHEMA ERROR] Record #${idx + 1} missing valid property_id`);
      return;
    }

    if (seenIds.has(id)) {
      warnings.push(`[DUPLICATE ID] Record #${idx + 1} has duplicate property_id: ${id}`);
      return;
    }
    seenIds.add(id);

    const clean = {};
    for (const key of Object.keys(raw)) {
      if (!ALLOWED_PUBLIC_FIELDS.has(key)) continue;
      let val = raw[key];
      if (typeof val === 'string') {
        val = sanitizeString(val);
      }
      const fieldIssues = scanValueForLeaks(id, key, val);
      if (fieldIssues.length > 0) {
        warnings.push(...fieldIssues);
      }
      clean[key] = val !== undefined ? val : null;
    }

    const titleCandidate = typeof clean.listing_title === 'string' && clean.listing_title
      ? clean.listing_title
      : (typeof clean.project_name === 'string' ? clean.project_name : '');
    if (!titleCandidate) {
      warnings.push(`[SCHEMA ERROR] ${id} must define a non-empty string listing_title or project_name`);
      return;
    }
    if (!clean.listing_title) clean.listing_title = titleCandidate;
    clean.status = 'Available';

    sanitizedList.push(clean);
  });

  if (sanitizedList.length === 0 && warnings.length === 0) {
    warnings.push('[EMPTY OUTPUT] Zero publishable Available records remained after filtering');
  }

  return { sanitizedList, warnings };
}

function writeFeedsAtomically(sanitizedList) {
  const jsonContent = `${JSON.stringify(sanitizedList, null, 2)}\n`;
  const jsContent = `window.AUM_PUBLIC_INVENTORY = ${JSON.stringify(sanitizedList, null, 2)};\n`;

  const targets = [
    [path.join(DATA_DIR, 'public_inventory.json'), jsonContent],
    [path.join(DATA_DIR, 'public_inventory.js'), jsContent]
  ];

  if (fs.existsSync(path.dirname(CONCEPT_DATA_DIR))) {
    fs.mkdirSync(CONCEPT_DATA_DIR, { recursive: true });
    targets.push(
      [path.join(CONCEPT_DATA_DIR, 'public_inventory.json'), jsonContent],
      [path.join(CONCEPT_DATA_DIR, 'public_inventory.js'), jsContent]
    );
  }
  if (fs.existsSync(GRID_DIST_DATA_DIR)) {
    targets.push(
      [path.join(GRID_DIST_DATA_DIR, 'public_inventory.json'), jsonContent],
      [path.join(GRID_DIST_DATA_DIR, 'public_inventory.js'), jsContent]
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
        `.${path.basename(finalPath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`
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

function main() {
  const inputArg = process.argv[2];

  // If no explicit file argument is passed and the Master Backend DB engine exists, compile directly from Master SQLite DB!
  const backendConnPath = path.join(ROOT_DIR, 'backend', 'db', 'connection.js');
  const backendSeedPath = path.join(ROOT_DIR, 'backend', 'db', 'seed.js');
  const backendPubPath = path.join(ROOT_DIR, 'backend', 'domain', 'publisher.js');
  const backendCfgPath = path.join(ROOT_DIR, 'backend', 'config.js');
  const seedInvPath = path.join(ROOT_DIR, 'private_master_store', 'aum_inventory_local.json');

  if (
    !inputArg &&
    fs.existsSync(backendConnPath) &&
    fs.existsSync(backendPubPath) &&
    fs.existsSync(seedInvPath)
  ) {
    console.log('\n=============================================================');
    console.log(' AUM ESTATES — MASTER SQLITE -> PUBLIC FEED COMPILER');
    console.log('=============================================================');
    const { PATHS } = require(backendCfgPath);
    const { openDatabase } = require(backendConnPath);
    const { seedDatabaseIfEmpty } = require(backendSeedPath);
    const { compileAndPublishStaticFeeds } = require(backendPubPath);

    const db = openDatabase(PATHS.dbFile);
    const seeded = seedDatabaseIfEmpty(db);
    if (seeded.seeded) {
      console.log(`[SEED] Initialized Master SQLite DB (${seeded.publicMandates} approved public mandates).`);
    }
    const result = compileAndPublishStaticFeeds(db, { actorLabel: 'cli_sanitize_and_build' });
    db.close();
    console.log(`[VERIFIED] 0 privacy leaks across ${result.counts.publicProperties} mandates, ${result.counts.publicProjects} projects, ${result.counts.featuredCards} featured cards.`);
    console.log(`[RELEASE]  ${result.releaseId} synchronized atomically across ${result.writtenTargets.length} targets.\n`);
    return;
  }

  const inputPath = inputArg || path.join(DATA_DIR, 'public_inventory.json');
  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Input file not found: ${inputPath}`);
    process.exit(1);
  }

  console.log('\n=============================================================');
  console.log(' AUM ESTATES — INVENTORY SANITIZATION & INTEGRITY AUDITOR');
  console.log('=============================================================');
  console.log(`[SOURCE] ${inputPath}`);

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    if (!Array.isArray(rawData)) {
      throw new Error('Root JSON must be an array of property objects');
    }
  } catch (err) {
    console.error(`[FATAL] Failed to parse JSON input: ${err.message}`);
    process.exit(1);
  }

  const { sanitizedList, warnings } = runSanitization(rawData);

  if (warnings.length > 0 || sanitizedList.length === 0) {
    console.error(`\n[FATAL PRIVACY & SCHEMA GATE] Build aborted! ${warnings.length} violation(s) detected:`);
    warnings.slice(0, 20).forEach((w) => console.error(`  - ${w}`));
    if (warnings.length > 20) {
      console.error(`  ... and ${warnings.length - 20} more violations.`);
    }
    process.exit(1);
  }

  console.log(`[VERIFIED] 0 privacy leaks, schema errors, or duplicate IDs found.`);
  writeFeedsAtomically(sanitizedList);
  console.log(`[SUCCESS] Atomically published ${sanitizedList.length} verified records across all targets.\n`);
}

main();
