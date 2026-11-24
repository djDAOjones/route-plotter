# GATE-03 — The gate's own test file gets a class of its own

## Intent

The gate (`scripts/gate.mjs`) sorts each change by its paths. Its own test file, `scripts/gate.test.mjs`, is on none of its lists, so a change to it sorts as other and runs everything, frozen v3's whole suite included. The file's tests pin what v4's files say, so a v4 item changes it along with them: since 22 Nov every push on CORE-05's branch has run v3's suite, about 43 minutes of a 50-minute Verify, for one changed line there. This item gives that one file a class of its own, which runs the gate's lane, v4's gate and the record checker, not v3's suite. It reverses, for that one file, the choice GATE-01 and GATE-02 made that a change to the gate or its tests runs everything, so the owner rules on it before it merges.

## Acceptance criteria

- `scripts/gate.test.mjs`, named exactly, sorts in a class of its own (`gate`); anything spelt nearly the same, and `scripts/gate.mjs` itself, stays other.
- A change to it runs the gate's lane, v4's gate (where v4 exists) and the record checker, and frozen v3's suite only when a v3 path changed too; beside `scripts/gate.mjs`, a path on no list or a hand change to the live site, everything runs, as before.
- A test checks on every run that frozen v3 names the file nowhere, and that v3's lane runs nothing of the gate's.
- The two older tests that pinned the file to running everything ("everything else is other, near misses included" and "a v4 change runs v4's gate and the record checker, never v3's suite (STACK-02)") are narrowed by exactly that one path and in no other way. This reverses GATE-01's and GATE-02's choice for that file: a change to the gate's tests alone no longer proves frozen v3 again.
- It changes only these paths: scripts/gate.mjs, scripts/gate.test.mjs and the record's files for this item.
- Its pull request has a `## What to try` section saying in one line that nothing visible changes.
- The item's gate is green in CI (a change to the gate runs everything, 45 to 50 minutes), Codex (gpt-6-astra) has reviewed it read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-24

Next step: The owner rules on the reversal and, if he takes it, merges the pull request; then a close strikes this line and adds its trajectory line, and CORE-05's branch brings `main` in.

Open question: Owner: may a change to the gate's own test file alone run v4's gate and the record checker without frozen v3's suite, narrowing the two older tests that pinned it to running everything?

## Context and sources

- [The decisions](../decisions.md): GATE-03, which files and builds this item; GATE-02, whose choice it narrows
- [GATE-02](./GATE-02.md): the gate's loose ends, the pattern this item follows
- `scripts/gate.mjs` and `scripts/gate.test.mjs`: the gate and its tests
- [CORE-05](./CORE-05.md): the item whose pushes the gap slows

## Notes

- 2026-11-24 — Filed and built by GATE-03's pull request, from a draft another chat wrote for the owner. His words, verbatim, typed or picked by him on 2026-11-24: "investigate to what extent development can run in parralel on this project, and to what extent quality and efficiency may suffer"; to the question "Draft the gate change that stops the 43-minute v3 run on CORE-05 pushes?", "Draft it"; to "Who should land this draft?", "The orchestrator". A reading, not his words: he wants the draft taken through as an item with his own word on the merge, and he has not ruled that the change is right; he was told it reverses a deliberate choice. So the pull request stays open for him, and the choice is put to him in the night's decisions list.
- 2026-11-24 — Built as drafted, with the ID added to the class's comment, the comment in `plan`, the import's comment and the two new tests' titles. `scripts/gate.mjs` and `.github/workflows/ci.yml` stay other, so a change to the sorting or to a lane's commands still runs everything, and the profile's Gate line ("anything unclear runs everything") stands as written. `scripts/publish.mjs` counts every class but record, v3 and the site as changing v4, so the new class publishes as other did. Nothing under `src/`, `tests/`, `tools/`, `v3/`, `docs/` or `version.json` changed.
