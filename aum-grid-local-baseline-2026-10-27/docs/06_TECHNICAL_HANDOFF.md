# 06 — Technical Handoff and Tree Ownership

This file describes the current source exactly enough for someone—or Codex in a fresh chat—to extend it without losing baseline fidelity.

## Runtime model

No framework build step. One `index.html` file loads stylesheets and scripts. JavaScript manipulates visible view sections and in-memory search state; no backend API, database, static asset pipeline or package install.

### Executable files

| File | Primary ownership |
| --- | --- |
| `dist/index.html` | Semantic page markup, controls, all view containers and navigation targets |
| `dist/main.js` | Hard-coded sample inventory, filters, result cards, route switching, WhatsApp links |
| `dist/styles.css` | Original broader site components, including results and responsive support |
| `dist/grid.css` | Grid-led homepage, utility views, responsive tile arrangement |
| `dist/study.js` | Legacy palette/type experiment state and controls |
| `dist/study.css` | Color tokens, font families, prior study overrides |
| `dist/architecture.js` | Architecture, material and depth switcher state, URL synchronization |
| `dist/architecture.css` | Original International/Elevation geometry and material/depth rules |
| `dist/refinement.js` | Study-versus-visitor presentation toggle |
| `dist/refinement.css` | Study 06 refinements, persistent tile action, gutters, two newer depth treatments and downstream page styling |
| `study-controls.test.cjs` | Three Node VM-based studio/state regressions |

### Actual loading order

CSS:

1. `styles.css`
2. `grid.css`
3. `study.css`
4. `architecture.css`
5. `refinement.css`

Deferred JS:

1. `main.js`
2. `study.js`
3. `architecture.js`
4. `refinement.js`

**Maintenance warning:** Later CSS overrides are part of this prototype's history. Before changing a selector, inspect all five style layers and their breakpoint specificity. In particular, Study 06 intentionally cancels earlier hover translations and hover-hidden CTAs. A final implementation should consolidate these files, but **do not refactor them while trying to establish the frozen baseline**.

## Core state and navigation

Architecture root attributes:

- `data-architecture="international|elevation"`
- `data-fourth="none|cobalt|bronze|verdigris"`
- `data-depth="flat|relief"`
- `data-palette="redwhite|…"`
- `data-type="plex|…"`
- `data-presentation="study|preview"`

URL query parameters mirror those experiment settings, with local storage fallback. Hashes such as `#browse`, `#locations` and `#advisor-listing` indicate the currently displayed view.

`dist/main.js` contains `state = {intent, location, type, budget, sort}` and mutates the result grid after selection. That state does **not** currently serialize fully into the URL.

## Data provenance and external dependencies

- `inventory` in `main.js` is a fixed nine-item sample. Treat every field and image as requiring business verification before production.
- Property photos are resolved as `https://aumestates.com` plus an `/assets/…` path. They are not bundled in `dist/`.
- Fonts load from Google Fonts; this archive intentionally does not vendor eight exploratory font families.
- WhatsApp, telephone and original-site links are live outbound actions when clicked in the local copy. Check their correctness before real-world use.
- Some images are explicitly representative, not a verified depiction of the named property.

## Sensible evolution of the tree

**Now:** Keep the functional `dist/` byte-for-byte in the baseline archive to enable comparison with published Study 06.

**At R0:** Make an audit branch/copy. Define component ownership, state contracts and provenance metadata. Add targeted tests before changing architecture.

**At R1/R2:** If complexity warrants it, split logical components and styles (shared tokens/forms/results; architecture-specific composition and effects). Avoid simultaneous framework rewrites, brand redesign and data integration.

**At production-candidate stage:** Consolidate duplicate CSS, remove unused font variants, design tokens and concept-lab chrome, choose a production routing/data solution, and verify semantics/accessibility/performance.

Do not edit the original connected Site checkout merely to tidy this local archive. The local baseline is intentionally independent.

## Minimal verification

```bash
node --test study-controls.test.cjs
node --check dist/main.js
node --check dist/study.js
node --check dist/architecture.js
node --check dist/refinement.js
```

Future high-value tests:

1. All `data-browse`, `data-view`, `data-advisor` and `data-location` actions navigate correctly.
2. Invalid URL choices resolve to safe defaults.
3. Filters produce expected results and honest unsupported-intent states.
4. Search state survives URL/history and property-detail return.
5. Mobile tray and menu restore focus correctly.
6. All external link targets and WhatsApp messages match the user's intent and item.
7. Key pages have no viewport overflow in 320–1440px range.
8. No missing-image fallback causes a misleading representation.

## Recommended first change in a new chat

**Do not immediately polish CSS.** First audit the small data sample, the first-click hierarchy and the full interaction paths. Freeze the current two modes as the control, then ship R1 International and R1 Elevation as a **paired private experiment**.

The full phase definitions and release gates are in [03_EXPERIMENT_ROADMAP.md](03_EXPERIMENT_ROADMAP.md).
