(function(){
'use strict';
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

const projects=Array.isArray(window.AUM_PROJECTS_LOCAL)?window.AUM_PROJECTS_LOCAL:[];
const inventory=Array.isArray(window.AUM_PUBLIC_INVENTORY)?window.AUM_PUBLIC_INVENTORY:(window.AUM_DEV_INVENTORY||[]);

const byId=new Map();
inventory.filter(x=>x&&x.transaction_type).forEach(x=>{
  if(x.project_id) byId.set(x.project_id,(byId.get(x.project_id)||0)+1);
});

// Render only the approved curated master feed. No browser-side fallback
// can invent a project that was withdrawn or replace its current price.
const list=projects.filter(p=>p.is_new_project_curated).map(p=>({
  ...p,
  location:[...new Set([p.locality,p.sector,p.city].filter(Boolean))].join(', '),
  type:p.project_type,
  price:p.price_band_text || 'Price on Request',
  desc:p.description,
  image:p.image_file && /^[a-zA-Z0-9_.-]+$/.test(p.image_file) ? `../assets/project-images/${p.image_file}` : null
}));

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
        <span class="representative-badge">Representative Image</span>
        <span class="result-type">${esc(p.type||'New Project')}</span>
      </div>
      <div class="result-body">
        <div class="result-location">${esc(p.location||'Gurgaon')}</div>
        <h3>${esc(p.project_name)}</h3>
        <p class="result-desc">${esc(p.desc||'Curated developer project represented by AUM ESTATES.')}</p>
        <div class="result-bottom">
          <strong class="tabular-nums">${esc(p.price||'Price on Request')}</strong>
          <div class="result-actions">
            <a class="result-contact" data-project-inquiry="${esc(p.project_name)}" href="https://wa.me/919873813595?text=${waText}" target="_blank" rel="noopener">Inquire on WhatsApp</a>
          </div>
        </div>
      </div>
    </article>`;
  }).join('');
  grid.addEventListener('click', e => {
    const link = e.target.closest('[data-project-inquiry]');
    if (link) window.AUM_CRM_HOOK({ action: 'advisor_inquiry', source: 'new_projects', title: link.dataset.projectInquiry });
  });
}
})();
