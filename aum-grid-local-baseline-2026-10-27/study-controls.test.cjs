const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceRoot = path.resolve(__dirname, 'dist');

function harness(href) {
  let currentURL = new URL(href);
  const callbacks = [];
  const elements = new Map();
  const storage = new Map();

  function element(dataset = {}) {
    return {
      dataset,
      attributes: new Map(),
      listeners: new Map(),
      hidden: false,
      textContent: '',
      addEventListener(name, callback) { this.listeners.set(name, callback); },
      setAttribute(name, value) { this.attributes.set(name, value); },
      getAttribute(name) { return this.attributes.get(name); },
      click() { this.listeners.get('click')?.(); }
    };
  }

  for(const id of ['architectureDescription','materialDescription','previewModeToggle','studyPanel','studyToggle']) {
    elements.set(id, element());
  }
  const architecture = ['international','elevation'].map(value => element({architectureOption:value}));
  const fourth = ['none','cobalt','bronze','verdigris'].map(value => element({fourthOption:value}));
  const depths = ['flat','relief'].map(value => element({depthOption:value}));
  const root = {dataset:{palette:'redwhite'}};
  const selectors = new Map([
    ['[data-architecture-option]',architecture],
    ['[data-fourth-option]',fourth],
    ['[data-depth-option]',depths]
  ]);
  const location = {};
  for(const key of ['href','search','pathname','hash']) {
    Object.defineProperty(location,key,{get:() => currentURL[key]});
  }
  const history = {
    state:null,
    replaceState(state,_title,url) { this.state=state;currentURL = new URL(url,currentURL); }
  };
  const context = {
    document:{
      documentElement:root,
      addEventListener(name,callback) { if(name === 'DOMContentLoaded') callbacks.push(callback); },
      getElementById(id) { return elements.get(id); },
      querySelectorAll(selector) { return selectors.get(selector) || []; }
    },
    history,
    location,
    window:{location,history},
    localStorage:{
      getItem(key) {return storage.get(key) || null;},
      setItem(key,value) {storage.set(key,value);}
    },
    MutationObserver:class {observe() {}},
    URL,
    URLSearchParams
  };
  for(const filename of ['architecture.js','refinement.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(sourceRoot,filename),'utf8'),context,{filename});
  }
  callbacks.forEach(callback => callback());
  return {root,elements,architecture,fourth,depths,get url() {return currentURL;}};
}

test('architectural and material controls preserve each other in shareable URLs',() => {
  const app = harness('https://aum.example/?palette=redwhite#home');
  app.architecture[1].click();
  app.fourth[2].click();
  app.depths[0].click();
  assert.equal(app.root.dataset.architecture,'elevation');
  assert.equal(app.root.dataset.fourth,'bronze');
  assert.equal(app.root.dataset.depth,'flat');
  assert.equal(app.url.searchParams.get('architecture'),'elevation');
  assert.equal(app.url.searchParams.get('fourth'),'bronze');
  assert.equal(app.url.searchParams.get('depth'),'flat');
  assert.equal(app.url.hash,'#home');
  assert.equal(app.architecture[1].getAttribute('aria-pressed'),'true');
});

test('visitor preview hides study chrome without erasing selected design',() => {
  const app = harness('https://aum.example/?architecture=elevation&fourth=verdigris');
  const toggle = app.elements.get('previewModeToggle');
  app.elements.get('studyPanel').hidden = false;
  toggle.click();
  assert.equal(app.root.dataset.presentation,'preview');
  assert.equal(app.elements.get('studyPanel').hidden,true);
  assert.equal(app.url.searchParams.get('presentation'),'1');
  assert.equal(app.url.searchParams.get('architecture'),'elevation');
  assert.equal(app.url.searchParams.get('fourth'),'verdigris');
  toggle.click();
  assert.equal(app.root.dataset.presentation,'study');
  assert.equal(app.url.searchParams.has('presentation'),false);
});

test('removed Skyline deep links safely resolve to International Style',() => {
  const app = harness('https://aum.example/?architecture=stepped');
  assert.equal(app.root.dataset.architecture,'international');
  assert.equal(app.url.searchParams.has('architecture'),false);
});
