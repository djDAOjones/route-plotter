---
description: Initiate parallel dev work in parallel chats — pick a disjoint set, assign lanes and the primary, emit paste-ready briefs, then integrate
---

The entry move for parallel sessions. Where `integrations/next.md`
ships one item per invocation, dispatch hands out several at once —
one per parallel chat — and makes the dispatching session the
**primary** that integrates the results. It composes pieces that
already exist — the Start B pick (`prompts/session-start.md`), the
coordination conventions (`GUIDE.md` → "Parallel and multi-machine
work"), and the secondary close (`prompts/end-of-task.md`) — adding
only the disjoint pick, lane assignment, and the brief format.

Use it when the backlog holds two or three genuinely independent
items and a human can attend several chats. Run `next.md` instead
when items share files, when only one item is ready, or when most
of the batch would change the release-bearing tree and so serialise
at integration anyway.

## Guardrails (never weakened)

- **Every `next.md` guardrail applies per lane.** `[sign-off]`
  escalates that lane to `full` mode; one item per lane; the hard
  prohibitions of `integrations/task.md` stop that lane and ask;
  close `full` by default. One dispatch set per invocation, never
  more than three lanes.
- **One writer.** Exactly one primary — the dispatching session.
  Lanes never write the shared memory files (decision log,
  trajectory, wish-list); they close secondary and hand off
  (`prompts/end-of-task.md` → "Secondary-session close").
- **At most one lane touches the release-bearing tree**
  (`pm_skills/` and the root templates). Lanes never bump `VERSION`
  or prepend the changelog — the primary releases **once**, at
  integration, covering every lane's distributed change.
- **No lockfiles, no claims ledger.** Dispatch state is the pick
  commit plus the briefs; a crashed or abandoned lane must cost
  nothing (its branch sits unmerged; its item stays open).
- **Human-mediated fan-out.** The human opens each chat and pastes
  its brief. Dispatch never widens what a single session may do —
  it multiplies attended sessions, not autonomy.
- **Records mode recommended.** Per-item records merge mechanically
  (`GUIDE.md` → "Parallel and multi-machine work"). Prose-memory
  projects still dispatch, but fall back to the advisory-claim
  protocol and route every memory change through the handoffs.

## Steps

1. **Pick a disjoint set.** Run the Start B pick
   (`prompts/session-start.md`) selecting **two or three** items
   instead of one, subject to: predicted touch sets do not overlap
   (ground them in the file map and any ticket detail; when in
   doubt, serialise); at most one lane touches the release-bearing
   tree; blocked items are skipped as usual. State the set — item,
   predicted touch set, mode, branch name — and name this session
   as primary. If no two Active items are disjoint, say so and
   fall back to `next.md`.

2. **Publish the pick.** Commit the pre-dispatch state (in records
   mode, mark the dispatched items in progress and regenerate the
   view) so every lane forks the same base commit.

3. **Assign lanes.** Per item: a branch (`lane/<item-id>` from the
   base commit), a mode (auto-jazz default; `full` for
   `[sign-off]`), and a **working tree of its own** — a second
   clone or a git worktree. Never point two live sessions at one
   checkout, and never put a working tree inside a cloud-synced
   folder (`GUIDE.md` → "Parallel and multi-machine work"). Create
   the trees and branches now if tooling allows; otherwise the
   brief carries the setup line.

4. **Emit the briefs.** One fenced block per lane, paste-ready, in
   the format below. Pointers, not restatements — each lane reads
   the prompts inside its own tree.

5. **Dispatch and hold.** The human opens one chat per lane and
   pastes its brief. This session stays open as the primary (or is
   reconvened when lanes report). Take on no competing work here —
   the primary's next job is integration.

6. **Integrate** as lanes report done:
   - Merge each lane branch into the main branch — source-only
     lanes first, the release-bearing lane last.
   - On any generated-view conflict, **regenerate from the merged
     records and stage the result — never hand-merge the view.**
   - Apply the handoff blocks serially: trajectory lines, decision
     entries, wish-list captures — the shared-file writes the lanes
     deferred.
   - Ship each returned item per the normal close: remove or
     archive it, compress on ship. A lane that never returned
     stays open — integrate what came back; never block on it.
   - If any lane changed the release-bearing tree, run
     `prompts/release.md` **once** for the whole set.
   - Run the quality gate on the merged whole; close `full`
     (`prompts/end-of-task.md`) with one staged-set echo; commit
     and push.

## The brief (one per lane)

```text
You are a dispatched lane (secondary session; the dispatching chat
is primary). Read AGENTS.md at the tree root, then work ONLY this
item. State your lane and touch set as your first message — that
is your parallel-session claim.

Item: <ID> — <one line>          Mode: <auto-jazz | full | spike>
Branch: lane/<item-id>           Tree: <path — its own working
                                 tree, outside any synced folder>
Touch set (stay inside it): <predicted files or areas>

Rules:
- Stage and commit only your own paths; one item, one branch.
- Never write the shared memory files (decision log, trajectory,
  wish-list, backlog view) — the primary integrates them from
  your handoff.
- Never bump VERSION or prepend the changelog — the primary
  releases once at integration.
- The hard prohibitions of integrations/task.md stop and ask.

Close: run the quality gate; commit on your branch (push only if
your tree is on another machine — git is the sync channel); then
emit the handoff block per prompts/end-of-task.md →
"Secondary-session close" and stop.
```

The primary fills the placeholders per lane. Add lane-specific
lines sparingly (a scope note, a known constraint); the brief
should stay under a screen — it is a pointer set, not a workflow.
