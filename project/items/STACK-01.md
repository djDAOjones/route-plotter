# STACK-01 — v4 at the root on the editor stack

## Intent

The owner chose to "Rebuild v4 as a new app with the full PM-Skills stack from the start: the app opinion (editor), accessibility testing at AAA, and the architecture record" (Q1), in this repository at its root (Q5), with the editor stack adopted whole (Q21) and accessibility testing "Standard now, extended before v4.0" (Q22). This item lays those foundations once the architecture plan has ruled how: v3's source moves aside as the porting reference, the packs are installed, and v4's own gate runs with layers and module edges enforced. It builds no feature.

## Acceptance criteria

- v3's source moves aside as the architecture plan rules, stays recoverable at tag v3.3.726, and still builds and passes its suite when v3 code changes.
- The PM-Skills 5.0.1 packs are installed by their own route: the app opinion "editor", accessibility testing at level AAA and depth standard, and the architecture record. The profile's App opinion and Accessibility testing lines are written as the pack's intake says, for the owner's signature.
- Every package's exact version is pinned and shown to the owner before the merge.
- v4's gate runs types, lint, boundaries, dead code, tests in parallel, build and the accessibility checks inside 10 minutes, a finding if exceeded, wired into GATE-01's sorting.
- Layers and module edges are enforced in the gate as the architecture plan sets them, with the plan's measure that adding a feature touches only its own module.
- Today's `project/architecture.md`, v3's and without the pack's mark, is moved aside as v3's reference before the architecture record takes its path. This is the session's proposal, for the owner to confirm.
- Every signed line the install makes untrue is redrafted for the owner's signature.
- The result is an app that builds, passes its gate and shows an empty shell.

## Now

Updated: 2026-11-18

Next step: None until the architecture plan (MERGE-01) is decided and this item's phase opens by its own PLAN entry.

Open question: Whether PM-Skills' pilot row and Set 1 pin apply to v4, and whether the canon framework copies under `pm_skills/` are retired at the move (wish INTAKE.32); both go to the owner when this phase is planned.

## Context and sources

- [The decisions](../decisions.md): PLAN-5
- `reviews/v4-vision-question-rounds-2026-11-18.md`: Q1, Q5, Q6, Q16, Q21 and Q22, and round 6's note of what the pack holds
- `reviews/v4-programme-2026-11-18.md`: findings F6 and F11
- `verbs/intake.md`: the App opinion and Accessibility testing lines
- `project/architecture.md`: v3's architecture file

## Notes

- 2026-11-18 — Filed by PLAN-5. The owner's instructions in force, verbatim: the Q1 sentence quoted in the Intent; "This repo, v4 at the root (Recommended)" (Q5); "Adopt the editor stack whole (Recommended)" (Q21), whose option text reads "exact versions are pinned by the item that installs them and shown to you then"; "Standard now, extended before v4.0 (Recommended)" (Q22). Unconfirmed readings carried from the question rounds: the pack says that if v4 is the first app under its app flag, Set 1 is pinned at that intake and a pilot row is dated before the first session; and adopting the architecture record means first moving today's `project/architecture.md`. The rules file's Always section stands at 457 words against its guideline of 400; most of it is v3's invariants, which move with v3's source here.
