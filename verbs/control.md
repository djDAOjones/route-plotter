# control — a phase, each item in a new chat

<!-- cspell:ignore worktrees -->

An add-on no rule reads (specification 3.15, the controller), for a
top-level chat the owner opens to run one authorised phase, each item
in a new chat it starts. Starts and wakes are the app's; every rule
binds every chat.

1. **Who opens it.** Only the owner, by hand: a new top-level chat in
   the checkout where the phase's work lands, and one message naming
   the phase, the most workers to start, their model and effort, and
   that each item runs in its own new session started here without
   asking him. The controller never edits, stages or commits, nor
   works an item; its workers write one at a time in this folder, so
   need no worktrees.
2. **Before the first start**, in his turn, ask him what his message
   lacks. The phase must be open and authorised (plan verb, Step 5),
   its first open item not `[!]` or `blocked:`, and a current end, if
   any, must name that item.
3. **The claim.** An end current at opening is claimed by this chat's
   start notice, so the first worker sees it held. Held by another
   chat, or unconfirmed: ask him and start nothing. Claimed here: the
   first worker's brief quotes his word, from his message or asked
   for, that it takes that end, with its commit, while this chat stays
   a reader. Never clear a claim, or seed a commit, to get round one.
4. **Before every start:** `git status --porcelain` empty;
   `node tools/check.mjs` and the profile's Gate green, then the tree
   still clean and HEAD and the branch unchanged; no other chat
   running here, by the session list without `linked`.
5. **The worker's brief** is `node tools/brief.mjs <ID>`'s output and:
   "Read the rule-1 set. Do only `<ID>`; close it as the close verb
   says, with exactly one Session-end line, even below the Session
   line, as a whole-phase run's stop; repeat the line and stop. Never
   start, hand off, detach, clear or message a chat, nor work a second
   item. Stop, saying why, at a red gate, a question for the owner or
   anything unexpected." Start it fresh, here, at his model and
   effort, never detached, so the app wakes this chat.
6. **After each worker**, read Git: a new HEAD descended from its
   start; every commit since titled with its item, the newest its
   close, passing `node tools/check.mjs --commit HEAD` with one
   Session-end line and pushed as the Push line says. Then step 4; if the end is continue,
   naming the phase's next open item, not `[!]` or `blocked:`, start
   that worker in the same turn.
7. **Stops.** Stop, telling the owner why, at the first of: a start
   refused, by the app or a classifier, quoted, never reworded or
   retried; a red checker or gate, or a failed Git read; an owner or
   done end; a dirty tree, a moved branch, or a commit not the
   worker's; a worker's turn ending without a new close, with a
   question, never answered for him, or with its push pending; the
   worker count reached; this chat past its Session line, or
   compacted. A turn a peer's message opens starts nothing; a missing
   wake grants no retry. His next message resumes through the stopped
   step's checks, never resetting the count or a Session-line stop; or
   he opens a new controller, which this chat never starts.
8. **Workers never start chats** (orchestrate rule 1). Only the
   controller starts one: in the owner's turn, or in a turn the app
   opens as its worker ends one, straight after his or another such
   (V31-CHAIN-START).
