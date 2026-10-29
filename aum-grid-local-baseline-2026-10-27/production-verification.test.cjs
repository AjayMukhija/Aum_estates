const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const distRoot = path.resolve(__dirname, 'dist');
const inventoryPath = path.join(distRoot, 'data', 'public_inventory.js');

test('public_inventory.js loads 347 sanitized records with zero privacy leaks', () => {
  assert.ok(fs.existsSync(inventoryPath), 'public_inventory.js must exist in dist/data');
  const code = fs.readFileSync(inventoryPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(code, sandbox);

  const inventory = sandbox.window.AUM_PUBLIC_INVENTORY;
  assert.ok(Array.isArray(inventory), 'AUM_PUBLIC_INVENTORY must be an array');
  assert.equal(inventory.length, 347, 'Inventory must contain exactly 347 verified records');

  // Verify privacy isolation
  const privatePhoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}\b/;
  const officialPhones = ['9873813595', '9811157018'];
  const leakKeywords = /\b(?:commission|brokerage|broker\s*cut|payout|\d{2}\s*[\/:]\s*\d{2}\s*(?:white|black)|owner\s*mob|owner\s*name)\b/i;

  inventory.forEach((item, idx) => {
    assert.ok(item.property_id, `Record #${idx} missing property_id`);
    assert.equal(item.status, 'Available', `Record ${item.property_id} must have Available status`);

    // Verify no unwhitelisted private keys exist
    assert.equal(item.owner_name, undefined, `Private key owner_name leaked in ${item.property_id}`);
    assert.equal(item.owner_contact, undefined, `Private key owner_contact leaked in ${item.property_id}`);
    assert.equal(item.internal_notes, undefined, `Private key internal_notes leaked in ${item.property_id}`);
    assert.equal(item.brokerage, undefined, `Private key brokerage leaked in ${item.property_id}`);

    // Scan text values for leak patterns
    Object.entries(item).forEach(([k, v]) => {
      if (typeof v === 'string') {
        if (leakKeywords.test(v)) {
          assert.fail(`Leak keyword matched in ${item.property_id} field ${k}: "${v}"`);
        }
        const phoneMatch = v.match(privatePhoneRegex);
        if (phoneMatch && !officialPhones.some(p => v.includes(p))) {
          assert.fail(`Private phone number matched in ${item.property_id} field ${k}: "${v}"`);
        }
      }
    });
  });
});

test('production runtime search engine clusters corridors and categories correctly', () => {
  const publicCode = fs.readFileSync(inventoryPath, 'utf8');
  const mainCode = fs.readFileSync(path.join(distRoot, 'main.js'), 'utf8');

  // Set up browser-like DOM environment for testing main.js
  const elements = new Map();
  function fakeElement(tag = 'div', id = '') {
    const listeners = new Map();
    const children = [];
    return {
      tagName: tag.toUpperCase(),
      id,
      innerHTML: '',
      textContent: '',
      hidden: false,
      value: '',
      options: [],
      dataset: {},
      classList: {
        add() {}, remove() {}, toggle() { return false; }
      },
      style: {},
      setAttribute() {},
      getAttribute() { return null; },
      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(fn);
      },
      trigger(name, evt = {}) {
        (listeners.get(name) || []).forEach(fn => fn(evt));
      },
      querySelector() { return null; },
      querySelectorAll(sel) {
      const parts = sel.split(',').map(s => s.trim().replace(/^#/, ''));
      const matched = [];
      for (const p of parts) {
        if (elements.has(p)) matched.push(elements.get(p));
      }
      return matched;
    },
      closest() { return null; }
    };
  }

  const ids = [
    'homeView', 'resultsView', 'locationsView', 'advisorView', 'aboutView',
    'resultsGrid', 'resultCount', 'mobileResultCount', 'emptyResults',
    'resultsTitle', 'activeChips', 'filterIntent', 'filterLocation',
    'filterType', 'filterBudget', 'sortResults', 'homeSearch', 'homeIntent',
    'homeLocation', 'menuToggle', 'mobileMenu', 'filterPanel', 'openFilters',
    'closeFilters', 'applyFilters', 'resetFilters', 'emptyReset', 'buyerContact',
    'ownerContact', 'businessContact', 'advisorKicker', 'advisorTitle',
    'advisorDescription', 'dismissRibbon'
  ];
  ids.forEach(id => elements.set(id, fakeElement('div', id)));

  const locationEl = elements.get('filterLocation');
  locationEl.options = [
    { value: '' }, { value: 'Golf Course Road' }, { value: 'DLF' },
    { value: 'Golf Course Ext Road' }, { value: 'Nirvana' },
    { value: 'Dwarka Expressway' }, { value: 'Sohna Road' }
  ];

  let currentURL = new URL('https://aumestates.com/#browse');
  const locationObj = {
    get href() { return currentURL.href; },
    get search() { return currentURL.search; },
    get pathname() { return currentURL.pathname; },
    get hash() { return currentURL.hash; }
  };
  const historyObj = {
    state: null,
    pushState(state, _title, url) { this.state = state; currentURL = new URL(url, currentURL); },
    replaceState(state, _title, url) { this.state = state; currentURL = new URL(url, currentURL); }
  };

  const domCallbacks = [];
  const doc = {
    documentElement: { dataset: {} },
    body: { classList: { toggle() {} }, style: {} },
    getElementById(id) { return elements.get(id) || null; },
    querySelector(sel) {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll(sel) {
      const parts = sel.split(',').map(s => s.trim().replace(/^#/, ''));
      const matched = [];
      for (const p of parts) {
        if (elements.has(p)) matched.push(elements.get(p));
      }
      return matched;
    },
    addEventListener(name, fn) {
      if (name === 'DOMContentLoaded') domCallbacks.push(fn);
    }
  };

  const sandbox = {
    window: {
      location: locationObj,
      history: historyObj,
      addEventListener() {},
      dispatchEvent() {},
      scrollTo() {}
    },
    document: doc,
    location: locationObj,
    history: historyObj,
    URL,
    URLSearchParams,
    CustomEvent: class { constructor(name, d) { this.name = name; this.detail = d.detail; } }
  };

  // Evaluate public inventory and main.js
  vm.runInNewContext(publicCode, sandbox);
  assert.equal(sandbox.window.AUM_PUBLIC_INVENTORY.length, 347, 'Inventory in window must be 347 items');
  vm.runInNewContext(mainCode, sandbox);
  domCallbacks.forEach(fn => {
    try { fn(); } catch(e) { console.error('DOM CALLBACK ERROR:', e); }
  });

  // Verify WhatsApp format & CRM hook exists
  assert.equal(typeof sandbox.window.AUM_CRM_HOOK, 'function', 'AUM_CRM_HOOK must be defined globally');

  // Verify property card markup contains correct prefilled WhatsApp format
  const gridHtml = elements.get('resultsGrid').innerHTML;
  assert.ok(gridHtml.length > 0, 'Results grid should have rendered property cards');
  assert.ok(gridHtml.includes('Hi%20Ajay%2C%20I%20am%20interested%20in'), 'Cards must have pre-filled WhatsApp link starting with "Hi Ajay, I am interested in"');
  assert.ok(gridHtml.includes('properties%2Fdetail.html%3Fid%3D') || gridHtml.includes('properties/detail.html?id='), 'Cards must have links to properties/detail.html?id=...');
  assert.ok(gridHtml.includes('data-property-id='), 'Cards must have CRM hook data-property-id');
  assert.ok(gridHtml.includes('data-title='), 'Cards must have CRM hook data-title');

  // Verify result count is exactly 305 for default "buy"
  const countText = elements.get('resultCount').textContent;
  assert.ok(countText.includes('verified properties'), `Result count string should mention verified properties: ${countText}`);
  assert.equal(countText, '305 verified properties', 'Default buy view must show 305 properties');

  // Test corridor filtering: Golf Course Road
  const locSelect = elements.get('filterLocation');
  locSelect.value = 'Golf Course Road';
  locSelect.trigger('change');
  const gcrCount = elements.get('resultCount').textContent;
  assert.ok(gcrCount.includes('verified properties'));
  assert.equal(elements.get('resultsGrid').hidden, false);
  const gcrNum = parseInt(gcrCount, 10);
  assert.ok(gcrNum >= 10 && gcrNum <= 30, `Golf Course Road corridor should yield 10-30 properties (got ${gcrNum})`);

  // Test corridor filtering: DLF
  locSelect.value = 'DLF';
  locSelect.trigger('change');
  const dlfCount = elements.get('resultCount').textContent;
  const dlfNum = parseInt(dlfCount, 10);
  assert.ok(dlfNum >= 50, `DLF corridor should yield 50+ properties (got ${dlfNum})`);

  // Test corridor filtering: Golf Course Ext Road
  locSelect.value = 'Golf Course Ext Road';
  locSelect.trigger('change');
  const extCount = elements.get('resultCount').textContent;
  const extNum = parseInt(extCount, 10);
  assert.ok(extNum >= 40, `Golf Course Ext corridor should yield 40+ properties (got ${extNum})`);

  // Reset location
  locSelect.value = '';
  locSelect.trigger('change');

  // Test Category Filtering: Builder Floors
  const typeSelect = elements.get('filterType');
  typeSelect.value = 'builder-floor';
  typeSelect.trigger('change');
  const bfCount = elements.get('resultCount').textContent;
  const bfNum = parseInt(bfCount, 10);
  assert.ok(bfNum >= 45, `Builder floors must yield 45+ properties (got ${bfNum})`);

  // Test Category Filtering: Plots & Land
  typeSelect.value = 'plot';
  typeSelect.trigger('change');
  const plotCount = elements.get('resultCount').textContent;
  const plotNum = parseInt(plotCount, 10);
  assert.ok(plotNum >= 80, `Plots must yield 80+ properties (got ${plotNum})`);

  // Reset type
  typeSelect.value = '';
  typeSelect.trigger('change');

  // Test Budget Filtering: < 3 Cr
  const budgetSelect = elements.get('filterBudget');
  budgetSelect.value = '< 3 Cr';
  budgetSelect.trigger('change');
  const under3Count = elements.get('resultCount').textContent;
  const under3Num = parseInt(under3Count, 10);
  assert.ok(under3Num > 0, `Under 3 Cr should yield properties (got ${under3Num})`);

  // Test Budget Filtering: 7–15 Cr
  budgetSelect.value = '7–15 Cr';
  budgetSelect.trigger('change');
  const midCount = elements.get('resultCount').textContent;
  const midNum = parseInt(midCount, 10);
  assert.ok(midNum > 0, `7-15 Cr should yield properties (got ${midNum})`);
});

test('index.html semantic integrity, RERA credentials, and direct advisory phone verification', () => {
  const indexHtml = fs.readFileSync(path.join(distRoot, 'index.html'), 'utf8');

  // Verify direct advisory CTA tel:+919811157018
  assert.ok(indexHtml.includes('tel:+919811157018'), 'index.html must include direct advisory call link tel:+919811157018');
  assert.ok(indexHtml.includes('98111 57018'), 'index.html must display Ajay Mukhija direct phone number');

  // Verify WhatsApp desk links
  assert.ok(indexHtml.includes('https://wa.me/919873813595'), 'index.html must route WhatsApp desk inquiries to 919873813595');

  // Verify RERA & advisory credentials
  assert.ok(indexHtml.includes('Haryana RERA Registered'), 'index.html must display Haryana RERA credentials');
  assert.ok(indexHtml.includes('Ajay Mukhija'), 'index.html must display founder Ajay Mukhija');
  assert.ok(indexHtml.includes('C-210, Nirvana Courtyard'), 'index.html must display Nirvana Courtyard office address');

  // Verify data script loading
  assert.ok(indexHtml.includes('data/public_inventory.js'), 'index.html must load data/public_inventory.js');
});

test('properties/detail.js and inventory-search.js CRM hook & lead engine verification', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const hostingerDir = path.join(repoRoot, 'AUM_ESTATES_Website_For_Hostinger');
  const detailJs = fs.readFileSync(path.join(hostingerDir, 'properties', 'detail.js'), 'utf8');
  const searchJs = fs.readFileSync(path.join(hostingerDir, 'data', 'inventory-search.js'), 'utf8');
  const contactHtml = fs.readFileSync(path.join(hostingerDir, 'contact', 'index.html'), 'utf8');
  const htaccess = fs.readFileSync(path.join(hostingerDir, '.htaccess'), 'utf8');

  // 1. Verify detail.js CRM hook and WhatsApp format
  assert.ok(detailJs.includes('window.AUM_CRM_HOOK'), 'detail.js must define or call window.AUM_CRM_HOOK');
  assert.ok(detailJs.includes('Hi Ajay, I am interested in'), 'detail.js must construct high-intent WhatsApp text');
  assert.ok(detailJs.includes('https://wa.me/919873813595'), 'detail.js must route to official WhatsApp desk');

  // 2. Verify inventory-search.js CRM hook and data attributes
  assert.ok(searchJs.includes('window.AUM_CRM_HOOK'), 'inventory-search.js must define or call window.AUM_CRM_HOOK');
  assert.ok(searchJs.includes('data-property-id='), 'inventory-search.js result cards must include data-property-id');
  assert.ok(searchJs.includes('data-title='), 'inventory-search.js result cards must include data-title');

  // 3. Verify contact/index.html CRM hook and direct phone routing
  assert.ok(contactHtml.includes('window.AUM_CRM_HOOK'), 'contact page must dispatch CRM hook on form submission');
  assert.ok(contactHtml.includes('tel:+919811157018'), 'contact page must route direct calls to Ajay Mukhija (+91 98111 57018)');

  // 4. Verify .htaccess blocks .env and dotfiles
  assert.ok(htaccess.includes('env'), '.htaccess must block .env files');
  assert.ok(htaccess.includes('X-Frame-Options'), '.htaccess must set clickjacking protection');
  assert.ok(htaccess.includes('Strict-Transport-Security'), '.htaccess must enforce HSTS');
});


