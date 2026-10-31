/**
 * AUM ESTATES — Architectural Grid Production Client Engine
 * High-performance, buildless runtime for 347 verified Gurgaon properties.
 * Zero data leak guarantee · High-converting WhatsApp & Advisory CTAs.
 * Est. 2002 by Ajay Mukhija · C-210 Nirvana Courtyard, Sector 50, Gurgaon
 */

(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const ADVISORY_PHONE = '+919811157018';
  const WHATSAPP_DESK = '919873813595';

  const state = {
    intent: 'buy',
    location: '',
    type: '',
    budget: '',
    sort: 'default',
    q: ''
  };

  // Structured CRM Hook for Master SQLite CRM, client intake bot, and event listeners
  window.AUM_CRM_HOOK = function (actionOrPayload, maybePayload) {
    const detail = (typeof actionOrPayload === 'string')
      ? Object.assign({ action: actionOrPayload, timestamp: new Date().toISOString() }, maybePayload || {})
      : Object.assign({ timestamp: new Date().toISOString() }, actionOrPayload || {});
    try {
      if (typeof window._AUM_CRM_LISTENER === 'function') {
        window._AUM_CRM_LISTENER(detail);
      }
      window.dispatchEvent(new CustomEvent('aum:lead', { detail }));
      window.dispatchEvent(new CustomEvent('aum:lead_inquiry', {
        detail: { action: detail.action, payload: detail, timestamp: detail.timestamp }
      }));
      const act = String(detail.action || '');
      if ((act === 'inquire_whatsapp' || act === 'register_mandate' || act === 'advisor_inquiry') && typeof fetch === 'function') {
        const href = String((window.location && window.location.href) || '');
        if (/^https?:\/\//i.test(href)) {
          fetch('/api/public/inquiries', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_name: detail.name || detail.client_name || 'Website Visitor',
              client_phone: detail.phone || detail.client_phone || null,
              preferred_location: detail.corridor || detail.location || 'Gurugram',
              budget_text: detail.budget || detail.price || null,
              property_id: detail.property_id || null,
              source_channel: act,
              source_page: detail.source || 'architectural_grid_06',
              message: detail.notes || (detail.title ? `Inquiry regarding ${detail.title} (${detail.property_id || 'Web'})` : null)
            })
          }).catch(() => {});
        }
      }
    } catch (e) {}
  };

  function getInventory() {
    if (typeof window !== 'undefined' && Array.isArray(window.AUM_PUBLIC_INVENTORY) && window.AUM_PUBLIC_INVENTORY.length > 0) {
      return window.AUM_PUBLIC_INVENTORY;
    }
    if (typeof window !== 'undefined' && Array.isArray(window.AUM_DEV_INVENTORY) && window.AUM_DEV_INVENTORY.length > 0) {
      return window.AUM_DEV_INVENTORY;
    }
    return [];
  }

  function safeText(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function norm(str) {
    return String(str ?? '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9+]+/g, ' ').trim();
  }

  function cleanTitle(s) {
    if (!s) return 'Featured Gurgaon Residence';
    return String(s)
      .replace(/\s+MP$/i, '')
      .replace(/\s+OC tower$/i, ' (OC Received)')
      .replace(/\s+#\d+$/i, '')
      .replace(/\s*;\s*1%\s*brokerage.*$/i, '')
      .trim();
  }

  function locationLabel(o) {
    return [o.locality, o.sector, o.city]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');
  }

  function areaLabel(o) {
    return o.area_value ? `${o.area_value} ${o.area_unit || ''}`.trim() : '';
  }

  function money(v) {
    if (v == null || v === '') return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(n % 10000000 ? 2 : 0)} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} Lakh`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  function sanitizePriceText(pt) {
    if (!pt) return '';
    const s = String(pt).trim();
    if (/^(mp|market\s*rates?)$/i.test(s)) return 'Market Price on Request';
    if (/confirm\s*unit|keys\s*in\s*hand|max\s*cheque|no\s*premium|price\s*not\s*supplied|verify|differ/i.test(s)) {
      return 'Price on Request';
    }
    if (/^price\s*on\s*call/i.test(s)) return 'Price on Request';
    return s;
  }

  function priceLabel(o) {
    if (o.transaction_type && /rent|lease/i.test(o.transaction_type) && o.rent_value) {
      return `${money(o.rent_value)} / month`;
    }
    if (o.price_text) {
      const sanitized = sanitizePriceText(o.price_text);
      if (sanitized) return sanitized;
    }
    if (o.price_value != null) {
      const unit = String(o.price_unit || '').toLowerCase();
      if (unit.includes('per sq')) return `${money(o.price_value)} / ${o.price_unit.replace(/per\s*/i, '')}`;
      if (unit.includes('crore') || unit === 'cr') return `₹${o.price_value} Cr`;
      if (unit.includes('lakh') || unit.includes('lac')) return `₹${o.price_value} Lakh`;
      return money(o.price_value);
    }
    return 'Price on Request';
  }

  function representativeCategory(o) {
    const p = String(o.property_type || '').toLowerCase().trim();
    const c = String(o.configuration || '').toLowerCase().trim();
    const title = String([o.listing_title, o.website_display_name, o.project_name, o.key_features].filter(Boolean).join(' ')).toLowerCase();
    const combined = `${p} ${c}`;

    if (/\bplots?\b|\bland\b/.test(title) || /\bplots?\b|\bland\b/.test(combined)) return 'plot';
    if (/villa|house|kothi/.test(p)) return 'villa';
    if (/farmhouse/.test(p) || /farmhouse/.test(c)) return 'farmhouse';
    if (/builder\s*floor|\bfloor\b/.test(p)) return 'builder-floor';
    if (/apartment|flat|condo/.test(p)) return 'apartment';
    if (/guest\s*house|hotel|hospitality/.test(combined)) return 'commercial';
    if (/commercial/.test(p) || /office|shop|retail|industrial|building/.test(p)) {
      if (/shop|retail/.test(c)) return 'shop';
      if (/office/.test(c) && !/building\s*\/\s*office\s*building/.test(c)) return 'office';
      if (/building\s*\/\s*office\s*building|office\s*building|building/.test(c)) return 'building';
      if (/industrial|factory|warehouse/.test(combined)) return 'commercial';
      if (/office/.test(p)) return 'office';
      return 'commercial';
    }
    if (/villa|house|kothi|farmhouse/.test(combined)) return 'villa';
    if (/builder\s*floor|\bfloor\b/.test(combined)) return 'builder-floor';
    if (/apartment|flat/.test(combined)) return 'apartment';
    return 'apartment';
  }

  function representativeImage(o) {
    const c = representativeCategory(o);
    if (c === 'plot') return 'plot-land-user.jpg';
    const name = String([o.listing_title, o.website_display_name, o.project_name, o.locality, o.micro_location, o.sector, o.public_description, o.key_features].join(' ')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    const projectImages = [
      [/sector 46 guest house|guest house/.test(name), 'commercial.jpg'],
      [/asya smartliving|sukoon/.test(name), 'sukoon-asya-project-photo.png'],
      [/puri the aravallis|puri aravallis/.test(name), 'puri-the-aravalis.jpg'],
      [/privana|privana south|privana north/.test(name), 'privana.jpg'],
      [/sobha aranya/.test(name), 'sobha-aranya.jpg'],
      [/indiabulls enigma/.test(name), 'indiabulls-enigma.jpg'],
      [/paras irene/.test(name), 'paras-irene.jpg'],
      [/eldeco mansionz|eldeco mansions/.test(name), 'eldeco-mansionz.jpg'],
      [/uniworld garden 1|uniworld garden-1/.test(name), 'uniworld-garden-1.jpg'],
      [/tata raisina/.test(name), 'tata-raisina.webp'],
      [/paras the florett|paras the florett enqlve/.test(name), 'paras-the-florett.jpg'],
      [/ireo uptown/.test(name), 'ireo-uptown.jpg'],
      [/the aspen|aspen green/.test(name), 'the-aspen.webp'],
      [/pioneer araya|araya/.test(name), 'pioneer-araya.jpg'],
      [/smartworld sky arc/.test(name), 'smartworld-sky-arc.webp'],
      [/harmony/.test(name), 'harmony.jpg'],
      [/urban oasis/.test(name), 'urban-oasis.jpg'],
      [/palm terrace select|palm terraces select/.test(name), 'palm-terrace-select.jpeg'],
      [/pioneer presidia|pioneer presidia/.test(name), 'pioneer-presidia.jpg'],
      [/ridgewood estate|rigdewood estate/.test(name), 'ridgewood-estate.jpg'],
      [/arrossim|south goa/.test(name), 'arrossim.jpg'],
      [/sushant lok 1 a block 350 sq yd upper ground|sushant-lok-1-a-block-350-sq-yd-upper-ground/.test(name), 'sushant-lok-1-a-block-350-upper-ground.jpg'],
      [/shukrana homes|shukrana-homes/.test(name), 'shukrana-homes.jpg'],
      [/sushant lok.*plot|plot.*sushant lok/.test(name), 'sushant-lok-plot.jpg'],
      [/sushant lok/.test(name), 'sushant-lok.jpg'],
      [/m3m capital 113|m3m capital/.test(name), 'm3m-capital-113.webp'],
      [/south city 2/.test(name), 'south-city-2.jpg'],
      [/close north/.test(name), 'close-north.jpg'],
      [/close south/.test(name), 'close-south.jpg'],
      [/vipul world/.test(name), 'vipul-world.jpg'],
      [/godrej meridian|godrej meridien/.test(name), 'godrej-meridian.jpg'],
      [/malibu towne|malibu town/.test(name), 'malibu-towne.jpg'],
      [/paras quartier/.test(name), 'paras-quartier.jpg'],
      [/heritage one/.test(name), 'heritage-one.jpg'],
      [/orchid island/.test(name), 'orchid-island.jpg'],
      [/dlf exclusive floors|dlf exclusive floor/.test(name), 'dlf-exclusive-floors.jpg'],
      [/omaxe the nile/.test(name), 'omaxe-the-nile.jpeg'],
      [/uppal southend|uppal south end/.test(name), 'uppal-southend.jpg'],
      [/m3m heights/.test(name), 'm3m-heights.jpg'],
      [/ireo grand arch/.test(name), 'ireo-grand-arch.jpg'],
      [/signature global deluxe/.test(name), 'signature-global-deluxe-dxp.webp'],
      [/dlf the belaire|dlf belaire/.test(name), 'dlf-the-belaire.webp'],
      [/elevate by hines|conscient elevate/.test(name), 'elevate-by-hines.webp'],
      [/dlf park place/.test(name), 'dlf-park-place.jpg'],
      [/dlf westend heights/.test(name), 'dlf-westend-heights.jpg'],
      [/dlf carlton estate/.test(name), 'dlf-carlton-estate.jpg'],
      [/dlf arbour/.test(name), 'dlf-arbour.jpg'],
      [/dlf grove/.test(name), 'dlf-grove.jpg'],
      [/adani samsara/.test(name), 'adani-samsara.jpg'],
      [/anant raj/.test(name), 'anant-raj.jpg'],
      [/birla navya/.test(name), 'birla-navya.jpg'],
      [/blossom 2/.test(name), 'blossom-2.jpg'],
      [/bptp freedom/.test(name), 'bptp-freedom.jpg']
    ];

    for (const [matches, file] of projectImages) {
      if (matches) return file;
    }
    if (/south city 2/.test(name)) return 'south-city-2-builder-floors-houses.jpg';
    const fallbacks = {
      villa: 'villa.jpg',
      farmhouse: 'villa.jpg',
      'builder-floor': 'builder-floor.jpg',
      apartment: 'apartment.jpg',
      plot: 'plot.jpg',
      shop: 'shop.jpg',
      office: 'office.jpg',
      building: 'building.jpg',
      commercial: 'commercial.jpg'
    };
    return fallbacks[c] || 'apartment.jpg';
  }

  function representativeLabel(o) {
    const c = representativeCategory(o);
    const labels = {
      villa: 'Villa / House',
      farmhouse: 'Farmhouse',
      'builder-floor': 'Builder Floor',
      apartment: 'Apartment',
      plot: 'Plot / Land',
      shop: 'Shop / Retail',
      office: 'Office',
      building: 'Building / Office Building',
      commercial: 'Commercial'
    };
    return labels[c] || 'Property';
  }

  function matchesMode(o, mode) {
    if (!mode) return true;
    const t = String(o.transaction_type || '').toLowerCase();
    const p = String(o.property_type || '').toLowerCase();
    const c = String(o.configuration || '').toLowerCase();
    if (mode === 'buy') return t.includes('sale') || (!t.includes('rent') && !t.includes('lease'));
    if (mode === 'rent') return t.includes('rent') || t.includes('lease');
    if (mode === 'commercial') return /commercial|office|shop|retail/.test(p) || /office|shop|commercial/.test(c);
    if (mode === 'land') return /plot|land/.test(p) || /plot|land/.test(c);
    return true;
  }

  function categoryOf(o) {
    const p = norm(o.property_type || '');
    const c = norm(o.configuration || '');
    const t = norm([o.listing_title, o.website_display_name, o.project_name, o.key_features].filter(Boolean).join(' '));
    if (/\b(plot|plots|land|farm land)\b/.test(p) || /\b(plot|plots|land)\b/.test(c) || /\b(plot|plots|land)\b/.test(t)) return 'plot';
    if (/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory|booth|hospital|guest house|hotel)\b/.test(p + ' ' + c)) return 'commercial';
    if (/\bfarmhouse|farm house\b/.test(p + ' ' + c + ' ' + t)) return 'farmhouse';
    if (/\bbuilder floor|builder floors|\bfloor\b/.test(p) || /\bbuilder floor|\bfloor\b/.test(c)) return 'builder-floor';
    if (/\bvilla|villas|house|houses|kothi|kothis\b/.test(p + ' ' + c)) return 'villa';
    if (/\bapartment|apartments|flat|flats|condo|penthouse\b/.test(p + ' ' + c)) return 'apartment';
    return 'residential';
  }

  function matchesCategory(o, q) {
    if (!q) return true;
    const qn = norm(q);
    const cat = categoryOf(o);
    if (qn === 'builder-floor' || qn === 'builder floor' || qn === 'builder floors' || qn === 'builder-floors') {
      return cat === 'builder-floor' || /\bbuilder floor|\bfloor\b/.test(norm(o.property_type || '') + ' ' + norm(o.configuration || ''));
    }
    if (qn === 'plot' || qn === 'plots' || qn === 'land' || qn === 'plots and land' || qn === 'plots-land') return cat === 'plot';
    if (qn === 'commercial' || qn === 'office' || qn === 'offices' || qn === 'retail' || qn === 'shop') {
      return cat === 'commercial' || /\bcommercial|office|shop|retail\b/.test(norm(o.property_type || '') + ' ' + norm(o.configuration || ''));
    }
    if (qn === 'farmhouse' || qn === 'farmhouses') return cat === 'farmhouse';
    if (qn === 'villa' || qn === 'villas') return cat === 'villa' || /\bvilla|house|kothi\b/.test(norm(o.property_type || '') + ' ' + norm(o.configuration || ''));
    if (qn === 'apartment' || qn === 'apartments') return cat === 'apartment' || /\bapartment|flat|condo\b/.test(norm(o.property_type || '') + ' ' + norm(o.configuration || ''));
    if (qn === 'residential') return cat === 'residential' || cat === 'apartment' || cat === 'builder-floor' || cat === 'villa';
    return cat === qn;
  }

  function matchesLocation(o, q) {
    if (!q) return true;
    const qn = norm(q);
    const fields = [o.city, o.locality, o.sector, o.micro_location, o.project_name, o.listing_title].filter(Boolean).map(norm);
    const fullText = norm([o.city, o.locality, o.sector, o.micro_location, o.project_name, o.listing_title, o.public_description, o.key_features].join(' '));

    // Sohna town vs Sohna Road
    if (qn === 'sohna' || qn === 'imt sohna') {
      return fields.some(v => v === 'sohna' || v === 'imt sohna' || v.includes('imt sohna')) && !fields.some(v => v.includes('sohna road'));
    }
    if (qn === 'sohna road') {
      return fields.some(v => v.includes('sohna road') || v.includes('malibu') || v.includes('uppal south') || v.includes('vipul world') || v.includes('eldeco mansionz') || v.includes('omaxe the nile'));
    }

    // Golf Course Ext Road & SPR
    if (qn.includes('golf course ext') || qn.includes('spr') || qn === 'extension road' || qn.includes('southern peripheral')) {
      const extKeywords = [
        'golf course extension', 'golf course ext', 'spr', 'southern peripheral',
        'sector 58', 'sector 59', 'sector 61', 'sector 62', 'sector 63', 'sector 65', 'sector 66', 'sector 67', 'sector 68', 'sector 69', 'sector 70',
        'pioneer araya', 'pioneer presidia', 'emerald hills', 'emerald floors', 'elevate', 'conscient elevate', 'tata raisina',
        'urban oasis', 'smartworld orchid', 'paras irene', 'paras the florett', 'm3m heights', 'ireo grand arch', 'ireo uptown', 'puri the aravallis', 'the arbour'
      ];
      return extKeywords.some(k => fullText.includes(k));
    }

    // Golf Course Road & DLF 5
    if (qn === 'golf course road' || qn.includes('dlf 5') || qn === 'golf course rd') {
      const gcrKeywords = [
        'golf course road', 'golf course rd', 'dlf 5', 'dlf phase 5', 'sector 42', 'sector 43', 'sector 53', 'sector 54',
        'dlf belaire', 'dlf the belaire', 'the belaire', 'belaire', 'dlf park place', 'park place', 'dlf magnolias', 'magnolias',
        'dlf aralias', 'aralias', 'dlf camellias', 'camellias', 'dlf crest', 'the crest', 'dlf carlton', 'carlton estate', 'dlf exclusive'
      ];
      return gcrKeywords.some(k => fullText.includes(k));
    }

    // Dwarka Expressway & DXP
    if (qn.includes('dwarka') || qn.includes('dxp')) {
      const dxpKeywords = [
        'dwarka expressway', 'dwarka express', 'dxp', 'sector 95', 'sector 99', 'sector 102', 'sector 104', 'sector 106', 'sector 108', 'sector 109', 'sector 110', 'sector 111', 'sector 112', 'sector 113',
        'm3m capital', 'sobha aranya', 'signature global deluxe', 'deluxe dxp', 'godrej meridian', 'godrej meridien', 'indiabulls enigma', 'saan verdante'
      ];
      return dxpKeywords.some(k => fullText.includes(k));
    }

    // DLF Phase 1–5
    if (qn === 'dlf' || qn.includes('dlf phase')) {
      return fields.some(v => v.includes('dlf'));
    }

    // Nirvana & Sector 50
    if (qn === 'nirvana' || qn.includes('sector 50')) {
      return fullText.includes('nirvana') || fullText.includes('sector 50') || fullText.includes('south city 2') || fullText.includes('orchid island') || fullText.includes('fresco');
    }

    if (qn === 'south city') return fields.some(v => v.includes('south city'));
    if (qn === 'sushant lok') return fields.some(v => v.includes('sushant lok'));
    if (qn === 'sector 46' || qn === 'sector 45') return fields.some(v => v.includes('sector 46') || v.includes('sector 45'));
    if (qn === 'sector 57') return fields.some(v => v.includes('sector 57'));
    if (qn === 'udyog vihar') return fields.some(v => v.includes('udyog vihar'));
    if (qn === 'goa') return fields.some(v => v.includes('goa') || v.includes('majorda') || v.includes('arrossim') || v.includes('narve'));

    return fields.some(v => v === qn || v.includes(qn));
  }

  function parseBudgetRange(q) {
    if (!q) return null;
    const s = String(q).trim().toLowerCase();
    if (s === '< 3 cr' || s === 'under 3 cr' || s === '30000000') return { min: 0, max: 30000000 };
    if (s === '3–7 cr' || s === '3-7 cr' || s === '3 to 7 cr') return { min: 30000000, max: 70000000 };
    if (s === '7–15 cr' || s === '7-15 cr' || s === '7 to 15 cr') return { min: 70000000, max: 150000000 };
    if (s === '15–30 cr' || s === '15-30 cr' || s === '15 to 30 cr') return { min: 150000000, max: 300000000 };
    if (s === '30+ cr' || s === '30+cr' || s === 'above 30 cr') return { min: 300000000, max: Infinity };
    if (s === '50000000') return { min: 0, max: 50000000 };
    if (s === '100000000') return { min: 0, max: 100000000 };
    if (s === 'known') return 'known';

    const rangeMatch = s.match(/([0-9.]+)\s*(?:cr|crore)?\s*[-–to]+\s*([0-9.]+)\s*(cr|crore|lakh|lac)?/i);
    if (rangeMatch) {
      let min = Number(rangeMatch[1]);
      let max = Number(rangeMatch[2]);
      const unit = rangeMatch[3] || 'cr';
      const mult = (unit === 'lakh' || unit === 'lac') ? 100000 : 10000000;
      return { min: min * mult, max: max * mult };
    }
    const plusMatch = s.match(/([0-9.]+)\s*(cr|crore|lakh|lac)?\s*\+/i);
    if (plusMatch) {
      let min = Number(plusMatch[1]);
      const unit = plusMatch[2] || 'cr';
      const mult = (unit === 'lakh' || unit === 'lac') ? 100000 : 10000000;
      return { min: min * mult, max: Infinity };
    }
    return null;
  }

  function matchesBudget(o, q, mode) {
    if (!q) return true;
    const range = parseBudgetRange(q);
    if (!range) return true;

    if (range === 'known') {
      if (mode === 'rent') return o.rent_value != null && o.rent_value > 0;
      if (o.price_value != null && o.price_value > 0) return true;
      if (o.price_text && !/on request|on call|verify/i.test(o.price_text)) return true;
      return false;
    }

    if (mode === 'rent') {
      const rent = Number(o.rent_value);
      if (!Number.isFinite(rent)) return true;
      if (range.max >= 10000000 && rent < 10000000) return true;
      return rent >= range.min && rent <= range.max;
    }

    const price = Number(o.price_value);
    if (!Number.isFinite(price)) return true;
    const unit = String(o.price_unit || '').toLowerCase();
    if (/per\s*sq|sq\s*ft|sq\s*yd|per\s*sq\s*yard/.test(unit)) return true;

    let actualPrice = price;
    if (unit === 'cr' || unit.includes('crore')) {
      actualPrice = price * 10000000;
    } else if (unit.includes('lakh') || unit.includes('lac')) {
      actualPrice = price * 100000;
    }
    return actualPrice >= range.min && actualPrice <= range.max;
  }

  function propertyWhatsAppUrl(o) {
    const title = cleanTitle(o.website_display_name || o.listing_title || o.project_name || 'Gurgaon Property');
    const id = o.property_id || 'AUM-WEB';
    const loc = locationLabel(o) || (o.sector ? `${o.sector}, Gurgaon` : 'Gurgaon');
    const price = priceLabel(o);
    const msg = `Hi Ajay, I am interested in ${title} (Ref: ${id}) in ${loc}, listed around ${price}. Please share the complete dossier.`;
    return `https://wa.me/${WHATSAPP_DESK}?text=${encodeURIComponent(msg)}`;
  }

  function propertyCard(item, index) {
    const title = cleanTitle(item.website_display_name || item.listing_title || item.project_name || 'Gurgaon Luxury Property');
    const id = item.property_id || `AUM-WEB-${String(index + 1).padStart(6, '0')}`;
    const loc = locationLabel(item) || 'Gurgaon Prime Corridor';
    const catLabel = representativeLabel(item);
    const priceText = priceLabel(item);
    const image = representativeImage(item);
    const badgeText = item.image_label && item.image_label !== '*RP' ? item.image_label : 'Representative Image';
    const detailHref = `properties/detail.html?id=${encodeURIComponent(id)}`;
    const waHref = propertyWhatsAppUrl(item);

    const configParts = [
      item.configuration,
      item.bedrooms ? `${item.bedrooms} BHK` : '',
      areaLabel(item)
    ].filter(Boolean);
    const configText = configParts.length > 0 ? configParts.join(' · ') : catLabel;

    const desc = item.public_description || item.key_features || 'Verified specifications and private dossier available on request.';

    return `<article class="property-card" data-property-id="${safeText(id)}" data-title="${safeText(title)}" data-price="${safeText(priceText)}" data-location="${safeText(loc)}">
      <a class="property-image" href="${detailHref}" aria-label="View verified dossier for ${safeText(title)}">
        <img src="assets/property-images/${image}" alt="${safeText(title)}" loading="lazy" onerror="this.onerror=null;this.src='https://aumestates.com/assets/property-images/${image}';">
        <span class="property-badge">${safeText(badgeText)}</span>
      </a>
      <p class="property-number">REF / ${safeText(id)} · ${safeText(catLabel)}</p>
      <div class="property-meta">
        <span class="location">${safeText(loc)}</span>
        <span class="type">${safeText(catLabel)}</span>
      </div>
      <h3><a href="${detailHref}">${safeText(title)}</a></h3>
      <p class="property-config">${safeText(configText)}</p>
      <p class="property-detail">${safeText(desc)}</p>
      <div class="property-bottom">
        <span class="property-price tabular-nums">${safeText(priceText)}</span>
        <div class="property-actions">
          <a class="dossier-link" href="${detailHref}">Dossier ↗</a>
          <a class="whatsapp-link" href="${waHref}" target="_blank" rel="noopener noreferrer" aria-label="Inquire via WhatsApp for ${safeText(title)}">Inquire ↗</a>
        </div>
      </div>
    </article>`;
  }

  function currentFiltered() {
    const dataset = getInventory();
    let items = dataset.filter(item => {
      if (!item || String(item.status || 'Available').toLowerCase() !== 'available') return false;
      if (!matchesMode(item, state.intent)) return false;
      if (state.location && !matchesLocation(item, state.location)) return false;
      if (state.type && !matchesCategory(item, state.type)) return false;
      if (state.budget && !matchesBudget(item, state.budget, state.intent)) return false;
      return true;
    });

    if (state.sort === 'az') {
      items.sort((a, b) => cleanTitle(a.listing_title || a.project_name).localeCompare(cleanTitle(b.listing_title || b.project_name)));
    } else if (state.sort === 'za') {
      items.sort((a, b) => cleanTitle(b.listing_title || b.project_name).localeCompare(cleanTitle(a.listing_title || a.project_name)));
    } else if (state.sort === 'price-asc') {
      items.sort((a, b) => (Number(a.price_value) || Infinity) - (Number(b.price_value) || Infinity));
    } else if (state.sort === 'price-desc') {
      items.sort((a, b) => (Number(b.price_value) || -1) - (Number(a.price_value) || -1));
    }

    return items;
  }

  const intentLabels = {
    buy: 'Buy',
    rent: 'Rent',
    commercial: 'Commercial',
    land: 'Plots & Land'
  };

  const budgetLabels = {
    '< 3 Cr': 'Under ₹3 Cr',
    '3–7 Cr': '₹3–7 Cr',
    '7–15 Cr': '₹7–15 Cr',
    '15–30 Cr': '₹15–30 Cr',
    '30+ Cr': '₹30+ Cr',
    '50000000': 'Up to ₹5 Cr',
    '100000000': 'Up to ₹10 Cr',
    known: 'Price Disclosed'
  };

  function renderChips() {
    const chipsEl = $('#activeChips');
    if (!chipsEl) return;

    const filters = [
      ['intent', intentLabels[state.intent] || state.intent],
      ...(state.location ? [['location', state.location]] : []),
      ...(state.type ? [['type', state.type]] : []),
      ...(state.budget ? [['budget', budgetLabels[state.budget] || state.budget]] : [])
    ];

    chipsEl.innerHTML = filters.map(([key, label]) =>
      `<button class="chip" data-clear="${key}" aria-label="Remove ${safeText(label)} filter">${safeText(label)} <span aria-hidden="true">×</span></button>`
    ).join('');
  }

  function syncUrl() {
    try {
      const url = new URL(window.location.href);
      ['intent', 'location', 'type', 'budget', 'sort'].forEach(k => {
        if (state[k] && state[k] !== 'default') {
          url.searchParams.set(k, state[k]);
        } else {
          url.searchParams.delete(k);
        }
      });
      window.history.replaceState({ ...window.history.state, searchState: state }, '', url.toString());
    } catch (e) {}
  }

  function renderResults() {
    const items = currentFiltered();
    const grid = $('#resultsGrid');
    if (!grid) return;

    grid.innerHTML = items.map(propertyCard).join('');

    const countText = `${items.length} ${items.length === 1 ? 'verified property' : 'verified properties'}`;
    const resultCountEl = $('#resultCount');
    const mobileResultCountEl = $('#mobileResultCount');
    if (resultCountEl) resultCountEl.textContent = countText;
    if (mobileResultCountEl) mobileResultCountEl.textContent = countText;

    const emptyResults = $('#emptyResults');
    if (emptyResults) {
      grid.hidden = items.length === 0;
      emptyResults.hidden = items.length !== 0;

      if (items.length === 0) {
        const titleEl = (emptyResults.querySelector ? emptyResults.querySelector('h2') : null) || $('#emptyResults h2');
        const descEl = (emptyResults.querySelector ? emptyResults.querySelector('p') : null) || $('#emptyResults p');
        if (titleEl) titleEl.textContent = 'No properties match the current criteria.';
        if (descEl) descEl.textContent = "AUM ESTATES represents discrete private mandates not listed online. Contact Ajay Mukhija directly to discuss your specific requirements.";
      }
    }

    const resultsTitleEl = $('#resultsTitle');
    if (resultsTitleEl) {
      resultsTitleEl.textContent = state.intent === 'commercial'
        ? 'Commercial & retail mandates.'
        : state.intent === 'land'
          ? 'Residential plots & land.'
          : state.intent === 'rent'
            ? 'Executive leasing & rentals.'
            : 'Find your next residence.';
    }

    renderChips();
    syncControls();
    syncUrl();
  }

  function syncControls() {
    const intentEl = $('#filterIntent');
    const locEl = $('#filterLocation');
    const typeEl = $('#filterType');
    const budgetEl = $('#filterBudget');
    const sortEl = $('#sortResults');

    if (intentEl) intentEl.value = state.intent;
    if (locEl) {
      const hasOption = [...locEl.options].some(o => o.value === state.location);
      locEl.value = hasOption ? state.location : '';
    }
    if (typeEl) typeEl.value = state.type;
    if (budgetEl) budgetEl.value = state.budget;
    if (sortEl) sortEl.value = state.sort;
  }

  function updateFromControls() {
    state.intent = $('#filterIntent')?.value || 'buy';
    state.location = $('#filterLocation')?.value || '';
    state.type = $('#filterType')?.value || '';
    state.budget = $('#filterBudget')?.value || '';
    state.sort = $('#sortResults')?.value || 'default';
    renderResults();
  }

  function closeMobileMenu() {
    const menu = $('#mobileMenu');
    const toggle = $('#menuToggle');
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function closeFilters() {
    const panel = $('#filterPanel');
    const toggle = $('#openFilters');
    if (panel) panel.classList.remove('open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  const views = {
    home: '#homeView',
    browse: '#resultsView',
    locations: '#locationsView',
    advisor: '#advisorView',
    about: '#aboutView'
  };

  function displayView(view, push = true) {
    Object.entries(views).forEach(([name, selector]) => {
      const el = $(selector);
      if (el) el.hidden = name !== view;
    });
    document.body.classList.toggle('home-mode', view === 'home');
    closeMobileMenu();
    closeFilters();
    try {
      if (push) history.pushState({ view }, '', `#${view}`);
    } catch (e) {
      /* Fallback for file:// or restricted iframe sandbox */
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showHome(push = true) {
    displayView('home', push);
  }

  function showResults(settings = {}, push = true) {
    Object.assign(state, settings);
    displayView('browse', push);
    renderResults();
  }

  function showLocations(push = true) {
    displayView('locations', push);
  }

  function showAbout(push = true) {
    displayView('about', push);
  }

  function showAdvisor(purpose = 'general', push = true) {
    const forOwner = purpose === 'listing';
    const kicker = $('#advisorKicker');
    const title = $('#advisorTitle');
    const desc = $('#advisorDescription');

    if (kicker) kicker.textContent = forOwner ? 'FOR PROPERTY OWNERS' : 'PRIVATE ADVISORY DESK';
    if (title) title.innerHTML = forOwner ? 'List a property.<br>Begin with the details.' : 'Direct representation.<br>Led by Ajay Mukhija.';
    if (desc) {
      desc.textContent = forOwner
        ? 'Tell AUM ESTATES what you own, where it is, and whether you want to sell or lease. All owner discussions are held in strict fiduciary confidence.'
        : 'Connect directly with principal advisor Ajay Mukhija for institutional perspective, price context, and off-market Gurgaon opportunities.';
    }

    displayView('advisor', false);
    try {
      if (push) history.pushState({ view: 'advisor', purpose }, '', forOwner ? '#advisor-listing' : '#advisor');
    } catch (e) {
      /* Fallback for file:// or restricted iframe sandbox */
    }
  }

  function resetFilters() {
    Object.assign(state, { intent: 'buy', location: '', type: '', budget: '', sort: 'default' });
    renderResults();
  }

  function readInitialParams() {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('intent')) state.intent = p.get('intent');
      if (p.get('mode')) state.intent = p.get('mode');
      if (p.get('location')) state.location = p.get('location');
      if (p.get('type')) state.type = p.get('type');
      if (p.get('category')) state.type = p.get('category');
      if (p.get('budget')) state.budget = p.get('budget');
      if (p.get('sort')) state.sort = p.get('sort');
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', () => {
    readInitialParams();

    // Async fetch fallback if public_inventory.js hasn't loaded synchronously
    if (getInventory().length === 0 && typeof fetch === 'function') {
      fetch('data/public_inventory.json')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            window.AUM_PUBLIC_INVENTORY = data;
            renderResults();
          }
        })
        .catch(() => {});
    }

    const buyerContact = $('#buyerContact');
    const ownerContact = $('#ownerContact');
    const businessContact = $('#businessContact');

    if (buyerContact) {
      buyerContact.href = `https://wa.me/${WHATSAPP_DESK}?text=${encodeURIComponent('Hi Ajay, I am looking for a luxury property in Gurgaon. Can we schedule a private advisory consultation?')}`;
      buyerContact.addEventListener('click', () => window.AUM_CRM_HOOK('advisor_inquiry', { source: 'grid_buyer_cta', notes: 'Buyer private advisory consultation' }));
    }
    if (ownerContact) {
      ownerContact.href = `https://wa.me/${WHATSAPP_DESK}?text=${encodeURIComponent('Hi Ajay, I own a property in Gurgaon and would like to discuss private listing and representation with AUM ESTATES.')}`;
      ownerContact.addEventListener('click', () => window.AUM_CRM_HOOK('advisor_inquiry', { source: 'grid_owner_cta', notes: 'Owner private representation inquiry' }));
    }
    if (businessContact) {
      businessContact.href = `https://wa.me/${WHATSAPP_DESK}?text=${encodeURIComponent('Hi Ajay, I would like to discuss commercial office / retail investment opportunities in Gurgaon.')}`;
      businessContact.addEventListener('click', () => window.AUM_CRM_HOOK('advisor_inquiry', { source: 'grid_business_cta', notes: 'Commercial / retail investment inquiry' }));
    }

    const resultsGridEl = $('#resultsGrid');
    if (resultsGridEl) {
      resultsGridEl.addEventListener('click', event => {
        const waLink = event.target && event.target.closest ? event.target.closest('.whatsapp-link') : null;
        if (!waLink) return;
        const card = waLink.closest('.property-card');
        if (card) {
          window.AUM_CRM_HOOK('inquire_whatsapp', {
            source: 'architectural_grid_card',
            property_id: card.dataset.propertyId || '',
            title: card.dataset.title || '',
            price: card.dataset.price || '',
            location: card.dataset.location || ''
          });
        }
      });
    }

    const homeSearch = $('#homeSearch');
    if (homeSearch) {
      homeSearch.addEventListener('submit', event => {
        event.preventDefault();
        showResults({
          intent: $('#homeIntent')?.value || 'buy',
          location: $('#homeLocation')?.value || '',
          type: '',
          budget: '',
          sort: 'default'
        });
      });
    }

    $$('[data-browse]').forEach(button => {
      button.addEventListener('click', () => {
        showResults({
          intent: button.dataset.browse,
          location: '',
          type: '',
          budget: '',
          sort: 'default'
        });
      });
    });

    $$('[data-home]').forEach(element => {
      element.addEventListener('click', event => {
        event.preventDefault();
        showHome();
      });
    });

    $$('[data-view]').forEach(element => {
      element.addEventListener('click', event => {
        event.preventDefault();
        if (element.dataset.view === 'locations') showLocations();
        else if (element.dataset.view === 'about') showAbout();
      });
    });

    $$('[data-advisor]').forEach(element => {
      element.addEventListener('click', event => {
        event.preventDefault();
        showAdvisor(element.dataset.advisor);
      });
    });

    $$('[data-location]').forEach(button => {
      button.addEventListener('click', () => {
        showResults({
          intent: 'buy',
          location: button.dataset.location,
          type: '',
          budget: '',
          sort: 'default'
        });
      });
    });

    const menuToggle = $('#menuToggle');
    if (menuToggle) {
      menuToggle.addEventListener('click', () => {
        const mobileMenu = $('#mobileMenu');
        if (!mobileMenu) return;
        const opening = mobileMenu.hidden;
        mobileMenu.hidden = !opening;
        menuToggle.setAttribute('aria-expanded', String(opening));
      });
    }

    const dismissRibbon = $('#dismissRibbon');
    if (dismissRibbon) {
      dismissRibbon.addEventListener('click', () => {
        const textSpan = $('.concept-ribbon > span:nth-child(2)');
        if (textSpan) textSpan.hidden = true;
        dismissRibbon.hidden = true;
      });
    }

    $$('#filterIntent,#filterLocation,#filterType,#filterBudget,#sortResults').forEach(select => {
      select.addEventListener('change', updateFromControls);
    });

    const resetBtn = $('#resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    const emptyResetBtn = $('#emptyReset');
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetFilters);

    const activeChips = $('#activeChips');
    if (activeChips) {
      activeChips.addEventListener('click', event => {
        const button = event.target.closest('[data-clear]');
        if (!button) return;
        const key = button.dataset.clear;
        state[key] = key === 'intent' ? 'buy' : '';
        renderResults();
      });
    }

    const openFilters = $('#openFilters');
    if (openFilters) {
      openFilters.addEventListener('click', () => {
        const panel = $('#filterPanel');
        if (!panel) return;
        panel.classList.add('open');
        openFilters.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
        $('#filterIntent')?.focus();
      });
    }

    const closeFiltersBtn = $('#closeFilters');
    if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFilters);

    const applyFiltersBtn = $('#applyFilters');
    if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', closeFilters);

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeFilters();
        closeMobileMenu();
      }
    });

    const restoreView = () => {
      const hash = location.hash.slice(1);
      if (hash === 'browse') showResults({}, false);
      else if (hash === 'locations') showLocations(false);
      else if (hash === 'advisor') showAdvisor('general', false);
      else if (hash === 'advisor-listing') showAdvisor('listing', false);
      else if (hash === 'about') showAbout(false);
      else {
        // If query parameters exist (e.g. ?location=... or ?type=...), go directly to results
        const params = new URLSearchParams(window.location.search);
        if (params.get('intent') || params.get('location') || params.get('type') || params.get('budget')) {
          showResults({}, false);
        } else {
          showHome(false);
        }
      }
    };

    window.addEventListener('popstate', restoreView);
    restoreView();
  });
})();
