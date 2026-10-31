# 02 — Information architecture and visitor journeys

## Information hierarchy

### Index

1. **Global identity and wayfinding:** AUM Estates; Properties, Areas, About where space allows; Speak with Ajay; Menu; Saved when applicable.
2. **Primary user task:** “Find a home. Know the details.” immediately paired with a category selector, project/locality search and area selector.
3. **Optional refinement:** More filters (type, configuration, published budget, sort), progressive and collapsible.
4. **Results:** count, list of references with numbered rows, visual, project/location, configuration, published price, status, view/save.
5. **Credibility of approach:** three concise principles explaining advisory work, after inventory.
6. **Secondary navigation:** footer with Explore, Company and Contact.

### Property detail

1. Back to all properties.
2. **Name and location**—visible before the photograph at mobile/tablet widths.
3. Reference image with clear representative-photo disclosure and neighboring-property navigation.
4. **Published reference:** type, published description, published price.
5. **Still to confirm:** exact unit, availability, total terms, documents.
6. **Next step:** ask Ajay to confirm; optional save and copy link.
7. **Progressive depth:** What to check (default), Sources, My notes.
8. Global footer.

The source and confidence hierarchy intentionally comes **before** the full checklist. Do not bury “price on request” or uncertainty in a generic accordion.

## Journeys to preserve

| Visitor | Entry question | Shortest useful flow | What must be visible | Current study caveat |
| --- | --- | --- | --- | --- |
| First-time buyer | “What can I buy in my area?” | Select sale → location/query → view reference → understand unknowns → ask questions | Type, size, published price/status, next step | Sample is not live availability or verified pricing |
| Young renter | “Can I find a reliable rental near work?” | Select rent → honest sample empty state → describe needs to Ajay | Rent is an explicit category, contact does not hide behind unrelated purchase listings | No rental references are connected |
| Family buyer | “Will this home work for the people living in it?” | Browse → check configuration → property detail → questions about usable area, costs and condition → enquiry | Actual constraints and verification questions | Schools, commute and condition are questions, not current scored facts |
| Investor | “Which option survives due diligence?” | Browse → save up to 3 → compare what is published → identify unknowns → enquire | Side-by-side same attributes and missing values | No yields, appreciation forecasts, legal certification, or verified ROI |
| Knows a project | “Do you have details on X?” | Type project keyword → exact row → view → source/ref → contact | Search field visible, direct detail URL | Exact unit and current terms need confirmation |

Do not build four separate landing pages just to serve four personas. The interface should handle them through a common structure with small context changes, not force a visitor to self-classify before browsing.

## Discoverability and choice reduction

- **Default:** sale references in Gurugram. Visitors can start without configuring anything.
- **First explicit choice:** category. Label “Properties for sale” is a native dropdown, not separate category chips and a second search section.
- **Then optional specificity:** project/locality and area.
- **Additional constraints:** hidden behind “More filters +”.
- **On a result:** primary “View details”; secondary “Save”.
- **On a detail:** primary “Ask Ajay to confirm details”; secondary save/link.
- **For uncertainty:** “What to check” questions, an editable enquiry, and verifiable sources.
- **If no matches:** context-specific explanation, option to broaden search, and direct advice—not a dead end or fabricated zero-availability claim.

## Navigation map

| Entry | Destination | Presentation |
| --- | --- | --- |
| Logo, Properties, All properties | Index | Primary page |
| Listing image or View details | One property detail | Primary page / query-param deep link |
| Areas / Browse locations | Location directory | Side sheet |
| About / How we work | Advisory explanation | Sheet or index section |
| Menu | Buy, Rent, Commercial, Land, Areas, Approach, About, Contact | Full-width overlay |
| Saved | Compare up to three references | Side sheet |
| Speak with Ajay | Requirement/enquiry composer | Side sheet |
| Source & disclaimer | Boundaries of the private study | Side sheet |

### URL patterns

- `/` — index with current defaults.
- `/?purpose=Rent` — rental category with truthful empty-state behavior.
- `/?q=Puri&area=Gurugram` — inventory search state (other filter parameters are supported).
- `/?view=view&property=puri` — direct property detail.

The source is a one-document study with two main screen sections toggled in JavaScript. The above are query parameters, **not independently rendered server routes**. A production application should use proper URL routing, metadata and canonical detail pages.

## The four practical discovery tests

1. **Glance test (five seconds):** Can a new visitor identify where to browse and how to switch from sale to rent?
2. **Known project test:** Can the visitor reach a named property and its limitations without passing through a marketing paragraph?
3. **Bad-news test:** Does “no reference found” communicate sample limits and offer a logical recovery?
4. **Decision test:** Can a visitor explain what is published versus what needs confirmation, and how to ask about it?

If these tests fail, refine flow and language before adding visuals.
