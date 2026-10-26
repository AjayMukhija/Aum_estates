(function(){
'use strict';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const projects=Array.isArray(window.AUM_PROJECTS_LOCAL)?window.AUM_PROJECTS_LOCAL:[];
const inventory=Array.isArray(window.AUM_DEV_INVENTORY)?window.AUM_DEV_INVENTORY:[];

const byId=new Map();
inventory.filter(x=>x&&x.transaction_type).forEach(x=>{
  if(x.project_id) byId.set(x.project_id,(byId.get(x.project_id)||0)+1);
});

/*
  PUBLIC NEW PROJECTS
  -------------------
  This section deliberately uses the 14 AUM ESTATES New Project classifications.
  Public visibility is controlled here because these project records are retained
  as internal project-level records in the master inventory.
*/
const names=[
 'Godrej Miraya',
 'DLF The Aureva',
 'Tonino Lamborghini Residences Gurugram',
 'Vantage Aura',
 'Omara Trehan',
 'Orchid Ivy Floors',
 'M3M Smartworld',
 'Shukrana Homes Super Luxury Floors',
 'Green Oaks',
 'Premium Luxury Floors',
 'Palm Floors',
 'TARC Tripundra',
 'Saan Verdante',
 'Nitara Ultra Luxury Triplex Residences'
];

const overrides={
 'Close North':{image:'../assets/project-images/close-north.jpg'},
 'Close South':{image:'../assets/project-images/close-south.jpg'},
 'Godrej Miraya':{
   location:'Sector 43, Gurugram', type:'Luxury Residential',
   price:'Price on Request',
   desc:'Ultra-luxury residences positioned around space, blues and greens. Detailed unit inventory and pricing to be confirmed.',
   image:'https://jssrealtyinfratech.com/wp-content/uploads/2024/11/Artistic-Impression-1024x576.png'
 },
 'DLF The Aureva':{
   location:'Sector 63, Gurugram', type:'Senior Living Residential',
   price:'EOI / Price on Request',
   desc:'Senior-living luxury residential project. RERA certificate received; EOI information recorded in the AUM inventory.',
   image:'https://micl.site/uploads/images/properties/308/ChatGPT%20Image%20Jun%2012%2C%202026%2C%2010_09_25%20PM.png'
 },
 'Tonino Lamborghini Residences Gurugram':{
   location:'Gurugram', type:'Branded Luxury Residential',
   price:'Price on Request',
   desc:'Phase 2 launching soon. Branded residences positioned around Italian design, precision and character.',
   image:'images/tonino-lamborghini-residences-gurugram.jpg'
 },
 'Vantage Aura':{
   location:'Sohna Road, Sector 48, Gurugram', type:'Commercial',
   price:'₹90 Lacs onwards',
   desc:'Self-use commercial units on Sohna Road, Sector 48.',
   image:'images/vantage-aura.jpg'
 },
 'Omara Trehan':{
   location:'Gurugram', type:'Luxury Residential',
   price:'Price on Request',
   desc:'Premium residential project. Detailed public unit information is pending in the AUM inventory.',
   image:'../assets/project-images/omara-trehan.jpg'
 },
 'Orchid Ivy Floors':{
   location:'Sector 51, Gurugram', type:'Builder Floors',
   price:'₹3.80 Cr* – ₹5.25 Cr*',
   desc:'Premium luxury floors with 260 sq yd 3 BHK + Study and 350 sq yd 4 BHK + Study options. Public page does not show builder identity or exact property address.',
   image:'images/orchid-ivy-floors.jpg'
 },
 'M3M Smartworld':{
   location:'Gurugram', type:'New Project',
   price:'Price on Request',
   desc:'Project-level information retained in the New Projects collection. Detailed public unit inventory is pending.',
   image:'images/m3m-smartworld.jpg'
 },
 'Shukrana Homes Super Luxury Floors':{
   location:'Sushant Lok-1, Gurugram', type:'Builder Floors',
   price:'₹3.80 Cr – ₹4.45 Cr options',
   desc:'Luxury builder-floor options. Public page intentionally omits builder identity and exact property address.',
   image:'images/shukrana-homes.jpg'
 },
 'Green Oaks':{
   location:'Sector 70A, Gurugram', type:'Builder Floors',
   price:'₹2.60 Cr onwards',
   desc:'3 BHK + office builder-floor inventory. Public page omits builder identity and exact property address.',
   image:'https://img.staticmb.com/mbphoto/property/cropped_images/2026/Feb/03/Photo_h470_w1080/3034bbc5-6c89-45f2-bbe5-8ec2a94b1467_83243537_470_1080.jpg'
 },
 'Premium Luxury Floors':{
   location:'Gurugram', type:'Builder Floors',
   price:'Unit-wise price on request',
   desc:'Premium luxury builder-floor inventory across Nirvana Country Sector 50 and Ardee City Sector 52. Public page omits builder identity and exact property addresses.',
   image:'images/premium-luxury-floors.jpg'
 },
 'Palm Floors':{
   location:'Ardee City, Gurugram', type:'Builder Floors',
   price:'₹3.65 Cr negotiable',
   desc:'240 sq yd 3 BHK 4th-floor option with terrace and stilt parking. Exact property address is kept private.',
   image:'https://im.proptiger.com/1/3291449/6/floors-ardee-city-elevation-148844998.jpeg?height=768&width=1336'
 },
 'TARC Tripundra':{
   location:'South Delhi', type:'Luxury Residential',
   price:'₹6.40 Cr onwards',
   desc:'Ready-to-move 3 & 4 BHK luxury residences in South Delhi. The public page shows only the broad location and project information.',
   image:'images/tarc-tripundra.jpg'
 },
 'Saan Verdante':{
   location:'Sector 95, Gurugram', type:'Boutique Residential',
   price:'₹4.33 Cr onwards',
   desc:'3 & 4 BHK boutique residences in Sector 95, Gurugram.',
   image:'images/saan-verdante.jpg'
 },
 'Nitara Ultra Luxury Triplex Residences':{
   location:'Emaar Emerald Hills, Sector 65, Gurugram', type:'Ultra Luxury Residential',
   price:'₹11 Cr',
   desc:'Ultra-luxury triplex residences. The public page shows broad project information and a representative architectural image.',
   image:'images/nitara.jpg'
 }
};

const byName=new Map(projects.map(p=>[String(p.project_name||'').trim(),p]));
const list=names.map(name=>{
  const p=byName.get(name)||{};
  return Object.assign({project_name:name},p,overrides[name]||{});
});

const count=document.getElementById('project-count');
if(count) count.textContent=list.length;

const grid=document.getElementById('project-grid');
if(grid){
 grid.innerHTML=list.map((p,i)=>{
   const projectClassification=[p.project_name,p.type,p.project_type,p.project_category,p.category,p.description,p.key_features,p.public_description].filter(Boolean).join(' ').toLowerCase();
   const isPlotProject=/(^|\W)(plots?|land)(\W|$)/.test(projectClassification);
   const image=isPlotProject ? '../assets/project-images/plot-land-user.jpg' : (p.image||'');
   const photo=image
      ? `<div class="result-photo project-photo" style="background-image:url('${esc(image)}')"><span class="result-badge">NEW PROJECT</span></div>`
      : `<div class="result-photo project-photo no-project-image"><span class="result-badge">NEW PROJECT</span><div class="no-image-title">${esc(p.project_name)}</div></div>`;
   const availability=byId.get(p.project_id)||0;
   return `<article class="result-card">
      ${photo}
      <div class="result-body">
        <div class="result-location">${esc(p.location||[p.locality,p.sector,p.city].filter(Boolean).join(', ')||'Gurugram')}</div>
        <h3>${esc(p.project_name)}</h3>
        <p class="result-config">${esc(p.type||p.project_type||'New Project')}</p>
        <p class="result-desc">${esc(p.desc||p.description||'Project information available through AUM ESTATES. Details to be confirmed.')}</p>
        <div class="result-bottom">
          <strong>${esc(p.price||'Price on Request')}</strong>
          <a class="result-contact" href="https://wa.me/919873813595?text=${encodeURIComponent(`Hello AUM ESTATES, I am interested in ${p.project_name}. Please share the latest availability, price and details.`)}" target="_blank" rel="noopener">Enquire on WhatsApp</a>
        </div>
        <div class="result-features">
          <span>New Project</span>
          ${availability?`<span>${availability} current ${availability===1?'property':'properties'}</span>`:''}
          ${p.type==='Builder Floors'?'<span>Public details protected</span>':''}
        </div>
      </div>
   </article>`;
 }).join('');
}

})();
