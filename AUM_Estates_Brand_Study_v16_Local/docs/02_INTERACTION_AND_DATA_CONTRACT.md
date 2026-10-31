# 02 — Interaction, source integrity and implementation contract

## What the static product really does

This is a **working browser prototype**, using six manually entered property references in `dist/app.js`. It does not have real-time inventory or server persistence. It should be evaluated on the quality of the user's information journey, not marketed as a live brokerage system.

### Journey 1 — Find

1. The homepage presents the current intent (Buy by default) and project/locality search.
2. The user can choose Buy, Rent, Commercial or Land. Only Buy has sample entries.
3. Area and optional advanced filters refine the result set. Unknown prices do not enter price-filtered matches as if they were free or within budget.
4. A result communicates name, type/location, source-specific published descriptors, current-terms caveat and a detail action.
5. Nonmatching queries and unsupported categories show honest, contextual empty states and an adviser action.

### Journey 2 — Understand

1. Detail page is deep-linkable with `?view=view&property=<id>`.
2. Published reference information is visibly separate from **what must still be confirmed**.
3. The image may be representative; image numbering across references is not a verified unit-photo gallery.
4. Three detail tabs: due-diligence questions, published sources, browser-local personal notes.
5. The visitor can select questions without implying they have been answered or verified.

### Journey 3 — Compare

- Save up to **three** references. The comparison surface shows only supported known data.
- Local storage keys include `aum-study-saved`, `aum-study-notes-v5`, `aum-study-questions-v5`.
- No account, cross-device sync, encryption or automatic retention promise exists.

### Journey 4 — Contact

- “Speak with Ajay” opens an advisory sheet. Property context, saved references and selected questions may flow into the draft.
- The visitor reviews an **editable** enquiry and intentionally copies or opens a prepared WhatsApp URL.
- No hidden message, booking or CRM submission occurs. Phone links invoke the device dialer.

## Private brand controls

The Brand Studio in `dist/index.html` is a review-only overlay. Theme URL parameter: `?studio=datum|sun|atlas|screen|imprint`; stored preference key: `aum-brand-direction-v1`. The board uses `?concept=...`. These controls must not ship to public customers when a brand is locked.

## Key file responsibilities

| File | Owner of concern | Safe local change examples |
| --- | --- | --- |
| `dist/index.html` | Product sections, accessible semantics, private studio UI | Rearrange meaningful content and labels |
| `dist/styles.css` | Shared product layout, responsive sizing, component states | Grid, margins, footer, details and typography |
| `dist/app.js` | Sample data and behavior | Search logic, URL state, filters, keyboard/focus behavior |
| `dist/brand.css` | Per-brand presentation | Theme-wide style, ornament, surface color and composition |
| `dist/brand.js` | Theme selection and shader experiments | Fallback/motion behavior and studio copy |
| `dist/brand-board.*` | Comparative identity applications | Stationery, signs, brand rationale |
| `dist/responsive-lab.html` | Internal visual QA only | Breakpoints, comparison framing |

## Evidence levels for property information

| State | Allowed copy | Forbidden shortcut |
| --- | --- | --- |
| **Published reference** | “Published as ...” with citation to source | Rephrasing as independently verified current fact |
| **Needs confirmation** | “Confirm exact unit, price, availability, approval ...” | Generic green verification badge |
| **Illustrative material** | “Representative image” or sample layout | Presenting as exact-unit photograph or live offer |
| **User note** | Private note, selected question | Counting question as resolved fact |

Before real-world customer use: verify listing permissions, image rights, property documents, exact unit and seller authority, current pricing and terms, and relevant disclosure compliance. A beautiful identity should **increase**, not mask, evidentiary precision.

## Out of scope for this handoff

No backend, authentication, inventory ingestion, CRM, scheduling, payments, map/geolocation assertions, unit-level document vault, production deployment, or publishing changes to `aumestates.com`. These require a separate specification and integration phase with the actual existing repository.
