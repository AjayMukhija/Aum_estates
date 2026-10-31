(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>{if(v==null||v==='')return '';const n=Number(v);if(!Number.isFinite(n))return String(v);if(n>=1e7)return `₹${(n/1e7).toFixed(n%1e7?2:0)} Cr`;if(n>=1e5)return `₹${(n/1e5).toFixed(n%1e5?1:0)} Lakh`;return `₹${Math.round(n).toLocaleString('en-IN')}`};
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
function cleanTitle(s){
  if(!s) return 'Featured Property';
  return String(s)
    .replace(/\s+MP$/i, '')
    .replace(/\s+OC tower$/i, ' (OC Received)')
    .replace(/\s+#\d+$/i, '')
    .trim();
}
const price=o=>{if(/rent/i.test(String(o.transaction_type||''))&&o.rent_value)return `${money(o.rent_value)} / month`;if(o.price_text){const san=sanitizePriceText(o.price_text);if(san)return san;}if(o.price_value!=null){const u=String(o.price_unit||'').toLowerCase();if(u.includes('per sq'))return `${money(o.price_value)} / ${o.price_unit.replace(/per\s*/i,'')}`;if(u==='cr'||u.includes('crore'))return `₹${o.price_value} Cr`;if(u.includes('lakh'))return `₹${o.price_value} Lakh`;return money(o.price_value)}return 'Price on Request'};
const area=o=>o.area_value?`${o.area_value} ${o.area_unit||''}`.trim():'';
const p=new URLSearchParams(location.search); const id=p.get('id');
const source=Array.isArray(window.AUM_PUBLIC_INVENTORY)?window.AUM_PUBLIC_INVENTORY:(window.AUM_DEV_INVENTORY||[]); const data=source.find(x=>x&&x.property_id===id);
if(!data){
  const titleEl=document.getElementById('detail-title'); if(titleEl) titleEl.textContent='Property Not Found';
  const locEl=document.getElementById('detail-location'); if(locEl) locEl.textContent='The requested property dossier is not available or has been archived.';
  const photoEl=document.getElementById('detail-photo'); if(photoEl) photoEl.style.display='none';
  const priceEl=document.getElementById('detail-price'); if(priceEl) priceEl.style.display='none';
  const descEl=document.getElementById('detail-description'); if(descEl) descEl.innerHTML='Please browse our <a href="index.html" style="color:var(--gold-metallic, #c5a059);text-decoration:underline;font-weight:600;">complete collection of verified properties</a> or contact our advisory desk directly.';
  return;
}

function representativeCategory(o){
const p=String(o.property_type||'').toLowerCase().trim();
const c=String(o.configuration||'').toLowerCase().trim();
const title=String([o.listing_title,o.website_display_name,o.project_name,o.inventory_category,o.category,o.property_category].filter(Boolean).join(' ')).toLowerCase();
const combined=`${p} ${c}`;
// Explicit Plot/Plots/Land in a listing title or category wins over conflicting generic type.
if(/\bplots?\b|\bland\b/.test(title)||/\bplots?\b|\bland\b/.test(p+' '+c)) return 'plot';
if(/villa|house|kothi/.test(p)) return 'villa';
if(/farmhouse/.test(p)||/farmhouse/.test(c)) return 'farmhouse';
if(/builder\s*floor/.test(p)) return 'builder-floor';
if(/apartment|flat/.test(p)) return 'apartment';
if(/guest\s*house|hotel|hospitality/.test(p+' '+c)) return 'commercial';
if(/commercial/.test(p)||/office|shop|retail|industrial|building/.test(p)){
if(/shop|retail/.test(c)) return 'shop';
if(/office/.test(c)&&!/building\s*\/\s*office\s*building/.test(c)) return 'office';
if(/building\s*\/\s*office\s*building|office\s*building|building/.test(c)) return 'building';
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
    [/asya smartliving|sukoon/.test(name),'sukoon-asya-project-photo.png'],
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
function representativeLabel(o){const c=representativeCategory(o);return ({villa:'Villa / House',farmhouse:'Farmhouse','builder-floor':'Builder Floor',apartment:'Apartment',plot:'Plot / Land',shop:'Shop / Retail',office:'Office',building:'Building / Office Building',commercial:'Commercial'})[c]||'Apartment';}
const name=cleanTitle(data.website_display_name||data.listing_title||data.project_name||'Property');
document.title=`${name} | AUM ESTATES`;
const bc=document.getElementById('breadcrumb-title'); if(bc) bc.textContent=name;
document.getElementById('detail-title').textContent=name;
document.getElementById('detail-location').textContent=[data.locality,data.sector,data.city].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
document.getElementById('detail-type').textContent=representativeLabel(data);
document.getElementById('detail-price').textContent=price(data);
document.getElementById('detail-photo').style.backgroundImage=`url('../assets/property-images/${representativeImage(data)}')`;
const isProjectPhoto=/asya smartliving|sukoon/i.test([data.listing_title,data.project_name,data.locality].join(' '));
document.getElementById('detail-badge').textContent=isProjectPhoto?'Project Photo':'Representative Image';
document.getElementById('detail-description').textContent=data.public_description||data.key_features||'Property details available on enquiry.';
const facts=[['Configuration',data.configuration],['BHK',data.bedrooms?`${data.bedrooms} BHK`:'' ],['Area',area(data)],['Floor',data.floor],['Facing',data.facing],['Road Width',data.road_width],['Furnishing',data.furnishing],['Possession / Availability',data.possession_status],['Transaction',data.transaction_type]].filter(x=>x[1]);
document.getElementById('detail-grid').innerHTML=facts.map(([k,v])=>`<div class="detail-spec"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
const feats=(data.public_features||data.key_features||'').split(';').map(x=>x.trim()).filter(Boolean);
if(feats.length){
  const fw=document.getElementById('features-wrapper'); if(fw) fw.style.display='block';
  document.getElementById('detail-features').innerHTML=feats.map(x=>`<span>${esc(x)}</span>`).join('');
}
const locLabel = [data.locality, data.sector, data.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Gurgaon';
const waMsg = `Hi Ajay, I am interested in ${name} (Ref: ${data.property_id || 'N/A'}) in ${locLabel}, listed around ${price(data)}. Please share the complete dossier.`;
const waBtn = document.getElementById('detail-wa-btn');

// Global CRM bridge definition
if (typeof window.AUM_CRM_HOOK !== 'function') {
  window.AUM_CRM_HOOK = function(payload) {
    if (window._AUM_CRM_LISTENER) {
      try { window._AUM_CRM_LISTENER(payload); } catch (e) { console.error('CRM hook error:', e); }
    }
    window.dispatchEvent(new CustomEvent('aum:lead', { detail: payload }));
  };
}

if (waBtn) {
  waBtn.href = 'https://wa.me/919873813595?text=' + encodeURIComponent(waMsg);
  waBtn.addEventListener('click', function() {
    window.AUM_CRM_HOOK({
      action: 'inquire_whatsapp',
      source: 'property_detail_view',
      property_id: data.property_id || '',
      title: name,
      price: price(data),
      location: locLabel,
      timestamp: new Date().toISOString()
    });
  });
}

// Fire page dossier view hook for tracking
window.AUM_CRM_HOOK({
  action: 'view_dossier',
  source: 'property_detail_view',
  property_id: data.property_id || '',
  title: name,
  price: price(data),
  location: locLabel,
  timestamp: new Date().toISOString()
});
})();
