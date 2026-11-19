# Decisions

<!-- Newest first. Never edit an old entry; supersede it. Rule 1 reads
     exactly the latest ten entries' heading, Decision line and Deferred
     line, newest first. The Decision line states the what and its
     one-line why; Rationale holds evidence and detail, read on demand.
     The slice fails at close over 1,000 words. Entries the migration
     inventory lists are inherited and read as heading and Deferred
     line only; this ledger inherits none — the canon decision log is
     frozen under pm_skills/ and indexed by project/history.md. Grammar:
     ## YYYY-MM-DD — ID — title
     **Decision:** what was decided and its one-line why.
     **Rationale:** evidence and detail, in the terms another session
     would need.
     **Supersedes:** YYYY-MM-DD — ID — title, or "none".
     Optional **Deferred:** comma-separated target IDs, or "none".
     A PLAN-N entry also has **Items:** with its phase IDs. A later
     PLAN-N Items list replaces the whole list and supersedes the
     earlier; a closed phase is checked against the list no other
     supersedes. Optional **Retired:** names items retired unshipped,
     comma-separated, the reason in the entry: neither open nor
     shipped, never reopened.
     Budget 45 live entries: when the validator warns, tools/archive.mjs
     moves the oldest entries verbatim to project/decisions-YYYY-MM.md,
     beside this file, listed in project/archive-index.md — on the
     owner's word, as the rules file says. -->


## 2026-11-19 — GATE-02 — The gate places the accessibility pack, the step's files and the measures; a replayed run fails
**Decision:** `scripts/gate.mjs` sorts tools/a11y-*.mjs and `project/a11y/` as v4 ahead of the record, gives the publishing step's files a class running the gate's and v4's lanes, not v3's, and puts scripts/measures.mjs with v4; it passes over skipped jobs and, on `main`, refuses a site change its run's record cannot vouch for, so a replayed run fails Verify. Provisional under grant G3. Because he chose "Gate by what changed (Recommended)" (Q23).
**Rationale:** The owner's words in force, verbatim: "Gate by what changed (Recommended)" (Q23); on publishing, "re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)" (2026-11-18); overnight, "Merge when checks pass (Recommended)" (G2), "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". Each choice below is provisional and put to him in the night's decisions list.

The criteria, one by one. (1) The pack's files sit in the record's folders, where the pack's refresh looks for them, but v4's gate runs and reads them (`npm run a11y`, `tests/a11y/`), so a change to them alone now runs v4's whole gate, not the record checker alone. The record-path guard in `scripts/gate.test.mjs` now reads a folder's mention with the path after it, resolved, counting it only when that path is the record's, and passes over web addresses (the catalogue cites W3C's `tools/selecting/` page), so its four known entries for the pack go; it now reads the measures script too, whose comment cites two reviews: one known entry. (2) The step's files get the class `step`, which runs the gate's lane, holding their 36 tests, and v4's gate, since knip's GitHub Actions plugin takes the scripts the workflows run as entries (an unlisted import planted in `scripts/publish.mjs` fails `npm run deadcode`); no v3 check reads them. So a change to them runs a minute or two, not v3's 40 minutes. A branch push also runs the step's dry run on v4's real build. (3) CI's v4 step runs the measures after the lane and `tests/architecture/` tests the script, so it is v4's. (4) A skipped job has no log and pushed nothing, so it is passed over, and a replay of a finished run fails as a hand change. Codex's review found the rest of the way round: a record the gate cannot read (a job still running, a log missing, GitHub not answering) only warned, so a forged commit could pass Verify and become `main`'s last passing run. On `main` that now fails too, asking for a re-run once the Publish run has finished; and when `main`'s last passing run cannot be read, the newest change to the site is still checked. `authenticateStep` still says "cannot be read" for a missing log, so the step never publishes over a take-back it cannot vouch for. (5) PUB-01's Notes record the night's live trial. Anything on no list still runs everything.

What publishes: the step counts every class but record, v3 and the site as changing v4 (`scripts/publish.mjs`, unchanged). So a change to the pack or the measures alone now publishes a preview of the same build, as one to v4's tests already does. One to the step's files alone still publishes, as when they were unplaced, so that the changed step runs on `main` at once; PUB-01's wording, "a path of the gate's v4 or unplaced classes", read literally, would publish nothing for it now, and that choice is put to the owner. Skipping a publish whose build matches the live site is wish GATE-02.1; a checkpoint whose run's logs have expired is wish GATE-02.2.

The proof: each of the seven changes reverted alone fails its own test (56 gate tests pass); GitHub's records vouch for every step commit on `main` since 027f105, and commits replaying the first publish's run or the take-back's fail the gate, with or without `main`'s last passing run, where the old gate only warned; the full CI run is the pull request's. Digest rules applied (house conventions): a focused test for each change, and "Never delete, skip, or weaken an existing test": one PUB-01 test's case that expected a warning now expects the failure; 120-character lines in the lines added.
**Supersedes:** none
**Deferred:** none

## 2026-11-19 — STACK-04 — v4's layers are enforced in the gate and proved by planted violations, the measures print in every v4 run, and Phase 6 closes
**Decision:** v3's architecture file moves to `v3/ARCHITECTURE.md` and v4's record, in the PM-Skills format, takes `project/architecture.md`; `.dependency-cruiser.cjs` keeps the pack's core and adapters rules, replaces its player and exported rules with the plan's closure and adds the five feature rules and a cycle rule, each failed for good by a planted fixture; a closure test reads the built player; `npm run measures` prints M1 to M11 into CI's summary. Phase 6 closes; CORE-01 is next. Provisional under grant G3. Because the owner asked for edges "enforced in the gate, not just written down" (Q1).
**Rationale:** The owner's words in force, verbatim: "the full PM-Skills stack from the start: the app opinion (editor), accessibility testing at AAA, and the architecture record" and "layers and module edges enforced in the gate, not just written down; and §16's test applied to every new abstraction. Show me measures I can check, for example that adding a feature touches only its own module." (Q1); overnight, "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". Every choice below is the architecture plan's recommendation (A7, A9, A34) or a smaller one of this item's, provisional and put to him in the night's list.

The move comes first and alone (858b0cf): `git mv`, a 100% rename, so `git log --follow v3/ARCHITECTURE.md` reaches the file's whole history; nothing else under `v3/` changes. v4's record then takes the path in the pack's envelope (specification 3.26, its mark line kept): the system context (the author, the viewer, GitHub Pages) and two containers (the editor, and the exported player the editor inlines into each HTML export), with the plan's §8 layers written as the containers' prose, since the envelope allows no other heading. The rules file's signed code-change row now routes v4's record (572 of its 1,100 words).

The rules, from the plan's §8. Kept as the pack wrote them: the core reaches only itself, the adapters only the core and adapters, no package in those four areas until a decision lists it (`PACKAGES`, still empty), and every import resolves. Replaced: the player reaches the core, the renderer's kit, itself, the player-safe catalogue and the features' `model/` and `draw/` parts, never another adapter, an editor part, jszip, mediabunny, React, React DOM or Carbon, whatever `PACKAGES` lists (rule 6); exported code reaches what the player may, and itself (rule 7). Added: rules 1 to 5 for `src/features/`. Smaller choices, each named in the file: a feature's `draw/` and `editor/` also reach their own folder, as every pack area does; its `editor/` reaches React and Carbon React, which its JSX and the shared kit need; its `model/` and `draw/` reach the packages the core may, since they reach the core; rule 4 also forbids reaching a catalogue, and its second half, "only the two catalogues import several features", is enforced as: outside a feature's own folder, only the catalogues import a feature (`only-the-catalogues-import-a-feature`), which is what M1 aims at; rules 4 and 5 hold for tests; `src/adapters/render` may be a folder or one module; and a cycle rule holds measure M3 at zero, as the plan's §17 keeps "zero cycles".

The proof, for good: `npm run test:architecture`, in `check:v4`, runs the gate's own configuration on 30 fixture trees in `tests/architecture/fixtures/boundaries/`: a legal tree using every allowed edge breaks nothing, and each of 29 plants breaks exactly its rules, from the planted file to its target; a test fails if a rule has no plant or a plant no rule. The closure test builds the player again in memory, checks it is byte for byte `dist/player/player.js`, and checks every module it holds against rule 6; planted React, React DOM, Carbon, jszip and mediabunny imports fail it and the build's own check, and two planted editor parts fail it though the build's own check lets them through. Each measure is proved on a plant too.

The measures (the plan's §10): M1 to M4 from the dependency graph and the source, M6 from the strings the interface's JSX shows, M7 by knip, M8 by ESLint's own two rules, M9 the lane's time in CI, M10 from the player's build; M5 waits for a route (CORE-12) and M11 for the scripted runs (EX-01). "Upward edges" (M3) are read as the edges the layer rules forbid. v3's baselines are held in the script's `V3` list, from the abstraction plan's §18, the plan's §10, or counted once by this item at v3.3.726 (commit c1690c6): 18 mixins (the plan said 16), 43 controls in v3's side panels on a new two-waypoint route, 44 of 120 source files over 400 lines, a 457.51 KB player. The script never reads `v3/`. CI's v4 step runs the measures after the lane, whether it passed or not, into the run's summary, and fails if either did; the checkout is proved unchanged after both. `scripts/measures.mjs` is on none of the gate's lists, so a change to it alone runs everything until GATE-02 places it; `scripts/gate.mjs` is unchanged.

Outside the item's named paths, each the smallest change: `knip.json` learns the new tests and ignores the fixtures; `scripts/gate.test.mjs` pins `check:v4` with `test:architecture`, the measures in CI's v4 step and the proof step's new condition. v4's lines for the rules file's Always section, the exceptions pointer re-pointed to `v3/ARCHITECTURE.md` and the pack's By-task row for the record are drafted for the owner's signature and written nowhere signed: the rules file stands at 597 of its 600-word hard budget, so any added Always line needs his budget call (wish STACK-04.1).

The drafts, unsigned, for his signature (D48's two re-pointed v3 paths stand beside them): add to Always "- v4's layers and edges are those in `project/architecture.md`, enforced by `npm run boundaries` and proved by planted violations (`npm run test:architecture`): a feature is one folder, `src/features/<id>/`, that reaches no other; the exported player holds no React, Carbon, jszip, mediabunny or editor part; a new area, package or rule is a decision." and "- A new shared abstraction in v4 answers the abstraction plan's §16 in its pull request; `npm run measures` reports M1 to M11 in every v4 run." (53 and 27 words: Always would stand at 537 of its 400-word guideline, the file at 677 of 600); in the components line, "(exceptions: `project/architecture.md`)" becomes "(exceptions: `v3/ARCHITECTURE.md`)", the same length; and By task gains the pack's row for the record, "| a container, external system, boundary or interface change | project/architecture.md | 1,100 | none |", its budget the code-change row's, since both route one file.

Digest rules applied (house conventions): 2-space indentation, single quotes and semicolons; camelCase functions and UPPER_SNAKE_CASE constants; "Never delete, skip, or weaken an existing test" (the gate's two changed pins add or tighten); "Add a focused test for new model methods, utilities"; an out-of-scope idea is one wish line. The exception: "120 char max line length", which no tool enforces, is exceeded in this item's files as in the pack's settings and the gate's tests (wish STACK-04.3).

Phase 6 closes by rule 11: PLAN-6's Items, as its entry of 2026-11-19 lists them (STACK-01, STACK-02, PUB-01, STACK-03, STACK-04), have all shipped, each with its trajectory line. The next phase's first item is CORE-01, the first of PLAN-7's Items, because every other core item builds on the project model and its schema helper, and its one dependency is this item, met when its pull request merges. Recall, fresh, 8 of 8 (a separate agent with no task context, given only `verbs/recall.md`'s four questions and this checkout): (1) the last four shipped are STACK-02, PUB-01, STACK-03 and STACK-04 (`project/trajectory.md`, Phase 6); (2) this entry, made because the owner asked for edges "enforced in the gate, not just written down" (Q1); (3) deferred are GATE-02, CORE-12 and EX-01, named on this entry's Deferred line and open in the backlog (Phase 7, and Phase 9 in Next), with wishes STACK-04.1 to .4; (4) next is CORE-01, first under Phase 7 and in PLAN-7's Items, for the reason this entry gives.
**Supersedes:** none
**Deferred:** GATE-02, CORE-12, EX-01

## 2026-11-19 — PLAN-7 — Phase 7, the core end to end, opens with what Phase 6 taught written into each item
**Decision:** Phase 7 opens beside Phase 6's last item with §19's eleven core items and GATE-02, the gate's loose ends; CORE-01 starts when the orchestrator starts it, after STACK-04. Every core item's pull request carries `## What to try`, covers what it adds in the accessibility run and leaves the published page working. Until v4.0 the save format may change between previews. Provisional under grant G3. Because the owner asked to "plan for as many phases of work as possible".
**Rationale:** The owner's word in force is his overnight message of 2026-11-18, word for word in GATELESS-2, which asks to "accrue decisions that come up but dont stop dev unless impossible" and ends "please plan for as many phases of work as possible"; with his answer "Proceed on recommendations (Recommended)" (G3), it is the instruction to plan and execute that `verbs/plan.md` step 5 names. Every choice below is the session's recommended option, provisional under G3 and listed for him in the night's decisions list.

The phase. Phase 7 opens under Current with the items of the architecture plan's §19, in its order, and GATE-02 second: CORE-01, GATE-02, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-12, CORE-07, CORE-08, CORE-10, CORE-09. CORE-11 stays in Phase 8, where §19 places it. Phase 6 is not closed here: STACK-04's close closes it, so two phases stand open under Current for a while, as Phases 2 and 3 once did. CORE-01 starts only when the orchestrator starts it, and §19's "Depends on: STACK-04" stands. §19's side-by-side pairs stand (CORE-02 with CORE-03, CORE-06 with CORE-12, CORE-07 with CORE-08, CORE-10 with CORE-09). Since STACK-03, `tests/a11y/project.mjs` and `project/a11y/coverage.json` are shared by every item that adds a screen or control, so the three pairs that both add controls run on the catalogues' terms: each adds only its own entries, and the second to merge brings `main` in, runs v4's whole gate with the accessibility run on the joined head, and merges once CI is green and Codex has approved that head. The run holds port 4173, so two items cannot run it on one machine at once; the second waits (wish PLAN-7.1).

What Phase 6 taught, now one criterion line in each core item file, CORE-11's included, where `node tools/brief.mjs` shows it whole (it prints an item's Now, then its criteria, before anything else that fits): since PUB-01 every app merge publishes, so the merge leaves the published page working; the step copies the pull request's `## What to try` section into the live `version.json`, which is how the owner learns what each preview can do; and since STACK-03 v4's gate runs the accessibility run at AAA, so each new screen or control is declared in `tests/a11y/project.mjs` in the same pull request and each feature added or ruled out is recorded in `project/a11y/coverage.json` (wish STACK-03.4). Phase 8's items take the same line when Phase 8 opens (wish PLAN-7.2). CORE-05's file now lists what depends on the shell's one link (STACK-03's decision, wish STACK-03.5) and its record P09.

The save format. The plan's A13 let the format change freely only until the first publish, assuming that came with CORE-08. The owner's word on publishing brought it before anything could be saved, so read literally every change after CORE-03's first published build would need a tested step, an overhead on every core and feature item. Until v4.0 is declared the format may change between previews: a file from another version, older or newer, is refused whole, and the editor says plainly wherever it offers Save that a preview's file may not open in a later preview; from v4.0, A13 holds as written. CORE-03's criterion and the plan's §13 say so. The other options: A13 literally; or free until CORE-08's build, A13's original moment.

GATE-02 gathers the gate's small gaps and runs beside CORE-01 to CORE-03, which touch none of its files. Its traces: STACK-03.1 — promoted to GATE-02 — the accessibility pack's files sort as record though v4's lane reads them; PUB-01.3 — promoted to GATE-02 — the publishing step's own files run v3's whole suite; PUB-01.6 — promoted to GATE-02 — PUB-01's trial is still to be written into its Notes. It also places STACK-04's `scripts/measures.mjs`, left on none of the gate's lists by STACK-04's brief, and makes the publishing commit's check skip jobs that did not run (PUB-01's hand-over). Wishes PUB-01.4 and PUB-01.5 stay the owner's calls.

The checker's warnings on item files: AI-01's `docs/examples/`, which left the root at v4's first publish, now names `v3/src/examples/`; CORE-05's `src/player` is a folder the plan places and CORE-04 makes, so its warning stays until then; STACK-01's is that item's file and stays. What the owner ruled in the question round stands as recorded, CORE-02's "grace period or control" criterion included. Adding this entry made 46 live decisions, so on his ticks "Archive the oldest decisions" and "Archive one more decision" (2026-11-18) the oldest moves to the archive word for word, leaving 45. Standards: record-only; no digest rule applies.
**Supersedes:** 2026-11-18 — PLAN-6 — v4's foundations open on the architecture plan's recommended options, provisional under the owner's overnight grant
**Items:** CORE-01, GATE-02, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-12, CORE-07, CORE-08, CORE-10, CORE-09

## 2026-11-19 — STACK-03 — v4's gate tests the shell at AAA in a real browser, and planted faults fail it
**Decision:** `npm run check:v4` runs the PM-Skills 5.0.1 accessibility pack's standard depth, Playwright and axe in headless Chromium, against v4's shell at level AAA, writing nothing in the checkout; the pack's 5:1 text and 30 px target pages must fail it; one link gives the shell a control to focus. Provisional under the owner's grants G3 and G4. Because he chose "Standard now, extended before v4.0 (Recommended)" (Q22).
**Rationale:** The owner's words in force, verbatim: "Standard now, extended before v4.0 (Recommended)" (Q22), whose option text reads "From the start: automated checks in a real browser (Playwright and axe) and accessibility lint rules, as part of the gate"; overnight, "Yes, read and install (Recommended)" (G4), "Proceed on recommendations (Recommended)" (G3) and, typed by him, "accrue decisions that come up but dont stop dev unless impossible". Every choice below is provisional and put to him in the night's list; the pinned versions are shown to him in the night's lane (`PINNED-VERSIONS-10-stack-03.md`).

What is installed, from tag v5.0.1 (fd5fb94), byte for byte: the run, its report tool and the report's validator (`tools/a11y-run.mjs`, `a11y-report.mjs`, `a11y-coverage.mjs`; the run calls the report beside it, so the item's one named tool needs the other two), the Playwright configuration, helpers, four specs and eleven known-bad pages in `tests/a11y/`, and the catalogue in `project/a11y/`, with a blank coverage file at AAA written by the pack's own function, every feature unknown. The routed document, which the pack's helper would write to the live site's `docs/`, is at `project/a11y/accessibility.md` (wish STACK-02.2, now paid; wish STACK-03.2 holds what signing the profile's line then needs). Not installed: the sampling tool and spec, by hand only and with one state to find (wish STACK-03.3), and the ledger module, which only the signed line loads. @playwright/test 1.56.1, @axe-core/playwright 4.13.0 and axe-core 4.13.0 are pinned exactly, and an npm override keeps the axe package's peer playwright-core at 1.56.1, one copy, where npm would add its newest (1.65.1) beside it; `npm ci --ignore-scripts` from the lockfile installs 430 of 430 at their locked versions.

The run: `npm run a11y` builds nothing; `check:v4` runs it after the build, then `npm run a11y:known-bad`, which puts the pack's contrast-5 and target-30 pages through the gate and requires each to exit 1 with 1.4.6 and 2.5.5 failed by their methods and 1.4.3 and 2.5.8 passed. Planted in the shell itself, text at 5.02:1 failed 1.4.6, and the link drawn as a 46 by 18 px box failed 2.5.5; both plants were removed. CI fetches Chromium's headless shell (revision 1194) with Playwright's own installer when v4's lane runs, into the runner's temporary folder, taking Playwright's Ubuntu 24.04 build because ubuntu-latest's 26.04 is newer than 1.56.1 names; the run itself never downloads, and CI proves the lane leaves `git status`, ignored paths included, as it found it, the build's `dist/` aside. The run serves the build with Vite's native configuration loader, as its default one writes a bundled copy of the configuration into `node_modules/.vite-temp` (Codex's second round); a file-time check showed `npm run a11y` and `npm run a11y:known-bad` then change nothing in the checkout, `.git` and `node_modules` included. The download host, Playwright's own, is beyond the profile's two listed hosts, so it is in the night's list.

A finding: the pack's focus test fails any state where no control takes focus, and the shell had none. The pack's rule is that a failure is fixed in the product, so the shell's paragraph gains one inline Carbon link to the project on GitHub, its wording provisional (wish STACK-03.5). `tests/a11y/project.mjs`, the project's own, declares the shell with its reviewed ARIA snapshot, one interaction, what the adaptations must keep, a keyboard function, the records P09 and P10 with their grounds, and five journeys for the rows only a journey checks (1.3.2, 2.4.2, 2.4.3, 2.5.2, 3.2.2, 3.2.5, 3.3.5, 4.1.3, P06, CONF03); each fails once the shell gains what it cannot check yet, and pages outside the app are answered by a local stand-in, so no test reaches the network. Every check opens the shell settled, drawn and with its fonts loaded: on CI's Linux runner the link moved 63 px when the bundled fonts arrived after the load event, which hid its focus outline from the first CI run (wish STACK-03.6). The run reads passed: 20 tests, 41 of 115 rows checked, none failed, 74 unverified (49 by a feature still unknown, wish STACK-03.4); the report never claims conformance.

The gate sorts `tools/` and `project/` as record, so a change to the pack's files there alone skips v4's lane (wish STACK-03.1, for STACK-04 or the gate's owner); `scripts/gate.test.mjs`'s record-path guard lists their four mentions as a known gap, a temporary exception to that guard, provisional under G3 and put to the owner, which wish STACK-03.1 closes; its other tests now pin `check:v4`, the CI steps and the run's output folder. The Playwright configuration sits in `tests/a11y/`, already v4's. Outside the item's named paths, each the smallest change: the two tools above, `project/a11y/`, `package-lock.json`, `knip.json` (the pack's test entry and `axe-core`), `THIRD_PARTY_NOTICES.md`, the gate's test, and `src/editor/App.tsx` for the link. Nothing under `v3/`, the root `docs/` or `version.json` changed. Digest rules applied: WCAG 2.2 AAA → 1.4.6 at 7:1 and 2.5.5 at 44 px measured and planted, 2.4.7 and 2.4.11 to 2.4.13 measured on the link's 3 px outline, 2.1.1 and 2.1.3 by keyboard at both paces, 2.3.3 under reduced motion, and the claim never "conforms"; Carbon → its `Link` in the inline variant, underlined, the theme's tokens unchanged; Nielsen → 1, visibility of system status (the page says where its progress is shown); house conventions → Testing (no test deleted, skipped or weakened; the guard's known list grows only by a documented gap; the item's two named faults are planted and fail the run on every v4 change).
**Supersedes:** none
**Deferred:** STACK-04, CORE-05

## 2026-11-19 — PUB-01 — v4 reaches Pages only through the publishing step, and a publish holds no later work up
**Decision:** `.github/workflows/publish.yml` runs `scripts/publish.mjs`, which publishes v4's checked build to the root `docs/` on `main`, with `version.json` as v4's publish record (4.0.0-preview.N), after a push whose Verify run passed when v4 has changed since the last publish, or by hand on `main`; a take-back restores an earlier site. The gate reads the step's commits as running nothing and fails a hand change to the site. Provisional under the owner's grant G3. Because he said to "publish to it at any point".
**Rationale:** The owner's words in force, verbatim, from `reviews/v4-plan-question-round-answers-2026-11-19.md`: "re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)", and, shown that the first publish replaces working v3 at the github.io address with v4 as it stands, "yes, publish, and I'm going to bed now, so hopefully no more pauses until 08:00" (both 2026-11-18); "Every merge publishes" (Q15) and the tick "Record-only merges publish nothing" (Q24); overnight, "Proceed on recommendations (Recommended)" (G3). The criteria, one by one. (1, 5) The workflow starts when Verify completes on `main`; the step publishes when that push run passed and something that changes v4's build, a path of the gate's v4 or unplaced classes, has landed since the last checkpoint: the source of the last publish, or the last take-back, among the step's commits that GitHub's record vouches for (a forged one is passed over). So a record-only or v3-only merge publishes nothing, a take-back holds until v4 changes again, and an app change whose own publish GitHub's queue replaced, or which failed, is published by the next run. A branch push runs a dry run, which builds, checks, says what a publish would change and changes nothing in `docs/` or `version.json`; a run by hand is a dry run unless asked, and only on `main` can it publish. (2) A run by hand on `main` publishes at any point, once main's newest passing Verify run, an ancestor of its tip, holds the same v4 (every path between them record, v3 or the site). (3) A publish holds nothing up: it runs after Verify, in its own concurrency group; its push, made with the run's token, starts no Verify run; and `scripts/gate.mjs` gives `docs/` and the root `version.json` a class of their own, `pages`, whose change runs no lane when the step made it. A step commit has one parent, the Actions bot as author and committer, the trailer `Published-by: PUB-01 publish.yml run N`, and no other path; on `main` the gate also reads run N from GitHub: a run of `publish.yml` on `main`, started by Verify or by hand, its commit at or before the step commit's parent, whose publish or take-back job printed, on a line of its own in its log, that it pushed exactly that commit, so an old run's number cannot vouch for another. So the merge after a publish runs what its own paths ask for: a record-only one the record checker alone, where before PUB-01 it ran everything, v3's 35-minute suite included. While that job's log cannot yet be read, the merge runs everything, with a warning. The gate's last passing run is now read only from an ancestor of the commit sorted, a gap in GATE-01 that Codex found. The second fact: v3's release tests copy the root `docs/` as the last release (STACK-01, D49 in the night's list) and only need some published tree; with a v4 build in `docs/`, v3's whole suite gave 203 test files passed, 4,385 tests passed and 2 todo (4,387), as before in a throwaway copy, so no file in `v3/` changes. Whether a token's push starts a Pages build is observed by the step itself, which asks for a build when none starts within two minutes and then checks the address serves the commit's `index.html`. (4) Ported from v3's checks: the command line refuses any unknown, misspelt or repeated argument and assumes no mode (DEF-71); each file the site refers to by a literal path in the forms the step reads, which its tests list (tags' attributes quoted either way, styles, scripts' imports and `new URL` paths, source maps), must be in the site and inside it, none from another origin or the domain's root, and a build holds no project archive, hidden file or link (DEF-75). The forms are read by patterns, not a parser, so a form outside them, or a path a script builds at run time, is not checked. (6) The item named only `.github/workflows/publish.yml` and `scripts/publish*.mjs`; `scripts/gate.mjs` and its test were added for criterion 3, as the brief allowed. The root `version.json`, put to the owner, becomes v4's publish record, the same file the site serves at `version.json`: version, preview number, source commit, time, address and the notes; v3's build counter stays in `v3/version.json`. (7) The gate refuses `docs/` or `version.json` changed in a pull request, a branch or a checkout, even by a commit shaped as the step's, since the step writes only on `main`; on `main`, a hand change fails Verify until the step rewrites the site; while GitHub's record of a step commit cannot yet be read, the push runs everything instead, with a warning. (8) The commit checker passes the step's commits: `PUB-01: publish v4 4.0.0-preview.N, built from <commit>` and `PUB-01: take the site back to <ref>`, each with a `Verify:` line, checked with `node tools/check.mjs --commit` on both (REL-720.1). (9) What is new: the trajectory's item lines added since the last publish's source; what to try: the "What to try" section of the newest pull request merged since then that has one, the hand-run's words, or a plain default; both in the commit and in `version.json`. (10) The take-back: Actions → Publish → Run workflow on `main`, mode take-back, naming a commit or tag on `main` (`v3.3.726` brings v3 back); it holds until v4 changes again. Its trial on the live site comes straight after this merge, through the step; until its outcome is in the record it is wish PUB-01.6. (11, 12) After V40-01's trajectory line the step refuses to publish or take back. It never runs for a tag, a v3 release or `npm run push`; only a repository setting, the owner's, could stop a hand push to `main` outright (wish PUB-01.4), and a v3 release would now fail Verify (wish PUB-01.5). If main moves on during a build, the step writes again on the new tip, up to three times, unless the move changed v4, whose own run then publishes. (13) The rules' `main` line names "the publishing step that grant sets up" and holds; the profile's Hosting line does not, and the redraft already put to him (PLAN-6 of 2026-11-19) matches what was built. Digest rules applied: house conventions → Testing and persistence (no test deleted, skipped or weakened: one gate test's near misses lose `docs/` and `version.json`, now pinned by the new class's tests, and one asks GitHub for 20 runs, not 1; a focused test for each guard); Nielsen → 1, visibility of system status (each run says why it did or did not publish; `version.json` says what is live). Codex (gpt-6-astra, read-only) reviewed it. Archive: this entry made 46 live, so the oldest, DEF-98 of 2026-10-13, moves word for word to `project/decisions-2026-10.md` on his tick "Archive one more decision" (2026-11-18).
**Supersedes:** none
**Deferred:** none

## 2026-11-19 — STACK-02 — v4's skeleton stands on the editor stack, with its own gate and one blank Carbon page
**Decision:** The PM-Skills 5.0.1 editor pack and the accessibility pack's lint are installed at the root by their own routes, each package at the exact version the packs name, jszip and mediabunny at v3's; v4's gate (`npm run check:v4`) runs types, lint, boundaries, dead code, tests, build and the exported player's check in CI's v4 lane; the player is one script holding no package; the page is blank. Provisional under the owner's grants G3 and G4. Because he adopted the stack whole (Q21).
**Rationale:** The owner's words in force, verbatim: "Adopt the editor stack whole (Recommended)" (Q21), whose option text reads "exact versions are pinned by the item that installs them and shown to you then"; "This repo, v4 at the root (Recommended)" (Q5); "Gate by what changed (Recommended)" (Q23); overnight, "Yes, read and install (Recommended)" (G4), whose option text reads "the pack's packages are installed at the versions it names. The pinned list is shown to you in the morning, not before installing.", and "Proceed on recommendations (Recommended)" (G3). The pinned list, each package with its version, purpose and licence, is shown to him in the night's lane (`PINNED-VERSIONS-7-stack-02.md`); Set 1 and the pilot row, dated 2026-11-19 as the pack's intake says for the first app (A35), are in `project/app/set1.json`, provisional, its `signed` date G4's until he signs.

The routes: the accessibility pack's `eslint.a11y.mjs` was copied byte for byte first, as the app pack's `eslint.base.mjs` imports it; then `app/install.mjs --to . --kind editor` copied 21 files. Its install helper was not run, since it writes `docs/accessibility.md` into the live site's folder and its tools into the record's `tools/`; where they go is STACK-03's (wish STACK-02.2). Departures from the pack, each provisional and put to him in the night's list: the app pack's `project/digests/app-opinion.md` is not kept until he signs the lines that adopt it; its `vitest.config.mjs` lives in `vite.config.mjs`'s `test` block, the item naming that file alone; the editor starter is emptied to one blank Carbon page, its frame loop, canvas adapter and shortcut dispatcher left for CORE-04 to CORE-06 to port from v3, a still page queueing no animation frame, and the common starter's item model gives way to an inert core scaffold, one pure `clamp` and its tests, as the item builds no model; knip's settings drop the pack's `tools/*.mjs` and turn off its Node test-runner sweep, which read v3's tests; and the root `tsconfig.json` only names `tsconfig.app.json`, the pack's app settings, and `tsconfig.core.json`. That last is a finding: v3's build runs esbuild, which reads the nearest `tsconfig.json` above each file, and with the pack's file at the root it took `strict` as `"use strict";` at the head of v3's `player.js`. Run in a throwaway folder with v4's root files above it, v3's build now gives the root `docs/` byte for byte after STACK-01's two normalisations, 24 files, 0 differ; before the split, 1 differed.

The exported player (A20): `vite build --mode player` writes `dist/player/player.js`, one IIFE; the build fails unless it is one file with no import of its own, no `import()` or `require()` left in its code and no package inside (`vite.config.mjs`), and `tests/bundle/player.test.mjs` checks the built file, shows each React and Carbon marker found in the editor's bundle, and plants a React import, a Carbon import and an unresolvable `import()` that the real build refuses. The gate: `scripts/gate.mjs` lists v4's paths (the root package and lockfile, the page, the stack's settings, `src/`, `tests/`); `LICENSE` and the root notices stay other; CI installs each lane's packages for that lane alone, v4's with install scripts off and IBM's telemetry disabled, since Carbon's and IBM Plex's install scripts send IBM usage data from CI; the root `npm run check` is the sorted gate. `scripts/gate.mjs`, its test and `.gitignore` were outside the item's paths: the first two needed v4's list, as the brief allowed, and `.gitignore` needed no change, `dist/` being ignored already. v4's settings exclude `v3/**`. ESLint holds the plan's §15 conventions for v4's tests: no source text read (TST-11), no real animation frame (INTAKE.18). The npm registry marks ESLint 9.39.5 unsupported, the pack's recorded conflict; Vite 8.2.2 has six advisories for its development server, fixed in 8.3.8 (wish STACK-02.1).

Signed lines, drafted for his signature in the night's list and left unchanged: the profile's `- App opinion: editor, 2026-11-19` and its Standards block naming the app-opinion digest; `- Accessibility testing: standard` once STACK-03 has installed that pack; the rules file's By-task rows; and the Gate line's v4 checks (wish STACK-02.3). Proof is in the pull request: v3's suite in its CI run, v4's lane time, `npm ci` from the lockfile giving 425 of 425 packages at their locked version, and the built page opening with no request beyond the machine. Archive: this entry made 46 live, so the oldest, REL-717 of 2026-10-12, moves word for word to `project/decisions-2026-10.md` on his tick "Archive one more decision" (2026-11-18). Digest rules applied: house conventions → Testing and persistence (no test deleted, skipped or weakened; a focused test for the new check); Carbon → Carbon React's own components, its tokens left to the pack's theme; WCAG 2.2 AAA → 1.4.6 Contrast (Enhanced), the page's text `#161616` on white, about 18:1, read from the built page, with its language (`en-GB`), its title and one `h1`; the pack's theme keeps its 2.4.13 focus outline and its 2.3.3 reduced-motion rule as written, but the page has no control or motion yet, so measuring them is STACK-03's; Nielsen → 1, visibility of system status (the page says v4 cannot make anything yet), and 8, aesthetic and minimalist design (no control that does nothing).
**Supersedes:** none
**Deferred:** STACK-03, STACK-04, PUB-01

## 2026-11-19 — PLAN-6 — The owner answers the plan's question round and lets v4 publish at any point; PUB-01 joins Phase 6 after STACK-02
**Decision:** On the owner's typed answers of 2026-11-18, as read below, the architecture plan's Q1 to Q3 and Q5 to Q8 stand as recommended, Q1 adding, for animation that is "cyclical", "a grace period or control for how long to last" (CORE-02); its Xerte condition (Q4, A16) gives way to his word to "publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)". PUB-01 is built straight after STACK-02, every guard kept. Because he answered all eight.
**Rationale:** His words, verbatim, with what he was shown, are in `reviews/v4-plan-question-round-answers-2026-11-19.md`, copied from between the markers in the night's session notes; he typed every answer, none an option label. Round 1, shown to him in a shortened form in orchestrator 2's chat, answered at about 22:35 UTC: Q1, scene length (A2b), "scene ends when all animation has concluded (although some animation could be cyclical so will need a grace period or control for how long to last)"; Q2, route shape (A1), "recommendation good"; Q3, v4's browser storage (A15), "open to reccomendation but no backwards compatibility needed"; Q4, Xerte and the switch (A16), "Xerte copy works, progress with pages". Round 2, shown as the plan words it in orchestrator 3's chat, answered at about 23:28 UTC: "q5) as recommended" (A3, A4); "q6) as recommended" (A11); "q7) as recommended" (A23); "q8) as recommended for now, but future feature may include expressions that make it varied" (A24). In the same message, asked whether "build the publishing set-up, don't publish yet" was the right reading of "progress with pages", he wrote: "re publishing to github pages, just go ahead and publish to it at any point (and after any work item is developed, so long as doesn't cause untoward delay or overhead)". Shown that the first publish swaps working v3 at the github.io address for v4 as it then stands, a near-empty page soon after STACK-02, he replied at about 23:35 UTC: "yes, publish, and I'm going to bed now, so hopefully no more pauses until 08:00".

The readings this entry rules on, each the orchestrator chats' proposal for him to confirm or correct, not his word: Q1, Q2, Q3 and Q5 to Q8 keep their recommended options, so A1, A2b, A3, A4, A11, A15, A23 and A24 are no longer provisional; Q1 adds a requirement, now CORE-02's criterion, how it is met CORE-02's to settle; Q3's "no backwards compatibility needed" means v4 need not read, import or migrate v3's browser autosaves, and leaves A13 (older v4 files keep opening) as it is; Q8's addition is a later feature, wish PLAN-6.1. The publishing word is his call, given in advance, for v4 to be published to GitHub Pages without asking him again: the first publish waits neither for the core to work end to end, nor for his call, nor for the Xerte copy or Gary's having its address, so A16 is overturned; each work item may be published once developed, while that causes no untoward delay or overhead. It is not a v3 release, `npm run push`, a tag, a hand change to `docs/` or `version.json`, or leave to skip the gate, Codex's review or PUB-01's guards: v4 reaches Pages only through PUB-01's step. Whether Gary has the Xerte copy's address he did not say; that and what the root `version.json` becomes are PUB-01's open questions for him, and hold up nothing.

What changes. This entry's Items list replaces Phase 6's, by the plan verb's rule that a later PLAN-N entry changing the list gives the whole list; of the entry it supersedes, only that list and its placing of PUB-01 last in Phase 7 change. PUB-01 joins Phase 6 straight after STACK-02, the first point at which v4 has a build to publish, and may run beside STACK-03, touching neither `ci.yml` nor `package.json`; Phase 7 is now the core, end to end. PUB-01 is re-filed: its title and Intent; its second criterion replaced by his word, the old text word for word in its Notes; a new criterion that a publish does not make later work wait, with two facts from STACK-01's close it must settle (the gate sorts the root `docs/` as other, so a publish commit would run v3's whole suite; v3's release tests read the root `docs/` as the last release); every guard kept. Of PLAN-5's six conditions on the publish-on-merge grant, as read here: the first, a merge he orders in his own words, extends to any app merge under his grants, and the second, the start at the first build whose core works end to end with the first publish on his call, gives way; the other four stand, so the grant ends at v4.0, a record-only merge publishes nothing, PUB-01's set-up comes first and a v3 release stays his call. PLAN-5's open question on the Xerte copy is answered. The plan's §18 to §22 are brought up to date; ten item files whose Now or Notes called an answer provisional now quote it (CORE-01, CORE-02, CORE-06, CORE-09, FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-06, FEAT-07). V40-01's filing note, naming A11, is left as filed; A11 is ruled here.

Signed lines his word makes untrue stay unchanged until he signs. The redrafts, for his signature in the night's decisions list, the first overtaking STACK-01's Hosting redraft: the profile's Hosting and deploy line reads "GitHub Pages from `docs/` on `main`: v4 publishes through PUB-01's step at any point and after each app item, on the owner's advance word, until v4.0 (PLAN-6, 2026-11-19); a record-only merge publishes nothing; frozen v3 stays at tag v3.3.726 and on Xerte; any other release is on his call, by a step decided then, since v3's `npm run push` cannot publish from `v3/`"; the brief's Direction ends its `main` sentence "v4 publishes at any point and after each app item, until v4.0"; and its Open questions' second entry becomes the plan's §21 redraft. The rules' `main` line stays true: this entry states its grant's conditions, and PUB-01's step is the one that line names. On the owner's ticks "Archive the oldest decisions" and "Archive one more decision" (2026-11-18), the oldest live entry, REL-716 of 2026-10-12, moves to the archive word for word, leaving 45. Standards: record-only; no digest rule applies.
**Supersedes:** 2026-11-18 — PLAN-6 — v4's foundations open on the architecture plan's recommended options, provisional under the owner's overnight grant
**Items:** STACK-01, STACK-02, PUB-01, STACK-03, STACK-04

## 2026-11-18 — STACK-01 — Frozen v3 moves into v3/, building the same files; the gate sorts v3/** as v3
**Decision:** v3's app set moves into `v3/` by `git mv`, with copies of `version.json`, `LICENSE` and the notices; it builds the same 24 files as 3.3.726, passes its whole suite from `v3/` in CI, and leaves the root `docs/` and `version.json` untouched. Provisional under the owner's grant G3, on the plan's A14. Because v4 takes the root (Q5).
**Rationale:** The owner's words in force, verbatim: "This repo, v4 at the root (Recommended)" (Q5), whose option text reads "v3's source moves into a v3/ folder as the porting reference and stays recoverable at tag v3.3.726"; "Freeze v3 now (Recommended)" (Q2); and overnight "Proceed on recommendations (Recommended)" (G3). The move is 453 renames at 100% similarity in a commit of its own, `build.js` and `push.js` among them, unedited.

The build compared, read only: in two folders outside the repository, an archive of `v3/` after the move and one of the tag `v3.3.726`, `npm ci` then `npm run build` stamped 3.3.726. Each output has 24 files; after masking `app.js`'s `// Built:` line and fixing `meta.json`'s staging folder names, 0 differ between the two, and 0 between each and the committed root `docs/` (2 differ before the masking, those two). v3's whole suite passes from `v3/` in CI on this item's pull request: 203 test files, 4,385 tests passed and 2 todo, the same as on `main` before the move (run 44402841369); the run is named in the pull request. The branch's first run (44413312274, at b0a1040) failed 2 of them, both in `v3/tests/buildScriptMain.test.js`'s release block, which needs a published `docs/` beside the build; that is what the fourth path edit below gives it.

The only v3 files changed are paths, four of them where the item named three: `v3/package.json`'s `check` now ends `cd .. && node tools/check.mjs` and its `check:changed` is `node ../scripts/gate.mjs`, a path edit the item's list did not name and so an exception, recorded here; `v3/tests/governance.test.js` reads `../.github/`, its assertions unchanged; `v3/tests/helpers/bootApp.js` builds the example archives once, with v3's own `scripts/build-examples.mjs`, into a temporary folder, as the root `docs/examples/` is no longer v3's to read; and `v3/tests/helpers/buildScriptHarness.js`, whose copy of v3 for the build's tests takes the `docs/` a release replaces from the root's committed `docs/` (`../docs`), the same bytes it copied before the move, as `v3/docs/` is ignored and a checkout has none. That fourth file is an exception to the item's list, recorded here; no assertion changes.

The gate (`scripts/gate.mjs`): v3 is `v3/` and the two `.github` documents its governance test reads; the paths v3 left at the root are other, so a file there runs everything until v4's list names it; the v3 lane runs from `v3/`. CI caches by `v3/package-lock.json`, installs in `v3/`, and also proves `v3/version.json` untouched. 34 gate tests.

The record: 58 item files' backticked v3 paths gain `v3/` (326 words, the prefix only); `src/core` and `src/player` in CORE-01, CORE-02 and CORE-05 name v4's folders and stay, warned until v4 makes them. `project/structure.md` is regenerated. Signed lines the move makes untrue stay as they are, redrafted for his signature in the night's decisions list and left for STACK-04. The redrafts: the profile's Runtime reads "v3, frozen at 3.3.726 in `v3/`: vanilla JavaScript, Canvas 2D, esbuild (`v3/build.js`)"; its Gate line, replacing GATE-01's redraft, reads "Gate: `node scripts/gate.mjs`, as CI runs it — non-mutating, sorted by what changed: a record-only change runs the record checker alone; a v4 change runs v4's gate (types, lint, boundaries, dead code, tests, build, accessibility) inside 10 minutes; frozen v3's suite runs only when v3 code changes; anything unclear runs everything, as v3's `npm run check` in `v3/` and a release always do"; its Hosting line ends "any other release is on his call, by a step decided then, since v3's `npm run push` cannot publish from `v3/`"; and the rules' Always lines name `v3/src/utils/imageCoordinates.js`, `v3/src/config/constants.js` and `v3/index.html`. `DEV-INFRASTRUCTURE.md` says v3 runs from `v3/` and that its release steps are historical; those edits take it to 3,344 of its 3,300 words, a warning left for his budget call (wish GATE-01.2). README.md and UI-STANDARDS.md still name v3's paths at the root (wish STACK-01.2).

A v3 release: `npm run push` run from `v3/` now stops before committing, since git names the bumped file `v3/version.json`, outside its allowlist, and `v3/docs/` is ignored; a v3 release needs its own decided step (the plan's §14; wish STACK-01.1). Recovery: the tag `v3.3.726`; `git log --follow` crosses the move. Archive: adding this entry made 46 live, so REL-715 moves word for word to `project/decisions-2026-10.md`, on the owner's tick "Archive the oldest decisions" (2026-11-18), whose option text reads "your word to archive the oldest with tools/archive.mjs, down to the guideline", read as covering each archive that keeps the guideline of 45 tonight; that reading is put to him in the night's list (D47). Digest rule applied: house conventions → Testing and persistence (no test deleted, skipped or weakened; paths re-pointed with assertions unchanged).
**Supersedes:** none
**Deferred:** STACK-04

## 2026-11-18 — PLAN-6 — v4's foundations open on the architecture plan's recommended options, provisional under the owner's overnight grant
**Decision:** MERGE-01 and REFACTOR-01 ship as one architecture plan, `reviews/v4-architecture-plan-2026-11-18.md`; its question round waits for the owner while building goes on its recommended options, provisional under his grant G3. Phase 5 closes; Phase 6, v4's foundations (STACK-01 to STACK-04), opens; Phases 7 to 9 stand in Next. Because the plan names v4's items in order.
**Rationale:** The owner's words in force, verbatim. His task message of 2026-11-18: "The first item is the architecture plan (MERGE-01 and REFACTOR-01's written plan, reviewed by Codex, then my question round), before any code." His message of about 20:02 UTC the same evening, which ends "please plan for as many phases of work as possible", and his three answers of about 20:05 UTC are word for word in the plan's Appendix A; of them, G3 answered "Proceed on recommendations (Recommended)" to the question of what should happen if the plan was ready after 22:30, the option reading "If the plan is ready before 22:30 I bring you its questions. If not, building carries on overnight using the plan's recommended options (Codex-reviewed), and each such decision goes on one list for you to rule on in the morning. Trade-off: anything you overturn is redone." His message is the existing instruction to plan and execute that `verbs/plan.md` step 5 names.

What the plan decides, each provisionally (its §18, A1 to A35): a route is geometry whose lines may fork, join, run both ways, start in several places and loop, with the lead's walk a deterministic tree; travellers (the lead, a crowd) and every other feature are modules, one folder each, meeting only at seven contact points; every time is exact, never a share of a length; the camera is the scene's and can follow a crowd; v3 moves into `v3/`, its build and release scripts and the live `docs/` untouched; about a quarter of v3's source is ported, and no test that pins an open defect is ported as a requirement. The question round is the plan's §22, two rounds of four; the decisions list for him holds each decision with what it would redo. The five lost defects (DEF-05, DEF-07, DEF-10, DEF-11, DEF-12) were verified still open and are held as checks; every one of the 111 lines of the stock take's held list, with DEF-101's save fault and the port hazard beside them, has a v4 item that must pass or weigh it (the plan's §16), and none is brought back to retire.

Departures, each stated in the plan's §17: MERGE-01's criterion that the owner answers the round before any code gives way to G3; the founding decision's hero route and flow layers give way to one kind of route (Q11); the abstraction plan's §11 kept no framework, the event bus and the mixins, which v4 does not (Q1, Q21); and the PM-Skills editor pack gains a features folder, replaced player and exported rules and a second build output. By this entry, as the pack's architecture record asks of a project's own file, v3's `project/architecture.md` is to move to `v3/ARCHITECTURE.md` in STACK-04 (A34, provisional). STACK-01 narrows to moving v3 aside; its other criteria move to STACK-02, STACK-03 and STACK-04, kept word for word in its Notes.

The phases, each to open by its own PLAN entry once the one before closes: Phase 7, the core end to end and the publishing set-up (CORE-01 to CORE-12 but CORE-11, and PUB-01); Phase 8, features as modules (FEAT-01 to FEAT-07, CORE-11); Phase 9, presets and v4.0 (PRESET-01, EX-01, A11Y-03, REV-03, REV-05, V40-01); after v4.0, wishes PLAN-5.1 and EX-03.1, AI-01 and the plan's §12 candidates in the order V40-01 puts to him. The least settled work comes last in each phase.

Phase 5 closes by rule 11: PLAN-5's Items, MERGE-01, REFACTOR-01 and GATE-01, have all shipped. The next phase's first item is STACK-01, because nothing of v4 can be installed at the root until v3 is moved aside. Recall, fresh, 8 of 8 (a separate agent with no task context, given only `verbs/recall.md`'s four questions and this checkout): (1) the last four shipped are TST-11, GATE-01, MERGE-01 and REFACTOR-01 (`project/trajectory.md`, the stock take's heading and Phase 5's); (2) GATE-01's entry, made because the owner chose "Gate by what changed (Recommended)" and no v3 code reads a record file; (3) deferred are this entry's 22 later-phase items and PLAN-5's PUB-01, EX-01, REV-03 and REV-05, all in the backlog's Next, with AI-01 there and six wishes; (4) next is STACK-01, in Phase 6.

On the owner's ticks "Archive the oldest decisions" and "Archive one more decision" (2026-11-18), the oldest live entry, REL-714 of 2026-10-11, moves to the archive word for word, leaving 45.

Standards: record-only; no digest rule applies.
**Supersedes:** none
**Items:** STACK-01, STACK-02, STACK-03, STACK-04
**Deferred:** CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-12, CORE-07, CORE-08, CORE-10, CORE-09, FEAT-01, FEAT-02, FEAT-03, FEAT-04, CORE-11, FEAT-05, FEAT-06, FEAT-07, PRESET-01, A11Y-03, V40-01

## 2026-11-18 — GATE-01 — The gate sorts by what changed: a record-only change runs the record checker alone
**Decision:** CI and `npm run check:changed` sort each change by its paths: record-only runs `node tools/check.mjs` alone, frozen v3 its whole suite, anything unplaced or unreadable everything; v4's lane waits for STACK-01; `npm run check` still runs everything. Provisional under GATELESS-2: the record-only list and the Gate line's redraft await the owner. Because he chose "Gate by what changed (Recommended)" (Q23).
**Rationale:** The owner's words in force: "Gate by what changed (Recommended)" (Q23), "Alongside the plan (Recommended)" (P4), and from his task message "Propose a faster gate, and say whether a record-only change needs the app suite". It does not: nothing in v3's code, tests or build reads a record file, and the build never ships one.

Record-only paths, the list he was shown that night: `AGENTS.md`, `CLAUDE.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, `README.md`, `project/`, `verbs/`, `tools/`, `reviews/`, `pm_skills/`. Left out on purpose: `LICENSE` and `THIRD_PARTY_NOTICES.md` (the build ships them, `tests/governance.test.js` reads them), `.github/` (the same test reads `SECURITY.md` and `SUPPORT.md`; the workflow is the gate itself), `specs/` and `_Joe/` (they hold code), and every dot-file. A path on no list runs everything, so a missing entry costs time, never a check.

How it fails towards more (`scripts/gate.mjs`): a rename is read as a deletion and an addition; a push to a branch is read against `main`, not against the push before it, so a cancelled run hides nothing; a push to `main` is read from the last commit whose run on `main` passed (GitHub's API, read-only), and each run there has a concurrency group of its own, so a run replaced while it waited, cancelled or failed leaves its change in every later range; an empty or unreadable change runs everything. `scripts/gate.test.mjs` (32 tests, Node's own runner, no dependency) tests the rule, mixed pushes and that replaced-run sequence included, on scratch repositories, and guards the list: it fails if a v3 code, test or build file names a record path, if any file is a tracked symbolic link (a link could make a v3 file a record file), if a listed path does not exist, if `npm run check` stops running v3's suite and the checker, or if CI's lanes lose their conditions. Its tests run with every lane but the record's alone. No v3 file, test or dependency changed. Codex's first pass found the replaced-run hole and the link gap, its second a chained link; all are fixed.

Proof on real pushes: of the last 24 pushes to `main`, 11 sort as record-only (the table is in pull request #170). Measured on CI: the item's own close, pushed as pull request #171 into this item's branch, was sorted record-only and ran in 29 seconds from start to green (run 44395196180), the record checker under a second of it, against about 40 minutes for the full gate.

`npm run check` stays the full gate because `push.js`, frozen v3's release helper, runs it as "The full gate (tests, shell contract, check build), matching CI". So the profile's Gate line, which names `npm run check` as the sorted gate, differs from what was built (wish GATE-01.1). The redraft, for his signature, the profile unchanged until he signs: "Gate: `npm run check:changed`, as CI runs it — non-mutating, sorted by what changed: a record-only change runs the record checker alone; a v4 change runs v4's gate (types, lint, boundaries, dead code, tests, build, accessibility) inside 10 minutes; frozen v3's suite runs only when v3 code changes; anything unclear runs everything, as `npm run check` and a release always do". `DEV-INFRASTRUCTURE.md` now stands at 3,298 of its 3,300 words (wish GATE-01.2). REV-07 (CI maturity) is untouched: its scope is coverage thresholds, a Node matrix and dependency updates, and its triggers have not fired. Digest rule applied: house conventions → Testing and persistence (a focused test for the new utility; no test deleted, skipped or weakened).
**Supersedes:** none
**Deferred:** STACK-01

## 2026-11-18 — GATELESS-2 — The owner's overnight grants: merges when checks pass, decisions on recommendations
**Decision:** On the owner's answers of 2026-11-18, a sub-chat may merge its own pull request into `main` when CI is green on the exact head commit, Codex has approved it read-only and the record checker passes, never by auto-merge; where it would ask him, it takes its recommended option, recorded as provisional. Because he asked for development through the night.
**Rationale:** His typed message to the orchestrator chat, at about 20:02 UTC, in full: "please proceed as needed with route plotter development in automated fashion where possible. I am slightly confused what each chat is doing, which is the logical order, and what is needed from me. sub chats should be children of this chat, sub chats should be opus level and only fable if needed. I want development to be continuous, so flag any questions or permissions now, and accrue decisions that come up but dont stop dev unless impossible. I will check when I can, but go to bed around 22:30 and want dev to continue through the night. please plan for as many phases of work as possible."

The orchestrator then asked four questions, whose wording is its own; each answer is an option label he picked, and he typed no text of his own in that round:
- G1, whether that message was his word to merge #169: the option label "Yes, merge #169 (Recommended)".
- G2, what he grants while asleep: the option label "Merge when checks pass (Recommended)", whose text reads: "A sub-chat may merge its own pull request into main when CI is green on the exact commit, Codex has approved it read-only and the record checker passes. Never auto-merge; nothing is published or released. Every merge is listed for you in the morning."
- G3, the architecture plan's question round: the option label "Proceed on recommendations (Recommended)", whose text reads: "If the plan is ready before 22:30 I bring you its questions. If not, building carries on overnight using the plan's recommended options (Codex-reviewed), and each such decision goes on one list for you to rule on in the morning."
- G4, PM-Skills: the option label "Yes, read and install (Recommended)", whose text reads: "A read-only copy of tag v5.0.1 goes to a scratch folder and the pack's packages are installed at the versions it names. The pinned list is shown to you in the morning, not before installing."
In a later round, about 20:12 UTC, he typed his own answers: on the orchestrator chat's context, "Hand over at 300-350k. will fresh orchestrator chats pause work?"; on its model, "keep orchestrators on fable".

The conditions of G2, as the night's sub-chats apply them: CI's Verify green on the exact head commit; Codex's read-only approval of that work; `node tools/check.mjs` and `node tools/check.mjs --commit HEAD` at 0 failures; the merge made with `gh pr merge <n> --merge --match-head-commit <sha> --delete-branch`, never `--auto`; each merge listed for him in the morning.

The orchestrator's readings, proposals for him to confirm or correct: G2 covers merges into `main` only, and not a release, `npm run push`, any change to `docs/` or `version.json`, a tag or the first v4 on Pages, which stay his call; "while you are asleep" runs from his answer until he next tells the orchestrator otherwise; G3 with his typed "accrue decisions that come up but dont stop dev unless impossible" covers every question a sub-chat would have asked him, each decision going on one list for his morning ruling, stopping only where no safe option exists; "opus level and only fable if needed" means sub-chats start on Opus 5.5, Fable only where an Opus sub-chat has shown it cannot do the piece; an orchestrator hands over to a fresh orchestrator chat, on Fable, between 300k and 350k tokens at a clean point, and running sub-chats are not paused by it. This entry rides in GATE-01's pull request, the first merge made under G2 after #169's.
**Supersedes:** none
**Deferred:** none

## 2026-11-18 — PLAN-5 — The v4 programme: a new app at the root, the architecture plan first, before any code
**Decision:** On the owner's answers of 2026-11-18, v4 is a new app at this repository's root on the PM-Skills editor stack, v3 frozen at 3.3.726 and its engine ported with its tests. Phase 5 opens: the architecture plan (MERGE-01 with REFACTOR-01's port plan), reviewed by Codex and then put to his question round, before any code, with GATE-01 alongside. Claude builds with Codex as read-only partner; Pages keeps v3 until v4's core works end to end, then each app merge he orders publishes until v4.0. He signed twenty redrafted signed lines; DEF-101 is retired. Because one route with modular features needs a model and an interface that v3's code resists. Detail: `reviews/v4-programme-2026-11-18.md`.
**Rationale:** The owner's vision and his answers Q1 to Q24 stand word for word in `reviews/v4-vision-question-rounds-2026-11-18.md`; his three rounds on this programme (P1 to P11), the session's review findings and every signed line old beside new stand in `reviews/v4-programme-2026-11-18.md`.

The two matters he settled before the rounds, in his words. Who builds: "claude builds with codex astra as partner". The live site: "export the current site as a zip I can put on xerta, and then use github pages for the new site so progress can be reviewed"; his message added that the zip exists, build 3.3.726, the live site's 24 files byte for byte, kept in his OneDrive project folder, not in this repository.

What this entry changes in earlier ones. The checker's grammar takes one heading on a Supersedes line, so that line names the first of these and this list names the rest, each by its heading and the part it loses:
- "2026-10-14 — REFACTOR-01 — After CROWD-08, a refactor in light of PM-Skills 3.1 comes before v4's merge", on the Supersedes line: it put a no-behaviour-change refactor of v3 ahead of the merge. His Q1 answer ends that: "Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests rather than rewriting it; the architecture plan decides piece by piece where a port isn't worth it. This overrules "Never rewrite"; shrink REFACTOR-01 to match." The abstraction plan's "Never rewrite" (its §1) is overruled for v4; its §11 and §16 still test each new abstraction.
- "2026-10-13 — PLAN-4 — A football crowd and mob MVP comes first; v4 merges routes and crowds": only its order. The crowd MVP has shipped; MERGE-01 is now the architecture plan of the whole of v4.
- "2026-11-18 — MERGE-01 — v4's plan also covers options built as modules and added only on demand": only its sentence "REFACTOR-01 still comes first". The two are one written plan, MERGE-01 leading; its criteria stand.
- "2026-10-14 — REL-719 — v3.3.719 ships CROWD-08 Part A; Codex takes over implementation": only who implements. Claude builds, and Codex (gpt-6-astra) reviews read-only and never writes.
- "2026-11-18 — MERGE-01 — The stock take: every open line sorted against the v4 vision, on the owner's ruling": only the filing of DEF-101 to fix CROWD-08.6 in v3, which his later words of the same day reverse (below).
- The backlog's heading "After CROWD-08: a refactor, then v4" gives way to Phase 5.

The phases, in order. The plan verb opens one phase and he asked for "phases in order", so Phase 5 alone stands under Current with this entry's Items, and the later phases stand in order in the backlog's Next, each to open by its own PLAN entry once the architecture plan has named its items: Phase 6, v4's foundations (STACK-01); Phase 7, the core end to end and the first v4 on Pages (PUB-01); Phase 8, features, the five presets and v4.0 (EX-01, REV-03, REV-05); after v4.0, wish PLAN-5.1. AI-01 stays "medium term", where he put it on 2026-10-15; the architecture plan reads it as an input and says where it falls. GATE-01 runs alongside the plan on his word, "Alongside the plan (Recommended)": it changes the CI set-up and no app code.

The publish-on-merge grant (Q15 "Every merge publishes", with Q13 and Q24) is an advance grant under the rules' Always, on these conditions:
1. It covers only a merge he orders in his own words, on a green gate.
2. It starts at the first v4 build in which the core works end to end (draw, play, save and reopen, export) and passes v4's gate; that first publish is on his call.
3. It ends when v4.0 is declared.
4. A record-only merge publishes nothing.
5. It needs PUB-01's set-up first; until then a merge releases nothing, and only `npm run push` commits `docs/` and `version.json`.
6. A v3 release stays his call alone.
Whether the Xerte copy's readiness is a further condition is open: he left that reading unticked, so it goes to the architecture plan's question round.

The signed lines. Asked when the other signed lines his answers touch should be redrafted, he chose "Redraft them all now". Shown the twenty changes old beside new (eight in the brief, ten in the profile, two in the rules), he answered "I sign all 20 as drafted" (2026-11-18). On budgets he ruled "raise to 500" for the profile; when the drafts passed that, and the Direction its 150, he chose "Raise both (Recommended)", whose text set the profile's budget at 575 words and the Direction's at 175. His "context can go up to 300k on all chats" makes the Session line 300k. The `## Signed` line at the foot of each file is untouched; two header comments that restate the budgets follow his ruling. No App opinion or Accessibility testing line is written yet: the checker reads each as the switch for a pack that STACK-01 installs. The brief's "What we are building" and "Platform and deployment" sections were not among the lines shown to him and still describe v3; MERGE-01's plan brings their amendment.

Lines this entry disposes of:
- DEF-101 is retired unbuilt, on his words "drop this fix, concentrate on building new" and "No v3 fix, v4 check kept (Recommended)"; the fault stays a check v4 must pass when it ports saving, carried by MERGE-01.
- REL-726.1 is retired by his explicit waiver for release 3.3.726, "Waive it".
- DEF-99.2 is retired on his word, "Retire it (Recommended)", v3 being frozen.
- GATELESS-1.1, GATELESS-1.2, V31-UPGRADE.1 and V31-REFRESH-4.1 are paid by the signed-lines redraft he signed here.
- INTAKE.10 and REL-720.1 are promoted to PUB-01, the publish-on-merge set-up.

Review findings (F1 to F12 in the programme file). Answered here: the record's direction contradicted his vision (F1, F2, F3); v3's code resists a new route model and an interface that grows, so the architecture plan comes first (F4); the gate takes about 34 minutes a push even for the record (F5, GATE-01); the budgets (F10). Deferred, each a line: no type checker, lint or enforced layers (F6, STACK-01); accessibility evidence (F7, REV-03 and REV-05); publishing (F8, PUB-01); the port hazard and the v3 architecture file (F9, F11, MERGE-01 and STACK-01); the brief's two v3 sections (F12, MERGE-01).

Phases 2 and 3 are closed: every item on PLAN-2's and PLAN-3's lists has shipped, or left the backlog unshipped by the stock take's ruling with its obligation carried. DEF-15, DEF-19 and DEF-22 of Phase 2 and DEF-85, DEF-87, DEF-88, DEF-90, DEF-92 and DEF-93 of Phase 3 are held as checks v4 must pass on MERGE-01's held list; closing the two phases ends none of them. The next phase's first item is MERGE-01, because nothing of v4 can be built before its model, its modules and the port are decided. Recall, local, 8 of 8: (1) the last four shipped are REFRESH-501, UI-06, CROWD-07 and TST-11 (`project/trajectory.md`, its first two headings); (2) the stock-take entry of 2026-11-18, made because v3 is frozen and Q2 turns open v3 defects into checks v4 must pass; (3) deferred are STACK-01, PUB-01, EX-01, REV-03 and REV-05 by this entry and AI-01 by its own, all in the backlog's Next, and wishes INTAKE.32, EX-03.1, REFRESH-501.1 and PLAN-5.1; (4) next is MERGE-01, in Phase 5.

On his tick "Archive one more decision" the oldest live entry moves to the archive, leaving 45. Standards: this change is record-only and applies no digest rule.
**Supersedes:** 2026-10-14 — REFACTOR-01 — After CROWD-08, a refactor in light of PM-Skills 3.1 comes before v4's merge
**Items:** MERGE-01, REFACTOR-01, GATE-01
**Retired:** DEF-101
**Deferred:** STACK-01, PUB-01, EX-01, REV-03, REV-05

## 2026-11-18 — MERGE-01 — The stock take: every open line sorted against the v4 vision, on the owner's ruling
**Decision:** On the owner's ruling of 2026-11-18 the 195 open lines take one disposition each: 84 merged into MERGE-01 and 22 into REFACTOR-01 as a held list the architecture plan must work through, 7 folded into REL-726.1 and REV-05, 60 retired, the rest promoted, narrowed, parked or kept; DEF-101 is filed to fix CROWD-08.6 in v3. His words and every removed line stand in `reviews/v4-stock-take-2026-11-18.md`.
**Rationale:** v3 is frozen at 3.3.726, and the owner's answer Q2 says open v3 defects "become checks v4 must pass, or are retired on your word in the stock take". DEF-15, DEF-19, DEF-22, DEF-51, DEF-54, DEF-55, DEF-56, DEF-57, DEF-58, DEF-60, DEF-62, DEF-63, DEF-65, DEF-66, DEF-67, DEF-68, DEF-69, DEF-70, DEF-71, DEF-73, DEF-74, DEF-75, DEF-78, DEF-79, DEF-80, DEF-85, DEF-87, DEF-88, DEF-90, DEF-92, DEF-93, DEF-95, DEF-97 are merged into MERGE-01 as checks v4 must pass, because each is a fault in something v4 will also do. UI-06, CROWD-07 and UI-07 are merged into MERGE-01 as inputs to v4's interface design, because what is left of each is v3 interface work that v4 replaces. TST-11, DEL-02, DEL-03, DEL-04, DEL-05, DEL-06, DEL-01 are merged into REFACTOR-01 as notes for the port, because v3's dead code and frozen suite are never changed now. DEF-50, DEF-76 are retired as paid, because both passes traced the fix in 3.3.726. UI-06, CROWD-07 and TST-11 shipped most of their work, so each takes a trajectory line and is not on the Retired field. REFACTOR-01 is narrowed to the port and EX-01 to one scene for each of the five presets, in his words of Q1, Q19 and Q24. MERGE-01 gains one criterion, on his word: its plan gives every held line a v4 item or brings it back to him. On his word the oldest live decisions are archived down to 45. Codex (gpt-6-astra, read-only) made the blind pass; the removed wishes are traced in this commit's body.
**Supersedes:** none
**Retired:** DEF-15, DEF-19, DEF-22, DEF-51, DEF-54, DEF-55, DEF-56, DEF-57, DEF-58, DEF-60, DEF-62, DEF-63, DEF-65, DEF-66, DEF-67, DEF-68, DEF-69, DEF-70, DEF-71, DEF-73, DEF-74, DEF-75, DEF-78, DEF-79, DEF-80, DEF-85, DEF-87, DEF-88, DEF-90, DEF-92, DEF-93, DEF-95, DEF-97, DEL-02, DEL-03, DEL-04, DEL-05, DEL-06, DEL-01, UI-07, DEF-50, DEF-76
**Deferred:** DEF-101, MERGE-01, REFACTOR-01

## 2026-11-18 — REFRESH-501 — The project takes pm-skills 5.0.1 by the refresh route: seven files replaced, the record kept

**Decision:** The project runs pm-skills 5.0.1, build fd5fb94 (the tag v5.0.1 of canon), from 5.0.0 (a2a4b37), by the release's own refresh route, in the commit before the one carrying this entry: tools/check.mjs, harness.mjs, ledger.mjs, migrate.mjs and read.mjs and verbs/intake.md replaced and tools/VERSION now reading 5.0.1, as a set; no pack installed; AGENTS.md, CLAUDE.md and every file under project/ unchanged. Because the owner's word of 2026-11-18 sends the seven projects to 5.0.1, this one first.

**Rationale:** The first use of the released instructions: pm-skills 5.0.1's Upgrade action 1 and the shipped README's "Refresh to a later 5.x". The route first ran on a disposable clone, its printed rollback tried and the tree found back as before; then here, once, and refused nothing: no project file sits on a replaced path, and the 117 files under project/ were byte-equal and written nothing. The installed build was found by the tag v5.0.0 alone. Every installed tool, verb, AGENTS.md and CLAUDE.md now equals v5.0.1's bytes (26 files). The checker gives the same result before and after, no failure and the same two warnings; the start read differs only by the item's backlog line and 5.0.1's own leaving out of a closed phase heading with nothing under it. No signed file changes: the profile, rules file and brief are untouched, and the signed Harness sentence stays as the earlier entry left it. Rollback: `git revert --no-edit` of the refresh commit, or revert the pull request's merge commit; nothing outside the repository changes.

- Migration edit: none — no project file sits on a replaced path

**Supersedes:** 2026-11-16 — V31-REFRESH-4 — The project takes the lab's pm-skills 5 candidate b875c63 by the refresh route: seventeen files replaced, tools/VERSION added, the record kept

**Deferred:** none

## 2026-11-18 — MERGE-01 — v4's plan also covers options built as modules and added only on demand

**Decision:** MERGE-01's plan gains three criteria and a §16 test: how the code holds each option as a module a layer takes on only when the author adds it, how advanced functionality stays on demand, and how v4 is shown to be simpler than v3 in the interface and the code. Because on 2026-11-18 the owner paired the merge with a modular feature set added as needed.

**Rationale:** The owner's question and answer are verbatim in the item's Notes of 2026-11-18. The record held the merge (PLAN-4), the features pop-up in MERGE-01's criteria and REFACTOR-01's modularity ahead of it, but nothing on options built as modules in the code, on advanced functionality staying hidden until added, or on simplifying the back end. The abstraction plan's §16 warns against a generic registry, flags or mode strings and an abstraction for a hypothetical consumer, so a module design must answer §16.1 and §16.2 with the options v4.0 ships, or record a departure for the owner. The criteria's wording is the session's, which the owner accepted, for the plan to weigh. The work is not begun, on his word; REFACTOR-01 still comes first; nothing else in PLAN-4 or REFACTOR-01 changes. The criteria are in `project/items/MERGE-01.md`.

**Supersedes:** none

**Deferred:** none

## 2026-11-16 — V31-REFRESH-4 — The project takes the lab's pm-skills 5 candidate b875c63 by the refresh route: seventeen files replaced, tools/VERSION added, the record kept

**Decision:** The project runs PM-Skills lab b875c63, the candidate for pm-skills 5.0.0, from 8d4e029, by the lab's refresh route, in the commit before the one carrying this entry: seventeen tools, verbs and CLAUDE.md replaced and tools/VERSION added, reading 5.0.0, as a set; no pack installed and no App opinion line added; AGENTS.md and the project's files unchanged. The owner's signed Harness sentence is not taken: it makes the profile 402 words against its hard budget of 400, so it waits on his decision (wish V31-REFRESH-4.1). Because the owner released the round on 2026-11-16.

**Rationale:** The lab's V31-REFRESH-4, this project's share, on the owner's words of 2026-11-16 for the round, "Yes, merge on green (Recommended)" and "Yes, use gh (Recommended)". The route ran once and refused nothing: no project file sits on a replaced path. Every installed tool and verb equalled 8d4e029's bytes before it, so no local edit is carried; every installed tool, verb and the contract now equal b875c63's bytes. The checker gave the same result before and after, no failure and two warnings; the start read is byte-identical over the unchanged record. The signed Harness sentence, signed by the owner for all four profiles on 2026-11-12, is left out because adding it, or raising the budget or trimming other words, changes the signed profile beyond that signature. The profile, rules file and brief are untouched. Rollback: `git revert --no-edit` of the refresh commit, or revert the pull request's merge commit; nothing outside the repository changes.

- Migration edit: none — no project file sits on a replaced path

**Supersedes:** 2026-11-12 — V31-REFRESH-3 — The project takes pm-next v3.1 as the lab builds it after Phase 15: six tools and the intake verb replaced, the record kept

**Deferred:** none


## 2026-11-12 — V31-REFRESH-3 — The project takes pm-next v3.1 as the lab builds it after Phase 15: six tools and the intake verb replaced, the record kept

**Decision:** the project runs pm-next v3.1 at PM-Skills lab 8d4e029 from the commit carrying this entry: brief, check, find, ledger, structure and view replaced and verbs/intake.md replaced, as v3.1's set — because the owner released the round on 2026-11-11 ("lets do all the planned steps") and the project's first-month test ended on 2026-11-02.

**Rationale:** The lab's V31-REFRESH-3, by V31-REFRESH-1's and -2's route. The upgrade tool has no route for a later v3.1 build over an installed v3.1, so this follows the change notes' "Existing installations" rules by hand: every installed tool, verb and AGENTS.md matched 4ab66b5's bytes, so no local edit is carried; the six tools and intake.md are replaced as a set from lab/next-v31 at 8d4e029; AGENTS.md, CLAUDE.md and tools/read.mjs are unchanged. The start read is byte-identical before and after (19,226 bytes). No pack is installed and no App opinion line is added: the project is not a new app, and an installation without the line gains nothing. The profile, rules file and brief are signed and are not edited, comments included; the templates' comment changes are not taken. The AAA digest is unchanged: no change note since 4ab66b5 names one. The new checker reads project/architecture.md as the 3.26 record only where it carries the template's mark line; this project's own project/architecture.md, routed by the rules file, is unchanged and is not that record, so the checker shows no failure and the same two warnings as before. The session hooks are not regenerated: harness.mjs is not among the changed files. The warning on live decisions (58 against the budget of 45, this entry included) stays: the rules file allows archiving only on the owner's word (the wish line V31-REFRESH.1). Rollback: revert the pull request's merge commit; nothing outside the repository changes.

- Migration edit: none — every replaced file was 4ab66b5's, byte for byte

**Supersedes:** 2026-11-05 — V31-REFRESH — The project takes pm-next v3.1 as the lab now builds it: tools and verbs replaced as a set, the record kept

**Deferred:** none


## 2026-11-05 — V31-REFRESH — The project takes pm-next v3.1 as the lab now builds it: tools and verbs replaced as a set, the record kept

**Decision:** the project runs pm-next v3.1 at PM-Skills lab 4ab66b5 from the commit carrying this entry: six tools and three verbs replaced, two tools and five add-on verbs added, as v3.1's set; rule 9 asks a Checked line only where a model policy requires one, and this project keeps none; the WCAG 2.2 AAA digest follows in the next commit — because the owner asked on 2026-11-05 to upgrade his projects to the latest pm-skills, the project's first-month test having ended on 2026-11-02.

**Rationale:** The lab's V31-REFRESH-2, by V31-REFRESH-1's route. No route in v3.1's change notes covers a later v3.1 build over an installed v3.1 (the upgrade tool refuses a second snapshot), so this follows the "Existing installations" rules by hand: every installed tool, verb and AGENTS.md matched b5c6f4b's bytes, so no local edit is carried; tools and verbs are replaced as a set from lab/next-v31 at 4ab66b5; the contract merges rule 9's one change; no project template is copied over the record, and the decisions template's sentences on Items and Retired are merged into this file's comment; the status site's outputs, project/view.html, project/view.site/ and project/.view.html.*, are ignored, as the build's hook documents; structure.md's tools and verbs rows name the new set. Replaced: check.mjs and ledger.mjs (a closed phase is checked against the PLAN Items list no other supersedes, a Retired field, traces read in a Rationale, the trajectory read by each line's own date with a phase-order warning), handover.mjs (the start notice's recovery sentences), harness.mjs (the post-commit hook rebuilds the status site), view.mjs (the status site beside view.html), migrate.mjs (the upgrade checks), and the intake, plan and close verbs. Added: brief.mjs and lanes.mjs, for orchestration and parallel writers, and the add-on verbs orchestrate, control, sweep, stocktake and design-review, which no rule reads. The session hooks are unchanged: `harness.mjs --hooks-only --harness claude`, as V31-UPGRADE ran it, writes the same .claude/settings.json at b5c6f4b and at 4ab66b5, byte for byte, and the installed file equals it, so no setting is regenerated. The new checker fails nothing here: no phase-close list stands beside a differing one, so no PLAN entry is restated. It warns three times: the rules file's Always section and the live decisions as before — 57 live decisions, this entry included, against the budget of 45, left because the rules file allows archiving only on the owner's word (the wish line V31-REFRESH.1), and, new with this checker's phase-order rule, the trajectory's phase order, which the next commit repairs. The profile's Gate line still says "the v3 checker"; its wording stays the owner's to sign (the wish line V31-UPGRADE named). Rollback: revert the pull request's merge commit; nothing outside the repository changes.

- Migration edit: none — every replaced file was b5c6f4b's, byte for byte

**Supersedes:** 2026-10-21 — V31-UPGRADE — The project runs pm-next v3.1: tools, verbs and the start-notice hook replaced as a set, the record kept

**Deferred:** none

## 2026-10-21 — V31-UPGRADE — The project runs pm-next v3.1: tools, verbs and the start-notice hook replaced as a set, the record kept

**Decision:** the project runs pm-next v3.1 (PM-Skills lab b5c6f4b) from the commit carrying this entry — its twelve tools and four verbs, the item schema's Now section, the start notice as a third session hook — and, each in a commit of its own after it, the wish lines take permanent IDs, each trajectory phase goes oldest first, and the WCAG 2.2 AAA digest takes v3's repair; because the owner's relayed word of 2026-10-21 approved v3.1 and asked for the upgrade, after this project's day-21 reading was sealed.

**Rationale:** The lab's V31-FIELD-2, by v3.1's upgrade route (lab/next-v31/CHANGELOG.md, "Existing installations — v3 to v3.1", and the lab's V31-DEPLOY procedure). The archived decisions and their index moved beside decisions.md in a commit of its own (27c6f1e: project/decisions-2026-10.md, project/archive-index.md, no byte changed, no entry archived or pruned) and v3.1's migrate tool was committed alone (b8c64e6), both before the snapshot, which refuses chunks under project/archive/. The snapshot at b8c64e6, against the pinned build 155f145: 1112 tracked files; 54 open and 58 shipped lines, 103 decision entries, 137 wish lines, 95 item files, 5 digests, 2 archive files. Its inventory, project/migration/upgrade-v3.1.json, sits beside the canon migration's inventory and census, kept byte for byte. `node tools/migrate.mjs --verify --upgrade v3.1` before the commit: migrate: 0 failure(s), 2 warning(s) — that no commit was named yet, and that .claude/settings.json changed, the hook merge this route calls for, on the owner's word below. project/items/_schema.md was v3's unedited copy and takes v3.1's (V31-NOW). `node tools/harness.mjs --hooks-only --harness claude` merged the start notice (tools/handover.mjs on SessionStart startup and clear) into .claude/settings.json as a third group, every other setting kept; .claude/settings.intake.json, for intake only, is unchanged. The Session line stays at 200k. The comments in wish-list.md, decisions.md and trajectory.md now state v3.1's wish-line form, the archive's place and the order within a phase; structure.md's tools and verbs rows name v3.1's set. The profile, rules file and brief are unchanged and keep the owner's signatures; the profile's Gate line, "the v3 checker", still names the v3 family's checker, and a wording correction is proposed to the owner in the pull request. The 55 live entries stay over the budget of 45: archiving is on the owner's word (the rules file), and the upgrade moves no entry. Between this commit and the stamp, v3.1's checker fails each of the 137 unstamped wish lines, as V31-WISH-IDS's note foresees. This entry supersedes the intake's in its build clause only, "pm-next v3's (PM-Skills-lab commit 155f145)"; the rest of it stands. Authority: the owner's words of 2026-10-21 in the lab's orchestrator chat, relayed and not seen by him in this chat: "I approve all the 3.1 aspects and want AI to proceed through to the upgrade as much as possible, proceeding on the basi of recommendations." (01:05 BST) and "you have permission for everything including model changes, proceed" (about 01:10). The pull request is his to merge. Local edits, each disposed:

- Migration edit: tools/migrate.mjs — re-applied — v3.1's copy, committed alone before the snapshot

**Supersedes:** 2026-10-01 — INTAKE — Route Plotter adopts pm-next v3 from canon 4.7.0

**Deferred:** none

## 2026-10-19 — REL-726 — v3.3.726 publishes Background → Show image

**Decision:** v3.3.726 publishes UI-08's Background → Show image on the owner's call; the player changes, so the owner's MP4 and HTML saved-file check is owed for this release.

**Rationale:**
- **The owner's words, verbatim:** "https://djdaojones.github.io/route-plotter/ is still missing the hide background toggle" (2026-10-19), then, offered the release, "Release v3.3.726 now. I've paused OneDrive syncing and the Mac is plugged in."
- **Why it was missing:** PR #160 merged at 15:21 UTC, and a merge does not release (`DEV-INFRASTRUCTURE.md` → Deployment), so Pages served v3.3.725's `docs/` until this release.
- **Source:** PR #160, squash merge 5df463e8d481b474d2c8cc5ed1ca8cab5a9a6f17 of final head fac7713; pull_request Verify 39277077754 and push Verify 39276962667 on the head and main push Verify 39277148335 on the merge succeeded.
- **Release:** from the `route-plotter/` working clone on clean main 5df463e matching origin/main, Pages source main /docs built at 5df463e, rollback tag rollback-v3.3.725-5df463e pushed. release.sh's gate passed (203 files, 4,385 passed, 2 todo; check 0 failures, 2 warnings) and its dry-run passed. Its `npm run push` then failed its own check and pushed nothing: the Mac slept, lid closed on battery, from 17:14 to 18:01 BST, and seven tests in `tests/networkBudget.test.js` and `tests/staleRouteState.test.js` timed out (up to 909,089 ms against 10,000); main, origin/main and Pages stayed at 5df463e. release-from-push.sh on the same SHA re-ran the dry-run and `npm run push`, which passed its full check (203 files, 4,385 passed, 2 todo; restartSafety; build) and pushed deploy c1690c6 "chore: deploy v3.3.726", which changes `docs/app.js`, its map, `docs/index.html`, `docs/meta.json`, `docs/player.js`, `docs/styles/main.css`, the five example ZIPs and `version.json`.
- **Publication:** main-branch Verify 39297723567 and the Pages build, deploy and report checks succeeded; github-pages deployment 7180856432 reached c1690c6; the published comparison of every file under docs/ was match 24, mismatch 0, errors 0. Three of the script's status polls could not reach api.github.com and were retried.
- **Live,** after clearing localStorage, sessionStorage and IndexedDB, in the browser pane with a 1280×800 viewport emulated: the title shows v3.3.726 and Help "Version 3.3.726"; Open day played to 3,002 ms and on to its end (1,442 frames) with no queued frame; MP4 9,819,817 bytes, 1920×1080, 29.03 s (v3.3.725's size); HTML 2,070,772 bytes carrying the project, the CSP and the exact live player; no failed resource. Match day (1,827,679 bytes; 180, 938 and 117 dots; 35.4 s), Reform riot, 1831 (1,821,528 bytes; 132 to 480 dots; 24 s), Site walk and Signal flow open with the image shown. Each example ZIP is 5 to 8 bytes smaller: unzipped against v3.3.725's, its background is byte-identical and `project.json` loses only `exportSettings.pathOnly: false`, which UI-08 no longer writes.
- **Show image, live,** on Open day: the Background card's Show image starts ticked, as does Include in export → Background image, and unticking it unticks both and sets `background.hidden`. Shown, the editor draws the image once (97,525 colours on its 1,404×790 canvas); hidden, it draws no image (839 colours, one colour on 95 %). Video exports driven through the app's own `exportVideo`, with the encoder replaced by one that reads the canvas at 25 %, 50 % and the end: hidden, no frame draws the image (707 to 761 colours, one colour on about 95 %); shown, every frame draws it once (106,084 to 135,698 colours). A real hidden MP4 (2,814,048 bytes, 1920×1080, 29.03 s, the size of v3.3.725's path-only MP4) decodes at its middle and at 90 % to one colour on 94 % of the frame. The hidden HTML export (483,876 bytes) carries the project, the CSP and `background.imageSize` 2,914×2,061, the image's own, and no background image; the shown one (2,070,772 bytes) embeds it as `__ROUTE_PLOTTER_BG__` (1,586,916 base64 characters); the one image both carry is the player's own bundled PNG. Ticked again, the editor redraws pixel-identical to before the hide; a hide is one undo step. The check's first run failed three checks on its own faults (spreading 100,000+ colour counts into `Math.max` overflowed the stack on map frames, which `exportVideo` caught, and two thresholds); fixed and rerun on a fresh load, all 12 passed. The console's only errors are that first run's three "Video export failed: RangeError" lines from the replaced encoder.
- This answers UI-08's wish line in part, in the page: an MP4 shows a flat field where the image was. A WebM, and a saved HTML export with the image left out opened from disk, are still unchecked, and so is the owner's saved-file check (a wish line).
- Annotated tag v3.3.726 (3c8a299) at deploy c1690c6c9782fea240bb0be2ef37712438b6daec.
- House conventions: positive publication evidence and one owning record per fact; these browser checks do not replace the owner's saved-file check.

**Supersedes:** none

**Deferred:** none

## 2026-10-19 — UI-08 — Background → Show image hides the background everywhere, one setting with the export checkbox

**Decision:** On the owner's word, Background → Show image shows or hides the background image while editing, in playback and in MP4, WebM and HTML exports, Include in export → Background image follows it, and a save from before it opens shown; as the lead's reading of "keep code lean", for the owner to confirm, the one setting is saved as `background.hidden` and `exportSettings.pathOnly` is no longer read.

**Rationale:**
- **The owner's words, verbatim.** Filing, 2026-10-18: "for the backlog, the background section needs a toggle to hide the background - this could be the next feature added", then "Everywhere (Recommended)". The plan, 2026-10-19: the name, "Show image (Recommended)"; a save made with the export checkbox unticked, offered "Image hidden (Recommended)" and "Image shown": "image shown, but we need no backward compatibility, so keep code lean"; an HTML export with the image hidden: "Leave it out (Recommended)"; an image chosen while hidden: "Show it".
- **Readings, proposed for the owner to confirm:** the setting is a new saved field and the old one is ignored on load and no longer written, so an old save opens shown with no migration code; the flip to shown when an image is chosen is an undo step of its own, so Undo hides the new image again and keeps it.
- **Design:** one setter, `setBackgroundHidden` (`src/app/backgroundLoading.js`), behind one bus event, `background:hidden-change`, which both checkboxes send; `video:layers-change` is gone. A slider edit still inside its undo debounce is saved first, so it stays a step of its own. A video export draws every frame as Show image stood when it began, and a tick meanwhile shows once it ends, as DEF-53 does for a size. While hidden the renderer's background pass draws nothing, neither the image, its white margins, its tint nor a reveal mask, in every Reveal mode (Reveal's Hide still draws the tint). The image keeps its place, so a video export no longer clears it: DEF-100's placement holds by construction, and its clearing step is gone. A hidden image's HTML export embeds no background bytes, only `background.imageSize`, from which the player places everything. The undo entry and the load's baseline both carry `backgroundHidden`, byte for byte (CON-04). Clear All starts shown.
- **UI:** a native checkbox labelled Show image in the Background card, between Zoom and Upload, its help on the label's hint, its row a 44 px target by the Path emphasis rule; Space is the checkbox's own. Design review gate: Carbon's checkbox, as Path casing and Include in export use it; Nielsen's consistency (one name per state) and user control (undo) most at risk; no AAA exception.
- **Tests:** `tests/showImage.test.js` (22 cases) and two hidden-export cases, MP4 and WebM, in `tests/exportFraming.test.js`: no background call in any frame, the path layer call for call as with the image, the image kept. Each part of the build, removed in turn, fails at least one. Re-pointed from `exportSettings.pathOnly` to `background.hidden`: the authored-extras fixture's off-default; three finish-context tests that asserted the image cleared during a path-only export now assert it kept and hidden, and change the background zoom mid-export, so they still fail without the contexts' freeze; videoExportConcurrency's frame record reads the background the renderer is given. Control, event and snapshot goldens regenerated for the new control, event and field; draw goldens unchanged. They still draw no hidden export (the wish list's TST-17 line), now because their harness loads the background after the project, which shows it.
- **Review:** gpt-6-astra (Codex CLI, high), read-only, r1 on 39bdf41: not yet. Taken: a pending slider edit was folded into the toggle's undo step (blocking); a tick during a running export changed its later frames; this heading's close lacked rule 11's record; the Decision line and criteria put the lead's readings under the owner's word; the re-pointed finish-context tests no longer challenged the freeze.
- **Phase close** (rule 11): "Next feature — the owner's word of 2026-10-18" held UI-08 alone, which this closes. Asked what is built next (offered DEF-15, REFACTOR-01, or leaving it open), the owner, verbatim: "we stop dev for now. close everything out cleanly, merge and commit as appropiate, and close out chats". So no next item is named; it waits on his word.
- **Recall, local** (verbs/recall.md), 8/8, answers produced before the result was written: (1) the last four shipped: UI-08, DEF-99, DEF-100, EX-03, as the trajectory reader takes them, each phase's last line first (`project/trajectory.md`, under Next feature, Export framing and The built-in examples; EX-03's line moves below EX-02's for it, as CROWD-08's close moved its own); (2) one decision: this one, one setting, because the owner picked "Everywhere" with the export checkbox following; (3) deferred: none here; the backlog's `— (from: …)` lines and `project/wish-list.md`'s open lines, two of them UI-08's; (4) no next item: development stops on the owner's word above.
- Untested in a real browser: an MP4 or WebM where the image was, and a saved HTML export with the image left out, opened from disk (a wish line).

**Supersedes:** none

**Deferred:** none

## 2026-10-19 — REL-725 — v3.3.725 publishes the video export framing fixes

**Decision:** v3.3.725 publishes DEF-99's and DEF-100's video export framing on the owner's call; the player changes, so the owner's MP4 and HTML saved-file check is owed for this release.

**Rationale:**
- **The owner's words, verbatim:** "CI on #158 is green now. Merge it and fast-forward my checkout." (2026-10-19), then "Release v3.3.725 now. I've paused OneDrive syncing."
- **Source:** PR #158, squash merge c5f707aad05a5e9c05c7f22f19aacf356b437908, whose tree is the final head 04e94402eb7ee2f84e7d166c1c409ddfee10840a's; independent gpt-6-astra review approved 8773e1e in round 2 and both conflict merges in round 3 (the diff equal to 8773e1e's); pull_request Verify 39232154623 and push Verify 39232147556 on the head and main push Verify 39237394562 on the merge succeeded. Main also carries UI-08's filing (7308885, record only) and REL-724's record (382b8b0).
- **Release:** from the `route-plotter/` working clone on clean main c5f707a matching origin/main, Pages source main /docs built at c5f707a, rollback tag rollback-v3.3.724-c5f707a pushed. release.sh's gate passed (202 files, 4,361 passed, 2 todo; check 0 failures, 2 warnings); its dry-run passed; npm run push passed its own full check on main's commit (202 files, 4,361 passed, 2 todo; restartSafety; build) and pushed deploy 3f3c2da "chore: deploy v3.3.725", which changes `docs/app.js`, its map, `docs/index.html`, `docs/meta.json`, `docs/player.js` and `version.json`.
- **Publication:** main-branch Verify 39248792160 and the Pages build, deploy and report checks succeeded; github-pages deployment 7173173748 reached 3f3c2da; the published comparison of every file under docs/ was match 24, mismatch 0, errors 0.
- **Live,** after clearing localStorage, sessionStorage and IndexedDB, in a hidden browser pane with a 1280×800 viewport emulated: the title shows v3.3.725; Open day played to 3,002 ms and on to its end with no queued frame; MP4 9,819,817 bytes, 1920×1080, 29.03 s (the same size as v3.3.724's, as an unzoomed export with its background should be); HTML 2,070,480 bytes carrying the project, the CSP and the exact live player; no failed resource. Match day (1,827,687 bytes; 180, 938 and 117 dots; 35.4 s) and Reform riot, 1831 (1,821,536 bytes; 132 to 480 dots) are unchanged; a first fetch of the Match day archive failed in the pane once and passed on retry.
- **The fixes, live,** on Open day with waypoint 3 selected and Camera movement off, exports driven through the app's own `exportVideo` with the encoder replaced by one that reads the canvas at 25 %, 50 % and the end: a path-only export places the image where the export with its background does (1,527 × 1,080 at x 196.5) and draws its route across x 292–1,468, y 214–725 of the 1,920 × 1,080 frame. On v3.3.724, checked the same way before the release, it used the display's placement (558 × 395 at x 71.8) and drew in the top-left 588 × 293. With the editor zoomed to 7.59× by five wheel steps, the renderer gets no viewport, path-only frames are pixel-identical to the 1× export's, and the editor keeps its zoom and pan. A real path-only MP4 from the zoomed editor (2,814,048 bytes, 1920×1080, 29.03 s) decodes at 17.4 s to the same drawn area. Frames with the background drawn from the zoomed editor match the 1× frames too, except for the first export after the project opens: its middle frame's background differs from every later export's, zoomed or not, in 524,329 pixels by up to 84 levels; later exports at 1× and zoomed are pixel-identical. That is a wish line, not DEF-99, as is the owner's saved-file check.
- Annotated tag v3.3.725 (df39de7) at deploy 3f3c2da3be4616f9e975ae93d5dd3d67c38a88bf.
- House conventions: positive publication evidence and one owning record per fact; these browser checks do not replace the owner's saved-file check.

**Supersedes:** none

**Deferred:** none

## 2026-10-19 — REL-724 — v3.3.724 publishes the Match day upgrade

**Decision:** v3.3.724 publishes EX-03's Match day upgrade on the owner's call; only the example definitions changed and the player is byte-identical to v3.3.723's, so no saved-file check is owed.

**Rationale:**
- **The owner's words, verbatim:** "can we commit / merge" (2026-10-18, after "Once CI is green I'll decide on merge and release."), then "Release v3.3.724 now. I've paused OneDrive syncing." and "I am going to be, so need to you conclude gateless. stop at 01:30 gmt if not done".
- **Source:** PR #155, squash merge c2a6072186f05cf257c1e725b617aa0c3dc0ca8a, whose tree is the reviewed head 088d5124fbc749c22da2a5950d611714cd74ef44's; independent gpt-6-astra xhigh round 1 approved the same tree; pull_request Verify 39163149154 and push Verify 39163111877 on the head and main push Verify 39169575115 on the merge succeeded.
- **Release:** from the `route-plotter/` working clone on clean main c2a6072 matching origin/main, Pages source main /docs built at c2a6072, rollback tag rollback-v3.3.723-c2a6072 pushed. release.sh's separate gate was not repeated: the identical tree had passed the full gate on 2026-10-18 (201 files, 4,357 passed, 2 todo), and the session read the owner's 01:30 stop as leaving no room for a second one behind another session's gate, so the resume script ran under the gate lock. Its dry-run passed, npm run push passed its own full check on main's commit (201 files, 4,357 passed, 2 todo; restartSafety; build) and pushed deploy a0256ff "chore: deploy v3.3.724".
- **Publication:** main-branch Verify 39175594435 and the Pages build, deploy and report checks succeeded; github-pages deployment 7162188451 reached a0256ff; the published comparison of every file under docs/ was match 24, mismatch 0, errors 0.
- **Live,** after clearing localStorage, sessionStorage and IndexedDB, in a hidden browser pane with a 1280×800 viewport emulated (hidden, it is 0×0 and a route has no duration): the title shows v3.3.724; Open day played to 3,002 ms and on to its end with no queued frame; MP4 9,819,817 bytes, 1920×1080, 29.03 s; HTML 2,070,460 bytes carrying the project, the CSP and the exact live player; no failed resource. Match day opens from File → Example projects: archive served 200 (1,827,687 bytes, as built from the merge), eight crowds on the 3,371-pixel aerial, Play available, its 30 s base timeline playing 35.4 s; 180 fans wait at the pubs at the start, 938 dots are out at the half, and the 117 seated fans remain at the end. Reform riot, 1831 is unchanged (1,821,536 bytes; 132 to 480 dots).
- Annotated tag v3.3.724 (b5b64b4) at deploy a0256ff3c524b8bae1f8487fd5cb4d0ceb023108.
- House conventions: positive publication evidence and one owning record per fact.

**Supersedes:** none

**Deferred:** none

## 2026-10-18 — DEF-99 — Video exports frame at their own size, with no editor zoom and path-only placed for the export

**Decision:** On the owner's word, two faults in his Match day MP4s are filed and fixed: a video export draws no editor zoom (DEF-99), and a path-only export hides the background only once the canvas has the export size (DEF-100).

**Items:** DEF-99, DEF-100

**Rationale:**
- **The owner's words, 2026-10-18, verbatim:** "exports and playback of the football example are coming out weird", with two MP4s; then "Yes, file both as defects and fix them in a scratch clone with a path-only test; stop before pushing or opening a PR."
- Both MP4s run 27.8 s, Match day's 25.77 s and the export's 2 s start buffer, so they are v3.3.723's; EX-03 (merged as c2a6072, live in v3.3.724) changes only the example, so v3.3.724 carries both faults too.
- **DEF-99:** the render state gave export frames the editor's viewport, and `_calculateCameraState` dropped the camera under it (DEF-61). In export mode the render state now carries no viewport and the camera stands, as the HTML export's player has always framed. DEF-61 recorded that export mode keeps the author's viewport but decided nothing on whether it should, and its three export checks pinned that framing. Asked whether a video exported while zoomed should ignore the zoom or copy it, the owner picked "Ignore the zoom (Recommended)"; those checks now expect the camera, as at 1×, the map, mask and route still under one transform.
- **DEF-100:** `exportVideo` cleared the image before `_enterExportMode`, which refits the image only while there is one; the image is now cleared after it.
- `tests/exportFraming.test.js`: four cases, with text labels on, all failing before the fix; the camera-on case also fails without the `camera.js` change alone. A clock moving 2 s a read lets two apps' camera-on exports match call for call (TST-09's wall-clock zoom limit).
- Codex r1 asked for the DEF-61 checks, labels in the tests, a visible camera check, a narrower DEF-100 claim and wish lines for open questions; all taken.
- What looked weird in playback is not yet known: asked, unanswered, a wish line. So is a selected waypoint's selection box drawn into exports.

**Supersedes:** none

**Deferred:** none

## 2026-10-18 — UI-08 — A toggle to hide the background is filed as the next feature, and the backlog budget rises to 1,100 words for now

**Decision:** On the owner's word, UI-08, a toggle in the Background card that hides the background while editing, in playback and in exports, is filed at the top of Current as the next feature; the backlog's hard budget rises from 1,000 to 1,100 words for now, also on the owner's word, so that the filing fits.

**Rationale:**
- **The owner's words, 2026-10-18, verbatim:** "for the backlog, the background section needs a toggle to hide the background - this could be the next feature added". Picks: "Everywhere (Recommended)", for one switch that hides the image while editing, in playback and in exports, with the export checkbox following it; "Top of Current (Recommended)". On the budget, at 988 of 1,000 words before this filing: "temporarily raise to 1100".
- **Placement:** a heading of its own, "Next feature — the owner's word of 2026-10-18", above Phase 2. Phase 2 and Phase 3 keep their items and order; EX-03 (PR #155) is unchanged.
- **Budget:** the profile's Budget line changes above the signature by this decision, as the checker's escalation requires ("a budget the project cannot meet is raised by the owner's recorded decision"). When it returns to 1,000 is not decided; the item file holds the filing session's proposal.
- The item's criteria and design are the filing session's proposals in `project/items/UI-08.md`, for a plan to settle with the owner.

**Supersedes:** none

**Deferred:** UI-08

## 2026-10-18 — EX-03 — Match day gets solid dots and fans from all over

**Decision:** On the owner's word, Match day's dots double to 0.15 so they read as solid, each stand seats as many fans as fit and walks the rest in, and fans arrive from every direction and kind of transit, including pubs, park and ride and cycle paths.

**Rationale:**
- **The owner's words, 2026-10-18, verbatim:** "alrighty, the demos need an upgrade. lets start with the football dots. these need to be more solid (less transparent), and gather at the stadium from all over, such as town square, train station, all directions of transit". His picks: "Bigger + walk-in fans (Recommended)"; arrivals "City centre", "Rail, tram and bus", "On foot, every edge" and "Cars and coaches", then "Park and ride, bikes" and "and pubs!".
- **The filing session's readings, for the owner to confirm:** the dots were never drawn transparent (the renderer fills them opaque), so "more solid" means larger; the park-and-ride drop-off, pubs, cycle routes and bike racks are illustrative places; walkers who cross Trent Bridge leave the map at its approach and arrive by the Trent Bridge Entry.
- Built from CROWD-08's parts only. Disappear dots take no seat, so each stand pairs a Collect emitter sized to its capacity with a larger Disappear one; every Finish area still seats all the dots that collect there.
- Reform riot, 1831 is unchanged; the owner's next demo upgrade gets a wish line.

**Supersedes:** none

**Deferred:** none

## 2026-10-18 — REL-723 — v3.3.723 publishes the Match day and Reform riot, 1831 examples

**Decision:** v3.3.723 publishes EX-02's two example projects on the owner's call; only the example definitions changed and the player is byte-identical to v3.3.722's, so no saved-file check is owed.

**Rationale:**
- **The owner's words, verbatim:** "CI is green on #153. Merge it and release v3.3.723." (2026-10-17), and after the second stop, "please see this through".
- **Source:** PR #153, merge 79362925fdfeef195040b050f2640d26a98eecef, final head d72ebfa1b3b813d6ddad585be5b7cfd40c603574 (the merge's tree), independent gpt-6-astra xhigh round 2 approved, pull_request Verify 39058681590 and push Verify 39058652539 succeeded.
- **Release:** from the `route-plotter/` working clone on clean main 7936292 matching origin/main, Pages source main /docs built at 7936292, rollback tag rollback-v3.3.722-7936292 pushed. Three attempts stopped before any commit, each on a time limit, not a wrong result, while other work loaded the Mac: the first gate (labelInName's shell test at 10.7 s against 10 s, another project's suite running), then npm run push's own check twice (three keyTable tests at 10.4–11.9 s when that suite restarted; goldenControls' "major" row at its 180 s limit during an OneDrive sync burst). The second attempt's gate had passed (201 files, 4,357 passed, 2 todo). With OneDrive syncing paused by the owner, npm run push passed its check (201 files, 4,357 passed, 2 todo; restartSafety; build) and pushed deploy 806713b "chore: deploy v3.3.723".
- **Publication:** main-branch Verify 39083599338 and the Pages build, deploy and report checks succeeded; github-pages deployment 7147914039 reached 806713b; the published comparison of every file under docs/ was match 24, mismatch 0, errors 0.
- **Live,** after clearing localStorage, sessionStorage and IndexedDB: the title shows v3.3.723; Open day played to 3,002 ms and on to its end with no queued frame; MP4 9,910,489 bytes, 1920×1080, 28.77 s; HTML 2,070,479 bytes carrying the project, the CSP and the exact live player; no failed resource. Both new examples open from File → Example projects: archives served 200 (1,823,409 and 1,821,536 bytes), the 3,371-pixel aerial, Play available; Match day goes from 0 to 543 dots, and the riot from 132 waiting in the square to 480.
- Annotated tag v3.3.723 (4cdd645) at deploy 806713b99520bf69a606319ac98ad730a756e564.
- The time limits that stopped this release get one wish line. House conventions: positive publication evidence and one owning record per fact.

**Supersedes:** none

**Deferred:** none

## 2026-10-17 — EX-02 — Match day and Reform riot, 1831, join the example projects

**Decision:** On the owner's word, two crowd-only example projects on the PARM aerial of Nottingham join File → Example projects, Match day (fans fill the City Ground's four stands from several routes) and Reform riot, 1831 (a mob passes through the Market Square to the Castle), and both archives are approved for publication.

**Rationale:**
- **The owner's words, 2026-10-17, verbatim:** "can you create some presets for the examples of crowds going to a football stadium and a mob narrative. the source imagery for the map is attached" and "these can be included in the current build"; "it's nottingham. the crowd should go to the city ground stands in the south. the mob should go through the square, which is the white area in the central north west"; "no wait, two presets. one for football crowds coming from multiple routes into the four stands. a completely different preset shows a historical mob scenario passing through the square". His picks: "1831 Reform riot (Recommended)", "Both bridges (Recommended)" and "Home red, away blue (Recommended)".
- The attached map is a downscaled copy of the approved `images/PARM_Aerial.jpg`, whose full-size source has the same SHA-256, so no new image bytes are published. The two archives join `public-assets.json` and `.gitignore` on his word.
- **The filing session's readings, for the owner to confirm:** "presets" are example projects, not an Add crowd offer; "included in the current build" approves publishing both archives and shipping them in the next v3.3 release; the stand outlines, routes, place names and the riot's history are the session's reading of the image, unchecked by a historian.
- Both use CROWD-08's parts only (A, B, C, D, F, G). Every Finish area seats all its dots at the render reference, so no place is reused; dots are small because the stands are small at city scale.
- CROWD-08 excluded presets from the MVP only; EX-01 stays blocked on the owner's direction. PLAN-4's presets wish line is retired, paid by these two examples; its unpaid part, offering them from Add crowd, stays as a wish line of its own.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — CROWD-08 — All seven MVP parts shipped; phase closed

**Decision:** CROWD-08's seven-part football and mob MVP is shipped and its
phase closes; REFACTOR-01 remains first next because the owner put refactoring
before v4, and the lead asks what comes next before starting it.

**Rationale:** Reconciled against PLAN-4's list and every A–G acceptance section
in project/items/CROWD-08.md: A crowds without a route shipped in v3.3.719 (PR
#139, also DEF-84); B centred Start areas in v3.3.720 (PR #142); C
arrival-ranked Finish areas in v3.3.721 (PR #144 and checked area-storage
correction #145); D relative Entry weights (#147), E independent checked copies
(#148), F Groups (#150), and G waiting/nearest-first Final whistle (#151) ship
together in v3.3.722. Source PRs own design/code reviews, full gates,
legacy/mutation proofs and committed browser/export evidence; REL-719 through
REL-722 own publication. Both private football and mob scenes were exercised
without publishing examples. Legacy off/inactive paths, additive persistence,
separate per-emitter settings, finite lifecycle bounds and the Groups/Final
whistle exclusion remain the recorded MVP limits. Carbon's native
controls/helpers, Nielsen 3 and 9's reversible actions and actionable refusals,
WCAG 2.2 AAA's 44 px targets/keyboard/focus/contrast, and house conventions'
event ownership, persistence and tests were applied. REV-03/REV-05 still own
manual assurance; the existing export wishes and general ZIP, layout and cache
observations remain open, with no scope added. The new very long crowd-name
observation gets one unjudged wish line.

Before the owner’s v3.3.722 waiver, local recall on this reconciled record
was first self-scored 8/8; independent record review R1 corrects it to
7/8 (1,2,2,2). Its original answers, produced before writing the result, are
retained: (1) project/trajectory.md → MVP and Ahead of
Phase 2's last defects names CROWD-08, DEF-84, DEF-98 and DEF-94, newest first;
(2) decisions.md → Part G: waiting crowds leave nearest first preserves seeded
identities while ranking release slots, for the football leaving scene; (3)
project/wish-list.md retains the 719/721/722 saved-file checks, presets/v4 area
proposal and general ZIP/cache/layout observations, while backlog.md's
REV-03/REV-05/EX-01 and defect lines retain their scope; (4) backlog.md → Next →
After CROWD-08 names REFACTOR-01 before MERGE-01, because the 14 October
REFACTOR-01 decision puts modularisation before v4. This is local recall, not a
fresh-session handoff test. The earlier pre-close baseline was separate and is
not this phase-close result. After the owner’s explicit 722 waiver changed the
open checks, a separate local recheck was also self-scored 8/8 and is corrected
to 7/8 (1,2,2,2). Its original answers, produced before its result write, are
retained. Answers (1), (2) and (4) keep the same anchors;
answer (3) now cites REL-722’s waiver and wish-list.md’s remaining 719/721 checks.
Both corrected scores and original answers are retained in order. R1 found
answer (1) partial in both rounds: DEF-94 should have been DEF-89 and the
Phase 3 — Design reviews anchor was missing. tools/ledger.mjs reads the latest
line of each phase first, so CROWD-08 now follows DEF-84 within the MVP phase;
this restores the reader’s newest-first order without moving any prior item.
After both R1 repairs, a separate local recall scored 8/8 (2,2,2,2), with
answers produced before its result write: (1) the canonical trajectory reader
now returns CROWD-08, DEF-84, DEF-98, DEF-89, under MVP, Ahead of Phase 2’s last
defects and Phase 3 — Design reviews; (2) Part G’s decision explains seeded
identities and nearest-first release for the football scene; (3) REL-722 and
wish-list.md retain the 719/721 saved-file checks and all earlier open export
wishes, including REL-703/REL-706; other deferred work remains in backlog.md; (4) backlog.md → Next and project/items/REFACTOR-01.md retain the
owner’s refactor-before-v4 sequence and owner-decided plan. This third result
has its own trajectory line and remains local. REFACTOR-01 is not begun; the
lead asks what comes next.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — REL-722 — v3.3.722 publishes CROWD-08 D–G together

**Decision:** v3.3.722 publishes Entry weights, checked crowd duplication,
Groups and Final whistle together under the owner's consolidated-release call.

**Rationale:** The existing part decisions own their implementation choices.
Each source merge matched its independently approved final source/PNG tree: D:
PR #147, merge b0e883862e3e6982ef962a1a01b0aaea038cfe7d, final head
6c8052912fa52234b816b8f382f0ba024b7b29a9, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38726961801 succeeded; E: PR #148, merge
6ba84d388816b4ff1e050b343bdaa9f6f0410456, final head
a21a6d26704ea9812e3cd99c0aaa77188f52dcf0, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38789757329 succeeded; F: PR #150, merge
6650e7645dc8357190641837882484172500a5f3, final head
ac5edb1b385e9a98afa6f0562cccec0a0a33807a, independent gpt-6-astra xhigh round 3
approved, pull_request Verify 38844165787 succeeded; G: PR #151, merge
5daf698687a3b98d6d31aebfeb138b3d4af9566a, final head
69083409bb89718a0380d6e66272825bc869f469, independent gpt-6-astra xhigh round 1
approved, pull_request Verify 38860680318 succeeded. The final combined
runtime's local gate and both mandatory publication gates retained every test:
201 test files, 4323 passing tests and 2 existing todos; shell/build/check
passed, zero unhandled errors. Deploy 148de6114b3091179b20545bf9af5ccc232f1f99
was pushed from clean matching main; main-branch Verify 38871256324 and Pages
checks succeeded, github-pages deployment 7114094439 reached that SHA, and
published comparison was match 22, mismatch 0, errors 0. The player is
byte-identical to the final G committed archive; the app differs only in
build.js's single build-time comment, with every other byte identical. Live
checks after cleared localStorage, sessionStorage and IndexedDB, six-waypoint
Open day played to 3002 ms and reached its end with zero queued frames; MP4
9819817 bytes, 1920×1080, 29.033333 s, decoded frames differ in 7525 sampled
pixels; original HTML 2070460 bytes carries CSP/project/exact live player and
plays to exact end with moving pixels, no external resources or exceptions;
rendered version stamp visible, no unexpected console/JS errors or failed
application resources. Annotated tag v3.3.722 was pushed at that deploy SHA.
Part G's PR owns 32 exact saved-ZIP reopens, five decoded moving MP4 variants
with 131 matching normalised evaluations, the original current-player HTML
reaching its exact end/idle, 37 inspected PNGs and the preserved failed attempts
preceding successful corrections. These browser checks do not replace the
separate owner saved-file check. After publication, the owner answered
“Waive v3.3.722’s disk check”. That explicit waiver retires only v3.3.722's
saved-file check. The existing v3.3.719 promise and v3.3.721 question stay
pending; v3.3.720's earlier waiver remains limited to 720. House conventions: testing and persistence, positive publication
evidence and one owning record per fact; no general accessibility assurance is
claimed.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — CROWD-08 — Part G: waiting crowds leave nearest first

**Decision:** Final whistle shows seeded waiting dots from zero and assigns
ordinary release slots nearest-first, with checked per-emitter Apply/Cancel.

**Rationale:** These are the lead's MVP choices under the owner's Sol High
D–G continuation, not new owner instructions. Fresh Astra xhigh approved the
canonical design against the actual Part F merge, after preliminary review.
The strict optional boolean defaults false and omits false from saved data.
It acts on an emitter's own nonempty network with explicit Entries, every Entry
carrying a Start area, and Disappear or Collect. Zero-length paths and stranded
Entries remain valid. Inactive settings persist with a reason and an off escape;
authored-on Final whistle suppresses Groups even while waiting is ineligible.

Original dot indices retain D's Entry choice, B's sample, pace, junction hashes
and drawing order. Intrinsic-image distance to each chosen Entry ranks dots,
ties by index. The numerically sorted ordinary onset-fraction multiset is
assigned by that rank, so variance and Busyness retain their distribution
without reversing departures. Waiting has no sway. Negative instants are absent;
at exactly zero the initial sample wins even for a zero-duration journey.
At positive instants cumulative terminal time wins. No epsilon or artificial
duration is added; the actual export callers retain their no-duration refusal.

Every active waiting dot uses C/F's reference clock, including without a Finish
area, across hosts, migration, load rollback and export freezes. B keeps its
no-image aspect1 while C keeps reference packing. Active waiting reuses F's
compact indexed true-arc routes independently per original dot; the new-G-only
junction rounding/arc exception is explicit. Inactive motion stays exact. C
ranks actual arrivals jointly across all emitter kinds; nonending bounded walks
park without a place or scene extension. At20,000 full2048-hop routes, codes and
checkpoints occupy92,320,000 typed bytes, excluding descriptors and other heap.
Ranks and release slots are cached, with no per-frame ranking or route rebuild.

A separate app method group owns waiting drafts and complete canonical loader,
text, retained-background and ZIP-bound admission before mutation or undo flush.
Acceptance records one undo/save. Waiting tokens bind actual identities and the
accepted flag, separately from Groups serials. Eligibility is rechecked at Apply,
preserving clearable pending-on drafts through prerequisite edits. Other-kind,
cross-panel and hidden drafts refuse acceptance; duplication exempts neither
and rechecks ownership after its asynchronous ZIP. Newer feedback remains owned.
Carbon native fields/tokens, Nielsen visible status and recovery, WCAG AAA
keyboard/targets/focus/checked submissions and house ownership/persistence/tests
apply. Source verification belongs to the PR, combined publication to REL-722.
This advances G; the whole item remains open until that publication and close.

**Supersedes:** none

**Deferred:** none

## 2026-10-16 — CROWD-08 — Verify has room for the complete crowd suite

**Decision:** Verify's job ceiling rises from 30 to 90 minutes so the complete
crowd suite can finish on the hosted runner without dropping checks.

**Rationale:** GitHub cancelled PR #150's Verify run `38829142491` on
`35b480799c4f34c10e11312c83bfce5e35e23804` after 30 minutes, annotating
“The job has exceeded the maximum execution time of 30m0s”. Its log records
3,800 passing test rows across 139 files and no assertion failure before the
cutoff; the complete local R3 gate passed 184 files and 4,187 tests. This is
the lead's capacity adjustment under GATELESS-1 and the owner's continuation
with all tests retained, not a new owner instruction. The ceiling gives the
remaining storage cases and subsequent parts room; it does not make a run
passing or extend any individual test timeout. Every test, assertion, fixture,
canonical command, independent review and exact-head CI requirement remains.
The earlier interrupted local R4 attempt is preserved and is not passing;
the complete correction, configuration and record receive a fresh full gate.
House conventions' truthful verification and behavioural testing rules apply.

**Supersedes:** 2026-10-07 — DEF-81 — Verify gets 30 minutes, since the suite reached 15

**Deferred:** none

## 2026-10-15 — AI-01 — AI-editable saves are filed in Next as a medium-term feature

**Decision:** On the owner's word, AI-01 is filed at the end of Next as a medium-term feature, so that authors can one day describe a scene and have a chat-based AI build or seed a save that the app then opens.

**Rationale:**
- **The owner's words, 2026-10-15, verbatim:** after asking how feasible it is "to export a save from route plotter, have an AI agent edit a file for you, and upload that back into the app", and hearing the filing session's analysis, he said "add to the backlog as a medium term future feature".
- **Placement:** a heading of its own at the end of Next, "Medium term — the owner's word of 2026-10-15". The item's order among Next's items, its timing relative to MERGE-01 and its design are the filing session's proposals in the item file (`project/items/AI-01.md`), for a plan to settle with the owner.
- CROWD-08, REFACTOR-01 and MERGE-01 are unchanged.

**Supersedes:** none

**Deferred:** AI-01

## 2026-10-15 — CROWD-08 — Part F: shared group journeys and checked edits

**Decision:** Groups share seeded choices, release and pace on a reference
clock, while checked crowd edits prove whole-project ZIP headroom before mutation.

**Rationale:** These are the lead's narrow MVP choices under PLAN-4 and the
owner's instruction to continue D–G on Sol High with tests and independent
reviews, then publish together. Independent Astra xhigh approved the design
and the storage proof before implementation; approval of the code remains a
separate requirement. Defaults are off, four dots and 2% width; strict size
1–5,000 and finite width 0–20% persist additively, retaining inactive settings.
Off, ineligible and configured-size1 keep the old movement and clocks.

Each emitter's group index owns its Entry, release, pace and junction hashes;
original member indices own start samples, sway and render identity. Actual
members occupy a fixed row-major grid across and behind the front. Width is
normalised Euclidean image distance, so a square looks rectangular on a
nonsquare image. True arc distance pins canonical spline endpoints. A bounded
chord normal narrows U-turns without normalising tiny chords. Members approach
their staging places, wait for the last, lag along the network, then collapse
at a terminal and take C's places in actual arrival order. Walking variation
stops at collapse or nonterminal parking; a nonzero-sway phase step is explicit,
not a promise of general formation continuity. Nonending walks park after the
2,048-hop bound and do not extend the scene or count as arrivals.

Active groups use indexed topology and shared logarithmic weighted sum trees,
rebuilding the excluded arrival path rather than subtracting a huge weight
from a rounded root. New active-group junction rounding is accepted; ordinary
choices retain their exact arithmetic. Packed per-group routes and 32-hop
checkpoints share edge arcs. All active groups use C's reference clock, even
without an Exit area, across editor/player/export/load/rollback. This is a
new-group-only exception to the previous clock choice, not an unrelated fix.

Groups forms use native fields under Motion More and per-emitter outline
forms, context-owned provisional drafts, Apply groups and Cancel edits.
Inactive-on controls permit turning off. Shared readiness errors name applying
groups for this form while ordinary copy feedback stays literal. All three
fields keep their own parameter hints alongside the form instructions through
refreshes and errors. The native Groups grid and checkbox styles are scoped to
these controls, preserving the existing beacon scope. Motion keeps Speed, Pace
variation and At journey end in its primary tier, with Groups under More. Empty
crowds retain disabled Groups controls and usable hints; scoped disabled tokens
and cursors restore on an eligible emitter. Feedback remains with its original
emitter across an empty selection. One app owner checks the complete
canonical candidate before undo flush, mutation or one undo/save. Cross-panel
conflicts name the other panel's cancel route; pending drafts and accepted
edits invalidate E's asynchronous copy. Unrelated newer errors stay owned.

The proven B/C/D completed-ZIP gap is closed by the same checked-edit helper.
Node areas, Entry weights and Groups count exact prepared UTF-8 JSON, every
binary, both path copies, the assets folder and ZIP overhead using the reviewed
browser DEFLATE upper bound. Retained background bytes cannot be omitted.
This sufficient guarantee can refuse a compressible project that still saves;
that deliberate tradeoff keeps these actions synchronous and is explained in
README. The refusal recommends smaller background/fewer images; text failures
retain their own correction. Global Save/prepareArchive/exportZip admission
is unchanged. Exact prepared/post-accept JSON equality is required.

Digest rules: house app ownership, additive persistence and behavioural tests;
Carbon native fields/disclosure/tokens; Nielsen provisional status, prevention
and recovery; WCAG 2.1.3 keyboard, 2.5.5 targets, 3.3.6 checked reversible edits.
Physical-device and screen-reader assurance remains REV-03/REV-05.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Checked crowd copies preserve drafts and ZIP text

**Decision:** Duplication preserves pending edits and refuses prepared ZIP text
that the browser would split or replace before accepting a checked copy.

**Rationale:** The independent storage preflight found that successful ZIP
creation alone does not prove text can reopen intact. A browser reproduction
saved and reopened the original with its emoji, then accepted a copy whose
extra metadata shifted that emoji across a 16,384-code-unit string boundary;
the generated ZIP failed the loader's fatal UTF-8 decoder. Node's encoder can
instead replace the character, so tests compare exact restored text as well.

The independently approved correction checks the exact prepared JSON for
surrogate pairs crossing every chunk boundary and for raw lone surrogates.
Well-formed JSON escapes remain safe. A regression pins the reviewed browser
JSZip distribution, because its chunking and encoder own this assumption.
Duplication still validates the complete model and actual compressed ZIP, with
its existing asynchronous ownership guards. A refusal preserves source,
selection, inspection, history and recovery; a label or image-name correction
permits retry. The existing native error owners link the recovery instruction.
Readiness also checks live Node-area, all Entry-weight rows, both Path-weight
editors and Busyness number drafts before validation and acceptance. Tracking
compares the last displayed value, preserving unchanged rounded readouts. An inline rename can blur and commit during a strip rebuild
after validation. Starting one now abandons the current check before creating
the new input; its old completion cannot redraw, commit or steal focus. An
already open rename is refused without rebuilding its row, preserving the
field even when a native action activates without first moving focus. The user
finishes the name and retries as a separate reversible action.

This applies house persistence and behavioural testing, Nielsen prevention and
recovery, Carbon helper text, and WCAG checked reversible submissions.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Part E: a checked independent crowd copy

**Decision:** Both native authoring surfaces duplicate a crowd above its source
in drawing order, with fresh identities and seeds, only after its complete
candidate passes the loader and actual ZIP exporter.

**Rationale:** The lead follows the independently approved E design under the
owner's Sol High continuation and consolidated-publication instruction. Above
means source index plus one in the existing bottom-first scene order; UI-07
remains parked. The detached canonical copy keeps hidden state, dormant graphs,
all emitters, areas, shares, curves, precision and waypoint/image references.
Compact IDs avoid the project's existing identities and remap graph endpoints;
Emitter.reseed supplies fresh authoring-time seeds with its same-value fallback.
The bounded copy name avoids splitting a surrogate pair. Redo restores these
allocated values rather than generating another pattern.

One app-owned operation performs JSON/load and metadata checks, then awaits
successful real compressed ZIP generation with retained original background
bytes. Preparation alone cannot prove the completed 50 MiB limit. While checking,
no model, selection, history or save changes. A project/channel token plus scene,
source identity, authored revision, canonical model, asset values/references,
background, selection and undo owner checks reject obsolete completion. Pointer
transactions and unsubmitted Crowd number/seed drafts are refused before checking
and again before acceptance. Copied waypoint anchors resolve before the first
draw; original live layers remain intact. Accepted insertion selects the copy,
records one reversible change and autosaves once.

Layers and the outline expose native actions, visible loading and persistent
linked refusal reasons. Outline duplication alone owns asynchronous settlement;
its per-form/context feedback cannot erase or replace an unrelated form's newer
error, and ordinary commands retain their synchronous contract. Source replacement
invalidates old controls; obsolete project work cannot steal selection or focus.
Carbon native actions/tokens; Nielsen 1/3/4/5/9; WCAG AAA contrast, 44 px targets,
keyboard, focus and checked reversible submissions; and house app ownership,
persistence and behavioural tests apply. REV-03/REV-05 retain device and screen
reader assurance. The source PR owns regression, mutation, golden and browser
verification. This is a part advance, not whole-item closure or publication;
F and G precede the one combined release and record.

**Supersedes:** none

**Deferred:** none

## 2026-10-15 — CROWD-08 — Sol High implements D–G with consolidated publication

**Decision:** On the owner's word, GPT-6.1 Sol High implements the remaining
CROWD-08 parts, and their releases are consolidated while tests and independent
Astra Extra High reviews remain required.

**Rationale:** The owner, verbatim: “at a timely point, switch the route plotter
CRM task to Sol High and consolidate the releases to speed it up, while keeping
the tests and independent reviews.” This instruction was verified in his human
message in the coordinating chat and relayed with the implementing task's
model/effort override. The running Part D gate was preserved through its
successful exit: 158 files, 3770 passing tests and two existing todos, with
shell/build/check passing. The switch takes its checkpoint there.

The lead's concrete plan is independently reviewed source parts D, E, F and G,
merged in that order, followed by one combined deployment and one release-record
PR where feasible. This replaces GATELESS-1 condition 7's release after every
shipping merge for these remaining parts only. Earlier release evidence and
owner checks stand: v3.3.719's promise is not completion, v3.3.720 alone was
waived, and v3.3.721's saved-file question is still pending. No feature or
required verification is dropped. Fresh read-only reviewers remain
`gpt-6-astra` at `xhigh`, round after round until approval; the implementing
session never approves itself. Source tests, regression and browser/export
checks, exact-head CI and final integration verification remain required.
Focused checks run early; evidence is reused only while the code it checked
is unchanged. The final combined runtime receives the full gate and release
verification. The deadline and A–E priority remain PLAN-4's; changing F/G scope
still requires the owner's word. House conventions: record the authority and
its narrow replacement without rewriting historical decisions.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** none

## 2026-10-15 — CROWD-08 — Part D: relative Entry weights preserve equal choices

**Decision:** Explicit Entries gain relative weights through the Node card and
scene outline, while equal weights keep every dot's existing seeded choice.

**Rationale:** Under the approved Part D brief and the owner's easier-safe-MVP
preference, the lead chooses a strict optional finite number from 0.01 to
Number.MAX_VALUE, default 1 omitted from saved data. Type changes retain it;
implicit starts and Follow route ignore it. Max-scaled normalization avoids
overflow. Unequal choices reuse one cumulative distribution per guide and a
binary first-greater lookup; equal values retain the exact old floor
expression, including its floating-point boundaries. The same single hash
draw and hop feed all lifecycles, journey measurement and first-terminal
selection. Both journey and finish-geometry cache keys include ordered node
id/weight tuples. Nominal shares use the existing Path percentage rounding;
finite seeded crowds need not match those percentages, and the help says
very small weights may never be chosen. Stranded Entries remain in the pool.

One app-owned setter checks a detached canonical candidate against the whole
loader and asset-aware archive budgets before any live mutation or undo
flush. Both native surfaces preserve decimal precision, commit one reversible
edit and autosave, and clear corrected no-op errors without a new edit.
App-owned identity/state tokens preserve drafts on unrelated refreshes and
reject stale commands after replacement, Type changes or accepted edits from
the other surface. No component receives the app. Legacy absent/default node
JSON stays unchanged. The source PR owns regression, mutation, golden-trace,
committed-build browser and independent review evidence; publication belongs
to its REL record. Standards: carbon's existing native fieldset/number/output
pattern and tokens; nielsen 1, 3, 4 and 9 for visible shares, reversible edits,
consistent names and specific errors; wcag-2.2-aaa 2.5.5, 2.1.3, 2.4.12 and
3.3.6 for targets, keyboard, retained focus and checked submissions;
house-conventions' app ownership, additive persistence and behavioral tests.
Physical-device and screen-reader assurance remain REV-03/REV-05. This is a
part advance; CROWD-08 remains open for E–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-721 — v3.3.721 ships CROWD-08 Part C's finish areas

**Decision:** v3.3.721 ships CROWD-08 Part C's centred Exit finish areas, while the item remains in progress for D–G.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #144 merged as 722ba1d7deb7068aefce8ef7baa69187f108c479; final source head 353e40276d3bb565608850e6093a2d776c061f08 had independent gpt-6-astra xhigh approval in round 1 and successful pull_request Verify 38625793245. The existing Part C decision owns the geometry and interaction choices. Before publication, the area-storage correction PR #145 merged as c20be408fbbf69bce696f0c065fc0418b4e806dc; its final head b598a3707b47159a77a29b227148145cd17364f7 had independent xhigh approval in round 1 and successful pull_request Verify 38637633075. The separate area-budget decision owns the stopped prepublication attempt and the shared Start/Finish refusal fix. This release includes both reviewed changes. Deploy 2c2ae17c3c607d0f98f31d8058c50a46f7fbcefa: 154 test files, 3708 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors; push succeeded, main-branch Verify 38645187383 and Pages checks succeeded, github-pages deployment 7078404693 reached that exact SHA, and published SHA-256 comparison was match 22, mismatch 0, errors 0. Live readiness and Open day playback/export smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s, decoded frames at 1 and 2 s differ in 7525 sampled pixels; HTML 2,054,517 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The original live HTML export also played from start to end in a fresh tab, with moving pixels, a hidden error panel and no external resources; these headless checks do not substitute for the owner's saved-file check. Annotated tag v3.3.721 was pushed at the deploy SHA. These export/player changes independently require saving and opening MP4 and HTML from disk; that check is owed pending the owner's completion or an explicit waiver for this release. For the separate v3.3.719 check, the owner answered on 14 October, verbatim: “I’ll save and open both exports”. The lead records a promise, pending confirmation that both opened successfully; it is neither completion nor a waiver and does not cover v3.3.721. CROWD-08 continues with Part D after this release record; no phase or whole-item close is claimed. House conventions: publication evidence lives in this record, implementation choices in the existing Part C decision, and outstanding owner assurance remains open.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Area edits preserve a project that can be saved and reopened

**Decision:** Start and Finish area edits validate a detached canonical project against the loader and archive limits before changing the model or undo history, so an area cannot make a previously storable project exceed those limits.

**Rationale:** Part D's independent brief review found that a new Entry weight could cross whole-project budgets; the implementing lead then reproduced the same gap in the shared B/C area setter on main after PR #144. A canonical project accepted at 100,000 tree values became 100,005 after adding an Exit area, and the loader refused it. The v3.3.721 release was stopped before publication: its first local gate and dry run passed, but the publishing helper's second gate was interrupted; no deploy commit or version bump occurred and live v3.3.720 remained unchanged. This focused correction stays under CROWD-08 and precedes the renewed release cycle.

The existing app-owned setter now validates the proposed saved scene with the loader and the real ZIP metadata preparation, including referenced image manifests and the matching background filename. The check precedes pending-undo flushing and mutation. A refusal retains the model, selection, history and saved state; the card shows a linked, announced error, and the outline uses its existing form-error path. Rejected shape choices and numeric drafts remain unaccepted until validation succeeds; correcting an error to the unchanged stored value clears it without an edit. Both Entry and Exit use this owner. Packing, clocks and playback are unchanged. Standards: house conventions for one mutation owner, additive persistence and regression/mutation evidence; carbon native number/select fields; nielsen 3 and 9 for preserving work and actionable errors; wcag-2.2-aaa 3.3.6 and 2.1.3 for validated reversible submissions and keyboard correction. The source PR owns verification; publication evidence belongs to REL-721. CROWD-08 remains in progress for D–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Part C: arrival-ranked places in centred finish areas

**Decision:** Collect dots reaching an area Exit take reference-sized grid places in arrival order, using a derived reference clock so their places and finishing times survive changes of output.

**Rationale:** The lead adopts the independently approved Part C brief under GATELESS-1 condition 2 and the owner's easier-MVP preference; these are implementation calls, not new owner words. All emitters compete at each reached explicit Exit, ranked by unextended arrival, then emitter order and dot index. The largest size among all emitters sets a diameter-plus-quarter grid. A whole disc must fit: ellipses use their true inward parallel curve, including its cusp, rather than subtracting radii from axes. Stored-coordinate bounds filter centres without clamping them. Bounded integer intervals and a lazy merge materialise only the requested prefix; capacity is exact when counted, otherwise a truthful lower bound. Overflow repeats places and zero capacity collects at the node. The final straight walk suppresses walking variation. Terminal time wins over Exit, then Entry, using one seconds-to-milliseconds sum; the lead accepts the possible sideways step from the old network sway at the exact Exit, as in Part B.

Packing uses the persisted render reference, intrinsic image and authored background zoom. Without an image, Finish uses the reference rectangle while Start retains B's square plane; both surfaces explain the difference. An eligible dot's release uses reference-space route geometry, editor-canonical speed, pauses, reveal intro and positive Comet tail, or A's authored base without a route. Arbitrary saved constant-time route duration does not set that span; the hints state this and its possible difference from other dots and the visible route. Only Collect dots actually reaching an area Exit use this clock, including zero-capacity areas; mixed journeys keep per-dot clocks. The release span is never written into the legacy animation duration. Missing references migrate through timingReference, then 1920×1080, consistently in both hosts. DEF-78/79/80 remain open.

Fresh calculators on complete authored tuples isolate eligible route and network geometry from the legacy incomplete curvature key. Warm edits, cancellation and same-id reloads agree with cold results; legacy curvature goldens remain unchanged. The broader cache defect remains a wish line. Geometry and arrival allocations have separate caches with weak model ownership. App-owned context is installed coherently during load and rollback and frozen through path-only export suppression. Both authoring surfaces share one description and durable area setter, preserve drafts and refresh capacity after relevant edits. Standards: carbon native fields and More disclosure; nielsen 1, 3, 4 and 9 for truthful capacity, reversible edits and matching reasons; wcag-2.2-aaa 2.5.5, 2.1.3 and 2.4.12 for targets, keyboard and focus; house-conventions for ownership, additive persistence and regression tests. Physical-device and screen-reader assurance remain REV-03/REV-05. The source PR owns checks and review evidence; publication belongs to its release record. CROWD-08 remains open for D–G.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-720 — v3.3.720 ships CROWD-08 Part B's start areas

**Decision:** v3.3.720 ships CROWD-08 Part B's centred Entry start areas, while the item remains in progress for C–G.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #142 merged as 04be29e4700f69934bdf74cc2dffe2aa9cbb785a; final source head b66a7515e7e278a624ed36d60e9aac3d29d4b715 had independent gpt-6-astra xhigh approval in round 1 and successful pull_request Verify 38596381929. The existing Part B decision owns the geometry and interaction choices. Deploy baa3a4c1a4800679908798edb3b49b1f0d51c620: 148 test files, 3658 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors; push succeeded, main-branch Verify 38605180272 and Pages checks succeeded, github-pages deployment 7072193377 reached that exact SHA, and published SHA-256 comparison was match 22, mismatch 0, errors 0. Live readiness and Open day playback/export smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s; HTML 2,041,847 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The original live HTML export also played from start to end in a fresh tab, with moving pixels, a hidden error panel and no external resources; these headless checks do not substitute for the owner's saved-file check. Annotated tag v3.3.720 was pushed at the deploy SHA. This tenth build and its export/player changes independently require saving and opening MP4 and HTML from disk; that check is waived by the owner on 2026-10-14, verbatim: “Waive v3.3.720’s disk check”. For the separate v3.3.719 check, the owner answered on 14 October, verbatim: “I’ll save and open both exports”. The lead records a promise, pending confirmation that both opened successfully; it is neither completion nor a waiver and does not cover v3.3.720. CROWD-08 continues with Part C after this release record; no phase or whole-item close is claimed. An extra generic item-commit shape probe (`check.mjs --commit HEAD`) rejected the helper’s prescribed `chore: deploy` subject and absent Verify body; the normal ledger check passed. The lead treats this as a pre-existing convention/checker mismatch, recorded for reconciliation, without changing the generated commit; it is separate from the required release checks, which passed. House conventions: publication evidence lives in this record, implementation choices in the existing Part B decision, and outstanding owner assurance remains open.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — CROWD-08 — Part B: seeded starts inside centred node areas

**Decision:** Entry nodes gain rectangle or ellipse start areas, centred on the node and set by width, height and turn, so Disappear and Collect dots walk from seeded points to the unchanged network.

**Rationale:** The independently approved Part B brief applies the owner's centred-area MVP choice and gateless preference. The lead chooses image fractions 0.01–0.8 (default 0.1), clockwise degrees -180–180 (default 0), and intrinsic image-plane rotation; without an image the fixed square plane keeps playback independent of viewport size, with an explanatory hint. Rectangle draws are uniform and ellipse radius uses sqrt; a separate seed namespace preserves every old graph, onset and pace draw. At the outer stored-coordinate bounds, clipping the centre-to-point ray keeps samples inside both the shape and allowed box, intentionally sacrificing uniformity there. Shared journey totals include the approach; total terminal state wins over coincident onset/Entry boundaries. Walking variation is suppressed through the exact Entry instant, then resumes its old network value: the lead accepts the resulting sideways step as the easier MVP, pinned in adjacent-instant tests and Chromium. Respawn, Repeat journey, Follow route and non-Entry Types retain inactive data. Absent areas preserve old JSON and node event payloads. The app owns both card and outline edits through one validation/undo/autosave path, separate from the pen's older mutation exception; stable owner identity preserves drafts through unrelated sync and discards drafts superseded by an accepted outline edit. Image replacement refreshes timing only when its relevant intrinsic aspect changes; late-load rollback restores the old context. The Edit-only overlay uses shared geometry below guide edges. Standards: carbon's native select/number fields and single More disclosure; nielsen 1, 3, 4 and 9 for matching state, reversible edits and specific errors; wcag-2.2-aaa 2.5.5, 2.1.3 and 2.4.12 for 44 px controls, keyboard paths and retained focus; house-conventions' app ownership, additive persistence and regression tests. Physical-device and screen-reader evidence remain REV-03/REV-05. The source PR owns gate, mutant, golden-trace and browser evidence; publication belongs to its release record. CROWD-08 remains open for C–G under the owner's continuation instruction recorded by REL-719.

**Supersedes:** none

**Deferred:** none

## 2026-10-14 — REL-719 — v3.3.719 ships CROWD-08 Part A; Codex takes over implementation

**Decision:** v3.3.719 ships CROWD-08 Part A, closing DEF-84, and Codex takes over implementation under the run's grant while a separate read-only Codex reviews each CROWD-08 PR at xhigh until approval.

**Rationale:** Released under GATELESS-1 and PLAN-4 after PR #139 merged as 5e03a4caeea87a707270f922ed10d6bc23c2aa96, with final PR head 681aef1417f003add144735bbd6cfe1e2b88c391, independent gpt-6-astra xhigh approval in round 3, and successful pull_request Verify 38564372857. Deploy 457ead0c82e0c0466d514c19a029e9e3488812f0: 142 test files, 3579 passing tests and 2 existing todos; shell/build/check passed, zero unhandled errors, push succeeded, main-branch Verify 38573554808 and Pages deploy succeeded, github-pages deployment 7066952839 reached that exact SHA, published SHA-256 comparison match 22, mismatch 0, errors 0. Live readiness and Open day playback/MP4/HTML smoke passed after clearing localStorage, sessionStorage and IndexedDB: six-waypoint Open day played to 3002 ms, then the end in 1442 further frames with zero queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.033333 s; HTML 2,038,373 bytes with CSP, embedded project and exact live player; no unexpected console/JS errors or failed application resources. The first wrapper run flagged the pre-existing root-site favicon 404, documented before publication, in its raw resource list while already classifying it as known in the console list; the lead corrected that harness inconsistency using exact resource URLs and retaining the first evidence, then reran the full live smoke successfully with no failed resource entries or JavaScript errors. No production test or release code was changed for that correction. Annotated tag v3.3.719 pushed at the deploy SHA. The release changes export admission and the HTML player, so its MP4 and HTML saved-file check is owed pending the owner's completion or an explicit waiver for this release; v3.3.720 will independently owe the tenth-build check.

The owner's 14 October words, recorded verbatim by the handing-over lead: "I would like to handover development to codex, where I have 80% of usage left, as I need to use claude usage for other projects. can you write a handover prompt? it has directory access"; later "close out here, codex at large". The implementing lead initially read this as transferring the existing build, gate, commit, push, merge and release authority to Codex. At ~13:21 BST the owner directly instructed this Codex session: "when you have a moment, can you factor this in: Read and follow ~/route-plotter-bigrun/CODEX-MERGE-PROMPT.md". That prompt explicitly directs those steps through the reviewed REL-719 record and says, "After REL-719, carry on with part B as the handover prompt says." This confirms implementation authority and continuation for this session; every PR still receives the recorded independent review, and the implementing session never approves its own work. No numeric session budget is changed. The profile's Handoff line is updated to that division of work. This replaces only the implementing harness in GATELESS-1; the grant's other conditions and PLAN-4's CROWD-08 review bar stand. On "autojazz or run gateless as possible - mvp decisions err on the side of easiness", the lead's reading is to choose the easier safe MVP option under GATELESS-1 condition 2 and report that as its own call, asking only where a safe choice is unavailable; review and release conditions stand.

The owner chose "Keep the row (Recommended)" for Play's reason after seeing the 1280×800 shots; the lead keeps the row and corrects portrait fitting around its wrapped height. His area-placement answer was "as per your reccomendation, but the full feature in v4": MVP areas stay centred on the node, with width, height and turn only. Reading "full feature" as an off-node area dragged or offset is lead #12's proposal, now a wish line, not an owner decision. His "yes, but provide a prompt to start in fresh chat" authorized Part A's complete cycle. His "ok" acknowledged being asked at release about saved-file checks. The pause and resume were local to lead #13 and are finished.

GATELESS-1 condition 9: Part A already records lead #12's one-off 500k context and 98% stop. For lead #13 the owner picked "500k, as chat #12 (Recommended)" and "99%; agents after reset (Recommended)": 500k for that chat alone, no new agents past about 460k, weekly stop 99%, and Opus agents waiting until the 15 October 02:00 BST reset. These Claude-chat limits do not enlarge the Codex session's standing context budget.

Standards: house event ownership and regression/mutation checks; nielsen 1 and 9, Carbon helper text/disabled state, and WCAG 4.1.2/1.3.1. Chromium exposes Play's computed description; screen-reader speech remains REV-05's owner evidence. Required archival before the Part A close preserved all previous decision text verbatim.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** none

## 2026-10-14 — REFACTOR-01 — After CROWD-08, a refactor in light of PM-Skills 3.1 comes before v4's merge

**Decision:** On the owner's word, REFACTOR-01, a major refactor in light of PM-Skills 3.1's code-management frameworks, follows CROWD-08 and comes before MERGE-01, so that v4's merge of routes and crowds lands on more modular code. It replaces PLAN-4's "MERGE-01 first in Next"; the rest of PLAN-4 stands.

**Rationale:** The owner, 2026-10-14, after CROWD-08's part A was built, verbatim: "my intention is that we will get the MVP out, then do a major refactor in light of pm-skills 3.1 where various code management frameworks (e.g. for encapsulation, dead code, etc) are coming into play that should make dev work more manageable going forwards, then we will do the major work of consolidating paths and crowds and introducing new features where everything is more modular. so things like duration setting values can hopefully be fixed then."

The lead then asked: "shall I record it in part A's record as your stated sequence, with the refactor as an item in Next ahead of MERGE-01? Or leave the record alone until CROWD-08 ships?" He answered "leave until crowd 8 ships". Later the same day he asked: "is the following in the backlog? if not, add it in:", followed by the sequence above, from "my intention" to "more modular." That request supersedes his earlier answer.

It was not in the backlog: Next held MERGE-01 alone, first, under PLAN-4's heading. REFACTOR-01 is filed ahead of it, under one heading for both.

The filing session's readings, for the owner to confirm:
- the refactor changes no behaviour;
- its scope, the frameworks it applies, and their fit with the adopted abstraction plan of 2026-09-22 (whose W4 dead-code items are in Next) are for a plan he decides;
- "encapsulation, dead code, etc" are his examples, not a list.

CROWD-08, its parts and its deadline of 2026-10-20 are unchanged. The item file holds the proposed criteria (`project/items/REFACTOR-01.md`).

**Supersedes:** 2026-10-13 — PLAN-4 — A football crowd and mob MVP comes first; v4 merges routes and crowds

**Deferred:** REFACTOR-01
