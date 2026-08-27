# Decision Log

<!-- Append new decisions at the top. Don't edit old entries. -->

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

## 2026-08-27 — examples are generated project saves, published under review

**Owner decision:** the examples ship as full `.zip` project saves so people
can download and re-use them, not as JSON the app alone understands. Asked and
answered at the DEMO-01 gate.

**Generated, not committed as source.** The repository holds the example
*definitions* (`src/examples/index.js`) and the already-bundled backgrounds;
the build pairs them into the archive. This keeps a second copy of a 1–2 MB
image out of the source tree, and the archives are byte-reproducible — fixed
entry timestamps and a pinned authoring date, because `Waypoint.toJSON()`
carries `created`/`modified` — so a rebuild that changed no example produces
no diff and lands no new blob in history. The archives themselves do go to
`docs/`, which is how a static site can offer a download at all.

**Built from the live models, which is what makes them fixtures.** Hand-written
JSON would rot into a shape nobody reads; `toJSON()` output is current by
definition. `tests/exampleProjects.test.js` rehydrates each one through the
app's own timing path and asserts it resolves, times deterministically, gives
every waypoint an arrival and leaves no broken crowd binding. If the save
format, branch model or timeline maths drift, an example stops resolving and
the suite says so.

**Publication boundary, honoured rather than bypassed.** The build refused any
ZIP in its output, because "legacy project ZIPs still require individual
provenance review" (decision-log 2026-08-26). That rule was never a blanket
ban on archives — it was a ban on publishing archives nobody had reviewed. So
`public-assets.json` gained an `exampleProjects` block naming the three
approved archives and the approved background each contains, the build's guard
now refuses any ZIP *not* in that record, and `publicationBoundary.test.js`
asserts the shipped set equals the approved set. A stray user project still
fails the build.

**Content:** a plain labelled route with a beacon (no crowd); a branching
campus route whose crowd is traced from it and released at the head's arrival;
and a weighted network with two dot streams and no hero route — between them
every Phase 5 capability, and one gentle first-open example.

**Link:** DEMO-01. 65 files / 991 tests green. Verified in production Chromium:
"Open day route" opened from the File menu with its background, 1 branch, 0
structural problems, 4 crowd nodes bound and none broken, one join wait and an
11.65 s timeline. Zero console entries.

## 2026-08-27 — the branch handle is an offer, and it must survive a tap

**Decision:** A waypoint that a *bound entry* node sits on carries a "+" handle
beside its marker. Clicking it emits `route:branch-arm` — the same event
Alt+click emits — so there is one branch path through the code, not a second
mechanism that could drift from it. Entry nodes only: a pass-through or exit
node marks a crowd already moving through, not a moment the story opens at, and
a broken binding offers nothing.

**Its own hit target, and not hover-gated.** The handle sits clear of the
marker so it cannot steal the marker's clicks — which also puts it outside the
marker's hit radius, so a cascade that only looked for handles *after* a
waypoint hit never reached it. It is now checked ahead of the waypoint, beside
the area handles.

More importantly, the click path hit-tests the handle itself rather than
trusting the hover state. Gating on hover left the handle dead on touch and
pen, where a tap never hovers first — exactly the devices REV-03 unified this
transaction for. Hover is the visual affordance; it is not the gate. This was
found because the hover cascade is not reproducible in browser automation, and
chasing that turned up the real defect underneath it.

**One "+" routine:** the leg-midpoint handle and this one now draw through
`_drawPlusHandle`, so two offers that mean "add something here" cannot drift
into looking different.

**Link:** COMPOSE-04. 64 files / 963 tests green. Verified in production
Chromium: the handle on the crowd's entry waypoint armed the fork with no hover
beforehand, and the place click created `Waypoint 1·B1` alongside the existing
`2·B1` — correctly lettered per fork — with no structural problems and zero
console entries.

## 2026-08-27 — a closed client socket is not a port holder

**Decision:** `scripts/restart.sh` matches `lsof -sTCP:LISTEN` when deciding
whether the port is held by a foreign process.

**Rationale:** it matched *any* socket on port 3000, including a browser's
stale CLOSED client connections to the server it had just stopped. The
documented one-command boot then refused to start — correctly reporting that it
would not kill a process it does not own, but about sockets that hold nothing.
The ownership-safety contract is intact and still refuses a genuine foreign
listener; it just no longer mistakes a hung-up caller for one.

**Found by:** the boot failing after a dev-server restart during COMPOSE-04
verification, with nothing listening on the port at all.

**Link:** DEV-01. `tests/restartSafety.test.sh` still green.

## 2026-08-27 — the crowd wait is solved, not iterated, and then baked

**Decision:** "Wait here for this crowd" computes the wait a waypoint needs so
the head is still there when the crowd's last dot arrives, and writes it as an
ordinary authored `pauseTime`. The route gains no live dependency on the crowd —
Phase 5 forbids that, and a live one would make the timeline a fixed-point
problem on every frame.

**Why a difference is wrong.** Adding a wait `P` lengthens the timeline, and
every dot's onset is a *fraction* of the timeline, so the crowd finishes later
too. "Last arrival minus arrival" therefore undershoots, and iterating converges
slowly as onsets approach the end. Solved per dot instead, with `A` the head's
arrival (unaffected by a wait *at* that waypoint), `f` the onset fraction, `J`
the journey and `D` the timeline minus the waypoint's current wait:

    A + P ≥ f·(D + P) + J   ⇒   P ≥ (f·D + J − A) / (1 − f)

taking the largest such `P` over the dots. Exact in one pass, and idempotent:
fitting twice lands on the same number, so a refit never creeps.

**Unsatisfiable cases are reported, not approximated:** a dot with onset
fraction 1 releases exactly at the end and moves out by however much the route
is lengthened, so no wait can outlast it; a looping or respawning crowd has no
arrival at all. Both come back with a reason rather than a wrong number.

**Shared arithmetic:** the onset routine was extracted from `SwarmEngine` into
`crowdArrival.js` and the engine now imports it, rather than the solve
restating it. Every swarm fixture stayed byte-for-byte identical through that
extraction, which is the check that mattered. `scheduleDots` resolves the guide
the same way `evaluate` does and walks a graph dot's own route to its first
exit, so per-dot journeys differ on a graph exactly as they do on screen.

**Assumption at the skipped gate:** the wait applies to the selected major
waypoint when there is one, otherwise the route's last major — the two things
an author means by "wait here" — rather than introducing a waypoint picker.

**Staleness is honest, not hidden:** the number is a snapshot. Retune the crowd
and it goes stale; fit it again. That is the cost of baking, and it is the cost
Phase 5 chose.

**Link:** COMPOSE-02. 63 files / 945 tests green. Verified in production
Chromium: a crowd finishing at ~25 s against a 7.3 s route solved to a 48215 ms
wait, after which the head leaves at 53984 ms and the last dot arrives at
53983 ms. The naive difference would have set ~19 s and still missed. Zero
console entries.

## 2026-08-27 — tracing the route makes a copy that still follows it

**Decision:** "Trace route into network" replaces the selected crowd's guide
network with one mirroring the route: a node per **major** waypoint, an edge
per leg carrying that leg's **minors as control points**, and `one-way` edges
throughout. Branches trace as edges leaving the fork node and returning to the
rejoin node, so a crowd splits exactly where the route splits.

**A copy that still follows.** Every traced node keeps a COMPOSE-01 binding to
the waypoint it came from, so moving that waypoint carries the node rather than
stranding the copy — but the network is otherwise the author's: retune weights,
add shortcuts, draw extra nodes, none of which reaches back into the route.
That is the one-way rule paying for itself twice.

**Minors are geometry, not junctions.** A node at a minor would be a decision
point the route does not have, and a crowd would treat it as a place to choose.
Carrying minors as edge control points keeps the guide curve the route's own
curve instead of a straight chord between majors.

**Entries and exits are derived, not declared:** a node with no incoming edge
is an entry, one with no outgoing edge an exit. A branched route therefore
yields several exits without the caller reasoning about topology.

**Refuse rather than half-build:** a route with fewer than two majors, or one
whose branch structure has an unresolved fork or rejoin, is refused with a
reason. A partial trace would leave edges pointing at endpoints that were never
created.

**Availability:** the button stays enabled while the pen is live — switching a
crowd to "Custom network" hands you the pen immediately, which is exactly when
"or just trace the route" is most useful. Clicking it puts the pen down first,
because the trace replaces every node and a half-drawn edge would be left
pointing at one that no longer exists.

**Link:** COMPOSE-03. 62 files / 923 tests green. Verified in production
Chromium on the branched route: 4 bound nodes with the first an entry and the
last an exit, 4 one-way edges including the fork→branch and branch→rejoin
pair, and the trunk leg carrying its 2 minors as control points. Zero console
entries.

## 2026-08-27 — a bound crowd reads the route; the route never reads the crowd

**Decision:** `GraphNode.anchorWaypointId` binds a node's *evaluated* position
to a waypoint, and `Emitter.releaseAnchor` binds a release window's start to a
route moment. Both are resolved at evaluation time from live route state, both
default to null, and both are omitted from `toJSON()` when null so an
unanchored scene's saved shape is unchanged.

**Authored intent is never rewritten.** A bound node keeps its own `x`/`y`;
only a derived `position()` follows the waypoint. That is what makes the
fallback meaningful — when the waypoint is deleted the node returns to where it
was authored, keeps its binding, and the break is reported. Deleting the node
or freezing the crowd would both destroy work the author never asked to lose
(the ticket's open question on fallback).

**Named moments, not a normalised offset** (the ticket's second open question):
`arrival`, `pause-end` and `route-end`. An author can reason about "when the
head gets there" and "when it moves off again"; both survive retiming; and an
offset into a pause means nothing when the pause is zero.

**Determinism and fixture compatibility:** only a bound emitter's window
*start* moves. The onset arithmetic — slot, hash channels, variance, ramp,
busyness envelope — is untouched, so every existing unanchored swarm hash is
byte-for-byte identical, which the suite confirms. `getRouteArrivalMap()`
composes a linear route's single trunk leg through the same routine a branched
one uses, so a bound crowd reads the same arithmetic either way.

**Read split:** everything that draws an edge, walks a dot or hit-tests reads
`node.position()`; the authoring surfaces (semantic outline inputs, node drag,
validation) keep reading `x`/`y`. `edgeGeometry`'s cache signature includes the
resolved position, so a route edit invalidates the drawn curve — the drawn
curve and the curve dots travel must stay the same curve.

**Warning cadence:** the break notice fires once per *change*, not once per
path rebuild — `calculatePath` runs on every drag frame. Resolution itself runs
ahead of that function's early returns, because deleting a route down to one
waypoint breaks every binding and is exactly when a stale resolution is worst.

**Link:** COMPOSE-01. 61 files / 906 tests green. Verified in production
Chromium on a branched route: the node bound to its waypoint's exact position
while its authored coordinates stayed put, the emitter released at 2993 ms
(Waypoint 2's arrival plus its 1500 ms wait) with nothing before it, and
breaking the binding returned the node to its authored position with the
binding intact and the break reported. Zero console entries.

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

## 2026-08-27 — two gestures author a branch, and both are owner-chosen

**Decision:** Alt+click on an existing waypoint arms a branch; the next plain
canvas click places its first waypoint. Dragging a branch's last waypoint onto
another waypoint rejoins the branch there; dragging it onto the current target
again clears the rejoin. Both were picked by the owner at the ROUTE-01c gate
over a list "+ Branch" button, a canvas ⑂ handle and an inspector dropdown.

**What Alt+click gives up:** Alt+click previously force-added a major *even on
top of an existing waypoint*, bypassing selection. The hit-test now splits it:
empty canvas still force-adds, a waypoint hit arms a branch. The one lost case
is force-adding a major exactly on top of another, and Alt+Cmd still
force-adds a minor there. Escape unwinds an armed gesture before it unwinds a
selection — an armed state is the more recent and more surprising one to be
stuck in.

**Placement:** a branch is inserted after the fork's own leg block, so the flat
array still reads in route order and the sidebar list needs no reordering pass.
Numbering is `fork·letter·position` (`2·B1`), lettered from B because the
trunk's own continuation past the fork is implicitly A — so adding a second
branch never renumbers the first.

**Validation lives in the model, not the gesture:** `canForkFrom`,
`canRejoinBranch` and `branchEndInfo` answer every question the gestures ask,
and `canRejoinBranch` decides by applying the change to a copy and re-resolving
rather than restating the rules. A gesture that reimplemented them would drift
from `resolveRouteBranches` the first time either changed.

**Two bugs the live pass found, neither reachable from jsdom:**
- `findWaypointAt` hit-tested the waypoint being dragged. At drop time it sits
  under the cursor, on top of the target, so the rejoin never fired. It now
  takes an exclusion, and the caller excludes the whole drag group.
- Both branch handlers snapshotted undo *before* mutating. This project's undo
  stack holds post-action states and `undo()` pops the current one to restore
  the previous, so a pre-mutation snapshot made undo skip a step. Corrected to
  match `waypoint:deleted` and `waypoints:reordered`.

**Layout:** the fork ⑂ is badged onto the waypoint's colour dot rather than
placed in the row's text flow. A major row is already dot + handle + title +
▲▼ + × inside roughly 140px, and one more inline child wrapped the title.

**Link:** ROUTE-01c. 59 files / 869 tests green. Verified in production
Chromium: fork armed and placed at the right array index, rejoin set with a
1203 ms join wait and the dragged point restored rather than moved, the same
drag toggling back to terminal, undo restoring the rejoin, persistence across
reload, zero console entries.

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

## 2026-08-27 — branches are runs in the one waypoint array, not a second graph

**Decision:** A hero-route branch is a *contiguous run* of waypoints sharing a
`branchId`, stored in the same ordered array the route has always used, with
`branchFrom` on the run's first waypoint and `branchRejoin` on its last. All
three default to null and are omitted from `toJSON()` when null, so an unsplit
project's save is byte-identical to a pre-ROUTE-01 save.

**Alternatives rejected:** a dedicated `RouteGraph` of nodes and edges reads
cleaner in isolation but forces a migration of every consumer — path,
rendering, timing, persistence, export, outline — and cannot honour "preserve
valid linear projects exactly" without carrying the array anyway. Reusing the
crowd `GraphModel` was rejected outright: it is a weighted directed graph where
dots *choose* an edge, and importing edge weights and probabilistic selection
into hero-route storytelling would have made the two models mean the same
thing when the approved contract says they must not.

**Timeline composition:** `PlayerCore.composeBranchTimeline` resolves leg start
times by relaxation over fork dependencies, so it is order-independent and
terminates on a cyclic structure by reporting the survivors as `unresolved`
rather than looping. Simultaneous start, latest-arrival rejoin recorded as a
`joinWaitsById` entry (once per join, not once per incoming branch) and
completion as the max over every terminal endpoint. A disabled branch keeps its
place but contributes zero duration — otherwise hiding a branch would stretch
the route it is hidden from.

**Validation, not repair:** `resolveRouteBranches` never throws and never
fixes a broken structure. A deleted fork target, a split run or a cycle comes
back in `problems` with the runs still intact, so the route renders and the
author is told what is wrong. Silent repair during a render would rewrite
authored intent.

**Scope:** ROUTE-01 was too large for one slice, so it is now ROUTE-01a
(this: model + composition, headless), ROUTE-01b (rendering + camera),
ROUTE-01c (authoring, `[sign-off]`) and ROUTE-01d (export parity). COMPOSE-01
and COMPOSE-03 depend on the model, so they gate on ROUTE-01a; REV-05 needs
the authoring UI to settle, so it gates on ROUTE-01c.

**Link:** ROUTE-01a. 57 files / 808 tests green; no runtime behaviour change.

## 2026-08-27 — the route list shows minors, and one numbering serves both views

**Decision:** The sidebar waypoint list renders the whole route. Minors appear
as indented child rows of the leg they shape, with a visible `minor` tag, a
grey shaping-dot glyph matching what the canvas actually draws, and an
`.sr-only` statement of the relationship — indentation alone would leave the
structure to layout (WCAG 2.2 1.3.1).

**Rationale — one numbering:** `src/utils/waypointNaming.js` now numbers the
route once (`1`, `1.1`, `1.2`, `2`, …) and both the list and the semantic
outline read from it. Before this, the outline numbered minors by route
position, so its "Minor waypoint 7" and the list's "Waypoint 7" named different
waypoints — a collision a screen-reader user moving between the two surfaces
would hit directly. Leg 0 is a real case, not a guard: deleting a major strands
its trailing minors ahead of every remaining major, and they read `0.1`, `0.2`
rather than borrowing the number of the major that now follows them.

**Rationale — reorder-visible, not reorder-able:** a minor is not draggable and
owns no ▲/▼. Its place inside a leg is authored on the canvas, and
`reorderWaypointBlocks` already moves it with its major; giving minors their
own reorder controls would reopen the 2026-08-18 data bug where rebuilding
majors in place silently reattached minors to different legs. A major instead
drags as its whole leg block, so the minors visibly travel to where the model
will actually put them. The `waypoints:reordered` payload stays majors-only.

**Alternatives rejected:** an ARIA tree (`role="treeitem"` + `aria-level`)
would have replaced the deliberate action-list semantics — each row is a native
button beside independent reorder/delete buttons — for hierarchy the `.sr-only`
line already conveys. Keeping the outline's route-position numbering and giving
the list its own scheme would have shipped two names per waypoint.

**Link:** UI-02. 56 files / 773 tests green; verified in production Chromium —
selection, rename, block reorder with minors travelling, autosave round-trip,
44 px rows, zero console entries. Generated Pages build v3.2.658.

## 2026-08-27 — inline rename detaches its blur listener before touching the DOM

**Decision:** `startRenameFor`'s `finish()` calls
`input.removeEventListener('blur', onBlur)` as its first statement, and returns
early when the input is no longer connected.

**Rationale:** replacing the focused input removes it from the tree, and Chrome
dispatches the resulting `blur` from *inside* that `replaceWith` call. The
re-entrant pass then replaced a node that no longer had a parent and threw
`NotFoundError` into the console on every successful Enter-committed rename.
An `isConnected` guard alone did not close it — the re-entry happens mid-swap,
while the node's connected flag is still set. Detaching the listener up front
removes the re-entry entirely, whatever the dispatch ordering. The `isConnected`
return still covers the other case: an app-side list rebuild (autosave, a
selection refresh) replacing the row while a rename is open, where the new row
already carries its own title span.

**Context:** pre-existing since the rename paths were unified, found live during
UI-02 verification rather than by any test — jsdom does not reproduce Chrome's
synchronous mid-mutation blur, so the regression test asserts the re-entrant
`finish()` cannot throw rather than reproducing the browser's exact ordering.

**Link:** UI-02a. `tests/waypointList.test.js`.

## 2026-08-27 — gate vocabulary splits blocking dependencies from evidence debt

**Decision:** Backlog gates now distinguish `[gated: X impl]` — waits on X's
code landing — from `[verify: …]`, an evidence residual that blocks nothing
downstream. ROUTE-01 and the COMPOSE chain move to `[ready]`/`[gated: … impl]`;
REV-05 re-gates onto UI-02 and ROUTE-01. Items also carry a short title and a
band so the roadmap table reads without cross-referencing.

**Rationale:** REV-03's implementation shipped at `bbc1c3f`; only physical
iOS/Android evidence is outstanding. Writing that as `[gated: REV-03]` parked
the entire Phase 5 chain behind evidence none of its successors needs — the
real dependency is a stable single pointer transaction, which exists. REV-05 is
the genuine exception: it wants the authoring UI to stop changing shape, and
the tickets still changing it are UI-02 and ROUTE-01, not REV-03.

**Cost if wrong:** ROUTE-01 builds branch authoring on a pointer layer whose
physical-device behaviour is unconfirmed. Accepted: the layer is green in
automation and production Chromium, and REV-03/REV-04 keep their honest
evidence residuals rather than being closed early.

**Link:** backlog refactor, 2026-08-27.

## Archived: 2026-08-17 → 2026-08-26 — see archive/decision-log-2026-08-17-to-2026-08-26.md
## Archived: 2026-06 — see archive/decision-log-2026-06.md
## Archived: 2026-04 — see archive/decision-log-2026-04.md
