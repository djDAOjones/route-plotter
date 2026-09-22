# Trajectory

<!-- Shipped-work narrative. The story of what changed over time, in chunks. -->
<!-- Warm tier. Agents do NOT auto-read this every task. Read it on demand:
     during memory-maintenance.md, release.md, or when reconstructing what
     already shipped. See AGENTS.md -> "Before every task". -->
<!-- Compress on ship. One line per item: the outcome, not the implementation.
     The WHY lives in decision-log.md; the per-file roles live in file-map.md.
     Never paste a decision-log entry in here. A pointer is enough. -->
<!-- Keep every shipped ID individually greppable: start each line with the
     item ID. When one line covers a group of related sub-items, spell out
     each ID (e.g. WL-19a, WL-19b, ... WL-19h) rather than a range, so an
     ID-level reconcile can find them all. -->
<!-- Structure: newest phase/milestone at the top. Group items by the phase or
     milestone they belong to, with a one-line Outcome per phase. -->
<!-- Budget: see AGENTS.md -> "Memory size budgets". Over budget -> prune-memory.md
     moves the oldest phases to archive/trajectory/trajectory-NNNN-<range>.md and
     adds a row to archive/INDEX.md. Archives are append-only; never rewrite. -->

## Release v3.2.690 (shipped 2026-09-22)

DEPLOY-01 — The remediation line is released from `main`: v3.2.690
(`caea691`), Pages source back on `main /docs`, verified by deployment SHA and
by SHA-256 of every published file; rollback tag `v3.2.689`. Also corrected the
record that Pages had served `main` all along — it had served the branch since
2026-08-26. (2026-09-22) — see decision-log.

REL-01 — The production source map stays published. (2026-09-22) — see
decision-log.

REL-02 — `main` is protected by a ruleset against force-push and deletion,
with no bypass, so the branch Pages serves cannot be rewritten or removed.
(2026-09-22) — see decision-log.

LEGAL-01 — Owner confirmed the MPL posture; the notices and licence now ship
with the app and are linked from Help, with mediabunny's source pinned to the
exact tag and commit it was built from. (2026-09-22) — see decision-log.

## Programme close-out (2026-08-27)

PM — The original review is fully dispositioned: RP-01…RP-18 all shipped or
ticketed, and the review's Optional roadmap and unresolved uncertainties —
never covered by the RP crosswalk — audited into DEPLOY-01, REL-01, PERF-01,
LEGAL-01 and ICE-03. The backlog is now the single source of truth for what to
do next. (2026-08-27) — see decision-log.

## Engineering maturity (shipped 2026-08-28)

DEPS-01 — Dependency pass taken deliberately and gated one upgrade at a time:
vitest 4.1.11, mediabunny 1.55.3 (export re-verified in Chromium, MP4 and
WebM), jsdom 27 -> 29 across two majors, which also dropped five transitive
packages. jszip, esbuild and axe-core were already latest. jsdom 30 refused:
it needs Node >= 24.15.0 and this checkout runs 24.5.0. (2026-08-28) — see
decision-log.

## Performance (shipped 2026-08-28)

ICE-03 — The cost curve is repeatable: `scripts/perf-harness.js` prints it on
demand with no pass/fail threshold and no place in the quality gate, because
frame timings are machine-dependent. Its first version let the running app
autosave the synthetic benchmark project over the author's; autosave is now
suppressed for the rest of the page's life. (2026-08-28) — see decision-log.


PERF-01 — The supported ceiling is now measured, not assumed: waypoint count is
the only dimension that costs frame time (comfortable to ~200, borderline at
500, not interactive by 1,000), while 5,000 dots cost ~1 ms and image
resolution costs no frame time at all — only memory. (2026-08-28) — see
decision-log.

## Inspector polish (shipped 2026-08-28)

LABEL-01 — Auto-position now runs when a label is first written, never again
once the author has placed it by hand (a new persisted flag), and the button
sits in the Label card's primary tier instead of behind More. A colliding label
raises one fading offer to re-place it, reusing the toast. (2026-08-28) — see
decision-log.

## Reveal modes (shipped 2026-08-28)

REVEAL-01 — The spotlight reveal now fades out behind the head over an
authorable per-project trail, persisted and carried into the exported player;
the maximum is a sentinel meaning "never fades", so older projects are
untouched. The reveal sliders are also synced on load for the first time.
(2026-08-28) — see decision-log.

BUG-02 — A zero feather no longer makes the spotlight invisible: equal gradient
radii paint nothing, so the shipped default rendered nothing at all in both
spotlight modes. (2026-08-28) — see decision-log.

## Branch rendering (shipped 2026-08-28)

BUG-01 — A branched hero route no longer crashes on the trunk's wait index:
each run renders with its own waypoint sub-array, so a wait past the end of a
shorter branch run now falls through to that run's own path direction instead
of reading undefined. Fixed a hard failure of video export, and of the final
preview frame, for any branched project with a late wait. (2026-08-28) — see
decision-log.

## Accessibility assurance (in progress 2026-08-27)

A11Y-02 — Forced colours no longer erases the UI: focus is restored as a
system-colour outline (box-shadow, which every ring here used, is suppressed
in that mode), selection accent bars are repainted, colour swatches opt out,
and the map canvas is a documented content exception. Also fixed a focus ring
that referenced an undefined token and so rendered nothing in any mode.
(2026-08-28) — see decision-log.

A11Y-01 — The 74 `[data-tip]` hint labels no longer pose as buttons: each
hint is now its control's appended `aria-describedby` description, and the
visible tooltip stays reachable by pointer and by keyboard focus. axe now also
runs over the shell as JavaScript leaves it, where the defect actually lived.
(2026-08-27) — see decision-log.

REV-05a — axe-core joined the gate (dev dependency, owner-approved): 48 rules,
zero violations across WCAG 2.0/2.1/2.2 A/AA/AAA and best practice, verified
live with contrast evaluated for real. (2026-08-27) — see decision-log.

PM — Quarantine cleared on owner verdicts: two cut, two recovered as REVEAL-01
(spotlight reveal that fades behind the head — investigated and confirmed not
currently possible) and LABEL-01 (auto-position timing and discoverability).
(2026-08-27) — see decision-log.

REV-05 — The structural audit, AAA contrast sampling and 400%-zoom reflow ran
green in production Chromium; two AAA failures found and fixed (a 6.37:1 label
and a 37px skip link), and the structural half is now a permanent regression
test. (2026-08-27) — see decision-log.

