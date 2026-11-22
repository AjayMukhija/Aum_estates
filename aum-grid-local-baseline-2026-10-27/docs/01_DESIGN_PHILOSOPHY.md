# 01 — Design Philosophy: Why These Two Architectural Directions?

This document preserves the thinking behind the aesthetic choices, including what was deliberately **not** chosen. It distinguishes design intentions from hypotheses that still need evidence.

## The original problem

The real estate consultancy website needed more than updated colors and cards. The criticism was structural: weak typographic hierarchy, inconsistent spacing, competing navigation options, generic grid treatment, and little visual character appropriate to an urban real estate practice.

The desired identity has two simultaneous requirements:

1. **Credibility:** Property decisions are financially and emotionally consequential. Visitors need clear actions, accurately attributed information, predictable navigation and a sense of accountable local expertise.
2. **Personality:** A consultancy working in a growing urban environment should not feel sterile. Its design can reference the proportions, structure, materials and drawings of architecture without becoming a literal skyscraper illustration.

The guiding claim is **architecture as a design grammar, not an ornament pack**.

## The core palette

| Role | Color | Purpose |
| --- | --- | --- |
| Paper | White `#FFFFFF` | Light, space, clarity and a neutral backdrop for authentic property photographs |
| Structure | Ink `#151515` | Typography, major boundaries, navigation and information architecture |
| Signal | Red `#EF4037` | The most expressive field and action emphasis, especially the search anchor |
| Accessible small red text, as used in the study | Deep red `#B52B24` | Higher-contrast interactive text against white |

**Reasoning:** White gives visual breathing room; ink gives disciplined structure; red adds urgency, warmth and memorable personality. The contrast between a mostly neutral site and one bold search field is more effective than distributing saturated color throughout the page.

Do not infer that the fourth color is needed because a design system must have a certain number of colors. Color count is not a quality metric. Red / White / Ink is the control.

### Fourth-color hypothesis

The study supports cobalt `#3154A5`, bronze `#956C35` and verdigris `#36766C`, all subordinate to the red signal:

- **International Style:** Bronze suggests metalwork, weathering and premium building details; most credible on hairline joints or restrained metadata.
- **Architectural Elevation:** Cobalt evokes drawing/reference ink and can separate functional measurement-like annotations from the red action signal.
- **Verdigris:** Interesting material experiment, but not the current default for either direction.
- **None:** Always retained as the cleanest baseline.

No fourth hue should color a second set of primary CTA buttons, compete with essential red, or undermine text contrast. It must remain recognizable on touch without requiring hover. Test **one candidate per direction** only after the structural work is stable.

## International Style: architecture as structure

**Inspiration:** Modern curtain walls, repeated vertical bays, structural mullions, controlled proportion, internal recession.

**What the interface should feel like:** Professional and quietly metropolitan. Information occupies purposeful bays. One obvious structure continues from header to hero to results to location pages and footer.

**Structural rules worth testing**

- Strong outer and sectional borders, thinner subsidiary separators, minimal incidental boxing.
- Repeated column edges to create rhythm. The alignment must mean more than the number of visible gridlines.
- A prominent, unambiguous search field; quieter browsing/navigation bays.
- Photographs act like apertures or windows, but must remain easily inspectable, accurately matched and uncropped where key detail matters.
- Shallow **inset** shadows indicate a change in panel state. Load-bearing borders never lift or tilt.
- Typography remains mostly IBM Plex Sans; mono is annotation, not the dominant reading face.

**What could go wrong:** An oversupply of borders makes it look like a software dashboard; the repetition turns repetitive; photography feels overly boxed; the design becomes too cold. Solve through hierarchy, line-weight reduction, whitespace and selective real visual texture—not with decorative gradients.

## Architectural Elevation: architecture as information

**Inspiration:** Building elevations, drafting sheets, reference axes, orthographic projections, annotations and clear information hierarchy.

**What the interface should feel like:** Thoughtful, analytical and distinctive. It suggests that the consultancy understands property as something to be investigated and explained, without requiring the visitor to understand architectural drawings.

**Drawing rules worth testing**

- Reference lines align with **actual page grids**, labels and data; avoid magic pixel offsets that break when content changes.
- Section numbers and small caps support orientation, not decorative technical jargon.
- Thin outlining with generous empty space, rather than wall-to-wall strokes.
- Sanserif headings and readable explanatory copy, with restrained mono indexing.
- Orthographic **offset** shadow can reveal stacked information planes; avoid perspective transforms that make text less stable.
- Real measurement labels are permitted only for verified dimensions with correct units/meaning. An illustrative graphic cannot masquerade as the real property plan.

**What could go wrong:** Microtype becomes illegible; meaningless datums accumulate; visual complexity displaces actual content; the site feels like CAD software rather than a human service. Remove any drawing mark that cannot explain its relationship to content.

## 3-D effects: why we chose restraint

3-D should communicate depth or action state, not demonstrate technical novelty. The two directions intentionally have **different** semantics:

| Test | International | Elevation |
| --- | --- | --- |
| Flat state | Structural grid with no depth shadows | Orthographic sheets with fine outlines |
| Relief state | Inside-panel recession and restrained shade | Small parallel offsets between sheets |
| Animation allowed | Surface/focus reveal, minimal easing | Sheet/focus reveal, orthographic only |
| Not allowed | Whole-card float, 3-D rotation, large parallax | Arbitrary perspective, spinning buildings, endless coordinate motion |

Do not hide critical text until hover. Touch and keyboard users must receive the same affordance. If reduced motion is requested, the selection/focus state must remain clear with static cues.

## Typography, whitespace and grid discipline

The site benefits from a small functional type system instead of many arbitrary headings:

1. **Index:** roughly 12px, often mono, for metadata.
2. **Reading:** approximately 14–16px, for labels and body copy.
3. **Section:** approximately 24px, for property names and tile headings.
4. **Display:** roughly 40–52px, for the main claim and pivotal questions.

These are working roles, not a ban on responsive adjustments or accessibility zoom. IBM Plex Sans is the current control; the legacy type library exists for research, not as a proposed multi-font production implementation.

Margins should expand smoothly, with deliberate constraints at smaller widths. Whitespace supports hierarchy. A continuous skeleton is desirable, but **not every object needs its own visible border**.

## Actions and interaction signals

- An interactive tile has a clearly visible, underlined action at rest.
- Keep one clickable target per task tile, rather than a whole-card button that also contains an independent link.
- Reserve clear icon semantics: internal navigation `→`, genuine external/WhatsApp/outbound `↗`, disclosure/expansion with a separate cue.
- Interactive hover can enrich but may not create the only visible explanation.
- State changes must be visible to keyboard users; focus should remain distinct from decorative material accents.
- Fewer decisions above the fold are preferable to indiscriminately exposing every business category at equal visual weight.

## Anti-patterns explicitly rejected

- AI-slop gradient blobs, random pills, generic luxury gold everywhere, glows and meaningless sparkle.
- Infinite scrolling feature cards and equal-weight dashboards.
- Stock skyscraper hero illustrations as a substitute for actual local property context.
- Counter animations, unverified “happy clients,” invented investment returns or fabricated awards.
- Heavy 3-D, motion tied to scroll without benefit, cursor tricks and mandatory hover.
- Overly literal blueprint/CAD interfaces and decorative fictitious dimensions.

## Central unresolved question

**Could the result be both distinctive and trusted?** International Style is the provisional commercial favorite; Elevation is the stronger artistic challenger. That is an inference, not test evidence. Keep both alive until homepage, search and property-detail journeys have been compared fairly.
