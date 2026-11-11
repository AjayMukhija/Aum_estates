# 01 — Product logic and brand foundations

## Positioning

AUM Estates is a **human-led property advisory practice in Gurugram**. The brand must express considered advice and accountability. It must make property discovery easier while helping buyers distinguish a publicly described feature from a verified current fact.

**Working promise:** Practical property advice. Clearer decisions.

**Five governing attributes:** Precise, credible, calm, locally knowledgeable, and direct.

**Avoid:** Generic luxury gradients, fake exclusivity, arbitrary 3D, stock-property portal styling, relentless cards, jargon and unsupported claims.

## Non-negotiable task hierarchy

1. **Find:** Search inventory by intent, location, type and constraints.
2. **Understand:** Show the property reference, what was published, the source and what requires confirmation.
3. **Decide:** Save/compare, note questions, and identify the next step.
4. **Connect:** Speak with a named human adviser with relevant context.
5. **Recognize the brand:** Character supports all four tasks; it is never a barrier to them.

The mental model is *an organized property advisory desk*, not an entertainment website. The content should feel like an intentional register, with enough editorial sophistication to be memorable.

## The five hypotheses currently implemented

| Direction | Main visual mechanism | What it conveys | Strong use | Failure mode |
| --- | --- | --- | --- | --- |
| **Datum** | White page, careful columns, fine rules, red orientation marks | Rational judgment, legibility, restraint | Core product UI and briefs | Can feel dry or institutional |
| **Sun** | Daylight, warm angular facade fins, floating white search desk | Architectural familiarity and welcome | Campaign/hero and editorial material | Can feel like a generic developer's render |
| **Atlas** | Deep evergreen, abstract isocontours, pale data areas | Stability, place, strategic perspective | Editorial area guides | Contours might be mistaken for actual geography |
| **Screen** | Oxide red, aperture rhythm and bold grotesk typography | Contemporary architecture and recognition | Signage, print, standout campaigns | Too much pattern becomes loud |
| **Imprint** | Paper-like surfaces, serif display, printed ink rules | Considered craft and heritage | Stationery, dossiers and editorial | Can become clichéd luxury treatment |

Do not judge by the same tiny motif. Switch themes on `index.html` and inspect the *entire page*, then inspect the application board. The current v16 pass deliberately differentiates large-scale color, hero geometry, typography, category presentation and footer.

### Working synthesis, **not** approval

Datum is the rational default for the digital core. The strongest potential differentiators for testing are Sun's warmth or Screen's physical architectural identity. Atlas and Imprint remain separate hypotheses. Do **not** combine five pattern vocabularies or treat all five as equal parts of a final system.

## Brand design system

The base product tokens are:

- White `#FFFFFF`: page and reading surfaces.
- Ink `#1B211E`: content and hierarchy.
- Muted ink `#657068`: supporting content.
- Signal red `#AB392C`: interaction feedback and rare high-salience markers.
- Divider `#DFE3DF`: structural separation, not a decorative cage.

Variant-specific colors are experiments; they do not override the above universally. Verify accessible color contrast before final selection.

### Typography

Use at most **four functional type roles** in the product: display, heading, body, label. Current baseline uses Helvetica Neue/Helvetica/Arial fallbacks; Imprint deliberately tests a serif editorial display. Avoid arbitrary one-off font sizes and fake ultra-light weight.

### Geometry

Start with a shared container, readable line lengths and responsive gutters. Current baseline uses `--gutter: clamp(36px, 9vw, 156px)` in product CSS. Prefer a spacing vocabulary of 4, 8, 12, 16, 24, 32, 40, 48, 64, 80 and 112px. Align every important box to the same implicit columns or edges. Spacing is a component relationship, not a random margin repair.

### Link and control language

- Text links should look like links; keep subtle underlines on actionable tile links.
- Hover states are supplemental: focus and touch must work without hover.
- Search should be visually and semantically the dominant task.
- Progressive disclosure: do not display a complete taxonomy when only one category is needed.
- Controls need discernible labels, keyboard support, and visible focus states.

## Texture and shaders are a brand tool, not product data

The Sun and Atlas directions include experimental WebGL fragment programs in `dist/brand.js`; the compositions retain visible CSS fallback fields when WebGL is unavailable. Screen and Imprint use CSS patterns/surface treatments; Datum's ornament is mostly structural. Never paint texture over real property facts, form values, photos or focused controls.

The right test is whether the material treatment evokes architecture in a restrained way *and remains useful on a weak phone*. Avoid perpetual animation, giant graphics bundles, full-page noise, and elaborate scroll effects. Honor reduced-motion settings and keep the product equally understandable in monochrome printing.

## Explicitly unresolved

- Which direction is the final primary identity?
- Is the A/E monogram distinctive, ownable and actually useful? **It is not approved.**
- Which exact font(s) are licensed and appropriate for production?
- Which photography and factual property references are cleared for actual marketing?
- What claims, compliance text and brand voice should the owner sign off?

Record decisions and evidence before promoting any of these ideas into the production site.
