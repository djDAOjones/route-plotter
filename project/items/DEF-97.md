# DEF-97 — Busyness fields drop typed values

## Intent

On a crowd's busyness graph (Release › More), each handle's Busy field and an interior handle's Time field commit only on `change` or Enter (`src/app/crowds.js` (:383), (:1471)), and the commit reads the crowd from the selection (`_changeCrowdBusynessControl`, (:702)). A value typed there and not committed is lost three ways: a waypoint clicked on the canvas closes Crowd scope while focus stays in the field (the canvas press keeps it, `src/handlers/InteractionHandler.js` (:302)), so the `change` that comes when focus leaves finds no crowd selected and writes nothing, and back on the crowd the rows are rebuilt from the model; a handle dragged on the graph rebuilds the rows on every move ((:814) → (:1389)), taking the typed field and its focus with it; and a cancelled drag shows the crowd afresh (:828). The end handles' Time fields are read-only (:1398). It was on main before CROWD-07's PR 5b, whose own number fields and seed commit a value typed and not committed to the crowd or path it was typed for (that PR's rounds 2 and 3); the PR's round-3 audit found it and Codex r3 confirmed it ("record separately"). The lead confirmed it in Chromium on live v3.2.715 (2026-10-12): the Visitors crowd, Release › More, Handle 1's Busy field, 40 typed with no Enter, the Library waypoint clicked on the canvas: the waypoint selected, Crowd scope closed, the envelope still [1, 1], the 40 gone. **P3**

The crowd rename field in Layers (`_startCrowdRename`, (:1074)) commits on blur or Enter only (:1115), and every Layers strip rebuild removes it (`strip.innerHTML = ''`, (:854)); its commit rebuilds the strip again (:1089), inside the outer rebuild when the removal fires the blur. The audit's jsdom repro lost the typed name, but in Chromium the lead found it safe (live v3.2.715, 2026-10-12: "Guests" typed in Visitors' rename field with no Enter, the Library waypoint clicked on the canvas: the crowd is named "Guests", the field's blur committing it as the Layers row is rebuilt, two Layers rows, none doubled). Codex r3's follow-up: settle the rename explicitly before the strip is replaced, and make the rebuild safe against re-entry; doubled rows are not established, since they depend on when the blur fires. A hardening, not a seen loss; it rides with this row's fix.

## Acceptance criteria

- The fix is decided before it is made: either a value typed in a Busy or interior Time field and not committed goes to the crowd and handle it was typed for before Crowd scope closes or the rows are rebuilt, as PR 5b's number fields do, or the fields commit as they are typed, as the Node card's path weights do.
- The rename field is settled before any strip rebuild removes it, and a rebuild that starts inside another draws each Layers row once.
- A regression test fails on the defect before the fix and passes after it: Handle 1's Busy 100, 30 typed with no Enter, a waypoint tapped by the pointer, then back on the crowd: Busy 30 in the model and the field; and an interior handle's Time typed, then a handle dragged on the graph: the typed time kept.
- Every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/crowds.js` (:383, :702–725, :814, :828, :1389–1400, :1457–1474) — the busyness fields, their commit and the rebuilds that replace them
- `src/app/crowds.js` (:854, :1074–1115) — the Layers strip's rebuild and the rename field
- `src/handlers/InteractionHandler.js` (:302) — the canvas press that keeps focus in the field
- `src/utils/uiReadouts.js` (:142–170) — `noteShownValue`, `changedSinceShown` and `draftOwner`, PR 5b's rule for a value typed and not committed
- [CROWD-07](./CROWD-07.md) — the review whose PR 5b (#128) found it
- [The decisions](../decisions.md) — REL-716 (the filing)

## Notes

- 2026-10-12 — Filed in the REL-716 record from CROWD-07's PR 5b: its round-3 audit of the typed controls on main (the PR's report, §10.7, outside the repository) and Codex r3's two audit findings (REAL, already on main, "record separately"), the busyness loss confirmed and the rename found safe in Chromium by the lead. The Node card's path weights are safe: a valid weight is written as it is typed, and a refused one is said once and goes with the card. No fix is decided. P3 is the filing session's proposal, as with every new DEF row; the owner set no priority.
