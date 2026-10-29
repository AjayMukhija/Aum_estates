# AUM ESTATES — Architectural Grid Study 06

A working, isolated exploration of two architectural directions for an urban real estate advisory website. This iteration addresses grid hierarchy, typography, navigation affordance, architectural depth, secondary hue discipline, destination-page continuity, and visitor-view presentation. Built from the prior grid study; the original Site and production AUM ESTATES website are unchanged.

## Two spatial systems

| Mode | Architectural idea | UI implementation | Principal trade-off |
| --- | --- | --- | --- |
| International Style | Repeated facade bays and mullions | Strong search-to-browse division, nested glazing cues, fixed structural frame and recessed hover depth | Most restrained professional foundation |
| Architectural Elevation | A measured drawing with datums | Shared reference axes, continuous lines through gutters, drafted registration marks and offset planes without perspective tilt | More authored and technical |

The eight tasks remain: search, buy, rent, commercial, land, locations, owner listing, and human advice. All destinations and the prototype inventory/search demonstration are retained. No backend data connection was added.

## Run locally

Serve `dist/` using any local static HTTP server, for example `python3 -m http.server 8000 --directory dist`, then open `http://localhost:8000/`.

The two modes are selected through the studio control. Mode is stored in the URL as `?architecture=international` or `?architecture=elevation`, and locally remembered between visits. An obsolete `?architecture=stepped` link resolves to the International baseline. Use the fixed **VIEW AS VISITOR** button to hide the studio chrome and inspect the actual visitor composition; the current state is encoded as `?presentation=1` and can be reversed from the same button.

## Material and depth experiments

- **4th color:** `?fourth=none` (default), `?fourth=cobalt` (`#3154A5`), `?fourth=bronze` (`#956C35`), or `?fourth=verdigris` (`#36766C`). The fourth hue is used as architectural detail: a joint, annotated corner, edge, or colored shadow. It is **not** applied to body copy or a competing call-to-action. Fourth-color effects are intentionally scoped to the **Red / White / Ink** palette; the other 10 legacy palettes can still be tested independently.
- **Dimension:** `?depth=relief` (default) or `?depth=flat`. Relief is now explicitly *recessed* in International Style and *orthographically offset* in Elevation. The selected tile's front plane remains stationary. No ambient rotating building, extreme perspective, or scroll-jacking.
- **Click affordance:** each task tile now includes a visible, underlined action (such as "Browse homes ↗") even without hover. The complete tile is still one accessible button. Supporting copy is never hover-only.
- **Hierarchy and margins:** IBM Plex Sans remains the default. Key type roles use 12/14–16/24/40–52px. The `.shell` outer margin scales smoothly instead of jumping abruptly at breakpoints. Search, browse and advice are described as distinct entry paths.
- **City-specific credibility:** AUM ESTATES' Gurugram advisory positioning and Ajay Mukhija's role are carried into the grid's supporting copy using source-verified information; no invented performance claims or testimonials were added.
- **Destination continuity:** both architectural styles now reach property results, location choices, about information, and the advisory view. International uses stronger common dividers, Elevation uses fine drafting outlines and subtle sheet offsets. The data, forms and navigation logic are unchanged.

Both controls can be combined with architecture, legacy palette, and typography parameters. They are locally remembered and reflected in the URL. Keyboard focus remains visible; motion is suppressed for users who prefer reduced motion.

## Files

- `dist/index.html`: full task model, study controls, page structure.
- `dist/styles.css`, `dist/grid.css`, `dist/main.js`: retained original functional base.
- `dist/study.css`, `dist/study.js`: color and typography token systems.
- `dist/architecture.css`, `dist/architecture.js`: two composition modes, fourth-color tokens, optional relief, switcher state.
- `dist/refinement.css`, `dist/refinement.js`: coherent design-system refinements and customer-eye preview toggle.

The default style uses white `#FFFFFF`, near-black `#151515`, and red `#EF4037`. Its broad exterior margins and red search anchor remain the comparison baseline. Fourth colors are subordinate by design. Architectural variants change composition, not the meaning of a task.

## Review criteria

Compare each version on desktop, tablet and mobile. Assess first-task recognition, text legibility, scanning order, accidental visual competition, available navigation on touch/keyboard, and how easily the grid extends to property results. Do not mistake visual novelty for superior task performance.

The proof-of-concept inventory contains a small fixed set of public examples; it is not a live listing feed. Confirm property media, availability, pricing, and contact details against the authoritative AUM ESTATES source before adoption.
