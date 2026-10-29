# 02 — Product Intent, Navigation and Customer Journeys

The real estate practice needs a website that helps visitors move from **uncertainty to a useful next decision**. Attractive grid design is necessary but insufficient.

## What kind of product is this?

**A property consultancy with curated discovery and human guidance.** It should not pretend to be an exhaustive or real-time inventory marketplace until its data, operations and workflows support that claim.

The primary value is informed assistance:

1. Help someone express what they are looking for.
2. Show relevant, credible public information when available.
3. Make unknowns explicit.
4. Provide a direct, context-rich route to a human advisor.

### Primary visitor groups

| Visitor | Main question | Appropriate outcome |
| --- | --- | --- |
| Buyer | “Which property may fit my budget and locality?” | Search, compare what is verified, enquire about a relevant property |
| Tenant | “Can you help me rent in this area?” | View legitimate inventory if available; otherwise contact with specific requirements |
| Commercial client | “What space fits my use, size and location?” | Structured requirements and a focused consultation |
| Land buyer/investor | “What opportunities and due diligence should I consider?” | Clear criteria and a human conversation; no invented financial promises |
| Owner/landlord | “Can I sell or lease with you?” | Simple owner handoff with property/location and intent |
| Undecided explorer | “Which locality or product type makes sense?” | Locality context, related verified examples and guidance |

## Three journeys to make obvious on the homepage

### 1. Known requirements — SEARCH

Current prototype: purpose + locality selectors, then a results page.

Desired later behavior: adapt relevant attributes by purpose; preserve filter values on URL/back navigation; show data limitations honestly; allow a quick enquiry when no demo inventory exists.

### 2. Browsing and learning — EXPLORE

Current prototype: Buy, Rent, Commercial, Land and six locality tiles.

Desired later behavior: group the four property purposes as one recognizable browsing level; give locations an actual information destination, not a list of buttons that often open empty results. Use real maps and sourced urban context when added.

### 3. Expertise and service — SPEAK

Current prototype: Speak to us and List a property open an advisory page containing WhatsApp/call options.

Desired later behavior: maintain the user's current purpose, locality, property reference and basic requirements in the prefilled message. Provide separate concise entry points for buyer/tenant versus owner.

## Current route model

| Destination | How it is reached | Current implementation |
| --- | --- | --- |
| Home | `#home` / logo / Back to overview | Intro and eight task cells |
| Browse | `#browse` or the search/category buttons | Fixed sample and filters |
| Locations | `#locations` | Six entry cards, each enters Buy results for a locality |
| Advisory | `#advisor` | WhatsApp and phone contact choices |
| Owner advisory | `#advisor-listing` | Owner-centered headings, same contact options |
| About | `#about` | Practice, office and official-source links |
| External original site | Navigation or source links | Leaves local prototype |

The desktop “Properties” header currently invokes Buy rather than an all-property overview. Its label and action must become consistent. The original inventory link is also too generic for a property-specific detail.

## Proposed information architecture to test (not implemented yet)

```text
Home
├── Search by requirement
│   └── Results / verified examples / honest no-sample guidance
│       └── Property detail → contextual enquiry
├── Explore
│   ├── Buy / Rent / Commercial / Land
│   └── Locations → sourced locality profile → related examples or advice
├── Owners → Start a listing discussion
├── About / team / process / office
└── Talk to an advisor
```

This is a proposed product organization. The **R1 experiment** should test visual ways of representing it rather than simply imposing the structure and declaring it superior.

## Results and decision data

### Essential property fields (only if verified)

- Name, accurate locality, intended purpose and property type.
- Relevant configuration and area with correct unit and definition.
- Price and availability when actually current; clear “on request” or “confirm with advisor” state otherwise.
- Accurate, property-specific photo attribution.
- Source/reference, meaningful updated timestamp if verified.
- Short descriptive context and direct enquiry action.

Avoid making the card visually uniform by inventing fields that some properties do not have.

### Filtering principles

1. **Appropriate:** Purpose-specific facets, not the same generic type controls for every category.
2. **Observable:** Current filters visible as removable chips and reflected in result counts.
3. **Persistent:** Browser history, shared links and return navigation preserve state.
4. **Recoverable:** Empty state explains prototype coverage and offers broader search or qualified advice.
5. **Honest:** Never hide unknown prices behind inaccurate numeric comparisons.
6. **Mobile-complete:** Filter tray supports apply/cancel, focus control and restoring the previous view.

The right filter set ultimately depends on real inventory schema and actual user needs; the present nine-row sample is not enough to validate a full faceted search system.

## Trust is a UX component

Trust comes from **accurate facts and accountable people**, not decorative ratings. Where verified and approved:

- Identify the practice and person responsible.
- Explain how enquiries, shortlisting and visits progress.
- Show a real office and authentic personnel/photography.
- Present honest locality notes and credible source references.
- Never invent testimonials, awards, client counts or property returns.

## Copy and visual semantics

- State the actual service and city, not just atmospheric slogans.
- Say “examples in this sample” where data isn't exhaustive.
- Make CTA verbs specific: “Explore homes,” “Discuss a rental,” “Ask about this property.”
- An internal search result should not look like an external-source jump.
- Red has a strong signal role; low-contrast small red text should use an accessible darker token.
- Section indexes/mono labels orient the visitor but do not replace normal headings and instructions.

## What must be learned, not assumed

1. Do customers actually prefer search-first on arrival?
2. Does a grouped homepage outperform eight near-equal choices?
3. Does a local profile improve confidence when listings are incomplete?
4. Which missing property field most often prevents enquiry?
5. Which mode creates better trust without sacrificing scanning speed?

The answer comes from observations and tests, not from choosing the prettiest static screenshot.
