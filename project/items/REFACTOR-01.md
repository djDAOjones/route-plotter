# REFACTOR-01 — Refactor in light of PM-Skills 3.1's frameworks

## Intent

The owner's sequence, 2026-10-14, verbatim: "my intention is that we will get the MVP out, then do a major refactor in light of pm-skills 3.1 where various code management frameworks (e.g. for encapsulation, dead code, etc) are coming into play that should make dev work more manageable going forwards, then we will do the major work of consolidating paths and crowds and introducing new features where everything is more modular." This item is the middle step. After CROWD-08 ships and before MERGE-01's v4 merge, a refactor makes the code more modular and development more manageable, so that the merge and the new features land on it. Its scope is for a plan to set with the owner, not for this filing.

## Acceptance criteria

The filing session's proposals, for the plan to confirm or replace with the owner:

- A written plan in `reviews/`, for the owner to decide, sets the refactor's scope. It names which PM-Skills 3.1 frameworks apply ("encapsulation, dead code, etc" are his examples, not a list), how they fit the adopted abstraction plan of 2026-09-22 and its open waves (W4's dead-code items DEL-01 to DEL-06, and the W5 tests), and the order of work.
- Codex reviews the plan before it executes, as it does every PLAN-N.
- The refactor changes no behaviour: saved projects, dots, timings, exports and the player stay as they are, and every existing test and golden stays green, none deleted, skipped or weakened.
- No new dependency without the owner's decision.

## Context and sources

- [The decisions](../decisions.md): this item's entry of 2026-10-14, and PLAN-4
- [CROWD-08](./CROWD-08.md): the MVP that comes first
- [MERGE-01](./MERGE-01.md): the v4 merge that follows
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md): the adopted plan whose waves are in the backlog
- [The architecture](../architecture.md)

## Notes

- 2026-10-14 — Filed on the owner's request, verbatim: "is the following in the backlog? if not, add it in:", followed by his sequence above. It was not in the backlog: Next held MERGE-01 alone, placed first by PLAN-4. Earlier the same day, asked whether to record the sequence in CROWD-08 part A's record or "leave the record alone until CROWD-08 ships", he had answered "leave until crowd 8 ships". This request supersedes that answer. Which frameworks PM-Skills 3.1 brings, and how they apply here, is for the plan to settle with him.
