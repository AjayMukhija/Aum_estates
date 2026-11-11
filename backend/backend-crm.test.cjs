'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

process.env.AUM_ADMIN_PASSWORD = 'Test-only-credential-2026!';

const { PATHS, SERVER_CONFIG } = require('./config');
const hasPrivateSeed = fs.existsSync(PATHS.seedInventoryJson);
const seedCount = JSON.parse(fs.readFileSync(hasPrivateSeed ? PATHS.seedInventoryJson : path.join(PATHS.hostingerDataDir, 'public_inventory.json'), 'utf8')).length;
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
  const seedInfo = seedDatabaseIfEmpty(db, { demo: true });
  assert.equal(seedInfo.seeded, true);
  assert.equal(seedInfo.publicMandates, seedCount);
  return db;
}

test('Master SQLite seed isolates public mandates, reconciles featured IDs, and quarantines private fixture notes', () => {
  const db = createSeededMemoryDb();

  const pubCount = db.prepare(
    "SELECT COUNT(*) AS c FROM properties WHERE publication_state = 'approved_public' AND availability_state = 'available'"
  ).get().c;
  assert.equal(pubCount, seedCount);

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
  assert.ok(quarantinedInVault >= (hasPrivateSeed ? 30 : 1), `Expected >=30 quarantined payment/advisor notes in property_private (found ${quarantinedInVault})`);

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

  if (!hasPrivateSeed) {
    db.prepare("UPDATE property_private SET payment_structure_notes='Synthetic test cheque note' WHERE property_id='AUM-WEB-000001'").run();
    require('./db/connection').syncPropertyFts(db, 'AUM-WEB-000001');
  }
  const crmChequeSearch = searchCrmProperties(db, { q: 'cheque' });
  assert.ok(crmChequeSearch.total >= (hasPrivateSeed ? 15 : 1), `Advisor CRM search must locate quarantined cheque notes (got ${crmChequeSearch.total})`);

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
  assert.equal(dash.json.inventory.live_public, seedCount);
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
  assert.equal(pubTrigger.json.release.counts.publicProperties, seedCount + 1);
  assert.ok(fs.existsSync(path.join(customPaths.v16Dir, 'public_inventory.js')));

  fs.rmSync(tmpPublishDir, { recursive: true, force: true });
  db.close();
});

function isolatedTargets(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aum-regression-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { ...PATHS, hostingerDataDir: path.join(dir, 'data'), hostingerConceptDataDir: path.join(dir, 'unused/concept/data'), gridBaselineDir: path.join(dir, 'unused/grid'), gridBaselineDataDir: path.join(dir, 'unused/grid/data'), v16Dir: path.join(dir, 'unused/v16'), releasesDir: path.join(dir, 'releases') };
}

function testSession(db, role = 'principal') {
  const { hashPassword, createSession } = require('./auth');
  const { hash, salt } = hashPassword('Test-only-strong-password!');
  const result = db.prepare('INSERT INTO users(email,full_name,role,password_hash,password_salt) VALUES(?,?,?,?,?)').run(`${role}-${Date.now()}-${Math.random()}@example.invalid`, 'Regression User', role, hash, salt);
  return createSession(db, Number(result.lastInsertRowid));
}

test('Shortlists reject drafts, confidential property text and commentary, including after a link was created', async (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close());
  const server = createAppServer(db); const session = testSession(db);
  const headers = { 'x-aum-session': session.sessionId };
  const post = (body) => injectHttp(server, { method: 'POST', url: '/api/crm/shortlists', headers, body });
  const { upsertPropertyMaster } = require('./server');
  upsertPropertyMaster(db, { property_id: 'AUM-TEST-DRAFT', listing_title: 'Synthetic draft', publication_state: 'draft', public_description: 'Synthetic owner 9123456789' }, { role: 'principal', label: 'test' });
  assert.equal((await post({ property_ids: ['AUM-TEST-DRAFT'] })).status, 422);
  assert.equal((await post({ property_ids: ['AUM-OFF-000001'], commentaries: { 'AUM-OFF-000001': 'Synthetic private number 9123456789' } })).status, 422);
  assert.equal((await post({ property_ids: ['AUM-OFF-000001'], advisor_intro_note: '1% brokerage' })).status, 422);
  const good = await post({ property_ids: ['AUM-OFF-000001'] });
  assert.equal(good.status, 201);
  const url = '/api/public/shortlists/' + good.json.share_token;
  assert.equal((await injectHttp(server, { url })).status, 200);
  db.prepare("UPDATE properties SET public_description='Synthetic number 9123456789' WHERE property_id='AUM-OFF-000001'").run();
  const blocked = await injectHttp(server, { url });
  assert.equal(blocked.status, 422); assert.ok(!blocked.text.includes('9123456789'));
  const revoke = await injectHttp(server, { method: 'POST', url: `/api/crm/shortlists/${good.json.shortlist_id}/revoke`, headers, body: {} });
  assert.equal(revoke.status, 200); assert.equal((await injectHttp(server, { url })).status, 404);
});

test('Analysts are read-only, advisors cannot approve directly or via generic updates/imports/publish', async (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close());
  const server = createAppServer(db, { targetPaths: isolatedTargets(t) });
  const analyst = testSession(db, 'analyst'), advisor = testSession(db, 'advisor');
  for (const url of ['/api/crm/properties/AUM-WEB-000001/approve', '/api/crm/publish', '/api/crm/contacts', '/api/crm/shortlists']) {
    assert.equal((await injectHttp(server, { method: 'POST', url, headers: { 'x-aum-session': analyst.sessionId }, body: {} })).status, 403);
  }
  for (const url of ['/api/crm/properties/AUM-WEB-000001/approve', '/api/crm/publish']) {
    assert.equal((await injectHttp(server, { method: 'POST', url, headers: { 'x-aum-session': advisor.sessionId }, body: {} })).status, 403);
  }
  const denied = await injectHttp(server, { method: 'POST', url: '/api/crm/properties', headers: { 'x-aum-session': advisor.sessionId }, body: { property_id: 'AUM-TEST-APPROVE', listing_title: 'Synthetic approved', publication_state: 'approved_public' } });
  assert.equal(denied.status, 403);
  const imported = await injectHttp(server, { method: 'POST', url: '/api/crm/intake/import', headers: { 'x-aum-session': advisor.sessionId }, body: { format: 'json', dryRun: false, text: JSON.stringify([{ property_id: 'AUM-TEST-IMPORT', listing_title: 'Synthetic import', publication_state: 'approved_public' }]) } });
  assert.equal(imported.status, 200);
  assert.equal(db.prepare("SELECT publication_state FROM properties WHERE property_id='AUM-TEST-IMPORT'").get().publication_state, 'pending_approval');
});

test('Cookie-authenticated writes cannot bypass CSRF by supplying an invalid session header', async (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close()); const server = createAppServer(db);
  const session = testSession(db); const cookie = `aum_crm_sid=${session.sessionId}`;
  for (const url of ['/api/crm/contacts', '/api/crm/auth/logout']) {
    assert.equal((await injectHttp(server, { method: 'POST', url, headers: { cookie, 'x-aum-session': 'invalid' }, body: { full_name: 'Synthetic' } })).status, 403);
  }
  assert.equal((await injectHttp(server, { method: 'POST', url: '/api/crm/contacts', headers: { cookie, 'x-csrf-token': session.csrfToken }, body: { full_name: 'Synthetic' } })).status, 201);
  assert.equal((await injectHttp(server, { method: 'POST', url: '/api/crm/contacts', headers: { 'x-aum-session': session.sessionId }, body: { full_name: 'Synthetic API' } })).status, 201);
});

test('Failed promotion restores every previous file and manifest; a complete snapshot is retained', (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close()); const targetPaths = isolatedTargets(t);
  const baseline = compileAndPublishStaticFeeds(db, { targetPaths });
  const inventory = path.join(targetPaths.hostingerDataDir, 'public_inventory.json');
  const javascript = path.join(targetPaths.hostingerDataDir, 'public_inventory.js');
  const manifest = path.join(targetPaths.releasesDir, 'latest_manifest.json');
  const before = [inventory, javascript, manifest].map((p) => fs.readFileSync(p, 'utf8'));
  assert.ok(fs.existsSync(path.join(targetPaths.releasesDir, baseline.releaseId, 'snapshot.json')));
  db.prepare("UPDATE properties SET price_text='₹6.75 Cr' WHERE property_id='AUM-WEB-000134'").run();
  const rename = fs.renameSync;
  fs.renameSync = function (from, to) { if (to === javascript) throw new Error('Injected rename failure'); return rename.call(this, from, to); };
  try { assert.throws(() => compileAndPublishStaticFeeds(db, { targetPaths }), /Injected rename failure/); }
  finally { fs.renameSync = rename; }
  assert.deepEqual([inventory, javascript, manifest].map((p) => fs.readFileSync(p, 'utf8')), before);
  assert.ok(!fs.existsSync(path.join(targetPaths.releasesDir, 'pending.json')));
});

test('CLI rollback restores SQLite, survives rebuild, and refuses to overwrite later CRM edits', (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close()); const targetPaths = isolatedTargets(t);
  const { mutate, rollback } = require('../scripts/manage_inventory');
  const id = 'AUM-WEB-000134'; const old = db.prepare('SELECT * FROM properties WHERE property_id=?').get(id);
  mutate(db, { price_value: 6.75, price_unit: 'Cr', price_text: '₹6.75 Cr' }, id, { targetPaths });
  rollback(db, { targetPaths }); compileAndPublishStaticFeeds(db, { targetPaths });
  const restored = JSON.parse(fs.readFileSync(path.join(targetPaths.hostingerDataDir, 'public_inventory.json'))).find((x) => x.property_id === id);
  assert.equal(restored.price_text, old.price_text);
  mutate(db, { price_value: 7, price_text: '₹7 Cr' }, id, { targetPaths });
  db.prepare("UPDATE properties SET price_text='₹8 Cr' WHERE property_id=?").run(id);
  assert.throws(() => rollback(db, { targetPaths }), /changed after/);
});

test('Fresh operational seed excludes demo clients; featured identities and prices come from the master', (t) => {
  const db = openDatabase(':memory:'); t.after(() => db.close()); seedDatabaseIfEmpty(db);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM contacts').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM leads').get().c, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS c FROM properties WHERE publication_state!='approved_public'").get().c, 0);
  const targetPaths = isolatedTargets(t); compileAndPublishStaticFeeds(db, { targetPaths });
  const context = { window: {} }; require('node:vm').runInNewContext(fs.readFileSync(path.join(targetPaths.hostingerDataDir, 'approved_properties.js'), 'utf8'), context);
  for (const card of context.window.AUM_APPROVED_PROPERTIES) {
    const row = db.prepare('SELECT * FROM properties WHERE property_id=?').get(card.property_id);
    assert.equal(card.name, row.listing_title);
    assert.equal(card.price_text, require('./domain/normalizer').formatPublicPriceDisplay(row));
  }
  assert.equal(db.prepare("SELECT is_featured_approved FROM properties WHERE property_id='AUM-WEB-000142'").get().is_featured_approved, 0);
});

test('Lead client retries with one idempotency key and rejects unsuccessful acknowledgements', async () => {
  const vm = require('node:vm'); const code = fs.readFileSync(path.join(PATHS.hostingerDir, 'assets/lead-client.js'), 'utf8');
  const calls = []; let fail = false;
  const context = { window: {}, document: { addEventListener() {} }, location: { pathname: '/' }, AbortSignal, setTimeout: (fn) => fn(), console,
    fetch: async (_url, options) => { calls.push(JSON.parse(options.body)); return fail || calls.length === 1 ? { ok: false, status: 503, json: async () => ({ ok: false }) } : { ok: true, status: 201, json: async () => ({ ok: true, lead_id: 'TEST-LEAD' }) }; } };
  vm.runInNewContext(code, context);
  const result = await context.window.AUM_CAPTURE_INQUIRY({ client_name: 'Synthetic' });
  assert.equal(result.lead_id, 'TEST-LEAD'); assert.equal(calls.length, 2); assert.equal(calls[0].idempotency_key, calls[1].idempotency_key);
  await context.window.AUM_CAPTURE_INQUIRY({ client_name: 'Synthetic' }); assert.equal(calls.length, 2);
  fail = true; await assert.rejects(context.window.AUM_CAPTURE_INQUIRY({ client_name: 'Unavailable' }));
});

test('Interrupted publisher journal is recovered before any new release validation', (t) => {
  const targetPaths = isolatedTargets(t);
  const { withReleaseLock } = require('./domain/release_store');
  const target = path.join(targetPaths.hostingerDataDir, 'public_inventory.json');
  const before = path.join(targetPaths.releasesDir, 'before.json');
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.mkdirSync(targetPaths.releasesDir, { recursive: true });
  fs.writeFileSync(before, 'previous accepted release'); fs.writeFileSync(target, 'interrupted new release');
  fs.writeFileSync(path.join(targetPaths.releasesDir, 'pending.json'), JSON.stringify({ entries: [{ target, before }] }));
  assert.throws(() => withReleaseLock(targetPaths.releasesDir, () => { throw new Error('New candidate rejected'); }), /New candidate rejected/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'previous accepted release');
  assert.ok(!fs.existsSync(path.join(targetPaths.releasesDir, 'pending.json')));
  assert.ok(!fs.existsSync(path.join(targetPaths.releasesDir, '.publisher.lock')));
});

test('SQLite backup restores committed inventory and passes integrity and public projection checks', (t) => {
  const targetPaths = isolatedTargets(t); const original = openDatabase(':memory:');
  t.after(() => original.close()); seedDatabaseIfEmpty(original);
  const backup = path.join(targetPaths.releasesDir, 'restore.sqlite'); fs.mkdirSync(targetPaths.releasesDir, { recursive: true });
  original.prepare('VACUUM INTO ?').run(backup);
  const restored = openDatabase(backup); t.after(() => restored.close());
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  const release = compileAndPublishStaticFeeds(restored, { writeFiles: false });
  assert.equal(release.counts.publicProperties, seedCount);
});

test('Outer database transaction failure restores promoted files before releasing the writer lock', (t) => {
  const db = createSeededMemoryDb(); t.after(() => db.close()); const targetPaths = isolatedTargets(t);
  compileAndPublishStaticFeeds(db, { targetPaths });
  const file = path.join(targetPaths.hostingerDataDir, 'public_inventory.json'); const before = fs.readFileSync(file, 'utf8');
  assert.throws(() => require('./db/connection').withTransaction(db, () => {
    db.prepare("UPDATE properties SET price_text='₹6.75 Cr' WHERE property_id='AUM-WEB-000134'").run();
    compileAndPublishStaticFeeds(db, { targetPaths });
    assert.ok(fs.existsSync(path.join(targetPaths.releasesDir, '.publisher.lock')));
    throw new Error('Outer transaction failed');
  }), /Outer transaction failed/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.ok(!fs.existsSync(path.join(targetPaths.releasesDir, '.publisher.lock')));
  assert.ok(!fs.existsSync(path.join(targetPaths.releasesDir, 'pending.json')));
});

test('Recovery preserves a release whose SQLite audit record committed before process interruption', (t) => {
  const paths = isolatedTargets(t); const { withReleaseLock } = require('./domain/release_store');
  fs.mkdirSync(paths.releasesDir, { recursive: true });
  const target = path.join(paths.releasesDir, 'target'), before = path.join(paths.releasesDir, 'old');
  fs.writeFileSync(target, 'committed release'); fs.writeFileSync(before, 'old release');
  fs.writeFileSync(path.join(paths.releasesDir, 'pending.json'), JSON.stringify({ releaseId: 'COMMITTED', entries: [{ target, before }] }));
  withReleaseLock(paths.releasesDir, () => {}, (id) => id === 'COMMITTED');
  assert.equal(fs.readFileSync(target, 'utf8'), 'committed release');
  assert.ok(!fs.existsSync(path.join(paths.releasesDir, 'pending.json')));
});

test('Public copy is complete and free of exact unit identifiers, and floor reaches the buyer', () => {
  const {
    composePublicDescription, stripUnitCodes, containsUnitCode, formatFloorLabel, cleanListingTitle
  } = require('./domain/normalizer');
  const { ALLOWED_PUBLIC_FIELDS } = require('./config');

  // Exact unit identifiers are private; project, sector and tower names are not.
  assert.equal(cleanListingTitle('Vatika INXT City Centre C-205', null), 'Vatika INXT City Centre');
  assert.equal(stripUnitCodes('Unit C-302 at Shukrana Homes'), 'at Shukrana Homes');
  for (const keep of ['Sushant Lok-1 215 sq yd', 'Puri The Aravallis Sector 61 Tower B', 'DLF Phase 1 C9 lane', 'Sector 37C HUDA plot']) {
    assert.equal(containsUnitCode(keep), false, `must not strip "${keep}"`);
    assert.equal(stripUnitCodes(keep), keep);
  }

  // Floor is a buying criterion: it must survive the privacy gate.
  assert.ok(ALLOWED_PUBLIC_FIELDS.includes('floor_label'));
  assert.equal(formatFloorLabel('GF'), 'Ground Floor');
  assert.equal(formatFloorLabel('Ground'), 'Ground Floor');
  assert.equal(formatFloorLabel('1st'), '1st Floor');
  assert.equal(formatFloorLabel('Top Floor with Terrace'), 'Top Floor with Terrace');
  assert.equal(formatFloorLabel('2nd + roof right'), '2nd + roof right', 'compound labels stay verbatim');

  // Composed copy states only what the record already asserts.
  const desc = composePublicDescription({
    configuration: '4 BHK', property_type: 'Builder Floor', category: 'builder-floor',
    area_value: 350, area_unit: 'sq yd', locality: 'Sushant Lok 1', city: 'Gurgaon',
    corridor: 'Sushant Lok & Central Gurgaon', floor_label: 'GF', transaction_type: 'Sale'
  });
  assert.equal(desc, '4 BHK builder floor of 350 sq yd in Sushant Lok 1, Gurgaon. Ground Floor. Located on the Sushant Lok & Central Gurgaon corridor. Offered for sale.');
  for (const banned of [/\bwell[- ]maintained\b/i, /\bprime\b/i, /\bverified\b/i, /₹/]) {
    assert.ok(!banned.test(desc), `composed copy must not assert ${banned}`);
  }

  // Unresolved source values are left to the advisory desk, not published as fact.
  const conflicted = composePublicDescription({
    property_type: 'Plot', category: 'plot', area_value: 358.8, area_unit: 'sq yd',
    locality: 'South City 1', city: 'Gurgaon', transaction_type: 'Sale',
    facing: 'South East / North (conflicting source messages)'
  });
  assert.ok(!/conflicting|facing/i.test(conflicted), 'conflicting facing must be withheld');

  // No repeated nouns, place names or "Facing facing".
  assert.equal(
    composePublicDescription({
      configuration: 'Shop / Commercial Unit', property_type: 'Commercial', category: 'commercial',
      area_value: 500, area_unit: 'sq ft', locality: 'Malibu Town', sector: 'Malibu Town',
      city: 'Gurgaon', facing: 'West Facing', transaction_type: 'Lease'
    }),
    'Shop / Commercial Unit of 500 sq ft in Malibu Town, Gurgaon. West facing. Offered on lease.'
  );

  // Too little recorded to say anything truthful -> say nothing.
  assert.equal(composePublicDescription({ property_type: 'Apartment', category: 'apartment' }), '');
});

test('Every published mandate carries buyer-facing copy and no private unit identifier', () => {
  const feed = JSON.parse(fs.readFileSync(path.join(PATHS.hostingerDataDir, 'public_inventory.json'), 'utf8'));
  assert.ok(feed.length > 0);
  const blank = (v) => v == null || String(v).trim() === '';
  const missing = feed.filter((r) => blank(r.public_description));
  assert.equal(missing.length, 0, `published records without a description: ${missing.map((r) => r.property_id).join(', ')}`);
  const leaked = feed.filter((r) => /\b[A-Z]-\d{3,4}\b/.test(`${r.listing_title || ''} ${r.public_description || ''}`));
  assert.equal(leaked.length, 0, `published unit identifiers: ${leaked.map((r) => r.property_id).join(', ')}`);
  assert.ok(feed.some((r) => !blank(r.floor_label)), 'floor must reach the public feed');
});

test('A contentless enquiry is refused, while WhatsApp handoff tracking still records', async (t) => {
  const db = createSeededMemoryDb();
  t.after(() => db.close());
  const server = createAppServer(db);

  const post = (payload) => injectHttp(server, {
    method: 'POST', url: '/api/public/inquiries',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  const leadCount = () => db.prepare('SELECT COUNT(*) c FROM leads').get().c;

  // A bare POST used to create a lead named "Website Visitor" with no phone,
  // no email, no message and no property: unactionable, and easy to flood.
  const before = leadCount();
  const empty = await post({});
  assert.equal(empty.status, 400);
  assert.ok(/phone number|email|message|property/i.test(empty.json.error), empty.json.error);
  assert.equal(leadCount(), before, 'a refused enquiry must not create a lead');

  // The dossier's WhatsApp button posts without a phone; it carries the
  // property reference, so it must keep recording.
  const tracking = await post({ action: 'inquire_whatsapp', source: 'property_detail_view', property_id: 'AUM-WEB-000134' });
  assert.ok(tracking.status >= 200 && tracking.status < 300, `tracking rejected: ${tracking.status}`);
  assert.equal(leadCount(), before + 1);

  // Any one real signal is enough.
  for (const payload of [
    { name: 'Phone Only', phone: '+919811157000' },
    { name: 'Email Only', email: 'buyer@example.invalid' },
    { message: 'Looking for a 3 BHK on Golf Course Road' }
  ]) {
    const res = await post(payload);
    assert.ok(res.status >= 200 && res.status < 300, `${JSON.stringify(payload)} -> ${res.status}`);
  }
});

test('Operator input mistakes are reported as 400 with the reason, not as a 500', async (t) => {
  const db = createSeededMemoryDb();
  t.after(() => db.close());
  const server = createAppServer(db);

  const session = testSession(db, 'principal');
  const headers = { 'content-type': 'application/json', 'x-aum-session': session.sessionId };

  // An empty paste is the operator's mistake, not a server fault. It used to
  // surface as "Internal server error; please contact the advisory desk".
  for (const rawText of ['', '   ', undefined, 12345]) {
    const res = await injectHttp(server, {
      method: 'POST', url: '/api/crm/intake/whatsapp', headers,
      body: JSON.stringify(rawText === undefined ? {} : { rawText })
    });
    assert.equal(res.status, 400, `rawText=${JSON.stringify(rawText)} gave ${res.status}`);
    assert.ok(!/internal server error/i.test(res.json.error), `operator saw a server error: ${res.json.error}`);
    assert.ok(res.json.error.length > 0, 'the reason must reach the operator');
  }

  // A real paste still parses and still quarantines confidential terms.
  const ok = await injectHttp(server, {
    method: 'POST', url: '/api/crm/intake/whatsapp', headers,
    body: JSON.stringify({ rawText: '3BHK Pioneer Presidia Sec 62 2595 sqft 4.25 Cr owner Rakesh 9810012345 unit C-1203' })
  });
  assert.equal(ok.status, 200);
  const publicText = JSON.stringify(ok.json.publicDraft || {});
  assert.ok(!publicText.includes('9810012345'), 'owner phone leaked into the public draft');
  assert.ok(!publicText.includes('C-1203'), 'exact unit leaked into the public draft');
});
