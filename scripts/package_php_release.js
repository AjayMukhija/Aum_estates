#!/usr/bin/env node
/**
 * AUM ESTATES — Production Release Packager for Hostinger Premium (PHP + MariaDB)
 *
 * Usage:
 *   node scripts/package_php_release.js
 *
 * Creates a complete deployable package with:
 * 1. public_html/ (Website, CRM SPA, Shortlist viewer, static feeds, front-controller, .htaccess)
 * 2. backend_php/ (PHP backend application placed securely outside docroot)
 * 3. mariadb_initial_import.sql (MariaDB schema & initial data dump ready for Hostinger import)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT_DIR, 'AUM_ESTATES_Website_For_Hostinger');
const CRM_UI_DIR = path.join(ROOT_DIR, 'backend', 'crm-ui');
const PHP_BACKEND_DIR = path.join(ROOT_DIR, 'backend_php');
const OUT_DIR = path.join(ROOT_DIR, 'dist_hostinger_php');
const PUBLIC_HTML_DIR = path.join(OUT_DIR, 'public_html');
const TARGET_PHP_DIR = path.join(OUT_DIR, 'backend_php');

console.log('\n=============================================================');
console.log(' AUM ESTATES — PHP + MariaDB Hostinger Release Packager');
console.log(' Date: ' + new Date().toISOString());
console.log('=============================================================\n');

// 1. Run tests first
console.log('[STEP 1/4] Running PHP & Node integrity tests...');
try {
  execSync('npm run test:php', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (err) {
  console.error('[FATAL] PHP test suite failed! Aborting packaging.');
  process.exit(1);
}

// 2. Export fresh MariaDB SQL dump from SQLite Master Store
console.log('\n[STEP 2/4] Generating canonical MariaDB migration dump...');
try {
  execSync('php backend_php/bin/convert_sqlite.php', { stdio: 'inherit', cwd: ROOT_DIR });
} catch (err) {
  console.error('[FATAL] MariaDB export failed! Aborting packaging.');
  process.exit(1);
}

// 3. Assemble distribution directory
console.log('\n[STEP 3/4] Assembling public_html and backend_php release bundles...');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(PUBLIC_HTML_DIR, { recursive: true });
fs.mkdirSync(TARGET_PHP_DIR, { recursive: true });

// This packager mirrors the whole source tree, and this is the bundle
// deploy_hostinger.sh actually rsyncs to the live host — so anything left in
// the source directory ships. Internal artifacts are named here:
//   simulator.html  — a 319KB internal grid simulator that also pulls
//                     Tailwind from a dev CDN; it was publicly reachable.
//   concepts/       — the aum-grid-study design study, carrying a second
//                     full copy of the inventory feed.
const EXCLUDED_FROM_PUBLIC_HTML = [
  '.git', '.DS_Store', 'node_modules', '.tmp',
  'simulator.html', 'concepts'
];

// Copy website static files into public_html
const copyRecursiveSync = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      if (EXCLUDED_FROM_PUBLIC_HTML.includes(file)) continue;
      copyRecursiveSync(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

copyRecursiveSync(SOURCE_DIR, PUBLIC_HTML_DIR);

// Copy CRM UI into public_html/crm/
const crmDest = path.join(PUBLIC_HTML_DIR, 'crm');
fs.mkdirSync(crmDest, { recursive: true });
fs.copyFileSync(path.join(CRM_UI_DIR, 'index.html'), path.join(crmDest, 'index.html'));
fs.copyFileSync(path.join(CRM_UI_DIR, 'crm.js'), path.join(crmDest, 'crm.js'));
fs.copyFileSync(path.join(CRM_UI_DIR, 'crm.css'), path.join(crmDest, 'crm.css'));
fs.copyFileSync(path.join(CRM_UI_DIR, 'shortlist.html'), path.join(crmDest, 'shortlist.html'));
fs.copyFileSync(path.join(CRM_UI_DIR, 'shortlist.html'), path.join(PUBLIC_HTML_DIR, 'shortlist.html'));

// Copy PHP Backend
for (const sub of ['config', 'db', 'auth', 'domain', 'routes', 'bin', 'public']) {
  const src = path.join(PHP_BACKEND_DIR, sub);
  if (fs.existsSync(src)) {
    copyRecursiveSync(src, path.join(TARGET_PHP_DIR, sub));
  }
}

// Write the production front controller inside public_html
const frontControllerContent = `<?php
declare(strict_types=1);

/**
 * AUM Estates — Public Web Entry & API Dispatcher
 */

// If backend_php is placed one level above public_html (recommended on Hostinger):
$backendPhp = __DIR__ . '/../backend_php/public/index.php';
if (!file_exists($backendPhp)) {
    // If backend_php is placed inside public_html:
    $backendPhp = __DIR__ . '/backend_php/public/index.php';
}

if (!file_exists($backendPhp)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Backend configuration missing']);
    exit;
}

require $backendPhp;
`;

fs.writeFileSync(path.join(PUBLIC_HTML_DIR, 'index.php'), frontControllerContent);

// Copy MariaDB dump to top-level of release directory
fs.copyFileSync(
  path.join(PHP_BACKEND_DIR, 'db', 'canonical_mariadb_migration.sql'),
  path.join(OUT_DIR, 'mariadb_initial_import.sql')
);

// Update production .htaccess inside public_html
const htaccessPath = path.join(PUBLIC_HTML_DIR, '.htaccess');
let htaccessContent = fs.readFileSync(htaccessPath, 'utf8');

// Insert API and CRM rewrites if not already present
if (!htaccessContent.includes('RewriteRule ^api/')) {
  const rewriteBlock = `
    # ----------------------------------------------------------------------
    # AUM Estates PHP Backend Rewrites (API, Shortlists, CRM)
    # ----------------------------------------------------------------------
    RewriteRule ^api/.*$ /index.php [QSA,L]
    RewriteRule ^shortlist/([A-Za-z0-9_-]{12,64})/?$ /shortlist.html [QSA,L]
    RewriteRule ^crm/?$ /crm/index.html [QSA,L]

    # Per-property share previews.
    # properties/detail.html is static HTML filled in by JavaScript, and no
    # link-preview crawler runs JavaScript, so a shared dossier rendered the
    # generic site card instead of that property. PHP substitutes the correct
    # metadata into the page's head.
    #
    # NO RewriteCond on HTTP_USER_AGENT here, deliberately. Serving crawlers a
    # different response from buyers looked obvious and was wrong: Hostinger's
    # CDN caches by URL and varies only on Accept-Encoding, so it served
    # whichever response it cached first to everyone, differing per edge node.
    # Every visitor gets one identical response, which is cache-safe and also
    # corrects the browser tab title and the title Google indexes.
    RewriteRule ^properties/detail\\.html$ /index.php [QSA,L]
`;
  // Anchor AFTER the HTTPS redirect. These rules end in [L]; inserting them above
  // the redirect would let an http:// API request through unencrypted.
  const httpsAnchor = 'RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]';
  if (htaccessContent.includes(httpsAnchor)) {
    htaccessContent = htaccessContent.replace(httpsAnchor, httpsAnchor + '\n' + rewriteBlock);
  } else {
    throw new Error('package_php_release: HTTPS redirect anchor missing from .htaccess; refusing to emit rewrites in an unsafe order.');
  }
  fs.writeFileSync(htaccessPath, htaccessContent);
}

// 4. Summary & Verification
console.log('\n[STEP 4/4] Verifying generated package contents...');
const pubFiles = fs.readdirSync(PUBLIC_HTML_DIR);
console.log(`✓ public_html created with ${pubFiles.length} root items`);
console.log(`✓ backend_php created with full application source`);
console.log(`✓ mariadb_initial_import.sql ready (${(fs.statSync(path.join(OUT_DIR, 'mariadb_initial_import.sql')).size / 1024).toFixed(1)} KB)`);

console.log('\n=============================================================');
console.log(' Hostinger PHP Release Package Successfully Created:');
console.log(` Location: ${OUT_DIR}`);
console.log('=============================================================\n');
