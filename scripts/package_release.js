#!/usr/bin/env node
/**
 * AUM ESTATES — Production Release Packager for Hostinger
 *
 * Usage:
 *   node scripts/package_release.js
 *
 * Creates an airtight, sanitized distribution bundle ready for Hostinger deployment.
 * Strictly blocks out-of-tree symlinks and scans every bundled file (not just
 * inventory filenames) for confidential seller/broker metadata before succeeding.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');
const REAL_SOURCE_DIR = fs.realpathSync(SOURCE_DIR);
const DIST_BUNDLE_DIR = path.join(ROOT_DIR, 'dist_hostinger');

console.log('\n=============================================================');
console.log(' AUM ESTATES — PRODUCTION DEPLOYMENT PACKAGER');
console.log(' Target Platform: Hostinger LiteSpeed (aumestates.com)');
console.log(' Date: ' + new Date().toISOString());
console.log('=============================================================\n');

// 1. Run Pre-flight Sanitization & Integrity Audit
console.log('[STEP 1/4] Running pre-flight privacy sanitization...');
try {
  execSync('node scripts/sanitize_and_build.js', { stdio: 'inherit', cwd: ROOT_DIR });
} catch {
  console.error('[FATAL] Pre-flight sanitization failed! Aborting packaging.');
  process.exit(1);
}

console.log('\n[STEP 2/4] Running production verification audit...');
try {
  execSync('node scripts/verify_site.js', { stdio: 'inherit', cwd: ROOT_DIR });
} catch {
  console.error('[FATAL] Production integrity checks failed! Aborting packaging.');
  process.exit(1);
}

// 2. Prepare Clean dist_hostinger Directory
console.log('\n[STEP 3/4] Assembling sanitized production distribution bundle...');
if (fs.existsSync(DIST_BUNDLE_DIR)) {
  fs.rmSync(DIST_BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_BUNDLE_DIR, { recursive: true });

const PRODUCTION_ENTRIES = [
  '.htaccess',
  'favicon.svg',
  'favicon.ico',
  'index.html',
  'sitemap.xml',
  'about',
  'contact',
  'locations',
  'projects',
  'properties',
  'approved-properties',
  'concepts',
  'assets',
  'data'
];

const FORBIDDEN_FILE_PATTERNS = [
  /^\.git/i,
  /\.DS_Store$/i,
  /^\.env/i,
  /\.bak$/i,
  /\.backup$/i,
  /\.restored$/i,
  /\.tmp\./i,
  /\.md$/i,
  /\.txt$/i,
  /\.jsonl$/i,
  /\.sqlite/i,
  /\.db$/i,
  /aum_inventory_local\.json$/i,
  /inventory_data_meta\.json$/i
];

function isForbidden(filename) {
  return FORBIDDEN_FILE_PATTERNS.some((re) => re.test(filename));
}

function abortPackaging(reason) {
  console.error(`\n[FATAL SECURITY] ${reason}`);
  if (fs.existsSync(DIST_BUNDLE_DIR)) {
    fs.rmSync(DIST_BUNDLE_DIR, { recursive: true, force: true });
  }
  process.exit(1);
}

function copyRecursive(src, dest) {
  const stat = fs.lstatSync(src);

  if (stat.isSymbolicLink()) {
    let realPath;
    try {
      realPath = fs.realpathSync(src);
    } catch {
      abortPackaging(`Broken symlink encountered in source tree: ${src}`);
    }
    if (realPath !== REAL_SOURCE_DIR && !realPath.startsWith(REAL_SOURCE_DIR + path.sep)) {
      abortPackaging(`Out-of-tree symlink traversal blocked: ${src} -> ${realPath}`);
    }
    copyRecursive(realPath, dest);
    return;
  }

  if (stat.isDirectory()) {
    const baseName = path.basename(src);
    if (baseName === 'backups' || baseName === 'node_modules' || baseName === 'private_master_store' || isForbidden(baseName)) {
      return;
    }
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (isForbidden(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else if (stat.isFile()) {
    const baseName = path.basename(src);
    if (isForbidden(baseName)) return;
    fs.copyFileSync(src, dest);
  }
}

for (const entry of PRODUCTION_ENTRIES) {
  const srcPath = path.join(SOURCE_DIR, entry);
  const destPath = path.join(DIST_BUNDLE_DIR, entry);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`  ✓ Bundled: ${entry}`);
  }
}

// 3. Post-packaging Full-Tree Privacy & Security Audit
console.log('\n[STEP 4/4] Conducting full-tree security scan on dist_hostinger/...');

const OFFICIAL_PHONES = ['9873813595', '9811157018'];
const PRIVATE_KEY_REGEX = /"(?:owner_contact|owner_name|owner_phone|owner_email|broker_phone|internal_notes|_private_broker_metadata|commission_terms|payment_structure_notes|internal_floor_price_inr|raw_whatsapp_text)"\s*:/i;
const DATA_FEED_LEAK_REGEX = /\b(?:commission|brokerage|broker\s*cut|payout|cheque|cash\s*(?:part|deal|component)|white\s*(?:deal|entry|component|part|ratio)|\d{1,3}\s*[/:]\s*\d{1,3}\s*(?:white|black|cheque|cash)|owner\s*(?:mob|name|phone)|keys?\s*in\s*hand)\b/i;

function findPrivatePhones(text) {
  const found = [];
  const re = /(?:₹|rs\.?\s*|inr\s*)?(?:\+?91[\s.-]?|0)?([6-9]\d(?:[\s.-]?\d){8})\b/gi;
  for (const m of text.matchAll(re)) {
    if (/^(?:₹|rs|inr)/i.test(m[0].trim())) continue;
    const digits = m[1].replace(/\D/g, '');
    if (digits.length === 10 && !OFFICIAL_PHONES.includes(digits)) found.push(digits);
  }
  return found;
}

let filesScanned = 0;
let leaksDetected = 0;

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
      continue;
    }
    if (!stat.isFile()) continue;
    filesScanned++;

    if (!/\.(?:js|json|html|xml|svg|css)$/i.test(entry)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const relPath = path.relative(DIST_BUNDLE_DIR, fullPath);

    // Universal checks on EVERY text/code/data file in the bundle
    const phones = findPrivatePhones(content);
    if (phones.length > 0) {
      console.error(`  [LEAK VIOLATION] ${relPath} contains private phone number(s): ${phones.slice(0, 3).join(', ')}`);
      leaksDetected++;
    }

    for (const m of content.matchAll(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
      const domain = m[1].toLowerCase();
      if (domain !== 'aumestates.com') {
        console.error(`  [LEAK VIOLATION] ${relPath} contains non-official email address: ${m[0]}`);
        leaksDetected++;
      }
    }

    if (/\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(content)) {
      console.error(`  [LEAK VIOLATION] ${relPath} contains PAN number pattern`);
      leaksDetected++;
    }

    if (PRIVATE_KEY_REGEX.test(content)) {
      console.error(`  [LEAK VIOLATION] ${relPath} contains private CRM/broker metadata key!`);
      leaksDetected++;
    }

    // Strict financial/payment/commission keyword scan across ALL .json files and window.AUM_* = [...] data feeds
    const isDataFeed = entry.toLowerCase().endsWith('.json') || /^\s*window\.AUM_[A-Z0-9_]+\s*=\s*\[/m.test(content);
    if (isDataFeed && DATA_FEED_LEAK_REGEX.test(content)) {
      console.error(`  [LEAK VIOLATION] ${relPath} contains internal commission, cheque, or seller handling terms!`);
      leaksDetected++;
    }
  }
}

scanDir(DIST_BUNDLE_DIR);

if (leaksDetected > 0) {
  abortPackaging(`${leaksDetected} privacy leak(s) found in production bundle! Bundle purged.`);
}

console.log(`  ✓ Scanned ${filesScanned} bundled production files — 0 privacy leaks, 0 out-of-tree symlinks, 0 forbidden files.`);

console.log('\n=============================================================');
console.log(' RELEASE PACKAGE READY FOR HOSTINGER');
console.log(' Destination Directory: ' + DIST_BUNDLE_DIR);
console.log(' Total Files: ' + filesScanned);
console.log('=============================================================\n');
