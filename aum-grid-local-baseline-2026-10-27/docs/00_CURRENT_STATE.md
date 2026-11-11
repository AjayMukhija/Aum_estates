# 00 — Current State and Known Gaps

**Snapshot:** Study 06, source revision `6149ceecef893a2b2e880c86ac8169d15d3fd2b3`, exported 27 October 2026.

## Where we stand

| Layer | Implemented now | Important limitation / next step |
| --- | --- | --- |
| Brand baseline | White #FFFFFF, ink #151515, red #EF4037 | No final style-guide signoff or measured visitor preference |
| Architecture | International + Elevation switches | Different spatial treatments share most underlying page compositions |
| Dimensionality | Recessed International, offset Elevation, flat alternative | Needs cross-browser, touch, reduced-motion and performance validation |
| Fourth material hue | None, cobalt, bronze, verdigris | Experiment only; none is the current default and no fourth hue has been selected |
| Typography | IBM Plex Sans default, experimental library retained | Too many webfont families for a final production build |
| Homepage | Intro, red search panel, seven additional task tiles, visible tile CTAs | Information architecture currently gives too much equal visual weight to different tasks |
| Search/results | Purpose, location, type, budget, simple sorting, active chips and count | Small sample makes some controls misleading or unproductive; filter state not encoded in URL |
| Property detail | Property cards with outbound source and specific WhatsApp enquiry | No genuine per-property detail route or robust verification model |
| Location | Six locality/market entry cards | Several return zero sample matches; no supported urban-context pages |
| Advisory | WhatsApp and phone pathways for customer types | Search requirements do not fully carry into general advisor handoff |
| About/trust | Gurugram positioning, Ajay Mukhija role, office/contact | Needs richer verified local expertise, imagery and process explanation |
| Responsive | Desktop/tablet/mobile CSS breakpoints and a filter tray | Requires deliberately designed mobile compositions, not only breakpoint compression |
| Accessibility | Semantic buttons/forms, visible focus patterns, reduced motion rules | Mobile drawer focus containment/return and exhaustive keyboard audit incomplete |
| Tests | 3 Node control tests passing at export | No complete E2E, visual regression, accessibility or device suite |
| Publication | Previously published owner-private concept study | Local archive does not contain its hosting identity or credentials |

## Sample inventory: important facts about the prototype

The hard-coded `inventory` array in `dist/main.js` contains **nine demonstration records**. It is not a live feed and does not prove actual company availability.

Current purpose behavior:

- `buy`: residential sample records.
- `commercial`: the commercial sample record.
- `rent` and `land`: deliberately return no records, with an explanation and human-advice path.

Coverage does not include every location offered in the search/location index. The four broad filters are functional as JavaScript controls, but much of the data is unknown:

- Most prices are **Price on request**. Numeric price filters necessarily exclude unknown-price records.
- Type and intent choices are not currently dynamically constrained to relevant, populated facets.
- Sorting supports selected order and alphabetical name, not reliable price or recency comparison.
- The property-image link opens the original approved-inventory landing page rather than a property-specific destination.
- Images are linked to external assets, and some are described as representative.
- The enquiry action includes property name/reference when launched from a card, but not full prior search criteria from all other paths.

**Risk:** Treating this small prototype as a full property marketplace would create false “no availability” impressions. R0 must make empty and unknown states honest and useful.

## Known technical observations

1. The code is **buildless static HTML/CSS/JavaScript**; no install, backend or database required.
2. Multiple CSS files intentionally override earlier exploratory treatments. They work as a study, but make eventual maintenance and production promotion harder.
3. `refinement.css` uses a continuous page-gutter formula; it also adds persistent underlined tile actions.
4. Elevation datum lines use fixed `top` values for some horizontal rules; those can misalign as grid heights change.
5. Routes mostly use hash state (`#home`, `#browse`, `#locations`, `#advisor`, `#advisor-listing`, `#about`).
6. Design choices have URL parameters and local persistence; property filters have neither complete query serialization nor durable history state.
7. The mobile filter sheet uses fixed positioning. Opening focuses a filter, and Escape closes it, but the interaction does not implement a full modal focus cycle.
8. Studio preview hides study controls, but the UI remains a **prototype**; some route text still explicitly labels it a design demonstration.

## What has and hasn't been verified

**Verified at export:** the source working tree was clean; JS syntax checks and three control tests had passed in Study 06. The published private version was reported successful during the prior turn.

**Not independently verified in this package:** pixel-perfect rendering across Safari/Chrome/Firefox, real mobile tap/keyboard behavior, source image ownership/accuracy, current listing availability, live site analytics or end-user preference. Managed visual preview had previously been blocked by an environment issue, so do not claim screenshot-based QA that did not occur.

## R0 must produce

- A route-by-route task outcome inventory.
- Data/provenance ledger for every sample property and image.
- Mobile/desktop screenshots using an approved local test environment.
- A short list of contradictions between CTA labels and actual route outcomes.
- Focus, history, empty-state and URL-state test cases.
- Shared functional acceptance criteria for both designs.

**Status language to use:** Implemented, Prototype limitation, Hypothesis, Verified, Pending—not vague “done.”
