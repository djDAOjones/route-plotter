<!-- markdownlint-disable MD013 MD060 -->
# Continue Route Plotter v3 from the PM-Skills backlog

Continue development of Route Plotter v3 as an evidence-led extension of the
repository review and remediation programme. The backlog in
`pm_skills/project/backlog.md` is now the single source of truth for what to do
next — every finding from the 26 August 2026 review has been dispositioned into
it. Do not restart the review. Do verify drift-prone state before acting.

This supersedes `route-plotter-review-remediation-continuation-prompt-2026-08-26.md`,
which remains as historical provenance for the remediation run it briefed.

## Repository and branch

Repository root:

`/Users/joe/Library/CloudStorage/OneDrive-TheUniversityofNottingham/_Joe Bell UoN Files/2_Projects/2025-10-14 Gary Priestnall PARM Maps Encore/Route Plotter v3`

Branch: `review-remediation`

Verified baseline at handover:

- latest feature commit: `9276e4f` — `REV-05a: add axe-core as a standing
  accessibility gate; clear quarantine`
- latest PM commits: `ea3e27a` (memory prune) and `f1c14b9` (owner calls),
  from a parallel maintenance session; documentation commits may follow
- generated Pages build: **v3.2.679**, exact 20-file `docs/` inventory
- automated gate: **67 files / 1006 tests**, restart safety, non-mutating
  production check build
- production Chromium: axe-core 48 rules / zero violations, verified on the
  empty shell and with the "Open day route" example loaded

At session start verify: local HEAD equals `origin/review-remediation`, the
worktree is clean, and the `reviews/` dossier exists. Stop on unexpected
divergence, OneDrive conflict copies or unrelated changes.

## Reading order

Follow `AGENTS.md` → "Before every task" for the tiered read policy. In short:
`README.md`, `pm_skills/project/brief.md`, `architecture.md`, `conventions.md`;
the Active section of `backlog.md`; the latest `decision-log.md` headings.
Read `UI-STANDARDS.md` for UI work and `DEV-INFRASTRUCTURE.md` for build,
runtime or release work.

The review dossier is background, not a task list — every finding is already in
the backlog. `reviews/route-plotter-review-finding-crosswalk-2026-08-26.md` is
the durable bridge and names which ticket carries each residual.

## Owner instructions and standing permissions

- Use PM-Skills faithfully. "Autojazz" means autonomously complete
  mechanism-known, low-risk work.
- Ask only for a real product, taste, authority, publication, privacy/legal or
  unavailable-external-evidence decision.
- Refactor the backlog after every completed phase and print a table of
  **Ticket ID, name, milestone/band/phase, description, status**.
- The memory prune ran on 2026-08-27 (`ea3e27a`) under an owner-set bar:
  pruning must never harm development quality. Archive freely once context is
  closed; content still feeding open work stays live, and budget targets yield
  to that bar. Do not re-prune to chase a number.
- Explicit staging only — never `git add -A`. Preserve unrelated user changes.
- Publishing the full `review-remediation` branch to the public
  `djDAOjones/route-plotter` repository is approved, for ordinary commits and
  pushes. It does **not** authorise changing Pages configuration, switching the
  deployed branch, deleting data or publishing private material.
- `docs/` is generated. Never hand-edit it; run `npm run build` when a
  publishable change needs refreshed Pages artefacts.
- `_Joe/` is maintainer-owned. Read where required; do not edit.

## State of the programme

All eighteen original review findings (RP-01…RP-18) are shipped or carry a
named ticket. Phase 5 route/crowd composition is complete end to end: split
hero routes model, timeline, rendering, authoring and export parity, plus
crowds bound to route moments, route tracing, baked last-arrival waits, the
branch handle, and three downloadable example projects.

The full shipped narrative is `pm_skills/project/trajectory.md`; the reasoning
is `pm_skills/project/decision-log.md`.

## What is open, and why

Three tickets are **blocked on owner evidence** and cannot be closed by an
agent. Never infer physical-device, screen-reader or other-browser results from
Chromium or jsdom:

- **REV-03** — physical iOS Safari and Android Chrome pointer evidence.
- **REV-04** — Chromium/Firefox/Safari codec-container evidence and a genuinely
  offline standalone-export check.
- **REV-05** — NVDA/VoiceOver, plus forced-colours emulation. Everything an
  automated pass can settle is done and green.

Two tickets carry a **`[sign-off]` or `[maintainer]` gate** — present the
scope and wait:

- **REL-01** — whether to keep publishing `docs/app.js.map` (3.1 MB, full
  source of 89 first-party files).
- **LEGAL-01** — owner/legal confirmation of the MPL-2.0 posture.

**DEPLOY-01 is not a question to re-ask.** The owner held the merge on
2026-08-27 (`f1c14b9`): the live site stays on v3.2.618 until they call the
release. The ticket exists so RP-07's residual stays tracked. Note the
consequence — **nothing shipped on this branch is live**, so "it works" always
means "on the branch", never "for users".

The rest are ordinary runnable work: **A11Y-01**, **A11Y-02**, **REVEAL-01**,
**LABEL-01**, **PERF-01**, **DEPS-01**. Icebox holds **REV-07**, **ICE-01**,
**ICE-02**, **ICE-03**, each with a stated promotion trigger; do not promote
without one.

## Engineering discipline

For each ticket: verify cwd/branch/clean state and gates; declare a narrow file
claim and search the full source first; preserve normalised waypoint
coordinates, EventBus-only component communication, top-level imports,
deterministic timeline evaluation, one captured pointer transaction, and the
split between Okabe-Ito map colours and UoN UI chrome; add focused tests for
the acceptance contract and the failure path; run `npm run check`; prove
runtime/UI changes in a real browser and read the console; run `npm run build`
only when a publishable change needs refreshed `docs/`; update the PM records;
stage an enumerated file set, inspect the staged diff, commit and push.

Do not weaken tests, hand-edit generated files, add a runtime dependency
without approval, claim unsupported browser or device evidence, or broaden a
ticket into a redesign. Several build and governance guards exist deliberately
(the artifact inventory, the approved-ZIP rule, the dependency ledger, the
public-asset manifest) — satisfy them, do not remove them.
