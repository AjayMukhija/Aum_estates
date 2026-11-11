# 04 — Data, provenance and trustworthy property content

## What the v11 sample actually contains

This table documents the literal entries in `dist/app.js`; it does **not** independently substantiate them.

| Study ID | Display name | Displayed area | Type | Published price shown | Reference field |
| --- | --- | --- | --- | --- | --- |
| `puri` | Puri The Aravallis | Sector 61, Gurugram | Apartment | Price on request | AUM-WEB-000167 |
| `nirvana` | Nirvana Deerwood | Nirvana Country, Gurugram | Villa | Price on request | No reference ID in sample |
| `elevate` | Conscient Elevate | Sector 59, Gurugram | Apartment | Price on request | AUM-WEB-000194 |
| `privana` | Privana South | Gurugram, Haryana | Apartment | Price on request | AUM-WEB-000142 |
| `urban` | Urban Oasis | Gurugram, Haryana | Apartment | Price on request | AUM-WEB-000113 |
| `sukoon` | Sukoon by ASYA SmartLiving | Majorda, South Goa | Villa | 3 BHK ₹7 Cr / 4 BHK ₹9 Cr | AUM-APP-0001 |

These entries point to image URLs at `aumestates.com`, mostly labelled “Representative reference image.” The Goa image is labelled an AUM Estates-supplied project photograph. The images are **not stored in the handoff**. Their availability and rights for production reuse must be confirmed.

The study includes a link to the public directory at:

https://aumestates.com/approved-properties/index.html

The displayed names, IDs, dimensions, image labels and price fields came from the earlier design-study source; treat the original inventory as an input to verify, **not** authoritative proof of current market facts.

## Status vocabulary

Avoid blending three distinct states:

1. **Published:** a value appears in a supplied or public reference.
2. **Confirmed as of a date:** a named, accountable person checked that precise value; display method and recency.
3. **Unknown / needs confirmation:** no current evidence for this value; do not guess.

Example of appropriate language:

- “Published reference: 3 BHK, approximately 2,250 sq ft.”
- “Current availability: not confirmed.”
- “Price: on request.”
- “Image: representative reference; may not show the available unit.”

Avoid unsupported claims such as “verified unit,” “fully approved,” “best investment,” “guaranteed appreciation,” “lowest price,” “limited units left,” “ready to move,” or “100% transparent.”

## Suggested canonical data contract for real inventory

Use this only as a **proposal**, not as something already implemented:

| Field | Why needed | Provenance/validation |
| --- | --- | --- |
| Stable `listingId` / `unitId` | Distinguish project marketing from an actual available unit | Internal source of truth |
| Project name / property type | Search and presentation | Owner/developer/source |
| Location (general vs precise) | Useful search without false map pins | Explicit geolocation precision |
| Area measurement + unit + definition | Compare saleable, carpet and built-up claims fairly | Source document and measurement type |
| Config / floor / furnishing | Screening and visit planning | Confirm against exact unit |
| Price + currency + basis + effective date | Avoid outdated or incomparable price claims | Quote/authorization and timestamp |
| Price visibility state | “On request” is not zero or null-as-free | Explicit enum |
| Availability + checked-at timestamp | Distinguish recent checks from stale listings | Named confirming person |
| Fees/maintenance/deposits | Total cost of purchase or tenancy | Source and date |
| Image attribution + media kind | Prevent representative renders being shown as unit photographs | Rights and content review |
| Documentation / approvals status | Due diligence | Evidence pointer, never implied from blank |
| Source URL / source document / source date | Auditability | Preserve originals |
| Editorial review state | Prevent incomplete records publishing as verified | Human-reviewed checklist |

Use structured states (e.g., `published`, `confirmed`, `unknown`) per claim, not one misleading global “verified” badge.

## Content quality rubric

Every listing should answer, in this order:

1. What is it called and where is it?
2. Is it a project reference or an exact available unit?
3. What are the property type, configuration, usable area and condition—if known?
4. What price was published, when, and does it include other charges?
5. What is still missing or needs independent confirmation?
6. What precise next action will reduce uncertainty?

Unanswered questions are acceptable; **unlabelled uncertainty is not**.

## Adviser credentials and brand trust

The actual professional's biography, experience, registrations and proof of past work can become a strong brand asset, but only after reviewing source documents and obtaining approval. A page should identify a real accountable contact with restrained supporting evidence, not invented statistics or generic testimonials.

Before a production release, have the business owner verify all contact details, service coverage, marketing permissions, listing rights, disclosures and any applicable real-estate advertising obligations. This handoff is a UX/product study, not legal advice.
