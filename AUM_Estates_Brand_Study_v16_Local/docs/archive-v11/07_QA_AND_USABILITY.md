# 07 — QA and usability checklist

The private study was manually reviewed in the browser during v10/v11 for desktop, tablet and narrow mobile; key interactions were exercised. **This does not equal exhaustive cross-browser, accessibility or production-data certification.** Run the following from the local export after any meaningful change.

## Responsive matrix

| Width | Check |
| --- | --- |
| 320 px | No horizontal overflow; logo/menu, inputs, property rows, detail headings and sheets usable |
| 390 px | Primary selector immediately discoverable; inventory begins without redundant marketing gates; detail identity before image |
| 560–600 px | Verify row transition; photo and actions remain grouped correctly |
| 768 px | Tablet detail order; name → image → published facts; header actions do not collide |
| 900–1024 px | Breakpoint transitions; filter fields, results and detail rail; no orphan action row |
| 1280–1440 px | Hero/inventory alignment, readable column measures, detail fact rail, footer balance |
| 1560+ px | Max canvas centered; gutters deliberate; no stretched paragraphs or media |

Check at 200% browser zoom and with text-only zoom when possible. Never assume a CSS breakpoint alone proves the layout works.

## End-to-end regression flows

- [ ] Default page opens at property index; first primary action is obvious.
- [ ] Buy/Rent/Commercial/Land selector changes content and preserves accurate empty-state language.
- [ ] Keyword search works with project, locality and type terms.
- [ ] Area select filters the small sample correctly; All areas can show the Goa entry.
- [ ] Advanced filters expand/collapse; selected value works; clear/reset behaves correctly.
- [ ] Price filtering excludes “price on request” references, with an understandable explanation.
- [ ] No-results state has a useful route back or consultation.
- [ ] Result count matches displayed rows.
- [ ] Image click and View details open the correct property.
- [ ] Direct detail URL loads the expected property on refresh.
- [ ] Browser Back/Forward does not strand the visitor.
- [ ] Previous/Next updates property name, image, facts, source reference, status and URL.
- [ ] Sources tab shows correct reference ID and representative-photo disclosure.
- [ ] What to check selection persists for the same property and is included in prepared enquiry.
- [ ] Notes persist in the same browser, are private, and are not claimed as transmitted.
- [ ] Save up to three references; fourth attempt explains capacity; remove and compare.
- [ ] Detail save state and index saved count agree.
- [ ] Copy detail link copies the current property link and resets text on property change.
- [ ] Enquiry review remains editable and nothing is sent without user action.
- [ ] Telephone and WhatsApp links resolve correctly on supported devices.
- [ ] Menu, Areas, About, Source & disclaimer, Saved and consultant sheets open/close reliably.

## Accessibility and interaction

- [ ] Entire flow works with keyboard, including dropdowns, tabs, menu, sheets and save controls.
- [ ] Escape closes overlays and focus returns to a sensible origin.
- [ ] Focus never escapes an open modal sheet or gets hidden behind one.
- [ ] Touch targets are comfortably usable on phone.
- [ ] Link affordances do not rely solely on hover.
- [ ] Form fields have visible labels, not just placeholders.
- [ ] Active tabs have programmatic selected states; arrows/Home/End work.
- [ ] Expanders expose the correct expanded/collapsed state.
- [ ] Images have accurate alt text and fallback behavior.
- [ ] Screen reader announces property changes without overwhelming repeated unrelated content.
- [ ] Text meets contrast standards and is readable at enlarged sizes.
- [ ] No animation is required to understand or complete a flow; reduced-motion behavior is respected.

## Visual logic review

For each component, inspect:

- **Box:** natural width, max width, padding, border, overflow, responsive behavior.
- **Alignment:** left/right edges, baseline, relation to neighboring title or value.
- **Spacing:** inside related data groups smaller than between unrelated groups.
- **Typography:** role, weight, line-height, line length, wrap at real content lengths.
- **Color:** red indicates priority/state/action; muted text remains readable.
- **Action:** one obvious next step, secondary actions visibly secondary.
- **State:** empty/loading/error/selected/disabled/unknown values are not visually confused.
- **Content:** no repeated “explore inventory” prompts, no vague value claims, no false urgency.

Use real strings with worst-case lengths, not “Lorem ipsum.”

## Suggested unmoderated tasks

Give visitors a goal, not instructions telling them which control to use:

1. “You have a first-home budget and want to see properties in Sector 61. Find one and tell me what is still unknown.”
2. “You need a rental and want to explain your needs. Where would you start?”
3. “You are moving with family. Find the questions you should ask before scheduling a visit.”
4. “Compare two properties. Can you tell which details can and cannot be compared reliably?”
5. “Open a specific property someone shared with you. Can you verify the source and contact the adviser?”

Measure time to first meaningful result, wrong turns, hesitation, task completion and whether the visitor correctly identifies uncertainty. Avoid leading questions like “Do you like the clean design?”

## Release gate

Do not call the work ready for production until the real data path, content provenance, accessibility, privacy, performance, and business/legal approval have been separately verified.
