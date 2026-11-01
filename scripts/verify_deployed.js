#!/usr/bin/env node
'use strict';

// Read-only acceptance checks. This command never creates a real lead.
const base = process.argv[2] || process.env.AUM_PUBLIC_ORIGIN;
if (!base || new URL(base).protocol !== 'https:') throw new Error('Provide the HTTPS origin: npm run verify:deployed -- https://aumestates.com');
const checks = [
  ['/', 200], ['/api/public/health', 200], ['/api/public/properties?limit=1', 200],
  ['/api/crm/dashboard', 401], ['/crm/', 200], ['/data/public_inventory.json', 200],
  ['/data/aum_inventory_local.json', 404], ['/data/inventory_data_meta.json', 404],
  ['/private_master_store/aum_inventory_local.json', 404], ['/.git/config', 404], ['/.env', 404]
];
(async () => {
  let failures = 0;
  for (const [route, expected] of checks) {
    try {
      const res = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000), redirect: 'manual' });
      const denied = expected === 404 && [403, 404].includes(res.status);
      let ok = denied || res.status === expected;
      if (route === '/') ok &&= !!res.headers.get('strict-transport-security') && res.headers.get('x-content-type-options') === 'nosniff' && !!res.headers.get('x-frame-options');
      if (route === '/api/public/health') { const data = await res.json(); ok &&= data.ok === true && data.publicMandates > 0; }
      if (route.startsWith('/api/public/properties')) { const data = await res.json(); ok &&= data.ok === true && Array.isArray(data.items) && data.items.length === 1; }
      if (route === '/data/public_inventory.json') {
        const cache = res.headers.get('cache-control') || '';
        ok &&= /no-cache|no-store|max-age=(?:[0-5]?\d?\d|600)(?:\D|$)/.test(cache);
      }
      console.log(`${ok ? 'PASS' : 'FAIL'} ${route} (${res.status})`);
      if (!ok) failures++;
    } catch (err) { console.log(`FAIL ${route}: ${err.message}`); failures++; }
  }
  process.exitCode = failures ? 1 : 0;
})().catch((err) => { console.error(err.message); process.exitCode = 1; });
