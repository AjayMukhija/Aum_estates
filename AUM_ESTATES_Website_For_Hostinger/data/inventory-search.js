(function(){
  'use strict';
  const publicData = Array.isArray(window.AUM_PUBLIC_INVENTORY) ? window.AUM_PUBLIC_INVENTORY : (window.AUM_DEV_INVENTORY || []);
  const DATA = publicData.filter(o => o && String(o.status||'').toLowerCase()==='available' && (o.listing_title || o.project_name || o.public_description || o.key_features || o.configuration));

  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const norm = s => String(s ?? '').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9+]+/g,' ').trim();
  const text = o => [o.listing_title,o.project_name,o.locality,o.sector,o.micro_location,o.city,o.property_type,o.transaction_type,o.configuration,o.key_features,o.public_description,o.public_features,o.facing,o.road_width].filter(Boolean).join(' ');
  const locationLabel = o => [o.locality,o.sector,o.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
  const areaLabel = o => o.area_value ? `${o.area_value} ${o.area_unit || ''}`.trim() : '';

  function money(v){
    if(v==null || v==='') return '';
    const n=Number(v); if(!Number.isFinite(n)) return String(v);
    if(n>=10000000) return `₹${(n/10000000).toFixed(n%10000000?2:0)} Cr`;
    if(n>=100000) return `₹${(n/100000).toFixed(n%100000?1:0)} Lakh`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
  }

  function sanitizePriceText(pt){
    if(!pt) return '';
    const s = String(pt).trim();
    if(/^(mp|market\s*rates?)$/i.test(s)) return 'Market Price on Request';
    if(/confirm\s*unit|keys\s*in\s*hand|max\s*cheque|no\s*premium|price\s*not\s*supplied|verify|differ/i.test(s)) {
      return 'Price on Request';
    }
    if(/^price\s*on\s*call/i.test(s)) return 'Price on Request';
    return s;
  }

  function priceLabel(o){
    if(o.transaction_type && /rent|lease/i.test(o.transaction_type) && o.rent_value) return `${money(o.rent_value)} / month`;
    if(o.price_text){
      const sanitized = sanitizePriceText(o.price_text);
      if(sanitized) return sanitized;
    }
    if(o.price_value!=null){
      const unit=String(o.price_unit||'').toLowerCase();
      if(unit.includes('per sq')) return `${money(o.price_value)} / ${o.price_unit.replace(/per\s*/i,'')}`;
      if(unit.includes('crore') || unit==='cr') return `₹${o.price_value} Cr`;
      if(unit.includes('lakh')) return `₹${o.price_value} Lakh`;
      return money(o.price_value);
    }
    return 'Price on Request';
  }

  function representativeCategory(o){
    const p=String(o.property_type||'').toLowerCase().trim();
    const c=String(o.configuration||'').toLowerCase().trim();
    const title=String([o.listing_title,o.website_display_name,o.project_name,o.inventory_category,o.category,o.property_category].filter(Boolean).join(' ')).toLowerCase();
    const combined=`${p} ${c}`;
    const explicitPlot=/\bplots?\b|\bland\b/.test(title) || /\bplots?\b|\bland\b/.test(p+' '+c);
    if(explicitPlot) return 'plot';
    if(/villa|house|kothi/.test(p)) return 'villa';
    if(/farmhouse/.test(p) || /farmhouse/.test(c)) return 'farmhouse';
    if(/builder\s*floor|\bfloor\b/.test(p)) return 'builder-floor';
    if(/apartment|flat|condo/.test(p)) return 'apartment';
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
    if(/builder\s*floor|\bfloor\b/.test(combined)) return 'builder-floor';
    if(/apartment|flat/.test(combined)) return 'apartment';
    return 'apartment';
  }

  function representativeImage(o){
    const c=representativeCategory(o);
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
      [/bptp freedom/.test(name),'bptp-freedom.jpg']
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
    const c=String(o.configuration||'').toLowerCase();
    if(mode==='buy') return t.includes('sale') || (!t.includes('rent') && !t.includes('lease'));
    if(mode==='rent') return t.includes('rent') || t.includes('lease');
    if(mode==='commercial') return /commercial|office|shop|retail/.test(p) || /office|shop|commercial/.test(c);
    if(mode==='plot') return /plot|land/.test(p) || /plot|land/.test(c);
    return true;
  }

  function categoryOf(o){
    const p=norm(o.property_type||'');
    const c=norm(o.configuration||'');
    const t=norm([o.listing_title,o.website_display_name,o.project_name,o.key_features].filter(Boolean).join(' '));
    if(/\b(plot|plots|land|farm land)\b/.test(p) || /\b(plot|plots|land)\b/.test(c) || /\b(plot|plots|land)\b/.test(t)) return 'plot';
    if(/\b(commercial|office|offices|shop|shops|retail|warehouse|industrial|factory|booth|hospital|guest house|hotel)\b/.test(p+' '+c)) return 'commercial';
    if(/\bfarmhouse|farm house\b/.test(p+' '+c+' '+t)) return 'farmhouse';
    if(/\bbuilder floor|builder floors|\bfloor\b/.test(p) || /\bbuilder floor|\bfloor\b/.test(c)) return 'builder-floor';
    if(/\bvilla|villas|house|houses|kothi|kothis\b/.test(p+' '+c)) return 'villa';
    if(/\bapartment|apartments|flat|flats|condo|penthouse\b/.test(p+' '+c)) return 'apartment';
    return 'residential';
  }

  function matchesCategory(o, q){
    if(!q) return true;
    const qn=norm(q);
    const cat=categoryOf(o);
    if(qn==='builder-floor' || qn==='builder floor' || qn==='builder floors' || qn==='builder-floors') {
      return cat==='builder-floor' || /\bbuilder floor|\bfloor\b/.test(norm(o.property_type||'')+' '+norm(o.configuration||''));
    }
    if(qn==='plot' || qn==='plots' || qn==='land' || qn==='plots and land' || qn==='plots-land') return cat==='plot';
    if(qn==='commercial' || qn==='office' || qn==='offices' || qn==='retail' || qn==='shop') {
      return cat==='commercial' || /\bcommercial|office|shop|retail\b/.test(norm(o.property_type||'')+' '+norm(o.configuration||''));
    }
    if(qn==='farmhouse' || qn==='farmhouses') return cat==='farmhouse';
    if(qn==='villa' || qn==='villas') return cat==='villa' || /\bvilla|house|kothi\b/.test(norm(o.property_type||'')+' '+norm(o.configuration||''));
    if(qn==='apartment' || qn==='apartments') return cat==='apartment' || /\bapartment|flat|condo\b/.test(norm(o.property_type||'')+' '+norm(o.configuration||''));
    if(qn==='residential') return cat==='residential' || cat==='apartment' || cat==='builder-floor' || cat==='villa';
    return cat===qn;
  }

  function matchesLocation(o, q){
    if(!q) return true;
    const qn=norm(q);
    const fields=[o.city,o.locality,o.sector,o.micro_location,o.project_name,o.listing_title].filter(Boolean).map(norm);
    const fullText=norm([o.city,o.locality,o.sector,o.micro_location,o.project_name,o.listing_title,o.public_description,o.key_features].join(' '));

    // Sohna town vs Sohna Road
    if(qn==='sohna' || qn==='imt sohna') {
      return fields.some(v=>v==='sohna' || v==='imt sohna' || v.includes('imt sohna')) && !fields.some(v=>v.includes('sohna road'));
    }
    if(qn==='sohna road') {
      return fields.some(v=>v.includes('sohna road') || v.includes('malibu') || v.includes('uppal south') || v.includes('vipul world') || v.includes('eldeco mansionz') || v.includes('omaxe the nile'));
    }

    // Golf Course Ext Road & SPR
    if(qn.includes('golf course ext') || qn.includes('spr') || qn==='extension road' || qn.includes('southern peripheral')) {
      const extKeywords=[
        'golf course extension','golf course ext','spr','southern peripheral',
        'sector 58','sector 59','sector 61','sector 62','sector 63','sector 65','sector 66','sector 67','sector 68','sector 69','sector 70',
        'pioneer araya','pioneer presidia','emerald hills','emerald floors','elevate','conscient elevate','tata raisina',
        'urban oasis','smartworld orchid','paras irene','paras the florett','m3m heights','ireo grand arch','ireo uptown','puri the aravallis','the arbour'
      ];
      return extKeywords.some(k=>fullText.includes(k));
    }

    // Golf Course Road & DLF 5
    if(qn==='golf course road' || qn.includes('dlf 5') || qn==='golf course rd') {
      const gcrKeywords=[
        'golf course road','golf course rd','dlf 5','dlf phase 5','sector 42','sector 43','sector 53','sector 54',
        'dlf belaire','dlf the belaire','the belaire','belaire','dlf park place','park place','dlf magnolias','magnolias',
        'dlf aralias','aralias','dlf camellias','camellias','dlf crest','the crest','dlf carlton','carlton estate','dlf exclusive'
      ];
      return gcrKeywords.some(k=>fullText.includes(k));
    }

    // Dwarka Expressway & DXP
    if(qn.includes('dwarka') || qn.includes('dxp')) {
      const dxpKeywords=[
        'dwarka expressway','dwarka express','dxp','sector 95','sector 99','sector 102','sector 104','sector 106','sector 108','sector 109','sector 110','sector 111','sector 112','sector 113',
        'm3m capital','sobha aranya','signature global deluxe','deluxe dxp','godrej meridian','godrej meridien','indiabulls enigma','saan verdante'
      ];
      return dxpKeywords.some(k=>fullText.includes(k));
    }

    // DLF Phase 1–5
    if(qn==='dlf' || qn.includes('dlf phase')) {
      return fields.some(v=>v.includes('dlf'));
    }

    // Nirvana & Sector 50
    if(qn==='nirvana' || qn.includes('sector 50')) {
      return fullText.includes('nirvana') || fullText.includes('sector 50') || fullText.includes('south city 2') || fullText.includes('orchid island') || fullText.includes('fresco');
    }

    if(qn==='south city') return fields.some(v=>v.includes('south city'));
    if(qn==='sushant lok') return fields.some(v=>v.includes('sushant lok'));
    if(qn==='goa') return fields.some(v=>v.includes('goa') || v.includes('majorda') || v.includes('arrossim') || v.includes('narve'));

    return fields.some(v=>v===qn || v.includes(qn));
  }

  function matchesType(o,q){
    if(!q) return true;
    const nq=norm(q);
    const pt=norm(o.property_type || '');
    const cfg=norm(o.configuration || '');
    const txt=norm(text(o));
    if(nq === 'apartment') return /apartment|flat|condo/i.test(pt) || /apartment|flat|condo/i.test(cfg);
    if(nq === 'residential builder floor' || nq === 'builder floor') return /builder floor|floor/i.test(pt) || /builder floor|floor/i.test(cfg);
    if(nq === 'villa / house' || nq === 'villa' || nq === 'house') return /villa|house|kothi/i.test(pt) || /villa|house|kothi/i.test(cfg);
    if(nq === 'plot / kothi' || nq === 'plot' || nq === 'land') return /plot|land/i.test(pt) || /plot|land/i.test(cfg);
    if(nq === 'commercial') return /commercial|office|building/i.test(pt) || /commercial|office|building/i.test(cfg);
    if(nq === 'shop / commercial unit' || nq === 'shop' || nq === 'retail') return /shop|retail/i.test(pt) || /shop|retail/i.test(cfg);
    if(nq === 'farmhouse') return /farmhouse|farm house/i.test(pt) || /farmhouse|farm house/i.test(cfg);
    return pt===nq || cfg===nq || txt.includes(nq);
  }

  function matchesSize(o, q){
    if(!q) return true;
    const qn=norm(q);
    const b=String(o.bedrooms??'');
    const c=norm(o.configuration??'');
    const p=norm(o.property_type??'');
    const title=norm(o.listing_title??'');
    const combined=`${p} ${c} ${title}`;

    if(qn==='2 bhk') return b==='2' || /\b2\s*bhk\b/.test(c) || /\b2\s*bhk\b/.test(title);
    if(qn==='3 bhk') return b==='3' || /\b3\s*bhk\b/.test(c) || /\b3\s*bhk\b/.test(title);
    if(qn==='4 bhk') return b==='4' || /\b4\s*bhk\b/.test(c) || /\b4\s*bhk\b/.test(title);
    if(qn==='5 bhk+' || qn==='5 bhk') return Number(b)>=5 || /\b[5-9]\s*bhk\b/.test(c) || /\b[5-9]\s*bhk\b/.test(title) || /penthouse/.test(combined);
    if(qn==='floor' || qn.includes('builder floor') || qn.includes('independent floor')) {
      return /\bbuilder floor|\bfloor\b/.test(p) || /\bbuilder floor|\bfloor\b/.test(c) || /\bfloor\b/.test(title);
    }
    if(qn==='plot' || qn.includes('land') || qn.includes('kothi')) {
      return /\bplot|plots|land\b/.test(combined);
    }
    if(qn==='commercial' || qn.includes('commercial') || qn.includes('office') || qn.includes('shop')) {
      return /\bcommercial|office|shop|retail|building\b/.test(combined);
    }
    return true;
  }

  function parseBudgetRange(q){
    if(!q) return null;
    const s=String(q).trim().toLowerCase();
    const rangeMatch=s.match(/([0-9.]+)\s*(?:cr|crore)?\s*[-–to]+\s*([0-9.]+)\s*(cr|crore|lakh|lac)?/i);
    if(rangeMatch){
      let min=Number(rangeMatch[1]);
      let max=Number(rangeMatch[2]);
      const unit=rangeMatch[3]||'cr';
      const mult=(unit==='lakh'||unit==='lac')?100000:10000000;
      return {min:min*mult,max:max*mult};
    }
    const plusMatch=s.match(/([0-9.]+)\s*(cr|crore|lakh|lac)?\s*\+/i);
    if(plusMatch){
      let min=Number(plusMatch[1]);
      const unit=plusMatch[2]||'cr';
      const mult=(unit==='lakh'||unit==='lac')?100000:10000000;
      return {min:min*mult,max:Infinity};
    }
    const singleMatch=s.match(/([0-9.]+)\s*(cr|crore|lakh|lac)?/i);
    if(singleMatch){
      let val=Number(singleMatch[1]);
      const unit=singleMatch[2]||'cr';
      const mult=(unit==='lakh'||unit==='lac')?100000:10000000;
      if(s==='7 cr') return {min:30000000,max:70000000};
      if(s==='15 cr') return {min:70000000,max:150000000};
      if(s==='30 cr') return {min:150000000,max:Infinity};
      return {min:0,max:val*mult};
    }
    return null;
  }

  function matchesBudget(o, q, mode){
    if(!q) return true;
    const range=parseBudgetRange(q);
    if(!range) return true;

    if(mode==='rent'){
      const rent=Number(o.rent_value);
      if(!Number.isFinite(rent)) return true;
      if(range.max>=10000000 && rent<10000000) return true;
      return rent>=range.min && rent<=range.max;
    }

    const price=Number(o.price_value);
    if(!Number.isFinite(price)) return true;
    const unit=String(o.price_unit||'').toLowerCase();
    if(/per\s*sq|sq\s*ft|sq\s*yd|per\s*sq\s*yard/.test(unit)) return true;

    let actualPrice=price;
    if(unit==='cr' || unit.includes('crore')) {
      actualPrice=price*10000000;
    } else if(unit.includes('lakh') || unit.includes('lac')) {
      actualPrice=price*100000;
    }
    return actualPrice>=range.min && actualPrice<=range.max;
  }

  function tokenizeQuery(clause){
    const stopWords=new Set(['in','at','with','near','for','and','&','the','of','to','a','an','is','on','by']);
    let s=norm(clause)
      .replace(/\b([1-9])\s*bhk\b/g,'$1 bhk')
      .replace(/\b([1-9])bhk\b/g,'$1 bhk');
    return s.split(/\s+/).filter(w=>w && !stopWords.has(w));
  }

  function keywordClauseMatches(o, clause){
    const q=norm(clause);
    if(!q) return true;
    const hay=norm(text(o));
    const aliases={
      '60 metre road':['60 metre road','60 meter road','60m road','60 metre','60 meter'],
      '18 metre road':['18 metre road','18 meter road','18m road','18 metre','18 meter'],
      '12 metre road':['12 metre road','12 meter road','12m road','12 metre','12 meter'],
      'park facing':['park facing','park-facing','park'],
      'east facing':['east facing','east-facing','east'],
      'corner plot':['corner plot','corner'],
      'plots':['plot','plots','land'],
      'industrial':['industrial','factory','industrial plot'],
      'golf course road':['golf course road','dlf 5','belaire','park place','camellias','magnolias','aralias'],
      'dlf':['dlf'],
      'the arbour':['arbour','dlf arbour'],
      'dwarka expressway':['dwarka expressway','dxp','sector 106','sector 113','m3m capital','deluxe dxp']
    };
    const a=aliases[q];
    if(a) return a.some(term=>hay.includes(norm(term)));
    const tokens=tokenizeQuery(clause);
    if(!tokens.length) return true;
    return tokens.every(token=>hay.includes(token));
  }

  function matchesKeywords(o,q){
    if(!q) return true;
    return String(q).split('||').map(v=>v.trim()).filter(Boolean).every(clause=>keywordClauseMatches(o,clause));
  }

  function readParams(){
    const p=new URLSearchParams(location.search);
    let category=p.get('category')||'', q=p.get('q')||'';
    const aliases={residential:'residential',commercial:'commercial',industrial:'commercial',plots:'plot','plots and land':'plot','plots land':'plot',farmhouses:'farmhouse',farmhouse:'farmhouse','builder-floors':'builder-floor','builder floor':'builder-floor'};
    const qn=norm(q);
    if(!category && aliases[qn]){category=aliases[qn];q='';}
    return {
      mode:p.get('mode')||'',
      category,
      location:p.get('location')||'',
      type:p.get('type')||'',
      size:p.get('size')||'',
      budget:p.get('budget')||'',
      q
    };
  }

  function filtered(params){
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

    return DATA.filter(o =>
      matchesMode(o, params.mode) &&
      matchesCategory(o, params.category) &&
      matchesLocation(o, effectiveLocation) &&
      matchesType(o, params.type) &&
      matchesSize(o, params.size) &&
      matchesBudget(o, params.budget, params.mode) &&
      matchesKeywords(o, effectiveKeywords)
    );
  }

  function cleanTitle(s){
    if(!s) return 'Featured Property';
    return String(s)
      .replace(/\s+MP$/i, '')
      .replace(/\s+OC tower$/i, ' (OC Received)')
      .replace(/\s+#\d+$/i, '')
      .trim();
  }

  function whatsappUrl(o){
    const name=cleanTitle(o.website_display_name||o.listing_title||o.project_name||'Property');
    const id=o.property_id||'AUM-WEB';
    const loc=locationLabel(o)||(o.sector?`${o.sector}, Gurgaon`:'Gurgaon');
    const price=priceLabel(o);
    const msg=`Hi Ajay, I am interested in ${name} (Ref: ${id}) in ${loc}, listed around ${price}. Please share the complete dossier.`;
    return `https://wa.me/919873813595?text=${encodeURIComponent(msg)}`;
  }

  // Global CRM Bridge for Client CRM Bot / Analytics
  if (typeof window.AUM_CRM_HOOK !== 'function') {
    window.AUM_CRM_HOOK = function(payload) {
      if (window._AUM_CRM_LISTENER) {
        try { window._AUM_CRM_LISTENER(payload); } catch (e) { console.error('CRM hook error:', e); }
      }
      window.dispatchEvent(new CustomEvent('aum:lead', { detail: payload }));
    };
  }

  function resultCard(o){
    const features=(o.public_features||o.key_features||'').split(';').filter(Boolean).slice(0,3);
    const rawName=o.website_display_name||o.listing_title||o.project_name||'Property';
    const publicName=cleanTitle(rawName);
    const inPropFolder=location.pathname.includes('/properties/');
    const detailHref=inPropFolder?`detail.html?id=${encodeURIComponent(o.property_id||'')}`:`properties/detail.html?id=${encodeURIComponent(o.property_id||'')}`;
    const imagePathPrefix=inPropFolder?'../assets/property-images/':'assets/property-images/';
    const wa=whatsappUrl(o);
    const image=representativeImage(o);
    const imageLabel=representativeLabel(o);
    const badgeText = o.image_label && o.image_label !== '*RP' ? esc(o.image_label) : 'Representative Image';
    const locStr = locationLabel(o) || 'Gurgaon';
    const priceStr = priceLabel(o);
    return `<article class="result-card" data-property-id="${esc(o.property_id || '')}" data-title="${esc(publicName)}" data-price="${esc(priceStr)}" data-location="${esc(locStr)}"><div class="result-photo" style="background-image:url('${imagePathPrefix}${image}')"><span class="representative-badge">${badgeText}</span><span class="result-type">${esc(imageLabel)}</span></div><div class="result-body"><div class="result-location">${esc(locStr)}</div><h3>${esc(publicName)}</h3><p class="result-config">${esc(o.configuration||'')} ${o.bedrooms?` · ${esc(o.bedrooms)} BHK`:''} ${areaLabel(o)?` · ${esc(areaLabel(o))}`:''}</p><p class="result-desc">${esc(o.public_description||o.key_features||'Property details available on enquiry.')}</p><div class="result-bottom"><strong class="tabular-nums">${esc(priceStr)}</strong><div class="result-actions"><a class="view-details" href="${detailHref}">View Dossier →</a><a class="result-contact" href="${wa}" target="_blank" rel="noopener">Inquire on WhatsApp</a></div></div>${features.length?`<div class="result-features">${features.map(f=>`<span>${esc(f.trim())}</span>`).join('')}</div>`:''}</div></article>`;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
      const contactBtn = e.target && e.target.closest ? e.target.closest('.result-contact') : null;
      if (contactBtn) {
        const card = contactBtn.closest('.result-card');
        if (card && typeof window.AUM_CRM_HOOK === 'function') {
          window.AUM_CRM_HOOK({
            action: 'inquire_whatsapp',
            source: 'inventory_search_grid',
            property_id: card.dataset.propertyId || '',
            title: card.dataset.title || '',
            price: card.dataset.price || '',
            location: card.dataset.location || '',
            timestamp: new Date().toISOString()
          });
        }
        return;
      }
      const viewBtn = e.target && e.target.closest ? e.target.closest('.view-details') : null;
      if (viewBtn) {
        const card = viewBtn.closest('.result-card');
        if (card && typeof window.AUM_CRM_HOOK === 'function') {
          window.AUM_CRM_HOOK({
            action: 'view_dossier_click',
            source: 'inventory_search_grid',
            property_id: card.dataset.propertyId || '',
            title: card.dataset.title || '',
            price: card.dataset.price || '',
            location: card.dataset.location || '',
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  }

  function populateSelects(){
    const curatedLocations = [
      { label: 'Golf Course Road & DLF 5', value: 'Golf Course Road' },
      { label: 'DLF Phase 1–5', value: 'DLF' },
      { label: 'Golf Course Extension & SPR', value: 'Golf Course Ext Road' },
      { label: 'Nirvana Country & Sector 50', value: 'Nirvana' },
      { label: 'Sohna Road & South Gurgaon', value: 'Sohna Road' },
      { label: 'Dwarka Expressway (DXP)', value: 'Dwarka Expressway' },
      { label: 'Sushant Lok 1 & 2', value: 'Sushant Lok' },
      { label: 'South City 1 & 2', value: 'South City' },
      { label: 'Sector 45 & Sector 46', value: 'Sector 46' },
      { label: 'Sector 57', value: 'Sector 57' },
      { label: 'Udyog Vihar', value: 'Udyog Vihar' },
      { label: 'Majorda, South Goa', value: 'Goa' }
    ];

    const curatedTypes = [
      { label: 'Luxury Condominiums & Apartments', value: 'Apartment' },
      { label: 'DLF & Luxury Builder Floors', value: 'Residential Builder Floor' },
      { label: 'Independent Villas & Houses', value: 'Villa / House' },
      { label: 'Residential Plots & Land', value: 'Plot / Kothi' },
      { label: 'Commercial Offices & Buildings', value: 'Commercial' },
      { label: 'Retail Shops & Showrooms', value: 'Shop / Commercial Unit' },
      { label: 'Private Farmhouses & Estates', value: 'Farmhouse' }
    ];

    document.querySelectorAll('[data-search-location]').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML='<option value="">Select Location Corridor</option>' + curatedLocations.map(l=>`<option value="${esc(l.value)}">${esc(l.label)}</option>`).join('');
      if(current) sel.value=current;
    });

    document.querySelectorAll('[data-search-type]').forEach(sel=>{
      const current=sel.value;
      sel.innerHTML='<option value="">Property Type</option>' + curatedTypes.map(t=>`<option value="${esc(t.value)}">${esc(t.label)}</option>`).join('');
      if(current) sel.value=current;
    });
  }

  function wireForm(form){
    if(!form) return;
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const params=new URLSearchParams();
      const mode=form.querySelector('[name=mode]')?.value||form.dataset.mode||'';
      if(mode) params.set('mode',mode);
      [['category','category'],['location','location'],['type','type'],['size','size'],['budget','budget'],['q','q']].forEach(([name,key])=>{
        const el=form.querySelector(`[name=${name}]`);
        if(el&&el.value) params.set(key,el.value);
      });
      const inPropPage=location.pathname.includes('/properties/');
      if(inPropPage){
        try {
          const qs=params.toString();
          window.history.replaceState(null,'',qs?('index.html?'+qs):'index.html');
        } catch(err){}
        renderResults();
      } else {
        location.href='properties/index.html?'+params.toString();
      }
    });
  }

  let renderResults = function(){};

  function setupKeywordSearch(inputId, formId){
    const input=document.getElementById(inputId);
    const form=document.getElementById(formId);
    if(!input || !form) return;
    const hidden=form.querySelector('[name=q]') || (()=>{ const el=document.createElement('input'); el.type='hidden'; el.name='q'; form.appendChild(el); return el; })();
    const chips=[...document.querySelectorAll('[data-keyword-chips] .keyword-chip')];
    let selected=[];

    const sync=(triggerRender=true)=>{
      const typed=input.value.trim();
      const parts=[...selected, typed].filter(Boolean);
      hidden.value=parts.join('||');
      chips.forEach(ch=>ch.classList.toggle('active',selected.includes(ch.dataset.keyword)));

      if(triggerRender && location.pathname.includes('/properties/')){
        const p=readCurrentForm(form);
        p.q=hidden.value;
        updateUrlState(p);
        executeRender(p);
      }
    };

    let debounceTimer=null;
    input.addEventListener('input',()=>{
      clearTimeout(debounceTimer);
      debounceTimer=setTimeout(()=>sync(true), 200);
    });

    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        sync(true);
      }
    });

    chips.forEach(ch=>{
      ch.addEventListener('click',()=>{
        if(ch.dataset.category){
          const cat=ch.dataset.category;
          const catInput=form.querySelector('[name=category]');
          if(catInput) catInput.value=cat;
          hidden.value='';
          input.value='';
          selected=[];
          chips.forEach(c=>c.classList.remove('active'));
          ch.classList.add('active');
          const p=readCurrentForm(form);
          p.category=cat;
          p.q='';
          updateUrlState(p);
          executeRender(p);
          return;
        }

        const k=ch.dataset.keyword;
        if(selected.includes(k)){
          selected=[];
          ch.classList.remove('active');
        } else {
          selected=[k];
          chips.forEach(c=>c.classList.remove('active'));
          ch.classList.add('active');
        }
        input.value='';
        sync(true);
      });
    });

    const searchButton=input.parentElement?.querySelector('.keyword-search-submit');
    searchButton?.addEventListener('click',()=>sync(true));

    const clear=input.parentElement?.querySelector('.keyword-clear');
    clear?.addEventListener('click',()=>{
      selected=[];
      input.value='';
      hidden.value='';
      chips.forEach(c=>c.classList.remove('active'));
      const catInput=form.querySelector('[name=category]');
      if(catInput) catInput.value='';
      form.reset();
      const p=readCurrentForm(form);
      p.q='';
      p.category='';
      updateUrlState(p);
      executeRender(p);
      input.focus();
    });

    const initialParams=readParams();
    if(initialParams.q){
      const parts=initialParams.q.split('||').filter(Boolean);
      const chipValues=chips.filter(c=>c.dataset.keyword).map(c=>c.dataset.keyword);
      selected=parts.filter(v=>chipValues.includes(v));
      input.value=parts.filter(v=>!chipValues.includes(v)).join(' ');
      sync(false);
    }
  }

  function readCurrentForm(form){
    return {
      mode: form.querySelector('[name=mode]')?.value || '',
      category: form.querySelector('[name=category]')?.value || '',
      location: form.querySelector('[name=location]')?.value || '',
      type: form.querySelector('[name=type]')?.value || '',
      size: form.querySelector('[name=size]')?.value || '',
      budget: form.querySelector('[name=budget]')?.value || '',
      q: form.querySelector('[name=q]')?.value || ''
    };
  }

  function updateUrlState(params){
    try {
      const qp=new URLSearchParams();
      Object.entries(params).forEach(([k,v])=>{if(v) qp.set(k,v);});
      const qs=qp.toString();
      window.history.replaceState(null,'',qs?('index.html?'+qs):'index.html');
    } catch(e){}
  }

  function executeRender(params){
    const host=document.getElementById('search-results');
    if(!host) return;
    const results=filtered(params);
    const count=document.getElementById('result-count');
    if(count) count.textContent=results.length;

    const summary=document.getElementById('search-summary');
    if(summary){
      const categoryName={residential:'Residential',commercial:'Commercial',plot:'Plots & Land',farmhouse:'Farmhouses','builder-floor':'DLF Builder Floors'}[params.category]||'';
      const bits=[
        params.mode==='buy'?'Buy':params.mode==='rent'?'Rent':params.mode==='commercial'?'Commercial':params.mode==='plot'?'Plot & Land':'All properties',
        categoryName,
        params.location,
        params.type,
        params.size,
        params.budget,
        params.q ? `Keyword: “${params.q}”` : ''
      ].filter(Boolean);
      summary.textContent=bits.join(' · ')||'All available search criteria';
    }

    const badge=document.getElementById('data-mode-badge');
    if(badge){
      badge.textContent=results.length ? 'Active Portfolio' : 'Curated Enquiry';
      badge.className='data-mode-badge';
    }

    if(results.length){
      host.innerHTML=results.map(resultCard).join('');
    } else {
      host.innerHTML=`<div class="no-results">
        <h3>No exact matches found</h3>
        <p>We represent exclusive private mandates across Golf Course Road, DLF Phase 1–5, and prime Gurgaon enclaves that are held off-market. Contact our principal advisory desk with your exact requirements for a confidential shortlist.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px;">
          <button type="button" class="btn" id="reset-filters-btn" style="background:var(--bg-page);color:var(--text-main);border:1px solid var(--border-light);">Reset All Filters</button>
          <a class="btn" style="background:var(--oxblood);color:#ffffff;border:1px solid rgba(197,160,89,0.4);" href="https://wa.me/919873813595?text=Hello%20Ajay%20Mukhija%2C%20I%20am%20looking%20for%20a%20property%20in%20Gurgaon." target="_blank" rel="noopener">Request Private Mandate on WhatsApp →</a>
        </div>
      </div>`;

      document.getElementById('reset-filters-btn')?.addEventListener('click',()=>{
        const form=document.getElementById('results-search-form');
        if(form){
          form.reset();
          ['mode','category','location','type','size','budget','q'].forEach(n=>{
            const el=form.querySelector(`[name=${n}]`);
            if(el) el.value='';
          });
          const kw=document.getElementById('results-keyword-input');
          if(kw) kw.value='';
          document.querySelectorAll('[data-keyword-chips] .keyword-chip').forEach(c=>c.classList.remove('active'));
          updateUrlState({});
          executeRender({});
        }
      });
    }
  }

  function initHome(){
    const form=document.getElementById('home-search-form');
    if(!form) return;
    wireForm(form);
  }

  function initResults(){
    const host=document.getElementById('search-results');
    if(!host) return;
    renderResults=function(){
      const params=readParams();
      executeRender(params);
    };

    populateSelects();

    const form=document.getElementById('results-search-form');
    const params=readParams();

    if(form){
      const hiddenMode=form.querySelector('[name=mode]');
      if(hiddenMode) hiddenMode.value=params.mode;
      ['category','location','type','size','budget','q'].forEach(n=>{
        const el=form.querySelector(`[name=${n}]`);
        if(el) el.value=params[n]||'';
      });

      // Attach live onchange handlers to all selects for instantaneous UX
      form.querySelectorAll('select').forEach(sel=>{
        sel.addEventListener('change',()=>{
          const p=readCurrentForm(form);
          updateUrlState(p);
          executeRender(p);
        });
      });

      wireForm(form);
      setupKeywordSearch('results-keyword-input','results-search-form');
    }

    // Auto-focus search input if ?focus=search is in URL
    if(new URLSearchParams(location.search).get('focus')==='search'){
      const kw=document.getElementById('results-keyword-input');
      if(kw){ kw.focus(); kw.scrollIntoView({behavior:'smooth',block:'center'}); }
    }

    renderResults();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    initHome();
    initResults();
  });
})();
