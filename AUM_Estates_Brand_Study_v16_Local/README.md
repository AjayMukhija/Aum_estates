# AUM Estates — local brand and property-experience study

**Working version:** v16, source commit `b364a085769db84d58079711d563f9a765d6e6dc` (30 October 2026)

This is a **complete, buildless static prototype** of the property-index experience and five speculative brand directions. It is for local design, UX and front-end iteration. It is not the production website, a verified live property catalogue, or an approved identity system.

## Start in under a minute

On macOS, extract this ZIP, open Terminal in the extracted folder and run:

```sh
python3 -m http.server 8080 --directory dist
```

Then visit:

- <http://localhost:8080/> — property search experience, with a private **Brand Studio** control.
- <http://localhost:8080/brand-board.html> — five comparative identity systems and brand applications.
- <http://localhost:8080/responsive-lab.html> — live 375px phone and 768px tablet previews.

No Node, npm, database, API key or build step is needed. Some representative property photographs require an internet connection.

Use `Control+C` to stop the server. Do **not** rely on opening `index.html` with a `file://` URL: serving over HTTP better reproduces browser behavior and links.

## Open a particular direction

| Concept | Direct local URL | Character |
| --- | --- | --- |
| 01 Datum | `http://localhost:8080/?studio=datum` | Crisp editorial/architectural register; recommended core |
| 02 Sun | `http://localhost:8080/?studio=sun` | Warm daylight and facade relief |
| 03 Atlas | `http://localhost:8080/?studio=atlas` | Deep evergreen topographic atmosphere |
| 04 Screen | `http://localhost:8080/?studio=screen` | Oxide-red modern architectural apertures |
| 05 Imprint | `http://localhost:8080/?studio=imprint` | Serif-led, print-material identity |

The comparison board uses `?concept=<direction>` instead. A valid explicit URL parameter takes priority over the saved local preference.

## Structure

```text
dist/
  index.html           Property search/detail experience and studio switcher
  styles.css           Base layout, 4-role type hierarchy, responsive components
  app.js               Sample property inventory and interactive flows
  brand.css            Five differentiated site-wide visual directions
  brand.js             Brand selection, persistence, optional WebGL experiments
  brand-board.html     Identity/collateral comparison
  brand-board.css      Physical/print application styling
  brand-board.js       Board interaction and concept descriptions
  responsive-lab.html  Side-by-side real-size iframe previews
BRAND_DIRECTIONS.md    Full original v16 identity reasoning and constraints
docs/                  Updated handoff decisions, tests, roadmap and Codex prompt
docs/archive-v11/      Historical product notes, clearly not the v16 source
```

## What is actually functional

The static site implements sample inventory search and filters, categorized disclosure, property details and source-awareness, saved comparisons (up to three), device-local notes and questions, an editable enquiry review, menu/side sheets, keyboard interactions and deep-linkable views. Brand switching affects appearance, not property facts.

**Limitations:** Six sample references are hard-coded; only Buy has sample results. Rent, Commercial and Land show clear prototype empty states. Prices, units, legal documents and current availability are not verified. Imagery is largely illustrative. State lives in browser storage, not a backend. WhatsApp/phone actions initiate the user's own external client; no lead is silently sent. No authentication, CRM, inventory API or booking exists.

## Rules before editing

1. **Do not edit the production website or GitHub repository** as part of this local exploration. The separate live site is `https://aumestates.com/`.
2. Preserve usable search and honest fact/source labels before adding visual treatment.
3. Keep the five directions distinct until a deliberate primary identity decision; don't combine their color, geometry and textures indiscriminately.
4. Respect four typographic roles, common margins, consistent box alignment and progressive disclosure.
5. Keep shader/texture behind non-interactive ornament only, with CSS fallback and reduced-motion support.
6. Work in small, testable commits. Compare before/after screenshots and test the full search → detail → enquiry flow.

## Documents to read, in order

1. [`BRAND_DIRECTIONS.md`](BRAND_DIRECTIONS.md): exact v16 design rationale and material guardrails.
2. [`docs/01_PRODUCT_AND_BRAND_FOUNDATIONS.md`](docs/01_PRODUCT_AND_BRAND_FOUNDATIONS.md): brand positioning and explicit decisions.
3. [`docs/02_INTERACTION_AND_DATA_CONTRACT.md`](docs/02_INTERACTION_AND_DATA_CONTRACT.md): functionality, claims and URL state.
4. [`docs/03_RESPONSIVE_AND_VISUAL_QA.md`](docs/03_RESPONSIVE_AND_VISUAL_QA.md): QA matrix and acceptance tests.
5. [`docs/04_NEXT_ITERATIONS.md`](docs/04_NEXT_ITERATIONS.md): prioritized design and engineering work.
6. [`docs/05_CODEX_STARTER_PROMPT.md`](docs/05_CODEX_STARTER_PROMPT.md): handoff prompt for local Codex.

The `docs/archive-v11/` material records earlier product decisions. Its code references and stage labels may be old; **the files in this ZIP's `dist/` are the authoritative source**.
