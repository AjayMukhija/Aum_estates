# 01 — Brand, visual logic and design system

## Brand thesis

AUM Estates should communicate a property adviser's **judgment, competence, honesty and direct accountability**, without posing as a luxury lifestyle magazine or a mass-market listing aggregator.

The core audiences discussed in the study are:

1. **First-home buyers:** unfamiliar with cost, due diligence and developer language; need confidence and education without condescension.
2. **Young professionals renting:** need reliable availability, commute, terms, clear next steps and minimal friction.
3. **Families buying or relocating:** need real-life suitability, practical compromises, space, schooling, timing, maintenance and total cost.
4. **Investors:** need comparable information, evidence, uncertainty labels, ownership / approval review and realistic numbers.

The common need: **make a high-stakes property decision with fewer unknowns and less wasted time**.

This is a proposed brand direction, not a verified claim about the adviser's qualifications or previous outcomes. Before production, substantiate any specific experience, transaction, licensing or customer-testimonial claims.

## Design philosophy

**Design is logic, not art.** Every block should communicate what it is, how it relates to neighboring blocks, and what the visitor can do next. Empty space is useful when it creates grouping, hierarchy or rest; empty space is wasteful when it separates an action from the thing it acts on.

- Lead with actual inventory discovery, not a repeated sequence of hero slogan → invitation to explore → explore button → search.
- Use white paper, dark text, a warm red signal. Color is a **semantic accent**, not decoration.
- Avoid generic gradient backgrounds, glass cards, heavy shadows, emoji feature icons, floating AI chat bubbles, glow, huge rounded pills, vague marketing claims and stock-template section stacking.
- Display fewer choices at each step; keep advanced choices behind clearly named controls.
- Make links recognizable (underlines) and buttons identifiable without hover. Hover is enhancement, not the only state.
- Use consistent left edges. Controls that belong together share a visual bounding box and baseline.
- Reserve the prominent solid red button for the most useful action at the current stage.
- Use images to identify properties, never to substitute for facts.

## Visual tokens (source of truth: dist/styles.css)

| Token | Current value | Function |
| --- | --- | --- |
| `--paper` | `#ffffff` | White background |
| `--ink` | `#1b211e` | Primary text |
| `--muted` | `#657068` | Secondary text and labels |
| `--accent` | `#ab392c` | Semantic red: emphasis, selected states, primary action |
| `--accent-dark` | `#85291f` | Primary action hover |
| `--line` | `#dfe3df` | Dividers and row boundaries |
| `--quiet` | `#f5f6f3` | Soft input surface |
| `--content-width` | `1560px` | Maximum page canvas |
| `--gutter` | `clamp(24px,7.4vw,116px)` | Outer horizontal margin; overrides at narrow widths |
| `--measure-body` | `60ch` | Intended body paragraph measure |
| `--measure-small` | `74ch` | Intended fine-print measure |

### Type scale: four principal sizes

| Level | Token | Value | Intended role |
| --- | --- | --- | --- |
| Display | `--display` | `clamp(46px,5vw,68px)`; mobile `clamp(42px,10vw,56px)` | One decisive page statement |
| Heading | `--heading` | `28px` | Property names, section titles, major controls |
| Body | `--body` | `16px` | Content and interactions |
| Caption | `--caption` | `13px` | Eyebrows, source notes and labels |

Base stack: **Helvetica Neue, Helvetica, Arial, sans-serif**. Carefully controlled weight, letter-spacing and line-height create hierarchy. Some small mobile identity sizing is responsive rather than adding a fifth semantic type category.

Do not introduce a dozen arbitrary font sizes. Before changing a type token, inspect its use across the header, index, property rows, sheets and detail page.

### Spacing scale

| Token | px | Usage logic |
| --- | ---: | --- |
| `--space-1` | 4 | Optical offsets |
| `--space-2` | 8 | Label-to-value |
| `--space-3` | 12 | Tight internal grouping |
| `--space-4` | 16 | Related controls |
| `--space-5` | 24 | Component internal separation |
| `--space-6` | 32 | Section subsection gap |
| `--space-7` | 40 | Property-row rhythm |
| `--space-8` | 48 | Major group spacing |
| `--space-9` | 64 | Editorial section spacing |
| `--space-10` | 80 | Large section boundary |
| `--space-11` | 112 | Page-level whitespace |

Use tokens except for justified optical corrections. Large outer margins are deliberate. Internal spacing should tighten as information becomes more related.

## Components as boxes

**Header** — brand left; primary destinations in the middle when space allows; consultation and menu right. Mobile intentionally removes visible secondary destinations, not their menu access.

**Hero/discovery** — at wide desktop: statement left, actual inventory selector and two inputs right. At narrower widths: statement then controls in one readable column. The page should never require a separate search row after a marketing introduction.

**Result row** — ordered number → image → property identity + published details → price/status + link/save. The row is typographic and separated by a fine rule. At tablet widths the right-hand information stacks under the property description to avoid a detached action row; at mobile, image and content stack.

**Property detail** — name/location before the image on narrow screens; on desktop an image beside a decision-oriented rail: published facts → still-to-confirm facts → single primary adviser action → secondary controls → tabs.

**Sheet** — one right-side information or enquiry surface. The menu is a separate full-width navigation layer. Escape closes layers; focus is moved into an open sheet and restored on close.

**Footer** — company information and lower-frequency routes, not another large sales pitch.

## Critical hierarchy checks

At any viewport, a visitor should be able to answer:

1. Where am I, and who is this business?
2. How do I see properties?
3. Which property is this, in which area, and what is known?
4. What remains unconfirmed?
5. What is my logical next step?

If two elements both appear to be the primary action, the hierarchy is broken. If two adjacent pieces of copy ask the visitor to explore inventory, one is redundant. If text aligned to an image lacks a meaningful shared vertical start, correct the layout before adjusting colors.

## Change control

Keep a small decision log for each local edit: **problem observed → affected journey → chosen rule → alternative rejected → before/after evidence → responsive/accessibility regression**. Preference alone is insufficient evidence for a UX improvement.
