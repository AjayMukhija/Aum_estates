/* AUM ESTATES — architectural composition and material study.
 * Two architectural grammars, independently selectable fourth color and relief.
 */
(() => {
  'use strict';

  const concepts = {
    international: {
      description:'Recessed facade bays, structural mullions, window rhythm and quiet depth.'
    },
    elevation: {
      description:'A measured elevation: drafted outlines, offset construction planes and a red datum.'
    }
  };
  const materials = {
    none: {label:'Three colors; no extra accent.'},
    cobalt: {label:'Cobalt marks structural details only.'},
    bronze: {label:'Bronze reads as restrained metalwork.'},
    verdigris: {label:'Patina suggests oxidized copper joints.'}
  };
  const depths = {flat:'Flat orthographic composition.',relief:'Controlled dimensional detail.'};
  const root = document.documentElement;
  const storageKey = 'aum-estates-architecture-study-05';

  function getStoredChoice() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { return {}; }
  }
  function saveChoice(value) {
    try { localStorage.setItem(storageKey,JSON.stringify(value)); }
    catch { /* All controls remain usable when local storage is unavailable. */ }
  }

  document.addEventListener('DOMContentLoaded',() => {
    const params = new URLSearchParams(window.location.search);
    const param = params.get('architecture');
    const stored = getStoredChoice();
    const fromOldStorage = (() => {try {return localStorage.getItem('aum-estates-architecture-study-04')} catch{return null}})();
    let choice = Object.hasOwn(concepts,param) ? param :
      Object.hasOwn(concepts,stored.architecture) ? stored.architecture :
      Object.hasOwn(concepts,fromOldStorage) ? fromOldStorage : 'international';
    let fourth = Object.hasOwn(materials,params.get('fourth')) ? params.get('fourth') :
      Object.hasOwn(materials,stored.fourth) ? stored.fourth : 'none';
    let depth = Object.hasOwn(depths,params.get('depth')) ? params.get('depth') :
      Object.hasOwn(depths,stored.depth) ? stored.depth : 'relief';

    const buttons = Array.from(document.querySelectorAll('[data-architecture-option]'));
    const fourthButtons = Array.from(document.querySelectorAll('[data-fourth-option]'));
    const depthButtons = Array.from(document.querySelectorAll('[data-depth-option]'));
    const description = document.getElementById('architectureDescription');
    const materialDescription = document.getElementById('materialDescription');

    function apply(updateUrl = true) {
      root.dataset.architecture = choice;
      root.dataset.fourth = fourth;
      root.dataset.depth = depth;
      buttons.forEach(button => {
        button.setAttribute('aria-pressed',String(button.dataset.architectureOption === choice));
      });
      fourthButtons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.fourthOption === fourth)));
      depthButtons.forEach(button => button.setAttribute('aria-pressed',String(button.dataset.depthOption === depth)));
      description.textContent = concepts[choice].description;
      const depthDescription = depth === 'flat'
        ? 'A flat structural drawing.'
        : choice === 'international'
          ? 'Recessed facade surface; the structural frame stays fixed.'
          : 'Offset drawing planes; no perspective tilt.';
      materialDescription.textContent = (root.dataset.palette !== 'redwhite' && fourth !== 'none' ?
        'Fourth-color details appear in Red / White / Ink only. ' : materials[fourth].label + ' ') + depthDescription;
      saveChoice({architecture:choice,fourth,depth});
      if(updateUrl) {
        try {
          const url = new URL(window.location.href);
          if(choice === 'international') url.searchParams.delete('architecture');
          else url.searchParams.set('architecture',choice);
          if(fourth === 'none') url.searchParams.delete('fourth');
          else url.searchParams.set('fourth',fourth);
          if(depth === 'relief') url.searchParams.delete('depth');
          else url.searchParams.set('depth',depth);
          window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
        } catch (e) {
          /* Fallback for file:// or restricted iframe sandbox */
        }
      }
    }

    buttons.forEach(button => button.addEventListener('click',() => {
      choice = button.dataset.architectureOption;
      apply();
    }));
    fourthButtons.forEach(button => button.addEventListener('click',() => {
      fourth = button.dataset.fourthOption;
      apply();
    }));
    depthButtons.forEach(button => button.addEventListener('click',() => {
      depth = button.dataset.depthOption;
      apply();
    }));
    new MutationObserver(() => apply(false)).observe(root,{attributes:true,attributeFilter:['data-palette']});
    apply();
  });
})();
