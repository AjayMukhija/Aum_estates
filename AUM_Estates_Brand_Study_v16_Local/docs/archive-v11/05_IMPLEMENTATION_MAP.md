# 05 — Implementation map and safe local development

## Current architecture

The study deliberately uses **one buildless static application**:

- `dist/index.html`: layout/semantic nodes, content shells, header, search, filters, index, detail, menu, sheets, footer.
- `dist/styles.css`: all tokens, layout rules and responsive breakpoints.
- `dist/app.js`: hard-coded inventory and browser-local state/interaction logic.
- `.openai/hosting.json`: hosting configuration for the existing **private study**, not the production site.

There are no framework dependencies, package manifests, database connections or environment secrets in the exported source.

## Core component ownership

| UI component | HTML structure | CSS | JS |
| --- | --- | --- | --- |
| Header / nav | `.site-header`, `.site-nav`, `.header-actions` | Header styles and breakpoints | `goTo()`, `setMenu()` |
| Hero + purpose selection | `.index-intro`, `.hero-discovery`, `#inventory-purpose` | Intro / control rules | `activePurpose`, `purposeSelect` change |
| Search & filters | `#index-query`, `#index-area`, `#filter-panel` | `.hero-fields`, `.filter-fields` | `renderList()`, `setFilterPanel()`, `resetSearch()` |
| Result register | `#property-list` | `.property-row`, `.property-copy`, `.property-action` | `renderList()` template |
| Property detail | `#view-gallery` | `.gallery-shell`, `.gallery-identity`, `.gallery-information` | `showProperty()` |
| Detail checklist | `#gallery-tab-content` | `.gallery-tabs`, `.question-list` | `showGalleryTab()`, checkbox event delegation |
| Save / comparison | `[data-shortlist]`, `#gallery-save` | `.comparison`, button states | `toggleSaved()`, `openShortlist()` |
| Enquiry composer | `#detail-sheet` | `.detail-sheet`, `.consult-form` | `openConsult()` |
| Overlay menu | `#mega` | `.mega`, `.mega-columns` | `setMenu()` |
| Browser routing | `#index`, `#view` | `.screen` | `showScreen()`, `popstate`, query-state helpers |

## Main data and state

- `inventory`: array of six demo property objects near the top of `app.js`.
- `activePurpose`: Buy/Rent/Commercial/Land.
- `activeGallery`: numeric index of currently open property.
- `activeGalleryTab`: `checks` / `facts` / `notes`.
- `saved`: Set of property IDs, capped at three.
- `selectedQuestions`: browser-persisted per-property question indices.
- `personalNotes`: browser-persisted per-property text.
- URL filters: `purpose`, `area`, `q`, `kind`, `beds`, `budget`, `sort`.
- Detail URL parameters: `view=view`, `property=<id>`.

Note: `activeJourney` currently influences limited consultation defaults; it is not a full persona engine.

## Browser-only behavior

`localStorage` is used for saved references, question selection and notes. The application has no users or persistence server. The WhatsApp link is a prefilled external action; the site does not send messages.

The public-source image URLs load directly from `aumestates.com`; a broken request should show the image fallback rather than damage the layout.

## Local workflow

Run from the root of this handoff:

1. `python3 -m http.server 8080 --directory dist`
2. Open `http://localhost:8080/`.
3. Edit `dist/index.html`, `dist/styles.css`, `dist/app.js` in your editor.
4. Reload the browser. There is no compile/build step.
5. Run `node --check dist/app.js` if Node is installed. Otherwise use a browser console for errors.
6. Inspect narrow widths, keyboard navigation and URL/history behavior before declaring an edit complete.

For a more formal local workspace, initialize a separate Git repository **for this extracted copy**, or add the files to a new branch in a controlled experimental repository. Do not transplant the existing Site's `.openai/hosting.json` into `Aum_estates`.

## If extracting React components later

The current HTML/CSS/JS is the visual and functional **reference**, not an instruction to preserve a monolithic implementation forever. A staged decomposition could use:

- `SiteShell` (header, menu, footer, sheet)
- `PropertyDiscovery` (category, location, search, advanced filters)
- `PropertyIndex` / `PropertyRow`
- `PropertyDetail` (identity, media, published facts, uncertainty, actions)
- `DueDiligenceTabs` (questions, source, personal notes)
- `SavedComparison`
- `EnquiryComposer`

Extract shared presentational components only after testing stable behavior. Avoid a speculative component library or arbitrary abstract “Card” primitive. Favor accessible HTML elements, real labels, clear parent-child responsibility and tested state boundaries.

## Production integration plan — principles

1. Inspect the actual production repository, its framework, router, API boundaries, auth, data sources, admin interfaces and deployed hosting before changing code.
2. Map this study to real use cases and mark what can be reused verbatim (tokens, hierarchy, copy) versus what must be rebuilt (inventory access, data models, image handling, deep routes, security).
3. Introduce a normalized, typed property contract and a transparent source/verification model before connecting UI to live data.
4. Integrate behind a separate route/feature flag and run functional, responsive and accessibility parity checks.
5. Do not delete existing features or mutate customer records as part of a visual redesign.

The study commit above identifies the exact baseline. Source tree and exported archive should remain distinct from production deployment history.
