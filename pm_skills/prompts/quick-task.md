# Quick Task

This is a small task. Do a combined scope-and-plan in one pass.

Output:

1. What needs to change and why (one paragraph).
2. Files to create or modify, with one-line purpose each.
3. Step-by-step implementation sequence.
4. Anything to watch out for.
5. Acceptance criteria.

Rules:

- Be terse: the whole output should fit one screen; write "n/a" where
  an output is empty.
- If this task is a backlog item carrying the `[detail]` flag, read its
  `pm_skills/project/tickets/<ITEM-ID>.md` first for prior context.
- Search the codebase first.
- Keep scope minimal.
- Prefer existing patterns.
- Flag any architectural or efficiency risk.
- If the task turns out to touch a runtime component (server, worker, port, env var, generated output, external service), an instrumentable surface (notable runtime behaviour or a user-facing surface worth instrumenting), or the quality-gate surface (a lint rule, test category, type-check setting, or build step), stop and escalate to the full `scoping.md` sequence — those impacts carry contract-doc obligations (`DEV-INFRASTRUCTURE.md`, `UI-STANDARDS.md`) the quick path deliberately omits.
- No code or pseudocode.

Gating comes from the caller (`task.md`, or you when pasted manually):
in gated use, implement after the plan is approved; in a gateless
mode, state the scope as a one-line assumption and implement.
