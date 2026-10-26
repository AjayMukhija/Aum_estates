(function(){
  'use strict';
  const publicData = Array.isArray(window.AUM_PUBLIC_INVENTORY) ? window.AUM_PUBLIC_INVENTORY : [];
  // dev_inventory removed
  const isLocal = location.protocol === 'file:';
  // Same source of truth in local preview and live site; no stale 282-record preview.
  const DATA = publicData.filter(o => o && String(o.status||'').toLowerCase()==='available' && (o.listing_title || o.project_name || o.public_description || o.key_features || o.configuration));

  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm = s => String(s ?? '').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9+]+/g,' ').trim();
  const text = o => [o.listing_title,o.project_name,o.locality,o.sector,o.micro_location,o.city,o.property_type,o.transaction_type,o.configuration,o.key_features,o.public_description,o.public_features,o.facing,o.road_width].filter(Boolean).join(' ');
  const typeLabel = o => o.property_type || o.configuration || 'Property';
  const locationLabel = o => [o.locality,o.sector,o.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
  const areaLabel = o => o.area_value ? `${o.area_value} ${o.area_unit || ''}`.trim() : '';
  function money(v){
    if(v==null || v==='') return '';
    const n=Number(v); if(!Number.isFinite(n)) return String(v);
    if(n>=10000000) return `₹${(n/10000000).toFixed(n%10000000?2:0)} Cr`;
    if(n>=100000) return `₹${(n/100000).toFixed(n%100000?1:0)} Lakh`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }
  function priceLabel(o){
    if(o.transaction_type && /rent/i.test(o.transaction_type) && o.rent_value) return `${money(o.rent_value)} / month`;
    if(o.price_text && /source wording|verify/i.test(o.price_text)) return 'Price details to be confirmed';
    if(o.price_text) return o.price_text;
    if(o.price_value!=null){
      const unit=String(o.price_unit||'').toLowerCase();
      if(unit.includes('per sq')) return `${money(o.price_value)} / ${o.price_unit.replace(/per\s*/i,'')}`;
      if(unit.includes('crore') || unit==='cr') return `₹${o.price_value} Cr`;
      if(unit.includes('lakh')) return `₹${o.price_value} Lakh`;
      return money(o.price_value);
    }
    return 'Price on request';
  }
  // Representative image selection is driven by the structured property_type first.
  // Listing titles/descriptions are deliberately NOT used for category selection because
  // terms such as "plot", "floor plate", etc. can occur in otherwise different property types.
  function representativeCategory(o){
    const p=String(o.property_type||'').toLowerCase().trim();
    const c=String(o.configuration||'').toLowerCase().trim();
    const title=String([o.listing_title,o.website_display_name,o.project_name,o.inventory_category,o.category,o.property_category].filter(Boolean).join(' ')).toLowerCase();
    const combined=`${p} ${c}`;
    // Explicit plot/land listings take precedence over a conflicting generic property_type
    // (for example, DLF listings whose type says Villa/House but whose title says Plot).
    const explicitPlot=/\bplots?\b|\bland\b/.test(title) || /\bplots?\b|\bland\b/.test(p+' '+c);
    if(explicitPlot) return 'plot';
    if(/villa|house|kothi/.test(p)) return 'villa';
    if(/farmhouse/.test(p) || /farmhouse/.test(c)) return 'farmhouse';
    if(/builder\s*floor/.test(p)) return 'builder-floor';
    if(/apartment|flat/.test(p)) return 'apartment';
    // Guest houses are commercial hospitality assets, not industrial buildings.
    if(/guest\s*house|hotel|hospitality/.test(p+' '+c)) return 'commercial';
    if(/commercial/.test(p) || /office|shop|retail|industrial|building/.test(p)) {
      if(/shop|retail/.test(c)) return 'shop';
      if(/office/.test(c) && !/building\s*\/\s*office\s*building/.test(c)) return 'office';
      if(/building\s*\/\s*office\s*building|office\s*building|building/.test(c)) return 'building';
      if(/industrial|factory|warehouse/.test(p+' '+c)) return 'commercial';
      if(/office/.test(p)) return 'office';
      return 'commercial';
    }
    if(/villa|house|kothi|farmhouse/.test(combined)) return 'villa';
    if(/builder\s*floor/.test(combined)) return 'builder-floor';
    if(/apartment|flat/.test(combined)) return 'apartment';
    return 'apartment';
  }
  function representativeImage(o){
    const c=representativeCategory(o);
    // User-approved image rule: all Plot/Plots/Land inventory uses the supplied plot photograph.
    if(c === 'plot') return 'plot-land-user.jpg';
    const name=String([o.listing_title,o.website_display_name,o.project_name,o.locality,o.micro_location,o.sector,o.public_description,o.key_features].join(' ')).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const projectImages=[
      [/sector 46 guest house|guest house/.test(name),'commercial.jpg'],
      [/asya smartliving|sukoon/.test(name),'sukoon-asya-project-photo.png'],
      [/puri the aravallis|puri aravallis/.test(name),'puri-the-aravalis.jpg'],
      [/privana|privana south|privana north/.test(name),'privana.jpg'],
      [/sobha aranya/.test(name),'sobha-aranya.jpg'],
      [/indiabulls enigma/.test(name),'indiabulls-enigma.jpg'],
      [/paras irene/.test(name),'paras-irene.jpg'],
      [/eldeco mansionz|eldeco mansions/.test(name),'eldeco-mansionz.jpg'],
      [/uniworld garden 1|uniworld garden-1/.test(name),'uniworld-garden-1.jpg'],
      [/tata raisina/.test(name),'tata-raisina.webp'],
      [/paras the florett|paras the florett enqlve/.test(name),'paras-the-florett.jpg'],
      [/ireo uptown/.test(name),'ireo-uptown.jpg'],
      [/the aspen|aspen green/.test(name),'the-aspen.webp'],
      [/pioneer araya|araya/.test(name),'pioneer-araya.jpg'],
      [/smartworld sky arc/.test(name),'smartworld-sky-arc.webp'],
      [/harmony/.test(name),'harmony.jpg'],
      [/urban oasis/.test(name),'urban-oasis.jpg'],
      [/palm terrace select|palm terraces select/.test(name),'palm-terrace-select.jpeg'],
      [/pioneer presidia|pioneer presidia/.test(name),'pioneer-presidia.jpg'],
      [/ridgewood estate|rigdewood estate/.test(name),'ridgewood-estate.jpg'],
      [/arrossim|south goa/.test(name),'arrossim.jpg'],
      [/sushant lok 1 a block 350 sq yd upper ground|sushant-lok-1-a-block-350-sq-yd-upper-ground/.test(name),'sushant-lok-1-a-block-350-upper-ground.jpg'],
      [/shukrana homes|shukrana-homes/.test(name),'shukrana-homes.jpg'],
    [/sushant lok.*plot|plot.*sushant lok/.test(name),'sushant-lok-plot.jpg'],
      [/sushant lok/.test(name),'sushant-lok.jpg'],
      [/m3m capital 113|m3m capital/.test(name),'m3m-capital-113.webp'],
      [/south city 2/.test(name),'south-city-2.jpg'],
      [/close north/.test(name),'close-north.jpg'],
      [/close south/.test(name),'close-south.jpg'],
      [/vipul world/.test(name),'vipul-world.jpg'],
      [/godrej meridian|godrej meridien/.test(name),'godrej-meridian.jpg'],
      [/malibu towne|malibu town/.test(name),'malibu-towne.jpg'],
      [/paras quartier/.test(name),'paras-quartier.jpg'],
      [/heritage one/.test(name),'heritage-one.jpg'],
      [/orchid island/.test(name),'orchid-island.jpg'],
      [/dlf exclusive floors|dlf exclusive floor/.test(name),'dlf-exclusive-floors.jpg'],
      [/omaxe the nile/.test(name),'omaxe-the-nile.jpeg'],
      [/uppal southend|uppal south end/.test(name),'uppal-southend.jpg'],
      [/m3m heights/.test(name),'m3m-heights.jpg'],
      [/ireo grand arch/.test(name),'ireo-grand-arch.jpg'],
      [/signature global deluxe/.test(name),'signature-global-deluxe-dxp.webp'],
      [/dlf the belaire|dlf belaire/.test(name),'dlf-the-belaire.webp'],
      [/elevate by hines|conscient elevate/.test(name),'elevate-by-hines.webp'],
      [/dlf park place/.test(name),'dlf-park-place.jpg'],
      [/dlf westend heights/.test(name),'dlf-westend-heights.jpg'],
      [/dlf carlton estate/.test(name),'dlf-carlton-estate.jpg'],
      [/dlf arbour/.test(name),'dlf-arbour.jpg'],
      [/dlf grove/.test(name),'dlf-grove.jpg'],
      [/adani samsara/.test(name),'adani-samsara.jpg'],
      [/anant raj/.test(name),'anant-raj.jpg'],
      [/birla navya/.test(name),'birla-navya.jpg'],
      [/blossom 2/.test(name),'blossom-2.jpg'],
      [/bptp freedom/.test(name),'bptp-freedom.jpg'],
    ];
    for(const [matches,file] of projectImages){if(matches)return file;}
    if(/south city 2/.test(name)) return 'south-city-2-builder-floors-houses.jpg';
    return ({villa:'villa.jpg',farmhouse:'villa.jpg','builder-floor':'builder-floor.jpg',apartment:'apartment.jpg',plot:'plot.jpg',shop:'shop.jpg',office:'office.jpg',building:'building.jpg',commercial:'commercial.jpg'})[c] || 'apartment.jpg';
  }
  function representativeLabel(o){
    const c=representativeCategory(o);
    const name=norm([o.listing_title,o.project_name,o.locality,o.micro_location,o.sector,o.public_description,o.key_features].join(' '));
    if(/south city 2/.test(name)){
      const p=String(o.property_type||'').toLowerCase();
      const cfg=String(o.configuration||'').toLowerCase();
      if(/shop|retail/.test(p+' '+cfg)) return 'Shop / Retail';
      if(/plot|land/.test(p+' '+cfg)) return 'Plot / Land';
      if(/builder\s*floor|\bfloor\b/.test(p+' '+cfg)) return 'Builder Floor';
      if(/villa|house|kothi/.test(p+' '+cfg)) return 'House / Kothi';
      return 'South City 2 Property';
    }
    return ({villa:'Villa / House',farmhouse:'Farmhouse','builder-floor':'Builder Floor',apartment:'Apartment',plot:'Plot / Land',shop:'Shop / Retail',office:'Office',building:'Building / Office Building',commercial:'Commercial'})[c] || 'Property';
  }
  function matchesMode(o, mode){
    if(!mode) return true;
    const t=String(o.transaction_type||'').toLowerCase();
    const p=String(o.property_type||'').toLowerCase();
    if(mode==='buy') return t.includes('sale');
    if(mode==='rent') return t.includes('rent');
    if(mode==='commercial') return /commercial|office|shop|retail/.test(p) || /office|shop|commercial/.test(String(o.configuration||'').toLowerCase());
    if(mode==='plot') return /plot|land/.test(p) || /plot|land/.test(String(o.configuration||'').toLowerCase());
    return true;
  }
  function categoryOf(o){
    const p=norm(o.property_type||'');
    // Structured property type is the authority; titles/features must not override it.
    if(/\b(plot|plots|land|farm land)\b/.test(p)) return 'plot';
    if(/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory)\b/.test(p)) return 'commercial';
    if(/\bfarmhouse|farm house\b/.test(p)) return 'farmhouse';
    // Hospitality assets (including guest houses) are commercial for category filtering.
    if(/\bguest house|hotel|hospitality|serviced apartment\b/.test(p)) return 'commercial';
    if(p && !/^(property|other|unknown|residential|real estate)$/.test(p)) return 'residential';
    const c=norm(o.configuration||'');
    if(/\b(plot|plots|land|farm land)\b/.test(c)) return 'plot';
    if(/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory)\b/.test(c)) return 'commercial';
    if(/\bfarmhouse|farm house\b/.test(c)) return 'farmhouse';
    const t=norm([o.listing_title,o.project_name,o.key_features].join(' '));
    if(/\bfarmhouse|farm house\b/.test(t)) return 'farmhouse';
    if(/\b(plot|plots|land|farm land)\b/.test(t)) return 'plot';
    if(/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory)\b/.test(t)) return 'commercial';
    return 'residential';
  }
  function matchesCategory(o, q){
    if(!q) return true;
    return categoryOf(o)===String(q).toLowerCase();
  }
  function matchesLocation(o, q){
    if(!q) return true;
    const qn=norm(q);
    const fields=[o.city,o.locality,o.sector,o.micro_location,o.project_name].filter(Boolean).map(norm);
    // Sohna town and Sohna Road (Gurugram) are separate locations; never fuzzy-match descriptions.
    if(qn==='sohna') return fields.some(v=>v==='sohna' || v==='imt sohna') && !fields.some(v=>v==='sohna road' || v.includes('sohna road'));
    if(qn==='sohna road') return fields.some(v=>v==='sohna road') && ['gurgaon','gurugram'].includes(norm(o.city));
    return fields.some(v=>v===qn || v.includes(qn));
  }
  function matchesType(o,q){
    if(!q) return true;
    return norm(o.property_type)===norm(q) || norm(o.configuration)===norm(q) || norm(text(o)).includes(norm(q));
  }
  function matchesSize(o,q){
    if(!q) return true;
    const b=String(o.bedrooms??''); const c=String(o.configuration??'');
    if(q==='2 BHK') return b==='2' || /\b2\s*bhk\b/i.test(c);
    if(q==='3 BHK') return b==='3' || /\b3\s*bhk\b/i.test(c);
    if(q==='4 BHK') return b==='4' || /\b4\s*bhk\b/i.test(c);
    if(q==='5 BHK+') return Number(b)>=5 || /\b[5-9]\s*bhk\b/i.test(c);
    if(q==='Plot / Land') return /plot|land/i.test(String(o.property_type)+' '+c);
    if(q==='Commercial Size') return /commercial|office|shop|retail/i.test(String(o.property_type)+' '+c);
    return true;
  }
  function numericBudget(q){
    if(!q) return null;
    const m=q.match(/([0-9.]+)\s*(cr|crore|lakh|lac|l)?/i); if(!m) return null;
    let n=Number(m[1]); const u=(m[2]||'').toLowerCase();
    if(u==='cr'||u==='crore') n*=10000000; else if(u==='lakh'||u==='lac'||u==='l') n*=100000;
    return n;
  }
  function matchesBudget(o,q,mode){
    if(!q) return true;
    const max=numericBudget(q); if(max==null) return true;
    const n=mode==='rent' ? Number(o.rent_value) : Number(o.price_value);
    if(!Number.isFinite(n)) return true;
    const unit=String(mode==='rent'?o.rent_unit:o.price_unit||'').toLowerCase();
    // Price fields expressed per sq ft cannot be compared to a total-budget selector.
    if(/per\s*sq|sq\s*ft|sq\s*yd|per\s*sq\s*yard/.test(unit)) return true;
    return n<=max;
  }
  function readParams(){
    const p=new URLSearchParams(location.search);
    let category=p.get('category')||'', q=p.get('q')||'';
    const aliases={residential:'residential',commercial:'commercial',industrial:'commercial',plots:'plot','plots and land':'plot','plots land':'plot',farmhouses:'farmhouse',farmhouse:'farmhouse'};
    const qn=norm(q);
    if(!category && aliases[qn]){category=aliases[qn];q='';}
    return {mode:p.get('mode')||'',category,location:p.get('location')||'',type:p.get('type')||'',size:p.get('size')||'',budget:p.get('budget')||'',q};
  }
  function keywordClauseMatches(o, clause){
    const q=norm(clause);
    if(!q) return true;
    const hay=norm(text(o));
    const aliases={
      '60 metre road':['60 metre road','60 meter road','60m road','60 metre','60 meter'],
      '18 metre road':['18 metre road','18 meter road','18m road','18 metre','18 meter'],
      'park facing':['park facing','park-facing'],
      'east facing':['east facing','east-facing'],
      'plots':['plot','plots','land'],
      'industrial':['industrial','factory','industrial plot']
    };
    const a=aliases[q];
    if(a) return a.some(term=>hay.includes(norm(term)));
    return q.split(/\s+/).every(word=>hay.includes(word));
  }
  function matchesKeywords(o,q){
    if(!q) return true;
    return String(q).split('||').map(v=>v.trim()).filter(Boolean).every(clause=>keywordClauseMatches(o,clause));
  }
  function filtered(params){
    // Exact place names entered in the free-text box are treated as structured location
    // searches, not broad keyword searches. This prevents "Sohna" from matching Sohna Road
    // or unrelated Gurgaon descriptions that happen to mention Sohna.
    const queryPlace = norm(params.q);
    const placeAliases = {
      'sohna town': 'sohna',
      'sohna haryana': 'sohna',
      'sohna road gurugram': 'sohna road',
      'sohna road gurgaon': 'sohna road'
    };
    const placeQuery = placeAliases[queryPlace] || queryPlace;
    const isExactPlaceQuery = placeQuery === 'sohna' || placeQuery === 'sohna road';
    const effectiveLocation = params.location || (isExactPlaceQuery ? placeQuery : '');
    const effectiveKeywords = isExactPlaceQuery && !params.location ? '' : params.q;
    return DATA.filter(o=>matchesMode(o,params.mode)&&matchesCategory(o,params.category)&&matchesLocation(o,effectiveLocation)&&matchesType(o,params.type)&&matchesSize(o,params.size)&&matchesBudget(o,params.budget,params.mode)&&matchesKeywords(o,effectiveKeywords));
  }
  function whatsappUrl(o){
    const name=o.website_display_name||o.listing_title||o.project_name||'Property';
    const lines=[
      'AUM ESTATES – PROPERTY ENQUIRY',
      '',
      `Property ID: ${o.property_id||'N/A'}`,
      `Property: ${name}`,
      o.project_name?`Project: ${o.project_name}`:'',
      `Location: ${locationLabel(o)||'N/A'}`,
      `Transaction: ${o.transaction_type||'Sale'}`,
      `Property Type: ${o.property_type||'N/A'}`,
      o.configuration?`Configuration: ${o.configuration}`:'',
      areaLabel(o)?`Area: ${areaLabel(o)}`:'',
      `Price: ${priceLabel(o)}`,
      '',
      'I am interested in this property. Please share further details and availability.'
    ].filter(Boolean);
    return `https://wa.me/919873813595?text=${encodeURIComponent(lines.join('\n'))}`;
  }
  function resultCard(o){
    const features=(o.public_features||o.key_features||'').split(';').filter(Boolean).slice(0,3);
    const publicName=o.website_display_name||o.listing_title||o.project_name||'Property';
    const detailHref=`detail.html?id=${encodeURIComponent(o.property_id||'')}`;
    const wa=whatsappUrl(o);
    const image=representativeImage(o);
    const imageLabel=representativeLabel(o);
    return `<article class="result-card"><div class="result-photo" style="background-image:url('../assets/property-images/${image}')"><span class="representative-badge">Verified</span><span class="result-type">${esc(imageLabel)}</span></div><div class="result-body"><div class="result-location">${esc(locationLabel(o))}</div><h3>${esc(publicName)}</h3><p class="result-config">${esc(o.configuration||'')} ${o.bedrooms?` · ${esc(o.bedrooms)} BHK`:''} ${areaLabel(o)?` · ${esc(areaLabel(o))}`:''}</p><p class="result-desc">${esc(o.public_description||o.key_features||'Property details available on enquiry.')}</p><div class="result-bottom"><strong>${esc(priceLabel(o))}</strong><div class="result-actions"><a class="view-details" href="${detailHref}">View Details</a><a class="result-contact" href="${wa}" target="_blank" rel="noopener">Enquire on WhatsApp</a></div></div>${features.length?`<div class="result-features">${features.map(f=>`<span>${esc(f.trim())}</span>`).join('')}</div>`:''}</div></article>`;
  }
  function populateSelects(){
    const locations=[...new Set(DATA.flatMap(o=>[o.city,o.locality,o.project_name].filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
    const types=[...new Set(DATA.flatMap(o=>[o.property_type].filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
    document.querySelectorAll('[data-search-location]').forEach(sel=>{ const current=sel.value; sel.innerHTML='<option value="">Select Location</option>'+locations.map(v=>`<option>${esc(v)}</option>`).join(''); sel.value=current; });
    document.querySelectorAll('[data-search-type]').forEach(sel=>{ const current=sel.value; sel.innerHTML='<option value="">Property Type</option>'+types.map(v=>`<option>${esc(v)}</option>`).join(''); sel.value=current; });
  }
  function wireForm(form){
    if(!form) return;
    form.addEventListener('submit',e=>{e.preventDefault(); const params=new URLSearchParams(); const mode=form.querySelector('[name=mode]')?.value||form.dataset.mode||'buy'; if(mode) params.set('mode',mode); [['location','location'],['type','type'],['size','size'],['budget','budget'],['q','q']].forEach(([name,key])=>{const el=form.querySelector(`[name=${name}]`); if(el&&el.value) params.set(key,el.value);}); const target=form.dataset.target||(location.pathname.includes('/properties/')?'index.html':'properties/index.html'); location.href=target+'?'+params.toString();});
  }
  function setupKeywordSearch(inputId, formId){
    const input=document.getElementById(inputId);
    const form=document.getElementById(formId);
    if(!input || !form) return;
    const hidden=form.querySelector('[name=q]') || (()=>{ const el=document.createElement('input'); el.type='hidden'; el.name='q'; form.appendChild(el); return el; })();
    const chips=[...document.querySelectorAll('[data-keyword-chips] .keyword-chip')];
    const categoryChips=[...document.querySelectorAll('[data-keyword-chips] .keyword-chip[data-category]')];
    let selected=[];
    const sync=()=>{
      const typed=input.value.trim();
      const parts=[...selected, typed].filter(Boolean);
      hidden.value=parts.join('||');
      chips.forEach(ch=>ch.classList.toggle('active',selected.includes(ch.dataset.keyword)));
    };
    chips.forEach(ch=>ch.addEventListener('click',()=>{
      if(ch.dataset.category){
        const params=new URLSearchParams(location.search);
        params.set('category',ch.dataset.category);
        params.delete('q');
        // Preserve buy/rent mode when a category chip is selected.
        const mode=form.querySelector('[name=mode]')?.value || params.get('mode') || '';
        if(mode) params.set('mode',mode);
        location.href='index.html?'+params.toString();
        return;
      }
      const k=ch.dataset.keyword;
      selected=[k];
      input.value='';
      sync();
      form.requestSubmit();
    }));
    input.addEventListener('input',sync);
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();form.requestSubmit();}});
    const searchButton=input.parentElement?.querySelector('.keyword-search-submit');
    searchButton?.addEventListener('click',()=>{sync();form.requestSubmit();});
    const clear=input.parentElement?.querySelector('.keyword-clear');
    clear?.addEventListener('click',()=>{
      selected=[];
      input.value='';
      sync();
      if(location.pathname.includes('/properties/')){
        location.href='index.html';
      }else{
        input.focus();
      }
    });
    const params=new URLSearchParams(location.search);
    const q=params.get('q')||'';
    if(q){
      const categoryAliases={residential:'residential',commercial:'commercial',industrial:'commercial',plots:'plot','plots and land':'plot','plots land':'plot',farmhouses:'farmhouse',farmhouse:'farmhouse'};
      const isCategoryQuery=Object.prototype.hasOwnProperty.call(categoryAliases,norm(q));
      const parts=q.split('||').filter(Boolean);
      const chipValues=chips.filter(c=>c.dataset.keyword).map(c=>c.dataset.keyword);
      selected=parts.filter(v=>chipValues.includes(v));
      // Legacy URLs may carry a category name in q=. Keep the structured filter,
      // but do not display that category as if it were a free-text keyword.
      input.value=isCategoryQuery ? '' : parts.filter(v=>!chipValues.includes(v)).join(' ');
      sync();
    }
  }
  function initHome(){
    const form=document.getElementById('home-search-form');
    if(!form) return;
    const tabs=[...document.querySelectorAll('.search .tab')];
    const modes=['buy','rent','commercial','plot'];
    const hidden=form.querySelector('[name=mode]');
    tabs.forEach((tab,i)=>tab.addEventListener('click',()=>{tabs.forEach(t=>t.classList.remove('active'));tab.classList.add('active');hidden.value=modes[i];}));
    wireForm(form); populateSelects(); setupKeywordSearch('home-keyword-input','home-search-form');
  }
  function initResults(){
    const host=document.getElementById('search-results'); if(!host) return;
    const params=readParams();
    const results=filtered(params);
    const count=document.getElementById('result-count'); if(count) count.textContent=results.length;
    const summary=document.getElementById('search-summary'); if(summary){ const categoryName={residential:'Residential',commercial:'Commercial',plot:'Plots & Land',farmhouse:'Farmhouses'}[params.category]||''; const bits=[params.mode==='buy'?'Buy':params.mode==='rent'?'Rent':params.mode==='commercial'?'Commercial':params.mode==='plot'?'Plot & Land':'All properties',categoryName,params.location,params.type,params.size,params.budget].filter(Boolean); summary.textContent=bits.join(' · ')||'All available search criteria'; }
    const badge=document.getElementById('data-mode-badge');
    if(badge){ badge.textContent='PUBLIC WEBSITE — CURRENT KNOWN-SOURCE INVENTORY'; badge.className='data-mode-badge public'; }
    host.innerHTML=results.length?results.map(resultCard).join(''):`<div class="no-results"><h3>No matching public properties</h3><p>${isLocal?'Try another filter. This preview uses the current approved public inventory.':'Our public inventory is currently being curated. Please contact AUM ESTATES and we will match you with suitable properties from our private collection.'}</p><a class="result-contact large" href="https://wa.me/919873813595?text=Hello%20AUM%20ESTATES%2C%20I%20would%20like%20help%20finding%20a%20property." target="_blank" rel="noopener">Talk to AUM ESTATES on WhatsApp</a></div>`;
    const form=document.getElementById('results-search-form');
    if(form){ const hidden=form.querySelector('[name=mode]'); if(hidden) hidden.value=params.mode; ['category','location','type','size','budget','q'].forEach(n=>{const el=form.querySelector(`[name=${n}]`); if(el) el.value=params[n]||'';}); wireForm(form); populateSelects(); setupKeywordSearch('results-keyword-input','results-search-form'); }
  }
  document.addEventListener('DOMContentLoaded',()=>{initHome();initResults();});
})();