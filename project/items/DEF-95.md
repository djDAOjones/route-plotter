# DEF-95 — Network loop sway varies per lap

## Intent

A crowd on "Repeat journey" (lifecycle `loop`) repeats its walk exactly on a route, but on a custom network with Walking variation above 0% its sideways sway differs on every lap; its paths and pace repeat. `_walkLoop` wraps the path position (`distance % journeyLength`, `src/services/SwarmEngine.js` (:852)) but passes the unwrapped distance to the sway (:859, and :864 at the journey's last point), whose phase runs on that distance (`_wobbleOffset`, :555-563). The route walk wraps `distance` before it samples (:609), so a route lap repeats exactly. The comment at :857-858 says the network loop keeps the total distance on purpose, so that the sway stays continuous across the wrap. Repro (Codex, PR 5a round 1): one straight Entry→Exit path from (0.2, 0.5) to (0.8, 0.5), seed 42, speed 1, pace variation 0, wobble 1, immediate release; at 200 ms and 800 ms, one journey apart, x is 0.4 both times, but y is 0.502283 and then 0.484122. No fix is decided. **P3**

## Acceptance criteria

- The fix is decided before it is made: either each network lap repeats exactly, its sway included, as a route lap does, or the sway's drift stays and the hint keeps saying only that paths and pace repeat.
- If exact repetition is restored, a test samples a network-loop dot one journey apart with Walking variation above 0% and asserts the same position, sway included, and the "At journey end" hint may go back to the stronger wording.
- A regression test fails on the defect before the fix and passes after it.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/services/SwarmEngine.js` (:555-563, :609, :824-865) — the sway's phase, the route's wrap, the network loop
- `index.html` — the "At journey end" select and its hint
- [CROWD-07](./CROWD-07.md) — the review whose PR 5a (#123) found it
- [The decisions](../decisions.md) — REL-713 (the filing and the owner's answers)

## Notes

- 2026-10-11 — Filed in the REL-713 record on the owner's answers of 2026-10-10 (labels verbatim): on PR 5a's hint clause "Keep the new wording (Recommended)", so the "At journey end" hint says "Repeat journey follows the same paths again at the same pace", which is true either way; on the row "File a DEF row (Recommended)" (option text: "Record it as a defect, to be decided and fixed later in the DEF queue. Nothing changes in the app now."). Codex found it in round 1 of CROWD-07's PR 5a (#123, 2026-10-09), against that PR's first wording, which promised the same walk exactly. No fix is decided, and the row is not a design decision. If a fix restores exact repetition, the clause can go back to the stronger wording. P3 is the filing session's proposal, which the owner took with the rest of his audit's recommendations ("Proceed as per your recommendations", 2026-10-10).
