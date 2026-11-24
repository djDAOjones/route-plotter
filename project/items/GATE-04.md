# GATE-04 — The accessibility run's port is settable

## Intent

The accessibility run always takes port 4173 and refuses to start if it is taken, so two chats on one machine cannot run it at once; on 24 Nov one waited on the other. This item makes the port settable, with 4173 as the default, so that two runs can pass side by side and nothing changes for anyone who sets nothing. It is built after CORE-05 merges, because CORE-05's branch has changed `tests/a11y/project.mjs`.

## Acceptance criteria

- With nothing set, the port is 4173 and the server's command reads exactly as now.
- With the setting given (an environment variable is the lean; no design is fixed), the preview server and the run both use that port.
- Two runs on two ports pass side by side on one machine.
- The gate's own test that pins the command's words changes in the same pull request.
- It changes only these paths: vite.config.mjs, tests/a11y/project.mjs, scripts/gate.test.mjs and the record's files for this item.
- Its pull request has a `## What to try` section saying in one line that nothing visible changes.
- The item's gate is green in CI, Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-24

Next step: Built after CORE-05 merges, from fresh `main`.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): PLAN-9, which files this item
- [The owner's answers of 24 Nov](../../reviews/v4-owner-answers-review-2026-11-24.md): the record PLAN-9 cites
- `vite.config.mjs`: the preview server's port, line 88 on `main` at 1a819a5
- `tests/a11y/project.mjs`: `ORIGIN`, line 11, and the server's command, line 72, on `main` at 1a819a5
- `scripts/gate.test.mjs`: the test that pins the server's command, line 645 on `main` at 1a819a5
- [CORE-05](./CORE-05.md): the item whose branch changes `tests/a11y/project.mjs`

## Notes

- 2026-11-24 — Filed by PLAN-9. The owner's typed word of 24 Nov, whole, to a chat's list of suggestions: "execute all suggestions in the appropriate chat". The suggestion, sixth on that list, as he read it, in the asking chat's words, not his: "make the accessibility run's port settable, which only matters once two lanes run". The orchestrator placed it as an item of its own, built after CORE-05 merges (D216 in the night's decisions list, in force unless he objects); the acceptance criteria are the orchestrator's, his to change.
