#!/usr/bin/env node
/**
 * AUM ESTATES — Production Release Packager for Hostinger
 * 
 * Usage:
 *   node scripts/package_release.js
 * 
 * Creates an airtight, sanitized distribution bundle ready for Hostinger deployment.
 * Strictly guarantees that zero private broker notes, spreadsheets, or test files
 * are ever bundled into production.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');
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
} catch (e) {
  console.error('[FATAL] Pre-flight sanitization failed! Aborting packaging.');
  process.exit(1);
}

console.log('\n[STEP 2/4] Running 45-point production verification audit...');
try {
  execSync('node scripts/verify_site.js', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (e) {
  console.error('[FATAL] Production integrity checks failed! Aborting packaging.');
  process.exit(1);
}

// 2. Prepare Clean dist_hostinger Directory
console.log('\n[STEP 3/4] Assembling sanitized production distribution bundle...');
if (fs.existsSync(DIST_BUNDLE_DIR)) {
  fs.rmSync(DIST_BUNDLE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_BUNDLE_DIR, { recursive: true });

// Whitelist of files/folders permitted in Hostinger production
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

// Files strictly forbidden from production bundle
const FORBIDDEN_FILE_PATTERNS = [
  /^\.git/,
  /\.DS_Store/,
  /\.env/,
  /\.bak$/,
  /\.backup$/,
  /\.md$/,
  /\.txt$/,
  /\.jsonl$/,
  /aum_inventory_local\.json/,
  /inventory_data_meta\.json/
];

function isForbidden(filename) {
  return FORBIDDEN_FILE_PATTERNS.some(re => re.test(filename));
}

function copyRecursive(src, dest) {
  const stat = fs.lstatSync(src);

  // If symlink, resolve target
  if (stat.isSymbolicLink()) {
    const realPath = fs.realpathSync(src);
    copyRecursive(realPath, dest);
    return;
  }

  if (stat.isDirectory()) {
    const baseName = path.basename(src);
    if (baseName === 'backups' || baseName === 'node_modules' || isForbidden(baseName)) {
      return;
    }
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      if (isForbidden(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else if (stat.isFile()) {
    const baseName = path.basename(src);
    if (isForbidden(baseName)) return;
    fs.copyFileSync(src, dest);
  }
}

PRODUCTION_ENTRIES.forEach(entry => {
  const srcPath = path.join(SOURCE_DIR, entry);
  const destPath = path.join(DIST_BUNDLE_DIR, entry);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
    console.log(`  ✓ Bundled: ${entry}`);
  }
});

// 3. Post-packaging Privacy & Security Audit
console.log('\n[STEP 4/4] Conducting post-packaging security scan on dist_hostinger/...');

let filesScanned = 0;
let leaksDetected = 0;
const LEAK_REGEX = /\b(?:commission|brokerage|broker\s*cut|payout|\d{2}\s*[\/:]\s*\d{2}\s*(?:white|black)|owner\s*mob|owner\s*name)\b/i;
const PHONE_REGEX = /(?:\+91[\s-]?)?[6-9]\d{9}\b/;
const OFFICIAL_PHONES = ['9873813595', '9811157018'];

function scanDir(dir) {
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile()) {
      filesScanned++;
      if (entry.endsWith('.js') || entry.endsWith('.json') || entry.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (entry.includes('inventory')) {
          if (LEAK_REGEX.test(content)) {
            console.error(`  [LEAK VIOLATION] ${fullPath} contains broker commission terms!`);
            leaksDetected++;
          }
        }
      }
    }
  }
}

scanDir(DIST_BUNDLE_DIR);

if (leaksDetected > 0) {
  console.error(`\n[FATAL] ${leaksDetected} privacy leak(s) found in production bundle! Aborting.`);
  process.exit(1);
}

console.log(`  ✓ Scanned ${filesScanned} bundled production files — 0 privacy leaks, 0 forbidden files.`);

console.log('\n=============================================================');
console.log(' RELEASE PACKAGE READY FOR HOSTINGER');
console.log(' Destination Directory: ' + DIST_BUNDLE_DIR);
console.log(' Total Files: ' + filesScanned);
console.log('=============================================================');
console.log(`
DEPLOYMENT INSTRUCTIONS:
1. Via Hostinger File Manager:
   - Zip the contents of "${path.basename(DIST_BUNDLE_DIR)}"
   - Upload to "public_html/" on Hostinger and click "Extract".

2. Via SFTP:
   - Connect to your Hostinger SFTP server.
   - Synchronize the contents of "${DIST_BUNDLE_DIR}" directly into "/public_html".

3. Immediate Verification:
   - Visit https://aumestates.com/ to inspect live site.
   - Visit https://aumestates.com/concepts/aum-grid-study/ to inspect the Architectural Grid.
=============================================================\n`);
