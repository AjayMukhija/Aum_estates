# Stage 4 — Evaluation and recommendation

Written after building and testing the study in `dist/`, not alongside the art direction. Where the build changed my mind, it says so.

## Scores

Seven criteria, scored 1–5. These are judgements, not measurements; the reasoning matters more than the number.

| | A Setting Out | B Section Cut | C Scale & Schedule | D Raking Light |
| --- | :-: | :-: | :-: | :-: |
| 1. Architectural coherence | 5 | 5 | 4 | 3 |
| 2. Information hierarchy | 5 | 3 | 5 | 3 |
| 3. Professional credibility | 5 | 3 | 4 | 3 |
| 4. Visual distinctiveness | 4 | 4 | 5 | 2 |
| 5. Interaction quality | 5 | 3 | 3 | 4 |
| 6. Accessibility & responsiveness | 5 | 3 | 3 | 5 |
| 7. Performance & implementation cost | 5 | 3 | 2 | 5 |
| **Total** | **34** | **24** | **26** | **25** |

### 1. Architectural coherence

A and B are the two that survive the question "would an architect recognise the convention?" A draws setting-out lines and dimension strings; B draws a section cut with poché at the edge. Both are specific, both are drawing conventions rather than architectural *imagery*, and neither draws a building.

C is coherent as a drawing convention — the scale bar and the schedule are real sheet furniture — but it is weaker as *architecture*, because a scale figure is a measurement convention shared with cartography and statistics. D scores lowest here despite being the most physically architectural idea: raking light and the shadow gap are real, but at 1px they are so restrained that the reference is invisible. You cannot recognise a convention you cannot see.

### 2. Information hierarchy

A and C are the only two that improve Find → Understand → Decide. A's datum originates at the control the user touched and terminates at the register, which is the cause-and-effect link audit observation A says is missing. C adds a genuinely new comparable to Understand.

B and D are neutral at best. B's wipe tells you a region opened, which the region opening already told you. D tells you which row your pointer is on, which is useful but small.

### 3. Professional credibility

A is the most credible because it is the most boring: 1px lines arriving and departing, nothing that could be mistaken for a flourish. C is credible until the data lets it down — a register showing "area not published" three times in the first five tiles reads as a broken feature rather than an honest one, and credibility is exactly what that costs.

B loses most here, and this is the finding that changed my mind during the build. **At the specified 240ms the wipe looks like a slide transition, not a section cut.** I built it, watched it at 0.25× and at 1×, and the architectural reading only survives when the travelling cut line is visible — which it is at 960ms and is not at 240ms. There is no duration at which it is both short enough for a disclosure and long enough to read as a cut. That is a structural problem with the concept, not a tuning problem.

### 4. Visual distinctiveness

C wins outright: no competitor in Gurgaon real estate draws area to scale, and the register becomes recognisable from a screenshot. A is distinctive but quietly — it would be recognised by someone who looks twice. B's wipe is the least distinctive thing in the study because every slide deck does it. D is nearly invisible, which is the point and also the problem; scoring it 2 here is not a criticism of the execution.

### 5. Interaction quality

A felt best in use, and the thing that made the difference was not the motion. It was the `aria-live` region and the interpolated count. With the register scrolled past the desk, changing a filter now announces itself three ways — the figure moves, the summary line rewrites, the live region speaks — and it is the *redundancy* that makes it feel solid.

B is the worst in use, for a reason I did not anticipate and then had to correct. My first note said the wipe could not be interrupted and left a half-cut. **Tested, that is wrong** — toggle a category twice quickly and it settles correctly: the clip resolves to its base state and the region reaches full height. What is true is milder and still a real flaw: the clip animation and the height transition are two independent timelines on the same element, so during an interrupted toggle they visibly disagree — content is clipped against a height moving to its own schedule — before self-correcting. A, C and D have one timeline each and never show that.

D is good and cheap. Hovering the register with a shared light direction is quietly satisfying and it fixed a real gap: tiles previously had almost no focus affordance.

### 6. Accessibility & responsiveness

Tested at 375, 768, 1180 and full width via the study's container queries, plus the reduced-motion simulator, keyboard traversal, and `forced-colors`.

A and D pass cleanly. Both resolve to a correct page with motion off; D's lit focus state is `transition`-only, so it survives reduced motion as an instant state change and remains the focus indicator — verified: `inset 0 1px 0 0 #fff, 0 1px 0 0 #ab392c` is identical with the simulator on and off.

B and C score 3 for the same underlying reason: both animate things that are *not* purely decorative. B's clip-path hides content mid-animation, so a screen reader and a sighted user briefly disagree about what is on the page. C's figures are information, which means under reduced motion they must render complete and instantly — they do — but it also means C can never use motion to introduce them, which removes most of what made C a *motion* concept.

### 7. Performance & implementation cost

**Measured first, because my prediction was wrong.** I expected B to drop frames. Sampling `requestAnimationFrame` intervals across a category disclosure, all five settings are indistinguishable on this machine:

| | baseline | A | B | C | D |
| --- | :-: | :-: | :-: | :-: | :-: |
| Median frame | 13.3ms | 13.3ms | 13.3ms | 13.3ms | 13.3ms |
| 95th percentile | 14.2ms | 14.2ms | 14.3ms | 14.2ms | 14.2ms |
| Frames over 20ms | 0 | 0 | 0 | 0 | 0 |

So the honest statement is: **at six tiles per category on a current desktop, none of these four costs anything measurable.** B's composite-layer concern remains real in principle — `clip-path` on a container of images is the one mechanism here that forces a large layer — but it is unverified at register sizes and on hardware I did not test, and it should not be scored as though it were measured. B keeps a 3 rather than a 5 on that basis, not a 2.

The durable difference is build cost, not runtime. A and D animate only `opacity`, `transform` and colour; D adds no DOM at all; both are an afternoon of CSS. C is the most work by a distance: per-category maxima, √-scaling, a per-tile SVG, a re-scale on every filter change, and a designed absence for the 30 records with no area — and every one of those is a place where a wrong number becomes a wrong picture.

The ornament bench settles its own question. The SVG datum field is 14 nodes and draws **0 frames**; the canvas sun study drew **31 frames at ~373,000 pixels each** to move the pointer across one panel, producing soft bands that the SVG renders as crisp hairlines at any zoom and in print.

## Recommendation

**Develop: A — Setting Out, as the core system.** It wins on five of seven criteria and loses on none. Roughly 60% of its value is not motion at all but the things the motion forced into the design: a live region, a redundant count, a cause-and-effect link between the control and the register. Ship those even if every animation is cut.

**Develop: D — Raking Light, as hover and focus only, composed into A.** These two do not conflict: A owns state change, D owns the resting surface. D's entire footprint is 1px of edge colour on `:hover` and `:focus-within`, and it fixes a genuine focus-visibility gap. Hard limit: the moment a highlight becomes a gradient or a shadow gains a blur radius, it has become the faux-3D the baseline refused, and it should be reverted rather than tuned.

**Hold: C — Scale & Schedule.** The strongest idea and the one I most want to be right, but it is blocked on data, not design. Thirty records publish no area, they cluster visibly, and no amount of careful drawing makes a 9% "not published" rate look deliberate. Revisit if area coverage reaches ~98%. Even then, test the footprint misreading with five people before building — the rectangle's honesty depends entirely on users not reading it as a plan, and that is an empirical question.

**Discard: B — Section Cut.** Architecturally the most convincing idea on paper and the clearest disappointment in the build. The deciding reason is not performance — measured, it costs nothing — it is that there is no duration at which the thing reads as a cut *and* behaves as a disclosure: short enough to be a disclosure and the cut line is gone before you see it; slow enough to see and it is a slide transition. Dual timelines that visibly disagree under interruption are a secondary strike. Keep the one part worth keeping — opening a category should resolve its height over ~220ms rather than snapping — and implement it with the plain `grid-template-rows` transition from Concept A.

**Discard: the canvas and WebGL ornament**, including the Sun and Atlas shaders the brand document already permits. The SVG datum field does the same job at zero frames, survives print and forced colours, and does not imply a light source or facade orientation belonging to no property in the register. Permission is not a reason.

## Do these first, regardless of which concept is chosen

These came out of the audit, not the art direction, and all four are worth more than any animation in this study:

1. **Add a live region to the property index.** There is none anywhere in production. A screen-reader user currently changes a filter and is told nothing. One `role="status" aria-live="polite"` element and one line in `executeRender()`.
2. **Fix the empty state's styling.** `data/inventory-search.js:754` styles its two buttons with `--bg-page`, `--text-main`, `--border-light` and `--oxblood`, none of which the Datum stylesheet defines, so the primary action renders with no background. There are 74 such references to undefined variables across the production HTML and JS; the empty state is the one where a user sees it.
3. **Give the empty state the user's filters back.** Preserve each one, show what removing it would return, and solve for the smallest set of removals that actually helps — with real data, "Lease · Builder floor · Golf Course Road" has no single removal that returns anything, so an empty state offering "drop one filter" leads to another empty state.
4. **Design the missing-photograph state.** 121 of 347 records (35%) point at an image file that is not on disk, and production shows flat grey under a badge claiming a representative photograph. This is a correctness problem wearing a visual-design costume, and it is more damaging to trust than anything motion can fix.

## What I would not do next

Build more concepts. Four was the right number and two of them should be discarded; a fifth would be a variation, not a direction. The next useful step is a five-person task test on A + D against the current site — find a property, change a filter, understand why a search returned nothing — not another round of art direction.
