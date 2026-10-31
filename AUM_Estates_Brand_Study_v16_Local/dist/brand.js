/*
 * AUM ESTATES / BRAND LAB
 * Five distinct identities over one trustworthy property product.
 * WebGL is optional and ornamental. Information never depends on it.
 */
(() => {
  const themes = [
    {id:'datum',number:'01',name:'DATUM',title:'ARCHITECTURAL DATUM',tech:'CSS / vector rules',description:'The original white architectural register. Hard alignment, disciplined spacing, hairline rules and precise red markers put search and inventory first.'},
    {id:'sun',number:'02',name:'SUN',title:'SUN STUDY',tech:'WebGL light study + CSS fallback',description:'A warm sunlit facade changes the entire hero. Bold architectural relief, generous illuminated space, and a floating white search desk.'},
    {id:'atlas',number:'03',name:'ATLAS',title:'CONTOUR ATLAS',tech:'WebGL contour field + CSS fallback',description:'A deep evergreen reading room and high-contrast property register. Illustrated contours suggest place without claiming to be geographic data.'},
    {id:'screen',number:'04',name:'SCREEN',title:'CONTEMPORARY SCREEN',tech:'CSS architectural perforation',description:'An oxide-red architectural facade, large white grotesk typography and modular openings. An unmistakable identity at first glance.'},
    {id:'imprint',number:'05',name:'IMPRINT',title:'EDITORIAL IMPRINT',tech:'CSS material relief',description:'An editorial print language: generous serif display, crisp ink, pale paper, and framed property dossiers. Material texture stays off body text.'}
  ];
  const byId = Object.fromEntries(themes.map(theme=>[theme.id,theme]));
  const studio = document.getElementById('brand-studio');
  const trigger = document.getElementById('studio-trigger');
  const panel = document.getElementById('studio-panel');
  const preview = panel.querySelector('.studio-preview');
  const field = document.querySelector('.brand-field');
  const fieldCanvas = document.getElementById('brand-field-canvas');
  const previewCanvas = document.getElementById('studio-preview-canvas');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const contextCache = new WeakMap();
  let active='datum';
  let pointer=.28;
  let renderQueued=false;

  function makeContext(canvas) {
    if(contextCache.has(canvas)) return contextCache.get(canvas);
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power'}); }
    catch { gl=null; }
    if(!gl) { contextCache.set(canvas,null); return null; }
    const vertex = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position,0.0,1.0); }
    `;
    const fragment = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_pointer;
      uniform float u_mode;
      void main() {
        vec2 uv=gl_FragCoord.xy/u_resolution;
        vec3 color=vec3(1.0);
        if(u_mode<1.5) {
          // A shallow field of vertical architectural fins and cast shadows.
          float x=uv.x*9.0+uv.y*.17;
          float phase=fract(x);
          float face=smoothstep(.025,.08,phase)*(1.0-smoothstep(.18,.245,phase));
          float penumbra=.21+.13*u_pointer;
          float shadow=(1.0-smoothstep(.20,.20+penumbra,phase))*(1.0-face);
          float light=.88+.12*(.5+.5*cos(u_pointer*2.4+uv.y*1.2));
          color=vec3(1.0,.986,.954)-vec3(.175,.16,.134)*face*light-vec3(.090,.088,.071)*shadow;
          color+=vec3(.015,.015,.012)*sin(uv.y*2.2+uv.x*1.1);
        } else {
          // An abstract scalar field, sliced by contour intervals.
          float h=.31*sin(uv.x*8.5+sin(uv.y*5.2)*.9)
            +.28*sin(uv.y*11.0-uv.x*3.4)
            +.22*cos(length((uv-vec2(.58,.45))*vec2(1.45,1.0))*16.0);
          float d=abs(fract(h*9.0)-.5);
          float line=1.0-smoothstep(.035,.095,d);
          float relief=.5+.5*cos(uv.x*3.0+uv.y*2.2);
          color=vec3(.085,.233,.205)+vec3(.32,.36,.30)*line+vec3(.014,.024,.014)*relief;
        }
        gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
      }
    `;
    function compile(type,source) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        gl.deleteShader(shader); return null;
      }
      return shader;
    }
    const vs=compile(gl.VERTEX_SHADER,vertex);
    const fs=compile(gl.FRAGMENT_SHADER,fragment);
    if(!vs||!fs) { contextCache.set(canvas,null); return null; }
    const program=gl.createProgram();
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) { contextCache.set(canvas,null); return null; }
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const state={
      gl,program,buffer,
      position:gl.getAttribLocation(program,'a_position'),
      resolution:gl.getUniformLocation(program,'u_resolution'),
      pointer:gl.getUniformLocation(program,'u_pointer'),
      mode:gl.getUniformLocation(program,'u_mode')
    };
    canvas.addEventListener('webglcontextlost',event=>event.preventDefault(),{once:true});
    contextCache.set(canvas,state);
    return state;
  }

  function draw(canvas) {
    if(active!=='sun'&&active!=='atlas') return;
    const rect=canvas.getBoundingClientRect();
    if(rect.width<8||rect.height<8) return;
    const state=makeContext(canvas);
    if(!state) return; // The CSS material treatment remains as a fallback.
    const density=Math.min(window.devicePixelRatio||1,1.5);
    const width=Math.max(1,Math.round(rect.width*density));
    const height=Math.max(1,Math.round(rect.height*density));
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    const {gl,program,buffer,position,resolution,pointer:light,mode}=state;
    gl.viewport(0,0,width,height);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    gl.uniform2f(resolution,width,height);
    gl.uniform1f(light,pointer);
    gl.uniform1f(mode,active==='sun'?1:2);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }

  function render() {
    renderQueued=false;
    draw(fieldCanvas);
    draw(previewCanvas);
  }
  function queueRender() {
    if(renderQueued)return;
    renderQueued=true;
    window.requestAnimationFrame(render);
  }
  function setTheme(id,updateUrl=true) {
    if(!byId[id])id='datum';
    active=id;
    const theme=byId[id];
    document.body.dataset.brand=id;
    document.getElementById('studio-current').textContent=theme.number+' / '+theme.name;
    document.getElementById('studio-preview-label').textContent=theme.number+' / '+theme.title;
    document.getElementById('studio-description').textContent=theme.description;
    document.getElementById('studio-tech').textContent=theme.tech;
    document.getElementById('studio-board-link').href='./brand-board.html?concept='+encodeURIComponent(id);
    document.getElementById('studio-responsive-link').href='./responsive-lab.html?concept='+encodeURIComponent(id);
    studio.querySelectorAll('[data-brand-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.brandOption===id)));
    try {localStorage.setItem('aum-brand-direction-v1',id);}catch{}
    if(updateUrl) {
      const url=new URL(window.location.href);
      if(id==='datum')url.searchParams.delete('studio');
      else url.searchParams.set('studio',id);
      history.replaceState(null,'',url);
    }
    queueRender();
  }
  function setOpen(open) {
    panel.hidden=!open;
    trigger.setAttribute('aria-expanded',String(open));
    if(open) {
      queueRender();
      panel.querySelector('[data-brand-option][aria-pressed="true"]').focus();
    }
  }
  trigger.addEventListener('click',()=>setOpen(panel.hidden));
  document.getElementById('studio-close').addEventListener('click',()=>{setOpen(false);trigger.focus();});
  studio.querySelectorAll('[data-brand-option]').forEach(button=>button.addEventListener('click',()=>{
    setTheme(button.dataset.brandOption);
  }));
  document.addEventListener('pointerdown',event=>{
    if(!panel.hidden&&!studio.contains(event.target))setOpen(false);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){setOpen(false);trigger.focus();}
  });
  function updateLight(event,element) {
    if(active!=='sun'||reducedMotion.matches)return;
    const rect=element.getBoundingClientRect();
    pointer=Math.min(1,Math.max(0,(event.clientX-rect.left)/Math.max(rect.width,1)));
    queueRender();
  }
  document.querySelector('.intro-statement').addEventListener('pointermove',event=>updateLight(event,field));
  preview.addEventListener('pointermove',event=>updateLight(event,preview));
  if('ResizeObserver' in window) {
    const observer=new ResizeObserver(queueRender);
    observer.observe(field);
    observer.observe(preview);
  } else window.addEventListener('resize',queueRender);
  reducedMotion.addEventListener?.('change',()=>{pointer=.28;queueRender();});
  window.addEventListener('popstate',()=>{
    const fromUrl=new URL(window.location.href).searchParams.get('studio');
    setTheme(byId[fromUrl]?fromUrl:'datum',false);
  });
  let stored;
  try {stored=localStorage.getItem('aum-brand-direction-v1');}catch{}
  const fromUrl=new URL(window.location.href).searchParams.get('studio');
  setTheme(byId[fromUrl]?fromUrl:byId[stored]?stored:'datum',false);
})();
