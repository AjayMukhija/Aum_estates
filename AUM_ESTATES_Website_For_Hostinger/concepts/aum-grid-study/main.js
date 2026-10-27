// Design-study inventory: a curated sample from the approved public AUM ESTATES page.
// It is intentionally not described as a live feed. Unknown values stay unknown.
const sourceBase = 'https://aumestates.com';
const inventory = [
  {id:'AUM-WEB-000142',name:'Privana South',area:'Gurugram',location:'Gurugram, Haryana',type:'Apartment',category:'residential',description:'Residential apartment opportunity. Ask for the current unit and configuration.',price:'Price on request',amount:null,image:'/assets/project-images/privana.jpg'},
  {id:'AUM-WEB-000113',name:'Urban Oasis',area:'Gurugram',location:'Gurugram, Haryana',type:'Apartment',category:'residential',description:'Residential options in 2 and 3 BHK configurations. Confirm the current offering.',price:'Price on request',amount:null,image:'/assets/project-images/urban-oasis.jpg'},
  {id:'AUM-WEB-000167',name:'Puri The Aravallis',area:'Sector 61',location:'Sector 61, Gurugram',type:'Apartment',category:'residential',description:'3 BHK, Tower B · approximately 2,250 sq ft.',price:'Price on request',amount:null,image:'/assets/project-images/puri-the-aravalis.jpg'},
  {id:'AUM-WEB-000309',name:'Guest House · Sector 46',area:'Sector 46',location:'Sector 46, Gurugram',type:'Commercial',category:'commercial',description:'Guest house property. Specifications and current terms available on enquiry.',price:'Price on request',amount:null,image:'/assets/property-images/commercial.jpg'},
  {id:'AUM-APP-0001',name:'Sukoon by ASYA SmartLiving',area:'Goa',location:'Majorda, South Goa',type:'Villa',category:'residential',description:'Private-villa project · 3 and 4 BHK options.',price:'3 BHK ₹7 Cr · 4 BHK ₹9 Cr',amount:70000000,image:'/assets/sukoon-asya-project-photo.png',supplied:true},
  {id:'AUM-APP-ALDEA',name:'Aldea de Goa',area:'Goa',location:'Goa, India',type:'Villa',category:'residential',description:'Residential project opportunity. Specific unit details available on request.',price:'Price on request',amount:null,image:'/assets/project-images/arrossim.jpg'},
  {id:'AUM-WEB-DLF-GROOVE',name:'DLF Grove',area:'DLF',location:'Gurugram, Haryana',type:'Apartment',category:'residential',description:'Residential opportunity. Contact the team for available unit details.',price:'Price on request',amount:null,image:'/assets/property-images/dlf-grove.jpg'},
  {id:'AUM-WEB-000194',name:'Conscient Elevate',area:'Gurugram',location:'Sector 59, Gurugram',type:'Apartment',category:'residential',description:'3 BHK with servant room · approximately 2,595 sq ft.',price:'Price on request',amount:null,image:'/assets/property-images/elevate-by-hines.webp'},
  {id:null,name:'Nirvana Deerwood',area:'Nirvana Country',location:'Nirvana Country, Gurugram',type:'Villa',category:'residential',description:'Simplex villa · approximately 360 sq yd, on a 12-metre road.',price:'Price on request',amount:null,image:'/assets/property-images/nirvana-villa.jpg'}
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {intent:'buy',location:'',type:'',budget:'',sort:'default'};

function safeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

function enquireHref(item) {
  const note = `Hello AUM ESTATES, I'd like current details and availability for ${item.name}${item.id ? ` (${item.id})` : ''}.`;
  return `https://wa.me/919873813595?text=${encodeURIComponent(note)}`;
}

function propertyCard(item, index) {
  const img = `${sourceBase}${item.image}`;
  const number = String(index + 1).padStart(2,'0');
  return `<article class="property-card">
    <a class="property-image" href="${sourceBase}/approved-properties/index.html" target="_blank" rel="noopener noreferrer" aria-label="View original approved inventory for ${safeText(item.name)}"><img src="${img}" alt="${item.supplied ? 'AUM ESTATES-supplied project photograph' : 'Representative property reference image'}" loading="lazy" onerror="this.parentElement.classList.add('image-missing');this.style.display='none'"></a>
    <p class="property-number">REFERENCE / ${number}${item.supplied ? ' · PROJECT PHOTO' : ' · REPRESENTATIVE IMAGE'}</p>
    <div class="property-meta"><span>${safeText(item.location)}</span><span class="type">${safeText(item.type)}</span></div>
    <h3>${safeText(item.name)}</h3>
    <p class="property-detail">${safeText(item.description)}</p>
    <div class="property-bottom"><span class="property-price">${safeText(item.price)}</span><a href="${enquireHref(item)}" target="_blank" rel="noopener noreferrer" aria-label="Enquire about ${safeText(item.name)}">Enquire ↗</a></div>
  </article>`;
}

function currentFiltered() {
  let items = inventory.filter(item => {
    if(state.intent === 'rent' || state.intent === 'land') return false; // no confirmed public sample for these intents
    if(state.intent === 'commercial' && item.category !== 'commercial') return false;
    if(state.intent === 'buy' && item.category !== 'residential') return false;
    if(state.location) {
      const searchable = `${item.area} ${item.location} ${item.name}`.toLowerCase();
      if(!searchable.includes(state.location.toLowerCase())) return false;
    }
    if(state.type && item.type !== state.type) return false;
    if(state.budget === 'known' && item.amount == null) return false;
    if(state.budget && state.budget !== 'known' && (item.amount == null || item.amount > Number(state.budget))) return false;
    return true;
  });
  if(state.sort === 'az') items = items.sort((a,b) => a.name.localeCompare(b.name));
  if(state.sort === 'za') items = items.sort((a,b) => b.name.localeCompare(a.name));
  return items;
}

const intentLabels = {buy:'Buy',rent:'Rent',commercial:'Commercial',land:'Plots & Land'};
const budgetLabels = {'50000000':'Up to ₹5 Cr','100000000':'Up to ₹10 Cr',known:'Price disclosed'};

function renderChips() {
  const filters = [
    ['intent',intentLabels[state.intent]],
    ...(state.location ? [['location',state.location]] : []),
    ...(state.type ? [['type',state.type]] : []),
    ...(state.budget ? [['budget',budgetLabels[state.budget]]] : [])
  ];
  $('#activeChips').innerHTML = filters.map(([key,label]) => `<button class="chip" data-clear="${key}" aria-label="Remove ${safeText(label)} filter">${safeText(label)} <span aria-hidden="true">×</span></button>`).join('');
}

function renderResults() {
  const items = currentFiltered();
  $('#resultsGrid').innerHTML = items.map(propertyCard).join('');
  const count = `${items.length} ${items.length === 1 ? 'example' : 'examples'} in this sample`;
  $('#resultCount').textContent = count;
  $('#mobileResultCount').textContent = count;
  $('#resultsGrid').hidden = items.length === 0;
  $('#emptyResults').hidden = items.length !== 0;
  const missingSample = state.intent === 'rent' || state.intent === 'land';
  $('#emptyResults h2').textContent = missingSample
    ? `${state.intent === 'rent' ? 'Rental' : 'Land'} examples are not included in this small public sample.`
    : 'No matching examples in this small sample.';
  $('#emptyResults p').textContent = missingSample
    ? 'This is not an availability statement. Share your criteria with AUM ESTATES, or explore the full original inventory.'
    : "That doesn't mean nothing is available. Ask the team about your requirements, or broaden the filters.";
  $('#resultsTitle').textContent = state.intent === 'commercial' ? 'Commercial property.' : state.intent === 'land' ? 'Land and plots.' : state.intent === 'rent' ? 'Find a place to rent.' : 'Find your next place.';
  renderChips();
  syncControls();
}

function syncControls() {
  $('#filterIntent').value = state.intent;
  $('#filterLocation').value = [...$('#filterLocation').options].some(option => option.value === state.location) ? state.location : '';
  $('#filterType').value = state.type;
  $('#filterBudget').value = state.budget;
  $('#sortResults').value = state.sort;
}

function updateFromControls() {
  state.intent = $('#filterIntent').value;
  state.location = $('#filterLocation').value;
  state.type = $('#filterType').value;
  state.budget = $('#filterBudget').value;
  state.sort = $('#sortResults').value;
  renderResults();
}

function closeMobileMenu() {
  $('#mobileMenu').hidden = true;
  $('#menuToggle').setAttribute('aria-expanded','false');
}

function closeFilters() {
  $('#filterPanel').classList.remove('open');
  $('#openFilters').setAttribute('aria-expanded','false');
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
  Object.entries(views).forEach(([name, selector]) => { $(selector).hidden = name !== view; });
  document.body.classList.toggle('home-mode', view === 'home');
  closeMobileMenu();
  closeFilters();
  if(push) history.pushState({view}, '', `#${view}`);
  window.scrollTo({top: 0, behavior: 'instant'});
}

function showHome(push = true) {
  displayView('home', push);
}

function showResults(settings = {}, push = true) {
  Object.assign(state,settings);
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
  $('#advisorKicker').textContent = forOwner ? 'FOR PROPERTY OWNERS' : 'TALK TO A PERSON';
  $('#advisorTitle').innerHTML = forOwner ? 'List a property.<br>Begin with the details.' : 'A conversation<br>is a good start.';
  $('#advisorDescription').textContent = forOwner
    ? 'Tell AUM ESTATES what you own, where it is, and whether you want to sell or lease. The next step is a focused conversation.'
    : "Explain what you're considering. The team can help identify the important details and next steps.";
  displayView('advisor', false);
  if(push) history.pushState({view:'advisor',purpose},'',forOwner ? '#advisor-listing' : '#advisor');
}

function enquiryLink(message) {
  return `https://wa.me/919873813595?text=${encodeURIComponent(message)}`;
}

function resetFilters() {
  Object.assign(state,{intent:'buy',location:'',type:'',budget:'',sort:'default'});
  renderResults();
}

document.addEventListener('DOMContentLoaded',() => {
  $('#buyerContact').href = enquiryLink("Hello AUM ESTATES, I'd like help finding a property. Can we discuss my requirements?");
  $('#ownerContact').href = enquiryLink("Hello AUM ESTATES, I'd like to discuss selling or leasing a property I own.");
  $('#businessContact').href = enquiryLink("Hello AUM ESTATES, I'd like to discuss a commercial or land requirement.");
  $('#homeSearch').addEventListener('submit',event => {
    event.preventDefault();
    showResults({intent:$('#homeIntent').value,location:$('#homeLocation').value,type:'',budget:'',sort:'default'});
  });
  $$('[data-browse]').forEach(button => button.addEventListener('click',() => showResults({intent:button.dataset.browse,location:'',type:'',budget:'',sort:'default'})));
  $$('[data-home]').forEach(element => element.addEventListener('click',event => {event.preventDefault();showHome()}));
  $$('[data-view]').forEach(element => element.addEventListener('click',event => {event.preventDefault();if(element.dataset.view === 'locations') showLocations();else if(element.dataset.view === 'about') showAbout()}));
  $$('[data-advisor]').forEach(element => element.addEventListener('click',event => {event.preventDefault();showAdvisor(element.dataset.advisor)}));
  $$('[data-location]').forEach(button => button.addEventListener('click',() => showResults({intent:'buy',location:button.dataset.location,type:'',budget:'',sort:'default'})));
  $('#menuToggle').addEventListener('click',() => {const opening=$('#mobileMenu').hidden;$('#mobileMenu').hidden=!opening;$('#menuToggle').setAttribute('aria-expanded',String(opening))});
  $('#dismissRibbon').addEventListener('click',() => {
    $('.concept-ribbon > span:nth-child(2)').hidden = true;
    $('#dismissRibbon').hidden = true;
  });
  $$('#filterIntent,#filterLocation,#filterType,#filterBudget,#sortResults').forEach(select => select.addEventListener('change',updateFromControls));
  $('#resetFilters').addEventListener('click',resetFilters);
  $('#emptyReset').addEventListener('click',resetFilters);
  $('#activeChips').addEventListener('click',event => {
    const button=event.target.closest('[data-clear]'); if(!button) return;
    const key=button.dataset.clear;
    state[key]=key === 'intent' ? 'buy' : '';
    renderResults();
  });
  $('#openFilters').addEventListener('click',() => {$('#filterPanel').classList.add('open');$('#openFilters').setAttribute('aria-expanded','true');document.body.style.overflow='hidden';$('#filterIntent').focus()});
  $('#closeFilters').addEventListener('click',closeFilters);
  $('#applyFilters').addEventListener('click',closeFilters);
  document.addEventListener('keydown',event => {if(event.key==='Escape'){closeFilters();closeMobileMenu()}});
  const restoreView = () => {
    const view = location.hash.slice(1);
    if(view === 'browse') showResults({},false);
    else if(view === 'locations') showLocations(false);
    else if(view === 'advisor') showAdvisor('general',false);
    else if(view === 'advisor-listing') showAdvisor('listing',false);
    else if(view === 'about') showAbout(false);
    else showHome(false);
  };
  window.addEventListener('popstate',restoreView);
  restoreView();
});
