# Design Options — Stage 2 of 4

Using the project context and the approved scope, produce 2–3 design options.

Approved scope:
<paste approved scope here, or say "use the scope from above">

For each option:

- Summary
- Files and modules affected
- How it fits (or extends) the current architecture
- Data flow or state changes
- Benefits
- Risks or trade-offs

Then:

- Recommend one option.
- Explain why it fits this project better than the others.
- Note anything that should stay unchanged.

Rules:

- Be terse: each per-option field ≤ ~3 lines; skip a field that adds
  nothing for an option. The recommendation and its why deserve the
  most words, not the option boilerplate.
- Don't reopen scope.
- Don't propose speculative refactors.
- If options differ on an **empirically checkable claim** (an API
  supports X; a size or speed bound holds) and the check costs
  roughly fifteen minutes of build or less, run the check in a
  scratch location before presenting, and present measured
  comparisons rather than argued ones — saying which claims were
  checked and which remain argued. Throwaway probes only: nothing
  from the check lands in project files.
- If this is early in the project, options may be about foundational choices (folder structure, patterns, libraries) rather than modifications to existing code.
- Explain trade-offs in plain language.
- No code or pseudocode.
