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

### Ahead of Phase 1's pull requests — the owner's order of 2026-10-05 — CLOSED 2026-10-05

### After TST-16, ahead of Phase 1's other pull requests — the owner's word of 2026-10-05 — CLOSED 2026-10-05

### Phase 1 — Land the big run's open pull requests

- [~] TST-14 — Shell and ContextMenu safety tests · Characterisation P1 — since 2026-10-01
- [~] TST-08 — Mixin composition guards · Characterisation P1 — since 2026-10-01
- [~] DEF-45 — Announcements overwrite each other · Accessibility P3 — since 2026-10-01
- [~] TST-04 — Sidebar control and readout goldens · Characterisation P1 — since 2026-10-01
- [~] DEF-28 — A failed recovery restore is silent · Live defect P2 — since 2026-10-01

### Review assurance — owner evidence

- [!] REV-03 — Unified pointer transactions · Review assurance — since 2026-10-01 — blocked: owner evidence — physical Android Chrome
- [!] REV-05 — Accessibility assurance · Accessibility assurance — since 2026-10-01 — blocked: owner evidence — NVDA/VoiceOver + forced-colours + reduced-motion emulation

## Next

**The built-in examples — the owner's word of 2026-10-05**

- [!] EX-01 — Overhaul the built-in examples — since 2026-10-05 — blocked: the owner's direction on what each example shows — (from: CROWD-05, 2026-10-05)

**After TST-04 — the owner's order of 2026-10-05**

- [ ] UI-04 — A hint trigger of its own (UI-03's second part) — since 2026-10-05 — blocked: TST-04 — (from: GATELESS-1, 2026-10-05)
- [ ] CROWD-06 — Hold at end: the animation carries on after everything has finished — since 2026-10-05 — blocked: TST-04 — (from: CROWD-05, 2026-10-05)

**W5 — deepen the characterisation**

- [ ] TST-09 — Camera, dots, curvature, minor-end and time domains — since 2026-10-01
- [ ] TST-03 — Visibility mode matrix · Characterisation P1 — since 2026-10-01
- [ ] TST-11 — Behavioural tests for source-text assertions — since 2026-10-01

**Defects after their W5 test (§13 ground rule 8)**

- [ ] DEF-20 — Controls out of sync after Open and Clear All · Live defect P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEF-13 — A focused button swallows every shortcut · Accessibility P1 — since 2026-10-01
- [ ] DEF-32 — Activating a list row loses focus · Accessibility P1 — since 2026-10-01
- [ ] DEF-14 — A hint click stops a label toggling · Accessibility P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEF-15 — L resumes at the old J/K/L speed · Live defect P2 — since 2026-10-01
- [ ] DEF-19 — Camera-zoom edits skip undo · Live defect P2 — since 2026-10-01 — blocked: TST-04
- [ ] DEF-22 — An inserted waypoint splits a branch run · Live defect P2 — since 2026-10-01

**W4 — remove clearly dead code (§20 Q8; mutate every branch of anything moved, and account for every survivor)**

- [ ] DEL-02 — Render dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEL-03 — Engine, geometry and bus dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEL-04 — Wiring dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEL-05 — UI, config and CSS dead code · Dead code P1 — since 2026-10-01 — blocked: TST-04
- [ ] DEL-06 — Services dead API · Dead code P2 — since 2026-10-01 — blocked: TST-04
- [ ] DEL-01 — Unused barrels · Dead code P2 — since 2026-10-01 — blocked: TST-04

**Found defects**

- [ ] DEF-50 — Autosave failure unseen — since 2026-10-05 — blocked: DEF-28, DEF-45
- [ ] DEF-51 — Failed load leaves caches — since 2026-10-05
- [ ] DEF-54 — Outside drop moves rows — since 2026-10-05 — blocked: TST-04
- [ ] DEF-55 — List drop sends branch last — since 2026-10-05 — blocked: TST-04
- [ ] DEF-56 — Constant-time open unscheduled — since 2026-10-05
- [ ] DEF-57 — Branch majors lack clock — since 2026-10-05
- [ ] DEF-58 — Export edits change scene — since 2026-10-05
- [ ] DEF-60 — Refused rejoin half-restored — since 2026-10-05
- [ ] DEF-62 — Space at end stalls — since 2026-10-05
- [ ] DEF-63 — Shortcuts take modifier chords — since 2026-10-05
- [ ] DEF-65 — Branch place: two undos — since 2026-10-05
- [ ] DEF-66 — Export settings skip autosave — since 2026-10-05
- [ ] DEF-67 — Open announces "paused" — since 2026-10-05 — blocked: DEF-45, DEF-28
- [ ] DEF-68 — Paused camera controls sleep — since 2026-10-05
- [ ] DEF-69 — Zoom warning unattached — since 2026-10-05
- [ ] DEF-70 — Menu item drops focus — since 2026-10-05 — blocked: TST-14
- [ ] DEF-71 — Unknown build flag releases — since 2026-10-05
- [ ] DEF-73 — Leg card misnames waypoint — since 2026-10-05
- [ ] DEF-74 — Redo restores no selection — since 2026-10-05
- [ ] DEF-75 — Index check misses references — since 2026-10-05
- [ ] DEF-76 — Leg-speed edit stales timing — since 2026-10-05
- [ ] DEF-78 — Comet tail retimes crowds — since 2026-10-05 — (from: CROWD-05, 2026-10-05)
- [ ] DEF-79 — Render space moves crowd anchors — since 2026-10-05 — (from: CROWD-05, 2026-10-05)
- [ ] DEF-80 — Player retimes constant-time projects — since 2026-10-05 — (from: CROWD-05, 2026-10-05)

## Icebox

- [ ] REV-07 — CI maturity · Engineering maturity — since 2026-10-01
- [ ] ICE-01 — Swatch-picker popover · UI polish — since 2026-10-01
- [ ] ICE-02 — Import-time palette conversion · Import/colour — since 2026-10-01
