# REFACTOR-01 — Plan the port of v3's engine into v4

## Intent

The owner's sequence, 2026-10-14, verbatim: "my intention is that we will get the MVP out, then do a major refactor in light of pm-skills 3.1 where various code management frameworks (e.g. for encapsulation, dead code, etc) are coming into play that should make dev work more manageable going forwards, then we will do the major work of consolidating paths and crowds and introducing new features where everything is more modular." This item is the middle step. After CROWD-08 ships and before MERGE-01's v4 merge, a refactor makes the code more modular and development more manageable, so that the merge and the new features land on it. Its scope is for a plan to set with the owner, not for this filing.

## Acceptance criteria

As narrowed on 2026-11-18 (the Notes); the filing session's proposals of 2026-10-14 are kept there:

- The port plan is one written document with MERGE-01's architecture plan, in `reviews/`.
- For each piece of v3's engine (drawing, timing, crowds, export, file safety) it says whether the piece is ported, how, and with which tests, or why a port is not worth it, for the owner to decide.
- A test that pins an open defect as it stands is not ported as a requirement (DEF-79 and DEF-51 are the known cases).
- Every note for the port on the stock take's held list (`reviews/v4-stock-take-2026-11-18.md`) is given a home or brought back to the owner.
- Codex reviews the plan, read-only, before the owner's question round; no code before that round.

## Now

Updated: 2026-11-18

Next step: Written with MERGE-01's architecture plan, on the owner's word.

Open question: None before the plan is written.

## Context and sources

- [The decisions](../decisions.md): this item's entry of 2026-10-14, and PLAN-4
- [CROWD-08](./CROWD-08.md): the MVP that comes first
- [MERGE-01](./MERGE-01.md): the v4 merge that follows
- [The abstraction plan](../../reviews/codebase-abstraction-and-auditability-plan-2026-09-22.md): the adopted plan whose waves are in the backlog
- [The architecture](../architecture.md)

## Notes

- 2026-10-14 — Filed on the owner's request, verbatim: "is the following in the backlog? if not, add it in:", followed by his sequence above. It was not in the backlog: Next held MERGE-01 alone, placed first by PLAN-4. Earlier the same day, asked whether to record the sequence in CROWD-08 part A's record or "leave the record alone until CROWD-08 ships", he had answered "leave until crowd 8 ships". This request supersedes that answer. Which frameworks PM-Skills 3.1 brings, and how they apply here, is for the plan to settle with him.
- 2026-11-18 — Narrowed by the stock take, on the owner's ruling ("Yes, as proposed (Recommended)"), to the port: which pieces of v3's engine move into v4, how, and with which tests, written as one plan with MERGE-01. His words (Q1): "Port v3's engine (drawing, timing, crowds, export, file safety) into it with its tests rather than rewriting it; the architecture plan decides piece by piece where a port isn't worth it. This overrules \"Never rewrite\"; shrink REFACTOR-01 to match." The no-behaviour-change refactor of v3 above no longer stands. The notes for the port in `reviews/v4-stock-take-2026-11-18.md` are merged here.
- 2026-11-18 — PLAN-5 puts this item in Phase 5 as the port half of the architecture plan and replaces its criteria with the port's. The owner's instructions in force, verbatim: the Q1 sentences quoted in the note above, and, from his task message, "The first item is the architecture plan (MERGE-01 and REFACTOR-01's written plan, reviewed by Codex, then my question round), before any code." The filing session's criteria of 2026-10-14, which no longer stand, word for word: The filing session's proposals, for the plan to confirm or replace with the owner: / - A written plan in `reviews/`, for the owner to decide, sets the refactor's scope. It names which PM-Skills 3.1 frameworks apply ("encapsulation, dead code, etc" are his examples, not a list), how they fit the adopted abstraction plan of 2026-09-22 and its open waves (W4's dead-code items DEL-01 to DEL-06, and the W5 tests), and the order of work. / - Codex reviews the plan before it executes, as it does every PLAN-N. / - The refactor changes no behaviour: saved projects, dots, timings, exports and the player stay as they are, and every existing test and golden stays green, none deleted, skipped or weakened. / - No new dependency without the owner's decision.
