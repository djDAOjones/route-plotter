# Bug Scoping

Using the project context, do the bug scoping step only for the current bug.

Bug:
<describe the bug — what's expected vs what's happening>

Diagnostic bundle (if the app has a copy-diagnostics affordance):
<paste the redacted bundle, or say "none">

Output:

1. Bug description — expected behaviour, actual behaviour, reproduction steps (if reproducible).
2. Affected areas — which modules, files, or layers are involved.
3. Root-cause analysis — search the codebase, trace the fault, cite evidence. State the root cause, not symptoms.
4. Regression surface — what existing behaviour could break if this area is changed.
5. Proposed fix — the minimal upstream change that addresses the root cause.
6. Acceptance criteria — how we know the bug is fixed and no regressions were introduced.
7. Open questions — only if genuinely blocking.

Rules:

- If the project has a diagnostics path (`AGENTS.md` → "Self-explaining runtime"), use the redacted diagnostic bundle as primary evidence and ask for it before diagnosing if it wasn't provided. If the project has no diagnostics path, note that absence as the first finding — a bug is the cheapest moment to add the minimal structured logger + global error/unhandledrejection hook (`DEV-INFRASTRUCTURE.md` → "Maintainer diagnostics").
- If this bug is tracked as a backlog item carrying the `[detail]` flag, read its `pm_skills/project/tickets/<ITEM-ID>.md` for prior context before diagnosing.
- Search the codebase before diagnosing. Cite file paths and line ranges as evidence.
- Prefer upstream fixes over downstream workarounds.
- If the root cause is uncertain, state competing hypotheses and what evidence would distinguish them.
- Keep the proposed fix minimal. No speculative refactors.
- Flag any architectural, performance, or regression risks.
- No code or pseudocode.
