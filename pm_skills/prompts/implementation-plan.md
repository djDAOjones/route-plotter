# Implementation Plan — Stage 3 of 4

Using the project context, approved scope, and chosen design option, produce an implementation plan only.

Approved scope:
<paste approved scope, or say "use the scope from above">

Chosen option:
<paste chosen option, or say "use option N from above">

Output:

1. Ordered list of files to create or modify, with purpose.
2. Data flow or architectural changes needed.
3. Any new abstractions, with justification — or explicitly: none.
4. Tests to write or update.
5. Step-by-step implementation sequence.
6. Acceptance criteria — how we know it's done.
7. Watchouts — likely failure modes or common mistakes.
8. Files that should not be touched.

Rules:

- Be terse: each output ≤ ~5 lines unless risk genuinely demands more;
  write "none" / "n/a" where an output is empty.
- Stay inside the approved scope.
- Prefer minimal changes over broad cleanup.
- Call out architectural, efficiency, or regression risks.
- If the task adds or changes a runtime component, include the runtime command surface (boot/reboot/status scripts) and the `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle" doc among the files to modify, and make "boots to a ready state via the canonical command" an acceptance criterion.
- If the task adds instrumentable runtime behaviour or a diagnostics affordance, include the structured logger and the relevant contract docs (`DEV-INFRASTRUCTURE.md` → "Maintainer diagnostics", `UI-STANDARDS.md` → "Diagnostics affordance") among the files to modify, and make "notable events are logged and the diagnostic bundle stays redacted" an acceptance criterion.
- If the task changes the quality-gate surface (a lint rule, test category, type-check setting, or build step), include the `check` definition and `DEV-INFRASTRUCTURE.md` → "Quality gate" among the files to modify, and make "`check` passes and reflects the new surface" an acceptance criterion.
- No code or pseudocode.
