# 04 — Test and Review Plan

This plan distinguishes automated checks, manual accessibility QA, visual review and actual usability research. It is **not** a claim that all these tests have already been performed.

## A. First reproduce the baseline

1. Run `python3 -m http.server 8000 --directory dist` from the package root.
2. Open `http://localhost:8000/` with the study controls visible.
3. Select International, then Elevation; test flat and relief and the no-fourth-color baseline.
4. Toggle visitor mode; confirm customer layout is not distorted by the studio control bar.
5. Visit home, results, locations, advice, owner advice and About. Confirm all flows are interactive.
6. Run `node --test study-controls.test.cjs` and the four JS syntax checks shown in the root README.
7. Record actual failures with browser/device and exact URL. Don't silently repair or mislabel failures as expected design differences.

## B. Visual QA matrix

| View | International | Elevation | Desktop | Tablet | Mobile |
| --- | --- | --- | --- | --- | --- |
| Home and search | Structural seams, red anchor | Meaningful guides, legible index | 1440 / 1280 | ~768 | 390 / narrow ~320–360 |
| Browse/results | Continuous but not overboxed | Clear index and sheets | Yes | Yes | Yes |
| Empty sample state | Honest copy / visible path | Honest copy / visible path | Yes | Yes | Yes |
| Locations | Atlas potential, no fake facts | Survey potential, no fake measurements | Yes | Yes | Yes |
| Advice / owner | Contact hierarchy | Contact hierarchy | Yes | Yes | Yes |
| About and footer | Brand/trust consistency | Document/trust consistency | Yes | Yes | Yes |
| Studio vs visitor | Controls don't shift baseline | Controls don't shift baseline | Yes | Yes | Yes |

Look for clipped headings, uneven tile heights, too many visible rules, action labels that wrap or disappear, horizontal overflow, misleading hover effects and misaligned Elevation datums.

## C. Functional scenarios

### T1 — Simple known-property search

**Task:** Find a residential example in Gurugram, inspect its key details, and start an enquiry.

**Expected now:** The prototype filters the sample and can open WhatsApp with a property reference. **Expected later:** A verified property-detail page and preserved prior filters.

### T2 — No rental sample

**Task:** Find a rental in Nirvana Country.

**Pass now:** The site explicitly says this small sample has no rental examples and provides a relevant consultation route. It must not imply AUM ESTATES has no rentals in reality.

### T3 — No land sample

**Task:** Explore land opportunities.

**Pass now:** Same honesty plus land-specific conversation/requirements path.

### T4 — Locality with no sample match

**Task:** Explore Golf Course Road or another currently unrepresented area.

**Pass now:** Recovery and consultation available. **Expected R4:** A real, sourced locality profile even without matching sample listings.

### T5 — Filters

**Task:** Apply location and type; remove one filter; reset; use back; copy/share a link.

**Known current gap:** Filter state does not fully survive a deep link. R2 must fix it.

### T6 — Owner

**Task:** Start a sale/lease conversation about an owned property.

**Pass:** Clear ownership-oriented CTA and message with a relevant purpose; no overlong forms.

### T7 — Verified information

**Task:** Determine price, location, area and source of one property.

**Pass:** Visitors can distinguish verified values from unknowns and representative imagery. Unavailable fields are not invented to complete the grid.

### T8 — Design controls

**Task:** Choose Elevation + cobalt + flat, navigate around, then return or reload.

**Pass now:** URL preserves the selected architecture/color/depth and reload remains coherent. Retired Skyline setting safely resolves to International.

### T9 — Mobile interaction

**Task:** Open/close filters, interact with menu, choose a property, navigate back.

**Known gap:** Full focus containment and restoration in the tray remains to be implemented and audited.

### T10 — External navigation

**Task:** Identify which actions leave the prototype or start WhatsApp/phone communication.

**Pass:** Labels and arrow semantics correspond to actual behavior; target URLs are authentic.

## D. Accessibility / robustness

- Keyboard: Tab/Shift+Tab cycle, Enter/Space activation as appropriate, Escape where relevant, visible focused element, return focus from modal/drawer.
- Interaction: no essential hover-only text; active/focus states persist on touch.
- Viewports: at least wide desktop, laptop, tablet, 390px and narrow mobile; 200% browser zoom/text enlargement.
- Motion: `prefers-reduced-motion: reduce` preserves meaning and control states.
- Color: test text, controls, iconography and focus contrast against white/red/ink; fourth material never becomes the sole state cue.
- Forms: explicit labels, keyboard-operable selects and buttons, meaningful error/empty feedback.
- Navigation: URL/hard reload/back/forward; no lost requirements when entering advisor route.
- Images: real source, correct property match, legible alternate description, understandable fallback on network error.
- Performance: compare font/CSS/JS/image payload between modes; avoid large animation costs and layout shifts.
- Screen reader: meaningful heading order, distinct regions, labels, filter count announcement, decorative guides hidden semantically.

**Reference standard:** Aim for WCAG 2.2 AA for a potential production rebuild; the prototype does not yet have a documented conformance result.

## E. Usability method

Use a small mixed set of participants for formative learning; do not claim statistical significance from a handful of sessions. Include property seekers, an owner/landlord and people with differing Gurugram familiarity.

**Run the same tasks on both concepts** in counterbalanced order. Keep facts, labels and available actions identical for a fair visual-architecture comparison. Record:

1. First action; correct/partial/incorrect path.
2. Time and steps to a meaningful outcome.
3. Wrong turns, rereads, filter reset/recovery events.
4. Whether unknown fields are understood as unknown.
5. Confidence in the business and *why*.
6. Perceived distinctiveness versus professionalism.
7. Exact participant quotes, not paraphrases alone.
8. Browser, viewport, keyboard/touch and design-state settings.

Avoid leading questions such as “Does the façade look premium?” Ask what stands out, what the participant expects when clicking, and what they would do next.

## F. Paired release gates

| Gate | What must be checked |
| --- | --- |
| R0 | Baseline routes and data provenance characterized; tests reproducible |
| R1 | Recognizable business, city and primary task; no hover dependency; intentional mobile layouts |
| R2 | Contextual filters, truthful empty states, URL/history persistence, accessible mobile tray |
| R3 | Verified property detail, matching imagery, known/unknown transparency, contextual enquiry |
| R4 | Sourced locality and real practice details, useful advisory flows |
| R5 | Depth/fourth hue do not harm comprehension, accessibility or speed |
| R6 | Full cross-page design coherence, performance/accessibility pass and evidence-led comparison |

## G. Review report template

For every release, create a brief report:

```text
Release:
Date:
Source revision:
Study URL:
Changed in International:
Changed in Elevation:
Shared customer behavior changed:
Data/source facts re-verified:
Automated tests and result:
Browser/device checks completed:
Moderated task observations:
Design-quality observations (inference):
Regression or unresolved risk:
Go / revise / stop:
Next smallest experiment:
```

If a browser preview fails, record it explicitly rather than claiming a visual pass.
