# AGENTS.md — the contract

Twelve rules. The ledger is `project/`; the gate and the standards are
in `project/profile.md`. Tools enforce what they can; this states it.

1. **Read before your first change, and again after a compaction
   before your next change:** `project/profile.md`, the rules file
   `project/rules.md`, the Direction section of `project/brief.md`, the
   open items in `project/backlog.md`, the latest ten entries of
   `project/decisions.md` as their heading, Decision and Deferred
   lines, and the latest item lines of `project/trajectory.md` within
   its budget, never fewer than the last four shipped items.
   Read the full brief at kick-off and after a substantial amendment;
   read a Rationale, the full brief, a routed document or an item file
   when the task needs it, and no sooner. Edit nothing before these are
   read.
2. **The owner directs; you implement.** Direction lives in the brief
   and the backlog; you do not re-scope an item. When the record does
   not answer a question, ask the owner. Never fetch a record from
   outside this repository.
3. **One item, one permanent ID.** Resume that ID across sessions.
   Name it in every entry and every commit; one writer per checkout at
   a time; a second session works in its own clone or worktree and
   hands back by commit; a session stages only its own item's lines
   from HEAD.
4. **A decision another session would need** goes in
   `project/decisions.md`, newest first: date, ID, a Decision line, a
   Rationale line. A decision that changes an earlier one names it on
   a Supersedes line.
5. **Deferred work is a line, not a sentence.** A deferral, follow-up
   or "later item" named in any entry, trajectory line or commit is
   also one line in `project/wish-list.md` or `project/backlog.md`.
   Nothing is dropped silently.
6. **On finishing:** strike the item from the backlog, add one line to
   `project/trajectory.md` (`- ID — outcome (date) — see decisions`),
   and retire any open line the work paid off.
7. **Done means the gate is green** — the command in the profile — with
   no test deleted or skipped. Dependencies change only by decision.
8. **A task that touches a standard** in the profile applies its rules
   and names, at close, the digest rule it applied. An exception is a
   decision.
9. **Commit as `ID: summary`** with a `Verify:` line stating the gate
   result and, optionally, a `Checked: <model> — <verdict> — <scope>`
   line for a second model's check; commit only this item's files at
   close; push as the profile's Push line says.
10. **Run `node tools/check.mjs` before closing.** A structural or
    budget failure blocks the close; review warnings, fixing them or
    linking one existing follow-up. Informational messages create no
    new work.
11. **At a phase close,** reconcile the phase against its list in the
    record, mark it closed in the backlog, name the next phase's first
    item with a reason, and run `verbs/recall.md`.
12. **This contract has twelve rules.** Adding one retires one, or
    cites evidence in the decisions file.
