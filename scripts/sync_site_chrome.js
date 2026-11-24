#!/usr/bin/env node
/* ==========================================================================
   Site chrome — one header, one drawer, one footer for every page.

   The site is hand-written static HTML, and the header and footer used to be
   copied into each of nine pages. The copies had drifted: the active state
   was set on four pages and missing on five, the 404 marked "Home" as the
   current page, and every page carried its own copy of the drawer script.

   This script is the single source for that markup. It rewrites the
   <header class="header">…</header> and <footer class="footer">…</footer>
   blocks of each page in place, with the right path prefix and current
   section, and makes sure the shared behaviour script is loaded. Nothing
   else on the page is touched, so it is safe to re-run after editing the
   template below:

     node scripts/sync_site_chrome.js
   ========================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'AUM_ESTATES_Website_For_Hostinger');
const ASSET_VERSION = '20261123e';

// page → [path prefix, current section]
const PAGES = {
  'index.html': ['', 'home'],
  '404.html': ['/', ''],
  'about/index.html': ['../', 'about'],
  'contact/index.html': ['../', 'contact'],
  'locations/index.html': ['../', 'locations'],
  'projects/index.html': ['../', 'projects'],
  'properties/index.html': ['../', 'properties'],
  'properties/detail.html': ['../', 'properties'],
  'approved-properties/index.html': ['../', 'properties']
};

const PHONE_PRINCIPAL = { tel: '+919667080041', label: '+91 96670 80041' };
const PHONE_DESK = { tel: '+919873813595', label: '+91 98738 13595' };
const PHONE_DESK_2 = { tel: '+919266833220', label: '+91 92668 33220' };
const WHATSAPP = 'https://wa.me/919873813595?text=Hello%20AUM%20ESTATES,%20I%20would%20like%20to%20enquire%20about%20private%20property%20advisory%20in%20Gurgaon.';

// Information architecture. Properties is a simple list; Locations is the
// one grouped panel, because six corridors with a line each is genuinely a
// directory. New Projects, About and Contact are single destinations, so
// they are plain links rather than one- or two-item menus.
const PROPERTY_LINKS = [
  ['properties/index.html?mode=buy', 'Residences for sale', 'Apartments, penthouses and villas'],
  ['properties/index.html?category=builder-floor', 'Builder floors', 'Independent floors across DLF Phase 1–5'],
  ['properties/index.html?category=plot', 'Plots & land', 'HSVP and DLF residential plots'],
  ['properties/index.html?category=commercial', 'Commercial', 'Pre-leased assets, offices and retail'],
  ['properties/index.html?mode=rent', 'Rent & lease', 'Executive and corporate leasing']
];

const CORRIDORS = [
  ['Golf Course Road', 'Golf Course Road', 'DLF 5 · Aralias, Magnolias, Park Place'],
  ['DLF Phase 1–5', 'DLF Phase 1–5', 'Gated builder floors and plots'],
  ['Golf Course Ext & SPR', 'Golf Course Extn & SPR', 'Sectors 58–68 · Elevate, Arbour'],
  ['Nirvana Country & Sohna Road', 'Nirvana Country & Sohna Road', 'Sector 50 villas and townships'],
  ['Dwarka Expressway & New Gurgaon', 'Dwarka Expressway', 'Airport corridor · Sectors 99–113'],
  ['Sushant Lok & Central Gurgaon', 'Sushant Lok & Central', 'Established central enclaves']
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corridorHref = (value) => `properties/index.html?location=${encodeURIComponent(value).replace(/%20/g, '+')}`;

const ICON_CHEVRON = '<svg class="nav-chevron" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_SEARCH = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="8.75" cy="8.75" r="5.75" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m13.2 13.2 4.3 4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path class="menu-icon-top" d="M4 8h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="menu-icon-bottom" d="M4 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function header(prefix, current) {
  const p = (href) => prefix + href;
  const cur = (key) => (key === current ? ' aria-current="page"' : '');
  const isCur = (key) => (key === current ? ' is-current' : '');

  const propertyItems = PROPERTY_LINKS.map(([href, title, note]) => `
              <li><a class="nav-panel-link" href="${p(esc(href))}"><span class="nav-panel-title">${esc(title)}</span><span class="nav-panel-note">${esc(note)}</span></a></li>`).join('');

  const corridorItems = CORRIDORS.map(([value, title, note]) => `
                <li><a class="nav-panel-link" href="${p(esc(corridorHref(value)))}"><span class="nav-panel-title">${esc(title)}</span><span class="nav-panel-note">${esc(note)}</span></a></li>`).join('');

  const drawerProperties = PROPERTY_LINKS.map(([href, title]) => `
            <li><a href="${p(esc(href))}">${esc(title)}</a></li>`).join('');
  const drawerCorridors = CORRIDORS.map(([value, title]) => `
            <li><a href="${p(esc(corridorHref(value)))}">${esc(title)}</a></li>`).join('');

  return `<header class="header">
    <div class="container nav">
      <a class="brand-lockup" href="${p('index.html')}" aria-label="AUM ESTATES home">
        <span class="brand-name">AUM ESTATES</span>
        <span class="brand-tagline">Private Advisory · Est. 2002</span>
      </a>

      <nav class="menu" aria-label="Main">
        <ul class="menu-list">
          <li class="nav-item nav-menu${isCur('properties')}" data-nav-menu>
            <button type="button" class="nav-link nav-trigger" aria-expanded="false" aria-controls="nav-panel-properties" data-nav-trigger>Properties ${ICON_CHEVRON}</button>
            <div class="nav-panel" id="nav-panel-properties" data-nav-panel>
              <ul class="nav-panel-list">${propertyItems}
              </ul>
              <a class="nav-panel-foot" href="${p('properties/index.html')}"${cur('properties')}>View all properties <span aria-hidden="true">→</span></a>
            </div>
          </li>
          <li class="nav-item nav-menu${isCur('locations')}" data-nav-menu>
            <button type="button" class="nav-link nav-trigger" aria-expanded="false" aria-controls="nav-panel-locations" data-nav-trigger>Locations ${ICON_CHEVRON}</button>
            <div class="nav-panel nav-panel-wide" id="nav-panel-locations" data-nav-panel>
              <p class="nav-panel-label">Gurgaon corridors</p>
              <ul class="nav-panel-list nav-panel-grid">${corridorItems}
              </ul>
              <a class="nav-panel-foot" href="${p('locations/index.html')}"${cur('locations')}>Location guide: all micro-markets <span aria-hidden="true">→</span></a>
            </div>
          </li>
          <li class="nav-item${isCur('projects')}"><a class="nav-link" href="${p('projects/index.html')}"${cur('projects')}>New Projects</a></li>
          <li class="nav-item${isCur('about')}"><a class="nav-link" href="${p('about/index.html')}"${cur('about')}>About</a></li>
          <li class="nav-item${isCur('contact')}"><a class="nav-link" href="${p('contact/index.html')}"${cur('contact')}>Contact</a></li>
        </ul>
      </nav>

      <div class="actions">
        <a class="header-icon-btn" href="${p('properties/index.html?focus=search')}" aria-label="Search properties">${ICON_SEARCH}</a>
        <a class="header-phone tabular-nums" href="tel:${PHONE_PRINCIPAL.tel}">${PHONE_PRINCIPAL.label}</a>
        <a class="header-cta" href="${WHATSAPP}" target="_blank" rel="noopener"><span class="header-cta-long">Speak to an advisor</span><span class="header-cta-short">Enquire</span></a>
        <button type="button" class="menu-toggle" aria-expanded="false" aria-controls="site-drawer" aria-label="Open menu" data-drawer-toggle>${ICON_MENU}</button>
      </div>
    </div>

    <div class="drawer" id="site-drawer" hidden data-drawer>
      <div class="container drawer-body">
        <form class="drawer-search" action="${p('properties/index.html')}" method="GET" role="search">
          <label class="visually-hidden" for="drawer-search-input">Search properties</label>
          <input id="drawer-search-input" name="q" type="search" placeholder="Project, sector or corridor" autocomplete="off" />
          <button type="submit" aria-label="Search">${ICON_SEARCH}</button>
        </form>

        <ul class="drawer-list">
          <li>
            <details class="drawer-group"${current === 'properties' ? ' open' : ''}>
              <summary${isCur('properties') ? ' class="is-current"' : ''}>Properties</summary>
              <ul>${drawerProperties}
                <li><a class="drawer-all" href="${p('properties/index.html')}">View all properties</a></li>
              </ul>
            </details>
          </li>
          <li>
            <details class="drawer-group"${current === 'locations' ? ' open' : ''}>
              <summary${isCur('locations') ? ' class="is-current"' : ''}>Locations</summary>
              <ul>${drawerCorridors}
                <li><a class="drawer-all" href="${p('locations/index.html')}">Location guide</a></li>
              </ul>
            </details>
          </li>
          <li><a class="drawer-link${isCur('projects')}" href="${p('projects/index.html')}"${cur('projects')}>New Projects</a></li>
          <li><a class="drawer-link${isCur('about')}" href="${p('about/index.html')}"${cur('about')}>About</a></li>
          <li><a class="drawer-link${isCur('contact')}" href="${p('contact/index.html')}"${cur('contact')}>Contact</a></li>
        </ul>

        <div class="drawer-actions">
          <a class="btn" href="${WHATSAPP}" target="_blank" rel="noopener">WhatsApp the advisory desk</a>
          <a class="btn-secondary btn-call" href="tel:${PHONE_PRINCIPAL.tel}"><span>Call Ajay Mukhija</span><span class="btn-call-number tabular-nums">${PHONE_PRINCIPAL.label}</span></a>
        </div>
        <p class="drawer-address">C-210, Nirvana Courtyard, Sector 50, Gurgaon</p>
      </div>
    </div>
  </header>`;
}

function footer(prefix) {
  const p = (href) => prefix + href;
  const corridorLinks = CORRIDORS.map(([value, title]) => `
          <li><a href="${p(esc(corridorHref(value)))}">${esc(title)}</a></li>`).join('');

  return `<footer class="footer">
    <div class="container footergrid">
      <div class="footer-about">
        <div class="footer-brand">AUM ESTATES</div>
        <div class="footer-tagline">Private Property Advisory · Gurgaon</div>
        <address>C-210, Nirvana Courtyard, Nirvana Country,<br/>Sector 50, Gurgaon, Haryana 122018</address>
        <p class="footer-compliance">Haryana RERA registered brokerage. Independent real estate advisory serving Gurgaon, Golf Course Road and Delhi NCR since 2002.</p>
      </div>

      <nav aria-label="Properties">
        <h3>Properties</h3>
        <ul>
          <li><a href="${p('properties/index.html?mode=buy')}">Residences for sale</a></li>
          <li><a href="${p('properties/index.html?category=builder-floor')}">Builder floors</a></li>
          <li><a href="${p('properties/index.html?category=plot')}">Plots &amp; land</a></li>
          <li><a href="${p('properties/index.html?category=commercial')}">Commercial</a></li>
          <li><a href="${p('properties/index.html?mode=rent')}">Rent &amp; lease</a></li>
          <li><a href="${p('projects/index.html')}">New projects</a></li>
        </ul>
      </nav>

      <nav aria-label="Locations">
        <h3>Locations</h3>
        <ul>${corridorLinks}
          <li><a href="${p('locations/index.html')}">Location guide</a></li>
        </ul>
      </nav>

      <div>
        <h3>Contact</h3>
        <ul>
          <li><a class="tabular-nums" href="tel:${PHONE_PRINCIPAL.tel}"><span class="footer-meta">Ajay Mukhija</span>${PHONE_PRINCIPAL.label}</a></li>
          <li><a class="tabular-nums" href="tel:${PHONE_DESK.tel}"><span class="footer-meta">Advisory desk &amp; WhatsApp</span>${PHONE_DESK.label}</a></li>
          <li><a class="tabular-nums" href="tel:${PHONE_DESK_2.tel}"><span class="footer-meta">Advisory desk</span>${PHONE_DESK_2.label}</a></li>
          <li><a href="https://wa.me/919873813595" target="_blank" rel="noopener">WhatsApp</a></li>
          <li><a href="${p('contact/index.html')}">Office &amp; directions</a></li>
          <li><a href="${p('about/index.html')}">About the advisory</a></li>
          <li><a href="${p('about/index.html#diligence')}">Verification protocol</a></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="powered">
        <span>© 2002–2026 AUM ESTATES. All rights reserved.</span>
        <span>Haryana RERA compliant · Gurgaon, Haryana</span>
      </div>
    </div>
  </footer>`;
}

let failures = 0;
for (const [rel, [prefix, current]] of Object.entries(PAGES)) {
  const file = path.join(SITE, rel);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  if (!/<header class="header">[\s\S]*?<\/header>/.test(html)) { console.error(`[chrome] no header in ${rel}`); failures++; continue; }
  if (!/<footer class="footer">[\s\S]*?<\/footer>/.test(html)) { console.error(`[chrome] no footer in ${rel}`); failures++; continue; }

  html = html.replace(/[ \t]*<header class="header">[\s\S]*?<\/header>/, '  ' + header(prefix, current));
  html = html.replace(/[ \t]*<footer class="footer">[\s\S]*?<\/footer>/, '  ' + footer(prefix));

  // Shared behaviour: loaded deferred, right after the motion engine.
  const siteJs = `${prefix}assets/site.js?v=${ASSET_VERSION}`;
  html = html.replace(/[ \t]*<script src="[^"]*assets\/site\.js[^"]*"[^>]*><\/script>\n?/g, '');
  html = html.replace(/([ \t]*)(<script src="[^"]*assets\/motion\.js[^"]*"><\/script>)/, `$1$2\n$1<script src="${siteJs}" defer></script>`);

  // Bust the cache on every versioned asset so the new CSS and markup ship together.
  html = html.replace(/\?v=2026\d{4}[a-z]?/g, `?v=${ASSET_VERSION}`);

  if (!html.includes('assets/site.js')) { console.error(`[chrome] could not place site.js in ${rel}`); failures++; continue; }

  if (html !== before) {
    fs.writeFileSync(file, html);
    console.log(`[chrome] updated ${rel}`);
  } else {
    console.log(`[chrome] unchanged ${rel}`);
  }
}

if (failures) process.exit(1);
