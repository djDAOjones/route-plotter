# close — end of task

One writer per checkout at a time; a second session works in its own
clone or worktree and hands back by commit; stage only this item's
lines from HEAD. Finish the record before checking and committing.

1. Standards: name each applicable digest rule in the decision or
   commit. Exceptions are decisions.
2. Record: write decisions another session needs — what and one-line
   why on the Decision line, evidence in the Rationale. Remove the
   open item, add its trajectory line, retire paid lines. Capture
   outstanding deferrals once. Optional `**Deferred:**` IDs make named
   targets checkable; review prose, trajectory and commit meaning too.
   Every removed open line needs a trace.
3. At phase close, follow Phase close.
4. Follow Session end if context has passed the profile's Session
   line, after compaction, or wherever a whole-phase run stops.
5. Stage, then run the profile's gate and `node tools/check.mjs` after
   all edits. Structural and budget failures block close. If over
   budget, follow Over-budget trim. Answer each removed-line flag
   before committing. Fix other warnings or link one existing
   follow-up; INFO messages create no work. Above 45 live decisions,
   follow Archive. Restage and rerun checks after further record
   edits. Use the checker's messages for budget escalation, trace
   dispositions and Session-end grammar.
6. Generate `node tools/view.mjs`; commit as `ID: summary` with
   `Verify:` stating the gate result and harness. A second model
   checking the work is briefed from the record — the item's criteria
   (its file, otherwise its backlog line), the diff, the rules file's
   Always section and any routed document the task fires — not from
   a chat prompt; one optional line
   `Checked: <model> — <verdict> — <scope>` records its check.
   Run `node tools/check.mjs --commit HEAD`: declaration shapes cannot
   prove execution.
7. Push as the Push line says: by default the harness pushes to the
   project's origin, never to an upstream the project does not own.
   Report a pending push if it fails or Network blocks it.

If the owner is needed, retain an open `[!]` line with the blocker.
Never mark unfinished work shipped or invent signatures or results.

## Session end

If the threshold has been passed or this session has compacted, this close is its last: before checks and commit, record any owner instruction still in force that the record lacks, in its existing home — a decision, an item note, a backlog or wish line. Neither a re-read nor a lower reading cancels the end; in an attended session the owner may direct otherwise, recorded, never inferred. At that end, or wherever a whole-phase run stops, put exactly one Session-end line beside `Verify:` and any `Checked:` in the commit body, in the shape `node tools/check.mjs --commit HEAD` states when it refuses one. An attended end with neither trigger, outside a whole-phase stop, needs no line; a session that cannot close writes none and never fakes a close. At a session end, after the push step, repeat the Session-end line in your last message and stop.

## Phase close

Reconcile against the PLAN-N `**Items:**` list, mark the backlog phase CLOSED with its date, and record the next phase's first item and reason, or that owner direction is needed. Then run `verbs/recall.md` and store its labelled result.

## Archive

Run `node tools/archive.mjs`, review the verbatim moves and rebuilt index, then restage and rerun both checks. Interrupted moves may leave duplicates: compare them before retrying; never discard unmatched content.

## Over-budget trim

Resolve the failure, record any owner budget raise, and revalidate before closing.
