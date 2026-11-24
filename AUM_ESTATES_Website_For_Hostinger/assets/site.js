/* ==========================================================================
   AUM ESTATES — Site navigation

   One script for the header on every page (the markup itself is generated
   by scripts/sync_site_chrome.js). It replaces nine inline copies of a
   drawer toggle and a CSS-only hover menu that had no keyboard model, no
   touch model and no way to dismiss it.

   Desktop menus
     - Click or tap a trigger to open or close its panel.
     - On a mouse, hovering opens it too, with a short close delay so the
       pointer can travel from trigger to panel without the panel vanishing.
     - Escape closes and returns focus to the trigger; a click outside or
       focus leaving the menu closes it. Arrow keys move through the links.

   Mobile drawer
     - Toggle opens a full-height panel under the bar and locks page scroll.
     - Escape, a link, or widening past the desktop breakpoint closes it.
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js-nav');

  var header = document.querySelector('.header');
  if (!header) return;

  var canHover = false;
  try { canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}

  /* ----------------------------------------------------------------------
     Desktop menus
     ---------------------------------------------------------------------- */

  var menus = Array.prototype.slice.call(header.querySelectorAll('[data-nav-menu]'));
  var CLOSE_DELAY = 180;

  function parts(menu) {
    return {
      trigger: menu.querySelector('[data-nav-trigger]'),
      panel: menu.querySelector('[data-nav-panel]')
    };
  }

  function links(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('[data-nav-panel] a'));
  }

  function setOpen(menu, open) {
    var p = parts(menu);
    if (!p.trigger) return;
    window.clearTimeout(menu._closeTimer);
    menu.classList.toggle('is-open', open);
    p.trigger.setAttribute('aria-expanded', String(open));
  }

  function closeAll(except) {
    menus.forEach(function (m) { if (m !== except) setOpen(m, false); });
  }

  function isOpen(menu) { return menu.classList.contains('is-open'); }

  menus.forEach(function (menu) {
    var p = parts(menu);
    if (!p.trigger || !p.panel) return;

    // With a mouse, the pointer reaches the trigger (and opens the menu)
    // before the click lands. A click on a menu that hover opened therefore
    // pins it open rather than toggling it shut under the cursor.
    p.trigger.addEventListener('click', function () {
      if (isOpen(menu) && menu._viaHover) {
        menu._viaHover = false;
        return;
      }
      var next = !isOpen(menu);
      closeAll(menu);
      menu._viaHover = false;
      setOpen(menu, next);
    });

    if (canHover) {
      menu.addEventListener('mouseenter', function () {
        window.clearTimeout(menu._closeTimer);
        if (isOpen(menu)) return;
        closeAll(menu);
        menu._viaHover = true;
        setOpen(menu, true);
      });
      menu.addEventListener('mouseleave', function () {
        window.clearTimeout(menu._closeTimer);
        menu._closeTimer = window.setTimeout(function () { setOpen(menu, false); }, CLOSE_DELAY);
      });
    }

    menu.addEventListener('keydown', function (e) {
      var items = links(menu);
      var idx = items.indexOf(document.activeElement);

      if (e.key === 'Escape' && isOpen(menu)) {
        e.preventDefault();
        setOpen(menu, false);
        p.trigger.focus();
        return;
      }

      if (e.target === p.trigger && e.key === 'ArrowDown') {
        e.preventDefault();
        closeAll(menu);
        setOpen(menu, true);
        if (items[0]) items[0].focus();
        return;
      }

      if (idx === -1) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx === 0) p.trigger.focus();
        else items[idx - 1].focus();
      }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    });

    menu.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !menu.contains(e.relatedTarget)) setOpen(menu, false);
    });
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-nav-menu]')) closeAll(null);
  });

  /* ----------------------------------------------------------------------
     Mobile drawer
     ---------------------------------------------------------------------- */

  var toggle = header.querySelector('[data-drawer-toggle]');
  var drawer = header.querySelector('[data-drawer]');
  var hideTimer = null;

  function drawerOpen() { return toggle && toggle.getAttribute('aria-expanded') === 'true'; }

  function openDrawer() {
    window.clearTimeout(hideTimer);
    closeAll(null);
    drawer.hidden = false;
    // Measure the bar so the drawer starts exactly under it, whatever its height.
    root.style.setProperty('--header-h', header.getBoundingClientRect().height + 'px');
    requestAnimationFrame(function () { drawer.classList.add('is-open'); });
    root.classList.add('drawer-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
  }

  function closeDrawer(returnFocus) {
    if (!drawerOpen()) return;
    drawer.classList.remove('is-open');
    root.classList.remove('drawer-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    hideTimer = window.setTimeout(function () { drawer.hidden = true; }, 260);
    if (returnFocus) toggle.focus();
  }

  if (toggle && drawer) {
    toggle.addEventListener('click', function () {
      if (drawerOpen()) closeDrawer(false); else openDrawer();
    });

    drawer.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) closeDrawer(false);
    });

    var desktop = null;
    try { desktop = window.matchMedia('(min-width: 1181px)'); } catch (e) {}
    if (desktop) {
      var onChange = function (mq) { if (mq.matches) closeDrawer(false); };
      if (desktop.addEventListener) desktop.addEventListener('change', onChange);
      else if (desktop.addListener) desktop.addListener(onChange);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (drawerOpen()) { closeDrawer(true); return; }
    closeAll(null);
  });

  // A page restored from the back/forward cache keeps whatever was open
  // when the visitor left it.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    closeAll(null);
    if (drawerOpen()) { drawer.classList.remove('is-open'); drawer.hidden = true; root.classList.remove('drawer-open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu'); }
  });
})();
