# 08 — Ready-to-use prompt for local Codex

Copy the prompt below into Codex **after extracting this archive and opening the project folder**.

---

You are working on **AUM Estates — Property Index v11**, a serious Gurugram property advisory website design study. This local folder contains a complete static prototype and supporting product/design documentation.

First, read:

1. `README.md`
2. `docs/01_BRAND_AND_DESIGN.md`
3. `docs/02_INFORMATION_ARCHITECTURE.md`
4. `docs/03_FUNCTIONAL_INVENTORY.md`
5. `docs/04_DATA_TRUST_AND_CONTENT.md`
6. `docs/05_IMPLEMENTATION_MAP.md`
7. `docs/06_ITERATION_ROADMAP.md`
8. `docs/07_QA_AND_USABILITY.md`

## Goal

Refine the existing Property Index baseline into an exceptionally clear, trustworthy and efficient experience for first-home buyers, renters, families and investors. AUM Estates should feel like a competent professional adviser, not a generic luxury listing template.

**Design is logic. Treat each element as a box.** Its layout, spacing, typographic role, data and action priority must be justified. Whitespace is welcome if it clarifies relationships. Avoid arbitrary decoration and excessive scrolling.

## Hard constraints

- Preserve the white/ink/restrained red visual direction, editorial list-led index, underlined links, controlled four-role type scale, spacing tokens and purposeful margins.
- Primary feature is **property discovery**. Do not add repeated “find/explore” sections before actual inventory.
- Keep category selection as a clear dropdown; advanced filters progressively disclosed.
- Keep property detail hierarchy: identity → visual → published facts → outstanding checks → adviser action → deeper tabs.
- Distinguish published information from independently verified current facts. Do not invent listings, prices, availability, licenses, awards, transaction numbers, social proof, yields or investment forecasts.
- Preserve existing working behavior: search, filters, deep links, property switching, save/compare, questions, private notes, enquiry review, menu and keyboard interaction.
- Do **not** modify or deploy `aumestates.com` or its production repository. Work locally unless explicitly instructed otherwise.
- Do not copy the private study's hosting identity into a separate production project.

## First task

1. Inspect the current file tree and check Git status. Report the baseline; do not rewrite anything yet.
2. Run the static app with `python3 -m http.server 8080 --directory dist`.
3. Audit widths 320, 390, 600, 768, 1024, 1440 px. Exercise the journeys in `docs/07_QA_AND_USABILITY.md`.
4. Identify the five highest-impact problems, separating **observed defects** from **taste-based hypotheses**.
5. Prioritize by impact on visitor decisions, accessibility and trust.
6. Propose a small, testable first patch with specific files/selectors, acceptance criteria and trade-offs.
7. Implement only after the scope is clear, validate keyboard/responsive behavior, and show before/after evidence.

## Later phases

Once the design and interactions have passed real visitor tests, inspect the actual production `Aum_estates` repo separately and propose a safe integration architecture. Normalize the property data model, status/provenance rules, real media ownership and honest empty states **before** wiring to production inventory. Keep those phases distinct.

## What success looks like

A visitor can find relevant inventory without decision fatigue, identify known and unknown information without being misled, compare properties with the same data vocabulary, and reach a named professional with a useful question. Every meaningful UI choice is explainable and testable.

---

## Practical reminders

- Baseline public-reference images are remote. Offline testing can show fallback states.
- The “Rent,” “Commercial,” and “Land” categories are honest sample empty states, not live inventory.
- Local notes, selected questions and saved references use browser storage, not a backend.
- The enquiries are drafts; no message is automatically transmitted.
- Treat this export as the **design baseline** and the separate production site as an integration target only after a source audit.
