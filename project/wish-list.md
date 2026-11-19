# Wish-list

<!-- Capture inbox, one line per idea, appended at the bottom:
       - {ORIGIN}.{N} — {idea} — (from: ORIGIN, YYYY-MM-DD)
     ORIGIN is the item the idea came from; N is one above any number
     that origin has used, in the record or the commit messages
     (`node tools/find.mjs ORIGIN` lists them), so an ID is never
     issued twice. Triage promotes a line into the backlog or retires
     it; either way a trace names the wish's ID with the disposition
     and a reason. A deferral
     named in any entry, trajectory line or commit is also a line here
     or in the backlog (rule 5). Capture one line and keep working: do
     not act on it, scope it, estimate it or discuss it unless the owner
     asks; "park it" means append the idea and move on; this is the
     pre-triage inbox — raw, unjudged — and the backlog's Icebox is
     post-triage; promote into the backlog, never treat this as a
     second backlog. The lines below the first comment were
     carried verbatim from the canon wish-list at 75ba7ae; the open
     doc-delta lines (spec sign-off debt the canon record kept apart)
     follow them, each marked, since v3 keeps one capture surface. -->

## Open

- INTAKE.32 — Retire the canon framework copies under pm_skills/ (prompts, integrations, templates, scaffold) on the owner's word; pm_skills/project stays pinned by the inventory — (from: INTAKE, 2026-10-02)

- EX-03.1 — Upgrade the Reform riot, 1831 example next, after Match day, in the owner's words "the demos need an upgrade. lets start with the football dots"; what the riot upgrade shows awaits his direction — (from: EX-03, 2026-10-18)
- REFRESH-501.1 — pm-skills 5.0.1's start read leaves out only a closed heading shaped `### Phase N — … — CLOSED date` with nothing under it; this project's six other closed headings ("Ahead of Phase 1's…", "MVP — …", "Next feature — …") are still printed each session, so the read is 6 headings longer than the release's wording suggests; unjudged, build fd5fb94 at the refresh commit 9127b09 — (from: REFRESH-501, 2026-11-18)
- PLAN-5.1 — After v4.0, an author can save a route's features and settings as a preset file, to reuse or hand to students; the owner chose "Yes, as a file, after v4.0 (Recommended)" (Q20) — (from: PLAN-5, 2026-11-18)
- GATE-01.1 — The profile's Gate line names `npm run check` as the sorted gate, but GATE-01 kept `npm run check` as everything (the release helper runs it) and made `npm run check:changed` the sorted gate; the redraft in GATE-01's decision awaits the owner's signature — (from: GATE-01, 2026-11-18)
- GATE-01.2 — DEV-INFRASTRUCTURE.md stands at 3,298 of its 3,300 words, so STACK-01 cannot describe v4's gate there without a budget raise or a split, the owner's call — (from: GATE-01, 2026-11-18)
- STACK-01.1 — A v3 release cannot run as `DEV-INFRASTRUCTURE.md` describes since the move: `npm run push` from `v3/` stops before committing, as git names its bumped file `v3/version.json`, outside the helper's allowlist, and `v3/docs/` is ignored; should the owner call a v3 release, it needs its own decided step (the architecture plan's §14) — (from: STACK-01, 2026-11-18)
- STACK-01.2 — README.md's development section and UI-STANDARDS.md still name v3's files at the root (`npm ci` there, `src/`, `tests/`, `scripts/`); they are re-pointed to `v3/` or rewritten when v4's own documents are written — (from: STACK-01, 2026-11-18)
- PLAN-6.1 — A later feature may let a repeating crowd's laps vary: to the architecture plan's round 2, Q8, whose recommendation was "Every lap the same", the owner answered "as recommended for now, but future feature may include expressions that make it varied" (2026-11-18); what "expressions" means is his to say when it is planned — (from: PLAN-6, 2026-11-19)
- STACK-02.1 — Vite 8.2.2, Set 1's pin, has six published advisories for its development server, fixed in 8.3.8; taking 8.3.8 or later changes Set 1, the owner's call — (from: STACK-02, 2026-11-19)
- STACK-02.2 — The accessibility pack's install helper would write `docs/accessibility.md` into the live site's folder and its tools into the record's `tools/`; STACK-03 decides where they go before installing that pack — (from: STACK-02, 2026-11-19)
- STACK-02.3 — The profile's App opinion and Accessibility testing lines, the app-opinion Standards block, the rules file's two By-task rows and the Gate line's v4 checks are drafted for the owner's signature; signing the App opinion line brings the pack's `project/digests/app-opinion.md` and makes `project/app/set1.json` his — (from: STACK-02, 2026-11-19)
- PUB-01.1 — DEV-INFRASTRUCTURE.md's release section still describes v3's `npm run push`; how v4 publishes, how to see it and how to take one back are written in `.github/workflows/publish.yml`, `scripts/publish.mjs` and PUB-01's decision instead, the file being over its budget (GATE-01.2) — (from: PUB-01, 2026-11-19)
- PUB-01.2 — v4's page shows no version; the address's `version.json` does; showing it in the page belongs to the editor shell or its help (CORE-05, CORE-11) — (from: PUB-01, 2026-11-19)
- PUB-01.3 — The publishing step's own files (`.github/workflows/publish.yml`, `scripts/publish*.mjs`) are sorted as other, so changing them runs v3's whole suite; a class of their own would run only the gate's and the step's tests — (from: PUB-01, 2026-11-19)
- PUB-01.4 — Only a repository setting, the owner's call, can make the step the enforced only writer of the live site: requiring a pull request and Verify on `main`; until then the rules' `main` line holds a direct push off, and the gate fails one on `main` after the fact — (from: PUB-01, 2026-11-19)
- PUB-01.5 — A v3 release by `npm run push` would now fail Verify on `main` as a hand change to the live site, besides stopping before its commit (STACK-01.1); if the owner calls one, its route is decided then — (from: PUB-01, 2026-11-19)
- PUB-01.6 — Record in PUB-01's Notes the first publish through the step, the take-back tried once on the live site and the publish after it, all due straight after the merge: until then criterion 10's trial is shown only by the step's commits on `main` (`git log -- docs version.json`) — (from: PUB-01, 2026-11-19)
