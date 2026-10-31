# 05 — Copy into Codex for local iteration

```text
You are working on the AUM Estates v16 local brand and property-experience study.

FIRST READ (in this order):
1. README.md
2. BRAND_DIRECTIONS.md
3. docs/01_PRODUCT_AND_BRAND_FOUNDATIONS.md
4. docs/02_INTERACTION_AND_DATA_CONTRACT.md
5. docs/03_RESPONSIVE_AND_VISUAL_QA.md
6. docs/04_NEXT_ITERATIONS.md

This is a complete buildless static site in dist/. Run it locally using:
python3 -m http.server 8080 --directory dist

Do not change, push to, or deploy the live aumestates.com repository.
Do not assume these six sample property references are live or verified.
Preserve the existing search/detail/compare/enquiry behavior and its fact/source distinctions.
Keep the five brand directions separate and recognizable in this study.

TASK: Conduct a problem-first product UI audit, prioritizing precise spacing,
alignment, box relationships, readable responsive layout, the search-to-Property-
Index hierarchy, progressive category disclosure, footer rhythm, semantic links,
focus/keyboard behavior and mobile touch behavior.

For each proposed change provide:
- The observed issue and affected user task.
- Exact selector/component/source file and reproducing viewport.
- A concrete implementation proposal and the design rationale.
- Alternative considered, trade-off and regression risk.
- An objective acceptance test.

Then implement only the highest-impact coherent first batch, keeping edits small
and reversible. Validate at 320, 375, 768, 1024 and 1440px, across all five
brand directions where presentation differs. Test search, detail, save/compare,
enquiry, keyboard, focus, and reduced-motion/GPU fallback as applicable.

Report: changed files, before/after evidence, tests actually run, failures and
what remains unverified. Never claim browser/visual QA occurred unless it did.
Do not introduce new visual decoration until the base product grid is precise.
Do not change deployment, hosting identity or user data without authorization.
```

After this audit, work through the phases in `04_NEXT_ITERATIONS.md`. Keep a living `DECISIONS.md` in your local branch with dated evidence for nontrivial changes.
