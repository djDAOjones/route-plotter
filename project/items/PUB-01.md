# PUB-01 — Each app merge the owner orders publishes v4

## Intent

Today a merge releases nothing and only `npm run push` publishes. The owner chose "Every merge publishes" (Q15): until v4.0, each merge he orders that changes the app also publishes the preview to GitHub Pages, starting with the first build in which the core works end to end; a record-only merge publishes nothing (Q24). This item builds that publishing step and its guards before the first v4 build replaces v3 at the main address.

## Acceptance criteria

- On a merge the owner ordered that changes the app, with the gate green, the v4 build is published to Pages from `docs/` on `main`; a record-only merge publishes nothing, by GATE-01's sorting.
- Nothing is published before the first v4 build in which an author can draw a route, play it, save and reopen it and export it, passing v4's gate. That first publish is on the owner's call. Before it, the session tells him where the Xerte copy stands and asks whether its readiness is a condition.
- CI fails a pull request that changes `docs/` or `version.json` by hand (wish INTAKE.10).
- The published commit's shape and the commit checker are reconciled (wish REL-720.1: the generated `chore: deploy vX.Y.Z` commit has no Verify body).
- Each published preview comes with a short list of what is new and what to try.
- How a bad publish is taken back is written down and tried once.
- The grant ends when v4.0 is declared; a v3 release stays the owner's call alone.
- The profile's Hosting and deploy line and the rules' `main` line are checked against what was built, and redrafted for the owner's signature if they differ.

## Now

Updated: 2026-11-18

Next step: None until its phase opens by its own PLAN entry; the architecture plan (MERGE-01) says where it falls among the core's items.

Open question: Whether the Xerte copy's readiness is a condition for v4 replacing v3 on Pages; the owner left that reading unticked on 2026-11-18, so it goes to the architecture plan's question round.

## Context and sources

- [The decisions](../decisions.md): PLAN-5, the grant and its six conditions
- `reviews/v4-vision-question-rounds-2026-11-18.md`: Q3, Q7, Q13, Q15 and Q24
- `reviews/v4-programme-2026-11-18.md`: P6 and finding F8
- `DEV-INFRASTRUCTURE.md`: release and deployment

## Notes

- 2026-11-18 — Filed by PLAN-5. The owner's instructions in force, verbatim: "half build v4 is ok, use pages as is" (Q3); "once it's releasable" (Q7); "The core works end to end (Recommended)" (Q13); "Every merge publishes" (Q15); and the tick "Record-only merges publish nothing" (Q24). Promoted here from the wish list by the stock take's ruling: INTAKE.10, "CI could fail a pull request that changes `docs/` or `version.json`, which only `npm run push` may commit; today the release steps rely on checking the diff by eye."; and REL-720.1, "Reconcile the generic item-commit checker with the prescribed generated `chore: deploy vX.Y.Z` commit, which has no Verify body; both commit-shape diagnostics reproduced on v3.3.720 while the normal ledger check passed".
