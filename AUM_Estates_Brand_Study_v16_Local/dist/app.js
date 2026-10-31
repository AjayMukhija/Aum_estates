const FALLBACK_SAMPLE = [
  { id:'AUM-WEB-000167', name:'Puri The Aravallis', area:'Sector 61, Gurugram', corridor:'Golf Course Extension', kind:'Apartment', beds:[3], priceCr:[4.5], rentLakh:null, areaSqFt:2250, purposeList:['Buy'], detail:'3 BHK · Tower B · approximately 2,250 sq ft', price:'Price on request', image:'https://aumestates.com/assets/project-images/puri-the-aravalis.jpg', imageNote:'Representative reference image', reference:'AUM-WEB-000167', featured:true },
  { id:'AUM-WEB-000151', name:'Nirvana Deerwood', area:'Nirvana Country, Sector 50, Gurugram', corridor:'Golf Course Extension', kind:'Villa', beds:[4], priceCr:null, rentLakh:null, areaSqFt:3240, purposeList:['Buy'], detail:'Simplex villa · approximately 360 sq yd', price:'Price on request', image:'https://aumestates.com/assets/property-images/nirvana-villa.jpg', imageNote:'Representative reference image', reference:'AUM-WEB-000151', featured:true },
  { id:'AUM-WEB-000194', name:'Conscient Elevate', area:'Sector 59, Gurugram', corridor:'Golf Course Extension', kind:'Apartment', beds:[3], priceCr:null, rentLakh:null, areaSqFt:2595, purposeList:['Buy'], detail:'3 BHK with servant room · approximately 2,595 sq ft', price:'Price on request', image:'https://aumestates.com/assets/property-images/elevate-by-hines.webp', imageNote:'Representative reference image', reference:'AUM-WEB-000194', featured:true },
  { id:'AUM-WEB-000142', name:'DLF Privana South', area:'Sector 77, SPR, Gurugram', corridor:'Southern Peripheral Road (SPR)', kind:'Apartment', beds:[4], priceCr:null, rentLakh:null, areaSqFt:3577, purposeList:['Buy'], detail:'4 BHK · approximately 3,577 sq ft', price:'Price on request', image:'https://aumestates.com/assets/project-images/privana.jpg', imageNote:'Representative reference image', reference:'AUM-WEB-000142', featured:true },
  { id:'AUM-WEB-000113', name:'Emaar Urban Oasis', area:'Sector 62, Gurugram', corridor:'Golf Course Extension', kind:'Apartment', beds:[3,4], priceCr:null, rentLakh:null, areaSqFt:2400, purposeList:['Buy'], detail:'Residential options in 3 and 4 BHK configurations', price:'Price on request', image:'https://aumestates.com/assets/project-images/urban-oasis.jpg', imageNote:'Representative reference image', reference:'AUM-WEB-000113', featured:true },
  { id:'AUM-WEB-000019', name:'Sukoon by ASYA SmartLiving', area:'Majorda, South Goa', corridor:'South Goa', kind:'Villa', beds:[3,4], priceCr:[7,9], rentLakh:null, areaSqFt:3100, purposeList:['Buy'], detail:'Private villa project · 3 and 4 BHK options', price:'3 BHK ₹7 Cr · 4 BHK ₹9 Cr', image:'https://aumestates.com/assets/sukoon-asya-project-photo.png', imageNote:'AUM ESTATES-supplied project photograph', reference:'AUM-WEB-000019', featured:true }
];

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function resolveImageUrl(imageFile) {
  if (!imageFile) return '';
  if (/^https?:\/\//i.test(imageFile)) return imageFile;
  const clean = encodeURIComponent(String(imageFile).trim());
  if (location.protocol === 'file:') {
    return `../../AUM_ESTATES_Website_For_Hostinger/assets/property-images/${clean}`;
  }
  return `/assets/property-images/${clean}`;
}

function classifyKind(rec) {
  const cat = String(rec.category || rec.property_type || '').toLowerCase();
  if (/commercial|sco|office|retail|shop|warehouse|leased/.test(cat)) return 'Commercial';
  if (/farm/.test(cat)) return 'Farmhouse';
  if (/plot|land|acre/.test(cat)) return 'Plot / Land';
  if (/floor/.test(cat)) return 'Builder Floor';
  if (/villa|kothi|independent|house|duplex|townhouse|simplex/.test(cat)) return 'Villa';
  return 'Apartment';
}

function formatPriceDisplay(rec) {
  if (rec.display_price) return rec.display_price;
  if (rec.price_text && String(rec.price_text).trim()) return String(rec.price_text).trim();
  const tx = String(rec.transaction_type || 'Sale').toLowerCase();
  if (/rent|lease/.test(tx)) {
    if (rec.rent_value) {
      return `₹${Number(rec.rent_value).toLocaleString('en-IN')} ${rec.rent_unit || '/ month'}`.trim();
    }
    if (rec.rent_inr_monthly_norm) {
      const l = rec.rent_inr_monthly_norm / 100000;
      return l >= 1 ? `₹${Number(l.toFixed(2))} Lakh / month` : `₹${Math.round(rec.rent_inr_monthly_norm).toLocaleString('en-IN')} / month`;
    }
  }
  if (rec.price_value) {
    return `₹${Number(rec.price_value).toLocaleString('en-IN')} ${rec.price_unit || ''}`.trim();
  }
  if (rec.price_inr_norm) {
    const cr = rec.price_inr_norm / 10000000;
    return cr >= 1 ? `₹${Number(cr.toFixed(2))} Cr` : `₹${Number((rec.price_inr_norm / 100000).toFixed(2))} Lakh`;
  }
  return 'Price on request';
}

function mapPublicRecordToStudyItem(rec) {
  const kind = classifyKind(rec);
  const tx = String(rec.transaction_type || 'Sale').toLowerCase();
  const isRent = /rent|lease/.test(tx);
  const purposeList = [];
  if (isRent) {
    purposeList.push('Rent');
    if (kind === 'Commercial') purposeList.push('Commercial');
  } else {
    if (kind === 'Commercial') {
      purposeList.push('Commercial');
    } else if (kind === 'Plot / Land') {
      purposeList.push('Land', 'Buy');
    } else if (kind === 'Farmhouse') {
      purposeList.push('Buy', 'Land');
    } else {
      purposeList.push('Buy');
    }
  }

  const beds = [];
  if (rec.bedrooms_int && Number.isFinite(Number(rec.bedrooms_int))) {
    beds.push(Math.min(5, Number(rec.bedrooms_int)));
  } else if (rec.bedrooms) {
    const m = String(rec.bedrooms).match(/\d+/);
    if (m) beds.push(Math.min(5, Number(m[0])));
  } else if (rec.configuration) {
    const matches = String(rec.configuration).match(/\d+(?=\s*bhk)/gi) || [];
    matches.forEach((n) => beds.push(Math.min(5, Number(n))));
  }

  let priceCr = null;
  if (rec.price_inr_norm && Number(rec.price_inr_norm) > 0) {
    priceCr = [Number(rec.price_inr_norm) / 10000000];
  } else if (rec.price_value && /cr/i.test(String(rec.price_unit || ''))) {
    priceCr = [Number(rec.price_value)];
  } else if (rec.price_value && /lakh|lac/i.test(String(rec.price_unit || ''))) {
    priceCr = [Number(rec.price_value) / 100];
  }

  let rentLakh = null;
  if (rec.rent_inr_monthly_norm && Number(rec.rent_inr_monthly_norm) > 0) {
    rentLakh = [Number(rec.rent_inr_monthly_norm) / 100000];
  } else if (isRent && rec.rent_value) {
    const u = String(rec.rent_unit || '').toLowerCase();
    rentLakh = [/lakh|lac/.test(u) ? Number(rec.rent_value) : Number(rec.rent_value) / 100000];
  }

  const areaParts = [rec.micro_location || rec.locality, rec.sector, rec.city || 'Gurugram']
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter((v, i, a) => v && a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i);

  const detailBits = [];
  if (rec.configuration) detailBits.push(rec.configuration);
  else if (rec.bedrooms) detailBits.push(`${rec.bedrooms} BHK`);
  else if (rec.property_type) detailBits.push(rec.property_type);

  if (rec.area_value) {
    detailBits.push(`approx. ${Number(rec.area_value).toLocaleString('en-IN')} ${rec.area_unit || 'Sq Ft'}`);
  }
  if (rec.possession_status) detailBits.push(rec.possession_status);
  else if (rec.furnishing) detailBits.push(rec.furnishing);

  const title = rec.listing_title || rec.project_name || rec.property_id;
  return {
    id: String(rec.property_id),
    name: String(title),
    projectName: String(rec.project_name || ''),
    area: areaParts.join(', ') || 'Gurugram',
    corridor: String(rec.corridor || 'Gurugram'),
    kind,
    beds: [...new Set(beds)],
    priceCr,
    rentLakh,
    priceSortVal: rec.price_inr_norm || rec.rent_inr_monthly_norm || null,
    areaSqFt: rec.area_sqft_norm || null,
    purposeList,
    detail: detailBits.join(' · ') || rec.description || 'Current configuration & terms to be confirmed',
    description: rec.description || '',
    thingsToConfirm: Array.isArray(rec.things_to_confirm) ? rec.things_to_confirm : [],
    price: formatPriceDisplay(rec),
    image: resolveImageUrl(rec.image_file),
    imageNote: rec.image_attribution || 'Representative reference image',
    reference: String(rec.property_id),
    featured: Boolean(rec.is_featured || rec.is_featured_approved),
    searchBlob: [
      rec.property_id,
      title,
      rec.project_name,
      areaParts.join(' '),
      rec.corridor,
      kind,
      rec.property_type,
      rec.configuration,
      rec.description
    ].filter(Boolean).join(' ').toLowerCase()
  };
}

function buildInitialInventory() {
  if (Array.isArray(window.AUM_PUBLIC_INVENTORY) && window.AUM_PUBLIC_INVENTORY.length > 0) {
    const items = window.AUM_PUBLIC_INVENTORY
      .filter((r) => String(r.status || 'Available').toLowerCase() === 'available')
      .map(mapPublicRecordToStudyItem);
    items.sort((a, b) => (Number(b.featured) - Number(a.featured)) || a.id.localeCompare(b.id));
    return items;
  }
  return FALLBACK_SAMPLE.map((item) => ({
    ...item,
    searchBlob: [item.id, item.name, item.area, item.corridor, item.kind, item.detail].join(' ').toLowerCase()
  }));
}

let inventory = buildInitialInventory();

const SYNONYM_MAP = {
  gcr: 'golf course road',
  gcer: 'golf course extension',
  dxp: 'dwarka expressway',
  spr: 'southern peripheral',
  kothi: 'villa independent',
  sco: 'commercial shop office',
  huda: 'sector central',
  hsvp: 'sector central'
};

function expandQueryTokens(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase();
  if (!q) return [];
  return q.split(/\s+/).filter(Boolean).map((tok) => SYNONYM_MAP[tok] || tok);
}

const sourceUrl = '/properties/index.html';
const whatsapp = (message) => 'https://wa.me/919873813595?text=' + encodeURIComponent(message);
const questionBank = [
  'What exact unit is available, and when can I view it?',
  'What is the complete cost, including recurring charges?',
  'Which ownership and approval documents can I review?',
  'What are the actual usable area, condition and floor details?',
  'What should I know about the locality and daily commute?',
  'What terms, restrictions or timelines could affect this decision?'
];
function readStored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === 'object' ? value : fallback; }
  catch { return fallback; }
}
const personalNotes = readStored('aum-study-notes-v5', {});
const selectedQuestions = readStored('aum-study-questions-v5', {});
function writeStored(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const screens = [...document.querySelectorAll('.screen')];
const showScreen = (id, updateUrl = true) => {
  if (!screens.some((el) => el.id === id)) id = 'index';
  screens.forEach((el) => { const selected = el.id === id; el.hidden = !selected; el.classList.toggle('active', selected); });
  if (updateUrl) {
    const url = new URL(location.href);
    if (id === 'index') { url.searchParams.delete('view'); url.searchParams.delete('property'); }
    else url.searchParams.set('view', 'view');
    if (url.toString() !== location.href) history.pushState(null, '', url);
  }
  window.scrollTo(0, 0);
};
showScreen(new URLSearchParams(location.search).get('view') || 'index', false);
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(location.search);
  showScreen(params.get('view') === 'view' ? 'view' : 'index', false);
  if (params.get('view') === 'view') {
    const index = inventory.findIndex((p) => p.id === params.get('property'));
    browsingIds = browsingSelection(params.get('property'));
    showProperty(index < 0 ? 0 : index);
  }
});

let activePurpose = 'Buy';
const listElement = document.getElementById('property-list');
let expandedKind = 'Apartment';
const listCount = document.getElementById('list-count');
const emptyElement = document.getElementById('list-empty');
const purposeSelect = document.getElementById('inventory-purpose');
const areaSelect = document.getElementById('index-area');
const queryInput = document.getElementById('index-query');
const filterBedrooms = document.getElementById('filter-bedrooms');
const filterBudget = document.getElementById('filter-budget');
const filterSort = document.getElementById('filter-sort');
let activeJourney = 'first';
let visibleIds = [];
let browsingIds = inventory.map((p) => p.id);

function syncBudgetLabelsForPurpose() {
  const opts = filterBudget.options;
  if (opts.length < 4) return;
  if (activePurpose === 'Rent') {
    opts[1].textContent = 'Below ₹1.5 Lakh / mo';
    opts[2].textContent = '₹1.5–3 Lakh / mo';
    opts[3].textContent = 'Above ₹3 Lakh / mo';
  } else {
    opts[1].textContent = 'Below ₹5 Cr';
    opts[2].textContent = '₹5–10 Cr';
    opts[3].textContent = 'Above ₹10 Cr';
  }
}

function browsingSelection(id) {
  const target = inventory.find((p) => p.id === id);
  if (!target) return inventory.map((p) => p.id);
  const withinResults = visibleIds.filter((visibleId) => inventory.find((p) => p.id === visibleId)?.kind === target.kind);
  return withinResults.includes(id) ? withinResults : inventory.filter((p) => p.kind === target.kind).map((p) => p.id);
}

let storedSaved = [];
try { storedSaved = JSON.parse(localStorage.getItem('aum-study-saved') || '[]'); } catch {}
const saved = new Set(Array.isArray(storedSaved) ? storedSaved.filter((id) => inventory.some((p) => p.id === id)) : []);

const budgetMatches = (p, range) => {
  if (range === 'Any') return true;
  if (activePurpose === 'Rent') {
    if (!p.rentLakh) return false;
    return p.rentLakh.some((n) => (range === '0-5' ? n < 1.5 : range === '5-10' ? n >= 1.5 && n <= 3 : n > 3));
  }
  if (!p.priceCr) return false;
  return p.priceCr.some((n) => (range === '0-5' ? n < 5 : range === '5-10' ? n >= 5 && n <= 10 : n > 10));
};

const areaMatches = (p, selectedArea) => {
  if (!selectedArea || selectedArea === 'All areas') return true;
  if (selectedArea === 'Gurugram') {
    return !/goa/i.test(p.area) && !/goa/i.test(p.corridor);
  }
  const needle = selectedArea.toLowerCase();
  return p.corridor.toLowerCase() === needle
    || p.area.toLowerCase().includes(needle)
    || (needle === 'south goa' && /goa/i.test(p.area));
};

const queryMatches = (p, rawQuery) => {
  const tokens = expandQueryTokens(rawQuery);
  if (!tokens.length) return true;
  return tokens.every((group) => {
    const parts = group.split(/\s+/);
    return parts.every((part) => p.searchBlob.includes(part)) || p.searchBlob.includes(group);
  });
};

const persistFilters = () => {
  const url = new URL(location.href);
  [['purpose', activePurpose], ['area', areaSelect.value], ['q', queryInput.value], ['beds', filterBedrooms.value], ['budget', filterBudget.value], ['sort', filterSort.value]].forEach(([key, value]) => {
    if (['All areas', 'All', 'Any', ''].includes(value) || (key === 'purpose' && value === 'Buy') || (key === 'area' && value === 'Gurugram') || (key === 'sort' && value === 'featured')) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  });
  url.searchParams.delete('kind');
  history.replaceState(null, '', url);
};

const defaultArea = 'Gurugram';
const hasActiveFilters = () => activePurpose !== 'Buy' || areaSelect.value !== defaultArea || Boolean(queryInput.value.trim()) || filterBedrooms.value !== 'Any' || filterBudget.value !== 'Any' || filterSort.value !== 'featured';

function updateResetVisibility() {
  document.getElementById('filter-clear').hidden = !hasActiveFilters();
  const advanced = [filterBedrooms.value !== 'Any', filterBudget.value !== 'Any', filterSort.value !== 'featured'].filter(Boolean).length;
  const toggle = document.getElementById('filter-toggle');
  toggle.textContent = document.getElementById('filter-panel').hidden ? (advanced ? `More filters (${advanced}) ＋` : 'More filters ＋') : 'Fewer filters −';
}

const CATEGORY_DEFINITIONS = [
  { kind: 'Apartment', label: 'Apartments & Penthouses', description: 'Flats, penthouses & residential towers' },
  { kind: 'Builder Floor', label: 'Builder Floors', description: 'Independent low-rise residences' },
  { kind: 'Villa', label: 'Villas & Kothis', description: 'Independent homes, duplexes & gated villas' },
  { kind: 'Plot / Land', label: 'Plots & Land', description: 'Residential plots & development land' },
  { kind: 'Commercial', label: 'Commercial Spaces', description: 'SCO plots, retail, offices & leased assets' },
  { kind: 'Farmhouse', label: 'Farmhouses & Estates', description: 'Country estates & gated farmhouses' }
];

function renderList() {
  syncBudgetLabelsForPurpose();
  const area = areaSelect.value;
  const query = queryInput.value.trim();
  const shown = inventory.filter((p) =>
    p.purposeList.includes(activePurpose) &&
    areaMatches(p, area) &&
    queryMatches(p, query) &&
    (filterBedrooms.value === 'Any' || p.beds.includes(Number(filterBedrooms.value))) &&
    budgetMatches(p, filterBudget.value)
  );

  if (filterSort.value === 'name') shown.sort((a, b) => a.name.localeCompare(b.name));
  else if (filterSort.value === 'location') shown.sort((a, b) => a.area.localeCompare(b.area));
  else if (filterSort.value === 'price_asc') shown.sort((a, b) => (a.priceSortVal ?? Number.MAX_SAFE_INTEGER) - (b.priceSortVal ?? Number.MAX_SAFE_INTEGER));
  else if (filterSort.value === 'price_desc') shown.sort((a, b) => (b.priceSortVal ?? -1) - (a.priceSortVal ?? -1));
  else if (filterSort.value === 'area_desc') shown.sort((a, b) => (b.areaSqFt ?? -1) - (a.areaSqFt ?? -1));

  visibleIds = shown.map((p) => p.id);
  document.getElementById('result-title').textContent = 'Property index';
  const context = [];
  if (area !== 'Gurugram') context.push(area);
  if (query) context.push(`Matching “${query}”`);
  if (filterBedrooms.value !== 'Any') context.push(`${filterBedrooms.value === '5' ? '5+' : filterBedrooms.value} BHK`);
  if (filterBudget.value !== 'Any') context.push('Published budget applied');
  if (filterSort.value !== 'featured') context.push('Custom sort');
  document.getElementById('result-context').textContent = context.join(' · ');
  listCount.textContent = `${shown.length} ${shown.length === 1 ? 'verified reference' : 'verified references'}`;
  emptyElement.hidden = shown.length > 0;

  if (!shown.length) {
    const emptyContent = [
      'No matches for these exact filters.',
      filterBudget.value !== 'Any'
        ? 'Only references with a publicly stated price appear under a budget filter. Many mandates carry “Price on request.” Clear the budget filter or ask Ajay for current terms.'
        : 'Try broadening your corridor, configuration or keyword search—or share your exact requirement with Ajay so off-market mandates can be checked.'
    ];
    document.getElementById('empty-title').textContent = emptyContent[0];
    document.getElementById('empty-message').textContent = emptyContent[1];
    document.getElementById('empty-contact').textContent = {
      Rent: 'Share your rental requirement ↗',
      Commercial: 'Discuss a commercial requirement ↗',
      Land: 'Ask about land and plots ↗'
    }[activePurpose] || 'Ask Ajay about your requirement ↗';
    document.getElementById('empty-reset').textContent = filterBudget.value !== 'Any' ? 'Include price-on-request references' : 'Clear search and filters';
  }

  const categories = CATEGORY_DEFINITIONS
    .map((category) => ({ ...category, items: shown.filter((p) => p.kind === category.kind) }))
    .filter((category) => category.items.length);

  if (categories.length && !categories.some((category) => category.kind === expandedKind)) {
    expandedKind = categories[0].kind;
  }

  listElement.innerHTML = categories.map((category) => `
    <details class="property-category" data-category="${esc(category.kind)}" ${category.kind === expandedKind ? 'open' : ''}>
      <summary class="category-summary">
        <span class="category-name">${esc(category.label)}</span>
        <span class="category-description">${esc(category.description)}</span>
        <span class="category-count">${String(category.items.length).padStart(2, '0')}<span class="count-word"> ${category.items.length === 1 ? 'reference' : 'references'}</span></span>
        <span class="category-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="property-grid">
        ${category.items.map((p, i) => `
        <article class="property-tile" data-row="${esc(p.id)}">
          <button type="button" class="property-photo" data-view-property="${esc(p.id)}" aria-label="View details for ${esc(p.name)}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.imageNote)} for ${esc(p.name)}" loading="lazy">` : '<div class="photo-fallback">Reference photograph unavailable</div>'}<span>${esc(p.imageNote)}</span></button>
          <div class="tile-index"><span>${String(i + 1).padStart(2, '0')} · ${esc(p.reference)}</span><span>${esc(p.area)}</span></div>
          <div class="tile-details">
            <div class="tile-primary"><h3>${esc(p.name)}</h3><p>${esc(p.detail)}</p></div>
            <div class="tile-terms"><strong>${esc(p.price)}</strong><span>Current terms to be confirmed</span></div>
          </div>
          <div class="tile-actions"><button type="button" class="underlined" data-view-property="${esc(p.id)}">View details ↗</button><button class="save-button" type="button" data-save="${esc(p.id)}" aria-pressed="${saved.has(p.id)}">${saved.has(p.id) ? 'Saved ✓' : '＋ Save'}</button></div>
        </article>`).join('')}
      </div>
    </details>`).join('');

  listElement.querySelectorAll('.property-photo img').forEach((img) => img.addEventListener('error', () => {
    img.hidden = true;
    const fallback = document.createElement('div');
    fallback.className = 'photo-fallback';
    fallback.textContent = 'Reference photograph unavailable';
    img.parentNode.append(fallback);
  }, { once: true }));
  updateResetVisibility();
  persistFilters();
}

listElement.addEventListener('click', (event) => {
  const summary = event.target.closest('.category-summary');
  if (!summary) return;
  const details = summary.closest('.property-category');
  if (!details) return;
  expandedKind = details.open ? null : details.dataset.category;
  if (expandedKind) {
    listElement.querySelectorAll('.property-category').forEach((other) => {
      if (other !== details) other.open = false;
    });
  }
});

purposeSelect.addEventListener('change', () => {
  activePurpose = purposeSelect.value;
  activeJourney = activePurpose === 'Rent' ? 'rental' : 'first';
  filterBedrooms.value = 'Any'; filterBudget.value = 'Any'; filterSort.value = 'featured';
  setFilterPanel(false);
  renderList();
});
areaSelect.addEventListener('change', renderList);
queryInput.addEventListener('input', renderList);
for (const field of [filterBedrooms, filterBudget, filterSort]) field.addEventListener('change', renderList);

function setFilterPanel(open) {
  const panel = document.getElementById('filter-panel'); panel.hidden = !open;
  const toggle = document.getElementById('filter-toggle');
  toggle.setAttribute('aria-expanded', String(open));
  updateResetVisibility();
}
document.getElementById('filter-toggle').addEventListener('click', () => setFilterPanel(document.getElementById('filter-panel').hidden));

function resetSearch() {
  activePurpose = 'Buy'; activeJourney = 'first'; areaSelect.value = defaultArea; queryInput.value = ''; filterBedrooms.value = 'Any'; filterBudget.value = 'Any'; filterSort.value = 'featured';
  purposeSelect.value = 'Buy';
  setFilterPanel(false);
  renderList();
}
document.getElementById('filter-clear').addEventListener('click', resetSearch);
document.getElementById('empty-reset').addEventListener('click', () => {
  if (filterBudget.value !== 'Any') {
    filterBudget.value = 'Any'; renderList();
  } else resetSearch();
});

const initialParams = new URLSearchParams(location.search);
if (['Buy', 'Rent', 'Commercial', 'Land'].includes(initialParams.get('purpose'))) activePurpose = initialParams.get('purpose');
if ([...areaSelect.options].some((o) => o.value === initialParams.get('area'))) areaSelect.value = initialParams.get('area');
queryInput.value = initialParams.get('q') || '';
for (const [key, el] of [['beds', filterBedrooms], ['budget', filterBudget], ['sort', filterSort]]) {
  if ([...el.options].some((o) => o.value === initialParams.get(key))) el.value = initialParams.get(key);
}
if (CATEGORY_DEFINITIONS.some((c) => c.kind === initialParams.get('kind'))) expandedKind = initialParams.get('kind');
purposeSelect.value = activePurpose;
activeJourney = activePurpose === 'Rent' ? 'rental' : 'first';
if (filterBedrooms.value !== 'Any' || filterBudget.value !== 'Any' || filterSort.value !== 'featured') setFilterPanel(true);
renderList();

// Single-property viewing room; one sourced reference at a time.
const galleryList = document.getElementById('gallery-list');
const galleryImage = document.getElementById('gallery-image');
const galleryNote = document.getElementById('gallery-image-note');
const galleryName = document.getElementById('gallery-name');
const galleryArea = document.getElementById('gallery-area');
const galleryKind = document.getElementById('gallery-kind');
const galleryDetail = document.getElementById('gallery-detail');
const galleryPrice = document.getElementById('gallery-price');
const galleryEnquire = document.getElementById('gallery-enquire');
let activeGallery = 0;
let activeGalleryTab = 'checks';

function renderGalleryNavList() {
  const currentId = inventory[activeGallery]?.id;
  const navIds = browsingIds.length ? browsingIds.slice(0, 24) : inventory.slice(0, 12).map((p) => p.id);
  if (currentId && !navIds.includes(currentId)) navIds[navIds.length - 1] = currentId;
  galleryList.innerHTML = navIds.map((pid, idx) => {
    const idxInInv = inventory.findIndex((x) => x.id === pid);
    const item = inventory[idxInInv];
    if (!item) return '';
    return `<button type="button" data-property="${idxInInv}" aria-pressed="${idxInInv === activeGallery}"><span class="gallery-item-number">${String(idx + 1).padStart(2, '0')}</span>${esc(item.name)}<span>${esc(item.area)}</span></button>`;
  }).join('');
}

galleryList.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-property]');
  if (b) showProperty(Number(b.dataset.property));
});

function showGalleryTab() {
  const p = inventory[activeGallery];
  if (!p) return;
  document.querySelectorAll('[data-gallery-tab]').forEach((b) => {
    const selected = b.dataset.galleryTab === activeGalleryTab;
    b.setAttribute('aria-selected', String(selected));
    b.tabIndex = selected ? 0 : -1;
  });
  const target = document.getElementById('gallery-tab-content');
  target.setAttribute('aria-labelledby', 'tab-' + activeGalleryTab);
  if (activeGalleryTab === 'facts') {
    target.innerHTML = `<p class="tab-lead">Source and limitations</p><dl class="gallery-facts"><div><dt>Public reference</dt><dd>${esc(p.reference || 'Not stated')}</dd></div><div><dt>Corridor</dt><dd>${esc(p.corridor || 'Gurugram')}</dd></div><div><dt>Photograph</dt><dd>${esc(p.imageNote)}</dd></div></dl>${p.description ? `<p class="fineprint">${esc(p.description)}</p>` : ''}<p class="fineprint">Exact unit number, live availability, title deeds and complete landed terms are re-confirmed by Ajay Mukhija prior to inspection.</p><a class="underlined" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.area)}">Explore the general area ↗</a>`;
  } else if (activeGalleryTab === 'checks') {
    const chosen = Array.isArray(selectedQuestions[p.id]) ? selectedQuestions[p.id] : [];
    target.innerHTML = `<p class="tab-lead">Prepare for a useful viewing.</p><p>Choose what you would like Ajay to confirm. A selected question is not a verified fact.</p><div class="question-list">${questionBank.map((q, i) => `<label><input type="checkbox" data-question="${i}" ${chosen.includes(i) ? 'checked' : ''}><span>${esc(q)}</span></label>`).join('')}</div><button class="underlined" type="button" data-enquire="${esc(p.id)}">Enquire with selected questions ↗</button><p class="fineprint">Selections stay on this device until you choose to share them.</p>`;
  } else if (activeGalleryTab === 'notes') {
    target.innerHTML = `<p class="tab-lead">Your private decision notes</p><p>Record questions, observations or deal-breakers. These notes are saved locally in this browser until you include them in an enquiry.</p><label for="gallery-personal-notes" class="fineprint">Notes on this property</label><textarea class="personal-notes" id="gallery-personal-notes" placeholder="What matters to me about this property?"></textarea><p class="notes-status" role="status">Saved locally as you type</p><button type="button" class="underlined" data-enquire="${esc(p.id)}">Include notes in an enquiry ↗</button>`;
    const notes = target.querySelector('#gallery-personal-notes');
    notes.value = typeof personalNotes[p.id] === 'string' ? personalNotes[p.id] : '';
    notes.addEventListener('input', () => {
      personalNotes[p.id] = notes.value;
      writeStored('aum-study-notes-v5', personalNotes);
    });
  } else {
    target.innerHTML = `<p class="tab-lead">A named person, not an anonymous form.</p><p>Ask Ajay Mukhija about current availability, exact unit details and the trade-offs that matter to you.</p><a class="underlined" href="tel:+919873813595">Call +91 98738 13595 ↗</a><button type="button" class="underlined" data-enquire="${esc(p.id)}">Prepare a property enquiry ↗</button>`;
  }
}

function showProperty(index) {
  if (!inventory.length) return;
  activeGallery = ((index % inventory.length) + inventory.length) % inventory.length;
  const p = inventory[activeGallery];
  if (!browsingIds.includes(p.id)) browsingIds = browsingSelection(p.id);
  const currentPosition = Math.max(0, browsingIds.indexOf(p.id));
  document.getElementById('gallery-image-fallback').hidden = Boolean(p.image);
  galleryImage.hidden = !p.image;
  if (p.image) {
    galleryImage.src = p.image;
    galleryImage.alt = `${p.imageNote} for ${p.name}`;
  }
  galleryNote.textContent = p.imageNote;
  galleryName.textContent = p.name;
  galleryArea.textContent = `${p.area} · Ref ${p.reference}`;
  galleryKind.textContent = p.kind;
  galleryDetail.textContent = p.detail;
  galleryPrice.textContent = p.price;
  galleryEnquire.dataset.enquire = p.id;
  document.getElementById('gallery-share').textContent = 'Copy property link';
  document.getElementById('gallery-position').textContent = `${String(currentPosition + 1).padStart(2, '0')} / ${String(browsingIds.length).padStart(2, '0')}`;
  document.getElementById('gallery-prev').disabled = currentPosition === 0;
  document.getElementById('gallery-next').disabled = currentPosition === browsingIds.length - 1;
  const gallerySave = document.getElementById('gallery-save');
  gallerySave.textContent = saved.has(p.id) ? 'Saved ✓' : 'Save to compare ＋';
  gallerySave.setAttribute('aria-pressed', String(saved.has(p.id)));
  renderGalleryNavList();
  showGalleryTab();
  if (!document.getElementById('view').hidden) {
    const url = new URL(location.href); url.searchParams.set('property', p.id); history.replaceState(null, '', url);
  }
}

galleryImage.addEventListener('error', () => { galleryImage.hidden = true; document.getElementById('gallery-image-fallback').hidden = false; });
function moveWithinSelection(delta) {
  const i = browsingIds.indexOf(inventory[activeGallery].id) + delta;
  if (i >= 0 && i < browsingIds.length) showProperty(inventory.findIndex((p) => p.id === browsingIds[i]));
}
document.getElementById('gallery-next').addEventListener('click', () => moveWithinSelection(1));
document.getElementById('gallery-prev').addEventListener('click', () => moveWithinSelection(-1));
document.getElementById('gallery-save').addEventListener('click', () => toggleSaved(inventory[activeGallery].id));
document.querySelectorAll('[data-gallery-tab]').forEach((button) => {
  button.addEventListener('click', () => { activeGalleryTab = button.dataset.galleryTab; showGalleryTab(); });
  button.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = [...document.querySelectorAll('[data-gallery-tab]')];
    const index = tabs.indexOf(button);
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); activeGalleryTab = tabs[next].dataset.galleryTab; showGalleryTab();
  });
});
document.getElementById('gallery-share').addEventListener('click', async (e) => {
  const url = new URL(location.href);
  url.searchParams.set('view', 'view'); url.searchParams.set('property', inventory[activeGallery].id);
  try {
    await navigator.clipboard.writeText(url.toString());
    e.currentTarget.textContent = 'Link copied ✓';
  } catch {
    e.currentTarget.textContent = 'Use the address bar to copy the link';
  }
});

const initialGalleryIndex = inventory.findIndex((p) => p.id === initialParams.get('property'));
browsingIds = initialGalleryIndex >= 0 ? browsingSelection(inventory[initialGalleryIndex].id) : (visibleIds.length ? [...visibleIds] : inventory.map((p) => p.id));
showProperty(initialGalleryIndex < 0 ? 0 : initialGalleryIndex);

document.querySelectorAll('[data-source-link]').forEach((a) => { a.href = sourceUrl; });

// Live Master Backend Refresh (seamlessly syncs newly published CRM mandates when served over HTTP)
if (/^https?:$/i.test(location.protocol)) {
  fetch('/api/public/properties?limit=500')
    .then((r) => (r.ok ? r.json() : null))
    .then((payload) => {
      if (!payload || !payload.ok || !Array.isArray(payload.items) || !payload.items.length) return;
      const currentPropId = inventory[activeGallery]?.id;
      const liveItems = payload.items.map(mapPublicRecordToStudyItem);
      liveItems.sort((a, b) => (Number(b.featured) - Number(a.featured)) || a.id.localeCompare(b.id));
      inventory = liveItems;
      renderList();
      const nextIdx = currentPropId ? inventory.findIndex((p) => p.id === currentPropId) : 0;
      browsingIds = nextIdx >= 0 ? browsingSelection(inventory[nextIdx].id) : (visibleIds.length ? [...visibleIds] : inventory.map((p) => p.id));
      showProperty(nextIdx >= 0 ? nextIdx : 0);
      refreshSavedUI();
    })
    .catch(() => { /* Graceful offline / static fallback */ });
}

// Shared information architecture across the 5 design directions.
const mega = document.getElementById('mega');
mega.setAttribute('role', 'dialog');
mega.setAttribute('aria-modal', 'true');
const sheet = document.getElementById('detail-sheet');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const sheetContent = document.getElementById('sheet-content');
const primaryContent = document.getElementById('primary');
let lastFocused = null;
let menuOpener = null;
function setMenu(open) {
  const wasOpen = !mega.hidden;
  mega.hidden = !open;
  document.body.classList.toggle('menu-open', open);
  primaryContent.inert = open || !sheet.hidden;
  document.querySelectorAll('[data-menu-open]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open) { menuOpener = document.activeElement; closeSheet(); document.getElementById('menu-close').focus(); }
  else if (wasOpen && menuOpener && menuOpener.isConnected && mega.contains(document.activeElement)) { menuOpener.focus(); }
}
function openSheet(content) {
  const origin = document.activeElement;
  setMenu(false);
  lastFocused = origin && origin.isConnected && !mega.contains(origin) ? origin : document.querySelector('.menu-trigger');
  sheetContent.innerHTML = content;
  sheet.hidden = false; sheetBackdrop.hidden = false;
  primaryContent.inert = true;
  document.body.classList.add('sheet-open');
  document.getElementById('sheet-close').focus();
}
function closeSheet() {
  const wasOpen = !sheet.hidden;
  sheet.hidden = true; sheetBackdrop.hidden = true;
  primaryContent.inert = !mega.hidden;
  document.body.classList.remove('sheet-open');
  if (wasOpen && lastFocused && lastFocused.isConnected) lastFocused.focus();
}

function openConsult(includeSaved = false, propertyId = null) {
  const selected = includeSaved ? inventory.filter((p) => saved.has(p.id)) : [];
  const property = inventory.find((p) => p.id === propertyId);
  const initialIntent = property ? (property.purposeList.includes('Rent') ? 'Rent' : 'Buy') : activePurpose === 'Rent' ? 'Rent' : activePurpose === 'Commercial' ? 'Explore' : 'Buy';
  openSheet(`<p class="eyebrow">AUM ESTATES / DIRECT GUIDANCE</p><h2>Speak with Ajay Mukhija.</h2><p>Start with the decision you need to make. Share your priorities, record your enquiry with the advisory desk, and review the message before opening WhatsApp.</p><div class="consult-contact"><strong>Ajay Mukhija</strong><span>AUM Estates · Gurugram (Est. 2002)</span><a href="tel:+919811157018">+91 98111 57018 ↗</a></div><form id="consult-form" class="consult-form"><div class="consult-fields"><div class="field"><label for="consult-name">Your name</label><input id="consult-name" name="client_name" placeholder="Full name"></div><div class="field"><label for="consult-phone">Phone or WhatsApp</label><input id="consult-phone" name="client_phone" placeholder="+91 …"></div></div><div class="consult-fields"><div class="field"><label for="consult-purpose">I want to</label><select id="consult-purpose" name="purpose"><option>Buy</option><option>Rent</option><option>Sell</option><option>Lease out</option><option>Explore</option></select></div><div class="field"><label for="consult-location">Preferred location</label><input id="consult-location" name="location" value="${esc(property ? property.area : areaSelect.value === 'All areas' ? 'Gurugram' : areaSelect.value)}" placeholder="Where are you looking?"></div></div><div class="field"><label for="consult-situation">My situation</label><select id="consult-situation" name="situation"><option>First home</option><option>Reliable rental</option><option>Moving with family</option><option>Property investment</option><option>Other</option></select></div><button type="button" class="underlined consult-add" id="consult-add" aria-expanded="false">Add budget and priorities ＋</button><div id="consult-extra" hidden><div class="field"><label for="consult-budget">Approximate budget, if useful</label><input id="consult-budget" name="budget" placeholder="Optional (e.g. ₹4–6 Cr)"></div><div class="field"><label for="consult-notes">Questions or non-negotiables</label><textarea id="consult-notes" name="notes" placeholder="Commute, family needs, tenancy terms, documents, timing, or a property to discuss"></textarea></div></div><button type="submit" class="solid-button">Review &amp; record enquiry ↗</button></form><div id="consult-review" class="consult-review" hidden><h3>Review before sending</h3><p id="consult-crm-status">Your editable message draft is ready below.</p><label for="consult-message">Message to AUM Estates</label><textarea id="consult-message"></textarea><div class="consult-review-actions"><button type="button" class="underlined" id="consult-copy">Copy message</button><a class="solid-button" id="consult-whatsapp" href="#" target="_blank" rel="noopener noreferrer">Open in WhatsApp ↗</a></div></div><p class="fineprint">Advisory Desk: C-210, Nirvana Courtyard, Sector 50, Gurugram · WhatsApp +91 98738 13595.</p>`);

  const form = sheetContent.querySelector('#consult-form');
  form.elements.purpose.value = initialIntent;
  form.elements.situation.insertAdjacentHTML('afterbegin', '<option value="">Select if relevant (optional)</option>');
  form.elements.situation.value = activeJourney === 'rental' && !includeSaved ? 'Reliable rental' : '';
  const notes = sheetContent.querySelector('#consult-notes');
  const noteLines = [];
  const chosenQuestionTexts = [];
  if (property) {
    noteLines.push('Please confirm current details for ' + property.name + (property.reference ? ' (' + property.reference + ')' : '') + '.');
    const questions = Array.isArray(selectedQuestions[property.id]) ? selectedQuestions[property.id] : [];
    if (questions.length) {
      questions.forEach((i) => { if (questionBank[i]) chosenQuestionTexts.push(questionBank[i]); });
      noteLines.push('Questions: ' + chosenQuestionTexts.join(' '));
    }
    if (typeof personalNotes[property.id] === 'string' && personalNotes[property.id].trim()) {
      noteLines.push('My notes: ' + personalNotes[property.id].trim());
    }
  }
  if (selected.length) {
    noteLines.push('Please help compare these published references: ' + selected.map((p) => p.name + (p.reference ? ' (' + p.reference + ')' : '')).join('; ') + '.');
  }
  if (noteLines.length) {
    notes.value = noteLines.join('\n');
    sheetContent.querySelector('#consult-extra').hidden = false;
    sheetContent.querySelector('#consult-add').textContent = 'Hide optional context −';
    sheetContent.querySelector('#consult-add').setAttribute('aria-expanded', 'true');
  }
  sheetContent.querySelector('#consult-add').addEventListener('click', (e) => {
    const extra = sheetContent.querySelector('#consult-extra');
    extra.hidden = !extra.hidden;
    e.currentTarget.textContent = extra.hidden ? 'Add budget and priorities ＋' : 'Hide optional context −';
    e.currentTarget.setAttribute('aria-expanded', String(!extra.hidden));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const clientName = String(f.get('client_name') || '').trim();
    const clientPhone = String(f.get('client_phone') || '').trim();
    const purpose = String(f.get('purpose'));
    const situation = String(f.get('situation'));
    const area = String(f.get('location') || '').trim();
    const budget = String(f.get('budget') || '').trim();
    const details = String(f.get('notes') || '').trim();
    const intentPhrase = { Buy: 'buying', Rent: 'renting', Sell: 'selling', 'Lease out': 'leasing out', Explore: 'exploring' }[purpose] || 'considering';
    const messages = [`Hello AUM ESTATES,${clientName ? ` I am ${clientName} and` : ''} I would like advice about ${intentPhrase} property.`];
    if (situation && situation !== 'Other') messages.push(`My situation is: ${situation.toLowerCase()}.`);
    if (area) messages.push(`Preferred location: ${area}.`);
    if (budget) messages.push(`Approximate budget: ${budget}.`);
    if (details) messages.push(`What matters to me: ${/[.!?]$/.test(details) ? details : details + '.'}`);
    messages.push('Please let me know what information we should confirm and how to proceed.');
    const messageEl = sheetContent.querySelector('#consult-message');
    messageEl.value = messages.join(' ');
    const review = sheetContent.querySelector('#consult-review');
    review.hidden = false;
    form.querySelector('[type="submit"]').textContent = 'Review & record enquiry ↗';
    const wa = sheetContent.querySelector('#consult-whatsapp');
    wa.href = whatsapp(messageEl.value);
    review.scrollIntoView({ block: 'nearest' });

    const statusLine = sheetContent.querySelector('#consult-crm-status');
    if (/^https?:$/i.test(location.protocol)) {
      try {
        const resp = await fetch('/api/public/inquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: clientName || 'Property Index Visitor',
            client_phone: clientPhone || null,
            intent: purpose,
            situation: situation || null,
            preferred_location: area || 'Gurugram',
            budget_text: budget || null,
            property_id: property ? property.reference : (selected[0]?.reference || null),
            saved_property_ids: [...saved],
            selected_questions: chosenQuestionTexts,
            source_channel: 'v16_consult',
            source_page: 'brand_study_v16',
            message: messageEl.value
          })
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && data.ok) {
          statusLine.textContent = `Logged with Ajay's advisory desk (Ref: ${data.lead_id}). You can edit and send on WhatsApp below.`;
        }
      } catch {
        statusLine.textContent = 'Your editable WhatsApp message draft is ready below.';
      }
    }
  });

  const review = sheetContent.querySelector('#consult-review');
  const markDirty = () => {
    if (!review.hidden) { review.hidden = true; form.querySelector('[type="submit"]').textContent = 'Update message draft ↗'; }
  };
  form.addEventListener('input', markDirty);
  form.addEventListener('change', markDirty);
  sheetContent.querySelector('#consult-message').addEventListener('input', (e) => {
    sheetContent.querySelector('#consult-whatsapp').href = whatsapp(e.currentTarget.value);
  });
  sheetContent.querySelector('#consult-copy').addEventListener('click', async (e) => {
    const message = sheetContent.querySelector('#consult-message');
    try { await navigator.clipboard.writeText(message.value); e.currentTarget.textContent = 'Copied ✓'; }
    catch { message.focus(); message.select(); e.currentTarget.textContent = 'Select message to copy'; }
  });
}

document.querySelectorAll('[data-menu-open]').forEach((b) => b.addEventListener('click', () => setMenu(mega.hidden)));
document.getElementById('menu-close').addEventListener('click', () => setMenu(false));
mega.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const controls = [...mega.querySelectorAll('button:not([disabled]),a[href]')].filter((el) => el.getClientRects().length);
  if (!controls.length) return;
  if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) { e.preventDefault(); controls[0].focus(); }
});
document.getElementById('sheet-close').addEventListener('click', closeSheet);
sheetBackdrop.addEventListener('click', closeSheet);
sheet.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const controls = [...sheet.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')].filter((el) => el.getClientRects().length);
  if (!controls.length) return;
  if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) { e.preventDefault(); controls[0].focus(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!sheet.hidden) closeSheet(); else if (!mega.hidden) setMenu(false); }
});

function goTo(nav) {
  setMenu(false); closeSheet();
  if (['buy', 'rent', 'commercial', 'land'].includes(nav)) {
    const map = { buy: 'Buy', rent: 'Rent', commercial: 'Commercial', land: 'Land' };
    activePurpose = map[nav];
    activeJourney = activePurpose === 'Rent' ? 'rental' : 'first';
    purposeSelect.value = activePurpose;
    areaSelect.value = defaultArea; queryInput.value = ''; filterBedrooms.value = 'Any'; filterBudget.value = 'Any'; filterSort.value = 'featured';
    setFilterPanel(false);
    showScreen('index'); renderList();
    document.getElementById('index-search').scrollIntoView({ block: 'start' });
  } else if (['index', 'view'].includes(nav)) showScreen(nav);
  else if (nav === 'consult') openConsult();
  else if (nav === 'approach') {
    showScreen('index');
    document.querySelector('.service-principles').scrollIntoView({ block: 'start' });
  } else if (nav === 'locations') {
    const corridorDefs = [
      ['Golf Course Road', 'DLF Phases I–V, Sector 42, 43, 53, 54'],
      ['Golf Course Extension', 'Sectors 58–67, Nirvana Country, Sector 50'],
      ['Dwarka Expressway', 'Sectors 99–115, Diplomatic Corridor'],
      ['Southern Peripheral Road (SPR)', 'Sectors 68–79, Privana Belt'],
      ['New Gurgaon', 'Sectors 80–95'],
      ['Central Gurgaon & HUDA Sectors', 'Established HUDA Sectors, Plots & Floors'],
      ['Sohna & Aravalli Belt', 'South of Gurgaon & Aravalli Foothills'],
      ['South Goa', 'Majorda & Coastal Villa Mandates']
    ];
    openSheet(`<p class="eyebrow">EXPLORE BY CORRIDOR</p><h2>Where are you looking?</h2><p>Browse verified public mandates across Gurugram's primary micro-markets and South Goa, or discuss off-market availability directly with Ajay.</p><div class="location-links">${corridorDefs.map(([name, description]) => {
      const cnt = inventory.filter((p) => areaMatches(p, name)).length;
      return `<button type="button" data-location="${esc(name)}"><strong>${esc(name)}</strong><span>${esc(description)} · ${cnt} mandates</span><b aria-hidden="true">↗</b></button>`;
    }).join('')}</div><button type="button" class="underlined" data-nav="consult">Looking elsewhere? Speak with Ajay ↗</button>`);
  } else if (nav === 'about') {
    openSheet(`<p class="eyebrow">ABOUT AUM ESTATES</p><h2>A property decision should stand up to a second look.</h2><p>Founded by Ajay Mukhija in 2002, AUM Estates is a Gurugram-based property advisory. Our approach is straightforward: understand each client's circumstances, compare complete landed costs and practical trade-offs, and distinguish clearly between published facts and items that still require verification.</p><div class="sheet-people"><p><strong>Ajay Mukhija</strong><br>Founder &amp; Principal Advisor · AUM Estates</p><p>C-210, Nirvana Courtyard<br>Sector 50, Gurugram</p><a class="underlined" href="tel:+919811157018">+91 98111 57018 (Direct) ↗</a><br><a class="underlined" href="tel:+919873813595">+91 98738 13595 (WhatsApp Desk) ↗</a></div><button class="solid-button" data-nav="consult">Talk through your requirements ↗</button>`);
  } else if (nav === 'disclaimer') {
    openSheet(`<p class="eyebrow">FIDUCIARY DISCLOSURE &amp; SOURCES</p><h2>What is published—and what still needs verification.</h2><p>The Property Index connects to AUM Estates' verified public inventory (${inventory.length} active mandates), strictly separated from confidential seller records by the Fiduciary Privacy Gate.</p><p>Most photographs are representative project or locality references. Do not infer exact unit numbers, live availability, legal title clearance or final transaction terms without direct confirmation prior to viewing.</p><a class="underlined" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Open full production directory ↗</a>`);
  }
}

document.addEventListener('click', (e) => {
  const enquire = e.target.closest('[data-enquire]');
  if (enquire) { openConsult(false, enquire.dataset.enquire); return; }
  const nav = e.target.closest('[data-nav]');
  if (nav) { goTo(nav.dataset.nav); return; }
  const locationButton = e.target.closest('[data-location]');
  if (locationButton) {
    areaSelect.value = locationButton.dataset.location;
    activePurpose = 'Buy'; activeJourney = 'first';
    queryInput.value = ''; filterBedrooms.value = 'Any'; filterBudget.value = 'Any'; filterSort.value = 'featured';
    purposeSelect.value = 'Buy';
    setFilterPanel(false);
    closeSheet(); showScreen('index'); renderList();
    document.getElementById('index-properties').scrollIntoView({ block: 'start' }); return;
  }
  const toViewing = e.target.closest('[data-view-property]');
  if (toViewing) {
    const i = inventory.findIndex((p) => p.id === toViewing.dataset.viewProperty);
    if (i >= 0) { browsingIds = browsingSelection(toViewing.dataset.viewProperty); showScreen('view'); showProperty(i); } return;
  }
  const save = e.target.closest('[data-save]');
  if (save) { toggleSaved(save.dataset.save); return; }
  if (e.target.closest('[data-shortlist]')) { openShortlist(); return; }
  const remove = e.target.closest('[data-remove-saved]');
  if (remove) { toggleSaved(remove.dataset.removeSaved); openShortlist(); return; }
  if (e.target.closest('[data-request-saved]')) {
    openConsult(true); return;
  }
});

document.addEventListener('change', (e) => {
  const checkbox = e.target.closest('[data-question]');
  if (!checkbox) return;
  const p = inventory[activeGallery];
  const values = new Set(Array.isArray(selectedQuestions[p.id]) ? selectedQuestions[p.id] : []);
  const index = Number(checkbox.dataset.question);
  if (checkbox.checked) values.add(index); else values.delete(index);
  selectedQuestions[p.id] = [...values].sort((a, b) => a - b);
  writeStored('aum-study-questions-v5', selectedQuestions);
});

function refreshSavedUI() {
  const count = saved.size;
  document.querySelectorAll('.saved-count').forEach((el) => { el.textContent = String(count); });
  document.querySelectorAll('.shortlist-trigger').forEach((el) => { el.hidden = count === 0; });
  document.querySelectorAll('[data-save]').forEach((button) => {
    const selected = saved.has(button.dataset.save);
    button.textContent = selected ? 'Saved ✓' : '＋ Save';
    button.setAttribute('aria-pressed', String(selected));
  });
  const p = inventory[activeGallery];
  if (p) {
    const button = document.getElementById('gallery-save');
    button.textContent = saved.has(p.id) ? 'Saved ✓' : 'Save to compare ＋';
    button.setAttribute('aria-pressed', String(saved.has(p.id)));
  }
  try { localStorage.setItem('aum-study-saved', JSON.stringify([...saved])); } catch {}
}

function toggleSaved(id) {
  if (saved.has(id)) saved.delete(id);
  else if (saved.size < 3) saved.add(id);
  else { openShortlist(true); return; }
  refreshSavedUI();
}

function openShortlist(isFull = false) {
  const choices = inventory.filter((p) => saved.has(p.id));
  const rows = [
    ['Location', (p) => esc(p.area)],
    ['Corridor', (p) => esc(p.corridor)],
    ['Type', (p) => esc(p.kind)],
    ['Configuration', (p) => esc(p.detail)],
    ['Published price', (p) => esc(p.price)],
    ['Source reference', (p) => esc(p.reference || 'Not stated')],
    ['Current terms', () => 'Confirm with Ajay prior to viewing']
  ];
  openSheet(`<p class="eyebrow">PERSONAL COMPARISON / ON THIS DEVICE</p><h2>Saved properties</h2><p>${isFull ? 'You can compare up to three references. Remove one before saving another.' : 'Save up to three references to compare their published details side by side.'}</p>${choices.length === 0 ? '<p class="sheet-empty">No properties saved yet. Save a property from the index or detail page.</p>' : `<div class="comparison-scroll"><table class="comparison"><thead><tr><th scope="col">Attribute</th>${choices.map((p) => `<th scope="col">${esc(p.name)}<button class="remove-saved" type="button" data-remove-saved="${esc(p.id)}">Remove ×</button></th>`).join('')}</tr></thead><tbody>${rows.map(([name, get]) => `<tr><th scope="row">${esc(name)}</th>${choices.map((p) => `<td>${get(p)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}<p class="fineprint">Ask Ajay Mukhija for a comparable, current specification and landed cost breakdown before choosing.</p><button type="button" class="underlined" ${choices.length ? 'data-request-saved' : 'data-nav="consult"'}>Discuss these saved options with Ajay ↗</button>`);
}
refreshSavedUI();
