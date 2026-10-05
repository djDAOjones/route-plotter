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
     Budget 45 live entries: when the validator warns, tools/archive.mjs
     moves the oldest entries verbatim to project/archive/ — on the
     owner's word, as the rules file says. -->

## 2026-10-05 — CROWD-05 — The animation running until every crowd dot finishes is filed, waiting on the owner's word

**Decision:** CROWD-05 joins the backlog as a `[!]` line, because the owner reported from use that a crowd going from Entry to Exit is cut off when the route ends and asked for it to be filed, not started; he agreed its shape in outline, and starting it waits on his word.

**Rationale:** his words reached this run relayed verbatim by the Backlog status session; the item quotes them. The backlog rather than the wish-list, and the ID after CROWD-04 in the canon crowd family, are this session's calls. The shape that session proposed (a crowd tail after the route, releases anchored to the route-only duration, a control for looping crowds) is in the item's notes; to that session's summary of it he replied "agreed", read here as accepting the placement and the shape, the example control included, not as an order to start (this session's reading, for him to confirm). The wish line owing the crowd explainer's update is retired: that session updated the doc after DEF-77 shipped.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — GATELESS-1 — The in-page export check suffices, with a save to disk after export changes and every tenth release

**Decision:** a release's in-page export check is enough unless it changes the export code or `player.js`, or its build number ends in 0; then its exports are also saved to disk and opened there. v3.2.699's owed save is retired and v3.2.700's is owed, because the owner said "proceed on that basis" and asked for a check every tenth release.

**Rationale:** asked whether releases after v3.2.698 still owe their saves, he asked for this session's recommendation: the in-page check captures the export's own bytes and checks the MP4's header, decode, size and length and the HTML's CSP, project and embedded player; a saved copy adds only opening from disk (the HTML as a file, the MP4 in a desktop player), which matters when export or player code changes. He answered "proceed on that basis. could we perhaps add an export check avery tenth release or something? is that practical?". Builds ending in 0 as his "every tenth release" he confirmed, "if viable" (it is: the build number rises by one each release). The browser pane cannot save a download; offered his hands or his own Chrome, he chose "you": the run saves through his Chrome (Claude in Chrome), asking his word for each download. This extends the same day's entry confirming the checks for v3.2.693–698.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — UI-03 — Hints open on hover, say what they mean, and cover every setting

**Decision:** UI-03 part 1 lands: a mouse resting 500 ms on a hint's text opens it, it stays while the pointer is on the text, its control or the hint, and Escape dismisses it in place, in a scene-outline field too; a hint sits clear of the control it describes; thirteen unclear hints are reworded and 60 settings gain one, because the owner asked for parameters explained in place. The owner's ahead-of-Phase-1 group closes; Phase 1 resumes with TST-16 (PR #76), readiest first by PLAN-1.

**Rationale:** Digest rules applied: wcag-2.2-aaa 2.1.3 (keyboard, click, tap and the description unchanged) and the criteria's content on hover or focus (dismissible, hoverable, persistent); nielsen 2, 4 and 10 (the panel's own words, Wait not "pauses", Border not "outline"); carbon component first (the 300 ms leave grace is Carbon's tooltip delay). Release bias now says left is Earlier, checked against `dotOnsetFraction`. Hints created after load are wired as they appear, and an outline error keeps the field's hint in its description. 135 parameter controls counted (inputs, selects and colour groups that set the project or its export; actions, dialogs, the timeline slider and inline renames excluded); 75 had a hint. The session's calls, for the owner to confirm: that definition; the 500 ms open delay; a click on a hint's text keeps a hover-opened hint and a click on the hint closes it; Escape closes a hint and still reaches the field's own handler; resting on another hint replaces an open one; focus loss leaves a hover hint open; the three "reference short edge" hints stay (UI-STANDARDS prescribes them). DEL-05's three tooltip files are not needed (its item notes what goes with them). Screen readers, touch hardware and forced colours were not checked on real devices (REV-05). Recall, local: last four shipped UI-03, DEF-77, DEF-42, TST-13 (trajectory); a decision: the owner's order of DEF-77 then UI-03 (GATELESS-1); deferred: UI-04 (backlog Next) and the wish-list's UI-03 and DEF-77 lines; next: TST-16, Phase 1.

**Supersedes:** none

**Deferred:** UI-04

## 2026-10-05 — REL-699 — v3.2.699 ships DEF-77

**Decision:** v3.2.699 is live from deploy commit `1a42abe` (tag `v3.2.699`), released under GATELESS-1 because DEF-77's merge (`2ff2948`, PR #91) changed `src/` and `index.html`.

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `2ff2948`; Pages `main` `/docs`, built at `2ff2948`, tagged `rollback-v3.2.698-2ff2948`; `git fsck --connectivity-only` reported only dangling trees, and no OneDrive conflict copies. (2) `npm run check` green (101 files, 1,984 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `1a42abe`. (4) Verify, the Pages build and deploy green on `1a42abe`. (5) The `github-pages` deployment at `1a42abe`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.699"); the Open day route played (frames driven by hand: 3,002 ms, then to its end at 11,594 ms, after which no frame stayed queued) and exported, at 1280×800, as MP4 (1920×1080, 13.6 s, `ftypisom`) and as HTML (its CSP, the project and the live `player.js` embedded byte for byte), captured in the page. The pane's network timed out now and then (`ERR_TIMED_OUT`): a first run's own `player.js` fetch failed after both exports, and a second's example failed to load, so its HTML export refused for want of a background image; the third run passed every check, and the live files match `docs/`. DEF-77's hint was checked in Chromium on a build of `e3aac41` before the merge. The save to disk stays owed until the owner answers the wish-list's question (GATELESS-1).

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — DEF-77 — "At journey end" acts where it is seen

**Decision:** DEF-77 lands (PR #91): a new crowd gets Speed 0.40 and Window length 50%, so its dots finish; a network with no Exit ends journeys at its one-connection nodes; each Respawn journey after the first draws its own variation from the seed and its index; and the panel says under "At journey end" when no dot finishes, and what to change. The owner reported the setting had no visible effect.

**Rationale:** the item's criteria, each pinned by a test; all but two failed on `main` (the pen-network test and the `lifecycleMode` load case pass there as guards). On a pen-drawn three-node network, Disappear leaves no dot late and Collect parks dots on the end nodes (17 dots were late before). A default crowd finishes on 720–1920 px canvases (the old defaults finished 0–21 of 50), and saved crowds keep their values. Respawn equals Repeat journey during the first journey, then differs, while Repeat journey replays exactly one period later; at 0% Pace and Walking variation, Respawn still equals Repeat journey, as the Pace variation hint promises. The hint is described text on the select (`aria-describedby`), worked out from the model when a crowd, the timeline or the network changes, never per frame. On a network where no journey can end, it names the node's Type instead. The authorable-load case now passes `lifecycleMode`. Five mutants (no exit fallback, the hint forced off, the loop hint forced off, no journey index, Respawn at the dot's own pace) each fail a test. Codex's review (def77-r1) found three defects, fixed in a second commit: the hint rebuilt every dot's journey on any edit (475 ms for 500 dots on a closed loop, now 0.01 ms, and appearance edits skip it); a walk that ran out of hops counted as an arrival (a schedule now says whether the journey ends); and Respawn's variation froze after 2,048 journeys (now it never stops). Nine more mutants each fail a test. The session's calls, for the owner to confirm: both remedies the item allowed (the new defaults and the hint), the defaults set for new crowds only, a respawned node not counted as an exit until a dot has walked from it, Respawn's pace draws repeating every 64 journeys while its sway never repeats, an Entry with no path counting as an end, and the hint skipping dots whose entry reaches no end and recomputing only on edits that can change it. Saved exit-less networks and every Respawn crowd look different after the first journey; that is the fix. Digest rules applied: house conventions → Testing and persistence; WCAG 2.2 AAA and Nielsen → status visible.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — GATELESS-1 — The owner confirms the in-page export checks and four session calls

**Decision:** for v3.2.693–698 the in-page export checks are enough, so their owed saves to disk are retired, and the four calls the order entry lists are the owner's, because he answered "yes" in his own chat; later releases are not covered.

**Rationale:** In the run's sixth chat he was asked whether he confirms the Backlog status session's draft, "in-page checks are enough; all four of chat 3's calls are confirmed", and answered "yes". The four calls: DEF-44 names its near-1× tail as a bounded leftover; three releases recorded in one PR; DEL-05 keeps `Tooltip.js`, `tooltips.js` and `tooltip.css` until UI-03 decides; v3.2.694's export check stands in for v3.2.693's. This settles point (1) of the order entry of the same day, which otherwise stands. The wish-list line that owed the saves is retired. That later releases also need no save is this session's reading, for him to confirm (a wish-list line); until then each release owes its save as before.

**Supersedes:** 2026-10-05 — GATELESS-1 — The owner orders DEF-77, then UI-03's first part, ahead of Phase 1's pull requests

**Deferred:** none

## 2026-10-05 — GATELESS-1 — The owner orders DEF-77, then UI-03's first part, ahead of Phase 1's pull requests

**Decision:** DEF-77 is next, then UI-03 part 1 (hints open on hover, unclear hints reworded, hints for every setting), ahead of Phase 1's eight pull requests; UI-03's "?" and DEF-14's fix become UI-04, after TST-04. His word on the release checks is recorded as relayed, not confirmed.

**Rationale:** The Backlog status session relayed the owner's words verbatim at about 11:05. (1) "in-page checks are enough, confirm all four calls": the release exports' saves to disk would no longer be owed, and four calls stand (DEF-44 names its near-1× tail as a bounded leftover; three releases recorded in one PR; DEL-05 keeps `Tooltip.js`, `tooltips.js` and `tooltip.css` until UI-03 decides; v3.2.694's export check stands in for v3.2.693's). (2) "can we promote the crowd features i.e. parameters need explaining somehow, ideally in situ i.e. hover over text on question mark, as some hard to know e.g. crowd emitter release bias, and dont think "at journey end" parameters are working", picking "Next, after DEF-42 (Recommended)" and "Two parts (Recommended)". In his own chat he confirmed the order: "yes, I confirm DEF-77 then UI-03 part 1 next"; that this also confirms the split's later part is this session's reading. (1) was not in that reply; asked again, without blocking, so the wish-list's export-save line stands until he confirms. UI-04's ID, the split's wording and UI-04 as an open line behind TST-04 (his word given, not `[!]`) are this session's calls.

**Supersedes:** 2026-10-05 — DEF-77 — The backlog takes the crowd "At journey end" defect, and in-place parameter help waits on the owner's word

**Deferred:** UI-04

## 2026-10-05 — REL-698 — v3.2.698 ships DEF-42

**Decision:** v3.2.698 is live from deploy commit `88d1f2f` (tag `v3.2.698`), released under GATELESS-1 because DEF-42's merge (`98600ca`, PR #62) changed `src/`.

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `98600ca`; Pages `main` `/docs`, built at `98600ca`, tagged `rollback-v3.2.697-98600ca`; `git fsck --connectivity-only` clean and no OneDrive conflict copies. (2) `npm run check` green (101 files, 1,956 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `88d1f2f`. (4) Verify, the Pages build and deploy green on `88d1f2f`. (5) The `github-pages` deployment at `88d1f2f`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.698", every resource answered 200, no console error); the Open day route played (frames driven by hand: 3,002 ms, then to its end at 11,594 ms, after which no frame stayed queued) and exported, at 1280×800, as MP4 (1920×1080, 13.6 s, `ftypisom`) and as HTML (its CSP, the project and the live `player.js` embedded byte for byte), captured in the page. A first play, about 1 s after the example button in a pane that had restored a session, read duration 0; after a 4 s settle it played as above, so the smoke script now settles 4 s. Why the first read 0 is not established: settling is a reading, and Codex names a load and play race to probe (wish-list). The saves to disk stay owed (GATELESS-1).

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — DEF-42 — A beacon edit in the inspector retimes at once, and a branched route's timeline is composed afresh

**Decision:** DEF-42 lands (PR #62): a beacon style or pulse cycle chosen in the inspector rebuilds timing at once, as the motion settings do, and every rebuild composes a branched route's timeline afresh, because the editor went on timing a beacon by its old style, and a pause or beacon edit on a branched route kept the old total.

**Rationale:** the round PLAN-1 named is finished. A constant-time edit, Undo and Redo, run without a rebuild between them, checks the model and the whole timeline (branch legs included) at each step against the timeline each style gives once rebuilt in an app of its own; with DEF-06 merged in, Undo retimes, and the case kills M1 (`retimeRoute` ignores `_timingDerived`), M2 (a rebuild never sets it) and Codex's round-2 mutant (a rebuild clears it). Its two other findings are fixed in the tests too: the style, ripple-scale and pulse-cycle cases assert the model, no schedule for none and a changed timeline before reopening, which kills its three mutants (scale not assigned, none ignored, a cycle set only on branch waypoints). Chromium, the Open day route's second major changed from ripple to grow and read 1.5 s later: live v3.2.697 kept ripple's schedule, and its rebuild kept the old total (11,594 ms); a build of the branch timed grow at once and fell to 11,356 ms, equal to a rebuild. Coalescing continuous-input rebuilds is a wish line. Digest rule applied: house conventions → Testing and persistence. DEF-57 and DEF-76 no longer wait on it.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — TST-13 — The key table, element ids and HTML number ranges are pinned against the code

**Decision:** TST-13 lands (PR #69): Help as it renders, each key listener's keys read from its source and pressed on its target, each element-id lookup against its page, and each range and number field's markup, code and handler are pinned, because DEL-05, DEF-13, DEF-15, DEF-32 and three found defects need that harness first.

**Rationale:** the round Codex's fourth review asked for is finished in the tests only. The source reader trusts a followed helper only where its file otherwise just calls it, reads a member of it or passes it whole, and reports any other use unread (F1); it decodes escaped strings before comparing names and reports escaped method names, event types, event identifiers and `getElementById` (F2); number attributes are read with HTML's number syntax (F3). P1, P3 and P5, applied in place, each fail the suite by assertion, and the reader's inventory of `src/` is unchanged (21 listeners, 314 id calls). The key domain is the listed named keys, F1–F24 and Soft1–Soft4 (A1). The plan row names the scanner's limit: a name built at run time, or a method another file assigns or overrides. Digest rule applied: house conventions → Testing and persistence. DEF-13, DEF-32, DEF-62, DEF-63 and DEF-69 no longer wait on it; DEF-15 waits on TST-05, and DEL-05 on TST-04.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — DEF-77 — The backlog takes the crowd "At journey end" defect, and in-place parameter help waits on the owner's word

**Decision:** DEF-77 ("At journey end" has no visible effect) joins the found defects, runnable now, and UI-03 (in-place parameter help) waits after Phase 1 as a `[!]` line until the owner's word, because the owner asked the Backlog status session, on 2026-10-05, to hand both to this run for filing ("Hand to running chat (Recommended)").

**Rationale:** the owner's words reached this run through that session's message and write-up, so they are quoted as relayed, not heard. On DEF-77's timing fix he said "your choice but no backwards compatibility needed", and that session chose both new-crowd defaults under which dots finish and a hint when none do: its choice under his delegation, recorded in the item's notes, not his words. On Respawn he said "Make Respawn vary". He placed UI-03 "After Phase 1 (Recommended)". The session's calls, for the owner to confirm: UI-03 is new feature work, which GATELESS-1 excludes ("no new feature work"), so it waits on his word rather than entering the run's queue; DEL-05 leaves the inert hover tooltip files in place until UI-03 decides; that session's six unverified triage candidates are wish lines. The owner's crowd explainer doc carries a known-issues note to update once DEF-77 ships.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — REL-697 — v3.2.697 ships SPL-06

**Decision:** v3.2.697 is live from deploy commit `f0ec967` (tag `v3.2.697`), released under GATELESS-1 because SPL-06's merge (`c986fbf`, PR #75) changed the build.

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `c986fbf`; Pages `main` `/docs`, built at `c986fbf`, tagged `rollback-v3.2.696-c986fbf`. (2) `npm run check` green (97 files, 1,808 tests, 2 todo); `npm run push:dry-run` clean, so the new `build.js` built and checked the release itself. (3) `npm run push` committed `f0ec967`. (4) Verify, the Pages build and deploy green on `f0ec967`. (5) The `github-pages` deployment at `f0ec967`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.697"; every resource of its load answered 200, and the pane's one console error is the 404 of the session's own `version.json` probe on v3.2.694); the Open day route played (frames driven by hand: 3,002 ms, then to its end, after which no frame stayed queued) and exported, at a 1280×800 viewport, as MP4 (1920×1080, 13.6 s, `ftypisom`) and as HTML (its CSP, the project and the live `player.js` embedded byte for byte), captured in the page. The saves to disk stay owed (GATELESS-1, the owner's answers after chat 2).

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — REL-696 — v3.2.696 ships DEF-44

**Decision:** v3.2.696 is live from deploy commit `183691f` (tag `v3.2.696`), released under GATELESS-1 because DEF-44's merge (`1ca1ee2`, PR #71) changed what ships.

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `1ca1ee2`; Pages `main` `/docs`, built at `1ca1ee2`, tagged `rollback-v3.2.695-1ca1ee2`. (2) `npm run check` green (96 files, 1,751 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `183691f`. (4) Verify, the Pages build and deploy green on `183691f`. (5) The `github-pages` deployment at `183691f`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.696"; its console was not checked, a gap this record names); the Open day route played (frames driven by hand: 3,002 ms) and exported, at a 1280×800 viewport, as MP4 (1920×1080, 13.6 s, `ftypisom`) and as HTML (its CSP, the project and the live `player.js` embedded byte for byte), captured in the page; once the route had played to its end, no frame stayed queued. The saves to disk stay owed (GATELESS-1, the owner's answers after chat 2).

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — REL-695 — v3.2.695 ships DEF-53

**Decision:** v3.2.695 is live from deploy commit `045257f` (tag `v3.2.695`), released under GATELESS-1 because DEF-53's merge (`9e9a46c`, PR #64) changed what ships.

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `9e9a46c`; Pages `main` `/docs`, built at `9e9a46c`, tagged `rollback-v3.2.694-9e9a46c`. (2) `npm run check` green (95 files, 1,720 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `045257f`. (4) Verify, the Pages build and deploy green on `045257f`. (5) The `github-pages` deployment at `045257f`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.695"); the Open day route played (frames driven by hand: 3,002 ms) and exported, at a 1280×800 viewport, as MP4 (1920×1080, 13.6 s, `ftypisom`) and as HTML (its CSP, the project and the live `player.js` embedded byte for byte), captured in the page; the one console error was a 404 for the session's own probe of `version.json`, which is not published. The saves to disk stay owed (GATELESS-1, the owner's answers after chat 2).

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — SPL-06 — build.js builds only when run as a script, and exports the checks a release applies

**Decision:** SPL-06 lands (PR #75): `build.js` builds only when it is run as a script, so tests can import it, and it exports the checks a release applies (the image manifest, the index.html stamp and its check, the Pages inventory, the command line) and the publish and failed-build rollback steps, which act only on the paths they are given; every mode the repository uses runs as before, because TST-11 needs a `build.js` it can load.

**Rationale:** importing `build.js` starts no build and reads none of its inputs, except that on Node 24.0 and 24.1, without `import.meta.main`, its entry check resolves two paths. The round its second Codex review asked for is finished, in the tests only: the test host now wraps the functions that fs calls carry (Y1, `fs.realpathSync.native` called at import), compares the file-creation mask with the rest of the process state (Y3, `process.umask` changed at import), and compares that state before and after every export call, each pure export called first in a fresh import (Y4, `resolveBuildMode` setting an environment variable). Each of the three, applied to `build.js`, now fails the suite, and three tests show the host seeing it in a copy whose `build.js` does it. The host observes the APIs and process state it names, not every effect. Digest rules applied: house conventions → Refactor contract, and Testing and persistence. TST-11, DEF-71 and DEF-75 no longer wait on it.

**Supersedes:** none

## 2026-10-05 — DEF-44 — A still editor goes idle: a frame that draws no camera puts the camera where it would rest

**Decision:** DEF-44 lands (PR #71): a frame that draws no camera (no waypoints, Edit mode, Camera movement off, the author's viewport zoom) puts the camera where it would come to rest, so a cold start, a restored session, Edit mode after Preview, a zoomed-in view and a video exported from Edit mode stop drawing frames that change nothing, because stable paused views must queue no animation frame (the rules file's Always).

**Rationale:** the round its third Codex review asked for is finished by the review's first option, with no production change: an 8K player seeking to 1× from the Zoom slider's first step (1.028×) ends with eight frames that draw the same flat view, on `main` too, because the renderer draws no camera within 0.001 of 1× while the centre eases on to within a pixel. The plan row now names that tail among its bounded residuals, beside the brief runs at 1× after a resize and as the player loads, and its completion claim is narrowed to match; a test holds the tail to ten frames, ending by itself. The review's advisory is taken: the viewport-return test runs at all four edges and with the head exactly on 0, and kills T1, T2 and T4 (the resting centre unclamped in X or Y, a centre of 0 read as absent). Chromium, on a throwaway build of the branch beside live v3.2.694 (the Open day route, frames run by hand): a cold start with no waypoints draws one frame and goes idle where live still queues after 600, a scrub under a 2.25× viewport zoom draws one frame where live draws 79, and undoing that zoom queues none, the camera already where it belongs. The session's call, for the owner to confirm: naming the tail rather than settling the centre, the narrowest of the two fixes the review allowed; the residuals that stay have a wish line. Digest rule applied: house conventions → Testing and persistence. DEF-68 no longer waits on it, and DEF-69 waits on TST-13 alone.

**Supersedes:** none

## 2026-10-05 — DEF-53 — A video export keeps the canvas size it began with

**Decision:** DEF-53 lands (PR #64): a size chosen while a video export runs (by the size fields or a fixed-size preset) applies to the display, the background placed for it and the next export once the export ends, and never to the frames it is still writing, because the export's frames changed size mid-file.

**Rationale:** the round Codex's eleventh review asked for (F1) is finished in the tests only. A new case holds the encoder while the queued animation-frame and timer callbacks run after each choice, for both export kinds and all three endings, and checks the geometry then. AC1 (the guard resizing on the next animation frame) and AC9 (alpha zeroed on a timer) now fail it on assertions, and W2 and X1, re-anchored to DEF-27's background rectangle, are still killed. Chromium, on a throwaway build of the branch and on live v3.2.694, the Open day route at 1280×800: a width typed mid-export resized live's running export canvas from 1920×1080 to 1306×1306; on the branch it stayed 1920×1080 to the end, and the new size applied once it ended. Digest rule applied: house conventions → Testing and persistence. DEF-58 no longer waits on it, and DEF-66 waits on TST-05 alone.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — GATELESS-1 — The owner's answers after chat 2: he authorises saving the release exports, the listed calls stand, chat 3 runs to 500k

**Decision:** the owner answered chat 2's three closing questions on 2026-10-05: he authorises saving each release's smoke-test exports from the live site ("yes"), though the save is still owed; the session calls listed for him stand ("sounds good"); and the run's third chat runs to 500k tokens of context with every later chat on the profile's 200k ("next use 500k but I will probably end early, and after that use 200k"). Only condition 9's session allowance changes; every other condition of the grant stays in force.

**Rationale:** the questions were chat 2's, asked at its close; the answers are the owner's, verbatim, carried by that chat's handoff.
1. Saving: one MP4 (about 5 MB) and one HTML (about 2 MB) of the Open day route per release, from the live site; later releases save without asking again. v3.2.693 is no longer live, so its exports can no longer be saved from the live site; the session reads v3.2.694's saved-file check as standing in for it, its call for the owner to confirm, and the wish line keeps v3.2.693's check open until he does. Chat 3 exported both from live v3.2.694 at a 1280×800 viewport: the MP4 is `ftypisom`, 1920×1080, 13.6 s, 4,366,674 bytes (REL-694's 14.4 s was at another window's size; durations follow the canvas's display width by design); the HTML is 2,026,423 bytes and embeds its CSP, the project and the live `player.js` (424,168 characters) byte for byte. The save to disk did not happen: the browser pane's own download left no file that could be found, and a local server to receive the bytes was refused by the session's permission classifier ("Expose Local Services"). The saved-file check stays owed, its wish line says so, and the owner is asked in chat.
2. "sounds good" confirms the session's calls listed for him: 500k for chat 2 alone (condition 9), v3.2.693 released before DEF-06 landed (REL-693), rollback tags named `rollback-v3.2.<previous>-<sha>`, release IDs `REL-<build>`, and PLAN-1's order with its short found-defect titles. Still open for him: the grant's three calls; PLAN-1's dropped " impl (gated)" and DEF-76 waiting behind DEF-42; "drop older" reaching format 9 (the brief).
3. Session line: chat 3 runs to 500k, with no new agents past about 460k; the owner may end it early, so each item's state stays pushed and the handoff current.

**Supersedes:** 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Deferred:** none

## 2026-10-05 — REL-694 — v3.2.694 ships DEF-06

**Decision:** v3.2.694 is live from deploy commit `f482ea1` (tag `v3.2.694`), released under GATELESS-1 because DEF-06's merge (`32d9220`, PR #61) changed `src/`; it ends the DEF-08 symptom v3.2.693 shipped (REL-693).

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `32d9220`; Pages `main` `/docs`, built at `32d9220`; that live SHA had no tag, so an annotated tag `rollback-v3.2.693-32d9220` was pushed at it (its `docs/` tree is v3.2.693's). (2) `npm run check` green (94 files, 1,674 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `f482ea1` "chore: deploy v3.2.694", six files changed, `docs/` holding 22. (4) Verify, the Pages build and deploy green on `f482ea1`. (5) The `github-pages` deployment at `f482ea1`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.694", no console errors); the Open day route played (the hidden pane's loop driven by hand: three seconds of frames, 3,002 ms) and exported as MP4 (1920×1080, 14.4 s at this window's size, `ftyp`) and as HTML (its CSP and the live `player.js` embedded byte for byte), captured in the page. (6) No rollback. (7) Annotated tag `v3.2.694` at `f482ea1`, pushed. DEF-06's own Chromium check ran on a throwaway build of its branch before the merge (decision DEF-06). Owed: saving the live exports, as for v3.2.693 (the wish-list line now covers both). The plan's DEF-06 marker reads "released in v3.2.694". The owner, mid-run on 2026-10-05: "dont forget to use codex in this dev run as a programming partner"; the run uses Codex read-only for every review and PLAN-N, and for consults such as the one that traced DEF-76.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — DEF-06 — A route's derived state goes with it, and a snapshot times the route at its authoring speed

**Decision:** DEF-06 lands (PR #61). Clear All, deleting down to one waypoint, Undo, Redo and opening a one-waypoint project clear the route's path, branches, structure, pauses, beacons and waits, and resolve crowd anchors afresh; a route that comes back gets its timing back. Recovery, Save Project and the HTML export hold the route timed at its authoring speed, never times the playback rate, which is never saved. A constant-time duration a project opened with is kept until a rebuild replaces it.

**Rationale:** sixteen Codex rounds under the 2026-09-28 bar. The last, R16-A, found that accepted rejoins had no protection at a playback rate other than 1×; twelve cases now hold them (Preview and Edit, made and cleared, 2×, −2× and 0.5×), and a rejoin timed at the speed times the rate fails all twelve on their numbers. Codex's check under GATELESS-1 passed on `7b642d1`. Chromium, on a throwaway build of the branch: load, play, delete to one waypoint, Undo, Redo, Clear All and a fresh load clear and restore the route's derived state, with no console errors. Digest rule applied: house conventions → Testing and persistence. The found defects DEF-51, DEF-56 and DEF-60 no longer wait on it, and DEF-57 waits on DEF-42 alone.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — PLAN-1 — Phase 1 lands the big run's open pull requests, readiest first

**Decision:** Phase 1 lands the big run's 14 open pull requests one at a time, readiest first and DEF-06 first, since v3.2.693 ships the symptom it fixes; each finishes the round its last review asked for, then takes one Codex check under GATELESS-1. The run's 22 found defects wait in Next behind the item each names, whose harness their regression tests need.

**Items:** DEF-06, DEF-53, DEF-44, SPL-06, TST-13, DEF-42, TST-16, DEF-64, TST-14, TST-08, TST-05, DEF-45, TST-04, DEF-28

**Rationale:** the review (plan step 2) is of the open pull requests against GATELESS-1's order. Each one's last review asked for the following. Five reviews thought lost in the 2026-10-01 reboot had finished. Each item's file now holds its round to finish: the reviewed commit and the open findings, checked against the current head and brought into the record from the run's Codex logs.
- DEF-06, #61, r16: one coverage gap; an accepted-rejoin rate mutant passes every test but saves the wrong timing.
- DEF-53, #64, r11: one test gap; a deferred resize passes the tests but corrupts later frames when queued callbacks run.
- DEF-44, #71, r3: the idle claim's hole; an ordinary zoom-out renews eight invisible player frames.
- SPL-06, #75, r2: two test-assurance gaps; no build regression across 18 comparisons.
- TST-13, #69, r4: three surviving mutants (reassigned helper reads, escaped listener names, malformed numeric markup).
- DEF-42, #62: it waits on DEF-06, which changes the code it conflicts on; once DEF-06 lands, it merges `main` and resumes.
- TST-16, #76, r1: image bytes and history counts.
- DEF-64, #77, r1: a check that is not equivalent, plus topology and ownership gaps; a Chromium check is owed.
- TST-14, #74, r2: five gaps; the menu acts on the primary item, not the right-clicked one.
- TST-08, #73, r2: seven blocking, all still open on its head, which already parsed the syntax tree when reviewed; its item file lists them.
- TST-05, #72, r3: a lookup getter and payload summaries.
- DEF-45, #70, r3: a bounded announcement queue, uncommitted at the reboot; it conflicts with `main`.
- TST-04, #57, r8: an early-cached `addEventListener` bypasses the credit.
- DEF-28, #54, r11: three behaviour defects and surviving mutants; it conflicts with `main`, and a Chromium check is owed.
Readiest means fewest open findings first, with dependencies kept (DEF-42 after DEF-06, whose landing settles its conflict) and the other conflicts (#54, #70) and size last.

Each pull request merges current `main`, moves its `pm_skills/` record edits into `project/` and finishes its round from its review's report; earlier partial diffs and transcripts are reference only. Then GATELESS-1 conditions 4 to 7 apply. One that cannot be made sound in one round is closed with a note and re-planned as a small fresh item.

Findings answered: 14 pull requests unmerged; DEF-53 and DEF-64 had no backlog line, and both are now Phase 1 items with files; Next listed W4 before the defects that wait on their W5 test, against GATELESS-1's order, and now lists them first. None is deferred. Outside this phase and already lines in Next, in GATELESS-1's order: W5's TST-03, TST-09 and TST-11; the defects after their W5 test; W4; and the found defects DEF-50, 51, 54–58, 60, 62, 63 and 65–76, each with an item file and recorded under GATELESS-1's order to reconcile the backlog.

The session's calls, for the owner to confirm:
- this order;
- the found defects' short titles, with their detail in item files, to keep the backlog within its 1,000 words;
- " impl (gated)" dropped from 14 gated lines, whose group headings name the gate;
- DEF-76, TST-05's leg-speed note, recorded as a found defect behind DEF-42. Codex traced it read-only to a stale branch-timeline cache.

Codex reviews this plan before it executes.

**Supersedes:** none

**Deferred:** none

## 2026-10-05 — REL-693 — v3.2.693 ships everything merged since v3.2.692

**Decision:** v3.2.693 is live from deploy commit `1cc8d29` (tag `v3.2.693`), GATELESS-1's first release: it ships `main` at `73bf572`, the 40 commits merged since v3.2.692 (2026-09-24), most of them defect fixes, ahead of anything else landing, because the owner's prompt of 2026-10-05 says "Release main as it stands, before landing anything else."

**Rationale:** `DEV-INFRASTRUCTURE.md` → Releasing, in full, from `route-plotter/`. (1) A clean `main` equal to `origin/main` at `73bf572`; Pages source `main` `/docs`, latest build `built` at `73bf572`; that live SHA had no tag, so an annotated tag `rollback-v3.2.692-73bf572` was pushed at it (its `docs/` tree, `42da39f`, is v3.2.692's). (2) `npm run check` green (93 files, 1,566 tests, 2 todo); `npm run push:dry-run` clean. (3) `npm run push` committed `1cc8d29` "chore: deploy v3.2.693", which changes six files (five under `docs/`, and `version.json`) and leaves `docs/` holding 22. (4) Verify, the Pages build and its deploy green on `1cc8d29`. (5) The `github-pages` deployment at `1cc8d29`; all 22 published files SHA-256-identical to `docs/`; the live site ready ("Route Plotter v3.2.693", `app.ready` resolved, no console errors); the Open day route played (the hidden pane's frame loop driven by hand: four seconds of frames, 4,002 ms, waiting at its first pause) and exported as MP4 (1920×1080, 14 s, 5,031,356 bytes, `ftyp`, the size the candidate's export of it had) and as HTML (2,026,067 bytes, its CSP and the live `player.js` embedded byte for byte), both captured in the page. (6) No rollback. (7) Annotated tag `v3.2.693` at `1cc8d29`, pushed. Before the push, a candidate build of the same `main`, made in a separate copy (`~/route-plotter-bigrun/candidate-693/`) so the release checkout stayed unbuilt as step 2 requires, passed in Chromium: the three built-in examples load and play, and its HTML export, opened as a top-level page, renders and plays. Owed: saving the two live exports to disk, which waits for the owner's word (asked in chat on 2026-10-05; a wish-list line tracks it); the in-page checks stand meanwhile. The session's calls, for the owner to confirm: DEF-06's item says "Land it before the release", written for the 2026-09-28 plan's single release that GATELESS-1 replaced, so v3.2.693 ships the DEF-08 symptom DEF-06 fixes (a route cut to one waypoint draws its last marker, paused, at a stale grow scale) until DEF-06 lands and releases; the plan's 24 "unreleased" shipped markers now read "released in v3.2.693", and the trajectory's big-run heading says the same; the rollback tag's name, `rollback-v3.2.692-73bf572`, outside the `v*` version namespace; and this entry's ID, since the ledger has no release family.

**Supersedes:** none

**Deferred:** DEF-06

## 2026-10-05 — GATELESS-1 — The run goes gateless: each merge lands and ships as it goes, with Codex reviewing

**Decision:** the owner's words of 2026-10-05, "continue the dev in gateless fashion, commiting and deploying incrementally" and "using codex as project partner", are the advance grant the rules file asks for: Claude Code plans and executes the backlog, merges each pull request once CI Verify is green on its head after Codex's check as condition 5 sets out, and releases every merge that changes what ships, on the conditions in the Rationale; this replaces the big run's merge and release conditions of 2026-09-28.

**Rationale:** the conditions are the owner's prompt of 2026-10-05; quoted words are his, from it, unless marked otherwise.
1. Nothing waits for the owner's approval: the prompt is "my standing instruction to plan and execute (plan.md Step 5), my grant for merges and releases, and my word for tools/archive.mjs if the checker asks for an archive."
2. Where the record does not answer a question that rule 2 would put to the owner, the session takes "the narrowest, most conservative reading", says so in one line in the pull request, records it as its own call for the owner to confirm, "never as my decision", and has Codex check the call when it matters. Where no safe reading exists, "or only I can give what's needed (evidence, a dependency, a design call)", the item becomes a `[!]` backlog line with its blocker, listed for the owner, and the run moves on. Nothing else waits for the owner. Work stays "within the brief and the backlog: no new feature work."
3. Setup: "This chat must run from the PARM Maps Encore folder", the folder that holds `route-plotter/`; a chat opened inside `route-plotter/` gets the repository's sandbox, which "blocks Codex and your memory", so it tells the owner and stops. `route-plotter/` stays on a clean `main`, for merges and releases; every item and every Codex review gets its own worktree of it under `~/route-plotter-bigrun/`, with `node_modules` linked to `route-plotter/`'s; each branch is pushed after every commit, so GitHub is the backup. Overriding the rules file's Environment for the run: "Never write in my checkout, Route Plotter v3/."
4. Each item: a branch from current `main`, named for it; `npm run check` green with current `main` merged in; no test deleted, skipped or weakened; nothing under `docs/` and no `version.json` in the diff; a Chromium check wherever user-facing behaviour changed; closed by `verbs/close.md` and recorded in `project/`, never `pm_skills/`; committed, pushed and opened as a pull request. Up to three items in flight; gates, merges and releases one at a time.
5. Codex reviews the pull request's head read-only, as the profile's Handoff says, launched as the prompt gives it: `nohup ~/.local/bin/codex exec -m gpt-6-astra -c model_reasoning_effort=high -s read-only -C <worktree detached at the PR head> -o <summary.md> "<brief>" > <log> 2>&1 < /dev/null &`. "A review takes 10–40 minutes and survives a chat handover, so keep working meanwhile." It is briefed from the record as close step 6 says (the item's criteria, the diff against `main`, the rules file's Always and any routed document) and asked to falsify the change (defects, rule breaks, tests that do not test what they claim) and to rank its findings. Real findings are fixed, the gate re-runs and the fix is pushed; the rest are rebutted in the pull request body; advisories go to the wish-list. No further rounds, unless a fix is large; then one short pass on that fix alone. Codex also reviews each PLAN-N before it executes. If Codex cannot run, the `Checked:` line says so and the run carries on.
6. Merge once CI Verify is green on the head, by `gh pr merge N --squash --match-head-commit <sha>` with the `Checked:` line in the body, then delete the branch on the remote; every other branch merges the new `main` before its next push.
7. A merge that changes what ships (`src/`, `styles/`, `index.html`, assets or the build) is released by `DEV-INFRASTRUCTURE.md` → Releasing, in full, every time, from `route-plotter/`; a merge that touches only tests or the record is not. If a check after a release fails, the run rolls back as documented, opens a DEF item, fixes it next and releases nothing else until it is fixed. The browser pane is allowed for the whole run, including saving each release's smoke-test exports: a built-in example, from the live site, as MP4 and as HTML. If saving still needs the owner's word, the session asks in chat without stopping and records the export check as owed until he answers.
8. Order: this entry; then a release of `main` as it stands, everything merged since v3.2.692 (2026-09-24), before anything else lands; then the backlog reconciled (rule 5), with a line for DEF-53 and DEF-64 (both open pull requests) and for each defect the big run found, and `verbs/plan.md` run so that PLAN-1 lands the open pull requests, Codex reviewing it before it executes; then the 14 open pull requests (#54 to #77) one at a time, readiest first, each with `main` merged in, its `pm_skills/` record edits moved into `project/` and the round its last review asked for finished (earlier partial diffs and transcripts are "reference, not patches to apply blind"), then conditions 4 to 7, and one that cannot be made sound in one round is closed with a note and re-planned as a small fresh item; then the backlog in its order: W5, the defects runnable now, the defects that wait on their W5 test, then W4 (which keeps its own mutation criterion), with the found defects. "When nothing runnable is left, stop and report."
9. One line in chat after each merge and each release. Usage is checked after each item; no new agents start within about 40k of the profile's Session line (200k); in the run's second chat the owner asked, 2026-10-05, "can you raise the profile's 200k Session limit to 500k? if so, do for this chat", which the session reads as that chat alone running to 500k, the profile's 200k standing for every other chat (its call, for the owner to confirm). Past the line, the next close is the last (close → Session end), only Codex reviews stay in flight, the session rewrites its handoff (what is in flight and where, and the know-how the next chat needs; the record holds the rest) and asks the owner for a fresh chat with the same prompt.

It replaces, in the canon entry titled "2026-09-28 — the big run: Joe answers the open calls, and delegates merges and planned fixes" (frozen; `project/history.md` → Decision lookup), the standing merge authority and its bar (an independent review of every substantive change, each finding fixed or rebutted, a complete mutation table, goldens moved only as predicted), the single release at the run's end and the queue of the 2026-09-28 prompt. That entry's other calls stand: the planned defects and §20's defaults approved in advance, DEF-28's option A, TST-04 before W4 and W4's own mutation criterion, the budgets and the scope; so do the amended entry's answers, "fix defects along the way" (the owner, 2026-09-28) among them, and DEF-07 no longer waits for the owner. The canon entry cannot go on the Supersedes line, whose graph names only this ledger's headings. The ledger's own entry of 2026-10-03 does: for the run, item and review work moves into worktrees of the clone under `~/route-plotter-bigrun/` (condition 3), while the clone's place beside the owner's checkout, kept on the device, and `gh` outside the sandbox stand.

The session's calls, for the owner to confirm: the grant holds for the run, which stops and reports when nothing runnable is left, unless the owner ends it sooner; the brief's Direction and the rules file's Always, both owner-signed, still name the 2026-09-28 delegation and are left unedited, with a wish-list line for the refresh, and this entry governs where they differ; and the pull request is titled `PM:` as the prompt says, while its commits and squash subject carry this entry's ID, because `node tools/check.mjs --commit` accepts only a subject whose ID the ledger holds.

**Supersedes:** 2026-10-03 — V3-CONFIRM — The working clone sits beside the owner's checkout, kept on the device; gh runs outside the sandbox

**Deferred:** none

## 2026-10-03 — V3-CONFIRM — The working clone sits beside the owner's checkout, kept on the device; gh runs outside the sandbox

**Decision:** sessions work in the fresh clone `route-plotter/` beside the owner's OneDrive checkout, in the same folder, with OneDrive's Always Keep on This Device set on it, because the owner keeps the project's working copy with its other files; and `gh` runs outside the sandbox (`sandbox.excludedCommands`), so each `gh` call asks unless the owner pre-approves it.

**Rationale:** the owner's instruction of 2026-10-03: a fresh clone, but inside the project's OneDrive folder rather than elsewhere on the disk. The working setup in `DEV-INFRASTRUCTURE.md` said "outside OneDrive" because OneDrive can evict `.git` internals to online-only, and git then fails with `mmap failed: Operation timed out`; keeping the clone's folder on the device removes that cause, so the setup and the rules file now name the clone and the setting. The owner's checkout stays his: fast-forward only, when clean. The clone was made on 2026-10-03 from `main` at 662b2e2 with `npm ci`; `npm run check` passed there (93 test files, 1566 tests) and the session hook ran from its path. On `gh` (8ebaad9, #80): under the strict allowlist a sandboxed `gh` is refused, and with `api.github.com` added it fails TLS verification on macOS (x509 OSStatus -26276, the sandbox denies Go the system trust service); tested headless on Claude Code 2.1.267, an excluded `gh` reaches GitHub and a sandboxed `git push` authenticates. The owner chose this over `api.github.com` plus `enableWeakerNetworkIsolation`, which keeps `gh` sandboxed but which the client marks as reduced security.

**Supersedes:** none

## 2026-10-02 — V3-CONFIRM — The owner signs the ledger, confirms Network and Handoff, installs the session hooks

**Decision:** the profile, brief and rules carry the owner's reviewed signature of 2026-10-02 in place of the delegated lines; the Network line (listed hosts github.com, registry.npmjs.org) and the Handoff split (Claude Code executes; Codex reviews read-only) are confirmed and lose their `[guess]`; `.claude/settings.json` and `.claude/settings.intake.json` are committed from `tools/harness.mjs`, with the two session hooks, and `.gitignore` admits those two files — because the owner answered the three open intake questions on 2026-10-02 ("sign both now", the recommended Network and Handoff, "install Claude Code side in both").

**Rationale:** the owner's answers, given in chat on 2026-10-02 after the merge. Two edits to the generated settings, reviewed on his behalf and recorded here: the home directory is written as `~/` rather than an absolute path, since this repository is public; and the denies on `gh`, `git fetch` and `git pull` are removed, since github.com is a listed host and the project's own rules require `gh` for every pull request and a fetch to keep a clone current. The Codex profile is not installed: the lab found the generated profile fails to start a session on Codex 0.155.1, so that side waits for a verified generator. The hooks run only where the client runs them; the first attended session should confirm with `/hooks` that the two SessionStart and PostToolUse hooks are loaded. `[guess]` stays on "Prose: en-GB", which the owner has not addressed. This change lands by pull request under the owner's instruction of 2026-10-02 to progress both projects to full v3 now.

**Supersedes:** none

**Deferred:** none

## 2026-10-01 — INTAKE — Route Plotter adopts pm-next v3 from canon 4.7.0

**Decision:** the project's contract, verbs and tools are pm-next v3's (PM-Skills-lab commit 155f145), the ledger under `project/` is written from the canon record at 75ba7ae — Direction and the full brief from the brief, the rules file from `AGENTS.md` with `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the dev guide and the abstraction plan kept in place and routed, the architecture carried as a routed file and the conventions as a house digest, every open item as a backlog line with an item file holding its canon text verbatim, every wish line carried — and the canon record under `pm_skills/` is frozen in place, pinned by `project/migration/inventory.json`, because the maintainer named this project for the lab's V3-FIELD on 2026-10-01 and v3's intake verb is the route for a canon project.

**Rationale:** the maintainer's word of 2026-10-01 ("V3-FIELD with uon video helper and route plotter"); the lab's item is V3-FIELD-2 and the pre-registration row is in the lab's V2-FIELD-1 record. Inventory: `project/migration/inventory.json` at the snapshot commit 75ba7ae, written by the lab's `lab/tools/migrate-canon.mjs`; census: `project/migration/census.md`, 499 rows from seven sources — the canon `AGENTS.md`, `CLAUDE.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`, the brief, the conventions and the architecture; the source list was closed by reading the canon contract, its two rulebooks, the three hot memory files it names, the README (product description, no rule), the one ticket (its obligations are its own item's criteria, carried into the item file, not standing rules) and the big run's two decisions of 2026-09-28, whose standing delegation is cited from the rules file and the Direction, never restated; every row was read in its destination's context by this session and, read-only, by Codex Astra, whose twelve findings — a dropped search obligation, a lost scope exclusion, document-maintenance rules and a harness tip retired as machinery, the refactor contract and the W4 group condition uncarried, a close-out read and a watcher-stop step lost, two additions without a source, a contradictory claim on the Network line, the item schema file missing, stale references — were each repaired before the push (the lab's V3-FIELD-2 item). Where each obligation went: the hard rules, the commit-push-release rules, the protected paths and the owner's archive rule to the rules file's Always; the read tiers, workflow, memory budgets, document ownership and framework section aliases retired as canon machinery, replaced by v3's rule 1, the verbs and the checker; the engineering rules (minimal change, documentation, testing and persistence) and the conventions to the house digest; the rulebook rules to their kept files, routed by task; the brief to the full brief, summarised by Direction, with the owner's pending format-9 confirmation as its open question. The canon framework files beside the record stay frozen with it: nothing routes to them, and a retire is a wish line. The Push line keeps the project's own route — the working branch with a pull request, never `main` — which v3's harness-push default admits as the project's origin. What the tool cannot establish, and this session does not claim: that the source list is complete, that each destination keeps its obligation's force; the owner has not yet confirmed the Network line or reviewed the signatures — both are proposals until he does. Settings: `tools/harness.mjs` output recorded in the lab's raw-evidence lane, nothing written into the tree; the two session hooks are offered, installed only on the owner's word. The Network line and the Handoff split are proposed from recorded practice and marked `[guess]`; the three signatures are delegated under the instruction to run V3-FIELD and name it, the owner's reviewed lines due within two weeks (3.8). Known hazard, recorded: the big run was live at migration time with ten open pull requests (#64, #69–#77) whose closes write the canon memory; this migration lands as a pull request the owner merges when the run allows, and any canon write after the snapshot is a reconciliation against the inventory, never a loss. The migration commit carries no product work; its one gate-plumbing edit is the line above.

- Migration edit: package.json — re-applied — `check` ends with `node tools/check.mjs`, so the gate and the Verify workflow run the v3 checker
- Migration edit: AGENTS.md — retired — replaced by v3's contract verbatim; every canon obligation routed by the census
- Migration edit: CLAUDE.md — retired — v3's adapter; its guidance moved to the profile's Harness line and the rules file's Environment

**Supersedes:** none

**Deferred:** none
