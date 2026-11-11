# 04 — Next stages and decision gates

The goal is not additional visual novelty by default. It is to make the brand **recognizable, usable, defensible and deployable**, with explicit evidence for each decision.

## Phase 0 — Freeze and inspect the baseline (one local session)

**Work**

1. Extract this handoff into a fresh local directory; initialize your own Git repo or new branch so the baseline stays recoverable.
2. Run the static server. Compare all five actual pages and the brand-board applications.
3. Walk search → property detail → saved comparison → enquiry on phone and desktop.
4. Save screenshots and a defect log before changing code.

**Deliverable:** A written baseline report with facts, not aesthetic assumptions: viewport, exact element/selector, observed issue, impact and severity.

**Exit:** You can reproduce the default experience and explain what each of the five directions changes.

## Phase 1 — Structural polish first (highest priority)

**Why:** Margin, rhythm, line length and predictable box behavior are the quality foundation. Ornament cannot rescue imprecise layout.

**Work**

- Normalize shared container edges across navigation, hero, search, Property Index and footer.
- Audit CSS overrides, duplicated spacing tokens and excessive specificity; consolidate the source of truth.
- Standardize the four type roles, heading widths, input heights and link treatment.
- Refine Property Index category accordion: collapsed overview, clear expanded detail, persistent selected state, responsive two/three-column layout only where space allows.
- Fix mobile footer wrapping and spacing as a dedicated component, not a collection of exceptions.
- Confirm that real controls have meaningful focus, loading/empty and error affordances.

**Tradeoff:** Reducing visual variants temporarily can accelerate foundational fixes; however, do not accidentally make the five concepts indistinguishable again.

**Exit:** No overflow or collisions across the QA viewport matrix, with a defensible spacing/typography system and functional disclosure.

## Phase 2 — Lock one brand grammar

**Decision:** Pick **one primary system** after looking at the same tasks and collateral in all five directions. At most one secondary material treatment should be adopted.

**Recommended test:** Datum as core product system vs Sun as a more welcoming primary visual, with Screen as an offline recognition system. Atlas and Imprint remain optional hypotheses unless user evidence favors them.

**Work**

- Test logo/wordmark at small size and at one-color print.
- Test color contrast and type licensing.
- Produce a simple identity sheet: wordmark lockups, color tokens, one-page type scale, line/icon behavior, imagery guidance, sign and property brief.
- Record what must be **removed** from unused directions. The goal is a narrower, stronger brand.

**Exit:** One selected primary identity and a signed-off set of small repeatable rules with usage examples.

## Phase 3 — Materiality and interaction precision

**Work**

- If Sun: test restrained, static light across only one architectural surface. Make CSS fallback the design, WebGL a measurable enhancement.
- If Atlas: isolate contours to editorial area guides and label them clearly as abstract, not real maps.
- If Screen: use the aperture pattern on signs, cards and occasional borders rather than behind every body paragraph.
- If Imprint: test real ink/paper combinations at print scale; avoid low contrast and faux-emboss UI everywhere.
- Define interaction timing and easing for accordion, sheets, hover/focus, plus reduced-motion behavior. No gratuitous loops.

**Exit:** Every material effect has a documented purpose, performance budget and fallback. Remove effects that do not improve recognition or comprehension.

## Phase 4 — Content and trust redesign

**Work**

- Replace illustrative claims with owner-reviewed property information, source URLs, timestamps, verification states and approved images.
- Draft useful neighborhood guidance and due-diligence checklists. Keep editorial guidance separate from sales inventory.
- Standardize the property record and detail-page information model: project, unit, status, location, price qualifiers, provenance, last checked, evidence/confidence and contact context.
- Validate the usefulness of labels with first-time homebuyers and renters, not only internal reviewers.

**Exit:** No customer-facing claim lacks an appropriate source/qualification, and users can understand what remains unverified.

## Phase 5 — Real platform integration (separate repository/workstream)

**Work**

- Inspect the actual Aum Estates production codebase and its data model before porting any UI.
- Remove private study links and theme toggles; migrate only the chosen CSS/interaction system.
- Define API/CRM/search/auth requirements separately. Do not infer a production backend from this prototype.
- Create staging, content approval, analytics events and accessibility/performance regression tests.
- Validate legal, property and contact claims with the business owner before publishing.

**Exit:** Staging passes real-data, device, accessibility, search and contact tests. Production deployment remains a separate explicit decision.

## How to evaluate a decision

For each change, write a five-line decision record:

1. **Observed problem** — evidence, screenshot, viewport, affected visitor task.
2. **Hypothesis** — what change should improve and why.
3. **Alternative** — simplest credible other solution.
4. **Cost/tradeoff** — content, complexity, maintainability, speed, accessibility, brand cohesion.
5. **Verification** — objective acceptance test and outcome.

Avoid after-the-fact rationalizations like “it feels premium.” Say instead: “The category overview fits into one screen at 375px while keeping the first actionable filter above the fold; 5/5 usability participants found Rent in under 10 seconds”—but **only after actually measuring it**.

## First recommended Codex task

Start with **Phase 1 / alignment audit**. Ask Codex to inspect the real source and enumerate specific defects, then patch the highest-impact 3–5 issues, document changes and verify responsive and keyboard behavior. Do not ask for a wholesale redesign or deployment on the first local turn.
