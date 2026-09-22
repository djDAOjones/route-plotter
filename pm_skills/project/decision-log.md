# Decision Log

<!-- Append new decisions at the top. Don't edit old entries. -->

## 2026-09-22 — W0 closes: no accidental release, and docs that match the code

**Owner calls this wave.** Merges are squash merges, keeping the
`<ITEM-ID>: summary` title; the agent runs each merge only on the owner's
word. No "Protected infrastructure" list: the owner merges every change
anyway. DEF-18's stated new behaviour was approved, including the two typo
routes the plan row missed and the trade-off that `yes=false` in an npm
config makes `npm run push` refuse. Merges and releases are separate calls:
a pull request per concern, and the owner calls each release.

**Each PR and what it preserved** (all text-only except #2; `docs/`,
`version.json` and `src/` unchanged; live bytes still v3.2.690, 22/22 by
SHA-256):

- #1 DOC-06 (a): the `AGENTS.md` branch-and-release rule. No runtime change.
- #2 DEF-18: refuses unknown options, npm settings resembling a dry run, and
  `-n`; reads `dry_run` case-insensitively; runs `npm run check`.
  Preserved: every documented push and dry-run form, the clean-tree gate, the
  generated-path allowlist, argv safety. +6 tests, each failing on the old
  helper; the shared test helper now drops inherited npm settings.
- #3 DOC-06 (b)–(f): Quality gate, 12 framework aliases, the refactor-mode,
  re-pointing, boot-check and prune-bar clauses.
- #4 GOV-01: working setup and eight release steps.
- #5 DOC-02: SEG-030 items 1–14 all closed (item 8 by #3, item 13 earlier).
- #6 DOC-03: the Q15 rule in `AGENTS.md`, `architecture.md` and
  `conventions.md`, with its exceptions listed.

Codex (`gpt-6-astra`) reviewed every PR adversarially and changed five of
them, including two blockers in GOV-01 and two in DOC-03.

**Plan rows patched, with dated notes:** DEF-18 (wider refusal),
DOC-06 (all 12 references, not 3–4), GOV-01 (a branch per concern; releases
called separately), DOC-02, DOC-03, and W0's status.

**Owner call, same day:** the two exceptions DOC-03 found — NetworkEditService
editing the model while only bound for inspection, and AreaEditService calling
an app-supplied coordinate callback — belong to **CON-01** (W9), which already
removes UIController's writes. The plan row and `architecture.md` say so. Also logged as
ideas: `restart.sh` proves only that the server answers; `serve` is broken;
CI could refuse a pull request that touches `docs/`.

**Metrics against the §18 baseline:** open defects 33 → 32; doc
contradictions 13 → 0 known; dangling framework references 12 → 0; tests
1,065 → 1,071 across 72 files. Unchanged: about 46 dead functions, 47
functions over 100 lines, 0 render goldens, 5 source-text test sites, 52 of
77 orchestrator events never exercised.

**Noted:** rapid merges make the Pages builds API report the superseded
builds as "errored"; they are cancelled runs. Check the build for the SHA you
care about. This entry makes the log 22/20: reported under the prune bar, not
pruned.

**Link:** DOC-06, DEF-18, GOV-01, DOC-02, DOC-03; PRs #1–#6; plan §12, §13, §18.

## 2026-09-22 — adopt the codebase abstraction plan, on every recommended default

**Owner's call: all 22 recommended defaults in the plan's §20 are accepted**,
in their words: "agree with all recommendations". The plan is a two-round
Claude (Opus 5) and Codex (`gpt-6-astra`) review at `2e4d78e`: 111 items (33
behaviour defects, each still needing approval of its stated new behaviour,
and 78 behaviour-preserving refactors) in waves W0–W12. Per Q20 it now lives
at `reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md`, and its
§20 is the answer sheet. The answers that shape how the work runs:

- **Q1/Q2 — where work lands.** Every wave runs on a short-lived branch from
  `main`, in a fresh clone outside OneDrive; merges reach `main` in small
  batches, each a tagged release. DOC-06 (a) writes this into `AGENTS.md`
  first, because without it `task.md` step 11 commits and pushes every close
  onto the live `main`.
- **Q8 — tests that pin dead code** are deleted with it, one entry here per
  batch naming each test and symbol. A test that uses a dead symbol inside a
  live assertion is rewritten with its assertions kept. Re-pointing an import
  when code moves is not weakening a test.
- **Q15 — the communication rule** becomes: components reach the app through
  the bus; the app calls components through named public methods; modal tools
  make provisional edits and commit them through events. DOC-03 rewrites it in
  `AGENTS.md`, `architecture.md` and `conventions.md` together.

**How the programme runs in memory** (DOC-06 (i), (j)). Backlog `### Next`
holds only the current wave, W0 now; the next wave enters from the plan's §13
when this one closes. This log gets one entry per wave, listing each PR's
preserved contract, not one per PR, so a programme of about 100 PRs does not
churn it. This entry makes the log 21/20: a note under the prune bar, not a
prune trigger.

**Supersedes** the merge-hold half of "2026-08-27 — owner sets the prune bar,
and holds the merge", which the v3.2.690 release had already overtaken. Its
prune bar stands, and outranks the plan's own budget remarks.

**Memory changes made with this entry** (DOC-06 (g), (h)): `file-map.md` is
marked hand-maintained, because its generator keeps only the first line of
each row, and its counts are corrected; `conventions.md` now gives the commit
format, verify line and gate this repository actually uses; the trajectory and
wish-list headers name the current prompts; and the wish-list's
Duration-slider idea is cut, as it is now the plan's DEF-20.

**Link:** DOC-06, DEF-18, GOV-01, DOC-02, DOC-03; plan §2.9, §12, §13, §20.

## 2026-09-22 — memory prune: the Phase 5 build-out goes cold

Maintenance Diagnose flagged the decision-log at 30 live entries (budget 20)
and the trajectory at 2,535 words (budget 2,000). Pruned losslessly
(diff-verified; independently re-verified by Codex `gpt-6-astra`): 11 of the
19 2026-08-27 entries moved to `archive/decision-log-2026-08-27-to-2026-08-27.md`,
and the trajectory's 2026-08-26 → 08-27 build-out sections to
`archive/trajectory/trajectory-0003-2026-08-26-to-2026-08-27.md` (live
trajectory 1,021 words). **Owner's call: the log stops at 20/20, not the
prune-to 14,** under the prune bar. The accessibility audit is REV-05's
original evidence boundary, and the log archives oldest-first, so the five
newer entries that day stay with it. ROUTE-01d ("the exported player inherits
branches…") and ROUTE-01b ("a branch borrows the trunk's transport…") also stay
live, out of age order, because the codebase abstraction plan cites them as
evidence for its pending work. Both files stay date-ordered and verbatim.
Also corrected the INDEX's June count (19 entries, not 14). **Not added to
`file-map.md`:** its generator ignores `pm_skills/` and lists any hand-added
archive row as "no longer on disk" (tested first).

**Two owner calls from the audit.** Reduced-motion emulation returns to
REV-05's residual: the audit above listed it as not claimed, but it left the
residual at `24e650c` with no recorded call. REV-03's physical pass now names
the branch "+" handle tap (COMPOSE-04), as a test of the shipped gesture, not
a reopening of its design.

## 2026-09-22 — main is protected against force-push and deletion (REL-02)

**Owner's call, on the recommended option.** Main is now what Pages serves, so
rewriting or deleting it would take the public site with it. A repository
ruleset ("Protect main — no force-push or deletion (REL-02)", id 23814820)
blocks exactly `deletion` and `non_fast_forward` on `refs/heads/main`, with
**no bypass actors** — it binds pushes made with the owner's admin credentials
too, which is how agents push. Required status checks were declined: GitHub
rejects direct pushes to a branch that requires them, which would break the
documented `npm run push` pipeline.

Verified through GitHub's effective-rules API for `main`, not by attempting a
force-push: if the rule had failed, that test would have rewound the live site.
Rollback therefore never force-pushes main — see DEV-INFRASTRUCTURE →
Deployment.

**Link:** REL-02 (shipped), DEPLOY-01.

## 2026-09-22 — v3.2.690 released from main, verified by bytes not titles

**DEPLOY-01, REL-01 and LEGAL-01 closed on the owner's approval**, in their
words: "proceed approved with DEPLOY-01 and REL-01 and LEGAL-01. use codex astra
as a partner to check approach". Codex (`gpt-6-astra`, read-only sandbox)
reviewed the plan before anything public changed, and changed it: a revert of
the merge alone would not restore matching artefacts, so the live build was
tagged `v3.2.689` first as a pinned rollback point; `push.js` runs only
`npm test`, so Pages waited for CI on the exact deploy SHA; and it found the
LEGAL-01 gap below. It judged the Pages switch within the DEPLOY-01 approval.

**Run from a fresh clone, not the working copy.** OneDrive had evicted 129 of
354 tracked files and 1,241 of 2,142 files under `.git` to online-only, and
`git log` failed with `mmap failed: Operation timed out`. A release that
stalls mid-merge is worse than a stale working copy, so it ran from a clean
local clone and pushed from there.

**Sequence, each step verified before the next:** `v3.2.689` tag on
`587f90a` → `git merge --no-ff` (`35de7d5`) → LEGAL-01 fix (`4e5575d`) → full
gate → cold boot → `npm run push` on main (`caea691`, v3.2.690) → CI Verify
green on `caea691` → Pages source switched to main. **The API switch did not
trigger a build** — none appeared in 400 s — so a build was requested with
`POST /pages/builds`; the deployment then succeeded with the `github-pages`
environment at `caea691`. Every published file matched the build by SHA-256.
On the live site the `uon-open-day` example loads, its MP4 export plays
(decoded frame at 6 s, 1280×720, 15.73 s = the 13.73 s timeline plus the
deliberate 2 s `START_BUFFER_MS`), and its standalone HTML export — rebuilt
byte-for-byte from the live blob's SHA-256 — boots and plays.

**REL-01: keep the source map.** The repository is public, so it hides nothing,
and it lets production be debugged against the exact bundle. Stated with
Codex's qualifications: browsers fetch it only when devtools are open, not on
ordinary page loads; readable traces still need tooling that uses it; and git
does not grow by a full 3.3 MB per deploy. It is not counted towards MPL
compliance.

**LEGAL-01: a technical-completeness fix, not a legal verdict.** Mediabunny
(MPL-2.0) ships minified in `docs/app.js`, but the notices and licence were
never published — absent from the build allowlist — and the bundle's licence
comment points only at the licence text. They now ship as
`THIRD_PARTY_NOTICES.txt` and `LICENSE.txt` (plain text because Pages runs
Jekyll), linked from Help; mediabunny's source is pinned to tag `v1.55.3`,
commit `16f8889e`, verified to be the npm package's own `gitHead`, bundled
unmodified. The owner's confirmation is recorded above as given.

**Branch protection: inspected, not changed.** Main has none and the repo has
no rulesets; that is REL-02, the owner's call.

**Link:** DEPLOY-01, REL-01, LEGAL-01 (all shipped), REL-02.

## 2026-09-22 — the merge hold never held: Pages served the branch from 08-26

**A correction to 2026-08-27**, appended rather than edited. That entry
recorded "the live site stays on v3.2.618 until the owner calls the release".
It was already false. Pages build history shows `main` commits built up to
2026-08-19 (`cec0191`, v3.2.618) and the first branch-only build at
2026-08-26T14:33Z (`c1b73d8`): the Pages source had been switched to
`review-remediation`, and every push from then on deployed publicly.

**This programme's own reporting repeated it.** The 2026-08-28 session said
"nothing on this branch is live" after checking git refs but never the Pages
source — the one setting that decides what is served. The consequence worth
owning: BUG-01, the export crash on the shipped `uon-open-day` example, was
live from the DEMO-01 build (~15:00 UTC 2026-08-27) until its fix deployed at
~23:32 UTC. Everything else shipped then was verified, and went live sooner
than anyone believed.

**How it happened without anyone doing anything wrong.** `push.js` ends by
saying "Select this branch and /docs in GitHub Pages settings when ready", and
DEV-INFRASTRUCTURE permitted selecting a review branch "for a Pages preview".
Selecting it was a documented step; nothing recorded that it had been taken.

**The durable rule:** what is live is whatever the Pages source and its latest
build say — `gh api repos/djDAOjones/route-plotter/pages` and
`…/pages/builds/latest` — never an inference from git refs. DEV-INFRASTRUCTURE
→ Deployment now says so. The owner's hold was a good-faith decision; this
corrects the fact beneath it, not the decision.

**Link:** DEPLOY-01, BUG-01, 2026-08-27 "owner sets the prune bar, and holds the
merge".

## 2026-08-28 — a benchmark with no threshold, and the restore that wasn't

**ICE-03 shipped as a harness, not a gate**, on the owner's call. A committed
frame-time threshold would pass on one machine and fail on another with
identical code, and a red that means nothing is worse than no check at all. So
`scripts/perf-harness.js` prints the cost curve on demand and asserts nothing
about timings; you compare your own before and after. It reproduced PERF-01's
figures on re-run (2,000 waypoints: 65.2 ms against 64.6 ms measured by hand),
which is the point — the numbers move a little run to run, which is exactly
why none of them is committed as a threshold.

**Its first version destroyed the project it was protecting.** The harness
backed up the autosave and restored it in a `finally` — and the still-running
app then autosaved the synthetic 2,000-waypoint benchmark project straight
over the restore. Caught because the restore was *verified* after a reload
rather than assumed; the scratch project on the dev server was lost and had to
be rebuilt from the shipped `uon-open-day` example, which it had come from.

The fix is not a bigger backup: autosave is **suppressed for the rest of the
page's life**, so the synthetic projects can never reach storage at all, and
the closing warning insists on a reload. Verified by running a destructive
benchmark and confirming the project survived a reload intact. The regression
test pins the suppression, its ordering before the restore, that nothing puts
the real `autoSave` back, and that the `finally` exists — the safety contract,
not the speed.

**What the test does and does not judge.** It guards the ways a console tool
silently rots — it still loads, exposes one entry point, refuses clearly with
no app and with no project — and pins the safety behaviour. It asserts nothing
about milliseconds, and asserts that the harness carries no threshold, so a
future well-meaning addition of one has to be a deliberate conversation.

**Link:** ICE-03 (shipped), PERF-01 (its baseline), REV-07 (icebox).

## 2026-08-28 — the ceiling is waypoints; crowds and image size are not it

**PERF-01 measured rather than agreed**, per the owner's call: profile a range
and read the ceiling off the data. Measured in production Chromium at a fixed
1280x720 render surface, median and p95 of `render()` over 25 deterministic
timeline instants — the same pure evaluation play, scrub and export share, so
the numbers are not a sampling artefact.

**Waypoint count is the only dimension that costs real frame time.**

| Waypoints | Path points | Median | p95 | Verdict |
| --- | --- | --- | --- | --- |
| 5-50 | 451-4,902 | 0.2-0.6 ms | <1 ms | free |
| 100 | 9,902 | 1.2 ms | 1.6 ms | free |
| 200 | 19,902 | 1.8 ms | 3.3 ms | comfortable |
| 500 | 49,902 | 6.4 ms | 15.6 ms | borderline |
| 1,000 | 99,902 | 18.1 ms | 51.7 ms | not interactive |
| 2,000 (the enforced limit) | 199,902 | 64.6 ms | 222 ms | unusable |

**Crowd size is close to free.** Holding a 12-waypoint route, 5,000 dots — the
per-emitter maximum — costs 1.2 ms median against 0.3 ms for none. The whole
range from 0 to the limit spans about one millisecond.

**Image resolution costs no frame time at all.** 1 MP and 48 MP both render in
0.3 ms: the destination surface is fixed, so the downscale is effectively
constant-cost. What a large image costs is *memory and import*, not rendering
— 48 MP is 183 MiB decoded. Worth saying plainly, because the admission limits
(48 MP / 40 MiB) read like performance limits and are not.

**Combined profiles**, each with route, crowd and image together:

| Profile | Waypoints | Dots | Image | Median | p95 | Holds 60fps |
| --- | --- | --- | --- | --- | --- | --- |
| Small | 8 | 100 | 1 MP | 0.3 ms | 0.6 ms | yes |
| Typical | 25 | 500 | 4 MP | 0.7 ms | 1.0 ms | yes |
| Large | 100 | 2,000 | 12 MP | 1.5 ms | 2.5 ms | yes |
| Extreme | 500 | 5,000 | 24 MP | 7.4 ms | 18.4 ms | no |
| At every limit | 2,000 | 5,000 | 48 MP | 75.8 ms | 210 ms | no |

**What the data says the ceiling is.** Expressed as "stays interactive at
60fps including p95": comfortably **200 waypoints**, borderline at 500, gone by
1,000. Crowd size and image resolution should not appear in a stated ceiling at
all — neither is the binding constraint. The enforced `MAX_WAYPOINTS` of 2,000
is roughly ten times the comfortable figure; that is a *safety* bound against
hostile input (RP-09), and this measurement does not argue for lowering it, but
it does mean the UI limit was never a performance statement.

**Caveats, stated rather than buried.** One machine, one browser, one surface
size; a larger canvas or a slower machine moves every number. Render cost is
not export cost — export adds encoding per frame. These are the figures to
re-run against, not universal constants, which is exactly what ICE-03 exists
to make repeatable; its stated trigger ("alongside PERF-01") has now fired.

**Link:** PERF-01 (shipped), ICE-03 (promoted), RP-09.

## 2026-08-28 — a label the author placed is never moved out from under them

**LABEL-01 shipped.** The owner's judgement was that auto-position itself works
well; what was wrong was *when* it ran and how findable it was. Three contracts
came out of that, and they pull against each other, so each is pinned:

- **It runs when a label is first written.** A new label starts at the default
  offset, which frequently sits under its own marker — written, then invisible.
  It is placed the moment it first has text.
- **It never runs again once the author has placed the label.** A new persisted
  `labelPlacedByHand` flag is set by the offset sliders, the only route by
  which a label can be moved by hand. Absent on older saves, which restore as
  *not* placed — so they stay eligible rather than being frozen where they are.
  It is deliberately excluded from the style-propagation lists: where a label
  sits is per-waypoint authoring state, not a style to apply onward.
- **Asking for it explicitly always works.** The button ignores the flag. Being
  asked for is not the same as happening to you, and the distinction is the
  whole reason the flag can be safe.

**The offer fires on collision, which is the owner's change to the ticket.**
The original plan prompted on first write; the owner moved it to "when a
collision is detected", which is better — a prompt on every first label is
noise, and a collision is the moment the offer is actually worth making. It is
checked when the text is *committed*, not per keystroke: only then does the
box have its final size. `collidesAtCurrentPosition` reuses the very scoring
auto-position optimises against, so "colliding" means exactly what
auto-position would try to escape.

**The prompt reuses the existing toast rather than inventing a component**,
gaining one optional action button. That keeps it in the established polite
live region and out of the focus order. It is an offer that fades, so it is
never the only route: the button now sits in the Label card's primary tier,
which is the other half of the owner's call. Four primary controls is the top
of the 2-4 budget, and the tier guard in `reviewAccessibility.test.js` was
updated to say so — the old expectation encoded a design decision the owner has
now overridden, so the expectation moved rather than the check being weakened.

**Evidence.** Verified live in Chromium: a first write moves the label off the
default; dragging an offset slider sets the flag; rewriting the label
afterwards leaves it exactly where the author put it; a colliding label raises
one toast whose 44px action actually re-places it; a label that fits raises
nothing. The example ZIPs changed because `Waypoint.toJSON` now carries the
flag. The working project was backed up and restored byte-for-byte.

**Link:** LABEL-01 (shipped), UI-01 (tier budget), REV-05.

## 2026-08-28 — the reveal fades on a trail, and the hard edge was invisible

**REVEAL-01 shipped as an authorable property**, per the owner's call. The
mask still repaints every passed path point on every frame — that full rebuild
is precisely what makes scrubbing bidirectional — but each point is now
weighted by how far behind the head it sits.

- **Weighted as a fraction of the whole path**, not a point count, so the fade
  reads identically whatever the path's length or point density. A test pins
  that a sparse path and a dense one fade the same.
- **A pure function of position, never an accumulated decay.** Tested by
  arriving at the same instant forwards and backwards and demanding the same
  answer. An accumulator would have broken scrubbing and split preview from
  export.
- **`revealTrail` = 100 is a sentinel meaning "never fades"**, and it is the
  default, so every project authored before this control existed renders
  exactly as it did. That rule lives in `revealTrailAlpha` rather than in its
  caller: the caller keeps only a fast path that skips per-point work. Putting
  one copy of a rule in two places is what caused BUG-01 the same day.
- **The snapshot defaults the value rather than copying it through.** A caller
  whose live settings predate the property would otherwise write an explicit
  `undefined`, which the snapshot validator reads as present-but-invalid and
  refuses to load. The persistence suite caught exactly that.

**The reveal sliders were never synced on load.** A restored project rendered
its authored spotlight size and feather while the sliders sat at their markup
defaults, and the spotlight controls stayed hidden until the mode dropdown was
touched. Adding a third unsynced control would have compounded that, so
`syncRevealControls` now places all three and their containers at load.

**BUG-02, found while verifying REVEAL-01 in the browser: the default feather
made the spotlight invisible.** A radial gradient whose two radii are equal
paints nothing, and `SPOTLIGHT_FEATHER_DEFAULT` is 0 — so `innerRadius`
equalled `radius` and every new project's spotlight, in both the accumulating
and non-accumulating modes, rendered *nothing at all*. Measured in Chromium:
peak mask alpha 0 at feather 0, 255 at feather 1. This mattered beyond its own
severity — an owner switching on the reveal to try REVEAL-01 would have seen a
blank canvas and concluded the new feature was broken. The inner circle is now
kept a sub-pixel inside the outer one, so a zero feather is the hard edge the
default always claimed to be, shared by both call sites.

**Evidence.** In Chromium at the shipped default feather: no-fade paints the
whole travelled path (alpha 255 at start, middle and head); a 50% trail gives
255 at the head, 129 mid-path, 0 at the start; a 20% trail gives 255 only near
the head. The control shows for spotlight-reveal, hides for plain spotlight,
and carries `aria-valuetext` in step with its readout — the slider runs a log2
scale, so its raw position would mean nothing announced.

**Link:** REVEAL-01 (shipped), BUG-02, BUG-01 (same one-rule-two-places
lesson), REV-04.

## 2026-08-28 — four owner calls set the shape of the remaining work

With everything decision-free shipped, the rest of the queue needed the owner.
All four answered, and two changed the ticket rather than merely unblocking it.

- **REVEAL-01 — authorable, not a constant.** The fade behind the head is a
  per-project value the author sets, so this is no longer "pick a good default
  and ship": it needs a persisted property (default, `toJSON`/`fromJSON`,
  snapshot inclusion, restore, round-trip test) and a Reveal control, and the
  exported player has to honour it too.
- **LABEL-01 — promote the button, and prompt on collision.** The owner moved
  the nudge's trigger: not "when a label is first written" but *when a label
  actually collides with something*. That is the moment the offer is worth
  making; a prompt on every first label would be noise. The control itself
  moves up into the Label card's primary tier rather than staying behind
  `More`.
- **PERF-01 — a curve, not a ceiling.** Rather than agreeing a maximum and
  measuring it, profile small/typical/large/extreme and deliver the cost curve,
  so the supported ceiling is read from data. This inverts the ticket: the
  number is the output, not the input.
- **REL-01 — decide at release.** The source-map question is carried into
  DEPLOY-01 rather than settled now, so REL-01 stops being a runnable sign-off
  and becomes blocked on the same call.

**Link:** REVEAL-01, LABEL-01, PERF-01, REL-01, DEPLOY-01.

## 2026-08-28 — three upgrades taken, one refused on the Node floor

**DEPS-01 shipped.** Every direct dependency was checked against the registry,
not against the ticket's remembered numbers, and each upgrade was gated
separately rather than as one batch.

- **vitest 4.1.10 -> 4.1.11** (dev, patch). Green.
- **mediabunny 1.55.3** (runtime, patch). Its 1.55.2/1.55.3 notes are entirely
  demux-side — ISOBMFF Annex B, encrypted-file `tenc` fallback, HLS `emsg`
  segments, `AacAudioSpecificConfig` — plus a custom-Promise compatibility fix.
  None of it touches the video-only mux path this app uses, which never
  demuxes and exports no audio. Re-verified anyway, and that re-verification
  is what turned up BUG-01.
- **jsdom 27.4.0 -> 29.1.1** (dev, two majors). The 28 resource-loading
  overhaul and the 29 CSSOM rewrite both have zero surface here: nothing in
  the suite configures a `ResourceLoader` or reads CSSOM — the CSS tests read
  file text. Green across all 1033 tests, and it *removed* five transitive
  packages (157 -> 152) as jsdom replaced legacy CSSOM dependencies.
- **jszip, esbuild, axe-core** are already at latest.

**jsdom 30 is deliberately not taken.** It requires Node
`^22.22.2 || ^24.15.0 || >=26.0.0`; this checkout runs Node 24.5.0, which does
not satisfy `^24.15.0`. The manifest would not need to change — `engines` is
already `>=24.0.0 <25` and `.nvmrc` is just `24` — only the developer's
installed Node would. That is a toolchain call for the owner, not something to
take silently as part of a dependency pass. Recorded on the wish-list.

**A stale registry read is worth noting for the next pass:** `npm outdated`
reported jsdom's latest as 29.1.1, while `npm view jsdom dist-tags` said
30.0.1. The per-package check is the one to trust.

**The governance guard did its job.** The dependency ledger in
`governance.test.js` and the table in `THIRD_PARTY_NOTICES.md` both pin exact
versions, and the first upgrade failed the gate until both were updated —
which is the point of the ledger. Licences were re-read from the lockfile
rather than assumed: vitest MIT, mediabunny MPL-2.0, jsdom MIT, unchanged.
`npm audit` remains clean at 0 vulnerabilities.

**One side effect worth seeing:** `npm install mediabunny@1.55.3` tightened its
declared range from `^1.39.2` to `^1.55.3`. That is an improvement — the range
now records the version actually tested — but it was npm's doing, not a
deliberate choice, so it is stated rather than buried.

**Link:** DEPS-01 (shipped), LEGAL-01 (same MPL versions), REV-07 (icebox —
would automate this pass).

## 2026-08-28 — a branch run must not read the trunk's wait index

**Found while re-verifying export for DEPS-01, not by looking for it.** The
ticket asks for an export re-verification after the mediabunny bump; the
export threw instead — `Cannot read properties of undefined (reading 'imgX')`
— on the autosaved branched project. Video export was broken outright for
that shape, and scrubbing to the end of the timeline threw the same way.

**Not caused by this session.** The only app source touched here was
`ParamTooltip.js` and two stylesheets; `RenderingService.js` was untouched
since the handover baseline. Confirmed by diff before diagnosing further, so
the bump was never a suspect.

**Root cause, caught live rather than reasoned about.** Instrumenting
`getHeadDirection` in the browser showed the failing call receiving a
three-waypoint array — `Trent Building, Sports fields, Library`, the *branch
run* — while `animationEngine.state.pauseWaypointIndex` was `4`, an index into
the whole six-waypoint route. `waypoints[4]` was `undefined`, and the guard
checked only `waypoints.length > 1`, never that the index was in range.

**The fix has an in-repo precedent, which is why it is a one-liner and not a
redesign.** `MotionVisibilityService` performs the identical calculation and
already guards it with `pauseWaypointIndex < waypoints.length`; the renderer's
copy — written explicitly to match it ("same as AOV") — simply missed that
clause. Out of range means the wait belongs to another run, so the run falls
through to its own path-based direction, exactly as the AOV path does. The
comment says why the bounds check is load-bearing rather than defensive, so it
does not get "simplified" away later.

**Evidence.** A unit test reproduces the crash from the observed shape (a
three-waypoint run with the wait at index 4) and pins the fall-through, plus
two tests that the guard does not disable the behaviour it protects — an
in-range wait still steers waypoint-to-waypoint. In Chromium after the fix,
export produces a valid 1.78 MB MP4 (`ftyp isom`) and a valid 3.70 MB WebM
(EBML magic) with nothing thrown. Nothing was written to disk: the blob was
captured at `URL.createObjectURL` and the anchor click swallowed.

**Link:** DEPS-01 (whose verification surfaced it), ROUTE-01b, REV-04.

## 2026-08-28 — forced colours removes every focus ring, so outline carries it

**A11Y-02 shipped, and it was worse than the ticket knew.** The ticket listed
selection accent bars, focus rings, the leg "+" and beacon colours as lacking
`forced-colors` fallbacks. Reading the stylesheet turned the middle item from
a gap into a defect: forced-colours modes set `box-shadow` to none, and every
focus ring in this project is a box-shadow drawn over `outline:none` — 22 of
them in `main.css` alone, plus the dropdown, context-menu and swatch rings.
In high contrast a keyboard user had **no visible focus anywhere**.

**One global block restores it,** because `outline` *is* repainted with system
colours while box-shadow is not. It carries `!important` on the outline itself:
the per-component rules that zero the outline are more specific than any
selector this block could reasonably wear, and in this mode a single
consistent system ring is the goal rather than the app's layered blue one.

**A second, quieter defect fell out of the same read.** `var(--focus)` is not
a token anywhere in the project, so `.waypoint-rename-input:focus-visible`
resolved to `box-shadow: none` — the inline rename input had no focus ring at
all, in *any* colour mode, because an invalid custom property does not fall
back to the cascade. The bespoke override is deleted and the input takes the
universal ring like every other input. Proved both ways in the live browser:
re-inserting the old rule returns `none`, removing it returns the two-layer
white/blue ring.

**Two deliberate non-fixes, both recorded in UI-STANDARDS rather than worked
around.** The **map canvas** is content: forced colours does not repaint it,
and neither do we — the Okabe-Ito palette, the hovered leg, its "+" handle and
the beacons stay as authored and stay legible against each other. Repainting
them to system colours would destroy the colour-blind-safe palette that exists
for these very users. **Colour swatches** take `forced-color-adjust: none`,
the sanctioned colour-picker case: the chip *is* the value, and one flattened
system colour leaves nothing to choose from.

**What is and is not evidenced.** The rules are proved to ship and parse in
the live stylesheet — a bad system-colour keyword would simply not be there —
and the ring fix is measured live. How they *look* under a real high-contrast
theme still needs devtools emulation this automation cannot drive, which is
exactly the residual REV-05 already carries. That stays owner-run rather than
being claimed.

**Link:** A11Y-02 (shipped), REV-05, UI-STANDARDS -> Forced colours.

## 2026-08-27 — a hint is a description, not a button that does nothing

**A11Y-01 shipped.** `ParamTooltip` gave all 74 `[data-tip]` labels
`role="button"` and `tabindex="0"`. That announced 74 hint labels as buttons
that perform no action, put 74 phantom stops in the sidebar tab order, and
obliged each to a 44 px target it never meets at 96x19. On the two camera
`<label>`s the role is invalid ARIA outright, which is what axe reported.

**The hint is now what it always was: a description of the control.** Every
trigger resolves through its enclosing `label[for]` — all 74 do, so no
fallback path was needed — and the hint text becomes an `.sr-only` node the
control points at with `aria-describedby`. Three constraints shaped it:

- **The node sits after the `</label>`, never inside it.** Text inside a
  `<label for>` joins the control's accessible *name*, and the visible label
  has to keep matching that name for speech input (WCAG 2.5.3).
- **The token is appended, never replaced.** 23 of these controls are sliders
  whose readout already owns the first `aria-describedby` token
  (UI-STANDARDS -> Recognition over recall). The value still announces first,
  then the hint.
- **`.sr-only`, not `aria-hidden`.** A directly referenced hidden node does
  still contribute a description under AccName, but this programme does not
  claim screen-reader behaviour it has not measured — NVDA/VoiceOver evidence
  is owner-run under REV-05 — so the hint takes the plainest, best-supported
  route and accepts being read twice in browse mode.

**Dropping the tab stop must not make the hint mouse-only.** Removing the
phantom role alone would trade an invalid-ARIA failure for a WCAG 2.1.1 one,
so keyboard focus on the described control now reveals the same tooltip,
gated on `:focus-visible` so a mouse user who never asked for it is left
alone. Escape dismisses it for as long as focus stays there (WCAG 1.4.13),
which keeps arrow-key editing quiet. Verified live in Chromium at v3.2.680:
the pointer path, a real Tab arrival, Escape followed by arrow keys, and a
fresh mouse click that correctly reveals nothing. The interactive
accessibility tree now lists only real controls.

**The gate could not have caught this, and now can.** `axeAudit.test.js` only
ever mounted the *static* `index.html`, and the role was applied at init — so
the shell was clean while the running app was not. There is now a second axe
run over the shell *as JavaScript leaves it*. Replaying the old enhancement
under that harness reproduces exactly the two `aria-allowed-role` hits the
live Chromium audit found, so the new assertion is not vacuous. Anything that
decorates the DOM on startup belongs in both runs.

**Link:** A11Y-01 (shipped), REV-05, UI-STANDARDS -> Help and contextual
guidance.

## 2026-08-27 — owner sets the prune bar, and holds the merge

Two owner calls following the memory prune. **Pruning must never harm
development quality**: archive freely once context is closed, but content
still feeding open work — open-item rationale, the active era's trajectory —
stays live, and budget/prune-to targets yield to that bar (today's stopping
points, log at 16/20 entries and trajectory at 91% of budget, are the rule
applied, not an overrun to fix). Post-prune audit confirmed no open item's
needed context went cold: REV-03's archived design entry covers implemented,
green work, with live detail in its ticket. And **review-remediation does
not merge to main yet** — the live site stays on v3.2.618 until the owner
calls the release.

## 2026-08-27 — memory prune, and two owner deferrals

Maintenance Diagnose flagged the decision-log at 51 live entries (budget 20)
and the trajectory at 3,859 words (budget 2,000). Pruned losslessly
(diff-verified): 36 entries (2026-08-17 → 2026-08-26) moved to
`archive/decision-log-2026-08-17-to-2026-08-26.md`, keeping today's 15 live;
the trajectory's two closed epochs moved to `archive/trajectory/`
(0001 v2-line era Apr–Jun, 0002 v3.0 refactor milestone Aug 17–19), keeping
the remediation era live at 1,812 words. Swept the one ticked doc-deltas
line; dropped the stale `docs/player.js.map` file-map row (the build emits no
player sourcemap). Owner calls this session: **stay on PM-Skills 4.7.0**
(upstream is 4.9.2 — skipped, not merely deferred); **dependency updates
deferred into new ticket DEPS-01** (consider upgrades across the board).
Gate context: 67 files / 1006 tests green, `npm audit` clean.

## 2026-08-27 — the original review is fully dispositioned into the backlog

**Question asked:** is everything from the original review and its report now
effective in the backlog? **Audited rather than assumed**, against all three
layers of the report, not just the headline findings.

**RP-01…RP-18:** all shipped or carrying a named ticket. The crosswalk was
already accurate for the findings themselves and has been refreshed with
current dispositions.

**The gap was everything that was not a numbered finding.** Section 17's
*Optional* roadmap and section 18's *unresolved uncertainties* never entered
the backlog, because the crosswalk only ever bridged RP-01…RP-18. Five items
were still open and are now ticketed:

- **DEPLOY-01** — RP-07's stated residual plus §18's "GitHub branch
  protection/Pages permissions". Written as an open sign-off, then corrected
  on reading `f1c14b9`: a parallel maintenance session had already put the
  question to the owner, who **held the merge** — the live site stays on
  v3.2.618 until they call the release. The ticket is now `[blocked: owner
  calls the release]`, so the residual is tracked without reopening a settled
  decision.
- **REL-01** — `docs/app.js.map` publishes 3.1 MB carrying `sourcesContent`
  for 89 first-party files. The repository is public, so this is a size and
  tidiness decision, not a secrecy one; saying otherwise would overstate it.
  `[sign-off]`.
- **PERF-01** — RP-09 bounded *hostile* inputs, but no *legitimate* maximum
  project was ever profiled, so the supported ceiling is a UI limit rather than
  a measured budget.
- **LEGAL-01** — MPL-2.0 posture for mediabunny (bundled) and now axe-core
  (dev-only). Notices shipped under REV-09; the review was explicit that a
  technical review cannot give legal advice. `[maintainer]`.
- **ICE-03** — a visual/performance benchmark corpus, Icebox with a trigger.

Seven further §17/§18 items were checked and are genuinely closed: structured
diagnostics, Clear All semantics, content sensitivity, public-ZIP intent,
supported browsers, the coverage floor, and the AAA audit. Each is recorded in
the crosswalk with where it landed, so the next audit does not repeat this one.

**Crosswalk extended** with a second table covering the non-finding items, and
the dossier index now points at the current continuation prompt. The old
prompt is kept as provenance for the run it briefed rather than deleted.

**Parallel session reconciled.** Two commits (`ea3e27a`, `f1c14b9`) landed on
the branch from a maintenance session while this audit ran: the memory prune
happened, with an owner-set quality bar that pruning must never harm
development, and DEPS-01 was added. This session's edits applied cleanly on top
(additions only, nothing clobbered), DEPLOY-01 was corrected as above, and
LEGAL-01 now points at DEPS-01, which moves the same MPL-licensed versions.
The trajectory and decision-log budget warnings this session had been
preserving are therefore resolved, not deferred.

**Link:** DEPLOY-01, REL-01, PERF-01, LEGAL-01, ICE-03.

## 2026-08-27 — owner verdicts clear quarantine, and axe joins the gate

**Quarantine is empty.** All four parked items got an owner verdict:
- **QUAR-01** import/export custom keybindings — **cut**.
- **QUAR-04** randomised path-shape frequency — **cut**; the owner judges it
  already done.
- **QUAR-02** → promoted as **REVEAL-01**. The owner's intent, recovered:
  the spotlight reveals the background, and that reveal then *fades out over
  time* behind the head. Investigated rather than guessed — it is **not**
  currently possible. `buildSpotlightRevealMask` repaints every passed path
  point at full opacity on every frame, so revealed stays revealed, uniformly
  and permanently. The fix is tractable and fits the architecture: weight each
  point's alpha by its distance behind the head, keeping the per-frame rebuild
  that is what makes scrubbing bidirectional.
- **QUAR-03** → promoted as **LABEL-01**. The owner confirms auto-position
  works well; the ask is *when* it runs and how findable it is. Run it when a
  label is first written, never after the author has moved it by hand, and
  surface the control — it sits inside the collapsed "More" disclosure today.

Two of four were genuinely recoverable intent, which is the argument for
quarantining rather than cutting on an agent's judgement.

**axe-core added as a dev dependency**, owner-approved. Runtime dependencies
are unchanged: jszip and mediabunny. `tests/axeAudit.test.js` is now a standing
gate over the app shell across WCAG 2.0/2.1/2.2 A/AA/AAA and best-practice.

**Result: 48 rules, zero violations** — run twice in production Chromium, once
on the empty shell and once with the "Open day route" example loaded, with
`color-contrast` genuinely evaluated (confirmed, not assumed). The jsdom gate
disables `color-contrast` because jsdom has no painting; a pass there would be
a false green, so contrast stays a live measurement.

**Four incompletes, triaged, none a defect:**
- `aria-allowed-role` on two camera `<label>`s — axe's independent
  confirmation of **A11Y-01**, and stricter than the original finding:
  `role="button"` is *invalid* on a `<label>`, and becomes a violation rather
  than an incomplete once those controls are shown. Ticket updated to say so.
- `aria-valid-attr-value` on the File and Export dropdowns — the referenced
  menus exist with `role="menu"`; axe cannot resolve a `display:none` target.
  Markup is correct.
- `color-contrast` / `color-contrast-enhanced` on `.waypoint-fork-mark` — axe
  skips glyph-only content. The mark is `aria-hidden`, decorative, and its
  meaning is carried by the row's `.sr-only` text.

**Deferred by the owner:** the `trajectory.md` and `decision-log.md` size
warnings, to a maintenance session shortly. Not pruned.

**Link:** REV-05 (residual now NVDA/VoiceOver and forced colours only),
REVEAL-01, LABEL-01, A11Y-01.

## 2026-08-27 — the accessibility audit, and what it is honest to claim

**Ran and green in production Chromium:** unique ids, every control named,
one h1, no heading-rank skips, a main landmark, `lang`, alt text everywhere,
a polite live region. Contrast measured on every visible text node against its
effective background at the AAA thresholds. Target size on every rendered
control. Reflow at 320 CSS px — the WCAG 1.4.10 equivalent of 400% zoom at
1280 px — with no horizontal document scroll and, after the fix below, no
undersized control.

**Two AAA failures, found and fixed:**
- The Edit/Preview label measured 6.37:1. `--text-03` is exactly 7:1 on white,
  but that label sits on the toggle's own `--ui-02` surface. Moved to
  `--text-02`, now 19.17:1.
- The skip link was 37 px tall. It is the first thing a keyboard or switch user
  reaches, so it now fills the 44 px target.

**Two findings ticketed rather than folded in.** An assurance pass that
quietly turns into a redesign is exactly the failure this programme warns
against, so:
- **A11Y-01** — `ParamTooltip` gives every `[data-tip]` label `role="button"`
  and `tabindex="0"`. That announces ~80 hint labels as buttons that perform no
  action, and obliges each to a 44 px target it does not meet at 96×19. The
  right shape is `aria-describedby` on the control the label describes; that is
  a semantics change across the sidebar and deserves its own run.
- **A11Y-02** — only the UI-02 and ROUTE-01c row affordances declare
  `forced-colors` fallbacks. Selection accent bars, focus rings, the leg "+"
  and beacon colours have none.

**What is NOT claimed.** axe-core was not run: it would be a new dev
dependency, and that is an approval, not an assumption. Forced-colours and
reduced-motion emulation need devtools media overrides this automation cannot
drive. NVDA and VoiceOver remain owner-run by standing policy. The regression
test asserts only what static analysis can settle and says so in its header —
a jsdom "pass" on contrast or a screen reader would be worth less than nothing.

**Link:** REV-05, still `[~]` with a named residual.

## 2026-08-27 — the exported player inherits branches rather than reimplementing them

**Decision:** ROUTE-01d needed almost no new export code. `PlayerApp` already
takes `pathTimingMixin` wholesale, so it builds the same splines and composes
the same master timeline the editor does; the work was carrying `branchPaths`
and `branchTimeline` into its render state and proving nothing is lost in
between. A second, player-local branch implementation was never on the table —
it is exactly how play, scrub and export would drift apart.

**Timeline length:** a terminal branch can outlive the trunk, so
`updateAnimationDuration` now takes the max of the trunk-derived duration and
the composed branch total (plus the same handles, intro and tail, which sit
outside the composition). Without this the route ended when the trunk did and
a longer branch was cut off mid-animation. A branch that fits inside the trunk
changes nothing — it must not pad a route it already fits in.

**Cache correctness:** the composed timeline is a function of geometry *and*
base speed, so its cache is keyed on both. Keying on geometry alone reported a
branch's duration at the previous speed after a speed change.

**Partial-mixin hosts, a third time:** `updateAnimationDuration` calling
`this.getBranchTimeline()` broke the player-parity harness, which
cherry-picks mixin methods. Fixed on both sides — the harness takes the new
accessor (it is part of the timing contract it exercises) and the call is
optional, because a host without the accessor has no branch data either.

**Evidence:** 60 files / 878 tests. Live Chromium: composed total and engine
duration agree at 7269 ms on a branched route, the coordVersion-9 snapshot
carries `branchId`/`branchFrom`/`branchRejoin` on exactly the one branch
waypoint and adds no key to the other five, and the `player.js` bundle inlined
into every standalone export contains the branch composition and render code.
Opening an exported file in a browser end-to-end remains REV-04's outstanding,
owner-run evidence.

**Link:** ROUTE-01d.

## 2026-08-27 — a branch borrows the trunk's transport, never its own

**Decision:** `AnimationEngine` keeps exactly one authoritative transport — the
trunk's. Branch timing is pure derived data: `branchTiming.js` turns each run's
geometry into a leg, `PlayerCore.composeBranchTimeline` places the legs, and the
renderer asks `branchPathProgressAt(masterTimeMs, …)` for a branch's position.
No branch installs segment markers, holds playback state or accumulates time.

**Rationale:** the deterministic-timeline mandate says the scene is a pure
function of (timelineMs, projectState, seed). A per-branch transport would have
given every branch its own accumulating clock and broken that at the first
scrub. Deriving each branch's position from the master instant keeps play,
scrub and export agreeing by construction, exactly as they already do for the
trunk.

**Shared mapping, not a second one:** each leg carries its own `{segments,
pauses, pathDuration, totalPauseTime, hasVariableSpeed}` in precisely the shape
`PlayerCore.timelineToPath` consumes, and branches resolve position through
that same function. A first attempt approximated it (local time minus pause
time already spent) and drifted the moment a pause sat mid-branch rather than
at its end. An interleaved pause now holds a branch head still for the same
reason and by the same arithmetic as the trunk.

**Render seam:** two additive vector layers — `branch-paths` beneath the trunk
so the trunk still reads as the primary line, `branch-heads` above it, since
every enabled branch animates simultaneously and so owns a head. `renderPath`
and `renderPathHead` read a small fixed slice of the engine, so each branch
passes a facade that differs only in `getPathProgress()` and delegates the
rest. Branch waypoints, labels, beacons and areas needed no change at all:
those layers already iterate the whole waypoint array. Both branch layers
return early when `state.branchPaths` is empty, so a linear route never enters
the branch pass.

**Assumption at the skipped gate (camera):** the follow-camera keeps tracking
the trunk head. Trunk timing now reads `routeOf(app)` — the trunk, not the full
array — and `CameraService.toMajorKeyframes` follows it, so this falls out of
the model rather than being special-cased. Choosing per-fork which head the
camera follows, or framing all live heads, is a product decision left to
ROUTE-01c's sign-off.

**Mixin safety:** `routeOf(app)` is a module helper, not a mixin method,
because `PlayerApp` borrows only part of `pathTiming`; a `this.trunkRoute()`
call was undefined there and broke seven export-parity tests.

**Link:** ROUTE-01b. 58 files / 832 tests green. Verified in production
Chromium on a branched route: trunk and branch splines both start at the fork
point, two heads advance simultaneously from t=0, the shorter branch completes
and holds, zero console entries. A linear route reports `isLinear` with no
branch paths and renders unchanged.

## Archived: 2026-08-27 (11 of 19 entries) — see archive/decision-log-2026-08-27-to-2026-08-27.md
## Archived: 2026-08-17 → 2026-08-26 — see archive/decision-log-2026-08-17-to-2026-08-26.md
## Archived: 2026-06 — see archive/decision-log-2026-06.md
## Archived: 2026-04 — see archive/decision-log-2026-04.md
