# AUM ESTATES — Architectural Grid Study

**Standalone local baseline · Study 06 · 27 October 2026**

This is a runnable copy of the two-concept AUM ESTATES design study, packaged so further experiments can begin in a clean, known state. It includes the current UI and behavior **as shipped**, plus a written account of the thinking and the work ahead.

**Source snapshot:** `6149ceecef893a2b2e880c86ac8169d15d3fd2b3` from the private study source. The working-tree snapshot was clean at export. The copied `dist/` and existing control tests are intentionally unchanged.

**Published reference, not the local runtime:** https://aum-architectural-grid-study.udiboy98.chatgpt.site/

**Important:** This is a private concept study, not the real `aumestates.com` product. It has no database, no live listing sync, and no admin system. No deployment credential, Git history or hosting identity is included here.

## 1. Run it locally

Prerequisites: Python 3 for the zero-dependency HTTP server; Node.js 18+ if you want to run the existing tests.

From the folder containing this README:

```bash
python3 -m http.server 8000 --directory dist
```

Open **http://localhost:8000/** in a browser. Use another port if 8000 is busy.

Do not open `dist/index.html` via a `file://` URL: a local HTTP origin gives a more representative test environment.

### Open specific variants

- International Style, normal visitor composition: http://localhost:8000/?architecture=international&presentation=1
- Architectural Elevation, normal visitor composition: http://localhost:8000/?architecture=elevation&presentation=1
- Elevation + bronze material experiment: http://localhost:8000/?architecture=elevation&fourth=bronze&presentation=1
- International, flat 2-D: http://localhost:8000/?architecture=international&depth=flat&presentation=1
- Study controls: http://localhost:8000/

In study mode, toggle architecture, fourth material color and depth in the visible control bar; **TYPE + COLOR** opens the older palette/type lab. **VIEW AS VISITOR** removes the main study chrome and can be toggled back. Selections are stored in URL parameters and browser local storage. For a clean baseline, use a private browsing session or a fresh explicit URL.

### Run available checks

```bash
node --test study-controls.test.cjs
node --check dist/main.js
node --check dist/study.js
node --check dist/architecture.js
node --check dist/refinement.js
```

Three control tests passed when the baseline was prepared. They validate the studio switches, URL behavior and a retired concept fallback; they do **not** amount to full browser, search or accessibility coverage.

## 2. Folder layout

```text
aum-grid-local-baseline-2026-10-27/
├── README.md
├── dist/
│   ├── index.html
│   ├── main.js
│   ├── styles.css
│   ├── grid.css
│   ├── study.js
│   ├── study.css
│   ├── architecture.js
│   ├── architecture.css
│   ├── refinement.js
│   └── refinement.css
├── study-controls.test.cjs
└── docs/
    ├── 00_CURRENT_STATE.md
    ├── 01_DESIGN_PHILOSOPHY.md
    ├── 02_PRODUCT_AND_JOURNEYS.md
    ├── 03_EXPERIMENT_ROADMAP.md
    ├── 04_TEST_AND_REVIEW_PLAN.md
    ├── 05_DECISION_LOG.md
    ├── 06_TECHNICAL_HANDOFF.md
    └── 07_ORIGINAL_STUDY_README.md
```

All working application files stay in `dist/` to retain their original relative links and test paths. The design and planning documents live in `docs/`. The original study README is preserved separately.

## 3. What is implemented today

- Two selectable spatial systems: **International Style** (continuous façade, fixed frame, inset depth) and **Architectural Elevation** (fine drafting grid, semantic intention, orthographic offsets).
- Red / White / Ink as the default; optional cobalt, bronze and verdigris material details; flat/relief alternatives.
- Home with search plus seven action tiles, visible underlined action labels, broader gutters, responsive layouts.
- Demonstration navigation to results, locations, advisory and About.
- Basic filters, removable filter chips, result counts, mobile filter tray, browser-hash navigation, outbound WhatsApp enquiries.
- A small curated public **sample**, not a real-time database.
- Visitor-mode toggle and locally shareable *design* settings.

## 4. What is not finished

The most serious gaps are **product gaps**, not color selection: unsupported rental/land listing samples, sparse locality coverage, limited filtering and property detail, generic original-inventory links, limited enquiry context persistence, incomplete accessibility focus management and shallow evidence of actual user behavior. The visual systems also need intentional mobile redesign and a coherent treatment of deeper pages.

Read [Current State](docs/00_CURRENT_STATE.md) before judging or extending the UI.

## 5. Where the next conversation should begin

1. Read [Design Philosophy](docs/01_DESIGN_PHILOSOPHY.md) and [Product/Journeys](docs/02_PRODUCT_AND_JOURNEYS.md) to understand what we're trying to build.
2. Read the full [Experiment Roadmap](docs/03_EXPERIMENT_ROADMAP.md): shared **R0**, then paired **I1/E1** through **I6/E6**.
3. Check [Test and Review Plan](docs/04_TEST_AND_REVIEW_PLAN.md) and [Decision Log](docs/05_DECISION_LOG.md).
4. Use [Technical Handoff](docs/06_TECHNICAL_HANDOFF.md) when changing source files.
5. Start with **R0**: confirm actual route/data contracts and establish a repeatable visual + interaction baseline. Then implement **R1 for both concepts in the same release**.

### Guardrails

- Preserve the same factual content and customer capabilities across variants while comparing architecture.
- Do not invent photos, inventory, floor plans, measurements, prices, stats or testimonials.
- No GitHub or production website writes are implied by using this package.
- Keep user-facing actions obvious without hover, and prioritize keyboard/mobile behavior.
- Resist introducing new colors, 3-D gimmicks or heavyweight dependencies until the product hierarchy is sound.

## 6. Asset and connectivity note

Fonts currently load from Google Fonts. Property photographs are referenced from `https://aumestates.com/assets/…` at runtime, and WhatsApp/contact/original-inventory links also leave this local site. Those assets are **not embedded in this archive**, so fully offline browsing will not reproduce all photography or external destinations. A future production migration needs asset permissions, source checks, image-to-property verification and deliberate hosting.

This package is intentionally a faithful baseline rather than a prematurely refactored final product.
