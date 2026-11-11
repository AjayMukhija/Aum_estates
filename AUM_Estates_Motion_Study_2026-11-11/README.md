# AUM Estates — Architectural motion and illustration study

**Status:** private local exploration, 11 November 2026. Nothing here is published, deployed, or committed to the production site. The live site remains `AUM_ESTATES_Website_For_Hostinger/` and is untouched by this folder.

**Baseline this study extends:** Datum (direction 01 of the v16 brand study), as adopted in `AUM_ESTATES_Website_For_Hostinger/assets/styles.css`. Datum is not being replaced or re-litigated. Palette, four type roles, 8px rhythm, 1560px content width, `clamp(20px, 6vw, 156px)` gutters and the Find → Understand → Decide → Trust → Character hierarchy are fixed inputs.

**Reference studied:** Divan Raj's animated mobile empty states (`x.com/desdivj/status/2119377174713229695`), per the written description supplied in the brief — minimal editorial layout, black-and-white geometric line illustration, isometric/technical-drawing influence, generous negative space, short choreographed sequences, direct next action. No illustration from that work is reproduced. What is borrowed is the *structural* idea: in a state that has no content, a drawing can carry the explanation, and the drawing's assembly can be the thing that earns the user's attention for two seconds while it explains why the screen is empty.

To run:

```sh
python3 -m http.server 8080 --directory dist
```

Then open <http://localhost:8080/>. No build step, no dependencies. `dist/assets/project-images` is a symlink into the production asset folder (read-only use); `dist/data/public_inventory.js` is a copy of the real 347-record public inventory taken on 11 November 2026.

A `.claude/launch.json` was added at the workspace root so the study can also be served on port 8099 from the editor's preview. It is the only file created outside this folder, and it touches nothing the site uses.

Expect roughly 25 image 404s in the console. They are not a fault in the study — they are audit observation F2, reproduced faithfully. The study handles them; production does not.

**Controls:** keys `0`–`4` switch concept, `S` runs every duration at 0.25× so timing can be compared by eye, `R` simulates `prefers-reduced-motion: reduce`, `P` replays everything. The viewport buttons reflow the real responsive layout through container queries rather than scaling a screenshot.

---

## Stage 1 — Audit

Everything in this section is an **observation of code as it exists today**, verified by reading the files named. Proposals start at Stage 2.

### 1.1 The complete motion inventory of the production site

There is almost nothing. Searching the shipped CSS and HTML for `@keyframes` returns zero results across every production page. The entire motion vocabulary is:

| # | Where | What moves | Spec | File |
| --- | --- | --- | --- | --- |
| 1 | Buttons, chips, links | `background`, `color`, `border-color` | `160ms ease` | `assets/styles.css:150` |
| 2 | Nav dropdown | `opacity`, `translateY(-4px → 0)`, `visibility` | `160ms ease` | `assets/styles.css:276` |
| 3 | Cards (`.cat`, `.benefit`, `.contact-card`) | `border-color` → ink | `160ms ease` | `assets/styles.css:602` |
| 4 | Focus ring | none (instant) | — | `assets/styles.css:77` |
| 5 | Pillar accordion (`<details>`) | nothing — instant snap | — | `index.html:467` |

There is one global token, `--transition: 160ms ease` (`assets/styles.css:49`). A `prefers-reduced-motion` block collapses all durations to `0.01ms !important` (`assets/styles.css:1092`), which is a correct defensive baseline but means any new motion must be authored so that **the no-motion end state is the correct state**, never relying on an animation to put an element in its final position.

The v16 study adds two more: `.category-chevron { transition: transform .2s }` and `.property-photo:hover img { transform: scale(1.025) }` (`dist/styles.css:155,165`), both correctly disabled under reduced motion.

**Reading of this:** the restraint is deliberate and it is not the problem. Datum earns its credibility by *not* animating. The problem is that there are four or five specific moments where the absence of any signal actively costs the user information, and those are the only places worth touching.

### 1.2 Where the absence of motion costs the user something

**Observation A — the property register changes silently.** `executeRender()` (`data/inventory-search.js:720`) is wired to `change` on every `<select>` (`:815`). Changing "Price Range" replaces `#search-results.innerHTML` wholesale. On a 1440px desktop the filter form sits above the register; after one scroll the controls are off-screen. The result count updates in `#result-count`, the filter summary in `#search-summary` — both silently. There is **no `aria-live` region anywhere in production** (verified: `aria-live` appears only in the older `concepts/aum-grid-study/`). A screen-reader user changing a filter is told nothing at all. A sighted user scrolled past the desk sees a different set of 300px cards with no indication that their action caused it. This is the single highest-value fix in the brief, and most of the value is accessibility, not motion.

**Observation B — the empty state is broken, not just plain.** `inventory-search.js:754` builds the no-results block with inline styles referencing `var(--bg-page)`, `var(--text-main)`, `var(--border-light)` and `var(--oxblood)`. **None of these custom properties exist in the Datum stylesheet.** `grep -c` over `assets/styles.css` returns 0 for all four. The result is a "Reset All Filters" button with no background and no border colour, and a WhatsApp link with no background at all — the primary action in the empty state renders as unstyled text on white. Across the production HTML and JS there are **74 such references to undefined variables** (24 `--text-main`, 21 `--border-light`, 19 `--gold-metallic`, 6 `--bg-page`, 4 `--oxblood`), all leftovers from the pre-Datum gold-on-dark theme. The dark-and-gold crest SVG is still in every page header, hidden by `.brand-crest-svg { display: none }` rather than removed, and the mobile drawer still carries inline `rgba(197,160,89,0.35)` gold borders (`properties/index.html:189`).

This matters for the brief because the empty state is interaction opportunity *A*, and it is currently the worst-rendered surface on the site. No illustration will fix a button with no background.

**Observation C — the empty state also loses the user's work.** The copy is a single paragraph of off-market advisory prose. It does not restate which filters produced zero results, does not say how many properties exist without them, and offers exactly two exits: "Reset All Filters" (discards everything the user entered) and a WhatsApp deep link. There is no way to relax one filter. Given the real data, this is a common state: 30 of 347 records are Rent, 3 are Lease, and only 11 records carry a `road_width` at all — so several plausible filter combinations land on zero.

**Observation D — `<details>` disclosure snaps.** The home page pillar accordion (`index.html:467`) and the v16 category disclosures open instantly. On the v16 index a category can contain dozens of tiles in a two-column grid; opening it displaces the entire page below the fold in one frame. The chevron is the only thing that transitions. This is interaction opportunity *B*, and here the case for motion is straightforward: a 200ms height resolution is not decoration, it is the difference between "the page moved" and "this section grew".

**Observation E — images pop.** `.result-photo` / `.cat-img` set `background-color: var(--field)` (`#eff0ec`) behind a `background-image` (`assets/styles.css:607`). Photos are applied as background images by `hydratePhotos()`, so there is no `load` event handling and no decode-aware reveal: the photo replaces flat grey in whatever frame it finishes decoding. With 347 records and 54 distinct images this is visible on every scroll.

**Observation F — honesty constraint on imagery.** Every one of the 347 records carries `image_label: "Representative Reference Photograph"`, and five of the 54 filenames are generic category stand-ins (`apartment.jpg`, `commercial.jpg`, `villa.jpg`, `builder-floor.jpg`, `plot-land-user.jpg`). **This rules out ceremonial image reveals.** A slow architectural mask that unveils a photograph implies the photograph is of the property. For this inventory it frequently is not. Any treatment of imagery here must reveal the *label with the photo*, not reveal the photo and then apologise in small type.

**Observation F2 — a third of the register has no photograph at all, and nothing says so.** Comparing every `image_file` against `assets/project-images/`: **121 of the 347 available records — 35% — name a file that is not there.** 18 distinct filenames are missing, and they include the generic fallbacks themselves: `commercial.jpg` (49 records), `builder-floor.jpg` (15), `villa.jpg` (11), `apartment.jpg` (9), plus real project images such as `elevate-by-hines.webp` (10) and `dlf-park-place.jpg` (8). `attachPhoto()` (`data/inventory-search.js:462`) assigns the URL to `style.backgroundImage` and never checks it, so a 404 is completely silent: the tile stays flat `#eff0ec` with the "Representative Reference Photograph" badge still sitting on top of an empty grey box, asserting a photograph that is not there.

This reframes interaction opportunity E entirely. The useful work on imagery is not a reveal animation for the 65% that load — it is a designed, honest state for the 35% that do not. Bench C in the study builds one and applies it to the live register, where it is visible as soon as the Commercial category is opened.

**Observation G — no saved properties exist in production.** Save/compare (max 3, `localStorage`, `aum-study-saved`) exists only in the v16 study (`dist/app.js:271,888`). Interaction opportunity *D* is therefore not a redesign of an empty state — it is designing a feature's first screen before the feature ships, which is the right order but means the empty state has to also teach what saving is for.

**Observation H — focus and the re-render.** `host.innerHTML = ...` destroys and recreates every node in the register. Today that is survivable because the register contains only links and buttons that nobody has focused mid-filter. It will stop being survivable the moment a save button lives inside a tile: filtering while a tile button has focus will drop focus to `<body>` silently. Any animated enter/exit sequence must be built around this, not on top of it.

### 1.3 Where motion would be decoration, and should be refused

- **The hero.** Datum's hero is one display statement plus a search desk. A drawn or assembling hero illustration would push the first usable control down and would be seen once per visit at most. The brief's constraint "preserve clear search and navigation before adding decoration" rules it out.
- **Scroll-linked anything.** No section-entrance reveals tied to scroll position. A property register is a list people scan up and down; animating rows on every intersection makes a list feel like a slideshow and makes `Cmd+F` hostile.
- **Prices and counts as odometers.** Interpolating a price from 0 to ₹7.4 Cr is a slot machine. Money does not count up. The result *count* is a different case (argued in Stage 2, Concept A) because it is a measurement of the user's own query, not a fact about a property.
- **A WebGL layer.** The brand doc already permits two shaders (Sun, Atlas) behind non-interactive ornament. I argue against shipping either, and Stage 3 includes a canvas bench specifically to make that argument visible rather than assert it. See Stage 4.

### 1.4 What the real data will and will not support

This constrains the art direction more than anything aesthetic. From `data/public_inventory.js`, 347 available records:

| Field | Coverage | Usable as visual data? |
| --- | --- | --- |
| `category` | 347/347 | Yes — 6 values, apartment 116 / plot 104 / builder-floor 59 / commercial 53 / villa 14 / farmhouse 1 |
| `corridor` | 347/347 | Yes — 8 values |
| `verification_status` | 347/347 | Yes — "Recently re-verified" 287, "Availability to be confirmed" 60 |
| `area_value` | 317/347 | Yes — and `area_sqft_norm` is already normalised upstream, so the 12 different `area_unit` spellings (`sq yd`, `Sq Yards`, `marla`, `acre`…) are a display problem, not a maths one |
| `facing` | **47/347** | No. 300 records have none |
| `road_width` | **11/347** | No. 336 records have none |
| `image_file` | 347/347 named, **226/347 present** | See observation F2 |

One correction to the obvious plan for `area_sqft_norm`: its dynamic range is brutal. Within plots alone it runs 702 → 108,900 sq ft, a factor of 155, and across the register the farmhouse is 87,120 against a 142 sq ft shop. A linear mark makes almost every record an invisible sliver. The study therefore scales **side ∝ √area, within category** — correct for an area-encoding mark anyway, since the eye reads the rectangle's area and not its edge — which brings the plot range down to a workable 12.5×.

**This kills the most obvious architectural idea.** A schematic site plan driven by orientation and approach road — which is exactly what an architectural visual language wants to draw — would be empty for 86% of the register, and the temptation to fill it would be a temptation to invent. Stage 2 Concept C is redirected accordingly: it draws *area to scale*, which 317 records support and which is a real orthographic convention, instead of a plot diagram the data cannot justify.

---

## Stage 2 — Art direction

Four concepts. Each is a different **mechanism**, not a different palette — all four live inside Datum's existing six colours and four type sizes, because a concept that needs a new colour to be distinguishable is not a motion concept. For each: the idea, the architectural reference, what it looks like, how it moves, what it is worth, and what is wrong with it.

Two of these (A and D) compose. B and C are mutually exclusive with each other in disclosure behaviour. That is stated per concept rather than offered as a matrix of combinations.

### Concept A — Setting Out

**Central idea.** Every change of information state is a *setting out*: the construction line arrives first, then content registers to it. The grid the layout already obeys becomes briefly visible at the moment it is doing work, then recedes to the hairline it always was.

**Architectural reference.** The setting-out drawing — the sheet a contractor works from, where gridlines, datums and dimension strings are the content and the building is implied. Specifically: gridline extensions past the building edge, the dimension string with its witness lines and tick extremities, the `±0.000` level datum.

**Visual composition.** No new elements. `--line` hairlines that already separate the register's rows gain a 1px `--accent` segment that travels the measured width of the content column during a state change. The result count is set as a dimension string: `|—— 42 properties ——|`, witness lines extending to the register's left and right boundaries. Nothing is added to a resting page.

**Typography and colour.** Entirely existing tokens. `--accent` (`#AB392C`) appears only on the *active* datum — the one line that corresponds to the change the user just caused — and reverts to `--line` (`#DFE3DF`) when it settles. This is the concept's one rule: red marks the thing that just changed, never more than one thing at a time.

**Illustration style.** Pure 1px stroke, orthogonal only, no curves, no fills, no isometry. For the empty state: a dimension string that draws itself across an empty field and annotates the absence — the width of the search, with nothing measured inside it.

**Animation behaviour.** `stroke-dashoffset` draw of the datum, 220ms, decelerating; then rows resolve `opacity 0 → 1` with `translateY(6px → 0)`, 28ms stagger capped at 8 items (224ms tail). The count interpolates over 180ms — admissible because it measures the user's query, not a property.

**UX value.** High, and mostly not aesthetic. The travelling datum *is* the "this is a new set" signal that Observation A says is missing, and it originates at the control the user touched and terminates at the register, which makes cause and effect legible. It is the cheapest concept to implement and the only one that improves the scrolled-past-the-desk case.

**Risks.** Visible construction lines read as a loading skeleton; if the draw is slow it manufactures the appearance of waiting for data that is already in memory. Stagger across a 40-row register would produce a 1.1s tail, which is why the cap is a hard rule and not a preference. The dimension-string count risks looking like a dashboard metric if it is set too large.

### Concept B — Section Cut

**Central idea.** Revealing information is cutting a section through it. A disclosure does not slide open; a cut line travels and the content behind it is revealed by a clip advancing with the line. Direction encodes depth: down is into detail, up is back out.

**Architectural reference.** The section cut — the line with its direction arrows and its `A—A` reference, and the convention that a cut exposes an interior you could not otherwise see. Poché as the thickened edge at the cut, not as a fill.

**Visual composition.** Each category header carries a small section marker. On open, the marker extends into a full-width cut line that travels down through the opening region; the tiles are revealed by a `clip-path` inset that tracks the line. A 2px `--accent` band sits exactly at the cut edge while it moves and disappears when it stops.

**Typography and colour.** Unchanged. The section reference (`A—A`, `B—B`) is set in the existing `--caption` label role, 13px, uppercase, `0.09em` — the same treatment as every other overline, which keeps it a label and not an ornament.

**Illustration style.** Minimal. This concept has almost no illustration; its expression is in the *reveal*, which is why it is weakest on the empty states (there is nothing to cut through) and strongest on disclosure.

**Animation behaviour.** `clip-path: inset(0 0 100% 0) → inset(0)` on the disclosure region, 240ms, synchronised with a 1px line translating the same distance. Critically: **the content does not move.** It is wiped into view in place. Collapse is the same wipe reversed, 180ms, faster than open because collapse needs no comprehension.

**UX value.** Good and narrow. It solves Observation D better than a height animation does, because a wipe reads as "this was always here, you are now seeing it" rather than "this is growing", which is the honest description of a disclosure. It does nothing for Observations A, B, C or G.

**Risks.** The real one: a `clip-path` wipe over text is also the house style of every cheap slide transition, and at any duration over ~250ms it stops reading as architectural and starts reading as PowerPoint. `clip-path` on a container with 20 images promotes a large composite layer; on a long register this is the most expensive of the four concepts. And a wipe cannot be interrupted gracefully — a user who toggles a category twice quickly sees a half-cut.

### Concept C — Scale & Schedule

**Central idea.** Draw the one number that is actually comparable. Area is the property attribute buyers cannot hold in their heads across a list — 142 sq yd against 2,400 sq ft against 14 marla — so draw each record's area to true relative scale, as a drafting scale figure, and let the register be readable as a set of sizes rather than a set of strings.

**Architectural reference.** The drawing's scale bar and the schedule of accommodation — the table on the sheet that lists every space and its area. Orthographic projection lines between views.

**Visual composition.** Each tile gains a small outlined rectangle whose area is proportional to the record's normalised `area_sqft_norm`, drawn against a faint reference rectangle shared by every tile in the register, so the comparison is between tiles rather than inside one. The rectangle is a *quantity*, explicitly not a footprint — it carries no orientation, no entrance, no road, and its proportions are fixed, not the plot's.

**Typography and colour.** The figure is labelled with the real unit as recorded, in the 13px label role. Where `area_value` is absent (30 of 347 records) the glyph is replaced by the words "area not published" — the absence is drawn too, which is the Trust rule applied to illustration.

**Illustration style.** One outlined rectangle, 1px `--line`, with the measured dimension in `--accent`. Nothing else. A drawn scale bar in the register header gives the reference.

**Animation behaviour.** Projection lines extend from the register's scale reference to each figure, 300ms, then the figure's rectangle draws its two measured edges. On filter change the figures re-scale to the new set's maximum, 220ms, which makes the re-scaling itself informative: the set got bigger or smaller.

**UX value.** The highest of the four, because it is the only one that adds information rather than clarifying a transition. It also directly serves "Understand" in the fixed hierarchy. **But** see Risks — and note that this is the concept the data audit already forced to retreat once, from site plan to scale figure.

**Risks.** Three, and they are serious. (1) The dynamic range, not the units: `area_sqft_norm` is already normalised upstream, but it spans 142 to 108,900 sq ft, so a linear mark is useless and even √-scaled marks must be computed per category or a shop vanishes next to a farmhouse. (2) 30 records publish no area at all, and in the built study they cluster — three of the first five apartment tiles read "area not published", which looks broken before it reads as honest. (3) Even an explicitly abstract rectangle, placed beside a property, invites reading as a footprint; the mitigation is fixed proportions and an unambiguous label, and the mitigation may not be sufficient. This is the concept to user-test before building, not after.

### Concept D — Raking Light

**Central idea.** Nothing moves; only light does. One light direction is shared by the whole page, and interaction changes what that light falls on. Depth is expressed as a 1px lit edge and a 1px shadow gap — the two things a real architectural detail actually shows — and never as a drop shadow or a scale transform.

**Architectural reference.** Raking-light photography of a facade, where a 10mm reveal reads as a black line and a 10mm nib reads as a white one. The *Schattennut* — the shadow gap used to separate two materials without a trim.

**Visual composition.** No new elements and no illustration at all. A hovered or focused tile gains a 1px highlight on its top edge and a 1px darker hairline on its bottom, as though the register were a stack of slabs lit from above-left. Active filter chips sit 1px proud; inactive ones sit flush.

**Typography and colour.** Datum's six colours exactly. The "highlight" is `--paper` and the "shadow" is `--line` darkened by nothing more than existing tokens allow. Any treatment that needs a new grey has left the system.

**Illustration style.** None. This is a material system, not an illustration system — which is why it cannot answer interaction opportunities A or D on its own, and must be paired.

**Animation behaviour.** 160ms on edge colour only, matching the existing feedback token. No transform, no shadow, no blur. Under `prefers-reduced-motion` the lit state still applies instantly, because it conveys which row has focus.

**UX value.** Low but real: it gives Datum's extremely flat register a legible hover and focus state, which it currently expresses only as a border going from `#DFE3DF` to ink. It costs nothing and it is the only concept that improves keyboard focus visibility on tiles.

**Risks.** The line between "material relief" and the faux-3D the baseline explicitly rejected is one gradient wide. The moment a highlight becomes a gradient or a shadow gains a blur radius, this concept has become the thing we refused. It also does not survive printing or forced-colours mode, so it can never be the only indicator of state. And the sun-path version of this idea — driving the light angle from Gurgaon's real solar position — is where I would stop: it is unverifiable by the user, decorative in effect, and it invites a factual reading of something that is not a fact about the property.

---

## Stage 3 — The interactive study

Built in `dist/`. See the running page for: a concept switcher across all four plus a no-motion baseline, a 0.25× slow-motion control for comparing timing, a reduced-motion simulator, the live Property Index on real inventory, and four benches (empty results, saved-properties empty state, image reveal, ornament). The motion specification table at the bottom of the page is generated from the live CSS custom properties, so it cannot drift from what you are actually seeing.

## Stage 4 — Evaluation

See `EVALUATION.md`, written after the study was built and tested rather than alongside the art direction.
