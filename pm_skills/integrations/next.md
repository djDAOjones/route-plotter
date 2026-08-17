---
description: Pick the next backlog item and ship it end-to-end (Start B pick → auto-jazz build → close)
---

The one-word "run the next backlog item" trigger. It composes three
existing workflows — no new mechanism — so a trusted backlog burns
down without re-stating the ritual each session:

1. `pm_skills/prompts/session-start.md` → **Start B** picks the next
   batch.
2. `pm_skills/integrations/task.md` → **auto-jazz** builds it.
3. `pm_skills/prompts/end-of-task.md` closes it.

Use it when you trust the backlog order and want the agent to advance
it without stopping for a scope or design sign-off on every item.
Invoking it **is** the go-ahead: the agent states the pick in one line
and continues, rather than stopping for Start B's confirmation.

**Scope: one item per invocation.** A "batch" is the smallest
shippable unit (a single backlog item, or a tight cluster sharing the
same files). The trigger ships exactly that, then stops and reports —
run it again for the next one. It never burns down the whole backlog
unattended.

To run two or three genuinely disjoint items at once in parallel
chats, use `integrations/dispatch.md` — it assigns lanes and briefs
and integrates the results; this trigger stays strictly one-item.

## Guardrails (never weakened)

This trigger normalises gateless runs, so the guardrails that make
that safe are load-bearing — none is optional:

- **`[sign-off]` escalates to `full` mode.** An item flagged
  `[sign-off]` (or otherwise high-risk) is **not** run auto-jazz: run
  `task.md` in `full` mode and stop at every gate. The one-word trigger
  never overrides an item's own sign-off requirement.
- **Wish-list triage still runs** at the pick (Start B step 1): drain
  or defer parked ideas before choosing work.
- **The reconcile gate still holds.** If unreconciled `Close: lite`
  closes are over the cap (`session-start.md` → "Check for
  unreconciled lite closes"), propose **Reconcile** and pick no new
  work until it clears.
- **Hard prohibitions still stop-and-ask.** The canonical list in
  `task.md` ("Hard prohibitions") applies unchanged — a new runtime
  dependency, a protected/never-edit file, a destructive migration, an
  out-of-scope sprawling refactor, or a weakened test all stop the run
  and ask, in any mode.
- **Close stays `full` by default.** `lite` only if you actually say so
  (`task.md` step 10) — and never for a `[sign-off]` item.

## Steps

1. **Run Start B.** Follow `pm_skills/prompts/session-start.md` →
   Start B: load context, run the environment preflight and the
   reconcile / doc-delta counts, triage the wish-list, and pick the
   next batch from `pm_skills/project/backlog.md` Active (Current
   milestone first). State the pick in one line — the item(s) quoted,
   why it's next, and what it touches — then continue. Do **not** wait
   for a separate go-ahead; the trigger is the go-ahead. Stop only if
   the reconcile gate blocks, the Active section is empty, or the pick
   is genuinely ambiguous between equal candidates.

2. **Read the item's ticket if it has one.** If the backlog line
   carries `[detail]`, read its `pm_skills/project/tickets/<ID>.md`
   before scoping — it may already hold the approved scope and picked
   option; don't re-derive what it answers.

3. **Choose the mode.** Default **auto-jazz** (state each assumption
   in one line and continue). Escalate to **full** for a `[sign-off]`
   or high-risk item; use **spike** for a `[spike]` item; use
   **refactor** for behaviour-preserving restructuring. See
   `task.md` → "Modes".

4. **Run the item.** Follow `pm_skills/integrations/task.md` in the
   chosen mode. At every skipped gate, make the best conservative
   decision, state the assumption in one line, and continue; stop only
   for a genuinely blocking ambiguity or a hard prohibition.

5. **Close.** Follow `pm_skills/prompts/end-of-task.md`: quality gate,
   boot check if the runtime changed, memory updates, size check.
   After this gateless run, suggest `pm_skills/prompts/review.md`
   before the work is accepted. Recommend a commit with a staged-set
   echo — never auto-commit.

6. **Report and stop.** One short report: what shipped, the gate
   result, any assumptions made at skipped gates, and any ideas parked
   to the wish-list. Then stop — one item per invocation. Run the
   trigger again to advance to the next.
