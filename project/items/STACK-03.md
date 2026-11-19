# STACK-03 — Accessibility testing, standard depth, at AAA

## Intent

The owner chose "Standard now, extended before v4.0 (Recommended)" for accessibility testing (Q22). This item makes the accessibility pack's standard run (Playwright and axe in a real browser, at level AAA) part of v4's gate from the empty shell onwards, so every later item is tested in a browser as it lands.

## Acceptance criteria

- The accessibility pack's four specs (states, keyboard, adaptation, journeys) run headless in Chromium against the shell, at level AAA, in CI for every v4 change.
- A planted fault (a contrast below 7:1, a target under 44 px) fails the run, and the pull request says so (non-vacuity).
- The run's output goes to a temporary folder, never the checkout.
- It changes only these paths: playwright.config.*, tests/a11y/**, tools/a11y-run.mjs (the pack's), package.json (scripts) and .github/workflows/ci.yml; it runs before STACK-04, which shares the last two.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-19

Next step: None in this item; STACK-04 sorts the pack's three tools and `project/a11y/` as v4 (this item's first wish), and each later item declares its new states, journeys and features in `tests/a11y/project.mjs` and `project/a11y/coverage.json`.

Open question: Owner: whether to keep the shell's link and its wording, where the routed document lives once he signs the Accessibility testing line, and the pinned versions and Chromium download (the wishes and the night's list).

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §19
- [STACK-02](./STACK-02.md)

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Standard now, extended before v4.0 (Recommended)" (Q22). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules (the plan's §18; the night's decisions list).
- 2026-11-19 — Built and closed by STACK-03's pull request (#178). The owner's instructions in force, verbatim, unchanged since the note above: "Standard now, extended before v4.0 (Recommended)" (Q22); overnight, "Yes, read and install (Recommended)" (G4), "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". So every pin, the Chromium download, the shell's link and the paths beyond the item's list are provisional, put to him in the night's list. Beyond the item's paths, each the smallest change: the pack's report tool and its validator beside the run, `project/a11y/` (the catalogue, the coverage file and the routed document), `package-lock.json`, `knip.json`, `THIRD_PARTY_NOTICES.md`, `scripts/gate.test.mjs` and `src/editor/App.tsx`; the Playwright configuration stays the pack's, in `tests/a11y/`. A finding: at AAA the pack's focus test fails a state with no control, which the empty shell was.
