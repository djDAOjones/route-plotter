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

Updated: 2026-11-18

Next step: Start once STACK-02 has merged.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-6
- `reviews/v4-architecture-plan-2026-11-18.md`: §19
- [STACK-02](./STACK-02.md)

## Notes

- 2026-11-18 — Filed by PLAN-6 from the architecture plan (`reviews/v4-architecture-plan-2026-11-18.md`, §19). The owner's instructions in force, verbatim: "Standard now, extended before v4.0 (Recommended)" (Q22). Under the owner's overnight grant G3, "Proceed on recommendations (Recommended)" (word for word in the plan's Appendix A), this item builds on the plan's recommended options, each provisional until he rules (the plan's §18; the night's decisions list).
