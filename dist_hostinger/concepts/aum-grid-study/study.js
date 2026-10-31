/* AUM ESTATES / Study 03 — same layout, reproducible color and type experiments. */
(() => {
  'use strict';
  const palettes = {
    mineral:{label:'Oxblood / Mineral',paper:'#f5f4ef'},
    plaster:{label:'Merlot / Plaster',paper:'#f4eee9'},
    butter:{label:'Claret / Butter',paper:'#f4eed9'},
    mist:{label:'Oxblood / Mist',paper:'#e9eeeb'},
    lime:{label:'Aubergine / Lime',paper:'#ecf0cf'},
    cobalt:{label:'Wine / Cobalt',paper:'#dee5f1'},
    midnight:{label:'Midnight / Butter / Signal',paper:'#fffdf9'},
    signal:{label:'Red / Yellow / Green',paper:'#ffffff'},
    redmidnight:{label:'Bold Red / Midnight',paper:'#ffffff'},
    redfield:{label:'Red Field / Black Ink',paper:'#f04e3e'},
    redwhite:{label:'Red / White / Ink',paper:'#ffffff'}
  };
  const typeSystems = {
    plex:'IBM Plex',
    instrument:'Instrument Sans',
    space:'Space Grotesk',
    dm:'DM Sans + Mono',
    mono:'Mono index',
    origins:'Editorial contrast'
  };
  const key = 'aum-estates-study-03';
  const root = document.documentElement;
  const $ = selector => document.querySelector(selector);

  const safeStorage = {
    read() { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } },
    write(value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private mode remains usable. */ } }
  };

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const saved = safeStorage.read();
    let palette = Object.hasOwn(palettes,params.get('palette')) ? params.get('palette') :
      Object.hasOwn(palettes,saved.palette) ? saved.palette : 'redwhite';
    let type = Object.hasOwn(typeSystems,params.get('type')) ? params.get('type') :
      Object.hasOwn(typeSystems,saved.type) ? saved.type : 'plex';

    const panel = $('#studyPanel');
    const toggle = $('#studyToggle');
    const feedback = $('#studyFeedback');

    function applySelection(updateLink = true) {
      root.dataset.palette = palette;
      root.dataset.type = type;
      $('#paletteChoice').textContent = palettes[palette].label;
      $('#typeChoice').textContent = typeSystems[type];
      $('#themeColor').setAttribute('content',palettes[palette].paper);
      document.querySelectorAll('.palette-options button[data-palette]').forEach(button =>
        button.setAttribute('aria-pressed',String(button.dataset.palette === palette)));
      document.querySelectorAll('.type-options button[data-type]').forEach(button =>
        button.setAttribute('aria-pressed',String(button.dataset.type === type)));
      safeStorage.write({palette,type});
      if(updateLink) {
        try {
          const url = new URL(window.location.href);
          if(palette === 'redwhite') url.searchParams.delete('palette');
          else url.searchParams.set('palette',palette);
          if(type === 'plex') url.searchParams.delete('type');
          else url.searchParams.set('type',type);
          history.replaceState(history.state,'',`${url.pathname}${url.search}${url.hash}`);
        } catch (e) {
          /* Fallback for file:// or restricted iframe sandbox */
        }
      }
      feedback.textContent = `${palettes[palette].label} × ${typeSystems[type]}`;
    }

    function setOpen(open,returnFocus = false) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded',String(open));
      if(open) panel.querySelector('.palette-options button[aria-pressed="true"]').focus();
      else if(returnFocus) toggle.focus();
    }

    toggle.addEventListener('click',() => setOpen(panel.hidden));
    $('#closeStudy').addEventListener('click',() => setOpen(false,true));
    document.querySelectorAll('.palette-options button[data-palette]').forEach(button => button.addEventListener('click',() => {
      palette = button.dataset.palette;
      applySelection();
    }));
    document.querySelectorAll('.type-options button[data-type]').forEach(button => button.addEventListener('click',() => {
      type = button.dataset.type;
      applySelection();
    }));
    $('#resetStudy').addEventListener('click',() => {
      palette = 'redwhite';
      type = 'plex';
      applySelection();
      feedback.textContent = 'Red / White / Ink and IBM Plex restored.';
    });
    $('#copyStudy').addEventListener('click',async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        feedback.textContent = 'Link copied. This type and color combination can be reopened.';
      } catch {
        feedback.textContent = 'Copy the URL in your browser to share this exact combination.';
      }
    });
    document.addEventListener('keydown',event => {
      if(event.key === 'Escape' && !panel.hidden) setOpen(false,true);
    });
    document.addEventListener('pointerdown',event => {
      if(!panel.hidden && !panel.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
    applySelection();
  });
})();
