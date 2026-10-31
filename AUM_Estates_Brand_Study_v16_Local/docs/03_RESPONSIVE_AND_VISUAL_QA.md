# 03 — Responsive, accessibility and visual QA

## Principle

Treat **every component as a box**: define its parent grid, intrinsic size, internal padding, external spacing, baseline, alignment with neighbors, wrapping rules and small-screen behavior. Do not correct isolated symptoms with arbitrary negative margins. The customer should recognize one consistent underlying system across headings, search, index categories, property records and footer.

## Test matrix

Test the five concepts across all widths below, in real browser layout (not by scaling down screenshots):

| Width | Intended check |
| --- | --- |
| 320px | Small phone, no clipped copy/controls or horizontal scrolling |
| 375px | Primary phone layout, search and menu without hover |
| 390px | Text wrapping, field label/placeholder room |
| 600px | Tablet transition, no awkward card/panel split |
| 768px | Tablet columns and hierarchy, drawers/focus |
| 1024px | Header density, search-grid proportion, property action columns |
| 1440px | Optical alignment, rhythm, main column width, footer columns |
| ≥1728px | Maximum line lengths, balanced whitespace, centered content |

Use `responsive-lab.html` for a quick 375/768 side-by-side; use browser DevTools responsive mode for the remaining sizes. A design passing desktop screenshots is not automatically responsive.

## Layout acceptance checklist

- [ ] Header logo, primary controls and menu align to the same main container as the content below.
- [ ] L/R gutters stay visible; text never touches the viewport edge.
- [ ] Main headline never collides with shaders, motifs, controls or header.
- [ ] Search is in the first useful viewport, not hidden behind ornamental lead-in content.
- [ ] Search labels, fields, error/empty messages and primary action follow a clear reading order.
- [ ] The Property Index below search uses an implicit grid: aligned start edges, honest category labels and predictable disclosure.
- [ ] Category accordion opens and closes with visible state and keyboard semantics.
- [ ] Property entries keep legible photo ratios, labels and action links as width changes.
- [ ] Underline or another persistent signal differentiates interactive links from plain text.
- [ ] Footer columns, baseline and bottom padding align and do not collapse into erratic gaps.
- [ ] No floating panel extends beyond viewport width or covers a primary action.
- [ ] At large widths, text does not stretch into unreadably long lines.
- [ ] No browser-level horizontal overflow.

## Interaction test cases

1. **Search:** On the initial page, type a real sample locality (e.g., Puri). Result count and visible items should update; reload should honor supported URL state.
2. **Filter:** Expand More filters; constrain property type or price; ensure unknown price entries are excluded from a price-limited result, never fabricated.
3. **Category:** Switch to Rent/Commercial/Land. Confirm an intentional empty state with an adviser action; switch back and confirm filters recover coherently.
4. **Detail:** Open a result, inspect published vs unverified blocks, Source and My Notes tabs, and go back.
5. **Save:** Add up to three references; compare; remove one; reload and confirm expected browser-local persistence.
6. **Questions:** Select due-diligence questions; confirm selection is represented as *to ask*, not *verified*.
7. **Enquiry:** Open adviser sheet from a property/compare context; inspect editable review; dismiss without unintended external send.
8. **Keyboard:** Tab through nav/search/accordion/detail/sheets; use Escape; activate buttons with Enter/Space; verify visible focus.
9. **Touch:** All controls and navigation work without hover. Watch nested scroll areas and anchored overlays.
10. **Brand:** Switch five concepts repeatedly. Content, search results and selected property context should be unchanged by purely visual theme selection.

## Visual states that need evidence

Capture for each theme, at desktop and phone:

1. Default hero + search.
2. Search with one result and with zero results.
3. Category dropdown open.
4. Property register with a long name and missing price.
5. Detail view and source/verification state.
6. Menu/adviser sheet open.
7. Footer.
8. Brand-board collateral (desktop is sufficient), plus 375px controls.

For review, name screenshots by theme, viewport and state (e.g., `atlas-375-search-empty.png`) and compare them side by side. Record actual defects with the CSS selector, viewport width, expected behavior, and screenshot.

## Accessibility and resilience

- [ ] Semantic links/buttons; accessible name and role; stable focus order.
- [ ] Escape dismisses overlays and returns focus appropriately.
- [ ] `aria-expanded` and other state metadata match visible disclosure state.
- [ ] Strong foreground/background contrast, especially on Atlas and Screen hero colors.
- [ ] `prefers-reduced-motion` respected; no motion needed to reveal critical data.
- [ ] WebGL unavailable: Sun/Atlas still have visible deliberate CSS identity; text remains readable.
- [ ] Photos do not become hidden factual labels; representative media correctly qualified.
- [ ] Images have useful alternate text/fallback and avoid significant layout shift.
- [ ] No keyboard trap within comparison/studio controls; private studio not treated as production UX.

## Performance and front-end checks

The current study has no build system. At minimum, run:

```sh
node --check dist/app.js
node --check dist/brand.js
node --check dist/brand-board.js
```

Node is optional for **running** the website but useful for these syntax checks. Test reduced motion and GPU-disabled rendering manually, and inspect network loads for remote image failures. Do not promise specific Core Web Vitals without measurement.

## Exit gate

An iteration is done when every listed change has: (a) a before/after comparison, (b) expected behavior written down, (c) responsive checks at 375/768/1440, (d) keyboard/touch checks if interactive, and (e) no regression in the four product journeys.
