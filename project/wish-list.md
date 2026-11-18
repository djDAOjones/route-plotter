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

- INTAKE.10 — CI could fail a pull request that changes `docs/` or `version.json`, which only `npm run push` may commit; today the release steps rely on checking the diff by eye. (canon provenance: 2026-09-22 GOV-01) — (from: INTAKE, 2026-10-01)

- INTAKE.32 — Retire the canon framework copies under pm_skills/ (prompts, integrations, templates, scaffold) on the owner's word; pm_skills/project stays pinned by the inventory — (from: INTAKE, 2026-10-02)
- GATELESS-1.1 — The brief's Direction and the rules file's Always still name the big run's delegation of 2026-09-28, which GATELESS-1 replaced on 2026-10-05; refresh both at the owner's next signing — (from: GATELESS-1, 2026-10-05)
- GATELESS-1.2 — The profile's Conventions name `PM: summary` for memory-only commits, but `node tools/check.mjs --commit` fails a commit subject whose ID the ledger lacks; reconcile the two — (from: GATELESS-1, 2026-10-05)

- REL-720.1 — Reconcile the generic item-commit checker with the prescribed generated `chore: deploy vX.Y.Z` commit, which has no Verify body; both commit-shape diagnostics reproduced on v3.3.720 while the normal ledger check passed — (from: REL-720, 2026-10-14)

- EX-03.1 — Upgrade the Reform riot, 1831 example next, after Match day, in the owner's words "the demos need an upgrade. lets start with the football dots"; what the riot upgrade shows awaits his direction — (from: EX-03, 2026-10-18)
- DEF-99.2 — The owner reported, with DEF-99's and DEF-100's MP4s, that Match day's playback is "coming out weird" too; what looks weird in playback is not yet known (asked 2026-10-18, unanswered) — (from: DEF-99, 2026-10-18)
- REL-726.1 — v3.3.726 changes exports and the player; save and open its MP4 and HTML exports from disk, one of each with Show image unticked, or obtain the owner's explicit waiver for this release — (from: REL-726, 2026-10-19)
- V31-UPGRADE.1 — The profile's Gate line ends "then the v3 checker", which since V31-UPGRADE is pm-next v3.1's; "then the pm-next checker" would stay true across versions. The profile is the owner's to sign, so the wording waits for him — (from: V31-UPGRADE, 2026-10-21)
- V31-REFRESH-4.1 — **The profile's Harness line takes the owner's signed sentence once its budget allows.** The owner signed on 2026-11-12 (lab decision PLAN-16, "Sign for all four (Recommended)") that the line ends "most of what each harness keeps in its own memory repeats this ledger; where they differ, this ledger is the record", for each profile at its next pull request. At the lab's build b875c63 that takes this profile from 386 to 402 words against its hard budget of 400 (3.4), so the checker fails and the refresh's pull request leaves the file alone. It needs his recorded decision: raise the Budget line's profile figure to 410, or trim two words of the profile. — (from: V31-REFRESH-4, 2026-11-16)
- REFRESH-501.1 — pm-skills 5.0.1's start read leaves out only a closed heading shaped `### Phase N — … — CLOSED date` with nothing under it; this project's six other closed headings ("Ahead of Phase 1's…", "MVP — …", "Next feature — …") are still printed each session, so the read is 6 headings longer than the release's wording suggests; unjudged, build fd5fb94 at the refresh commit 9127b09 — (from: REFRESH-501, 2026-11-18)
