# DEF-89 — Guide helper stale after trace

## Intent

After "Trace route into network" the toast says "Traced the route into Crowd 1 — 3 nodes, 3 paths" but the Guide card's helper still reads "No network yet — Edit network hands you the pen." until Edit network is entered, when it reads "Dots walk this crowd's own network (3 nodes, 3 edges)." The trace exits the mode before the graph is replaced and nothing refreshes the Guide card afterwards (`src/app/crowds.js` lines 747-749; `src/app/network.js` line 106). Seen in Chromium on 2026-10-08. UI-STANDARDS System status. **P3**

## Acceptance criteria

- The Guide helper is true immediately after a trace, after Undo of a trace, and after the outline edits the network.
- A test traces and asserts the helper text without entering Edit network.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/crowds.js` (:728-762) — the trace
- `src/app/network.js` (:106, :405-416) — the helper and its refresh
- [The walkthrough](../../reviews/design-review-walkthrough-2026-10-08.md) — shot 15
- [Codex's verdict](../../reviews/design-review-second-opinion-2026-10-08.md) — CONFIRMED
- [UI-06](./UI-06.md) and [CROWD-07](./CROWD-07.md) — the reviews that found it

## Notes

- 2026-10-08 — Filed from the design reviews' defect candidates on the owner's acceptance of the twelve proposed rows ("Accept all as proposed (Recommended)", 2026-10-08). Found in the Chromium walkthrough; Codex: CONFIRMED. CROWD-07's words PR may fix it in passing; this row closes with whichever PR does. The priority is the reviewing session's proposal, accepted with the row.
