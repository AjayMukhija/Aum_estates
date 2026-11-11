# AUM ESTATES — Architectural Grid Experiment Roadmap

**Handoff for a new conversation · 27 October 2026 · Planning version 1.0**

**Purpose:** Evolve and compare two distinct grid-led visual and product experiences for a Gurugram real estate consultancy: **International Style** and **Architectural Elevation**. Ship controlled increments to an isolated, private concept study, test them with credible tasks, and eventually decide what—if anything—should be promoted into a production rebuild.

**Current study:** https://aum-architectural-grid-study.udiboy98.chatgpt.site/

**Direct review links**

- International: https://aum-architectural-grid-study.udiboy98.chatgpt.site/?architecture=international&presentation=1
- Elevation: https://aum-architectural-grid-study.udiboy98.chatgpt.site/?architecture=elevation&presentation=1

**Source context:** The existing static study has `dist/index.html`, `main.js`, `study.js`, `architecture.js`, `refinement.js`, and layered stylesheets. Its previous three automated tests cover the architectural controls, visitor mode and legacy links—not the full customer journeys.

> **Scope and safety:** This is a design/prototype program, not authorization to edit `aumestates.com`, replace real inventory, push to GitHub, or publish a public production rebuild. Preserve the existing private study and its URL/audience. Changes to the actual company website require a separate decision. No fabricated listings, dimensions, floor plans, photographs, prices, statistics, testimonials or transaction claims.

---

## 1. The product thesis

The site should feel like a **serious, approachable urban property advisory practice**. Its personality should come from architectural composition, precise language, verified local knowledge and confident interactions—not generic luxury tropes, decorative skyscraper renders, stock counters or indiscriminate animation.

### Three customer intentions

1. **I know my requirements.** Help me find an appropriate property, quickly.
2. **I'm exploring.** Help me understand property types, districts and available opportunities.
3. **I want advice.** Connect me to a knowledgeable person without making me repeat everything.

These journeys are not equally weighted. Search is the principal entry point; curated browsing is the secondary path; advice must remain prominent because this is a consultancy, not a comprehensive listings marketplace.

### What each architecture should mean

| Dimension | International Style | Architectural Elevation |
| --- | --- | --- |
| Central metaphor | Occupied building façade: frame, mullions, bays and recessed surfaces | Architectural drawing: datums, sections, orthographic layers and measured annotations |
| Emotional register | Stable, metropolitan, authoritative, premium without luxury clichés | Precise, investigative, technically minded, editorial and locally knowledgeable |
| Native advantage | High trust, scanning efficiency, extensible multi-page commercial system | Strong differentiation, excellent information hierarchy and local/property storytelling |
| Native danger | Becoming a generic bordered dashboard, with too many equally weighted boxes | Becoming a CAD-themed gimmick with illegible microtype and meaningless guide lines |
| Treatment of depth | Recession *within* the frame; no floating cards | Small orthographic offsets between planes; no perspective tilt |
| Default color | White #FFFFFF, Ink #151515, Red #EF4037 | The same colors to ensure fair comparison |
| Optional fourth | Bronze #956C35, tested only in material details | Cobalt #3154A5, tested only in reference details |
| Production prior | Leading foundation candidate, **not predetermined winner** | Distinct challenger, **not reduced to a decorative variant** |

### Unchanged design convictions

- White base, near-black type, one strong red expression. Four colors are optional, not compulsory.
- A restrained type system: **micro 12px / body 14–16px / section 24px / display 40–52px** as a starting scale. Prefer IBM Plex Sans, with controlled mono annotations.
- Broad, smoothly responsive exterior margins and generous whitespace. Avoid a visible border around every incidental object.
- Grid and architectural rhythm must reach search, results, detail, locations, contact, About and footer—not merely the landing page.
- Actions are discoverable without hover: explicit underlined text, clear states, keyboard focus. Use arrows consistently: right arrows for internal navigation; diagonal arrows when leaving the site or starting a distinct external contact action.
- No WebGL showpiece or scroll-jacking unless it has a demonstrated user benefit.
- Functional and accessible on touch, keyboard, narrow displays, reduced-motion settings and slow connections.

---

## 2. Baseline: observations versus hypotheses

### Confirmed in the current prototype source

1. The homepage contains an expansive search panel and **seven other action tiles**, giving eight task entry points.
2. Search accepts purpose and location; results allow intent, location, property type, budget and a simple name sort.
3. The **Rent** and **Land** intents intentionally return no sample listings. This is not a statement about AUM ESTATES' actual inventory.
4. Several listed localities do not match the small curated sample, causing an empty-results screen when selected.
5. Most property prices are unknown; the sample does not support meaningful numeric price comparison.
6. Property-card image links open a **generic** original-inventory page, rather than a property-specific details view.
7. Enquiries use WhatsApp; property-card enquiries preserve the item name, but advice launched from a filtered search does not preserve all selected search context.
8. Browser URLs record the current view and the design settings, but **not the full filter state**.
9. Mobile filters open in a fixed overlay, but the current interaction does not fully manage focus containment and focus return.
10. The Elevation guide lines use fixed pixel placement; those reference lines can drift under content or typography changes.
11. Both styles affect other pages through CSS, but most content compositions remain structurally identical.
12. The prototype loads numerous exploratory font families and layers several successive stylesheets, appropriate for a study but not a final implementation.

### Hypotheses requiring visual/user validation

- Eight near-equal homepage destinations cause unnecessary choice cost.
- A more informative property card will increase visitor confidence and enquiry quality.
- International Style will score higher on immediate professional trust and scanning speed.
- Architectural Elevation will score higher on distinctiveness and on comprehension of rich property/location data.
- Small architectural depth cues can make the interface feel authored without compromising speed.
- A fourth color may be useful for material richness, but could dilute the signature red and increase visual noise.

**Do not describe hypotheses as established user findings.** Confirm them with testing.

---

## 3. How the experiment must be organized

### A. Shared product, two visual treatments

The two directions share:

- Content model, property data and provenance rules.
- Search logic, filters and routing semantics.
- Number and names of available tasks.
- Accessibility rules and performance budgets.
- Journey completion criteria and error/empty states.

They may deliberately differ in:

- Geometry, proportion, grouping, whitespace distribution and line weight.
- Visual relation between modules.
- Typography hierarchy within a shared readable scale.
- Treatment of photos, labels and information panels.
- Recessed versus orthographic interaction feedback.
- Editorial style of location/property-detail layouts—provided the underlying facts and tasks remain available in both.

**Critical experimental rule:** When measuring architectural preference or task performance, do not simultaneously give one concept a better data set, richer copy, faster code or superior features. Ship *paired* versions.

### B. Two kinds of evaluation

1. **Product evaluation:** Can visitors find something appropriate, understand uncertainty, evaluate a property, recover from sparse inventory and contact the practice?
2. **Art-direction evaluation:** Does the visual system convey credible local expertise and modern urban character? Is it memorable, consistent and disciplined without distracting from the task?

Do not choose a winner on a single screenshot or aesthetic vote. Do not confuse the performance of a limited inventory demo with actual business demand.

### C. One paired release per phase

Each release should contain:

- The International implementation for that phase.
- The Elevation implementation for the *same* phase.
- One baseline Red / White / Ink configuration of each, with depth choices clearly identified.
- A brief changelog and tradeoff log.
- Desktop, tablet and mobile captures of the key route states.
- Interaction and accessibility checks.
- A short user-test protocol with observations and explicit next decisions.

Use labels **R0 through R6**. Within the work, label direction tasks **I1–I6** and **E1–E6**.

### D. Avoid the combinatorial palette trap

With two architectures, four fourth-color choices, two depth choices and numerous font/palette variants, the study exposes far too many combinations for meaningful simultaneous testing.

Test **Red / White / Ink, IBM Plex, no fourth color, controlled relief** first. Only after the direction is understandable should material and alternative type experiments be tested one variable at a time. Preserve the older color/type laboratory, but don't let it drive the new study.

---

## 4. Shared foundation — R0: Evidence, contracts and baseline tests

**Goal:** Make future comparisons trustworthy. This work benefits both directions and precedes their next visual releases.

### Ship

1. **Route/task map.** Document every current action: search; buy, rent, commercial and land; locations; owner listing; advisor; about; source inventory. Mark destinations, whether each has demo data and what happens on failure.
2. **Verified property manifest.** For each record, track: source URL, owner/approval status, photo provenance, correct image-to-property association, locality, purpose, type, known area, known configuration, known price, last verified timestamp (only if actually verified) and explicit unknown fields.
3. **State model.** Establish stable intent/location/type/budget fields; meaningful optional values; robust URL serialization; restoration after navigation; clear distinction between filters supported by prototype data and aspirational production requirements.
4. **Visitor-mode contract.** Clearly distinguish actual visitor UI from experimental controls. Keep the prototype disclosure honest, but prevent lab chrome from distorting normal composition.
5. **Testable fixtures.** Preserve the small public sample; where coverage is absent, use honest enquiry-oriented states. Never populate unknown categories with invented properties.
6. **Shared semantic components.** Plan interface primitives such as SearchPanel, TaskTile, PropertyCard, FilterTray, SectionIndex, LocationTile, EnquiryAction and EmptyState. CSS may remain static during the study; the principle is shared meaning.
7. **Baseline captures.** Desktop wide (e.g., 1440), laptop (e.g., 1280), tablet (768), mobile (390 and a narrow ~320–360 width); both styles; home, results, empty, locations, advice and About.
8. **Baseline tests.** Automate route changes, browser history, deep links, valid/invalid query settings, filter clearing, empty states, keyboard focus, mobile filter open/close, and contact-link text.

### Tradeoffs

- A cleanup phase postpones dramatic visible change, but avoids building elaborate architecture on unreliable data and routing.
- An intentionally small sample cannot establish a marketplace-grade browse experience. This is acceptable for art-direction prototyping if its limitations are explicit.
- Do **not** integrate a live backend solely to make this study look populated.

### Gate R0

- Zero knowingly fabricated fields or visual representations.
- Every visible task has a coherent outcome, including no-data situations.
- The same customer path can be exercised in both architecture modes.
- A baseline capture and test log exists.
- Production AUM ESTATES remains unchanged; private study permissions remain private.

---

## 5. INTERNATIONAL STYLE — separate phase plan

### I1 / R1 — Façade hierarchy and the first five seconds

**Design question:** Can the home screen communicate a credible property consultancy and three clear customer intentions without reading every tile?

**Build**

1. Keep a bold red search anchor, but make its relationship to the browsing bays unmistakable. Search is the primary bay; four browse purposes form a secondary band; location/owner/advice form the service band.
2. Test **two density variants within International only**: (A) current eight-entry façade refined through size and grouping, (B) a quieter façade with fewer visible tasks and secondary routes disclosed beneath the principal actions. Never hide core routes permanently.
3. Align the hero headline, search boundary, tile seams and below-grid information on a consistent column model. Use one or two dominant structural seams; avoid outlining each incidental text block.
4. Bring a short, factual consultancy descriptor into the first visual field: Gurugram advisory context, identified team/person if already verified. Replace vague marketing copy with a specific but sober proposition.
5. Use real hierarchy: ink headlines, red search field, white secondary bays, clear labels, visible underlined tile actions. Reserve mono for indexing.
6. Give the header precise behavior. “Properties” should not silently mean only “Buy”; use an intelligible all-property/category destination or accurate label. Distinguish internal from off-site links.
7. Responsive design must be authored, not merely auto-wrapped. On mobile: primary search, compact browse band, then service/advice links. Check tile copy at narrow widths.

**Why:** International Style is convincing when proportion and repetition establish order. The current equal-card impression can resemble an enterprise dashboard rather than a property consultancy.

**Tradeoffs:** Reducing visible choices may improve first-click clarity but could make secondary services harder to discover. A strong frame creates authority but risks coldness; whitespace and restrained photographs balance it.

**Test**

- Five-second test: identify business, city and main action without scrolling.
- First click: “Find a 3 BHK to buy,” “List my apartment,” “I don't know which Gurugram area suits me.”
- Scan at 390px and 320–360px widths; no unreadable narrow bays or false underlined links.
- Side-by-side judgement: repeated structural rhythm versus arbitrary bordered cards.

**Exit:** The hierarchy can be explained in three levels; no action depends on hover; users reliably select the appropriate starting route; mobile composition is intentional.

### I2 / R2 — Structural continuity into results and filters

**Design question:** Does the façade logic make a dense result list easier to scan?

**Build**

1. Construct results as a continuous structural section: one clearly bounded filter rail, a result count, applied-filter row and aligned property bays.
2. Preserve generous horizontal rhythm but avoid thick borders on every property card. Test light separators versus framed property rows.
3. Upgrade filters to be intent-sensitive; remove meaningless combinations. Render only supported demo facets; show unrepresented intents as a purposeful guidance/enquiry path.
4. Preserve filters and sort in the URL, back button and copied deep links. Restore scroll position when returning from a property.
5. On mobile, turn filters into a purposeful tray with draft/apply/cancel semantics, visible count, focus containment and focus return. Keep reset distinct from close.
6. Provide comparison-friendly metadata: locality, actual property type, verified configuration, area and price/unknown state. Sort only by fields genuinely available.
7. Distinguish “0 in this sample” from “nothing available in the real market” in restrained copy.

**Why:** A consultancy must help compare options without falsely presenting itself as a comprehensive, real-time portal. The structural grid can reinforce trust through predictable scanning.

**Tradeoffs:** Persistent filter rails consume space. Full card borders may feel architecturally consistent but reduce density and make photographs smaller. More filter fields are not better if data is sparse.

**Test**

- Find a known Sector 61 example and narrow by relevant type.
- Remove one filter, then restore it via browser back.
- Send a filtered URL to another session.
- Select Rent and Land and assess whether the next action makes sense.
- Test mobile filter focus, scroll locking and results count.

**Exit:** No misleading dead-end category, filter chips map to actual state, shareable results reproduce the same view, and source/unknown states are understandable.

### I3 / R3 — Property detail as an occupied architectural bay

**Design question:** Can a property feel credible and desirable without stylized or misleading representation?

**Build**

1. Create **one exemplary property detail template** using verified fields. It may be populated for only one or two approved records initially.
2. Lead with authentic property-specific photography when available, clean unaltered color and a consistent aspect ratio. Explicitly label representative imagery or omit it.
3. Information hierarchy: address/locality, category, current availability caveat, price status, configuration, area, floor/possession or other truly verified facts, then description.
4. Use a façade frame with one calm photography bay and one decision-information bay. Avoid an edge around every stat.
5. Provide property-specific source provenance, an obvious enquiry CTA and a clear back-to-results path that retains the prior selection.
6. Build a small comparison mechanism *only if it has enough trustworthy fields*. Otherwise prioritize enquiry and saving/share links.
7. Pass property name and reference to WhatsApp, plus selected criteria where appropriate, with editable language.

**Why:** Architectural personality must serve the high-trust moment where a visitor evaluates an individual property.

**Tradeoffs:** A polished detail template can highlight how little verified data exists. That is useful feedback, not a reason to invent specifications. Full-bleed imagery may feel premium but should not dominate crucial decision details.

**Test:** Explain in ten seconds what is known, what remains unconfirmed, where the property is and how to enquire. Navigate back without losing filters. Confirm the image actually belongs to the shown property.

**Exit:** No fictitious attributes, no generic source link masquerading as a property detail, and an enquiry containing correct context.

### I4 / R4 — Metropolitan atlas, advisory credibility and footer

**Design question:** Can International Style become a recognizable *Gurugram-informed practice*, not a generic property website?

**Build**

1. Create one verified locality profile (a real Gurugram neighbourhood), with geographic context, genuine properties when available and an honest no-match pathway.
2. Treat the location screen like an urban atlas: confident image, crisp map, compact editorial text, distinct district label and index.
3. Add useful facts—access, connections, built form, lifestyle/commercial context—only after checking their sources and dates. Avoid invented “average price” and investment projections.
4. Enrich About with confirmed practice information, office details and authentic team/office photographs if approved. Explain how the advisory process works.
5. Distinguish buyer/tenant/owner/business enquiry entry points, without building a bureaucratic questionnaire. Preserve journey context in enquiry messages.
6. Restructure the footer as a deliberate architectural base: compact company and contact information, purposeful navigation and legible legal/source details.

**Tradeoffs:** Local insight is labour-intensive to verify and maintain. An atlas with fake precision undermines trust; a lean, dated and sourced profile is better.

**Test:** Choose an area, explain its relevance, find a related example or enquire, and locate real contact information. Ask whether the site feels like a local advisory rather than a listing aggregator.

**Exit:** A locality page and About/Advice route genuinely help with a decision and pass an independent fact/source review.

### I5 / R5 — Controlled façade depth and optional material

**Design question:** Can dimensional cues reinforce the architecture without adding unnecessary interaction cost?

**Build**

1. Keep the load-bearing frame stationary. Use shallow inset surfaces and light shifts only inside relevant panels; do not translate entire cards into space.
2. Test **flat versus recessed**, with identical content and typography.
3. Test the no-fourth-color baseline against one **bronze-detail** variant. Bronze appears on slender joints, a small annotation or an occasional structural marker—not body text, global buttons or another action color.
4. Make the material cue visible in small doses even without hovering. Preserve clear keyboard focus separate from the decorative material.
5. Introduce micro-animation only when it communicates an action state or information reveal. Reduced-motion users receive equivalent clarity.
6. Remove residual stock-like glass/gradient effects if they start to look like decorative UI wallpaper.

**Tradeoffs:** The more literal the building metaphor, the less flexible the UI becomes. A trace of depth is often more persuasive than a full trompe-l'œil effect.

**Test:** Blind comparison of flat/recessed for clarity, professionalism and affordance; touch and keyboard behavior; layout shift and frame-performance checks.

**Exit:** Depth helps or is neutral to task completion; fourth color does not change CTA meaning; no hover-only critical content.

### I6 / R6 — Final International candidate

- Consolidate tokens and override layers.
- Audit all routes at target viewports and 200% zoom.
- Verify contrast, labels, controls, focus indicators, reduced motion, image provenance, URL state, and external-link communication.
- Keep only an approved font subset for a production candidate.
- Collect final participant results and engineering-cost notes.
- Produce a concise identity guide: frame/line weights, bay relationships, spacing, typography, photos, red rules, optional bronze rules, do/don't examples.

**Gate:** Ready to judge as a cohesive product proposal—not just an attractive homepage.

---

## 6. ARCHITECTURAL ELEVATION — separate phase plan

### E1 / R1 — A real drawing grammar, not decorative CAD

**Design question:** Can an elevation-inspired homepage feel distinct *and* effortless to use?

**Build**

1. Replace arbitrary fixed-position datum lines with lines attached to grid boundaries and alignment relationships. Reference marks must survive text reflow and viewport changes.
2. Define a small, rational drawing vocabulary: primary reference axis, section number, boundary, thin registration mark and optional dimension line. Give each a purpose.
3. Place the search panel as the primary measured object; browse and advice modules sit on a visibly related underlying grid. Preserve the same tasks and comparable wording as International Style.
4. Reduce mono typography to indexes, numeric identifiers and secondary annotations. Main calls to action and headings stay in a highly readable sans face.
5. Add deliberate breathing room between drawing sheets. Avoid thin red strokes everywhere; reserve one red structural accent for the main search/task hierarchy.
6. For mobile, recompose as a vertical set of related sheets rather than squeezing a desktop elevation into two tiny columns. Reference labels must not consume the whole available width.

**Why:** The style should suggest an architect's capacity to think clearly, not a software engineer's imitation of a blueprint.

**Tradeoffs:** More whitespace and rules may reduce above-the-fold density. Too much annotation looks technical and cold; too little makes the mode indistinguishable from International.

**Test:** Five-second first-click tasks; line-alignment checks under all supported fonts; 390px, narrow mobile and 200% zoom; users must describe content rather than struggle with visual notation.

**Exit:** Every visible drawing mark has a reason; no clipped labels or drifting lines; equivalent task clarity to the other direction.

### E2 / R2 — Search as a measured specification, results as an index

**Design question:** Does an information-rich, drawing-like treatment help people specify and compare requirements?

**Build**

1. Treat the search form as a concise requirement sheet—not an ornamental technical dashboard. Separate purpose, place and variable attributes clearly.
2. Use structured section labels like **01 / PURPOSE**, **02 / LOCATION**, **03 / REQUIREMENTS** only where they assist scanning.
3. Render results as an editorial index with a strong line between property image, verified metadata and enquiry path.
4. Preserve the same real filter semantics, URL state, empty-state behavior and accessible mobile tray used by International Style.
5. Consider compact numeric/technical metadata on cards, but never compress names or descriptions so much that scan time increases.
6. Resist extra faceted filters until the metadata is complete enough to support them.

**Why:** Elevation's natural strength is organizing complex information. This phase tests whether that strength translates into property discovery.

**Tradeoffs:** Denser specifications can help analytical buyers but overwhelm casual explorers. The same data may need an accessible summary before the full technical detail.

**Test:** Explain and alter one set of requirements; locate a matching example; share exact filters; recover from zero results; compare two cards without visiting each.

**Exit:** Users do not need to decode architectural terminology to search, and relevant facts remain as quickly identifiable as in International.

### E3 / R3 — The property dossier

**Design question:** Can the detail page feel like a trustworthy, comprehensible property record?

**Build**

1. Create a detail composition with an image panel, indexed verified facts and a fixed enquiry anchor.
2. Use orthographic alignment, section labels and very restrained registration cues; reserve actual diagrams for verified, licensed floor plans or site plans.
3. Never generate a floor plan from a marketing description and imply it is the property's true geometry.
4. Add “known / pending confirmation” treatment for uncertain values. Distinguish property area, plot area, covered area, etc., with correct terminology when verified.
5. Provide property-specific source provenance, original references and contact context; preserve search state.
6. Consider a photograph-versus-plan tab **only if** approved corresponding assets exist. Otherwise retain a clean photo + specification view.
7. Keep the visual hierarchy suitable for a non-architectural visitor: property name and location first, then essential facts, then optional detail.

**Tradeoffs:** This could be the most memorable page in the whole concept, but unverified diagram-like decoration could create dangerous false precision.

**Test:** Can someone understand the actual property, differentiate sourced data from assumptions, and make an informed enquiry? Can someone unfamiliar with plans still navigate it?

**Exit:** No deceptive diagram or measurement, clean focus/navigation order, matched property imagery, context-preserving enquiry.

### E4 / R4 — Neighbourhood survey sheets and advisory process

**Design question:** Does the drawing metaphor clarify Gurugram's urban geography and the consultancy's expertise?

**Build**

1. Create one sourced location survey sheet: a **real map or accurate schematic**, area description, verified connectivity, housing/commercial character, related listings or an honest enquiry path.
2. Use indexed sections such as **Context / Access / Property Types / Discuss the Area**. Reference marks should connect text to actual geographic or property information.
3. Make the user's task primary: exploring an area, comparing options, or speaking to the practice. Do not bury actions beneath diagram labels.
4. Show the real human team/office and explain how enquiries, shortlisting and site visits work if the practice confirms that process.
5. Use a restrained architectural footer and contact form/message pattern, without fictional certificates, badges or client statistics.

**Tradeoffs:** Maps and diagrams can be seductive; verification and comprehension matter more than graphical flourish. Locals may know popular district names differently from official boundaries—label scopes honestly.

**Test:** A newcomer can locate a district, understand why it may fit and initiate a relevant enquiry. A local can recognize that the representation is factually and geographically credible.

**Exit:** Location and advisory pages feel like the same designed system as the homepage, with no invented urban data.

### E5 / R5 — Orthographic relief and drafting-blue option

**Design question:** Do spatial layers provide helpful information feedback or merely decorate the screen?

**Build**

1. Keep the front plane fixed; reveal depth through a small parallel offset and supporting shadow, never a tilted/perspective card.
2. Test **flat drawing versus 2.5-D offset** under identical content.
3. Compare baseline three colors against **one cobalt detail** variant. Cobalt belongs to indexes, alignment references and discrete material/drawing notes; red still marks the primary action.
4. Use an offset to indicate focus/selection, not to make every tile dance. Consider an opening sheet revealing subordinate verified information only when the action is explicit.
5. Design equivalent states for pointer, touch, keyboard and reduced motion. Keep content available even with effects disabled.
6. Remove gratuitous coordinates, rulers and grid noise that do not correspond to information.

**Tradeoffs:** Distinctiveness is the advantage, but over-animated drawing cards risk suggesting a museum exhibit instead of a reliable service. A little restraint improves credibility.

**Test:** Comprehension and focus detection with depth on/off; touch behavior; frame and layout stability; preference assessed only after task performance.

**Exit:** Motion reinforces state, the fourth hue remains subordinate, and the layout works without any effect.

### E6 / R6 — Final Elevation candidate

- Replace fragile pixel-based datum positioning with grid-relative lines.
- Normalize labels, spacing, rules and responsive reflow.
- Audit every route, keyboard cycle, filter tray, focus-return behavior and touch alternative.
- Simplify the type/font payload and consolidate CSS.
- Produce a drawing-language style guide with examples of meaningful versus decorative marks.
- Capture final usability and engineering-cost notes alongside International.

**Gate:** The drawing metaphor survives contact with real content, dense listings, mobile layouts and low-vision users.

---

## 7. Paired shipping calendar and dependencies

This is an **order of work**, not an invented estimate of calendar days. Release in this sequence so both concepts stay comparable.

| Paired release | International | Elevation | Shared functional contract | Evidence required before next |
| --- | --- | --- | --- | --- |
| **R0 / Baseline** | Existing façade frozen | Existing drawing frozen | Verified sample, journey map, URL/state contract, QA baseline | Source ledger, captures, reproducible tasks |
| **R1 / First impression** | I1: façade hierarchy and homepage | E1: semantic drawing hierarchy and homepage | Same available actions and comparable copy | Five-second and first-click findings; mobile layout check |
| **R2 / Discovery** | I2: structural results | E2: requirement sheet/results index | Contextual facets, honest empty states, URL persistence, mobile filter accessibility | Complete search/filter/back/share journeys |
| **R3 / Evaluation** | I3: framed property detail | E3: property dossier | Same verified property facts, photographs and enquiries | Known-versus-unknown comprehension; source verification |
| **R4 / Locality + trust** | I4: urban atlas/advice | E4: area survey/advice | Same sourced locality and consultancy facts | Area exploration and consultation tasks |
| **R5 / Expression** | I5: recess/bronze | E5: orthographic offset/cobalt | Same usable content and no-hover semantics | Flat-vs-relief, 3-vs-4 color preference + UX testing |
| **R6 / Decision** | I6: production-ready candidate | E6: production-ready candidate | Accessibility, performance, responsiveness and route parity | Comparative study, tradeoff register and recommendation |

**Important:** Mobile/accessibility fixes are not saved for R6. Every earlier release must meet basic mobile and keyboard acceptance; R6 is a comprehensive regression and hardening pass.

### What not to build in the early phases

- No live feed or CRM integration merely to populate an art-direction study.
- No invented market-price charts, returns or neighbourhood scores.
- No AI-generated property photos or unverified floor plans.
- No heavy 3-D library, animated skyline, custom cursor or background WebGL.
- No multi-step seller funnel until the real practice confirms its qualification requirements.
- No 96-way test matrix combining architecture, type, palette, fourth color and motion.

---

## 8. Test protocol: make results falsifiable

### Participant roles

Recruit a small, diverse **qualitative** set (for example six to ten people, deliberately mixed) for each major milestone:

- At least two active or recent property seekers.
- At least one prospective tenant.
- At least one owner/landlord or person familiar with listing property.
- Some participants familiar with Gurugram and some less familiar.
- A mix of desktop and mobile behavior, and at least one keyboard-focused audit performed independently.

Do not infer statistically significant conversion lifts from such a small sample. For later quantitative decisions, use real traffic and a properly powered experiment rather than over-reading prototype clicks.

### Comparable realistic tasks

1. **Discovery:** “You're looking to buy a three-bedroom apartment in Gurugram. Where would you start?”
2. **Location-specific:** “Find what you can about a property in Sector 61.”
3. **Sparse inventory:** “You want to rent in Nirvana Country. What does the website let you do next?”
4. **Unrepresented locality:** “Explore Golf Course Road even if no sample property matches.”
5. **Commercial:** “Look for a business space and find how to discuss a requirement.”
6. **Owner:** “You have a property to lease. Start the process.”
7. **Information:** “Determine what is known and unknown about one property before enquiring.”
8. **Filter control:** “Change location/type, remove one filter, then return to this same set.”
9. **Sharing:** “Copy the exact search state for a family member or colleague.”
10. **Contact:** “Find a real phone/WhatsApp route and check that your requirement is carried over.”

Only assign tasks for which the study can legitimately show an outcome. A successful unsupported-inventory task means discovering the limitation and reaching a good consultation path—not seeing a fabricated listing.

### What to record

For each participant/task:

- First action and whether it matches a plausible intended route.
- Task completion: succeeded, partially succeeded, failed, or data-limited.
- Time and steps to meaningful outcome.
- Wrong turns, repeated reading, backtracking, misread labels.
- Whether the participant noticed uncertainty, source provenance and the intended enquiry.
- Confidence in contacting this consultancy (explain *why*).
- Perceived professionalism and distinctiveness, separately rated after the task.
- Verbatim confusion points and suggested improvements.
- Device, viewport, architecture, data state and motion/color variant.

Do not infer intent from a single click without follow-up. Collect observations before soliciting preferences so aesthetics don't prime the usability assessment.

### Decision gates

- **R1:** Can visitors explain the business and select an appropriate path with little instruction?
- **R2:** Can they filter, recover from no results and retain/share their state without confusion?
- **R3:** Can they judge a property with clear provenance and initiate a relevant enquiry?
- **R4:** Do location/trust content improve knowledge and credibility?
- **R5:** Does depth/fourth color improve expression without harming usability, contrast or performance?
- **R6:** Which candidate has the best combination of clarity, trust, urban personality, accessibility, extensibility and upkeep cost?

For each gate, pre-register what would count as a meaningful problem, then inspect findings. Don't invent a success percentage after seeing the results. Repeat comparative tasks in counterbalanced architecture order to reduce first-exposure bias.

### QA and accessibility protocol

- Keyboard-only journey with visible focus on all controls.
- Mobile filter tray: focus enters, is contained appropriately, Escape/cancel close it, focus returns to the opener.
- Click/tap target sizing and spacing, especially for small studio controls and filter chips.
- 320–390px mobile, tablet, common laptops, high zoom and text reflow.
- Color-contrast checks for text and focus states; test red, white, ink and any optional fourth accent.
- Reduced-motion and hover-none modes.
- Browser back/forward, copied URL, hard reload, empty results and missing image.
- Image aspect ratios, no distortions or misleading stand-ins.
- Basic Lighthouse/Web Vitals lab observation. A private study may lack representative field traffic; do not claim field performance.
- All critical functions require working labels and clear error/recovery states.

WCAG 2.2 AA should be the accessibility target for any future production candidate. Use W3C guidance for target size, focus indicators and dialog handling.

---

## 9. The comparison framework

Use a scorecard, but keep raw evidence and engineering tradeoffs beside any numbers.

| Criterion | Questions | Evidence |
| --- | --- | --- |
| First-impression clarity | Can visitors identify the consultancy, location and primary action? | Five-second test and first click |
| Discovery efficacy | Can they search, narrow, share and recover? | Completed tasks, mistakes and route audit |
| Decision quality | Can they understand verified property facts and uncertainty? | Property comprehension and provenance review |
| Human trust | Does this feel like an accountable local practice? | Interview evidence, About/contact usability |
| Architectural coherence | Is the metaphor expressed throughout without ornamental noise? | Cross-page visual critique at matched states |
| Distinctiveness | Is it memorable without feeling trendy or gimmicky? | Blind, post-task preference and recall |
| Accessibility | Is it usable via keyboard, touch and zoom? | Automated + manual checks |
| Performance | Does expression impose unnecessary payload/motion cost? | Lab measurement, real field data if available |
| Extensibility | Can this scale to dozens of listings and richer metadata? | Component stress tests, code review |
| Maintenance | How expensive are future page/content additions? | CSS/token complexity and developer review |

Do not average arbitrary numbers into a scientifically authoritative score. Discuss tradeoffs and identify where one direction clearly wins or loses.

### Likely decision scenarios

1. **International clearly wins usability and trust; Elevation wins personality.** Keep International as structural production base; borrow only *meaningful* editorial annotation from Elevation.
2. **Elevation achieves task parity and demonstrably stronger differentiation.** Consider it a full candidate, but verify engineering maintainability and comprehensibility on dense pages.
3. **Both require heavy ornament to feel special.** Reduce the metaphor; revisit imagery, copy and local expertise as primary identity drivers.
4. **No useful comparative difference.** Choose the simpler, more extensible system and retire the other from active development.

Do not force an aesthetic merge before each concept has been tested coherently.

---

## 10. Release discipline, files and reporting

### Private publication

- Work on the existing private study; preserve its owner-only audience.
- Publish only a coherent paired release once both directions meet the shared functional contract.
- Maintain deep links for architecture, fourth-color and depth settings; malformed or retired links fall back safely.
- Keep an archived version and changelog; never silently overwrite the real corporate site.

### For every paired release, provide

1. Live private study link and direct International/Elevation review links.
2. A concise **what changed / why** note.
3. Screenshot coverage at desktop, tablet and mobile (only if the approved preview tool actually succeeds).
4. Scope exclusions and any data gaps.
5. Tests run: automated, keyboard, responsive and manual.
6. Measured or observed outcomes, separated from design preference and inference.
7. Outstanding risks, the next smallest test and recommendation.

### Recommended design/code organization

- One shared content and route model.
- Shared semantic components and forms; two architecture-specific layout/skin layers.
- Semantic tokens rather than hex colors scattered through components: paper, ink, primary-action, border-primary, border-subtle, material-detail, focus.
- Global spacing and typography tokens, architecture-specific geometries.
- Logical naming for variant state, e.g. `architecture=international|elevation`, `depth=flat|relief`, `fourth=none|bronze|cobalt`; keep URL param compatibility.
- Feature flags or query params for **experimental** microvariants, never unbounded temporary CSS forks.
- When a winner is chosen, consolidate the five-layer cascade and unused typography library before production.

---

## 11. Recommended immediate next move

**Start with R0, then ship R1 for both directions in one paired release.** Don't begin with a 3-D showpiece, a fourth color or a full property-detail product.

Reason:

1. R0 prevents false conclusions from scarce listings and broken search routes.
2. R1 tests the central claim of each architecture using the same simplest customer tasks.
3. Once the first-click hierarchy is resolved, we can build results and details without repeatedly changing core composition.
4. Material/color experiments become meaningful only after the underlying information design is stable.

### New-chat starter prompt — copy verbatim

> We are continuing the **AUM ESTATES architectural grid concept study**, separate from the actual production website. Read the attached **AUM_Architectural_Grid_Experiment_Roadmap.md** completely and treat it as our working specification.
>
> Existing private study: https://aum-architectural-grid-study.udiboy98.chatgpt.site/
>
> We are comparing **International Style** (façade/frame/mullions/recessed surfaces) and **Architectural Elevation** (measured drawing/datum lines/orthographic layers). Both use White #FFFFFF, Ink #151515 and Red #EF4037 as baseline. A fourth color is optional and subordinate. The other older concept was removed.
>
> Important context: the prototype has only a small curated sample. Rent/Land intentionally have no sample items; some area selections have no matches; many prices are unknown; property image links lead to general original inventory; filters are not fully shareable; mobile filter focus management needs work. These are known study limitations, **not claims about the actual firm's inventory**. Never fabricate properties, images, floor plans, prices, reviews or statistics.
>
> **Our process:** Paired releases R0–R6. At every step, maintain the same content, capabilities and customer tasks for both concepts, while allowing distinct architectural compositions. Separately evaluate (a) task success/trust and (b) expressive visual quality. Ship and test in small increments, with responsive and accessibility requirements at every step. No changes to aumestates.com or GitHub without explicit instruction. Preserve private access.
>
> **Start now with R0: audit the actual study source, verify available data and route contracts, build a reproducible UX/accessibility baseline, and identify any necessary corrections.** Then propose detailed I1 and E1 designs for R1—including alternative layout sketches, rationale, risks, exact acceptance criteria and a comparison test plan. Do not jump ahead into detailed listing pages, colored material variants or dramatic 3-D effects. Ask only a truly blocking question. If you can inspect and safely improve the existing private study, work incrementally and clearly report what changed, what was tested and what remains unverified.
>
> Our north star: **a genuinely trustworthy Gurugram property consultancy with architectural personality—not an anonymous property portal, a CAD novelty, or AI-generated design slop.**

---

**One-sentence recommendation:** Prove the product hierarchy and shared journeys first, then allow each architectural direction to express those requirements in its own coherent visual language.
