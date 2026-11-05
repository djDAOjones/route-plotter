# orchestrate — a family of chats

<!-- cspell:ignore worktrees -->

An add-on no rule reads (specification 3.19), for a top-level chat,
the orchestrator, running work through sub-chats. Starting and
messaging chats are the app's; the start notice's claim is unchanged;
every rule binds every chat.

1. **Top level only.** Only a top-level chat orchestrates. A sub-chat
   never starts a chat: it keeps a status file in its lane, an ignored
   folder outside the record and every worktree, and at its end, its
   Session line or a question only the orchestrator can answer, it
   writes a hand-over there and stops. The orchestrator starts any
   continuation.
2. **When a sub-chat earns its start:** a large working set, an answer
   that fits a paragraph, and no need of the orchestrator's history.
   Otherwise inline, a subagent or a fork.
3. **The brief** is `node tools/brief.mjs <ID>`'s output, with the
   question and what is ruled out; it adds to rule 1's read, never
   replaces it.
4. **Writers and readers.** A writer works in its own worktree and
   hands back by commit (rule 3, the profile's Handoff line); readers
   may share the checkout. A writer's brief adds one `Expected paths:`
   line; `node tools/lanes.mjs overlap <brief> <brief>` must pass before
   a second writer starts. A lane merge's conflict in the decisions or
   trajectory file goes to `node tools/lanes.mjs union <file>`, not a
   hand union.
5. **The report** gives a verdict, its reason, what would overturn it
   and where the work lives: commit, branch or lane file. The
   orchestrator checks it at source before acting on or relaying it.
6. **The notes file.** The orchestrator keeps the family's state in a
   notes file in its lane, current after every report: each sub-chat,
   its item, worktree or branch, status and what it waits on. It
   writes the ledger only from a scratch worktree.
7. **Refresh.** The orchestrator migrates at a phase close, once past
   175k tokens of context before a wait of over an hour, or at the
   profile's Session line. It starts a successor briefed from the
   notes file and detaches it to top level with the app's detach
   tool. Running sub-chats then still report to the old chat, which
   is not told when the successor's turns end; the successor follows
   them through their status files and the session list.
8. **Archiving.** Archiving a chat also archives its finished
   sub-chats and removes or only detaches their worktrees, a detached
   folder left for removal by hand and open to reuse by the app, so
   the orchestrator archives itself
   only after every sub-chat's work has landed: committed and pushed
   as the Push line says.
