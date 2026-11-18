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


## 2026-11-18 — GATE-01 — The gate sorts by what changed: a record-only change runs the record checker alone
**Decision:** CI and `npm run check:changed` sort each change by its paths: record-only runs `node tools/check.mjs` alone, frozen v3 its whole suite, anything unplaced or unreadable everything; v4's lane waits for STACK-01; `npm run check` still runs everything. Provisional under GATELESS-2: the record-only list and the Gate line's redraft await the owner. Because he chose "Gate by what changed (Recommended)" (Q23).
**Rationale:** The owner's words in force: "Gate by what changed (Recommended)" (Q23), "Alongside the plan (Recommended)" (P4), and from his task message "Propose a faster gate, and say whether a record-only change needs the app suite". It does not: nothing in v3's code, tests or build reads a record file, and the build never ships one.

Record-only paths, the list he was shown that night: `AGENTS.md`, `CLAUDE.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, `README.md`, `project/`, `verbs/`, `tools/`, `reviews/`, `pm_skills/`. Left out on purpose: `LICENSE` and `THIRD_PARTY_NOTICES.md` (the build ships them, `tests/governance.test.js` reads them), `.github/` (the same test reads `SECURITY.md` and `SUPPORT.md`; the workflow is the gate itself), `specs/` and `_Joe/` (they hold code), and every dot-file. A path on no list runs everything, so a missing entry costs time, never a check.

How it fails towards more (`scripts/gate.mjs`): a rename is read as a deletion and an addition; a push to a branch is read against `main`, not against the push before it, so a cancelled run hides nothing; a push to `main` is read from the last commit whose run on `main` passed (GitHub's API, read-only), and each run there has a concurrency group of its own, so a run replaced while it waited, cancelled or failed leaves its change in every later range; an empty or unreadable change runs everything. `scripts/gate.test.mjs` (32 tests, Node's own runner, no dependency) tests the rule, mixed pushes and that replaced-run sequence included, on scratch repositories, and guards the list: it fails if a v3 code, test or build file names a record path, if any file is a tracked symbolic link (a link could make a v3 file a record file), if a listed path does not exist, if `npm run check` stops running v3's suite and the checker, or if CI's lanes lose their conditions. Its tests run with every lane but the record's alone. No v3 file, test or dependency changed. Codex's first pass found the replaced-run hole and the link gap, its second a chained link; all are fixed.

Proof on real pushes: of the last 24 pushes to `main`, 11 sort as record-only (the table is in pull request #170).

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

## 2026-10-14 — CROWD-08 — Part A: crowds play and export without a route; DEF-84 closes by playing

**Decision:** With fewer than two route waypoints, a crowd the engine draws now plays and exports over a base timeline that starts at 10 s and that Duration sets from 1 s to 5 min, while with nothing to play Play and both exports stay off with the owner's reasons, so DEF-84 closes by playing.

**Rationale:** The owner's answers of 2026-10-13 ~22:15 BST to CROWD-08 lead chat #12's task-1 round, labels verbatim, each option's text as the lead wrote it. On PLAN-4's four readings, "All four stand (Recommended)": "specialised … at the expense of being generally useful" cuts features, not the quality standards; parts A to G, their order and supported combinations as CROWD-08 designs them; if the week runs short, each part ships as it lands, A to E first; CROWD-08 stays one backlog line. On DEF-84, "Play, as part A says (Recommended)": "Play, Space, J/K/L and both exports work for a crowd-only project, which a mob scene may need. Your 9 Oct choice still holds when there's nothing to play: Play stays disabled with a visible reason. DEF-84 closes by playing, and the record notes this replaces your 9 Oct pick for that case." His 2026-10-09 pick was "Disable Play with a visible reason (Recommended)". On wording, "…or draw a crowd's network (Recommended)": "Names what's actually missing. A new crowd with no route starts on an empty network, so "or a crowd" would still show after you'd added one." Its preview: Play "Add at least two route waypoints, or draw a crowd's network, to play."; Export MP4 and WebM "Export MP4 and WebM need at least two route waypoints, or a crowd's network."; Export HTML "Export HTML needs at least two route waypoints, or a crowd's network." and "Export HTML needs at least two route waypoints, or a crowd's network, and a background image."; unchanged where a route is still needed, "Add at least two route waypoints first." (Trace) and "Add at least two route waypoints before tracing the route into a crowd.". On Duration with no route (~22:25), "1 s to 5 min (Recommended)": "Enough for a match-day arrival or a mob crossing, with fine steps at the short end. 10 s sits just under halfway." The question had put the same slider setting the scene's length directly, today's direction, a log scale, the readout in seconds, a crowd-only project starting at 10 s, unchanged with a route. His 2026-10-11 suggestion to lead chat #10, "accept "at least two route waypoints" everywhere … your call on best approach", was adopted then by the lead (the lead's call, not his decision); it now applies only where a route is still required, the 2026-10-13 picks governing Play and the exports. The lead's settlements, as the lead's: a hidden crowd still makes the scene playable, as a hidden route does; a refused start (Space, K, J, L, a direct play) is said once through the announcer, no toast, and changes nothing, a pause never refused; the Guide card's sentence shows only while nothing can play, in the owner's export phrasing; with no route the Duration breakdown names the "timeline", and its hint reads "Sets the timeline the crowds release across. Dots keep their own speed. The time shown includes crowds still finishing and Hold at end"; "can release dots" is read as the engine's `evaluate` drawing a dot at some finite instant of the playback (`SwarmEngine.canRelease`, checked against `evaluate` over 360 generated networks). The no-route Duration is undoable, one entry per committed gesture, and autosaved; the route-mode Duration's missing undo is older and already a wish line ("The Duration slider records no undo entry at all", from CROWD-06). Codex checked the brief five times at xhigh; its folds are the brief's §9–§13. Digest rules applied: wcag-2.2-aaa 4.1.2 (name, role, state) and 1.3.1 (info and relationships) for the disabled Play described by its visible line; nielsen 1 (visibility of system status) and 9 (recognise, diagnose, recover: the reason names what to add); carbon's disabled state (the `--disabled-*` tokens, the reason at ordinary text contrast). A screen-reader check of Play's reason and the refusal's announcement (NVDA or VoiceOver) is owner evidence outstanding under REV-05. GATELESS-1 condition 9: on 2026-10-13 the owner let CROWD-08 lead chat #12 run to 500k tokens of context, stopping new agents at 98% weekly all-models use ("500k context, stop at 98% (Recommended)"); later chats keep the profile's 200k.

**Supersedes:** none

**Deferred:** none

## 2026-10-13 — REL-718 — After DEF-98 the next item is CROWD-08, not DEF-15

**Decision:** REL-718 named DEF-15 as the next item. It is CROWD-08, because PLAN-4, merged first, put its MVP heading ahead of Phase 2. REL-718's release facts stand.

**Rationale:**
- **What happened:** REL-718 was written before #135 (PLAN-4) landed. It was rebased onto `5ad50cb` to resolve conflicts, but its next-item sentence and its recall answer 4 were not re-read against PLAN-4's placement ("comes first in Current after DEF-98").
- **The backlog order:** the closed DEF-98 heading, then "MVP — football crowds and mobs — the owner's word of 2026-10-13" with CROWD-08, then Phase 2, where DEF-15 now waits behind CROWD-08.
- **Recall:** the recheck stored as 8/8 had answer 4 wrong, so it should have scored 1 (7/8). After this correction a local recheck answers 4 with CROWD-08 in the MVP heading (PLAN-4's placement), 8/8, stored as its own trajectory line.

**Supersedes:** none

**Deferred:** none

## 2026-10-13 — REL-718 — v3.2.718 ships DEF-98's recovery images; DEF-98 closes, and its heading with it

**Decision:** v3.2.718 is live from deploy `9864efc` (tag `v3.2.718`), released on the owner's word for DEF-98's merge (`e8c361c`, PR #133). DEF-98 closes with its heading, and Phase 2 resumes at DEF-15. The player changed only by minifier renames, so its disk save is waived.

**Rationale:**
- **Release** (`release.sh`): rollback tag `rollback-v3.2.717-e8c361c`; gate green (137 files, 3,484 tests, 2 todo); dry run, then push; deploy `9864efc`; report-build-status, deploy, test-and-build and build all succeeded; Pages built `9864efc`; all 22 live files SHA-256-identical.
- **Live smoke** (the lead's observation in the pane, 2026-10-13 ~18:37 BST, storage and the image store cleared):
  - the Open day route loads 6 waypoints, plays to 3,002 ms of 26,763 ms, then to its end in 1,426 frames with none queued;
  - MP4 9,910,489 bytes, ftypisom, 1920×1080, 28.8 s;
  - HTML 2,037,331 bytes, with the project, its CSP and the live `player.js` embedded;
  - no non-200 resource.
- **DEF-98 on the live site** (the lead's observation): before storage was cleared, the pane held a recovery record in v3.2.717's format, left by earlier smokes. v3.2.718 restored its 6 waypoints and offered "Background not restored: recovery before this release kept no images. Choose the image this route was made on." with Choose image and Dismiss.
- **The player:** `docs/player.js` differs from v3.2.717's only by the minifier's renames. It has the same length, 435,031 bytes, though the raw bytes differ, and it is the same text once every one- and two-character identifier is masked (`perl -pe 's/\b[A-Za-z_\$][A-Za-z0-9_\$]?\b/X/g'`, both SHA-1 `d5b5ac7a5009…`). Masked equality shows the renames are all that changed; it is not, on its own, a proof of identical behaviour. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk. Asked, the owner waived it for this release only: "Waive this one (Recommended)".
- **What DEF-98 delivers:**
  - Recovery keeps the background, bundled or uploaded, custom markers and the custom path head, each with its file name, size and custom style.
  - Images live in IndexedDB, keyed by SHA-256, and the record carries a version-2 manifest.
  - Each tab holds a shared Web Lock per image it shows, saves or reads, and a deletion needs that image's lock exclusively. Without Web Locks nothing is deleted.
  - A toast names any image not kept, and why. A background that cannot come back is offered by name in the banner slot, never replaced.
  - Clear All removes the images only once nothing needs them, and says so only then.
  - `coordVersion`, the project file format and the player's behaviour are unchanged. No package was added.
- **The owner's words on the PR**, 2026-10-13 (labels verbatim):
  - "Merge and release (Recommended)", whose option text was: "I squash-merge #133 and release v3.2.718 with the usual release script from your OneDrive copy, after checking no other chat is busy. Then I run the live smoke test and file the release record that closes DEF-98."
  - On its six open questions, "Keep all six (Recommended)": (1) the keeping order, background, then the path head, then the markers; (2) no background name in Save Project yet; (3) Choose image keeps the prompt until a background is set; (4) Dismiss is final; (5) the warning toasts stay until dismissed; (6) a browser that cannot store images warns as built.
  - The filing's other readings stand as proposals, tracked by a wish line. "Markers in waypoint order" is the implementation's detail; his option said "then markers".
- **Before releasing** (the lead's observation): two other chats were busy, but neither was in `route-plotter/`. One worked in the PM-Skills Lab folder; the other had just gone idle.
- **The pull request's own record:** five lead rounds (`ab4592a` → `b797a79`). Codex reviewed the brief twice and the code four times (r1: 1 blocking and 7 real; r2: 1 blocking and 3 real; r3: 1 real; r4: approve). The lead checked it in Chromium: real IndexedDB and Web Locks, two tabs, Clear All across tabs.
- **Recall, local** (verbs/recall.md). The lead first scored it 8/8; Codex r1 on the record found answer 3 partial, so the original result is 7/8 (2,2,1,2). After the repair below, a local recheck is 8/8, stored as its own trajectory line:
  1. The last four shipped: DEF-98, DEF-89, DEF-86, DEF-96 (`project/trajectory.md`).
  2. One decision of this heading: DEF-98's, that recovery keeps every image, because a restored session came back with dots on a blank canvas.
  3. What is deferred: the original answer, "every Deferred line below is none", missed the backlog's deferred items (score 1). The repaired answer: EX-01, DEF-78, DEF-79 and DEF-80 (from CROWD-05), DEF-84, 85, 87, 88, 90, 92, 93, 95 and 97 (from CROWD-07), each a `— (from: …)` line in `project/backlog.md`, and the open ideas in `project/wish-list.md`. DEF-98's remaining readings are a new wish line there.
  4. The next item: DEF-15, in Phase 2 (the DEF-98 decision's placement, "before DEF-15").

**Supersedes:** none

**Deferred:** none
## 2026-10-13 — PLAN-4 — A football crowd and mob MVP comes first; v4 merges routes and crowds

**Decision:** On the owner's word, CROWD-08, a football crowd and mob MVP specialised for his client's task, comes first in Current after DEF-98, due by 2026-10-20 and released as v3.3; the run builds it, Codex reviewing at its highest setting until it approves. Once it ships, the bulk of the work goes to v4, which merges routes and crowds (MERGE-01).

**Rationale:** The owner, 2026-10-13, in a read-only analysis session, asked how crowds would show "a mob moving from one area to another" and "attendees of a football match arriving by various routes … then converging on an area (probably one for each of the four sides of the stadium)". He then asked for "the ability to define areas, not just paths". Next: "the top features I need for my client are football crowd; and mob moving from market square, down a road, and to another open space. I also want to be able to have trains / buses / cars on transit routes, as decoration (so running in parralel to other things going on). is there a case to merge routes and crowds with extra settings and features that are selectable … having routes and crowds separately does confuse things a little from a user point of view. one thing with options might feel more cognitively coherent... but maybe I'm misjudging. what do you think?" After the session advised converging in steps: "but crowd paths should be able to act as the camera. what are the pros and cons of unifying the system vs keep seperate?" Then the decision: "I want the next major version to be a merge. but for now, we do MVP for football crowds and mobs - app development can be specialised towards this for next minor versions at the expense of being generally useful so the client can complete their upcoming task. But the bulk of development work will go into the next major version as soon as mvp football crowd and mob have shipped".

The session then put six questions to him in two rounds; his picks, labels verbatim:
- On "When does your client need the football crowd and mob features working?", "Within a week", whose option text read "Cut the MVP to the essentials: items 1–5, groups simplified, presets later." Items 1–5 were crowds without a route, start areas, finish areas, entry shares and duplicating a crowd.
- On extras, "Final whistle", unpicked: "Camera follows a crowd", "Vehicles as decoration" and "Milling in areas".
- On recording, "I write a plan PR (Recommended)".
- On a session filing transit presets at the same time, "distant wish list, ignore". That session's wish line, transit presets by mode and era, was PR #134.
- On areas, "Simple shapes (Recommended)": "An Entry or Exit node gets an area: rectangle or ellipse, set by width, height and turn, drawn on the map."
- On review depth for the MVP's pull requests, in his own words: "max codex, got loads of compute".

After Codex approved the draft, the session asked him four more questions; his answers, verbatim:
- On "The run's standing grant says "no new feature work" and one Codex review at 'high'. For CROWD-08 only, do you confirm these changes?", "Confirm both (Recommended)", whose option text read "The run may build the MVP. Its PRs get Codex at xhigh, round after round until it approves. Everything else in the grant stays as it is."
- On "Do these readings stand: deadline 2026-10-20, released as v3.3, placed after DEF-98 and ahead of Phase 2 (Phase 2 and 3 wait), and MERGE-01 first in Next once the MVP ships?", "All stand (Recommended)".
- On how PR #134 and this record should land, "you take charge and resolve". The session merged #134 as it stood, its CI green, as `d0382c8`, so the transit line sits in `main` once, beside this record's lines.
- On pushing this record and opening its pull request, "Yes, push and open it".

Confirmed by the owner, then:
- the deadline, by 2026-10-20, his "Within a week";
- his word lifting GATELESS-1's "no new feature work" (its condition 2) for CROWD-08 alone, so the run builds it under the grant's other conditions;
- "max codex, got loads of compute" changing GATELESS-1's condition 5 for CROWD-08's pull requests: Codex at its highest reasoning setting, `xhigh` in place of `high`, and rounds until it approves in place of one review and a short pass on a large fix;
- those two replacing GATELESS-1's conditions 2 and 5 for CROWD-08's pull requests alone, hence the Supersedes line; every other condition, and both conditions for all other work, stand;
- v3.3, with `package.json` set to 3.3.0 by CROWD-08's first release;
- CROWD-08 under a heading of its own after DEF-98 (#133, deployed as v3.2.718) and ahead of Phase 2, whose items and Phase 3's wait;
- MERGE-01 first in Next once CROWD-08 ships.

The filing session's readings and proposals still for him to confirm:
- "specialised … at the expense of being generally useful" as cutting breadth, not the quality bars: the brief's mandate, loadable saves, exports and the player, the outline and the profile's standards, tests, and no new dependency.
- The parts' design within his picks, A to G, with the supported combinations in the item file; "groups simplified" as a size and a width only, and "Final whistle" as part G. If the week runs short, the parts done ship first, A to E (the football scene) leading, and the run asks him about F and G.
- DEF-84 closed by playing, since its criteria left disabling or playing to the run.
- One backlog line with seven parts in its item file, since the backlog had 930 of its 1,000 words.

The analysis ran on a scratch clone of main at `86ad88a`. A probe of `SwarmEngine` on a match-day network (four entries, a two-way ring road, four stand Exits, 2,000 dots set to Collect) found:
- each entry sending about a quarter of the dots (482, 509, 510, 499), since entries are picked evenly (`src/services/SwarmEngine.js` (:868));
- station and town fans splitting alike once their streets met, since a junction's choice reads only path weights;
- journeys from 1.3 s to 12.7 s, median 2.7 s, as dots lapped the ring;
- the 2,000 collected dots on 4 points (CROWD-07's X-16).

`play()` returns without a route (`src/app/playback.js` (:288); DEF-84). Both exports refuse fewer than two waypoints (`src/app/exporting.js` (:213), (:421)), and Clear All leaves a zero base timeline (`src/app/projectReset.js` (:76)).

The session advised against merging the models in v3: the route sets the base timeline and carries the camera, labels, beacons and pauses, and a merged object would need a mode switch the abstraction plan's §16 rejects. It proposed converging in steps instead. After the owner's point that crowd paths should be able to carry the camera, it set out both sides; MERGE-01's item file keeps them, with the session's catalogue of movement types as candidate features. That catalogue is a page private to the owner (<https://claude.ai/artifact/Dn8NTvrNok2HMufMtPfsE8>); the item file carries its content.

v4 departs from the founding decision of 2026-08-17 (the frozen canon log; `project/history.md`) and from the brief's Direction. Direction also names the big run as the current work. The brief is the owner's to sign, so it is left unedited: this entry governs where they differ, as GATELESS-1 did, and MERGE-01's plan brings the amendment. The criteria are in the item files (`project/items/CROWD-08.md`, `project/items/MERGE-01.md`); ready-made presets are a wish line.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** MERGE-01

## 2026-10-13 — DEF-98 — Browser recovery is to keep every image, warning when one is not; filed first in Current

**Decision:** On the owner's word, DEF-98 is filed first in Current, to be done as soon as possible: browser recovery is to keep every image, within feasible limits, with its file name, and to warn on screen, naming the file and why, when one is not kept. This supersedes the model-only boundary for images.

**Rationale:** The owner, 2026-10-13, asked: "why does the app load up without a background image? should this potentially be ammended? it's confusing when you have auto-resume with dots but no background, and it makes no sense to select a background other than the one the dots are designed for, so it's a confusing user experience. would it be ok to to immediate backlog?" The cause: recovery's snapshot keeps the route model and clears every image field it knows, bytes and file names alike (`src/app/persistence.js` (:636–668); the wish list's known exception aside), and custom markers and path heads fall back to built-ins (:613–634). Start-up loads the default map only when nothing was restored (`src/app/startup.js` (:14)). The only notice goes to the screen-reader announcer, once per project opened, restored or cleared. Backgrounds the app ships, which carry no privacy cost, are dropped along with uploaded ones. The filing session confirmed it in Chromium on live v3.2.717: the Open day example's route and crowd came back on a white canvas. Asked three questions, the owner picked (labels verbatim). On what the fix covers, he picked "Also keep uploads", whose option text read "Store uploaded backgrounds in the browser too, so everything comes back. This reverses August's privacy rule, and large images may not fit."; the other options were "Built-in + banner (Recommended)" (shipped backgrounds reload, an uploaded one prompts to choose it again, the August rule kept) and "Built-in maps only". On placement, he picked "Top of Current (Recommended)" ("A new 'the owner's word of 2026-10-13' heading ahead of everything, so the run's next pick is DEF-98, before DEF-15."). On timing, he picked "Yes, file it now". The session then put three readings to him, and he answered each, verbatim. On "'Uploads' means uploaded backgrounds only. Custom marker and path-head images still drop on restore.", he said "lets keep everything, within feasible limits, and prove a warning if not happening". On "The on-screen 'choose it again' prompt for a background that can't be restored.", he said "ok, with an indication of file name and why not stored". On "Priority P2.", he said "lets get it done asap". The filing session's readings of those answers, for the owner to confirm: "prove" as "provide"; "everything" as every image the live project references, with its file name, and not images found only in undo history (DEF-23's rule for exports); the feasible limits as no larger than a project file's; a custom marker or path head that is not kept falling back as it does today; the background kept first when the images do not all fit; and "asap" as P1, the item already being first in Current. What the August rule avoided: an uploaded image and its file name now stay in that browser's storage until Clear All, which matters on a shared computer; the option he chose said it reverses that rule. Size: the recovery record is capped at 4 MiB (`src/services/StorageService.js` (:7)), while a background may be 16 MiB (`src/models/ImageAsset.js` (:6)) and a project's custom images 40 MiB in all (`src/services/ImageAssetService.js` (:28)). So not every supported image fits in today's record, whose text grows by a third in base64. Where the bytes are kept is the fix's to decide, within the two-dependency rule. The brief's boundary line (`project/brief.md` (:97–98)) and README's stay as they are until DEF-98 ships and updates them. It replaces, in the canon entry titled "2026-08-26 — REV-10 uses minimum-loss transactional image admission" (frozen; `project/history.md` → Decision lookup), its persistence boundary, "Autosave remains deliberately model-only", for images, from DEF-98's release; its transaction, history and Clear All guarantees stand. Supersedes names only this ledger's headings, which the checker enforces, so the canon entry is named here, as GATELESS-1 named its canon predecessor. The item file holds the criteria (`project/items/DEF-98.md`).

**Supersedes:** none

**Deferred:** none

## 2026-10-12 — REL-717 — v3.2.717 ships UI-06's banner slot PR

**Decision:** v3.2.717 is live from deploy commit `8f0d2be` (tag `v3.2.717`), released under GATELESS-1 because UI-06's banner slot merge (`f6b062c`, PR #130) changed `index.html`, `styles/` and `src/`; UI-06's J-12 and J-05's remainder and CROWD-07's X-02 are made; `docs/player.js` changed, so a disk save is waived.

**Rationale:** release.sh: rollback tag `rollback-v3.2.716-f6b062c`, gate green (135 files, 3,417 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.717 (pane, 2026-10-12 ~22:03 BST, storage cleared, first-start welcome dismissed by the script, 1280×800): Open day route loads 6 waypoints; plays to 3,002 ms of 27,028 ms, then to its end in 1,442 frames with 0 queued; MP4 9,819,817 bytes, ftypisom, 1920×1080, 29.03 s; HTML 2,037,312 bytes with the project, its CSP and the live player.js embedded; no non-200 resource; two downloads captured (route-animation-2026-10-12T21-02-43.mp4, route-animation.html). The duration, frames and MP4 differ from v3.2.716 (27,283 ms; 1,457; 9,664,123 bytes, 29.3 s) because opening a project now fits the canvas to its own 16:9 export size (PR 6), where it kept the default image's 1.41 fit until a resize; the HTML is 1,352 bytes larger, the player bundle it embeds having grown 1,362 bytes (433,669 → 435,031: the viewport mixin's refit, bundled and not called). The PR, the run's PR 6, changed no player code (`src/player/`, `src/services/HTMLExportService.js` and `docs/` are unchanged in `f6b062c^..f6b062c`; `src/app/exporting.js`, the editor's side of an export, now drops a refit's path rebuild as a video export starts and clears the held refit as it ends, (:121), (:164)), but `docs/player.js` changed between the deploys `6ee24fc` and `8f0d2be` (433,669 → 435,031 bytes) in one module it bundles: of the PR's 19 `src/` files, only `src/app/viewport.js` is among the 46 modules `src/player/playerEntry.js` reaches, and its refit's refactor (`canvasAreaOf` and `canvasAreaRoom`, (:19), (:29); `_fittedRoom`, (:56); `_canvasFit` and `_restoreCanvasFit`, (:145), (:167)) comes with the mixin, since `PlayerApp` borrows four of its other functions (`src/player/PlayerApp.js` (:462–465)) and never calls `updateCanvasAspectRatio`; the rest is the minifier's renames, so the change is inert in the player. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk and opened there, so v3.2.717's disk save is waived, for that release only: the owner, 2026-10-12, "Waive this one (Recommended)" (his pick when asked, ~22:08 BST), the bundled refit never called in the player. The design review of 2026-10-08 found each mode's banner over the header (the area draw's and Edit network's inline-styled, the branch gesture's a toast), so the mode switch, Undo, File and Export were covered while a mode was on (UI-06 J-12, CROWD-07 X-02's banner half, and the wish list's line asking for one shared ModeBanner); toasts at the top over the header, painting over a dialog's backdrop; the Preview badge a pseudo-element nothing could pin; and Edit network's entry said twice; and PR 4 had left the scope chip, the empty-list row and the two banners live beside the announcer for PR 6 (J-05's remainder; its merge body, `48d3864`). J-12: one slot, `#mode-banner`, has a grid row of its own between the header and the main area (`src/components/ModeBanner.js`, new): empty it takes no room; a mode shows one line of 3 rem there (two where the width wraps it), easing over 150 ms and not under reduced motion; the header never moves and nothing covers it. One banner at a time: a mode claims the slot before it becomes active, and a second claim runs the holder's own exit, its Escape's path, first, so a replacement never leaves two modes on, nor revives one that has left; a claim made while another is being replaced is refused before its owner activates. Each banner takes its owner's scope colour, as the scope chip does: route modes and the first-start tip in UoN blue, network editing in the crowd's green. The branch gesture's banner, "Branch from Main entrance — click where it should go. Esc to cancel.", has a Cancel; the gesture ends when its fork leaves the model or any restore runs, focus then placed after the list has rebuilt (the element focused at arm, else the fork's row, else the Route button). The first-start tip waits for the welcome to close and for a mode to leave the slot; a mode replaces a tip, which does not come back. When the slot's height settles the canvas is refitted as a resize refits it, once, at the final height, held while playing and left to an export's own exit. Toasts stand bottom-centre, under a dialog, never over the header, wholly above or below the transport's controls and never over them, capped to the room in the viewport where neither fits, the stack's own scrolling kept. The Preview badge is a real element at the canvas's own top-right corner, shown in Preview and hidden in Edit. A focused banner action keeps a 4 px ring under hover too. J-05's remainder: the scope chip and the empty-list row are not live, nor the banners or the slot; entering each mode is said once, by its owner, the network's duplicate gone; each region's line is said once through the one announcer, a later line in the same operation replacing the first, and a line the operation's own message already covers not said again. X-02's banner half: Edit network's banner is the slot's, so X-02 is whole (its select half in REL-716). Found by the lead on live v3.2.716 and fixed in the PR, not a DEF row: opening a project kept the previous image's canvas fit until a resize (Open day at 1600×640 kept the default image's 697×493, 1.41, until a window resize made it 806×453), so the first banner's refit would have changed it; applying a project now fits the canvas to its own export size (`src/app/persistence.js` (:1090)), its geometry restored if the load fails, an export's identity transform included. Two CI-only races, test-only and older than the PR, were fixed in it: the camera domain goldens' setup frame count (round 5) and the event transcript's boot scene-end timer (round 6). The owner's picks and words: on 2026-10-08, "One slot below the header (Recommended)", to the option that read "One banner slot below the header (the shared ModeBanner of wish-list 22), toasts bottom-centre, the Preview badge top-right of the canvas *(recommended)*", which settled the toasts' and the badge's places with the slot; on 2026-10-10 (~23:55), to his audit, "Proceed as per your recommendations" (its §E.5, outside the repository), which ratified the lead's settled policy for the slot (one line of 3 rem, two where it wraps, the canvas shrinking by the slot's height, a replacement ending the running mode, a 150 ms ease); on 2026-10-11 (~22:30), "PR 6: accept all four proposals as written.": (a) the first-start tip in the slot once the welcome closes, (b) the moved toast container's `z-index` below the modal's 999, (c) the branch Cancel's keyboard focus fallback, the element focused at arm, else the fork's row, (d) the branch banner keeping the Escape hint; and on 2026-10-12 (~11:15 BST), asked what colour each mode's banner should be, "Scope colours, as built (Recommended)" (the option's text: "Each banner takes the colour of the scope it belongs to, as the header's scope chip already does. Route modes (area drawing, the branch gesture) and the first-start tip use UoN blue; network editing keeps its crowd green."). The lead's settlements, from the rules and the four proposals as accepted (folded into the brief from Codex's check of `9466a3f` and its recheck): a mode claims the slot before it activates, the replacement complete first; the gesture ends when its fork goes, and any Undo, Redo, Open or Clear All cancels an armed gesture, its focus placed after the list's rebuild; a tip never replaces a mode but waits, and a tip a mode replaced stays seen and does not come back; the Route button as the last focus step; toasts clear of the transport; a refit skipped while actively playing is held and run once on a pause, completion or reset, an export's exit standing for it; in round 2, the refit at the slot's final height, compared with the room last fitted, and at narrow widths toasts that stay in view and a badge on the canvas's own corner; the badge keyed to the preview state (Codex r1); the banners' words their own, "Esc" written and "Escape" said; the route's duration following the canvas a banner leaves, as a resize does (Codex r1: settled by the policy); in round 3, the opened project's canvas fitted to its export size. The agents' calls the lead kept, Codex agreeing where it was asked: a region's later line in an operation replaces its first; with no room above or below the transport's controls the toast stack is capped to 0, heard but not seen; the cap takes the larger room, below on a tie; a project with no visual reference of its own adopts the canvas it is fitted to as it opens (Codex r3: can stay); a stack first capped by a scroll keeps its scroll (Codex r4: keep); a failed load leaves superseded refit work dropped (Codex r4: no change needed); the domain goldens opened at rest, not after a fixed frame count (Codex r5: keep rest); no per-row guard in the transcripts (Codex r6: the audit suffices). Round 2 (`753f93f`) took Codex r1's blocking and six real findings (no path rebuild inside an export or while playing; the badge shown; no holder overwritten without its exit; a region's line unsaid only where its change's own message says it; focus stopping the chip's line only on the control that names it; the action's ring under the pointer; nothing said after teardown) and its advisories; round 3 (`bc2d3a4`) r2's six (the late end's refit kept after an early fallback; toasts over none of the transport's controls at narrow widths, capped; a region's line covered by the operation that changes it; a scope change named by focus cancelling the chip's waiting line; a 4 px ring for WCAG 2.4.13's area; a claim past the bound refused before its owner is active) and its advisory, with the leg's "+" covering its chip line (Codex r2, on the report's question); round 4 (`1298e2b`) r3's blocking and three real (a failed load during an export leaves the export's canvas and transform alone; a claim its replacements suspend is checked again before it draws; a capped stack keeps the author's scrolling; an oversized stack is capped with the controls out of view) and its advisory, opening a project superseding refit work held or due; round 5 (`1cb8514`, test-only): CI's runner drew one camera frame fewer while a project opened (the centre eases 8% a frame), failing `tests/cameraDomain.test.js` on `bc2d3a4` and `1298e2b`, so the domain goldens open their project on frames run by hand to rest; round 6 (`6f30c69`, test-only): the event transcript's setup settles the scene end an empty route's opening queues on a real 50 ms timer before its fake clock starts (a race older than PR 6, from TST-05, that CI's runner lost on `e83cd7d`, dropping two rows). Codex: the brief on `9466a3f`, 3 blocking, folded as the lead's settlements, and its recheck, 3 real, folded; r1 on `7a74755`: 1 blocking, 6 real, 4 advisories, taken in `753f93f`; r2 on `753f93f`: 6 real, 1 advisory, taken in `bc2d3a4`; r3 on `bc2d3a4`: 1 blocking, 3 real, 1 advisory, taken in `1298e2b`; r4 on `1298e2b`, r5 on `1cb8514` and r6 on `6f30c69`: approve (the Checked line of `f6b062c`); each round's brief checked before it ran, rounds 5's and 6's diagnoses corrected by that check (per-frame easing, not wall-clock time; the scene-end timer, not the duration debounce); the golden churn, the reference change, the five adapted tests and the CI causes each verified by reproduction. CI test-and-build green on `7a74755` (run 38233600692); failed on `bc2d3a4` (run 38283095471) and on `1298e2b` (run 38288517712), `tests/cameraDomain.test.js` "linear.seek", fixed in `1cb8514`; failed on `e83cd7d` (run 38294027421), `tests/eventTranscript.test.js` "waypoint:add, the first waypoint of an empty route", fixed in `6f30c69`; green on `6f30c69` (run 38300376659, 20m07s, completed 21:11 BST; the cancelled run beside it, 38300377691, is the duplicate push run). Tests: 169 added across the six rounds (67, 46, 38, 16, 1 and 1), 3,248 to 3,417, none deleted, skipped or weakened, each changed expectation with its reason; 87 mutants (30, 26, 20, 9, 1 and 1), each killed but m41, a deliberately redundant `:hover:focus-visible` selector whose fix m41b kills; goldens 0 untraced (round 1, 464 control lines in 22 goldens, 2 new contexts and 103 event lines; round 2, 146 control and 118 event lines; round 3, 3,879 lines in 35 files, all but two from a project opening on its own export size, which Codex reproduced on round 2's runtime with that change alone; round 4 none; round 5, 9 lines of `domains-camera.json`; round 6, 2 lines of `event-transcript-wiring-controllers.txt`). The lead's pane pairs (1280×800, before on live v3.2.716) are in `reviews/design-review-2026-10-08-shots/after/` named `pr6-*` (`e83cd7d`, images only). No DEF row closes. The wish list's ModeBanner line retires, and six follow-ups the PR's rounds found are added, the lead's proposals, the owner told. Not in the PR: UI-06's J-06, J-07, J-09, J-10, J-11, J-14, J-15, J-22 and W-06 (UI-07 and W4, as REL-715 split them) and CROWD-07's F7, X-10, X-12, X-16 and F13 (UI-07), X-13 (W4) and DEF-92 (its own brief), as REL-716 split them; UI-06 and CROWD-07 stay open for them. UI-07 is ready, PRs 5a, 5b, 6 and 7 merged and its prompt repaired (outside the repository), and the owner runs it.

**Supersedes:** none

**Deferred:** none

## 2026-10-12 — REL-716 — v3.2.716 ships CROWD-07's crowd cards PR 5b; DEF-86 and DEF-89 close; DEF-97 filed

**Decision:** v3.2.716 is live from deploy commit `6ee24fc` (tag `v3.2.716`), released under GATELESS-1 because CROWD-07's second crowd cards merge (`9466a3f`, PR #128, the run's PR 5b) changed `index.html`, `styles/` and `src/`; CROWD-07's rows X-02 (its select half), X-04, X-05, X-06, X-09, F5, F15 and F16 are made with it, and DEF-86 and DEF-89 close, since a stored value past a crowd slider's reach is no longer rewritten and the Guide card is true after a trace. The owed disk save is made; `docs/player.js` changed, so a disk save of v3.2.716 is waived.

**Rationale:** release.sh: rollback tag `rollback-v3.2.715-9466a3f`, gate green (134 files, 3,248 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.716 (pane, 2026-10-12 ~10:00 BST, storage cleared, first-start welcome dismissed by the script, 1280×800): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, ftypisom, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live player.js embedded; no non-200 resource; two downloads captured (route-animation-2026-10-12T09-00-27.mp4, route-animation.html). The PR changed no export code (`src/app/exporting.js`, `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `9466a3f^..9466a3f`), but `docs/player.js` changed between the deploys `f211c7c` and `6ee24fc` in one fragment of the shared modules it bundles, the build differing from the deployed bundle only by that block and the minifier's renames: RenderingService's `network-guide` layer now draws after the path (X-04, `src/services/RenderingService.js` (:1347)); in the player it returns at once, since `PlayerApp` sets `networkEditService` to null (`src/player/PlayerApp.js` (:99), (:381)), so exported frames are unchanged; `src/utils/uiReadouts.js`, which the player also bundles (through `src/app/pathTiming.js`), brings only functions no player module calls. By the owner's export rule (GATELESS-1), a release that changes `player.js` has its exports saved to disk and opened there, so v3.2.716's disk save is waived, for that release only: the owner, 2026-10-12, "Waive this one (Recommended)" (his pick when asked, ~10:02 BST), the moved layer drawing nothing in the player. The one disk save owed since REL-712 is made: its HTML half on 2026-10-11 at 15:34 BST (REL-715), and its MP4 half the same evening, when the owner saved the Open day example's MP4 export from the live site, v3.2.715, through his Chrome at 22:18 BST (route-animation-2026-10-11T21-18-33.mp4, its name's stamp UTC) and opened it from disk; his words, 2026-10-11 ~22:30 BST: "MP4: done — <filename>, opened from disk, plays. HTML (2) opened from disk too." (the "<filename>" as he wrote it), and, late that evening (~23:40 BST), "mp4 is route-animation-2026-10-11T21-18-33.mp4". So the HTML was opened from disk too, and the wish line for the MP4 half retires, settling v3.2.710's debt and any v3.2.712 owed (the owner, 2026-10-09: "One save covers both"; REL-712). The crowd review of 2026-10-08 found Custom network a mode, not a setting (X-02, WCAG 3.2.5), the Guide helper stale after a trace (X-03, DEF-89), a traced network invisible under the path (X-04), traced nodes named by their type (X-05), Guide and Motion collapsed on a new crowd (X-09), the card sliders narrower than the model and rewriting a stored value on the first nudge (F5, DEF-86), Share's slider 48 CSS px wide (X-06), the seed read-only (F16) and the outline's Release bias a signed number (F15). X-02: choosing Custom network refreshes the Guide card and leaves the header alone, Edit network being the request, and + Add crowd with no route no longer enters the mode, saying "Crowd 1 added — press Edit network to draw the network its dots will follow"; the empty network's helper reads "No network yet — press Edit network to draw one, or Trace route into network."; the banner half stays for PR 6. DEF-89: a trace refreshes the Guide card at once. X-04: a selected crowd's network is drawn between the path and its head, each path over an opaque `--ui-background` casing a reference px wider each side; preview, export and the player draw no guide. X-05: the Node card's header names the node ("Node · Main entrance · entry", "Node 3 · entry" with no name), and in Edit network each named node is labelled beside its glyph, 14 reference px, cased, but for a traced node under a waypoint whose label is set to show, so each place is named once. X-09: all four crowd cards start open, a stored layout still winning. F5 and DEF-86: a number field beside each crowd slider and the Path card's Share holds the stored value as it is, to the model's whole range, Count to the scene's 20,000-dot budget by its field and its slider; a slider writes only where it is moved, and one whose value lies past its ends sits off at its nearer end, described by "Beyond the slider's reach — use the number field."; a value the model cannot take is refused in the field's error line and announced; a value typed and not committed goes to the crowd or path it was typed for; Release bias keeps "Earlier 40%" and Release timing "20% uneven" beside their fields, read unrounded. X-06: Share's slider takes the card's width. F16: the seed is a whole-number field, a seed from 0 to 4294967295 one undo entry, said "Crowd 1 pattern seed set to 42. Undo is available.", anything else refused with "Seed is a whole number from 0 to 4294967295.". F15: the outline's Release bias is a direction and an amount, an untouched stored −0.375 surviving, Even turning the amount off at 0 with "Even favours neither end.". With them the brief's layout amendment: helper lines at 1.5 (WCAG 1.4.8), the Guide and At journey end selects whole on a line under their label. The owner's picks of 2026-10-08 (labels verbatim): "Custom network stops auto-entering draw mode (Recommended)", "Draw the crowd's network above the path (Recommended)", "All crowd cards start open (Recommended)", "Number field beside each crowd slider + full-width Traffic (Recommended)", "Editable Pattern seed (Recommended)" and "Node labels on the canvas and in the Node card title (Recommended)". His answer of 2026-10-10 (~23:55) to his audit, "Proceed as per your recommendations" (REL-713), stopped + Add crowd with no route entering Edit network, its announcement rewritten. His word of 2026-10-11, "proceed with your recommendations for PR 8 and 5b", settled the lead's recommendations Q5 to Q9: Q5, the wording (the announcement, the helper lines, the number-field errors) as proposed, the glossary applied; Q6, the two crowd selects on a second line under their label; Q7, the guide's 1 px lighter casing; Q8, node labels with the title, the "Node 3" fallback and 14 px type; Q9, Even turning the outline's amount off at 0 with its reason. His answer of 2026-10-11, late evening (~23:40 BST), "proceed with your reccomendations on 5b. mp4 is route-animation-2026-10-11T21-18-33.mp4", took the lead's recommendation on four questions from the PR's first round: Release timing keeps its words beside its field, as Release bias does; the round-1 agent's error sentences stay; the outline's Release bias labels and hints stay; and no node label is drawn where a named waypoint sits on the node. The lead's settlements, from the rules: the seed's announcement in the app's one form, "Undo is available.", as Re-roll's; full stops on "Beyond the slider's reach — use the number field." and "Seed is a whole number from 0 to 4294967295."; the outline's Even reason "Even favours neither end." in place of the lead's earlier "Shares are already even.", "share" being the Path card's word; a refused value committed again in the field is said again, each refused attempt told once, the dedupe stopping one refusal being said twice by two controls (Codex r3 read it the same way); and a Trace route into network within 400 ms of choosing Custom network sharing that choice's undo entry is DEF-92's existing defect, noted there, not fixed in the PR (Codex r1's reading). The round-2 agent's three calls, which the lead kept and Codex r2 found sound: Release timing's words read the stored amount unrounded ("12.5% uneven", "Even" only at 0); "sits on" is tested by the trace's link and the waypoint's label set to show (`hasLabel()`), not its list name or a radius; and a field holding the kept value after a refusal is not marked invalid. Round 2 (`f3a8ae7`) took Codex r1's six real findings: a slider writes only where it is moved, so a stored Speed of 0.12345 survives an unmoved `input`; Release bias's readout reads its stored amount; the fields show the shortest round trip, and a field committed as shown writes nothing; a value typed and not committed goes to its own path or crowd before a canvas selection or a rebuild replaces the field; Count's slider keeps to the dot budget; an announcement test installs its tip reader before boot. Round 3 (`c35eacf`) took Codex r2's two: a seed typed and not committed goes to its own crowd, found in the live scene by identity, and Count's field is no longer left marked invalid by the slider's refusal; with Codex r2's advisory, the network-edit draw-log golden ending before the path's head. Codex reviewed the PR in three rounds (r1 on `e1747ae`: 0 blocking, 6 real, 2 advisories on browser evidence, the real taken in `f3a8ae7`; r2 on `f3a8ae7`: 0 blocking, 2 real and 1 advisory, taken in `c35eacf`; r3 on `c35eacf`: approve, no blocking and no real in the round, with two real findings of round 3's audit, already on main before the PR, to be recorded apart; the Checked line of `9466a3f`), having checked the PR's brief on `1ec4ef9` (three blocking, folded) and again on `f211c7c` (no blocking, no real), and each round's brief before it ran (round 2's: four tightenings and an advisory, folded; round 3's: no blocking, no real, four advisories, folded); CI on `e1747ae` (run 38179981931) and on `c3198e4` (run 38185050645; the cancelled run beside it, 38185048254, is the duplicate push run) green, and on the head: CI test-and-build green on c35eacf (run 38187346735, 13m53s, completed 01:29 BST; the cancelled run beside it, 38187342962, is the duplicate push run). Tests: 60 added across the rounds (41, 12 and 7), none deleted, skipped or weakened; 64 mutants killed (34, 23 and 7); 733 control-golden lines in round 1 and 48 in round 2, and a network-edit draw-log golden added in round 2 and trimmed in round 3, 0 untraced. The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr5b-*` (`c3198e4`, images only). The same record files DEF-97 at P3, since the owner chose to file it, 2026-10-12, "File DEF-97 (Recommended)" (his pick when asked, ~10:02 BST): on a crowd's busyness graph, a value typed in a handle's Busy field or an interior handle's Time field and not committed is lost when a waypoint is clicked on the canvas (Crowd scope closes with focus kept in the field, and the `change` that follows finds no crowd selected, `src/app/crowds.js` (:702)), when a handle is dragged on the graph (the rows rebuilt on every move, (:814)) and when a drag is cancelled (:828); it was on main before PR 5b, was found by its round-3 audit and Codex r3, and was confirmed in Chromium by the lead on live v3.2.715; the crowd rename field, which the audit's jsdom repro also lost, was found safe in Chromium (its blur commits the name as the Layers row is rebuilt, no row doubled), and its hardening, settled before the strip is replaced and safe against a rebuild inside a rebuild (Codex r3's follow-up), rides in the same row; no fix is decided. Not in the PR: X-02's banner half (PR 6); F7, X-10, X-12 and X-16 (UI-07) and X-13 (W4), as REL-713 split them; F13 (UI-07, since 2026-10-08); DEF-92 (its own brief); CROWD-07 stays open for them.

**Supersedes:** none

**Deferred:** none

## 2026-10-11 — REL-715 — v3.2.715 ships UI-06's follow-ups PR; DEF-96 closes

**Decision:** v3.2.715 is live from deploy commit `f211c7c` (tag `v3.2.715`), released under GATELESS-1 because UI-06's follow-ups merge (`24d3891`, PR #126, the run's PR 8) changed `index.html`, `styles/` and `src/`; UI-06's rows B-32 to B-36 close with it, B-15, B-16, B-18, B-31 and J-18 are made whole, and the low items, J-04, J-16, J-20, W-02 and CROWD-07's F12 and F18 are made; DEF-96 closes, since the Marker card's Size reads the diameter it draws. The owner's disk save is half made: the HTML is saved, the MP4 still owed.

**Rationale:** release.sh: rollback tag `rollback-v3.2.714-24d3891`, gate green (133 files, 3,188 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.715 (pane, 2026-10-11 ~21:22 BST, storage cleared, first-start welcome dismissed by the script): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, `ftypisom`, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live `player.js` embedded; no non-200 resource; two downloads captured (route-animation-2026-10-11T20-22-29.mp4, route-animation.html). The PR changed what the Export menu disables and how, not what an export writes: its items are `aria-disabled` behind a click guard, and a Cancel button sits beside the status line while a video exports (`src/app/exporting.js`, `src/components/Dropdown.js`), while `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `24d3891^..24d3891`. One of the files it changes is a module the player bundle imports, `src/utils/uiReadouts.js` (through `src/app/pathTiming.js`), but what it brings is a comment and `formatMarkerSize`, which no module of the player calls; `docs/player.js` is unchanged between the deploys `1ec4ef9` and `f211c7c`, and 715 does not end in 0, so no new disk save is owed. The one disk save owed since REL-712 is half made: on 2026-10-11 at 15:34 BST the owner saved the Open day example's HTML export from the live site through his Chrome ("route-animation (2).html", 2,032,129 bytes, SHA-256 beginning `b2101fb724c44508`) and attached it to the lead chat with the words "export attached"; the file carries the project, its CSP and the live `player.js` embedded verbatim (433,669 bytes, the same file from v3.2.712 to v3.2.714, so it came from a build of v3.2.712 or later), so it is the HTML half of the one save that settles v3.2.710's debt and any v3.2.712 owes (the owner, 2026-10-09: "One save covers both"; REL-712). The MP4 half is still owed: the lead asked the owner for it on 2026-10-11 (~15:40), and the wish line now asks for it alone. The owner's audit of 2026-10-10 of UI-06's four shipped PRs on live v3.2.712 (REL-713) found five breaches the review had missed and five rows closed only partly. B-32: a swatch picker's options were 16 px wide, its grid fallen into the 6rem label track; the grid is now the picker's full width under its legend, 47.2 px per option or more. B-33, B-34 and B-35: focus fell to the page when the Layers strip rebuilt, when Edit network disabled its own button and when a toast went with focus on its Dismiss; the strip now gives focus to the rebuilt row, eye or delete (a gone crowd's to the Route row), Edit network to the banner's Done, and a leaving toast to the control focused before, else the next toast, an earlier one, then the container. B-36: the layer swatch and the current-colour chip have `--border-interactive` borders, 3:1 or more in every state, a hidden crowd's swatch dimming its fill only. B-18: the Export items are `aria-disabled`, reached by the menu's keys with their reasons, a click on one refused with the menu left open. B-16: a failed download says what to do next, and an error toast stays until it is dismissed. J-18: a Cancel button follows the status line while a video exports. B-15: the outline's running text says "Select major waypoint 1". B-31: an empty crowd's line says "This crowd has no dots. To start again, delete it in Layers and choose + Add crowd." The audit's three low items, which UI-06's Notes record under the rows they extend (the PR 8 brief's proposal): one word per concept, area and corner where the outline, its messages and the drawing banner said polygon and vertices (B-24); Undo's and Redo's shortcuts in hints, not `title` (B-07); an expanded, focused card header's ring painted over its accent (B-02). The owner's §C.7 rows: J-04, Choose image described by the background drop tip; J-16, the switch named "Preview mode"; J-20, no redundant landmark `role`, and `aria-haspopup="menu"` written once, in the markup; W-02, the outline's position fields at the heading's two decimals, a field never edited writing the exact stored value and one typed in writing what it holds. CROWD-07's F12 (a Layers button's `title` is its `aria-label`) and F18 (the Pattern seed's label and hint; Reset to even's hint and its reason while it is off). DEF-96: the Marker card's Size reads twice the stored value, "16 reference px" at the default, a nominal diameter (a flag draws 3 × tall and 1.5 × wide), what is stored and drawn unchanged. The lead's addendum: "centre" where "center" survived. The owner's word on the PR's four calls, 2026-10-11: "proceed with your recommendations for PR 8 and 5b", the lead's recommendations being Q1, the colour grid full width under its label; Q2, a deleted crowd's focus to the Route row, Edit network's to the banner's Done and a dismissed toast's to the control focused before; Q3, a Cancel button beside the export status line now, which PR 6 may move into its slot; Q4, the words bundle, the triangle sentence included, the lead applying the glossary. The lead's settlements, from the rules: errors stay by `priority: 'assertive'`, with no second classification (one announcement route); J-04's guidance is a described line, not a `data-tip`; a Layers button's `title` is its `aria-label`; a toast's fallbacks end on the container. The implementing agent's calls, accepted by the lead as the glossary's consequences, not the owner's: "corner" in the singular too, since "Vertex N" under "Drawn area — 4 corners" would be the synonym pair the glossary forbids; `#bg-drop-hint` stays `sr-only`, the brief's change line governing its test line; + Add crowd keeps focus on entering Edit network, as the Guide select does. Round 2 (`e0a3c2b`), from Codex r1, gives W-02 an edit mark, so a field typed in writes what it holds even when that is the value shown ("18.91" retyped stores 0.1891), and lets a bend off the image apply as its field shows it; the mark reaches every field with a stored exact value (a wait, a fade, a path's weight, a crowd's name, a node's label), which the lead kept as built and told the owner, a name stored with stray spaces and typed back being saved trimmed, and Codex r2 found that reach appropriate. Codex reviewed the PR in two rounds (r1 on `4cd7da6`: 1 blocking, the off-image bend; 2 real, the retyped value and a concurrency helper that read a natively disabled Export item as free; 3 advisories, the chord's key names, the "center" census and DEF-96's comment; all taken in `e0a3c2b`, with Codex's check of the round-2 brief folded; r2 on `e0a3c2b`: approve, all six r1 findings closed, nothing new (reviews/ui06-follow-ups-r2-summary.md); the Checked line of `24d3891`); CI on the head `e0a3c2b`: CI test-and-build green on e0a3c2b (run 38158345497, completed 18:25 BST; the cancelled run beside it, 38158334798, is the duplicate push run). Tests: 48 added, none deleted, skipped or weakened; 63 mutants killed; 1,397 golden lines, 0 untraced. The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr8-*` (`af6743f`, images only). Not in the PR, as REL-713 split them: §C.7's J-06, J-07, J-09, J-10, J-11, J-14, J-15, J-22 and W-06 (UI-06) and F7, X-10, X-12, X-13 and X-16 (CROWD-07) stay open for UI-07 and W4, and UI-06 and CROWD-07 stay open for PRs 5b and 6. What PR 8's checks saw outside its rows is captured as three wish lines (from: UI-06, 2026-10-11): the exported player's "polygon vertices", the outline's "Bend point" messages and a dead `waypoint:add-at-center` handler.

**Supersedes:** none

**Deferred:** none

## 2026-10-11 — REL-714 — v3.2.714 ships CROWD-07's crowd cards PR 5a

**Decision:** v3.2.714 is live from deploy commit `1ec4ef9` (tag `v3.2.714`), released under GATELESS-1 because CROWD-07's first crowd cards merge (`15b4b8a`, PR #123, the run's PR 5a) changed `index.html` and `src/`; CROWD-07's rows F1, F6 and F14 are made with it, since a crowd's dot Size now reads the diameter drawn in reference px, "At journey end" says how its four options differ, on the card and in the outline alike, and on a custom network the Guide card says where journeys start and end; F8 and F17, found already made, are pinned by tests. F20 waits for DEF-93, which stays open, and no DEF row closes. The PR follows the owner's answers of 2026-10-09 and 2026-10-10, recorded below with the lead's glossary calls.

**Rationale:** release.sh: rollback tag `rollback-v3.2.713-15b4b8a`, gate green (133 files, 3,140 tests, 2 todo), dry run, push, Verify and the Pages build and deploy green, 22 of 22 live files SHA-256-identical. Live smoke on v3.2.714 (pane, 2026-10-11 ~03:08 BST, storage cleared, first-start welcome dismissed by the script): Open day route loads 6 waypoints; plays to 3,002 ms of 27,283 ms, then to its end in 1,457 frames with 0 queued; MP4 9,664,123 bytes, `ftypisom`, 1920×1080, 29.3 s; HTML 2,035,960 bytes with the project, its CSP and the live `player.js` embedded; no non-200 resource; two downloads captured (route-animation-2026-10-11T02-06-38.mp4, route-animation.html). The PR changed no export code (`src/app/exporting.js`, `src/services/HTMLExportService.js`, `src/player/` and `docs/` are unchanged in `15b4b8a^..15b4b8a`). Two of the files it changes are modules the player bundle imports, `src/services/DotRenderer.js` (through `src/services/RenderingService.js`) and `src/utils/uiReadouts.js` (through `src/app/pathTiming.js`), but what they bring to the player is a comment, an `export` on `DOT_BASE_RADIUS_PX`, whose value (10) the bundle already writes in place, and `formatCrowdDotSize`, which no module of the player calls; `docs/player.js` is unchanged between the deploys `a2939af` and `1ec4ef9`, and 714 does not end in 0, so no new disk save is owed; the one disk save of the live build, v3.2.712 or later, through the owner's Chrome, stays owed and settles v3.2.710's debt too (the owner, 2026-10-09: "One save covers both"; REL-712), and v3.2.714 is such a build. The crowd review of 2026-10-08 found that a crowd's dot Size read "0.40×" where the other map-bound sizes read reference px (F1), that "At journey end" did not say how Respawn at the start differs from Repeat journey (F6), and that on a pen network the Guide card did not say where journeys start and end, which a node's Type decides (F14). Size now reads the diameter drawn, 20 reference px per 1× (1, 8 and 40 reference px at the slider's 0.05×, default 0.40× and 2.00×), in its readout and `aria-valuetext` alike, written by the shell, the slider and a crowd's selection, its hint naming the export scaling; `dotSize` is stored as before, and the scene outline still edits Dot size in ×, its hint giving the reference px the value draws. "At journey end" carries one sentence on the Motion card and in the outline, word for word, a test holding the two equal: "Disappear removes a dot at its journey's end; Collect at the end parks it there; Respawn at the start sends a new dot from the start with its own pace and walking variation; Repeat journey follows the same paths again at the same pace". On a Custom network, empty or drawn, the Guide hint says that journeys start at entry nodes and end at exit nodes, and what happens with neither, never on Follow route; with no route, the card asks for two route waypoints once, in the Trace reason (UI-06's B-07, unchanged). F8 (the outline's "At journey end" options are the card's, value for value; the Guide counts paths, never edges) and F17 (Edit network, Trace route into network, Add handle, Swap direction, + Add crowd and each crowd row's rename hint show their help by keyboard) were already made, by UI-06's words PR (#115) and, for the rename hint, its targets PR (#118), and are now pinned by tests; F20, the endless-network hint, is DEF-93's, its text pinned unchanged. The owner's answers (AskUserQuestion, labels verbatim): on 2026-10-09, for the outline's "At journey end" hint, "Same sentence in both (Recommended)" (option text: "One description for one control wherever it appears (the consistency rule). A small extra commit on PR 5a."), and on the two smaller calls "go with your reccomendations", the lead's recommendations being that Size keeps the previous crowd's value on a crowd with no emitter, as every set control does under UI-06's B-31, and that the outline's hint writes "0.4" as its field shows it; on 2026-10-10 (~22:45), for the Repeat journey clause Codex r1 found too strong (the first wording, "Repeat journey replays the same walk exactly", is false on a network with Walking variation, whose sway runs on from one journey to the next), "Keep the new wording (Recommended)", and for that drift "File a DEF row (Recommended)", DEF-95, filed in REL-713; and on 2026-10-10 (~23:55), to his audit of Phase 3 (REL-713), "Proceed as per your recommendations", which on PR 5a corrected the pull request's claim that Size reads as the Marker card's does (the Marker's "8 reference px" is a radius: DEF-96, filed in REL-713; the Marker card is unchanged here), asked for the two route waypoints once on the Guide card, not in both its Trace reason and its hint, and brought the new sentences into the panel's words. The glossary calls in round 3 are the lead's, not the owner's, the first two being the audit's glossary consequences, which REL-713 records as going with the audit's seven decisions unless the owner says otherwise: "sway" becomes "walking variation", the control's name; "Entry" and "Exit" take the lower case the Node Type hint writes in running text; and "master timing", an engine term the panel never shows, leaves the Guide hint, whose no-route sentence is now "It takes at least two route waypoints before previewing or exporting." Codex reviewed the PR in two rounds (r1 on `b23f14a`, the rows and round 1: 0 blocking, 1 real, the Repeat journey clause, fixed in `81d4af6`; no separate r2, the lead folding round 2 into r3; r3 on `7951c88`, covering round 2, the rebase onto `2c9f5f8` and round 3: approve, no findings; the Checked line of `15b4b8a`); CI on the head `0c5ae3c`: CI test-and-build green on 0c5ae3c (run 38100415864, 17m48s; the cancelled run beside it is the duplicate push run). The lead's pane pairs are in `reviews/design-review-2026-10-08-shots/after/` named `pr5a-*`, the three that round 3 changed taken again in `0c5ae3c`, images only. DEF-95 and DEF-96, which PR 5a's checks surfaced, stay open as REL-713 filed them, and DEF-93 stays open for F20.

**Supersedes:** none

**Deferred:** none
