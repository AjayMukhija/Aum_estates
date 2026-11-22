/* ==========================================================================
   AUM ESTATES — Motion engine

   Loaded from <head> without defer so the `js-motion` class lands before
   first paint; everything else waits for DOMContentLoaded. Nothing here is
   required for the page to be readable or operable: if this file fails to
   parse, the reveal styles never activate and the page renders as the
   static Datum design.

   Honours prefers-reduced-motion at runtime as well as in CSS, so a visitor
   who flips the system setting mid-session gets the static page on the next
   navigation without a reload loop.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js-motion');
  root.classList.remove('no-js');

  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { /* matchMedia unsupported: treat as full motion */ }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  /* ----------------------------------------------------------------------
     Scroll reveal
     Selectors are applied here rather than in the markup so every page
     picks the behaviour up without touching eight HTML files, and so
     dynamically rendered cards can be registered after their script runs.
     ---------------------------------------------------------------------- */

  var REVEAL_SELECTORS = [
    '.section > .container > .head',
    '.section > .container > .editorial-content',
    '.cats > *',
    '.features > *',
    '.results-grid > *',
    '.corridor-index > *',
    '.benefit-grid > *',
    '.benefit-strip > *',
    '.contact-grid > *',
    '.location-panel',
    '.founder-crest-card',
    '.founder-quote-area',
    '.mandate-concierge-inner > *',
    '.detail-section',
    '.property-hero > .container > *',
    '.about-hero > .container > *',
    '.contact-hero > .container > *',
    '.footergrid > *'
  ].join(',');

  var observer = null;

  function makeObserver() {
    if (!('IntersectionObserver' in window)) return null;
    return new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.classList.add('is-in');
        obs.unobserve(el);
        // Drop the stagger delay once settled so hover feels immediate.
        window.setTimeout(function () { el.classList.add('is-done'); }, 900);
      });
    }, {
      // Fire as soon as the element enters the bottom of the viewport so
      // content settles quickly and never looks faded out while visible.
      rootMargin: '0px 0px -2% 0px',
      threshold: 0.01
    });
  }

  function register(scope) {
    var nodes = (scope || document).querySelectorAll(REVEAL_SELECTORS);
    if (!nodes.length) return;

    // Stagger is per parent, capped so a long register does not end up with
    // a two-second delay on its last card.
    var seen = new Map();

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', '');

      var parent = el.parentNode;
      var n = seen.get(parent) || 0;
      seen.set(parent, n + 1);
      el.style.setProperty('--i', String(Math.min(n, 4)));

      var rect = el.getBoundingClientRect();
      var alreadyVisible = rect.top < (window.innerHeight || document.documentElement.clientHeight) * 1.05;

      if (reduced || !observer || alreadyVisible) {
        el.classList.add('is-in', 'is-done');
      } else {
        observer.observe(el);
      }
    });

    failsafe();
  }

  /* No effect on this site is allowed to leave content invisible. If
     anything is still unrevealed while sitting in the viewport a few
     seconds in — an observer that never fired, a callback that threw, a
     browser quirk — show it and stop pretending the animation matters. */
  var failsafeTimer = null;
  function failsafe() {
    window.clearTimeout(failsafeTimer);
    failsafeTimer = window.setTimeout(function () {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var stuck = document.querySelectorAll('[data-reveal]:not(.is-in)');
      Array.prototype.forEach.call(stuck, function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < vh && r.bottom > 0) el.classList.add('is-in', 'is-done');
      });
    }, 3000);
  }

  /* ----------------------------------------------------------------------
     Hero entrance
     ---------------------------------------------------------------------- */

  function hero() {
    var h = document.querySelector('.hero, .property-hero, .about-hero');
    if (!h) return;
    // One frame so the initial (hidden) state is painted before the
    // transition target lands — otherwise the browser coalesces both and
    // nothing animates.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { h.classList.add('hero-ready'); });
    });
  }

  /* ----------------------------------------------------------------------
     Header state
     ---------------------------------------------------------------------- */

  function header() {
    var el = document.querySelector('.header');
    if (!el) return;
    var ticking = false;

    function apply() {
      el.classList.toggle('is-scrolled', window.scrollY > 24);
      ticking = false;
    }
    apply();

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }, { passive: true });
  }

  /* ----------------------------------------------------------------------
     Trailing arrows
     The glyph is pulled out of the label and re-added as a pseudo-element
     so it can translate on hover without reflowing the text node.
     ---------------------------------------------------------------------- */

  function arrows(scope) {
    var sel = '.btn, .view, .location-view, .search-btn, .result-contact, .quiet-action';
    var nodes = (scope || document).querySelectorAll(sel);

    Array.prototype.forEach.call(nodes, function (el) {
      if (el.classList.contains('has-arrow')) return;
      var last = el.lastChild;
      // Only touch a plain trailing text node, so markup with nested
      // elements after the arrow is left exactly as the author wrote it.
      if (!last || last.nodeType !== 3) return;
      var text = last.nodeValue;
      if (!/→\s*$/.test(text)) return;
      last.nodeValue = text.replace(/\s*→\s*$/, '');
      el.classList.add('has-arrow');
    });
  }

  /* ----------------------------------------------------------------------
     Search tabs — sliding rule
     ---------------------------------------------------------------------- */

  function tabs() {
    var strip = document.querySelector('.search-tabs');
    if (!strip) return;
    var items = strip.querySelectorAll('.search-tab');
    if (!items.length) return;

    var rule = document.createElement('span');
    rule.className = 'tab-rule';
    rule.setAttribute('aria-hidden', 'true');
    strip.appendChild(rule);

    function move() {
      var active = strip.querySelector('.search-tab.active');
      if (!active) { rule.style.width = '0px'; return; }
      var x = active.offsetLeft;
      var y = active.offsetTop + active.offsetHeight - 2;
      rule.style.width = active.offsetWidth + 'px';
      rule.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
    }

    // The page's own handler sets .active; this runs after it in the same
    // click, so the rule reads the state that handler just wrote.
    strip.addEventListener('click', function (e) {
      if (!e.target.closest('.search-tab')) return;
      requestAnimationFrame(move);
    });

    window.addEventListener('resize', move, { passive: true });
    // Fonts can land after first layout and change the tab's width.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(move).catch(function () {});
    }
    move();
  }

  /* ----------------------------------------------------------------------
     Stat counters
     Only the numeric run inside the label is animated; prefix, suffix and
     non-numeric values ("Review", "Sector 50") are left alone.
     ---------------------------------------------------------------------- */

  function countUp(el) {
    var raw = el.textContent.trim();
    var match = raw.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!match) return;

    var prefix = match[1];
    var suffix = match[3];
    var digits = match[2];
    var target = parseFloat(digits.replace(/,/g, ''));
    if (!isFinite(target) || target <= 0) return;

    var grouped = digits.indexOf(',') !== -1;
    var decimals = (digits.split('.')[1] || '').length;
    var start = null;
    var duration = 1100;

    el.classList.add('is-counting');

    function fmt(v) {
      var s = v.toFixed(decimals);
      if (grouped) {
        var parts = s.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        s = parts.join('.');
      }
      return prefix + s + suffix;
    }

    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      // Same quintic settle as the CSS entrances.
      var eased = 1 - Math.pow(1 - p, 5);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(frame);
      else { el.textContent = prefix + digits + suffix; el.classList.remove('is-counting'); }
    }
    requestAnimationFrame(frame);
  }

  function counters() {
    var nodes = document.querySelectorAll('.location-tile-count, #result-count, #project-count');
    if (!nodes.length || reduced || !('IntersectionObserver' in window)) return;

    var obs = new IntersectionObserver(function (entries, o) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        o.unobserve(entry.target);
        countUp(entry.target);
      });
    }, { threshold: 0.6 });

    Array.prototype.forEach.call(nodes, function (n) { obs.observe(n); });
  }

  /* ----------------------------------------------------------------------
     Advanced filter drawer
     The CSS animates grid-template-rows, which needs the drawer's children
     wrapped in a single row element. Done here so the markup's form
     contract — field names, GET submission — is untouched.
     ---------------------------------------------------------------------- */

  function drawer() {
    var el = document.getElementById('filter-advanced-drawer');
    if (!el || el.querySelector('.drawer-inner')) return;
    var inner = document.createElement('div');
    inner.className = 'drawer-inner';
    while (el.firstChild) inner.appendChild(el.firstChild);
    el.appendChild(inner);
  }

  /* ----------------------------------------------------------------------
     Late content
     The home page renders its featured register and corridor index from
     inline scripts that run after this file. A short observation of <main>
     catches those nodes and gives them the same entrance.
     ---------------------------------------------------------------------- */

  function watchLate() {
    var main = document.querySelector('main');
    if (!main || !('MutationObserver' in window)) return;

    var pending = null;
    var mo = new MutationObserver(function () {
      window.clearTimeout(pending);
      pending = window.setTimeout(function () {
        register(main);
        arrows(main);
      }, 40);
    });
    mo.observe(main, { childList: true, subtree: true });

    // The page is static after hydration; stop watching rather than leave a
    // subtree observer running for the session.
    window.setTimeout(function () { mo.disconnect(); }, 4000);
  }

  ready(function () {
    observer = reduced ? null : makeObserver();
    drawer();
    register(document);
    arrows(document);
    header();
    tabs();
    counters();
    hero();
    watchLate();
  });
})();
