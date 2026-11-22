# 06 — Phased roadmap, tests and decisions

This is an **iteration plan**, not a claim that the listed work has already shipped. Each phase ends in observable acceptance criteria, not an arbitrary number of pages.

## Phase 0 — Freeze and observe the baseline

**Goal:** Make future decisions falsifiable, not preference-driven.

**Tasks**

1. Preserve this v11 ZIP and commit identifier.
2. Run locally on desktop, tablet and mobile.
3. Capture current-state screenshots of index, no-results state, details, checklists, saved comparison and enquiry.
4. Record obvious visual defects (overflow, inconsistent edges, labels too distant from values, bad wrapping).
5. Perform five brief task-based usability sessions before a major redesign if participants are available.

**Exit criteria**

- Baseline functionality and responsive screenshots recorded.
- A ranked problem list exists with observed evidence and affected visitor flow.
- No production source is overwritten.

## Phase 1 — Exact visual logic and interaction polish

**Goal:** Tighten the current design without introducing new visual concepts.

**Highest-value tasks**

- Inspect vertical alignment of every property row when description lengths differ.
- Review image aspect ratio, crop, caption placement and fallback at all widths.
- Measure distance from first screen to first usable result at 390/320 px. Reduce only truly redundant gaps.
- Check type contrast, wrapping, source labels and button hit targets on touch.
- Verify field label vs input association, focus visibility and stable selected states.
- Make checklist questions readable and scannable; verify selected questions are carried into the enquiry review.
- Review whether the exact terms “Published reference,” “Published details,” and “Still to confirm” are understandable to real buyers without explanation.
- Test the location sheet and mega-menu at 320 px and with enlarged text.

**Trade-offs**

- More whitespace improves calm but can hide inventory if poorly distributed.
- Compact rows increase scan speed but can merge unrelated data.
- Red can help selected state and action priority; overuse diminishes its signal.

**Exit criteria**

- No horizontal overflow at 320–1440 px.
- Every interactive affordance is identifiable without hovering.
- A user can search, view, save, compare, find uncertainty and prepare an enquiry without guidance.
- No duplicate or competing primary actions in the same decision stage.

## Phase 2 — Real data and an accountable content model

**Goal:** Make the experience truthful with real inventory, not just visually convincing.

**Tasks**

1. Audit actual listing fields and existing internal data sources.
2. Separate **project** from **specific unit** and **sale** from **rent**.
3. Define exact price, size and status semantics; preserve unknown values.
4. Add source reference, checked-at, image provenance and review state per claim.
5. Build an owner-approved content audit covering each listing and photograph.
6. Add genuinely available rental/commercial/land data—or keep the labels and honest empty state if those services are not supported.
7. Ensure listing search facets and counts are derived from the same canonical dataset.

**Trade-offs**

- A small verified catalogue is preferable to a larger misleading one.
- Human review costs time but is central to the brand promise.
- “Available” and “published” must never be used interchangeably.

**Exit criteria**

- Every production-facing property value has provenance and clearly defined status.
- Representative and exact-unit media are distinguishable.
- Empty, stale, withdrawn, unknown-price and partially populated states render safely.

## Phase 3 — Integration into production architecture

**Goal:** Replace the prototype data path without regressing the existing product.

**Tasks**

- Inspect and document the real `Aum_estates` application before writing an adapter.
- Create typed data interfaces and reusable UI primitives where useful.
- Implement stable property URLs, server-side filtering/search as required, SEO metadata and canonical pages.
- Preserve URL query state and browser history behavior.
- Support responsive images, loading states, retry/fallback and sensible caching.
- Define enquiry persistence/CRM workflow only if the business wants one; obtain consent and secure user input.
- Add automated functional and accessibility checks, error monitoring and basic Web Vitals.
- Stage rollout behind a feature flag or non-production route.

**Exit criteria**

- Production-functional parity for agreed tasks, with no loss of essential existing features.
- Mobile performance and accessibility gates met.
- No broken source links, duplicate listings, unsafe form submissions, or accidental private-study content.

## Phase 4 — Trust, differentiation and evidence

**Goal:** Make expertise visible through useful information.

**Potential additions, only after validation**

- Specific, checked adviser biography and credentials.
- Human-reviewed neighborhood/context notes (commute, practical trade-offs, not invented rankings).
- True transaction-cost guides with dated assumptions and proper caveats.
- Realistic comparison of total costs and verified unit attributes.
- Unit-specific media and documentation when authorized.
- Enquiry guidance for first-home buyers, renters, families and investors.

**Do not add:** fake social proof, arbitrary market indices, “AI recommended” scoring, unverifiable appreciation projections, stock luxury imagery in lieu of actual listings or decorative 3D effects with no user value.

## What to prioritize next

| Priority | Work item | Why now | Proof of success |
| --- | --- | --- | --- |
| P0 | Source and image/content verification | Trust is the central brand promise | Each claim/media item reviewed and labelled |
| P0 | 320–390 px functional/responsive audit | Many first-touch visits are mobile | No overflow, fast path to inventory and enquiry |
| P0 | Real visitor tests for buy/rent/family/investor flows | Avoid designing by intuition alone | Completion, confusion and recovery observations |
| P1 | Property-row/detail micro-polish | The primary experience is already structurally sound | Alignment and reading order improve in before/after evidence |
| P1 | Accessible search, sheets and tabs | Functional quality is part of professional trust | Keyboard/screen-reader tasks work |
| P1 | Typed data contract and real inventory adapter | Enables safe production path | Unknowns remain unknown; clear state provenance |
| P2 | Better local knowledge and editorial content | Differentiates adviser from portal | Visitors find decision-relevant facts |
| P2 | Performance/SEO instrumentation | Needed on live deployment | Recorded Core Web Vitals and funnel events |

## Decision rule for proposed features

For every addition, ask:

1. Which visitor is trying to make which decision?
2. Which uncertainty does this remove?
3. What raw data or evidence supports it?
4. Does it belong on the index, detail, or after contacting the adviser?
5. Does it add a new decision or reduce an existing one?
6. Can a real visitor complete the task faster or with fewer errors?

If the answers are weak, defer the feature.
