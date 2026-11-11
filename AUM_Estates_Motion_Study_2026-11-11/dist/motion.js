/* ==========================================================================
   AUM ESTATES — Motion study: behaviour
   11 November 2026 · private exploration

   Buildless, no dependencies, matching the workflow of the existing studies.
   Reads the real public inventory. Invents no property, price, area or claim.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var byId = function (id) { return document.getElementById(id); };

  /* ------------------------------------------------------------------------
     Data
     ------------------------------------------------------------------------ */

  var INV = (window.AUM_PUBLIC_INVENTORY || []).filter(function (o) {
    return o && String(o.status || '').toLowerCase() === 'available';
  });
  var TOTAL = INV.length;

  var CATEGORIES = [
    { key: 'apartment',     name: 'Apartments & condominiums', desc: 'Gated residential units across the established corridors.' },
    { key: 'builder-floor', name: 'Builder floors',            desc: 'Independent floors, chiefly DLF Phase 1–5 and Sushant Lok.' },
    { key: 'villa',         name: 'Villas',                    desc: 'Independent houses within gated and low-density layouts.' },
    { key: 'plot',          name: 'Plots & land',              desc: 'HSVP, licensed-colony and institutional land references.' },
    { key: 'commercial',    name: 'Commercial & retail',       desc: 'Offices, shops and pre-leased assets.' },
    { key: 'farmhouse',     name: 'Private estates',           desc: 'Farmhouse and estate references.' }
  ];

  function money(v, unit) {
    if (v == null || v === '') return '';
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    if (unit && /per sq ft/i.test(unit)) return '₹' + n + ' / sq ft';
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(n % 10000000 ? 2 : 0) + ' Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(n % 100000 ? 1 : 0) + ' Lakh';
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }

  function priceLabel(o) {
    if (o.price_text) return String(o.price_text).trim();
    if (o.rent_value) return money(o.rent_value) + ' / month';
    if (o.price_value) return money(o.price_value, o.price_unit);
    return 'Price on request';
  }

  function areaLabel(o) {
    if (!o.area_value) return '';
    return String(o.area_value) + ' ' + String(o.area_unit || '').trim();
  }

  function placeLabel(o) {
    var parts = [o.locality, o.sector, o.city].filter(Boolean);
    var seen = {};
    return parts.filter(function (p) { if (seen[p]) return false; seen[p] = 1; return true; }).join(', ');
  }

  function haystack(o) {
    return [o.listing_title, o.project_name, o.locality, o.sector, o.micro_location, o.corridor,
      o.property_type, o.configuration, o.key_features, o.public_description, o.facing]
      .filter(Boolean).join(' ').toLowerCase();
  }

  /* ------------------------------------------------------------------------
     Concept metadata. Each concept states its own claim next to the thing it
     is claiming about, so it can be checked rather than believed.
     ------------------------------------------------------------------------ */

  var CONCEPTS = {
    baseline: {
      title: 'Baseline — what ships today',
      note: 'Exactly what the production site does today: colour transitions at 160ms, instant disclosure, no entrance motion, no announcement. Switch concepts to compare.',
      body: 'No motion beyond interface feedback. The register is replaced in one frame; the disclosure snaps; the photograph appears in whichever frame it finishes decoding. The empty state below is reproduced verbatim from production, including the inline styles that reference four CSS variables the Datum stylesheet no longer defines.',
      spec: [
        ['Mechanism', 'None'],
        ['State change signal', 'Text only, and no live region — a screen reader is told nothing'],
        ['Cost', 'Zero'],
        ['Verdict', 'The restraint is right. The silence is not.']
      ]
    },
    a: {
      title: 'A — Setting Out',
      note: '<b>Setting Out.</b> The construction line arrives first; content registers to it. Change a filter and watch the datum sweep the register head, then the rows settle 6px into place.',
      body: 'Every change of information state is a setting out. The grid the layout already obeys becomes briefly visible at the moment it is doing work, then recedes to the hairline it always was. The result count is set as a dimension string with witness lines; red marks the one thing that just changed and nothing else.',
      spec: [
        ['Reference', 'Setting-out drawing: gridlines, bubbles, dimension strings, level datums'],
        ['Moves', 'A 1px datum sweeps the measured width; rows resolve 6px with a 28ms stagger'],
        ['Cost', 'Cheapest of the four — opacity and transform only'],
        ['Risk', 'Construction lines read as a loading skeleton; stagger tails must be capped at 8']
      ]
    },
    b: {
      title: 'B — Section Cut',
      note: '<b>Section Cut.</b> Revealing is cutting. Open a category: a 2px cut travels down and the tiles are wiped into view in place. They never move.',
      body: 'A disclosure does not slide open — a cut line travels and the content behind it is revealed by a clip advancing with the line. Direction encodes depth: down is into detail, up is back out. Poché appears only as the thickened band at the moving cut edge, never as a fill.',
      spec: [
        ['Reference', 'Section cut with direction arrows and an A—A reference; poché at the cut'],
        ['Moves', 'clip-path inset 100% → 0 over 240ms, synchronised with a travelling line'],
        ['Cost', 'Highest — clip-path over a container of images promotes a large composite layer'],
        ['Risk', 'Over ~250ms it stops being architectural and becomes a slide transition']
      ]
    },
    c: {
      title: 'C — Scale & Schedule',
      note: '<b>Scale &amp; Schedule.</b> Each tile draws its area to true relative scale against the register’s reference. Change a filter: the figures re-scale to the new set’s maximum, which is itself the news.',
      body: 'Area is the one attribute nobody can hold in their head across a list — 142 sq yd against 2,400 sq ft against 14 marla. So draw it. The rectangle is a quantity, not a footprint: fixed proportions, no orientation, no entrance, no road, labelled in the unit the record actually records. Where no area is published, the absence is drawn too.',
      spec: [
        ['Reference', 'The drawing’s scale bar and the schedule of accommodation'],
        ['Moves', 'Projection lines extend, then the figure draws its measured edges'],
        ['Encoding', 'Side ∝ √area, scaled within category — see the evaluation on why linear fails'],
        ['Risk', 'An abstract rectangle beside a property still invites reading as a footprint']
      ]
    },
    d: {
      title: 'D — Raking Light',
      note: '<b>Raking Light.</b> Nothing moves; only light does. Hover or tab through the register: a tile reads as a slab lifted one pixel into a shared light. No transform, no blur, no drop shadow.',
      body: 'One light direction for the whole page, above and slightly left. Depth is a 1px lit edge and a 1px shadow gap — the two things a real architectural detail shows. This is a material system, not an illustration system, so it cannot answer the empty states alone and has to be paired.',
      spec: [
        ['Reference', 'Raking-light facade photography; the Schattennut shadow gap'],
        ['Moves', 'Edge colour over 160ms. That is the entire vocabulary.'],
        ['Value', 'The only concept that improves keyboard focus visibility on tiles'],
        ['Risk', 'One gradient away from the faux-3D the baseline explicitly refused']
      ]
    }
  };

  /* ------------------------------------------------------------------------
     Illustrations. Orthogonal 1px strokes, no curves, no fills, no isometry
     except where a concept's reference demands it. Base state is the
     FINISHED drawing; the animation only replays it.
     ------------------------------------------------------------------------ */

  var SVG_OPEN = '<svg viewBox="0 0 320 260" role="img" fill="none" stroke-linecap="square">';
  var L = 'stroke="var(--line)" stroke-width="1"';
  var A = 'stroke="var(--accent)" stroke-width="1"';
  var INKS = 'stroke="var(--ink)" stroke-width="1"';
  var TXT = 'font-size="9" letter-spacing="1.4" fill="var(--muted)" font-family="Helvetica Neue, Helvetica, Arial, sans-serif"';

  function stroke(seq, attrs, geom) {
    return '<' + geom.tag + ' class="draw-stroke" style="--seq:' + seq + '" ' + attrs + ' ' + geom.d + ' />';
  }
  function line(x1, y1, x2, y2) { return { tag: 'line', d: 'x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' }; }
  function rect(x, y, w, h, extra) { return { tag: 'rect', d: 'x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (extra || '') }; }
  function fade(seq, inner) { return '<g class="draw-fade" style="--seq:' + seq + '">' + inner + '</g>'; }

  var FIGURES = {
    /* A — the dimension string that measures nothing. */
    'a:search': function () {
      var s = SVG_OPEN;
      s += '<title>A dimension string set out across an empty field, measuring nothing</title>';
      s += stroke(0, L, line(26, 36, 26, 232));
      s += stroke(0, L, line(294, 36, 294, 232));
      s += stroke(1, A, line(26, 206, 294, 206));
      s += fade(1, '<line ' + A + ' x1="20" y1="212" x2="32" y2="200" /><line ' + A + ' x1="288" y1="212" x2="300" y2="200" />');
      s += fade(2, '<circle ' + L + ' cx="26" cy="22" r="9" /><circle ' + L + ' cx="294" cy="22" r="9" />' +
        '<text ' + TXT + ' x="26" y="25.5" text-anchor="middle">A</text>' +
        '<text ' + TXT + ' x="294" y="25.5" text-anchor="middle">B</text>');
      s += stroke(3, L, rect(26, 54, 268, 128, ' stroke-dasharray="2 4"'));
      s += fade(4, '<text ' + TXT + ' x="160" y="199" text-anchor="middle" fill="var(--accent)">0 OF ' + TOTAL + '</text>' +
        '<text ' + TXT + ' x="160" y="124" text-anchor="middle">NOTHING SET OUT HERE</text>');
      return s + '</svg>';
    },
    /* A — three bays set out, nothing registered in them. */
    'a:saved': function () {
      var s = SVG_OPEN;
      s += '<title>Three bays set out side by side with nothing registered in them</title>';
      var x = [26, 120, 214], w = 80;
      for (var i = 0; i < 3; i++) {
        s += stroke(i, L, rect(x[i], 60, w, 120, ' stroke-dasharray="2 4"'));
        s += stroke(i, L, line(x[i] + w / 2, 40, x[i] + w / 2, 60));
        s += fade(i, '<circle ' + L + ' cx="' + (x[i] + w / 2) + '" cy="30" r="9" />' +
          '<text ' + TXT + ' x="' + (x[i] + w / 2) + '" y="33.5" text-anchor="middle">' + (i + 1) + '</text>');
      }
      s += stroke(3, A, line(26, 206, 294, 206));
      s += fade(3, '<line ' + A + ' x1="20" y1="212" x2="32" y2="200" /><line ' + A + ' x1="288" y1="212" x2="300" y2="200" />' +
        '<text ' + TXT + ' x="160" y="199" text-anchor="middle" fill="var(--accent)">THREE TO COMPARE</text>');
      return s + '</svg>';
    },
    /* B — a section cut through an empty volume. */
    'b:search': function () {
      var s = SVG_OPEN;
      s += '<title>A section cut through an empty volume</title>';
      s += stroke(0, INKS, rect(34, 44, 252, 170));
      s += stroke(1, A, line(14, 132, 306, 132));
      s += fade(1, '<path ' + A + ' d="M20 126 L26 132 L20 138" /><path ' + A + ' d="M300 126 L294 132 L300 138" />' +
        '<text ' + TXT + ' x="160" y="124" text-anchor="middle" fill="var(--accent)">A — A</text>');
      var poche = '';
      for (var i = 0; i < 9; i++) {
        var y = 140 + i * 8;
        poche += '<line ' + L + ' x1="34" y1="' + y + '" x2="42" y2="' + (y - 8) + '" />';
        poche += '<line ' + L + ' x1="278" y1="' + y + '" x2="286" y2="' + (y - 8) + '" />';
      }
      s += fade(2, poche);
      s += fade(3, '<text ' + TXT + ' x="160" y="180" text-anchor="middle">THE CUT FOUND NOTHING INSIDE</text>');
      s += stroke(3, L, line(34, 214, 286, 214));
      return s + '</svg>';
    },
    'b:saved': function () {
      var s = SVG_OPEN;
      s += '<title>Three volumes cut in section, each one empty</title>';
      var x = [30, 120, 210], w = 80;
      for (var i = 0; i < 3; i++) {
        s += stroke(i, INKS, rect(x[i], 56, w, 124));
        s += stroke(i + 1, A, line(x[i] - 10, 118, x[i] + w + 10, 118));
      }
      s += fade(3, '<text ' + TXT + ' x="160" y="206" text-anchor="middle" fill="var(--accent)">THREE SECTIONS, SIDE BY SIDE</text>');
      s += stroke(3, L, line(30, 220, 290, 220));
      return s + '</svg>';
    },
    /* C — a scale bar with nothing measured against it. */
    'c:search': function () {
      var s = SVG_OPEN;
      s += '<title>A drawing scale bar with no figure measured against it</title>';
      s += stroke(0, L, rect(44, 52, 246, 118, ' stroke-dasharray="2 4"'));
      s += stroke(1, INKS, line(44, 212, 290, 212));
      var bar = '';
      for (var i = 0; i < 5; i++) {
        var bx = 44 + i * 49.2;
        if (i % 2 === 0) bar += '<rect x="' + bx + '" y="212" width="49.2" height="6" fill="var(--ink)" stroke="none" />';
        else bar += '<rect ' + L + ' x="' + bx + '" y="212" width="49.2" height="6" />';
        bar += '<line ' + L + ' x1="' + bx + '" y1="206" x2="' + bx + '" y2="212" />';
      }
      bar += '<line ' + L + ' x1="290" y1="206" x2="290" y2="212" />';
      s += fade(2, bar);
      s += stroke(2, L, line(44, 170, 44, 206, ' stroke-dasharray="2 3"'));
      s += stroke(2, L, line(290, 170, 290, 206, ' stroke-dasharray="2 3"'));
      s += fade(3, '<text ' + TXT + ' x="44" y="236">0</text>' +
        '<text ' + TXT + ' x="290" y="236" text-anchor="end">MAX IN SET</text>' +
        '<text ' + TXT + ' x="167" y="115" text-anchor="middle" fill="var(--accent)">NO AREA TO SCALE</text>');
      return s + '</svg>';
    },
    'c:saved': function () {
      var s = SVG_OPEN;
      s += '<title>A schedule of three empty rows with a scale bar and no figures</title>';
      for (var i = 0; i < 3; i++) {
        var y = 56 + i * 46;
        s += stroke(i, L, line(30, y, 290, y));
        s += fade(i, '<text ' + TXT + ' x="30" y="' + (y + 16) + '">0' + (i + 1) + '</text>' +
          '<text ' + TXT + ' x="290" y="' + (y + 16) + '" text-anchor="end">— — — SQ FT</text>');
      }
      s += stroke(3, L, line(30, 194, 290, 194));
      s += stroke(3, INKS, line(30, 218, 290, 218));
      s += fade(3, '<rect x="30" y="218" width="52" height="6" fill="var(--ink)" stroke="none" />' +
        '<rect ' + L + ' x="82" y="218" width="52" height="6" />' +
        '<rect x="134" y="218" width="52" height="6" fill="var(--ink)" stroke="none" />' +
        '<text ' + TXT + ' x="290" y="242" text-anchor="end" fill="var(--accent)">NOTHING TO COMPARE YET</text>');
      return s + '</svg>';
    },
    /* D — a surface in raking light, with nothing on it to cast a shadow. */
    'd:search': function () {
      var s = SVG_OPEN;
      s += '<title>A surface in raking light with nothing on it to cast a shadow</title>';
      s += stroke(0, INKS, rect(30, 50, 260, 152));
      var fins = '';
      for (var i = 0; i < 16; i++) {
        var fx = 30 + i * 17.3;
        fins += '<line stroke="var(--line)" stroke-width="1" opacity="' + (1 - i * 0.055).toFixed(3) + '" x1="' + fx + '" y1="50" x2="' + fx + '" y2="202" />';
      }
      s += fade(1, fins);
      s += stroke(2, INKS, line(30, 202, 290, 202));
      s += stroke(3, L, line(30, 218, 290, 218, ' stroke-dasharray="2 4"'));
      s += fade(4, '<text ' + TXT + ' x="30" y="238" fill="var(--accent)">NO OBJECT, SO NO SHADOW</text>' +
        '<text ' + TXT + ' x="290" y="44" text-anchor="end">LIGHT FROM ABOVE LEFT</text>');
      return s + '</svg>';
    },
    'd:saved': function () {
      var s = SVG_OPEN;
      s += '<title>Three unlit slabs, none of them selected</title>';
      for (var i = 0; i < 3; i++) {
        var y = 56 + i * 54;
        s += stroke(i, L, rect(34, y, 252, 38));
        s += fade(i, '<line stroke="var(--line)" stroke-width="1" x1="34" y1="' + (y + 38) + '" x2="286" y2="' + (y + 38) + '" />');
      }
      s += fade(3, '<text ' + TXT + ' x="34" y="238" fill="var(--accent)">NONE LIFTED INTO THE LIGHT</text>');
      return s + '</svg>';
    }
  };

  /* Measure every stroke so --len matches its real path length. Without this
     the dash pattern is guessed and the draw appears to start late. */
  function measureStrokes(scope) {
    var nodes = scope.querySelectorAll('.draw-stroke');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], len = 0;
      try {
        if (typeof el.getTotalLength === 'function') len = el.getTotalLength();
      } catch (e) { len = 0; }
      if (!len) {
        var w = Number(el.getAttribute('width')) || 0, h = Number(el.getAttribute('height')) || 0;
        len = w && h ? 2 * (w + h) : 300;
      }
      el.style.setProperty('--len', Math.ceil(len));
    }
  }

  function play(el) {
    if (!el) return;
    el.removeAttribute('data-play');
    void el.offsetWidth;          /* force a reflow so the animation restarts */
    el.setAttribute('data-play', '');
  }

  /* ------------------------------------------------------------------------
     Lab controls
     ------------------------------------------------------------------------ */

  function setConcept(key) {
    if (!CONCEPTS[key]) return;
    root.setAttribute('data-concept', key);
    document.querySelectorAll('[data-concept-set]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.conceptSet === key));
    });
    var c = CONCEPTS[key];
    byId('lab-note').innerHTML = c.note;
    byId('cn-title').textContent = c.title;
    byId('cn-body').textContent = c.body;
    byId('cn-spec').innerHTML = c.spec.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('');
    /* The register, the benches and the image pair are all concept-dependent
       at render time, so a concept switch has to rebuild them. Without the
       re-render, Concept C's scale figures never appear. */
    if (booted) {
      renderRegister(false);
      renderBenches();
      renderImageBench();
    }
    renderOrnamentVerdict();
  }
  var booted = false;

  function setFrame(v) {
    var f = byId('lab-frame');
    f.dataset.frame = v;
    f.style.setProperty('--frame', v === 'full' ? 'none' : v + 'px');
    document.querySelectorAll('[data-frame-set]').forEach(function (b) {
      b.setAttribute('aria-checked', String(b.dataset.frameSet === v));
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-concept-set],[data-frame-set],[data-replay],[data-seed]');
    if (!t) return;
    if (t.dataset.conceptSet) setConcept(t.dataset.conceptSet);
    else if (t.dataset.frameSet) setFrame(t.dataset.frameSet);
    else if (t.dataset.seed) { seedEmpty(t.dataset.seed); }
    else if (t.dataset.replay) {
      var id = t.dataset.replay;
      if (id === 'image-bench') renderImageBench();
      else {
        var host = byId(id);
        play(host && host.querySelector('.empty-figure'));
        var empty = host && host.querySelector('.empty');
        if (empty) { empty.removeAttribute('data-play'); void empty.offsetWidth; empty.setAttribute('data-play', ''); }
      }
    }
  });

  byId('slow-toggle').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    root.style.setProperty('--speed', on ? 4 : 1);
  });

  byId('rm-toggle').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    root.setAttribute('data-rm', on ? 'on' : 'off');
  });

  byId('replay-all').addEventListener('click', function () {
    renderBenches();
    renderImageBench();
    renderRegister(true);
  });

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    var map = { '0': 'baseline', '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
    if (map[e.key]) { setConcept(map[e.key]); e.preventDefault(); }
    else if (e.key === 's' || e.key === 'S') byId('slow-toggle').click();
    else if (e.key === 'r' || e.key === 'R') byId('rm-toggle').click();
    else if (e.key === 'p' || e.key === 'P') byId('replay-all').click();
  });

  /* ------------------------------------------------------------------------
     The search desk
     ------------------------------------------------------------------------ */

  var state = { tx: '', corridor: '', property_type: '', config: '', verification_status: '', q: '' };

  function distinct(key) {
    var seen = {}, out = [];
    INV.forEach(function (o) {
      var v = o[key];
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    });
    return out.sort();
  }

  function fillSelect(id, values) {
    var sel = byId(id);
    if (!sel) return;
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
  }

  function configBuckets(o) {
    var c = String(o.configuration || '');
    var m = c.match(/^(\d)\s*BHK/i);
    if (m) return m[1] + ' BHK';
    if (/villa/i.test(c)) return 'Villa';
    if (/floor/i.test(c)) return 'Floor';
    if (/plot/i.test(c) || o.category === 'plot') return 'Plot';
    if (/shop|office|commercial|building/i.test(c)) return 'Commercial unit';
    return '';
  }

  function matches(o, st) {
    if (st.tx && String(o.transaction_type || '').toLowerCase().indexOf(st.tx.toLowerCase()) === -1) return false;
    if (st.corridor && o.corridor !== st.corridor) return false;
    if (st.property_type && o.property_type !== st.property_type) return false;
    if (st.config && configBuckets(o) !== st.config) return false;
    if (st.verification_status && o.verification_status !== st.verification_status) return false;
    if (st.category && o.category !== st.category) return false;
    if (st.q && haystack(o).indexOf(st.q.toLowerCase()) === -1) return false;
    return true;
  }

  function countWith(st) {
    var n = 0;
    for (var i = 0; i < INV.length; i++) if (matches(INV[i], st)) n++;
    return n;
  }

  var FILTER_LABELS = {
    tx: 'Transaction', corridor: 'Corridor', property_type: 'Type',
    config: 'Configuration', verification_status: 'Verification', category: 'Category', q: 'Keyword'
  };

  var CHIPS = [
    { label: 'Golf Course Road', corridor: 'Golf Course Road' },
    { label: 'DLF Phase 1–5', corridor: 'DLF Phase 1–5' },
    { label: 'Nirvana & Sohna Road', corridor: 'Nirvana Country & Sohna Road' },
    { label: 'Park facing', q: 'park facing' },
    { label: 'Corner', q: 'corner' },
    { label: 'To be confirmed', verification_status: 'Availability to be confirmed' }
  ];

  function initDesk() {
    fillSelect('f-corridor', distinct('corridor'));
    fillSelect('f-type', distinct('property_type'));
    var cfgs = {}, list = [];
    INV.forEach(function (o) { var b = configBuckets(o); if (b && !cfgs[b]) { cfgs[b] = 1; list.push(b); } });
    fillSelect('f-config', list.sort());
    fillSelect('f-verify', distinct('verification_status'));

    byId('desk').addEventListener('change', function (e) {
      var k = e.target.dataset.filter;
      if (!k) return;
      state[k] = e.target.value;
      renderRegister(true);
    });
    byId('f-q').addEventListener('input', debounce(function () {
      state.q = byId('f-q').value.trim();
      renderRegister(true);
    }, 260));
    byId('desk').addEventListener('submit', function (e) { e.preventDefault(); });

    document.querySelectorAll('[data-tx]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-tx]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        state.tx = b.dataset.tx;
        renderRegister(true);
      });
    });

    var host = document.querySelector('[data-chips]');
    host.innerHTML = CHIPS.map(function (c, i) {
      return '<button type="button" class="chip" data-chip="' + i + '" aria-pressed="false">' + esc(c.label) + '</button>';
    }).join('');
    host.addEventListener('click', function (e) {
      var b = e.target.closest('[data-chip]');
      if (!b) return;
      var c = CHIPS[Number(b.dataset.chip)];
      var on = b.getAttribute('aria-pressed') !== 'true';
      host.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      ['corridor', 'q', 'verification_status'].forEach(function (k) { state[k] = ''; });
      if (on) {
        b.setAttribute('aria-pressed', 'true');
        if (c.corridor) state.corridor = c.corridor;
        if (c.q) state.q = c.q;
        if (c.verification_status) state.verification_status = c.verification_status;
      }
      syncDeskFields();
      renderRegister(true);
    });
  }

  function syncDeskFields() {
    byId('f-corridor').value = state.corridor;
    byId('f-verify').value = state.verification_status;
    byId('f-q').value = state.q;
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ------------------------------------------------------------------------
     The register
     ------------------------------------------------------------------------ */

  var STAGGER_CAP = 8;      /* hard cap. 8 × 28ms = a 224ms tail. */
  var PER_CATEGORY = 6;
  var expanded = {};
  var saved = [];

  /* Side ∝ √area, because the mark encodes an area and the eye reads a
     rectangle's area, not its side. Scaled within category: plots run from
     702 to 108,900 sq ft and would flatten everything else to a dot. */
  function scaleFigure(o, maxSqft) {
    var a = Number(o.area_sqft_norm) || 0;
    if (!a || !maxSqft) {
      return '<figure class="scale-figure" data-area="none"><figcaption>Area not published</figcaption></figure>';
    }
    var maxSide = 56, side = Math.max(7, Math.sqrt(a / maxSqft) * maxSide);
    var w = side * 1.35, h = side / 1.35;      /* fixed proportions: a quantity, not a footprint */
    return '<figure class="scale-figure">' +
      '<svg width="' + Math.ceil(maxSide * 1.35) + '" height="' + Math.ceil(maxSide / 1.35 + 2) + '" fill="none" aria-hidden="true">' +
      '<line class="draw-stroke scale-projection" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3" x1="0" y1="' + (maxSide / 1.35 + 1) + '" x2="' + (maxSide * 1.35) + '" y2="' + (maxSide / 1.35 + 1) + '" style="--len:76" />' +
      '<rect class="draw-stroke scale-rect" stroke="var(--accent)" stroke-width="1" x="0.5" y="' + (maxSide / 1.35 - h + 0.5) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" style="--len:' + Math.ceil(2 * (w + h)) + '" />' +
      '</svg>' +
      '<figcaption>' + esc(areaLabel(o)) + '</figcaption></figure>';
  }

  function tile(o, i, maxSqft) {
    var concept = root.getAttribute('data-concept');
    var img = o.image_file ? 'assets/project-images/' + encodeURIComponent(o.image_file) : '';
    var confirm = o.verification_status === 'Availability to be confirmed';
    var isSaved = saved.indexOf(o.property_id) > -1;
    return '<article class="tile" style="--i:' + Math.min(i, STAGGER_CAP - 1) + '">' +
      '<figure class="tile-photo" data-loading="true">' +
        (img ? '<img src="' + img + '" alt="" loading="lazy" decoding="async" />' : '') +
        '<figcaption>Representative reference photograph</figcaption>' +
      '</figure>' +
      '<p class="tile-index"><b>' + String(i + 1).padStart(2, '0') + '</b><span>' + esc(placeLabel(o)) + '</span></p>' +
      '<h3>' + esc(o.listing_title || o.project_name || 'Reference ' + o.property_id) + '</h3>' +
      '<p class="tile-desc">' + esc(String(o.public_description || o.key_features || '').slice(0, 170)) + '</p>' +
      (concept === 'c' ? scaleFigure(o, maxSqft) : '') +
      '<div class="tile-terms"><strong>' + esc(priceLabel(o)) + '</strong>' +
        '<span>' + esc([o.configuration, areaLabel(o)].filter(Boolean).join(' · ')) + '</span></div>' +
      '<div class="tile-actions">' +
        '<a class="underlined" href="#">View details</a>' +
        '<button type="button" class="save-btn" data-save="' + esc(o.property_id) + '" aria-pressed="' + isSaved + '">' +
          (isSaved ? 'Saved' : '+ Save') + '</button>' +
        '<span class="verify-flag" data-state="' + (confirm ? 'confirm' : 'ok') + '">' +
          esc(confirm ? 'To confirm' : 'Re-verified') + '</span>' +
      '</div></article>';
  }

  function summaryText() {
    var bits = [];
    Object.keys(state).forEach(function (k) {
      if (state[k]) bits.push(FILTER_LABELS[k] + ': ' + state[k]);
    });
    return bits.length ? bits.join(' · ') : 'All available references';
  }

  var lastCount = 0;
  function animateCount(to) {
    var el = byId('count-figure');
    var from = lastCount;
    lastCount = to;
    var reduce = root.getAttribute('data-rm') === 'on' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || root.getAttribute('data-concept') !== 'a' || from === to) {
      el.textContent = to;
      return;
    }
    var ms = 220 * (Number(getComputedStyle(root).getPropertyValue('--speed')) || 1);
    var t0 = performance.now();
    (function step(now) {
      var p = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = to;
    })(t0);
  }

  function renderRegister(changed) {
    var results = INV.filter(function (o) { return matches(o, state); });
    var head = byId('register-head');

    animateCount(results.length);
    byId('measure-label').textContent = 'of ' + TOTAL + ' available';
    byId('register-summary').textContent = summaryText();

    /* The signal that does not depend on motion, and the one production has
       nowhere at all. */
    byId('live').textContent = results.length
      ? results.length + ' propert' + (results.length === 1 ? 'y' : 'ies') + ' match. ' + summaryText() + '.'
      : 'No properties match. ' + summaryText() + '. Suggestions for relaxing the search are shown below the register.';

    var cats = byId('categories'), emptyHost = byId('live-empty');

    if (!results.length) {
      cats.innerHTML = '';
      cats.hidden = true;
      emptyHost.hidden = false;
      renderEmpty(emptyHost, activeFilters(state), 'search');
      markChanged(head, changed);
      return;
    }

    cats.hidden = false;
    emptyHost.hidden = true;
    emptyHost.innerHTML = '';

    var html = '';
    CATEGORIES.forEach(function (c, ci) {
      var set = results.filter(function (o) { return o.category === c.key; });
      if (!set.length) return;
      var open = expanded[c.key] === undefined ? ci === 0 : expanded[c.key];
      var maxSqft = Math.max.apply(null, set.map(function (o) { return Number(o.area_sqft_norm) || 0; }).concat([1]));
      var shown = set.slice(0, PER_CATEGORY);
      var ref = String.fromCharCode(65 + ci);
      html += '<details class="category" data-cat="' + c.key + '"' + (open ? ' open' : '') + '>' +
        '<summary class="category-summary">' +
          '<span class="category-name">' + esc(c.name) +
            '<span class="category-ref">' + ref + ' — ' + ref + '</span></span>' +
          '<span class="category-desc">' + esc(c.desc) + '</span>' +
          '<span class="category-count">' + set.length + ' of ' + results.length + '</span>' +
          '<span class="category-mark" aria-hidden="true">⌄</span>' +
        '</summary>' +
        '<div class="category-region"><div>' +
          '<div class="register">' + shown.map(function (o, i) { return tile(o, i, maxSqft); }).join('') + '</div>' +
          (set.length > PER_CATEGORY
            ? '<p style="margin:0 0 40px;"><span class="fineprint">Showing ' + shown.length + ' of ' + set.length +
              ' in this category. The study caps the register for weight; production paginates.</span></p>'
            : '') +
        '</div></div></details>';
    });
    cats.innerHTML = html;

    cats.querySelectorAll('.category').forEach(function (d) {
      d.addEventListener('toggle', function () { expanded[d.dataset.cat] = d.open; });
    });
    hydrateImages(cats);
    measureStrokes(cats);
    markChanged(byId('register-head'), changed);
    cats.querySelectorAll('.register').forEach(function (r) { markChanged(r, changed); });
  }

  /* data-changed is set, then removed once the animation has had its time, so
     a re-render always retriggers and a resting page carries no state. */
  function markChanged(el, changed) {
    if (!el || !changed) return;
    el.removeAttribute('data-changed');
    void el.offsetWidth;
    el.setAttribute('data-changed', '');
    setTimeout(function () { el.removeAttribute('data-changed'); }, 1600);
  }

  /* Images: a real load/decode handshake instead of a background-image that
     appears in whichever frame it finishes. The caption is already visible. */
  function hydrateImages(scope) {
    scope.querySelectorAll('.tile-photo img').forEach(function (img) {
      var fig = img.closest('.tile-photo');
      var done = function () {
        fig.removeAttribute('data-loading');
        fig.setAttribute('data-loaded', '');
      };
      /* A missing file is not a slow file. 35% of the register lands here, so
         it gets a designed state rather than the grey box production leaves. */
      var failed = function () {
        fig.removeAttribute('data-loading');
        img.remove();
        if (root.getAttribute('data-concept') === 'baseline') return;
        fig.classList.add('no-photo');
        var cap = fig.querySelector('figcaption');
        if (cap) cap.remove();
        fig.insertAdjacentHTML('afterbegin',
          '<svg viewBox="0 0 300 200" fill="none" aria-hidden="true">' +
          '<rect class="draw-stroke" stroke="var(--line)" stroke-width="1" x="24.5" y="24.5" width="251" height="151" stroke-dasharray="2 4" style="--seq:0" />' +
          '<line class="draw-stroke" stroke="var(--muted)" stroke-width="1" x1="24" y1="176" x2="276" y2="176" style="--seq:1" />' +
          '</svg><p class="no-photo-copy"><b>No photograph published</b>Ask the advisory desk for current photographs.</p>');
        measureStrokes(fig);
        fig.setAttribute('data-play', '');
      };
      if (img.complete) { img.naturalWidth ? done() : failed(); }
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', failed, { once: true }); }
    });
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-save]');
    if (!b) return;
    var id = b.dataset.save, at = saved.indexOf(id);
    if (at > -1) saved.splice(at, 1);
    else if (saved.length < 3) saved.push(id);
    else {
      byId('live').textContent = 'Three properties are already saved. Remove one before saving another.';
      return;
    }
    document.querySelectorAll('[data-save="' + id + '"]').forEach(function (x) {
      var on = saved.indexOf(id) > -1;
      x.setAttribute('aria-pressed', String(on));
      x.textContent = on ? 'Saved' : '+ Save';
    });
    byId('saved-readout').textContent = saved.length + ' saved · the index above writes here';
    byId('live').textContent = saved.length + ' of 3 properties saved for comparison.';
    renderSavedBench();
  });

  /* ------------------------------------------------------------------------
     Empty states
     ------------------------------------------------------------------------ */

  function activeFilters(st) {
    return Object.keys(st).filter(function (k) { return st[k]; }).map(function (k) {
      var without = Object.assign({}, st);
      without[k] = '';
      return { key: k, label: FILTER_LABELS[k], value: st[k], without: countWith(without) };
    });
  }

  /* The smallest set of filters whose removal actually returns something.
     Dropping one is often not enough — seed "Lease · Plot · DLF 1–5" has no
     single removal that helps — and an empty state that offers an action
     leading to another empty state is worse than one that offers none. */
  function bestRelaxation(st, filters) {
    var keys = filters.map(function (f) { return f.key; });
    var best = null;
    function test(subset) {
      var trial = Object.assign({}, st);
      subset.forEach(function (k) { trial[k] = ''; });
      var n = countWith(trial);
      if (n > 0 && (!best || subset.length < best.keys.length || (subset.length === best.keys.length && n > best.count))) {
        best = { keys: subset.slice(), count: n };
      }
    }
    for (var size = 1; size <= keys.length && !best; size++) {
      (function combine(start, acc) {
        if (acc.length === size) { test(acc); return; }
        for (var i = start; i < keys.length; i++) combine(i + 1, acc.concat(keys[i]));
      })(0, []);
    }
    if (!best) return null;
    best.labels = best.keys.map(function (k) {
      var f = filters.filter(function (x) { return x.key === k; })[0];
      return f ? f.label.toLowerCase() + ' “' + f.value + '”' : k;
    });
    return best;
  }

  function renderEmpty(host, filters, kind) {
    var concept = root.getAttribute('data-concept');

    /* The baseline reproduces production's empty state verbatim, inline
       styles and all, so the undefined custom properties are visible rather
       than described. See README observation B. */
    if (concept === 'baseline' && kind === 'search') {
      host.innerHTML =
        '<div style="grid-column:1/-1;padding:80px 24px;border:1px solid var(--line);text-align:center;">' +
        '<h3>No exact matches found</h3>' +
        '<p style="max-width:60ch;margin-inline:auto;color:var(--muted);">We represent exclusive private mandates across Golf Course Road, DLF Phase 1–5, and prime Gurgaon enclaves that are held off-market. Contact our principal advisory desk with your exact requirements for a confidential shortlist.</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:18px;">' +
        '<button type="button" class="btn" style="background:var(--bg-page);color:var(--text-main);border:1px solid var(--border-light);">Reset All Filters</button>' +
        '<a class="btn" style="background:var(--oxblood);color:#ffffff;border:1px solid rgba(197,160,89,0.4);" href="#">Request Private Mandate on WhatsApp →</a>' +
        '</div></div>' +
        '<p class="fineprint" style="border-left:3px solid var(--accent);padding-left:24px;margin-top:32px;">' +
        'Reproduced verbatim from <code>data/inventory-search.js:754</code>. The two buttons above are styled with ' +
        '<code>--bg-page</code>, <code>--text-main</code>, <code>--border-light</code> and <code>--oxblood</code>, none of which ' +
        'the Datum stylesheet defines — which is why the primary action has no background. The state also does not ' +
        'say which filters produced zero results, and offers no way to relax one.</p>';
      return;
    }

    if (concept === 'baseline' && kind === 'saved') {
      host.innerHTML = '<div class="empty"><div></div><div class="empty-copy">' +
        '<h3>Saving does not exist in production</h3>' +
        '<p>There is nothing to reproduce. Save and compare live only in the v16 study ' +
        '(<code>dist/app.js:271</code>), capped at three and held in <code>localStorage</code>. ' +
        'Switch to a concept to see a proposed first screen.</p></div></div>';
      return;
    }

    var fig = FIGURES[concept + ':' + kind];
    var relax = filters.length ? bestRelaxation(
      (host === byId('empty-bench') ? benchState : state), filters) : null;
    var soloHelps = filters.some(function (f) { return f.without > 0; });

    var copy;
    if (kind === 'search') {
      copy =
        '<h3 style="--i:0">Nothing matches all ' + filters.length + ' of these at once.</h3>' +
        '<p style="--i:1">' +
          (soloHelps
            ? 'Every one of your filters is still applied below. The figure beside each is how many of the ' + TOTAL +
              ' available references would come back if you removed that one on its own.'
            : 'No single filter is the problem — they exclude everything in combination, which is why each one below still reads zero on its own. ' +
              (relax ? 'The smallest change that returns anything is to drop ' + relax.labels.length + ' of them.'
                     : 'No combination of these returns a reference in the public inventory.')) +
        '</p>' +
        '<div class="empty-filters" style="--i:2">' +
          '<span class="label-role">Still applied</span>' +
          filters.map(function (f) {
            return '<button type="button" class="filter-pill" data-drop="' + esc(f.key) + '"' +
              (f.without === 0 ? ' data-nohelp="true"' : '') +
              (relax && relax.keys.indexOf(f.key) > -1 ? ' data-widest="true"' : '') + '>' +
              '<span>' + esc(f.label) + '</span><b>' + esc(f.value) + '</b> ' +
              '<span>→ ' + f.without + '</span></button>';
          }).join('') +
        '</div>' +
        '<div class="empty-counts" style="--i:3">' +
          '<div><em>Available references in the whole portfolio</em><b>' + TOTAL + '</b></div>' +
          (relax
            ? '<div><em>If you drop ' + esc(relax.labels.join(' and ')) + '</em><b>' + relax.count + '</b></div>'
            : '<div><em>Any smaller combination of these filters</em><b>0</b></div>') +
        '</div>' +
        '<div class="empty-actions" style="--i:4">' +
          (relax
            ? '<button type="button" class="btn" data-drop-set="' + esc(relax.keys.join(',')) + '">Drop ' +
              (relax.keys.length === 1 ? 'it' : 'those ' + relax.keys.length) + ' — ' + relax.count + ' results</button>'
            : '') +
          '<button type="button" class="underlined" data-reset="1">Clear everything</button>' +
          '<a class="underlined" href="#">Ask the advisory desk instead</a>' +
        '</div>' +
        '<p class="fineprint" style="--i:5;margin-top:24px;">Counts are computed from the ' + TOTAL +
        ' available public references, not estimated. Off-market mandates are not counted here because they are not in this dataset, ' +
        'and this state must not imply otherwise.</p>';
    } else {
      copy =
        '<h3 style="--i:0">Three bays, nothing set out in them.</h3>' +
        '<p style="--i:1">Saving puts up to three references side by side on one sheet — price, area, configuration, corridor and what each still needs confirmed, in the same rows, so the comparison is between properties rather than between memories of properties.</p>' +
        '<div class="empty-counts" style="--i:2">' +
          '<div><em>Saved on this device</em><b>' + saved.length + ' of 3</b></div>' +
          '<div><em>Available to compare</em><b>' + TOTAL + '</b></div>' +
          '<div><em>Carrying an availability note to confirm</em><b>' +
            INV.filter(function (o) { return o.verification_status === 'Availability to be confirmed'; }).length + '</b></div>' +
        '</div>' +
        '<div class="empty-actions" style="--i:3">' +
          '<button type="button" class="btn" data-goto-index="1">Open the index and save one</button>' +
          '<a class="underlined" href="#">Ask Ajay to shortlist for you</a>' +
        '</div>' +
        '<p class="fineprint" style="--i:4;margin-top:24px;">Saved references stay in this browser. They are not an offer, a hold or a reservation, and nothing is sent anywhere until an enquiry is reviewed and submitted.</p>';
    }

    host.innerHTML = '<div class="empty">' +
      '<div class="empty-figure">' + (fig ? fig() : '') + '</div>' +
      '<div class="empty-copy">' + copy + '</div></div>';

    var scope = host.querySelector('.empty');
    measureStrokes(scope);
    play(host.querySelector('.empty-figure'));
    scope.setAttribute('data-play', '');
  }

  document.addEventListener('click', function (e) {
    var drop = e.target.closest('[data-drop],[data-drop-set]');
    if (drop) {
      var keys = (drop.dataset.dropSet || drop.dataset.drop).split(',');
      var inBench = !!drop.closest('#empty-bench');
      keys.forEach(function (k) {
        if (inBench) benchState[k] = '';
        else state[k] = '';
      });
      if (inBench) renderEmptyBench();
      else { syncDeskFields(); renderRegister(true); byId('register-head').scrollIntoView({ block: 'center' }); }
      return;
    }
    if (e.target.closest('[data-reset]')) {
      Object.keys(state).forEach(function (k) { state[k] = ''; });
      document.querySelectorAll('[data-tx]').forEach(function (x, i) { x.setAttribute('aria-pressed', String(i === 0)); });
      document.querySelectorAll('[data-chips] .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      byId('desk').reset();
      syncDeskFields();
      renderRegister(true);
      return;
    }
    if (e.target.closest('[data-goto-index]')) {
      byId('idx-title').scrollIntoView({ block: 'start' });
    }
  });

  /* ------------------------------------------------------------------------
     Benches
     ------------------------------------------------------------------------ */

  var SEEDS = {
    'lease-plot': { tx: 'Lease', category: 'plot', corridor: 'DLF Phase 1–5' },
    'rent-villa': { tx: 'Rent', category: 'villa', corridor: 'Golf Course Road' },
    /* No single removal returns anything here: a lease on a builder floor on
       Golf Course Road. Exercises the multi-filter relaxation path. */
    'lease-floor-gcr': { tx: 'Lease', category: 'builder-floor', corridor: 'Golf Course Road' }
  };
  var benchState = Object.assign({}, SEEDS['lease-plot']);

  function seedEmpty(key) {
    benchState = Object.assign({}, SEEDS[key] || SEEDS['lease-plot']);
    renderEmptyBench();
  }

  function renderEmptyBench() {
    var n = countWith(benchState);
    var host = byId('empty-bench');
    if (n > 0) {
      host.innerHTML = '<p class="fineprint" style="border-left:3px solid var(--accent);padding-left:24px;">' +
        'That combination now matches <b>' + n + '</b> references, so there is no empty state to show. ' +
        'Pick another seed above — each one is a filter combination that genuinely matches zero of the ' + TOTAL + '.</p>';
      return;
    }
    renderEmpty(host, activeFilters(benchState), 'search');
  }

  function renderSavedBench() { renderEmpty(byId('saved-bench'), [], 'saved'); }

  function renderBenches() { renderEmptyBench(); renderSavedBench(); }

  /* Image bench: production's behaviour on the left, the concept on the right,
     on a real photograph from the real asset folder. */
  function renderImageBench() {
    var concept = root.getAttribute('data-concept');
    var sample = INV.filter(function (o) { return o.image_file && !/^(apartment|commercial|villa|builder-floor|plot-land-user)\.jpg$/.test(o.image_file); })[3] || INV[0];
    var src = 'assets/project-images/' + encodeURIComponent(sample.image_file);
    var host = byId('image-bench');
    var notes = {
      baseline: 'Identical to the left. The baseline has no reveal.',
      a: 'The image builds up from its ground line: clip-path inset 100% → 0 at the bottom edge, 320ms, decelerating. The caption is present in frame one.',
      b: 'A cut travels across it: clip-path inset from the left, 320ms. Same duration, different axis — and it reads more like a transition than a construction.',
      c: 'Deliberately nothing: opacity at 160ms. In this concept the photograph is not the news, the scale figure is.',
      d: 'Opacity at 320ms with one pass of a raking highlight. Judge whether that highlight is material or merely shiny.'
    };
    host.innerHTML =
      '<figure><div class="tile-photo" data-loading="true" data-bench="base">' +
        '<img src="' + src + '" alt="" />' +
        '<figcaption>Representative reference photograph</figcaption></div>' +
        '<figcaption><b>Production</b>The photograph is a background-image with no load handshake. It replaces flat #eff0ec in whichever frame it finishes decoding.</figcaption></figure>' +
      '<figure><div class="tile-photo" data-loading="true" data-bench="concept">' +
        '<img src="' + src + '?v=' + Date.now() + '" alt="" />' +
        '<figcaption>Representative reference photograph</figcaption></div>' +
        '<figcaption><b>' + esc(CONCEPTS[concept].title) + '</b>' + esc(notes[concept]) + '</figcaption></figure>';

    var base = host.querySelector('[data-bench="base"]');
    base.removeAttribute('data-loading');
    base.removeAttribute('data-loaded');
    hydrateImages(host);
    renderMissingBench();
  }

  /* 121 of 347 records name an image file that is not on disk. Production
     sets it as a background-image with no error path, so the tile is flat
     grey underneath a badge claiming a representative photograph. The answer
     is not a reveal; it is a drawn absence that says what is known. */
  function renderMissingBench() {
    var host = byId('missing-bench');
    if (!host) return;
    var concept = root.getAttribute('data-concept');
    var sample = INV.filter(function (o) { return o.image_file === 'commercial.jpg'; })[0] || INV[0];

    var absent = concept === 'baseline'
      ? '<div class="tile-photo"><figcaption>Representative reference photograph</figcaption></div>'
      : '<div class="tile-photo no-photo"><svg viewBox="0 0 300 200" fill="none" aria-hidden="true">' +
          '<rect class="draw-stroke" stroke="var(--line)" stroke-width="1" x="24.5" y="24.5" width="251" height="151" stroke-dasharray="2 4" style="--seq:0" />' +
          '<line class="draw-stroke" stroke="var(--muted)" stroke-width="1" x1="24" y1="176" x2="276" y2="176" style="--seq:1" />' +
          '<g class="draw-fade" style="--seq:2">' +
            '<line stroke="var(--accent)" stroke-width="1" x1="18" y1="182" x2="30" y2="170" />' +
            '<line stroke="var(--accent)" stroke-width="1" x1="270" y1="182" x2="282" y2="170" />' +
          '</g></svg>' +
          '<p class="no-photo-copy"><b>No photograph published</b>' +
          esc([sample.property_type, sample.corridor].filter(Boolean).join(' · ')) +
          '. Ask the advisory desk for current photographs of this reference.</p>' +
        '</div>';

    host.innerHTML =
      '<figure><div class="tile-photo"><figcaption>Representative reference photograph</figcaption></div>' +
        '<figcaption><b>Production</b>Flat #eff0ec, a badge claiming a photograph, and no indication that anything failed. ' +
        'The 404 is silent: <code>attachPhoto()</code> assigns the URL and never checks it.</figcaption></figure>' +
      '<figure>' + absent +
        '<figcaption><b>' + (concept === 'baseline' ? 'Switch concepts to see the proposal' : 'A drawn absence') + '</b>' +
        (concept === 'baseline'
          ? 'Identical to the left, because production has no designed state for this.'
          : 'The frame is drawn empty and says so, the badge is withdrawn rather than left lying, and what is actually known about the reference takes the space the photograph was holding.') +
        '</figcaption></figure>';

    measureStrokes(host);
    host.querySelectorAll('.no-photo').forEach(function (el) {
      el.removeAttribute('data-play'); void el.offsetWidth; el.setAttribute('data-play', '');
    });
  }

  /* ------------------------------------------------------------------------
     Ornament bench — the case for and against, measured
     ------------------------------------------------------------------------ */

  var ornMode = 'svg', rafId = 0, frames = 0, canvasEl = null;

  function datumFieldSVG() {
    var cols = 12, s = '<svg class="datum-field" width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 1200 420" fill="none">';
    for (var i = 1; i < cols; i++) {
      var x = (1200 / cols) * i;
      s += '<line data-col="' + i + '" x1="' + x + '" y1="0" x2="' + x + '" y2="420" />';
    }
    s += '<line x1="0" y1="64" x2="1200" y2="64" /><line x1="0" y1="356" x2="1200" y2="356" />';
    s += '<text x="12" y="58">± 0.000 DATUM</text>';
    return s + '</svg>';
  }

  function mountOrnament() {
    var layer = byId('ornament-layer');
    stopCanvas();
    frames = 0;
    if (ornMode === 'svg') {
      layer.innerHTML = datumFieldSVG();
      measureStrokes(layer);
      byId('orn-readout').textContent =
        layer.querySelectorAll('line,text').length + ' nodes · 0 frames drawn · responds to pointer only';
    } else {
      layer.innerHTML = '<canvas id="orn-canvas-el" style="width:100%;height:100%;display:block;"></canvas>';
      canvasEl = byId('orn-canvas-el');
      drawCanvas(0.5);
    }
  }

  function stopCanvas() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    canvasEl = null;
  }

  function drawCanvas(px) {
    if (!canvasEl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);   /* brand policy cap */
    var w = canvasEl.clientWidth, h = canvasEl.clientHeight;
    if (!w || !h) return;
    canvasEl.width = Math.round(w * dpr);
    canvasEl.height = Math.round(h * dpr);
    var ctx = canvasEl.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var fins = 26, gap = w / fins;
    for (var i = 0; i < fins; i++) {
      var d = Math.abs(i / fins - px);
      var lit = Math.max(0, 1 - d * 2.2);
      ctx.fillStyle = 'rgba(171,57,44,' + (0.03 + lit * 0.05).toFixed(3) + ')';
      ctx.fillRect(i * gap, 0, gap * 0.55, h);
      ctx.fillStyle = 'rgba(27,33,30,' + (0.02 + (1 - lit) * 0.016).toFixed(3) + ')';
      ctx.fillRect(i * gap + gap * 0.55, 0, gap * 0.45, h);
    }
    frames++;
    byId('orn-readout').textContent =
      '1 canvas · ' + frames + ' frames drawn · ' + Math.round(canvasEl.width * canvasEl.height / 1000) +
      'k px per frame at DPR ' + dpr;
  }

  byId('ornament-stage').addEventListener('pointermove', function (e) {
    if (root.getAttribute('data-rm') === 'on') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var r = this.getBoundingClientRect(), px = (e.clientX - r.left) / r.width;
    if (ornMode === 'svg') {
      var near = Math.round(px * 12);
      this.querySelectorAll('.datum-field line[data-col]').forEach(function (l) {
        l.classList.toggle('datum-active', Number(l.dataset.col) === near);
      });
    } else if (!rafId) {
      rafId = requestAnimationFrame(function () { rafId = 0; drawCanvas(px); });
    }
  });

  byId('orn-svg').addEventListener('click', function () {
    ornMode = 'svg';
    this.setAttribute('aria-pressed', 'true');
    byId('orn-canvas').setAttribute('aria-pressed', 'false');
    mountOrnament(); renderOrnamentVerdict();
  });
  byId('orn-canvas').addEventListener('click', function () {
    ornMode = 'canvas';
    this.setAttribute('aria-pressed', 'true');
    byId('orn-svg').setAttribute('aria-pressed', 'false');
    mountOrnament(); renderOrnamentVerdict();
  });

  function renderOrnamentVerdict() {
    byId('orn-verdict').innerHTML = ornMode === 'svg'
      ? '<p><b>Verdict: keep, narrowly.</b> Fourteen DOM nodes, no script in the resting state, no frames drawn, ' +
        'and it degrades to a static set of hairlines on touch, on keyboard and under reduced motion — where it is still ' +
        'a correct drawing rather than a broken effect. It earns its place because the lines it draws are the ' +
        'columns the layout actually uses, so it annotates the page instead of decorating it.</p>' +
        '<p>Limit: one instance per page, never behind a photograph, a form control or a property fact, and the ' +
        'datum label must never carry a number that could be read as a measurement of a property.</p>'
      : '<p><b>Verdict: do not ship.</b> Move the pointer and watch the frame counter. This is a per-frame raster of ' +
        '~hundreds of thousands of pixels to produce a field of soft vertical bands that the SVG version renders as ' +
        'fourteen static hairlines, at zero frames, with crisper edges at every zoom level and in print. ' +
        'The brand document permits a shader here; permission is not a reason.</p>' +
        '<p>It also fails the honesty test the Sun direction was always going to face: a raking light that responds to ' +
        'the pointer implies a light source and a facade orientation that belong to no property in the register. ' +
        'The restrained version of this idea is Concept D, which spends 1px of edge colour instead of a GPU.</p>';
  }

  /* ------------------------------------------------------------------------
     The specification, read from the live stylesheet
     ------------------------------------------------------------------------ */

  function renderSpec() {
    var cs = getComputedStyle(root);
    var v = function (n) { return cs.getPropertyValue(n).trim(); };
    var rows = [
      ['--m-feedback', v('--m-feedback'), 'Hover, focus, press, border and colour. Every concept, including the baseline — this already ships.', 'Kept, instant. Focus and hover are state, not decoration.'],
      ['--m-state', v('--m-state'), 'A change of information state: disclosure, filter result, wipe, datum sweep.', 'Dropped. The count, the summary line and the live region carry it.'],
      ['--m-reveal', v('--m-reveal'), 'A surface arriving: an image mask, the first paint of a register.', 'Dropped. The image simply appears, as it does today.'],
      ['--m-draw', v('--m-draw'), 'Expressive illustration only — the two empty-state drawings. Nothing else may use it.', 'Dropped. The finished drawing renders in full.'],
      ['--m-stagger', v('--m-stagger'), 'Per-item offset, capped at ' + STAGGER_CAP + ' items in JS. Worst-case tail ' + (STAGGER_CAP * parseInt(v('--m-stagger'), 10)) + 'ms.', 'Dropped. All rows resolve together.'],
      ['--e-settle', v('--e-settle'), 'The default. Arrives and stops precisely; no overshoot.', '—'],
      ['--e-feedback', v('--e-feedback'), 'Near-linear, imperceptible. Colour only.', '—'],
      ['--e-draw', v('--e-draw'), 'A pen: prompt at the start, easing off at the end of the stroke.', '—']
    ];
    byId('spec-body').innerHTML = rows.map(function (r) {
      return '<tr><th scope="row"><code>' + r[0] + '</code></th><td><code>' + esc(r[1]) + '</code></td><td>' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>';
    }).join('');

    var mech = [
      ['Interface feedback', 'hover, focus, press', 'colour → colour', 'The colour change itself, instantly'],
      ['Category disclosure', 'click or Enter on the summary', 'grid-template-rows 0fr → 1fr', 'The region is open; the mark is rotated; aria-expanded is set by <details>'],
      ['Register change', 'select change, chip, keyword (260ms debounce)', 'datum scaleX 0 → 1; rows 6px → 0, or a single clip wipe', 'The count, the summary line, and an aria-live announcement naming the filters'],
      ['Count figure', 'a new result length', 'previous → new over --m-state', 'The final figure, written immediately'],
      ['Image reveal', 'the image’s own load event', 'clip-path inset 100% → 0, or opacity', 'The photograph appears; its caption was never hidden'],
      ['Scale figure (C)', 'disclosure open, or a new set maximum', 'stroke-dashoffset len → 0', 'The figure and its unit label are drawn in full'],
      ['Empty-state drawing', 'mount — the one non-interactive trigger', 'stroke-dashoffset len → 0, sequenced', 'The completed drawing, plus all copy, counts and actions'],
      ['Raking light (D)', 'hover on a fine pointer; focus-within always', 'inset 1px highlight and 1px base hairline', 'The lit state is applied instantly and is the focus indicator'],
      ['Ornament', 'pointer position, fine pointers only', 'stroke colour on one gridline', 'Static hairlines. It is a drawing either way.']
    ];
    byId('spec-mech').innerHTML = mech.map(function (r) {
      return '<tr><th scope="row">' + r[0] + '</th><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  if (!INV.length) {
    document.querySelector('main').insertAdjacentHTML('afterbegin',
      '<div class="container" style="padding:48px 0;"><p class="fineprint" style="border-left:3px solid var(--accent);padding-left:24px;">' +
      'The inventory did not load. Serve this folder over HTTP — <code>python3 -m http.server 8080 --directory dist</code> — ' +
      'rather than opening the file directly.</p></div>');
  }

  initDesk();
  setConcept('baseline');
  setFrame('full');
  renderRegister(false);
  renderBenches();
  renderImageBench();
  booted = true;
  mountOrnament();
  renderOrnamentVerdict();
  renderSpec();
})();
