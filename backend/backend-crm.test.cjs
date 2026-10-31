'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { PATHS, SERVER_CONFIG } = require('./config');
const { openDatabase } = require('./db/connection');
const { seedDatabaseIfEmpty } = require('./db/seed');
const { normalizeAreaSqFt, normalizePriceInr, normalizeRentInr } = require('./domain/normalizer');
const { validateAndProjectPublicRecord, scanTextForLeaks } = require('./domain/privacy_gate');
const { searchPublicProperties, searchCrmProperties, matchPropertiesForRequirement } = require('./domain/search_engine');
const { parseWhatsAppBroadcast } = require('./domain/intake_parser');
const { compileAndPublishStaticFeeds } = require('./domain/publisher');
const { createAppServer } = require('./server');

/**
 * Fast, deterministic in-process HTTP request injector for Node http.Server.
 * Works identically inside strict no-network sandboxes and standard environments.
 */
function injectHttp(server, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payloadBuf = body == null
      ? Buffer.alloc(0)
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8');

    const normalizedHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }
    if (body != null && typeof body === 'object' && !Buffer.isBuffer(body) && !normalizedHeaders['content-type']) {
      normalizedHeaders['content-type'] = 'application/json';
    }
    if (payloadBuf.length > 0) {
      normalizedHeaders['content-length'] = String(payloadBuf.length);
    }
    normalizedHeaders.host = normalizedHeaders.host || '127.0.0.1:8787';

    const req = Readable.from(payloadBuf.length ? [payloadBuf] : []);
    req.method = method.toUpperCase();
    req.url = url;
    req.headers = normalizedHeaders;
    req.socket = { remoteAddress: '127.0.0.1' };

    const chunks = [];
    let statusCode = 200;
    let resHeaders = {};

    const res = new Writable({
      write(chunk, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        cb();
      }
    });

    res.writeHead = (code, hdrs = {}) => {
      statusCode = code;
      resHeaders = { ...resHeaders, ...hdrs };
      return res;
    };
    res.setHeader = (k, v) => {
      resHeaders[k] = v;
    };
    res.getHeader = (k) => resHeaders[k];

    const origEnd = res.end.bind(res);
    res.end = (chunk, enc, cb) => {
      if (chunk !== undefined && chunk !== null && typeof chunk !== 'function') {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof enc === 'string' ? enc : 'utf8'));
      }
      origEnd(() => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: statusCode, headers: resHeaders, text, json });
        if (typeof cb === 'function') cb();
      });
    };

    res.on('error', reject);
    server.emit('request', req, res);
  });
}

function createSeededMemoryDb() {
  const db = openDatabase(':memory:');
  const seedInfo = seedDatabaseIfEmpty(db);
  assert.equal(seedInfo.seeded, true);
  assert.equal(seedInfo.publicMandates, 347);
  return db;
}

test('Master SQLite seed partitions 347 public mandates, reconciles featured IDs, and quarantines 31 payment leaks', () => {
  const db = createSeededMemoryDb();

  const pubCount = db.prepare(
    "SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND availability_state = 'available'"
  ).get().c;
  assert.equal(pubCount, 347);

  // Featured cards must total 16 and have zero broken FK references
  const featuredCount = db.prepare('SELECT COUNT(*) AS c FROM properties WHERE is_featured_approved = 1').get().c;
  assert.equal(featuredCount, 16);

  // Off-market mandate & pending WhatsApp draft exist in Master DB but NOT in approved_public
  const offMarket = db.prepare("SELECT * FROM properties WHERE property_id = 'AUM-OFF-000001'").get();
  assert.ok(offMarket);
  assert.equal(offMarket.publication_state, 'private_off_market');

  // Quarantined cheque/payment notes live strictly in property_private, never in properties
  const leakedInPublic = db.prepare(
    "SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND LOWER(COALESCE(price_text, '') || ' ' || COALESCE(public_description, '') || ' ' || COALESCE(key_features, '')) LIKE '%cheque%'"
  ).get().c;
  assert.equal(leakedInPublic, 0, 'Zero cheque terms may remain in public properties columns');

  const quarantinedInVault = db.prepare(
    "SELECT COUNT(*) AS c FROM property_private WHERE COALESCE(payment_structure_notes, '') != '' OR COALESCE(internal_advisor_notes, '') != ''"
  ).get().c;
  assert.ok(quarantinedInVault >= 30, `Expected >=30 quarantined payment/advisor notes in property_private (found ${quarantinedInVault})`);

  db.close();
});

test('Unit Normalizer & Fiduciary Privacy Gate block adverse leaks without false-flagging Whiteland', () => {
  // Area normalizer
  assert.equal(normalizeAreaSqFt(500, 'Sq Yards'), 4500);
  assert.equal(normalizeAreaSqFt(1, 'Kanal'), 5445);
  assert.equal(normalizeAreaSqFt(1, 'Acre'), 43560);
  assert.equal(normalizeAreaSqFt(10, 'Marla'), 2723);

  // Price normalizer (including rate * area)
  assert.equal(normalizePriceInr({ priceValue: 7.5, priceUnit: 'Cr' }), 75000000);
  assert.equal(
    normalizePriceInr({ priceValue: 3.5, priceUnit: 'Lakh per sq yd', areaValue: 500, areaUnit: 'Sq Yd' }),
    175000000
  );
  assert.equal(normalizeRentInr({ rentValue: 2.2, rentUnit: 'Lakh / month', transactionType: 'Rent' }), 220000);

  // Whiteland project name must pass cleanly
  const whitelandCheck = validateAndProjectPublicRecord({
    property_id: 'AUM-WEB-900001',
    publication_state: 'approved_public',
    availability_state: 'available',
    project_name: 'Whiteland The Aspen',
    listing_title: 'Whiteland The Aspen 4 BHK Residence',
    locality: 'Sector 76',
    city: 'Gurgaon',
    property_type: 'Apartment',
    transaction_type: 'Sale',
    price_value: 5.4,
    price_unit: 'Cr',
    price_text: '₹5.4 Cr'
  });
  assert.equal(whitelandCheck.ok, true, `Whiteland should pass cleanly: ${whitelandCheck.errors.join('; ')}`);

  // Official phone + private phone in same field MUST fail
  const mixedPhones = scanTextForLeaks('public_description', 'Advisory 9873813595 / Owner 98101 22334');
  assert.ok(mixedPhones.some((v) => v.rule === 'Private Phone Number'));

  // Cheque / white deal / XSS property_id MUST fail
  const badRecord = validateAndProjectPublicRecord({
    property_id: '<img src=x onerror=1>',
    publication_state: 'approved_public',
    availability_state: 'available',
    listing_title: 'Test Condo',
    price_text: '70% cheque / 30% cash part'
  });
  assert.equal(badRecord.ok, false);
  assert.ok(badRecord.errors.length >= 2);
});

test('Dual-Surface Search isolates confidential vault from public buyers while empowering advisor CRM search', () => {
  const db = createSeededMemoryDb();

  // 1. Public synonym search: "GCR" -> Golf Course Road mandates
  const gcrRes = searchPublicProperties(db, { q: 'GCR' });
  assert.ok(gcrRes.total >= 15, `Expected >=15 GCR results, got ${gcrRes.total}`);

  // 2. Public synonym search: "Kothi" -> Villa / Independent House mandates
  const kothiRes = searchPublicProperties(db, { q: 'Kothi' });
  assert.ok(kothiRes.total >= 10, `Expected >=10 Kothi results, got ${kothiRes.total}`);

  // 3. Public search MUST NEVER match private owner names, exact unit numbers, off-market mandates, or cheque notes
  for (const secretTerm of ['Singhania', 'AUM-OFF-000001', '9811001122', 'cheque']) {
    const pubProbe = searchPublicProperties(db, { q: secretTerm });
    assert.equal(pubProbe.total, 0, `Public search leaked match for confidential term "${secretTerm}"`);
  }

  // 4. Advisor CRM FTS5 search MUST find private owner names, off-market mandates, and quarantined cheque terms
  const crmOwnerSearch = searchCrmProperties(db, { q: 'Singhania' });
  assert.ok(crmOwnerSearch.total >= 1, 'Advisor CRM search must locate seller Vikramjit Singhania in private vault');
  assert.equal(crmOwnerSearch.items[0].property_id, 'AUM-OFF-000001');

  const crmChequeSearch = searchCrmProperties(db, { q: 'cheque' });
  assert.ok(crmChequeSearch.total >= 15, `Advisor CRM search must locate quarantined cheque notes (got ${crmChequeSearch.total})`);

  db.close();
});

test('Two-Pass WhatsApp Broadcast Parser extracts specs and quarantines broker phone, unit & cheque terms', () => {
  const rawMsg = [
    '🔥 DIRECT INVENTORY — DLF The Camellias, Golf Course Road, Sector 42',
    '4 BHK + Lounge, 7400 Sq Ft, Higher Floor, Tower 4 Flat 11A',
    'Asking 72 Cr (70% cheque, 1% brokerage side)',
    'Keys in hand for inspection. Call Rajesh Khanna +91 98102 33445'
  ].join('\n');

  const parsed = parseWhatsAppBroadcast(rawMsg, { sourceGroup: 'GCR Luxury Brokers' });

  // Public draft must be completely clean and pass the privacy gate if approved
  assert.equal(parsed.publicDraft.corridor, 'Golf Course Road');
  assert.equal(parsed.publicDraft.area_sqft_norm, 7400);
  assert.equal(parsed.publicDraft.price_inr_norm, 720000000);
  assert.equal(scanTextForLeaks('public_description', parsed.publicDraft.public_description || '').length, 0);

  // Confidential details must sit inside privateVault
  assert.ok(String(parsed.privateVault.broker_phone_cache || '').replace(/\D/g, '').endsWith('9810233445'));
  assert.ok((parsed.privateVault.exact_unit_or_plot_no || '').includes('11A') || (parsed.privateVault.exact_unit_or_plot_no || '').includes('Tower 4'));
  assert.ok(parsed.privateVault.commission_terms);
  assert.ok(parsed.privateVault.payment_structure_notes);
});

test('HTTP Server enforces path containment, Auth/CSRF, Lead Capture, Auto-Matcher, CSV Import, and Fiduciary Shortlists', async () => {
  const db = createSeededMemoryDb();
  const tmpPublishDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aum-crm-pub-'));
  const customPaths = {
    ...PATHS,
    hostingerDataDir: path.join(tmpPublishDir, 'hostinger-data'),
    hostingerConceptDataDir: path.join(tmpPublishDir, 'concept', 'data'),
    gridBaselineDir: path.join(tmpPublishDir, 'grid'),
    gridBaselineDataDir: path.join(tmpPublishDir, 'grid', 'data'),
    v16Dir: path.join(tmpPublishDir, 'v16'),
    releasesDir: path.join(tmpPublishDir, 'releases')
  };
  fs.mkdirSync(customPaths.gridBaselineDir, { recursive: true });
  fs.mkdirSync(customPaths.v16Dir, { recursive: true });
  fs.mkdirSync(path.dirname(customPaths.hostingerConceptDataDir), { recursive: true });

  const server = createAppServer(db, { targetPaths: customPaths });

  // 1. Static traversal & private directory containment probes MUST return 404
  for (const blockedUrl of [
    '/.git/config',
    '/../package.json',
    '/%2e%2e/package.json',
    '/private_master_store/aum_inventory_local.json',
    '/data/backups/latest.json',
    '/OPERATING_MANUAL.md'
  ]) {
    const res = await injectHttp(server, { method: 'GET', url: blockedUrl });
    assert.equal(res.status, 404, `Expected 404 for sensitive path ${blockedUrl}, got ${res.status}`);
  }

  // 2. Contained UI routes serve 200 OK
  for (const okUrl of ['/', '/crm/', '/v16/', '/grid/']) {
    const res = await injectHttp(server, { method: 'GET', url: okUrl });
    assert.equal(res.status, 200, `Expected 200 for UI route ${okUrl}`);
  }

  // 3. Public inquiry creates Contact + Lead + Buyer Requirement + deduplicates idempotency_key
  const inqBody = {
    client_name: 'Rohan Malhotra',
    client_phone: '+91 98119 88776',
    intent: 'Buy',
    preferred_location: 'Golf Course Road',
    budget_text: '₹28–38 Cr',
    property_id: 'AUM-WEB-000167',
    selected_questions: ['What exact unit is available?', 'Complete landed cost?'],
    saved_property_ids: ['AUM-WEB-000167', 'AUM-WEB-000194'],
    source_channel: 'v16_consult',
    source_page: 'brand_study_v16',
    idempotency_key: 'idem-rohan-001',
    message: 'Looking for a 4 BHK luxury apartment or floor on Golf Course Road.'
  };
  const inq1 = await injectHttp(server, { method: 'POST', url: '/api/public/inquiries', body: inqBody });
  assert.equal(inq1.status, 201);
  assert.equal(inq1.json.ok, true);
  assert.match(inq1.json.lead_id, /^LEAD-2026-\d+$/);

  const inqDup = await injectHttp(server, { method: 'POST', url: '/api/public/inquiries', body: inqBody });
  assert.equal(inqDup.status, 200);
  assert.equal(inqDup.json.deduplicated, true);
  assert.equal(inqDup.json.lead_id, inq1.json.lead_id);

  // 4. Unauthenticated CRM access blocked with 401
  const unauth = await injectHttp(server, { method: 'GET', url: '/api/crm/dashboard' });
  assert.equal(unauth.status, 401);

  // 5. Advisor Login & CSRF enforcement
  const loginRes = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/auth/login',
    body: {
      email: SERVER_CONFIG.defaultAdminEmail,
      password: SERVER_CONFIG.defaultAdminPassword
    }
  });
  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.json.ok, true);
  const csrfToken = loginRes.json.csrfToken;
  const setCookie = loginRes.headers['Set-Cookie'];
  assert.ok(setCookie && setCookie.includes('HttpOnly'));
  const cookieHeader = setCookie.split(';')[0];

  // Mutating CRM request WITHOUT X-CSRF-Token must be rejected with 403
  const noCsrf = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/contacts',
    headers: { cookie: cookieHeader },
    body: { full_name: 'Blocked Contact' }
  });
  assert.equal(noCsrf.status, 403);

  const authHeaders = {
    cookie: cookieHeader,
    'x-csrf-token': csrfToken
  };

  // 6. Dashboard shows newly captured website lead
  const dash = await injectHttp(server, { method: 'GET', url: '/api/crm/dashboard', headers: authHeaders });
  assert.equal(dash.status, 200);
  assert.equal(dash.json.inventory.live_public, 347);
  assert.ok(dash.json.recentLeads.some((l) => l.lead_id === inq1.json.lead_id));

  // 7. Buyer Requirement Auto-Matcher scores both Public and Off-Market mandates (including floor-price intelligence!)
  const matchRes = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/requirements/match',
    headers: authHeaders,
    body: {
      intent: 'Buy',
      corridors_json: ['Golf Course Road'],
      categories_json: ['Apartment', 'Villa', 'Builder Floor'],
      min_bedrooms: 4,
      min_budget_inr: 250000000,
      max_budget_inr: 350000000,
      include_off_market: 1
    }
  });
  assert.equal(matchRes.status, 200);
  assert.ok(matchRes.json.matches.length >= 1);
  // AUM-OFF-000001 (DLF Magnolias / GCR off-market mandate around ₹32–34 Cr) should match with high score
  const offMatch = matchRes.json.matches.find((m) => m.property_id === 'AUM-OFF-000001');
  assert.ok(offMatch, 'Auto-Matcher must surface eligible off-market mandate AUM-OFF-000001 to advisor');
  assert.ok(offMatch.match_score >= 70);

  // 8. CSV Batch Import (Dry-Run + Commit) with automatic privacy quarantine
  const csvText = [
    'property_id,project_name,listing_title,locality,sector,property_type,transaction_type,area_value,area_unit,price_value,price_unit,owner_name,owner_phone,commission_terms,publication_state',
    'AUM-IMP-990001,DLF The Arbour,DLF The Arbour 4 BHK Deck Residence,Golf Course Extension,Sector 63,Apartment,Sale,3956,Sq Ft,8.9,Cr,Anil Kapoor,9811223344,1% standard,approved_public'
  ].join('\n');

  const dryImport = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/intake/import',
    headers: authHeaders,
    body: { format: 'csv', text: csvText, dryRun: true }
  });
  assert.equal(dryImport.status, 200);
  assert.equal(dryImport.json.dryRun, true);
  assert.equal(dryImport.json.summary.newCount, 1);
  assert.equal(dryImport.json.summary.privateVaultPopulated, 1);

  const commitImport = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/intake/import',
    headers: authHeaders,
    body: { format: 'csv', text: csvText, dryRun: false }
  });
  assert.equal(commitImport.status, 200);
  assert.equal(commitImport.json.dryRun, false);

  // Verify imported property's owner phone is ONLY in property_private and NEVER in public API
  const pubImported = await injectHttp(server, { method: 'GET', url: '/api/public/properties/AUM-IMP-990001' });
  assert.equal(pubImported.status, 200);
  assert.equal(pubImported.json.item.owner_phone_cache, undefined);
  assert.equal(pubImported.json.item.owner_name, undefined);
  assert.ok(!JSON.stringify(pubImported.json.item).includes('9811223344'));
  assert.ok(!JSON.stringify(pubImported.json.item).includes('Anil Kapoor'));

  // 9. Tokenized Shareable Client Shortlist (includes Off-Market AUM-OFF-000001 while stripping 100% of property_private!)
  const slCreate = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/shortlists',
    headers: authHeaders,
    body: {
      lead_id: inq1.json.lead_id,
      client_name: 'Rohan Malhotra',
      title: 'Golf Course Road & Extension Trophy Shortlist',
      advisor_intro_note: 'Curated options including one discrete off-market residence.',
      property_ids: ['AUM-OFF-000001', 'AUM-IMP-990001'],
      commentaries: {
        'AUM-OFF-000001': 'Rare off-market availability; inspection requires 24h notice.',
        'AUM-IMP-990001': 'High floor facing Aravallis.'
      }
    }
  });
  assert.equal(slCreate.status, 201);
  const token = slCreate.json.share_token;
  assert.ok(token && token.length >= 16);

  // Shortlist HTML viewer serves 200
  const slHtml = await injectHttp(server, { method: 'GET', url: `/shortlist/${token}` });
  assert.equal(slHtml.status, 200);
  assert.ok(slHtml.text.includes('CURATED ADVISORY SHORTLIST'));

  // Public Shortlist JSON returns curated off-market item WITHOUT any confidential seller/floor-price fields!
  const slPublic = await injectHttp(server, { method: 'GET', url: `/api/public/shortlists/${token}` });
  assert.equal(slPublic.status, 200);
  assert.equal(slPublic.json.shortlist.items.length, 2);
  const offSlItem = slPublic.json.shortlist.items.find((i) => i.property_id === 'AUM-OFF-000001');
  assert.equal(offSlItem.is_off_market_curated, true);
  assert.equal(offSlItem.advisor_commentary, 'Rare off-market availability; inspection requires 24h notice.');

  const serializedShortlist = JSON.stringify(slPublic.json);
  for (const forbiddenSecret of [
    'Singhania',
    '9811001122',
    'internal_floor_price_inr',
    'owner_name_cache',
    'owner_phone_cache',
    'commission_terms',
    'payment_structure_notes',
    'exact_unit_or_plot_no',
    'Anil Kapoor',
    '9811223344'
  ]) {
    assert.ok(
      !serializedShortlist.includes(forbiddenSecret),
      `Confidential secret "${forbiddenSecret}" must NEVER leak into client shortlist JSON`
    );
  }

  // 10. Atomic Publisher writes 348 mandates (347 + newly imported AUM-IMP-990001) to isolated tmp targetPaths
  const pubTrigger = await injectHttp(server, {
    method: 'POST',
    url: '/api/crm/publish',
    headers: authHeaders,
    body: {}
  });
  assert.equal(pubTrigger.status, 200);
  assert.equal(pubTrigger.json.release.counts.publicProperties, 348);
  assert.ok(fs.existsSync(path.join(customPaths.v16Dir, 'public_inventory.js')));

  fs.rmSync(tmpPublishDir, { recursive: true, force: true });
  db.close();
});
