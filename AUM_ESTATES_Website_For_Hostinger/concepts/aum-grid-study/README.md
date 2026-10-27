# AUM ESTATES — Grid Design Study 03

This directory contains **the actual working, reviewed HTML/CSS/JavaScript implementation** of the Dieter Rams-inspired AUM ESTATES grid concept. It is not a prompt, screenshot reconstruction, or implementation brief.

The concept is intentionally isolated from the website's current homepage and listing pages. It is a self-contained alternative that can be tested and adopted gradually, without replacing production.

## Run it

From `AUM_ESTATES_Website_For_Hostinger`:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/concepts/aum-grid-study/`.

The directory can also be served as ordinary static files by Hostinger. No build step or JavaScript framework is required.

## Exact implementation files

| File | Purpose |
| --- | --- |
| `index.html` | Semantic page structure, navigation, task tiles, search, subviews, and design controls |
| `styles.css` | Shared layout, accessible controls, listings, and footer |
| `grid.css` | The 12-column homepage grid and matching subview grammar |
| `main.js` | Navigation, filtering, view state, and demo property cards |
| `study.css` | Six color palettes, six font systems, and study control styling |
| `study.js` | Live theme switching, URL persistence, and reset/share controls |

### Design principles embodied in the source

- The grid is a task index: prominent search, Buy, Rent, Commercial, Plots & Land, Locations, List a Property, and Advisor.
- Strong 12-column layout; narrow dividers; generous exterior margins; restrained typography; limited text.
- Progressive disclosure on hover and keyboard focus; essential meaning is never hover-only. Touch users receive visible information.
- One straightforward property search from the homepage; further filters appear on the results view.
- A compact homepage footer and information-rich inner-page footer.
- Responsive layouts, visible focus states, and reduced-motion handling.

### Design Study 03 controls

The top ribbon offers six color palettes and six type treatments. Changes modify the real page instantly. URLs can reproduce a chosen combination, for example:

`?palette=plaster&type=instrument`

The default (`palette=mineral`, `type=plex`) reproduces Study 02's oxblood/mineral IBM Plex presentation. All changes are reversible.

## Important integration notes

- This is **a concept**, not the production homepage. Nothing in this folder modifies `../..` production routes or data.
- The browse view uses a small fixed set of public property examples, not a live backend/inventory API. For production, connect the UI to the repository's authoritative listing data and verify availability, pricing, and images.
- Property photographs are currently requested from `https://aumestates.com/assets/...`; the font stylesheets load from Google Fonts. Serving this concept offline or without network access will require local copies of these assets.
- Contact links are real contact destinations taken from the public site; use test data if you run end-to-end enquiry tests.
- The visual behavior and tokens in these six source files are the canonical design contract. When integrating production data, preserve the grid geometry, type scales, colors, interactions, and spacing unless a deliberate reviewed design change is made.

## Suggested adoption sequence

1. Review this route in desktop and mobile viewports.
2. Select and freeze one color/type combination; remove the design lab from the eventual public-facing version.
3. Replace sample browse data with real approved inventory and tested filter semantics.
4. Validate accessibility, search journeys, and enquiry flows before replacing the production homepage.

The current live private demonstration is: `https://aum-estates-grid-study.udiboy98.chatgpt.site/`.
