# GATE-05 — v4's gate in place of v3's; frozen v3 locked

## Intent

Since GATE-01 the gate has run frozen v3's whole suite, 4,385 tests and about 50 minutes of Verify, whenever a change touched a v3 path or a path on no list (the gate itself, CI, `.nvmrc`, `LICENSE`). The owner has ruled that v4's gate is used in place of v3's from now on, and chose to lock frozen v3. This item builds that from a draft another chat wrote for him: v3's suite leaves every lane CI runs, a change to any v3 path is refused, and v3's code is held to the tag `v3.3.726`. It reverses GATE-01's criterion that a change to frozen v3 runs v3's whole suite.

## Acceptance criteria

- No change runs frozen v3's suite: `ORDER` holds the gate's lane, v4's and the record's; a path on no list runs those three. v3's suite still runs by hand with `node scripts/gate.mjs --lane v3`.
- A change to any v3 path (`v3/`, `.github/SECURITY.md`, `.github/SUPPORT.md`) is refused at once, with exit 1 and words that name the paths and say that undoing the lock is the owner's call, wherever the gate reads it by paths: in CI's sort step and a range's plan, the range's paths (`--ci`, `--range`); in a checkout (`--all` included), the index against HEAD, the working tree against the index, untracked files, and the base's diff where a base can be read. A checkout whose required reads fail (a repository with no HEAD included) is refused, naming the read. As a fallback, a committed v3 change that none of these reads can show (no base and no range) is caught by the id test in the gate's own lane, after planning, not by the plan.
- v3's code (`src`, `styles`, `scripts`, `index.html`, `build.js`, `package-lock.json`) is the tag's, byte for byte, and every v3 path is held to git's id for it as locked, so the lock holds where a change cannot be read and every lane runs.
- CI installs nothing of v3's and has no step of its suite; npm's cache reads the root lockfile alone.
- A record-only change still runs the record checker alone (the owner's pick of the label "Record checker alone (Recommended)").
- The tests that pinned v3's lane are narrowed by that lane alone, and one is rewritten to pin the lock; each of three mutations (the refusal taken out, `'v3'` put back in `ORDER`, the tag or a locked path's name altered) fails its test.
- It changes only `scripts/gate.mjs`, `scripts/gate.test.mjs`, `.github/workflows/ci.yml` and the record's files for this item.
- v4's whole gate and CI are green on the head, Codex (gpt-6-astra) approves that head read-only, and `node tools/check.mjs` and `--commit HEAD` give 0 failures.

## Now

Updated: 2026-11-25

Next step: Codex's review of the pull request's head; the merge on Verify green on the head Codex approves, the owner's word.

Open question: None.

## Context and sources

- [The decisions](../decisions.md): GATE-05, which files and builds this item; GATE-01, whose criterion it reverses
- [GATE-01](./GATE-01.md): the gate by what changed, its superseded criterion marked
- [GATE-03](./GATE-03.md): the pattern this item follows
- `scripts/gate.mjs` and `scripts/gate.test.mjs`: the gate and its tests
- `.github/workflows/ci.yml`: the Verify workflow

## Notes

- 2026-11-25 — Filed and built from a draft another chat wrote for the owner, in the session notes. His words, verbatim, typed in that chat on 2026-11-25 about 18:45 UTC: "review the v3's suite of checks and gating"; "how could the v3 gate be improved for v4? is improvement planned?"; "when will the v4 gate come into effect?"; "we need to advance using the v4 gate universally from now on in place of v3". Then two questions that chat wrote, with every option label and description: he picked the label "Retire it: lock v3/", whose description, the chat's words, read "The gate refuses any change under v3/ unless you say otherwise, and checks v3/src against tag v3.3.726. v3's suite runs only by hand. Fastest, but it gives up the 4,385 tests as a safety net."; and the label "Record checker alone (Recommended)". He typed nothing beside either. On the merge, typed in the parent chat about 19:19 UTC: "Read JOE-MESSAGE-2026-11-25-v3-locked.md in the lane and have the orchestrator take it through as an item; merge it once Verify is green on the head Codex approves."
- 2026-11-25 — The draft's four open choices, ruled provisionally by the orchestrator (the night's D243), none of them his words: `.github/SECURITY.md` and `.github/SUPPORT.md` stay locked, since v3's governance test reads them; there is no override, so lifting the lock is a change to `scripts/gate.mjs`, which runs everything; the record is this item, its decision entry and GATE-01's marked criterion. Owed, not fixed, because the lock forbids the edit: v3's tests read the root `docs/`, v4's live site now (`v3/tests/helpers/buildScriptHarness.js`, line 53), so a by-hand run of v3's suite may break after a later publish (a wish line at the wish list's foot).
- 2026-11-25 — Built as drafted, with the ID put in the new comments and test titles, and one addition: `V3_LOCK.ids`, git's ids of the `v3/` folder's tree and the two `.github` documents as locked, with a test that holds every v3 path to them, since a change whose paths cannot be read names nothing as locked and runs every lane, this test's included. Run on this Mac on 2026-11-25: `node scripts/gate.mjs --lane gate`, "tests 110", "pass 108", "fail 0", "skipped 2"; `scripts/gate.test.mjs` alone, "tests 63", "pass 63". Mutations, each restored: the refusal taken out of `main()`, "fail 1", the checkout refusal test; `'v3'` put back in `ORDER`, "fail 13"; the tag pointed at `v3.3.725`, and `build.js` renamed in the list, "fail 1" each, the byte-for-byte test; the folder's id altered, "fail 1", the id test. CORE-06's range plans "the gate's and the publishing step's own tests, then v4's gate, then the record checker, because the change touches v4", exit 0, nothing refused.
- 2026-11-25 — Codex (gpt-6-astra) reviewed `2f26cf0`: changes needed. Two refusal gaps in a checkout: `--all`, or a base that cannot be read, read no path and so refused nothing; and a staged change whose working copy was put back to the base's was not seen, since the checkout was read as one diff from the base to the working tree. Mended: `checkoutLocked` reads the index against HEAD, the working tree against the index, untracked files and the base's diff where one can be read, apart from which lanes run. Two tests, run first against `2f26cf0`'s gate, "fail 2", then with the mend, "pass 2"; the index read taken out, and separately the working tree's, "fail 1" each, the staged test. The debt on v3's reading of `docs/` is a wish line at the wish list's foot, which the decision entry names (its Deferred line takes item IDs only, so it stays none). A committed v3 change with no base to read against is left to the id test, which reads HEAD.
