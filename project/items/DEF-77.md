# DEF-77 — "At journey end" has no visible effect

## Intent

A crowd's "At journey end" setting (Disappear, Collect, Respawn, Repeat journey) has no visible effect in ordinary use. The four modes act correctly when a dot reaches its journey end, but at default settings dots rarely finish before the timeline ends: crowd speed and the timeline's length are independent, so whether any finish depends on the editor's canvas width. Pen-drawn networks never end a journey, because pen nodes pass through and edges run both ways, so a dot turns back at a dead end. Respawn equals Repeat journey wherever there are no junctions. The owner reported it ("dont think 'at journey end' parameters are working"); the Backlog status session confirmed it with a Node probe of the real SwarmEngine on 2026-10-05 and relayed it to this run for filing. A defect against an existing control, fixed under the owner's "fix defects along the way" (2026-09-28) and GATELESS-1.

## Acceptance criteria

- On a pen-drawn three-node network at model defaults and a fast speed, Disappear leaves no dots late and Collect parks them on the end nodes; the test fails today.
- A default route crowd on a typical canvas has dots that finish, or the panel shows a hint under "At journey end" that none do, which clears once Speed is raised.
- After the first journey, Respawn's dots take positions Repeat journey's do not (positional assertions in place of the count-only check), and Repeat journey stays an exact replay.
- The authorable-load test passes `lifecycleMode`, not the ignored `lifecycle`, so its case runs in the mode it names.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- The owner's answers, relayed verbatim by the Backlog status session (2026-10-05, about 08:20): on the timing fix, "your choice but no backwards compatibility needed"; on Respawn against Repeat journey, "Make Respawn vary".
- `src/services/SwarmEngine.js` — the mode read at an Exit or a true dead end (:400-413), the entry fallback (:363-366), Respawn on route crowds (:318-333), `scheduleDots` (:149)
- `src/services/NetworkEditService.js` (:350-353) — pen nodes pass through, edges run both ways; `src/utils/graphRouting.js` (:27-29) — the turn back at a dead end
- `src/models/Emitter.js` (:63) — crowd speed; `src/app/pathTiming.js` (:543-550) — the timeline; `src/app/crowds.js` (:630-636) — new-crowd defaults
- `tests/swarmEngine.test.js` (:452-466) — the count-only Respawn check; `tests/authorableLoadable.test.js` (:632) — `lifecycle: 'collect'`, an ignored key

## Notes

- 2026-10-05 — The fix shape is the relaying session's proposal, not the owner's words. (a) A network with no Exit nodes treats its one-connection nodes as exits, mirroring the entry fallback, or the pen types end nodes as Exit; the implementer chooses. (b) That session's choice under the owner's delegation ("your choice"): both new-crowd defaults under which a default crowd's dots finish on a typical canvas (its probe: Speed 0.40 with Window length 50% finished 50 of 50) and the hint when no dot finishes. (c) The owner's "Make Respawn vary": each respawned journey draws fresh variation from the seed and the journey index. Workaround meanwhile: Speed about 0.4 or more, Window length about 50%, end nodes set to Exit, or Trace route into network.
