/* Private brand applications board. No listing data is altered here. */
(() => {
  const directions = {
    datum: {
      number:'01',name:'Datum',tag:'Architectural precision',quality:'Clarity',material:'Registration, line, measure',restraint:'Never turn the grid into wallpaper',
      thesis:'A grid that earns its presence by doing useful work. Precision becomes the brand’s personality.',
      color:'#E5EBE5',texture:'A hairline register creates depth through alignment, not simulated paper grain.',
      motion:'Static by default. A precise underline and clear focus state are enough to explain interaction.',
      use:'AUM Estates as a dependable advisor: structure, verified detail, and restrained authority.',
      risk:'Excessive gridding feels institutional and distracts from people.',
      test:'Hide every ornamental line. Can someone still find inventory, understand categories, and distinguish known from unverified facts?'
    },
    sun: {
      number:'02',name:'Sun',tag:'Light and shallow relief',quality:'Warmth',material:'Facade fins, daylight, shade',restraint:'Never animate the search form',
      thesis:'Architectural light is the protagonist. A soft raking shadow makes the brand feel spatial without turning the page into a render.',
      color:'#E4EAE1',texture:'Tonal bands borrow their rhythm from sunlight across shallow architectural relief.',
      motion:'On capable devices, shift the light angle only within the decorative field. Static on touch and reduced-motion preferences.',
      use:'When the company needs a human and approachable atmosphere without sacrificing exactness.',
      risk:'Heavy gradients, fake reflections or continuous movement would look like an expensive theme rather than a durable identity.',
      test:'Does the hero feel complete when the shader is disabled? Does the mobile page remain fast and readable?'
    },
    atlas: {
      number:'03',name:'Atlas',tag:'Contour and place',quality:'Orientation',material:'Abstract contours, registers, fields',restraint:'Never imply a real map or location',
      thesis:'Place is the medium, not a stock skyline. Abstract topographic layers give AUM Estates a visual vocabulary for orientation.',
      color:'#DDE8DE',texture:'Contours are illustrated scalar-field lines, not GIS, parcel boundaries or measurements.',
      motion:'No ambient animation. An optional subtle contour shift may accompany a deliberate section transition.',
      use:'For location-led discovery, area guides and advisory dossiers that connect choices to their surroundings.',
      risk:'Contours can be mistaken for geographic accuracy. They must always be framed as abstraction.',
      test:'Can customers tell the difference between graphic texture and factual maps, coordinates or property boundaries?'
    },
    screen: {
      number:'04',name:'Screen',tag:'Perforation and shadow',quality:'Cultural specificity',material:'Modern aperture, modular shadow',restraint:'No decorative heritage costume',
      thesis:'A contemporary perforated architectural screen translates the region’s built environment into a disciplined, modular brand mark.',
      color:'#D6E0D5',texture:'Perforations create a cadence through negative space. They are a pattern of apertures rather than pictorial ornaments.',
      motion:'A single crisp reveal at panel edges is enough; do not fill the browsing interface with moving holes.',
      use:'For physical signage, presentation folders, window films and compact brand recall in Gurugram.',
      risk:'Using the motif everywhere can make the company appear like an architecture studio or a hospitality venue.',
      test:'Is the motif recognizable at a distance and still calm when repeated over a large physical surface?'
    },
    imprint: {
      number:'05',name:'Imprint',tag:'Editorial materiality',quality:'Permanence',material:'Emboss, paper edge, printed register',restraint:'No faux grain over body copy',
      thesis:'Confidence in print. Debossed-looking marks and immaculate typography lend a feeling of permanence to the advisory relationship.',
      color:'#E8EEE8',texture:'Depth comes from opposing edge highlights and restrained paper relief, not dirty overlays or noisy grain.',
      motion:'None by default. If anything moves, it should be the clear state of a control, not a hovering material simulation.',
      use:'For refined correspondence, seller dossiers, welcome packets and physical stationery.',
      risk:'Too much embossing makes controls less legible and can slide toward imitation luxury.',
      test:'Is the mark still strong in one-color ink on ordinary office paper? Does digital UI retain adequate contrast?'
    }
  };
  const byId = id => directions[id] || directions.datum;
  const setText = (id,value) => {document.getElementById(id).textContent=value;};
  function choose(id, updateUrl=true) {
    const item=byId(id);
    const key=Object.keys(directions).find(k=>directions[k]===item);
    document.body.dataset.concept=key;
    setText('board-number',item.number+' / 05');
    setText('board-name',item.name);
    setText('board-tag',item.tag);
    setText('board-thesis',item.thesis);
    setText('board-quality',item.quality);
    setText('board-material',item.material);
    setText('board-restraint',item.restraint);
    setText('material-color',item.color);
    setText('board-texture',item.texture);
    setText('board-motion',item.motion);
    setText('board-use',item.use);
    setText('board-risk',item.risk);
    setText('board-test',item.test);
    setText('stage-code','A/E · '+item.number);
    setText('stage-name',item.name.toUpperCase()+' / '+item.tag.toUpperCase());
    document.querySelectorAll('[data-concept-option]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.conceptOption===key)));
    const back='./index.html'+(key==='datum'?'':'?studio='+key);
    ['board-home','board-return','board-footer-link'].forEach(k=>document.getElementById(k).href=back);
    try {localStorage.setItem('aum-brand-direction-v1',key);} catch {}
    if(updateUrl) {
      const url=new URL(window.location.href);
      url.searchParams.set('concept',key);
      history.replaceState(null,'',url);
    }
  }
  document.querySelectorAll('[data-concept-option]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.conceptOption)));
  window.addEventListener('popstate',()=>choose(new URL(location.href).searchParams.get('concept'),false));
  const fromUrl=new URL(location.href).searchParams.get('concept');
  let stored;
  try {stored=localStorage.getItem('aum-brand-direction-v1');} catch {}
  choose(directions[fromUrl]?fromUrl:stored,false);
})();
