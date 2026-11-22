# 03 — Functional inventory: what works, what does not

All descriptions below are **implemented behavior in the v11 static study** unless explicitly labelled as a proposal. This is not a spec claiming a backend exists.

## Inventory and search

- Six hard-coded references live in `dist/app.js` under `const inventory`. Five are Gurugram-area references and one is in Goa.
- Default category is `Buy` (displayed as “Properties for sale”).
- Category choices: Buy, Rent, Commercial, Land. Only Buy has sample properties. Other choices offer honest category-specific empty states and an adviser enquiry.
- Project/locality/keyword search filters locally against name, area, type and description.
- Area select contains Gurugram, All areas, Sector 59, Sector 61, Nirvana Country and Goa. “All areas” can include the Goa sample; default Gurugram does not.
- More filters expands: property type (Apartment/Villa), configuration (2/3/4 BHK), published-price bands, and sort (selected, name, area).
- Budget filters **exclude unknown prices** by design. “Price on request” is not treated as zero, an inferred range or an eligible budget match.
- Selecting a new category resets potentially incompatible advanced filter values.
- No-match messages explain whether the sample is too limited, the category lacks data, or a budget is excluding unknown prices.
- Search state is mirrored to URL query parameters.

**Not implemented:** inventory API, full-text engine, map bounds, faceted result counts, pagination, live availability, ranking, price refresh, external CRM.

## Property register rows

- Ordinal number, reference image, property name, area/type, published descriptor, published price, unknown-current-terms label, details action and saved toggle.
- Image errors produce a plain textual fallback.
- Desktop uses image + description + action rail; tablet moves actions below description; narrow mobile stacks all elements.
- View details opens the selected reference, updates URL and scrolls to top.

**Not implemented:** verified image attribution/license database, unit-level photo galleries, geolocation pin, floor plans, live tour or authoritative listing status.

## Property detail

- A detail deep link works with `?view=view&property=<id>`.
- A back control returns to inventory.
- Location/name appear above the photograph on mobile/tablet and beside it on wide screens.
- Image has a representative-photo note and a sequence counter. Previous/Next move between **different sample properties**, not between multiple photos of the same unit.
- Published-reference register contains type, details and price.
- A separate “Still to confirm” block avoids conflating published references with current unit/terms.
- Primary action starts the adviser enquiry with current property context.
- Secondary actions save and copy an exact detail link.
- Tabs: What to check (default), Sources, My notes. Tab selection uses keyboard arrow/Home/End behavior.

**Not implemented:** independent verification, exact-unit media, availability calendar, property documents, live comparison of unit details.

## Questions, notes, saved comparison

- Six editable-selection questions cover exact unit/viewing, total cost, approvals, usable area/condition, locality/commute and terms/timeline.
- Checking a question adds it to a possible enquiry. It **does not mark a question answered or a fact verified**.
- My notes text is saved only in the current browser, per property.
- Saved references are stored in the browser; maximum **three**. A comparison sheet shows location, type, configuration, published price, reference ID and current-terms status.
- Removing a saved reference updates the comparison and count.
- Refreshing the page preserves supported local storage state in the same browser.

Storage keys:

| Key | Content |
| --- | --- |
| `aum-study-saved` | Array of saved property IDs |
| `aum-study-notes-v5` | Object mapping property ID to note text |
| `aum-study-questions-v5` | Object mapping property ID to selected question indices |

This is device-local prototype state without an account, encryption, backup, cross-device sync, consent management or deletion interface. Do not position it as a secure client account.

## Enquiry handoff

- “Speak with Ajay” opens a right-side sheet.
- Inputs include Buy/Rent/Sell/Lease out/Explore, location, optional situation, budget and priorities.
- Coming from a property or saved comparison prepopulates relevant context and any selected questions/notes.
- “Review enquiry” generates **editable text**. Users can copy it or open an encoded WhatsApp URL to initiate sending themselves.
- Phone link invokes the device's telephone handler.
- **No message, booking or lead is sent automatically** from this static study.

**Not implemented:** form submission to CRM, consent audit, lead lifecycle, WhatsApp Business integration, delivery status, server analytics.

## Menus and sheets

- Menu overlay has clear property categories, advisory/company destinations, contact details and source notes.
- Areas opens a location sheet and can apply a search area.
- About and source/disclaimer are sheets.
- Escape closes sheet/menu; clicking backdrop closes sheet. Open sheets move focus to a close control and attempt to keep keyboard focus inside.
- Responsive navigation hides low-priority top-level items at narrower widths; menu remains available.

## Important honesty boundary

**The study is working UX software, not a functioning brokerage platform.** A production-ready claim would be inaccurate. The current work proves the interaction design, layout system and some client-side behavior. It does not prove the availability, ownership, contract terms or accuracy of the sample listings.
