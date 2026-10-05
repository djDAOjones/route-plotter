# plan — a review into a phase

Runs when the owner asks for a plan, at a phase close, or when the
backlog's Current milestone is empty. Writes the artefact the long
stream found most cited: a phase with an itemised list and a stated
direction.

1. **Read** the rule-1 set, the whole backlog and the full brief; read
   a whole decision entry only where its Decision line does not
   answer. Read the code only where the brief or the owner points.
2. **Review** against the brief and the adopted standards: what is
   broken, missing, or short of a rule that bites. Each finding is one
   line with the evidence (file and line, or the standard's rule).
3. **Propose** one phase: a name, a direction sentence (why this
   phase, why now), and its items as backlog lines with IDs, ordered,
   under `### Phase N — name` in `## Current`. Items that do not fit
   go to `## Next` or `## Icebox` with the reason in the line. Anything
   the owner must decide gets the `[!]` mark. An item with criteria or
   context worth keeping gets a file under `project/items/`, named by
   its ID, to the schema in `project/items/_schema.md`; a line that came from the wish-list is
   promoted here or deleted, never both places. A line that exists
   because a decision entry deferred something carries
   "— (from: ID, YYYY-MM-DD)", which is rule 5 satisfied in the
   backlog rather than the wish-list.
4. **Record** the direction as one decision entry (ID `PLAN-N`) whose
   `**Items:**` line lists every phase item ID, comma-separated, and
   whose Rationale names the review findings the phase answers and the ones
   it defers. Deferred findings are lines, per rule 5.
5. **Generate the view** with `node tools/view.mjs`. The owner signs
   off by starting the first item, or by an existing instruction to
   plan and execute. Otherwise stop for that direction. For authorised
   execution, follow "Step 5 — Execute the phase" below. Write the plan
   so another harness could execute from the record alone.

## Step 5 — Execute the phase

When the owner authorises execution, the session may run the phase's
items in order to the phase close or to the first line that needs the
owner, closing each item as the close verb says; the run also stops at
the close where the close verb ends the session.
