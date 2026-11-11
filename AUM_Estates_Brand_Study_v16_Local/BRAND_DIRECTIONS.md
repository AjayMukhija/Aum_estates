# AUM Estates — Brand identity exploration

**Study status:** Five working concepts for local iteration. These are not approved brand assets and are not published to the production AUM Estates website.

## 1. The underlying brand

AUM Estates is a property-advisory business, not merely a catalogue. The digital product needs to help someone discover a relevant property **and understand what is known, what is unverified, and what to ask next.** A confident identity cannot imply certainty the underlying property references do not have.

**Working brand promise:** Practical property advice. Clearer decisions.

**Working design character:** Calm, precise, forthright, human, locally grounded.

**What it must never be:** A templated luxury-real-estate website, a catalogue of decorative effects, an imitation of a property portal, or a gallery that hides the inquiry task.

### Inviolable hierarchy

1. **Find** — search, buying/renting intent, area, inventory category.
2. **Understand** — configuration, location, published detail, provenance, verification state.
3. **Decide** — compare options, save references, note concerns, request direct confirmation.
4. **Trust** — clear sources, honest unknowns, named human advisor.
5. **Character** — brand, material, ornament, and interaction texture support the above; they cannot outrank it.

All concepts preserve this order. No decorative shader is allowed behind the text, form fields, search results, or disclosures.

## 2. Five design directions

### Second-pass correction — each must be recognizable in three seconds

The initial implementation only altered a small hero ornament and a few details. The five options looked nearly identical. That is not a fair comparison of competing brands. In this second pass, the identity controls the **entire first viewport**, the search-desk relationship, the property register and typographic character:

- **Datum:** white editorial register, careful alignment and signal-red rules, with no hero panel treatment.
- **Sun:** high-key architectural daylight across the hero, warm angled facade fins, a floating white search desk, and warmer category treatment.
- **Atlas:** a substantial evergreen hero with high-contrast white display type, an illustrated contour field, a white discovery desk, and structured green-tinted property categories.
- **Screen:** an oxide-red architectural hero with large white grotesk type, perforated surface, a contrasting search desk and bold category side rails.
- **Imprint:** pale printed-stock canvas, Georgia serif display typography, a bordered editorial search rail, black ink rules and framed property dossiers.

Each is intentionally a distinct speculative direction. Variations in hero color or layout are **not** to be indiscriminately carried into the final production system. The comparison board's five large visual selectors show them simultaneously.

| Concept | Core device | Best medium | The risk | Keep or test |
|---|---|---|---|---|
| 01 Datum | Architectural registration, rules, alignment | Web UI, structured property records, investor-facing briefs | Institutional sterility, over-gridding | **Strongest primary digital system** |
| 02 Sun | Raking light and shallow facade relief | Hero accent, campaign imagery, architectural presentation | Faux-realistic render, gratuitous animation | Test as an **atmospheric layer** |
| 03 Atlas | Abstract elevation contour field | Area guides, location-led editorial | Mistaken for factual maps or coordinates | Test as an **editorial sub-system** |
| 04 Screen | Contemporary modular aperture/perforation | Signage, folders, physical touchpoints | Heritage pastiche, over-patterning | Strongest **physical signature** candidate |
| 05 Imprint | Paper relief, embossed-looking mark, inked edges | Business stationery, printed brochures | Low contrast, generic imitation luxury | Test as a **print material system** |

The `A/E` initials are experimental and **not a locked logo**. The actual wordmark is still AUM ESTATES. Any new logo must be vetted for legibility, originality, and ownership before adoption.

### Directional recommendation

Use **Datum** as the core system; it gives the grid, typographic structure, category hierarchy and property register one coherent logic. Explore **Sun** as a restrained, optional light treatment in the hero and **Screen** as a recognizable offline architectural signature. Keep **Atlas** and **Imprint** as distinct application studies rather than combining five materials on one page.

Do **not** merge every motif into one design. A brand is selective. Coherence comes from a small repeated grammar, not an accumulating number of effects.

## 3. The shared design specification

### Color

| Token | Value | Job |
|---|---|---|
| Paper | `#FFFFFF` | Clean canvas |
| Ink | `#1B211E` | Reading and hierarchy |
| Muted | `#657068` | Secondary, still legible |
| Signal red | `#AB392C` | Focus, key navigation, active state, concise markers |
| Line | `#DFE3DF` | Structure and separation |
| Material | Varies, near-pale sage | Decorative field only |

The exact working red is matched to the current property-index CSS, not a fresh palette invented for the boards. Evaluate contrast and reproduction in print before approval. Do not use the pale material colors for crucial text.

### Four typographic roles

1. **Display:** around 46–68px fluid on desktop, tighter on phones. One large statement, not multiple competing statements.
2. **Heading:** 28px nominal, for section and intent hierarchy.
3. **Body:** 16px nominal, readable descriptions and input values.
4. **Label:** 13px nominal in the product; 12px in the conceptual brand board, for overlines, annotations and references.

Typeface in this study: Helvetica Neue with Helvetica/Arial fallbacks. Keep a restrained weight vocabulary. Letter-spacing is functional: tight on large marks, neutral on text, open on labels. A distinctive future typeface may be evaluated **after** hierarchy is solid.

### Geometry and spacing

- Use a content max-width, with ample responsive gutters; baseline site uses `--gutter: clamp(36px, 9vw, 156px)`.
- Boxes follow a single rhythm: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 112px.
- Align start edges, baselines, rules and card boundaries to a common implicit grid.
- Use negative space to distinguish content groups. A visible border is not required around every block.
- Property-index categories reveal gradually; only the active set needs to be expanded.
- Decorative sections must not make the first usable search control harder to reach.

## 4. Shader and texture policy

The user-facing question is not *Can we render a shader?* but *What does the rendering communicate?*

**Sun shader** (`dist/brand.js`): Single-pass WebGL fragment program renders shallow vertical facade fins, ambient light and a penumbra. Pointer position can influence lighting when motion preference permits. It is not a real building facade or photographic illustration. The larger hero uses independent CSS geometry that remains visible even when WebGL cannot run.

**Atlas shader** (`dist/brand.js`): Single-pass WebGL fragment program combines analytic sinusoidal fields and isocontour extraction. It is **not real geography**. No coordinate or location claim should appear near it. The large evergreen hero maintains an abstract contour field through CSS with WebGL disabled.

**Screen and Imprint** use CSS-only ornament, with no GPU dependency beyond normal compositing. **Datum** is vector-like CSS geometry. In WebGL-disabled environments Sun/Atlas remain present as CSS fields. `prefers-reduced-motion` disables pointer-driven movement; no ambient animation loop is necessary.

**Guardrails:**

- Avoid shader overlays on text, photography, controls or property facts.
- Render only when switching theme, resizing or moving pointer in the decorative region. Do not schedule continuous frames.
- Device pixel ratio is capped at 1.5 for these nonessential surfaces.
- Color and essential structure must survive blocked shaders, reduced motion, low power and printing.
- Do not use rough grain or noise to simulate “premium” texture. Materiality should be visible at a boundary or in light, not everywhere.
- No autoplaying 3D, videos, scroll-jacking, or motion-dependent navigation.

## 5. Physical applications and information integrity

The dedicated [brand applications board](dist/brand-board.html) tests each concept as:

- A large wordmark and short promise.
- A business card with space and restraint.
- A property-reference brief where verification status is unmistakable.
- A physical architectural sign, optimized for reading distance.
- A 4-color palette, 4-role typography specimen, and three material tests.

Property examples in the board are explicitly **illustrative layouts based on selected public references**, not current offers. Before any collateral is used with customers, verify ownership of photography, published facts, price, unit, area, availability, disclosure requirements and advisor contact details. Do not invent testimonials, awards, precise coordinates or market statistics.

## 6. How to run the local study

This repository is a buildless static Site. Serve `dist/` using any local static HTTP server, then open:

- `index.html` for the actual property experience. Open **Brand Studio** at bottom-right and switch among five modes. This selector belongs to the **private review build** and should be removed from customer-facing production.
- `brand-board.html` for the full identity applications. Click the five concept tabs. The board links back to the same theme on the property experience.
- `responsive-lab.html` for a side-by-side **375px phone** and **768px tablet** comparison at real iframe viewport widths. The tool is strictly an owner-only QA surface, not a customer-facing route.

The URL parameters `?studio=datum|sun|atlas|screen|imprint` and `?concept=...` make comparisons repeatable. Local preference may persist in the browser; clearing the `aum-brand-direction-v1` local-storage entry resets it to Datum, while an explicit valid query parameter takes precedence. The listing data, source links and functional search are shared across all themes.

Key files:

| File | Purpose |
|---|---|
| `dist/index.html` | Working property experience and private theme control |
| `dist/styles.css` | Real product structure, responsive rules, base tokens |
| `dist/app.js` | Property, navigation, comparison, source and contact flows |
| `dist/brand.css` | Five isolated surface systems, visual comparison control |
| `dist/brand.js` | Variant state, URL sharing, optional two WebGL shaders |
| `dist/brand-board.html` | Off-screen identity applications |
| `dist/brand-board.css` | Brand collateral and motif systems |
| `dist/brand-board.js` | Board switching and rationale |

## 7. Acceptance criteria before picking a final identity

**Product:** A first-time visitor can find property inventory without scrolling through repeated marketing introductions; Buy/Rent/Commercial/Land is obvious; categories reveal progressively; every current fact is clearly separated from a question or disclaimer.

**Alignment:** Search, headings, category controls, tiles and footer obey shared gutters, predictable line heights and box rhythm. No overlapping ornament at 320, 375, 768, 1024, 1440 and wide-desktop widths.

**Interaction:** All controls work by keyboard and touch. Hover is enhancement only. Focus, pressed, expanded, empty and error states are legible. Escape closes overlays. Theme switching never resets or falsifies property data.

**Performance:** No animation cost when idle. Image loading is appropriate. Low-end or WebGL-disabled browsers still show a coherent design. No unnecessary network font requests.

**Brand:** The system can be recognized from a property brief or sign with the website closed. It works at one-color print and at small sizes. The user should perceive confidence and restraint, not “luxury” cliché.

**Trust:** No shader-derived “data” is presented as geographic fact. Links, photographs, and public property references retain correct provenance. A brand promise is never mistaken for a factual guarantee.

## 8. Suggested next decisions

1. Compare each direction at the actual property-index URL; choose a **primary identity** and, at most, one **secondary material language**.
2. Test the chosen identity on 375px mobile and on a printed monochrome sheet before embellishing it further.
3. Refine a real AUM ESTATES wordmark (letterform, optical spacing, lockup variants); evaluate `A/E` as a secondary mnemonic rather than assuming it is the logo.
4. Build a reference **property fact sheet**, contact card and advisor profile with approved content and photography.
5. Conduct a five-person task test: find a property, understand a published vs unverified fact, save/compare it, and request direct confirmation.
6. Remove private studio UI when moving a chosen identity into production, carry over only approved assets and tokens, then verify SEO, accessibility, responsiveness and performance end to end.

**Recommendation as of this exploration:** Datum’s precision is the most credible core. Sun might bring subtle human warmth if it survives disabled-GPU testing. Screen may be a stronger physical differentiator than an additional web effect. That is a design hypothesis to validate, not a final brand sign-off.
