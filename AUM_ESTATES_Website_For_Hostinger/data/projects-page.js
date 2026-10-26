(function(){
'use strict';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const projects=Array.isArray(window.AUM_PROJECTS_LOCAL)?window.AUM_PROJECTS_LOCAL:[];
const inventory=Array.isArray(window.AUM_DEV_INVENTORY)?window.AUM_DEV_INVENTORY:[];

const byId=new Map();
inventory.filter(x=>x&&x.transaction_type).forEach(x=>{
  if(x.project_id) byId.set(x.project_id,(byId.get(x.project_id)||0)+1);
});

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
    location:'Sector 43, Gurugram', type:'Ultra-Luxury Residential',
    price:'Price on Request',
    desc:'Ultra-luxury residences on Golf Course Road micro-market positioned around open greens and bespoke club amenities.',
    image:'../assets/project-images/godrej-meridian.jpg'
  },
  'DLF The Aureva':{
    location:'Sector 63, Gurugram', type:'Luxury Condominiums',
    price:'EOI / Price on Request',
    desc:'Curated luxury residential development on Golf Course Extension Road with RERA certification and prime sector connectivity.',
    image:'../assets/project-images/dlf-exclusive-floors.jpg'
  },
  'Tonino Lamborghini Residences Gurugram':{
    location:'Golf Course Extension, Gurugram', type:'Branded Luxury Residences',
    price:'Price on Request',
    desc:'Signature branded luxury residences designed with iconic European architecture, private terraces, and bespoke hospitality services.',
    image:'../assets/project-images/pioneer-araya.jpg'
  },
  'Vantage Aura':{
    location:'Sohna Road, Sector 48, Gurugram', type:'Commercial & Retail',
    price:'₹90 Lakh onwards',
    desc:'Grade-A commercial spaces, retail showrooms, and office suites with prime frontage on main Sohna Road.',
    image:'../assets/project-images/smartworld-orchid.jpg'
  },
  'Omara Trehan':{
    location:'Golf Course Extension Road, Gurugram', type:'Luxury Low-Rise Floors',
    price:'Price on Request',
    desc:'Exclusive low-rise luxury residences offering basement, stilt parking, private lift lobbies, and landscaped garden terraces.',
    image:'../assets/project-images/omara-trehan.jpg'
  },
  'Orchid Ivy Floors':{
    location:'Sector 51, Gurugram', type:'Luxury Builder Floors',
    price:'₹3.80 Cr – ₹5.25 Cr',
    desc:'Gated low-rise residences offering 260 sq yd 3 BHK + Study and 350 sq yd 4 BHK configurations in central Gurgaon.',
    image:'../assets/project-images/orchid-island.jpg'
  },
  'M3M Smartworld':{
    location:'Sector 113, Dwarka Expressway', type:'Luxury High-Rise',
    price:'Price on Request',
    desc:'Contemporary high-rise residences positioned on the 0-km Delhi-Gurgaon border with multi-tier clubhouse amenities.',
    image:'../assets/project-images/smartworld-sky-arc.webp'
  },
  'Shukrana Homes Super Luxury Floors':{
    location:'Sushant Lok 1, Gurugram', type:'Super Luxury Builder Floors',
    price:'₹3.80 Cr – ₹4.45 Cr',
    desc:'Bespoke 4 BHK luxury builder floors with Italian marble flooring, imported modular kitchen, private terrace, and stilt parking.',
    image:'../assets/project-images/sushant-lok.jpg'
  },
  'Green Oaks':{
    location:'Sector 70A, SPR Corridor, Gurugram', type:'Independent Luxury Floors',
    price:'₹2.60 Cr onwards',
    desc:'Contemporary 3 BHK + Home Office configurations in a secure gated enclave along Southern Peripheral Road.',
    image:'../assets/project-images/emerald-floors-premier.jpg'
  },
  'Premium Luxury Floors':{
    location:'Nirvana Country & Sector 50, Gurugram', type:'Luxury Builder Floors',
    price:'Price on Request',
    desc:'High-specification independent floors with private elevators, landscaped terraces, and 24/7 gated security.',
    image:'../assets/project-images/south-city-2.jpg'
  },
  'Palm Floors':{
    location:'Ardee City, Sector 52, Gurugram', type:'Luxury Builder Floors',
    price:'₹3.65 Cr',
    desc:'240 sq yd 3 BHK low-rise floor with private terrace rights, premium woodwork, and dedicated double-bay stilt parking.',
    image:'../assets/project-images/palm-terrace-select.jpeg'
  },
  'TARC Tripundra':{
    location:'Main Bijwasan Road, South Delhi / NCR', type:'Luxury Condominiums',
    price:'₹6.40 Cr onwards',
    desc:'Ready-to-move 3 & 4 BHK luxury residences surrounded by lush farm land and direct connectivity to Aerocity.',
    image:'../assets/project-images/tata-raisina.webp'
  },
  'Saan Verdante':{
    location:'Sector 95, Gurugram', type:'Boutique Luxury Residences',
    price:'₹4.33 Cr onwards',
    desc:'Eco-luxury 3 & 4 BHK boutique residences featuring green building compliance, private decks, and panoramic Aravalli views.',
    image:'../assets/project-images/urban-oasis.jpg'
  },
  'Nitara Ultra Luxury Triplex Residences':{
    location:'Emaar Emerald Hills, Sector 65, Gurugram', type:'Ultra-Luxury Triplex Penthouses',
    price:'₹11.00 Cr',
    desc:'Signature triplex sky residences with private plunge pool, personal elevator, double-height living room, and Golf Course views.',
    image:'../assets/project-images/pioneer-presidia.jpg'
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
  grid.innerHTML=list.map(p=>{
    const image=p.image || '../assets/project-images/privana.jpg';
    const waText=encodeURIComponent([
      'AUM ESTATES – NEW PROJECT ENQUIRY',
      '',
      `Project: ${p.project_name}`,
      `Location: ${p.location||'Gurgaon'}`,
      `Type: ${p.type||'New Project'}`,
      `Price: ${p.price||'Price on Request'}`,
      '',
      'Hello AUM ESTATES, please share the verified master plan, brochure, and current unit availability for this project.'
    ].join('\n'));

    return `<article class="result-card">
      <div class="result-photo" style="background-image:url('${esc(image)}')">
        <span class="representative-badge">Developer Launch</span>
        <span class="result-type">${esc(p.type||'New Project')}</span>
      </div>
      <div class="result-body">
        <div class="result-location">${esc(p.location||'Gurgaon')}</div>
        <h3>${esc(p.project_name)}</h3>
        <p class="result-desc">${esc(p.desc||'Curated developer project represented by AUM ESTATES.')}</p>
        <div class="result-bottom">
          <strong class="tabular-nums">${esc(p.price||'Price on Request')}</strong>
          <div class="result-actions">
            <a class="result-contact" href="https://wa.me/919873813595?text=${waText}" target="_blank" rel="noopener">Inquire on WhatsApp</a>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
}
})();
