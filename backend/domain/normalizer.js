'use strict';

function cleanWhitespace(val) {
  if (val == null) return null;
  const s = String(val).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/**
 * Normalizes Indian & international real-estate area units into canonical Square Feet.
 * Supports: Sq Ft, Sq Yards / Gaj (x9), Sq Mtr (x10.7639), Marla (x272.25), Kanal (x5445), Acre (x43560).
 */
function normalizeAreaSqFt(areaValue, areaUnit) {
  const n = Number(areaValue);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = String(areaUnit || 'sq ft').toLowerCase().trim();

  if (/\b(acre|acres)\b/.test(u)) return Math.round(n * 43560);
  if (/\b(kanal|kanals)\b/.test(u)) return Math.round(n * 5445);
  if (/\b(marla|marlas)\b/.test(u)) return Math.round(n * 272.25);
  if (/\b(sq\s*m|sq\s*mtr|sqm|meter|metre)\b/.test(u)) return Math.round(n * 10.7639);
  if (/\b(sq\s*yd|sq\s*yard|sq\s*yards|yard|yards|gaj)\b/.test(u)) return Math.round(n * 9);
  // Default / sq ft variants (carpet, super, covered, saleable)
  return Math.round(n);
}

function areaInSqYd(areaValue, areaUnit, areaSqFtNorm) {
  const n = Number(areaValue);
  const u = String(areaUnit || '').toLowerCase();
  if (Number.isFinite(n) && n > 0 && /\b(sq\s*yd|sq\s*yard|sq\s*yards|gaj)\b/.test(u)) {
    return n;
  }
  if (Number.isFinite(areaSqFtNorm) && areaSqFtNorm > 0) {
    return areaSqFtNorm / 9;
  }
  return null;
}

/**
 * Parses explicit rupee amounts from clean price_text strings such as "₹8.50 Cr", "₹95 Lakh", "₹3.80 Cr – ₹4.45 Cr".
 */
function parsePriceFromText(priceText) {
  if (!priceText) return null;
  const s = String(priceText);
  if (/per\s*sq|\/\s*sq|lakh\/sq|lac\/sq/i.test(s)) return null;
  const crMatch = s.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)\b/i);
  if (crMatch) {
    const val = Number(crMatch[1]);
    if (Number.isFinite(val) && val > 0 && val < 5000) return Math.round(val * 1e7);
  }
  const lakhMatch = s.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs)\b/i);
  if (lakhMatch) {
    const val = Number(lakhMatch[1]);
    if (Number.isFinite(val) && val > 0) return Math.round(val * 1e5);
  }
  return null;
}

/**
 * Normalizes sale price into canonical INR, accounting for per-sq-yd and per-sq-ft rates when area is known.
 */
function normalizePriceInr({ priceValue, priceUnit, priceText, transactionType, areaValue, areaUnit, areaSqFtNorm }) {
  const tx = String(transactionType || '').toLowerCase();
  const isPureRent = (tx.includes('rent') || tx.includes('lease')) && !tx.includes('sale');
  if (isPureRent) return null;

  const sqFt = areaSqFtNorm ?? normalizeAreaSqFt(areaValue, areaUnit);
  const sqYd = areaInSqYd(areaValue, areaUnit, sqFt);
  const v = priceValue != null && priceValue !== '' ? Number(priceValue) : NaN;
  const u = String(priceUnit || '').toLowerCase().trim();

  if (Number.isFinite(v) && v > 0) {
    // Per Sq Yd rates
    if (/sq\s*yd|sq\s*yard/.test(u)) {
      let ratePerSqYd = v;
      if (/\bcr/.test(u)) ratePerSqYd = v * 1e7;
      else if (/\b(lakh|lac)/.test(u)) ratePerSqYd = v * 1e5;
      if (sqYd && sqYd > 0) return Math.round(ratePerSqYd * sqYd);
      return null;
    }
    // Per Sq Ft rates
    if (/sq\s*ft/.test(u)) {
      let ratePerSqFt = v;
      if (/\bcr/.test(u)) ratePerSqFt = v * 1e7;
      else if (/\b(lakh|lac)/.test(u)) ratePerSqFt = v * 1e5;
      if (sqFt && sqFt > 0) return Math.round(ratePerSqFt * sqFt);
      return null;
    }
    // Total amounts
    if (u === 'cr' || /\bcrore/.test(u)) return Math.round(v * 1e7);
    if (/\b(lakh|lac)/.test(u)) return Math.round(v * 1e5);
    if (u === 'inr' || u === 'total' || u === 'inr onwards') {
      return v < 500 ? Math.round(v * 1e7) : Math.round(v);
    }
    // Heuristic when unit is null
    if (!u) {
      if (v <= 500) return Math.round(v * 1e7); // e.g., 8.5 -> 8.5 Cr
      if (v >= 100000) return Math.round(v); // raw INR
    }
  }

  return parsePriceFromText(priceText);
}

/**
 * Normalizes monthly rental price into canonical INR/month.
 */
function normalizeRentInr({ rentValue, rentUnit, priceValue, priceUnit, transactionType, areaSqFtNorm }) {
  const tx = String(transactionType || '').toLowerCase();
  if (!tx.includes('rent') && !tx.includes('lease')) return null;

  const rv = rentValue != null && rentValue !== '' ? Number(rentValue) : NaN;
  const ru = String(rentUnit || '').toLowerCase().trim();
  if (Number.isFinite(rv) && rv > 0) {
    if (/\b(lakh|lac)/.test(ru)) return Math.round(rv * 1e5);
    if (/\bcr/.test(ru)) return Math.round(rv * 1e7);
    if (/sq\s*ft/.test(ru) && areaSqFtNorm) return Math.round(rv * areaSqFtNorm);
    return Math.round(rv);
  }

  const pv = priceValue != null && priceValue !== '' ? Number(priceValue) : NaN;
  const pu = String(priceUnit || '').toLowerCase().trim();
  if (Number.isFinite(pv) && pv > 0) {
    if (/sq\s*ft/.test(pu) && areaSqFtNorm) return Math.round(pv * areaSqFtNorm);
    if (/\b(lakh|lac)/.test(pu)) return Math.round(pv * 1e5);
    if (pv >= 5000) return Math.round(pv);
  }
  return null;
}

function formatInr(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1e7) {
    const cr = n / 1e7;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2).replace(/0$/, '')} Cr`;
  }
  if (n >= 1e5) {
    const lakh = n / 1e5;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)} Lakh`;
  }
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function cleanListingTitle(title, projectName) {
  const base = cleanWhitespace(title) || cleanWhitespace(projectName) || 'Gurugram Property Mandate';
  return base
    .replace(/\s+MP$/i, '')
    .replace(/\s+OC tower$/i, ' (OC Received)')
    .replace(/\s+#\d+$/i, '')
    .replace(/\s*;\s*\d+(?:\.\d+)?%\s*brokerage.*$/i, '')
    .trim();
}

function formatPublicPriceDisplay(record) {
  const tx = String(record.transaction_type || '').toLowerCase();
  const isPureRent = (tx.includes('rent') || tx.includes('lease')) && !tx.includes('sale');
  if (isPureRent && record.rent_inr_monthly_norm) {
    return `${formatInr(record.rent_inr_monthly_norm)} / month`;
  }
  if (record.price_text) {
    const s = String(record.price_text).trim();
    if (/^(mp|market\s*rates?)$/i.test(s)) return 'Market Price on Request';
    if (/^price\s*on\s*(call|request)$/i.test(s)) return 'Price on Request';
    if (!/confirm\s*unit|keys\s*in\s*hand|cheque|white|black|brokerage|commission|verify|not\s*supplied/i.test(s)) {
      return s;
    }
  }
  if (record.price_value != null && record.price_value !== '') {
    const u = String(record.price_unit || '').toLowerCase();
    if (u.includes('sq')) {
      return `₹${record.price_value} ${record.price_unit}`.trim();
    }
    if (u === 'cr' || u.includes('crore')) return `₹${record.price_value} Cr`;
    if (u.includes('lakh') || u.includes('lac')) return `₹${record.price_value} Lakh`;
  }
  if (record.price_inr_norm) return formatInr(record.price_inr_norm);
  if (record.rent_inr_monthly_norm) return `${formatInr(record.rent_inr_monthly_norm)} / month`;
  return 'Price on Request';
}

function classifyCategory(record) {
  const p = normText(record.property_type || '');
  const c = normText(record.configuration || '');
  const t = normText([record.listing_title, record.project_name, record.inventory_category].filter(Boolean).join(' '));
  const combined = `${p} ${c}`;

  if (/\b(plot|plots|land|farm land|hospital land)\b/.test(p) || /\b(plot|plots|land)\b/.test(c) || /\b(plot|plots|land)\b/.test(t)) {
    return 'plot';
  }
  if (/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory|booth|hospital|healthcare|guest house|hotel|building)\b/.test(combined)) {
    return 'commercial';
  }
  if (/\b(farmhouse|farm house)\b/.test(`${combined} ${t}`)) {
    return 'farmhouse';
  }
  if (/\b(builder floor|builder floors|floor|floors)\b/.test(combined)) {
    return 'builder-floor';
  }
  if (/\b(villa|villas|house|houses|kothi|kothis)\b/.test(combined)) {
    return 'villa';
  }
  if (/\b(apartment|apartments|flat|flats|condo|condominium|penthouse)\b/.test(combined)) {
    return 'apartment';
  }
  return 'apartment';
}

function classifyCorridor(record) {
  const hay = normText([
    record.city,
    record.locality,
    record.sector,
    record.micro_location,
    record.project_name,
    record.listing_title
  ].filter(Boolean).join(' '));

  if (/\b(goa|arrossim|majorda|narve|piedade|divar|tiswadi|asya|sukoon)\b/.test(hay)) {
    return 'South Goa';
  }
  if (/\b(dlf phase 1|dlf phase 2|dlf phase 3|dlf phase 4|dlf phase 5|dlf 1|dlf 2|dlf 3|dlf 4|dlf 5|dlf exclusive|dlf grove|dlf the grove|ridgewood|regency park|oakwood|trinity|wellington|beverley|silver oaks|dlf city)\b/.test(hay)) {
    return 'DLF Phase 1–5';
  }
  if (/\b(golf course road|belaire|park place|magnolias|camellias|aralias|crest|carlton|westend|vipul belmonte|parsvnath exotica|paras quartier|gwal pahari|valley view|suncity|palm springs|verandas|laburnum|godrej miraya|sector 42|sector 43|sector 53|sector 54|sector 26|sector 27|sector 28)\b/.test(hay)) {
    return 'Golf Course Road';
  }
  if (/\b(golf course ext|extension road|spr|southern peripheral|arbour|aureva|elevate|pioneer|presidia|araya|ireo|aravalli|aravallis|m3m golf|m3m heights|m3m latitude|birla navya|adani samsara|anant raj|anantraj|emerald|heritage one|tata raisina|paras irene|florett|smartworld|aspen|whiteland|urban oasis|omara|lamborghini|green oaks|nitara|sector 55|sector 56|sector 57|sector 58|sector 59|sector 60|sector 61|sector 62|sector 63|sector 63a|sector 64|sector 65|sector 66|sector 67|sector 68|sector 69|sector 70|sector 70a|sector 71|sector 72)\b/.test(hay)) {
    return 'Golf Course Ext & SPR';
  }
  if (/\b(dwarka expressway|new gurgaon|sobha aranya|sobha city|m3m capital|godrej meridian|indiabulls enigma|bptp amstoria|signature global|vatika inxt|bestech ananda|saan verdante|tripundra|bijwasan|sector 37c|sector 37d|sector 76|sector 77|sector 78|sector 79|sector 80|sector 81|sector 82|sector 83|sector 84|sector 85|sector 86|sector 88|sector 89|sector 90|sector 91|sector 92|sector 93|sector 95|sector 99|sector 102|sector 103|sector 104|sector 106|sector 108|sector 109|sector 110|sector 111|sector 112|sector 113|sector 114)\b/.test(hay)) {
    return 'Dwarka Expressway & New Gurgaon';
  }
  if (/\b(nirvana|sohna road|south city 2|malibu|mayfield|fresco|blossom|harmony|close north|close south|uppal southend|vipul world|rosewood|ardee|orchid island|orchid ivy|eldeco|uniworld|bestech parkview|palladians|arcadia|rodeo drive|universal trade|vantage aura|palm terrace|palm floors|greenwood|sector 33|sector 38|sector 39|sector 40|sector 45|sector 46|sector 47|sector 48|sector 49|sector 50|sector 51|sector 52)\b/.test(hay)) {
    return 'Nirvana Country & Sohna Road';
  }
  if (/\b(sushant lok|south city 1|udyog vihar|palam vihar|mg road|sahara mall|enkay|shukrana|sector 14|sector 15|sector 17|sector 21|sector 22|sector 23|sector 29|sector 30|sector 31|sector 32)\b/.test(hay)) {
    return 'Sushant Lok & Central Gurgaon';
  }
  return 'Gurugram Central & Other';
}

function resolveRepresentativeImage(record) {
  const cat = record.category || classifyCategory(record);
  if (cat === 'plot') return 'plot-land-user.jpg';

  const name = normText([
    record.listing_title,
    record.project_name,
    record.locality,
    record.micro_location,
    record.sector,
    record.public_description,
    record.key_features
  ].filter(Boolean).join(' '));

  const rules = [
    [/sector 46 guest house|guest house/, 'commercial.jpg'],
    [/asya smartliving|sukoon/, 'sukoon-asya-project-photo.png'],
    [/puri the aravallis|puri aravallis|puri the aravalli/, 'puri-the-aravalis.jpg'],
    [/privana/, 'privana.jpg'],
    [/sobha aranya/, 'sobha-aranya.jpg'],
    [/indiabulls enigma/, 'indiabulls-enigma.jpg'],
    [/paras irene/, 'paras-irene.jpg'],
    [/eldeco mansionz|eldeco mansions/, 'eldeco-mansionz.jpg'],
    [/uniworld garden 1/, 'uniworld-garden-1.jpg'],
    [/tata raisina/, 'tata-raisina.webp'],
    [/paras the florett/, 'paras-the-florett.jpg'],
    [/ireo uptown/, 'ireo-uptown.jpg'],
    [/the aspen|aspen green|whiteland/, 'the-aspen.webp'],
    [/pioneer araya|\baraya\b/, 'pioneer-araya.jpg'],
    [/smartworld sky arc/, 'smartworld-sky-arc.webp'],
    [/\bharmony\b/, 'harmony.jpg'],
    [/urban oasis/, 'urban-oasis.jpg'],
    [/palm terrace select|palm terraces select/, 'palm-terrace-select.jpeg'],
    [/pioneer presidia/, 'pioneer-presidia.jpg'],
    [/ridgewood estate|rigdewood estate/, 'ridgewood-estate.jpg'],
    [/arrossim|south goa/, 'arrossim.jpg'],
    [/sushant lok 1 a block 350 sq yd upper ground/, 'sushant-lok-1-a-block-350-upper-ground.jpg'],
    [/shukrana homes/, 'shukrana-homes.jpg'],
    [/sushant lok/, 'sushant-lok.jpg'],
    [/m3m capital/, 'm3m-capital-113.webp'],
    [/south city 2/, 'south-city-2.jpg'],
    [/close north/, 'close-north.jpg'],
    [/close south/, 'close-south.jpg'],
    [/vipul world/, 'vipul-world.jpg'],
    [/godrej meridian|godrej meridien|godrej miraya/, 'godrej-meridian.jpg'],
    [/malibu towne|malibu town/, 'malibu-towne.jpg'],
    [/paras quartier/, 'paras-quartier.jpg'],
    [/heritage one/, 'heritage-one.jpg'],
    [/orchid island|orchid ivy/, 'orchid-island.jpg'],
    [/dlf exclusive floor/, 'dlf-exclusive-floors.jpg'],
    [/omaxe the nile/, 'omaxe-the-nile.jpeg'],
    [/uppal southend|uppal south end/, 'uppal-southend.jpg'],
    [/m3m heights/, 'm3m-heights.jpg'],
    [/ireo grand arch/, 'ireo-grand-arch.jpg'],
    [/signature global deluxe/, 'signature-global-deluxe-dxp.webp'],
    [/dlf the belaire|dlf belaire/, 'dlf-the-belaire.webp'],
    [/elevate by hines|conscient elevate|elevate hines/, 'elevate-by-hines.webp'],
    [/dlf park place/, 'dlf-park-place.jpg'],
    [/dlf westend heights/, 'dlf-westend-heights.jpg'],
    [/dlf carlton estate/, 'dlf-carlton-estate.jpg'],
    [/dlf arbour|dlf the arbour/, 'dlf-arbour.jpg'],
    [/dlf grove|dlf the grove/, 'dlf-grove.jpg'],
    [/adani samsara/, 'adani-samsara.jpg'],
    [/anant raj|anantraj/, 'anant-raj.jpg'],
    [/birla navya/, 'birla-navya.jpg'],
    [/blossom 2/, 'blossom-2.jpg'],
    [/bptp freedom/, 'bptp-freedom.jpg']
  ];

  for (const [regex, file] of rules) {
    if (regex.test(name)) return file;
  }

  const fallbacks = {
    villa: 'villa.jpg',
    farmhouse: 'villa.jpg',
    'builder-floor': 'builder-floor.jpg',
    apartment: 'apartment.jpg',
    plot: 'plot-land-user.jpg',
    commercial: 'commercial.jpg'
  };
  return fallbacks[cat] || 'apartment.jpg';
}

function parseBedroomsInt(bedrooms, configuration, listingTitle) {
  if (bedrooms != null && bedrooms !== '') {
    const m = String(bedrooms).match(/(\d+)/);
    if (m) return Number(m[1]);
  }
  const combined = `${configuration || ''} ${listingTitle || ''}`;
  const bhk = combined.match(/\b(\d+)\s*bhk\b/i);
  if (bhk) return Number(bhk[1]);
  return null;
}

module.exports = {
  cleanWhitespace,
  normText,
  slugify,
  normalizeAreaSqFt,
  normalizePriceInr,
  normalizeRentInr,
  formatInr,
  cleanListingTitle,
  formatPublicPriceDisplay,
  classifyCategory,
  classifyCorridor,
  resolveRepresentativeImage,
  parseBedroomsInt
};
