# Backlog

<!-- Open work only; shipped work lives in trajectory.md. One line per
     item under a milestone heading: - [ ] ID — title — since YYYY-MM-DD.
     Marks: [ ] open · [~] in progress · [!] needs the owner. Add
     "— blocked: {what}" when blocked; a line an entry deferred carries
     "— (from: ID, YYYY-MM-DD)". A phase is an H3 under Current; a phase
     close marks it "### Phase N — name — CLOSED YYYY-MM-DD". An item
     with criteria or context has a file at project/items/ID.md (see
     project/items/_schema.md); the line is the index and carries the
     status. Carried from the canon record at 75ba7ae on 2026-10-01: every
     open ID, its mark, its blocker and its date; the canon bands are the
     phases; each item file holds the canon text verbatim. -->

## Current

### Review assurance — owner evidence

- [!] REV-03 — Unified pointer transactions · Review assurance — since 2026-10-01 — blocked: owner evidence — physical Android Chrome
- [!] REV-05 — Accessibility assurance · Accessibility assurance — since 2026-10-01 — blocked: owner evidence — NVDA/VoiceOver + forced-colours + reduced-motion emulation

## Next

**W5 — deepen the characterisation (TST-04 first)**

- [ ] TST-04 — Sidebar control and readout goldens · Characterisation P1 — since 2026-10-01
- [ ] TST-13 — Key table, element IDs, HTML ranges · Characterisation P1 — since 2026-10-01
- [ ] TST-05 — Event transcript golden · Characterisation P1 — since 2026-10-01
- [ ] TST-09 — Camera, dots, curvature, minor-end and time domains — since 2026-10-01
- [ ] TST-03 — Visibility mode matrix · Characterisation P1 — since 2026-10-01
- [ ] TST-08 — Mixin composition guards · Characterisation P1 — since 2026-10-01
- [ ] SPL-06 — `build.js` entry guard and exported functions · Refactor P2 — since 2026-10-01
- [ ] TST-11 — Behavioural tests for source-text assertions — since 2026-10-01 — blocked: SPL-06 impl (gated)
- [ ] TST-14 — Shell and ContextMenu safety tests · Characterisation P1 — since 2026-10-01
- [ ] TST-16 — Tighten the round-2 predicates · Characterisation P1 — since 2026-10-01

**W4 — remove clearly dead code (§20 Q8; mutate every branch of anything moved, and account for every survivor)**

- [ ] DEL-02 — Render dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEL-03 — Engine, geometry and bus dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEL-04 — Wiring dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEL-05 — UI, config and CSS dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04, TST-13 impl (gated)
- [ ] DEL-06 — Services dead API · Dead code P2 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEL-01 — Unused barrels · Dead code P2 — since 2026-10-01 — blocked: TST-04 impl (gated)

**Defects runnable now**

- [ ] DEF-28 — A failed recovery restore is silent · Live defect P2 — since 2026-10-01
- [ ] DEF-44 — A paused editor never idles · Live defect P2 — since 2026-10-01
- [ ] DEF-42 — A beacon-style change keeps the old schedule · Live defect P3 — since 2026-10-01
- [ ] DEF-45 — Announcements overwrite each other · Accessibility P3 — since 2026-10-01
- [ ] DEF-06 — Clear All leaves stale route state · Live defect P3 — since 2026-10-01

**Defects after their W5 test (§13 ground rule 8)**

- [ ] DEF-20 — Controls out of sync after Open and Clear All · Live defect P1 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEF-13 — A focused button swallows every shortcut · Accessibility P1 — since 2026-10-01 — blocked: TST-13 impl (gated)
- [ ] DEF-32 — Activating a list row loses focus · Accessibility P1 — since 2026-10-01 — blocked: TST-13 impl (gated)
- [ ] DEF-14 — A hint click stops a label toggling · Accessibility P1 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEF-15 — L resumes at the old J/K/L speed · Live defect P2 — since 2026-10-01 — blocked: TST-05, TST-13 impl (gated)
- [ ] DEF-19 — Camera-zoom edits skip undo · Live defect P2 — since 2026-10-01 — blocked: TST-04 impl (gated)
- [ ] DEF-22 — An inserted waypoint splits a branch run · Live defect P2 — since 2026-10-01 — blocked: TST-05 impl (gated)

## Icebox

- [ ] REV-07 — CI maturity · Engineering maturity — since 2026-10-01
- [ ] ICE-01 — Swatch-picker popover · UI polish — since 2026-10-01
- [ ] ICE-02 — Import-time palette conversion · Import/colour — since 2026-10-01
