---
description: Run the diagnosis-before-fix workflow for a bug
---

Before fixing anything, diagnose the root cause and get user approval.
Do not write code until diagnosis is confirmed and a fix plan is approved.

1. State the bug.
   One sentence: what is happening vs what should be happening.
   Include reproduction steps if the user provided them.

2. Read project context.
   Read:
   - `AGENTS.md`
   - `UI-STANDARDS.md` (if the bug touches UI)
   - `DEV-INFRASTRUCTURE.md` (if it exists)
   - `pm_skills/project/brief.md`
   - `pm_skills/project/architecture.md`
   - `pm_skills/project/conventions.md` (if it exists)
   - `pm_skills/project/file-map.md`
   - `pm_skills/project/backlog.md`
   - `pm_skills/project/decision-log.md` (if you need context
     on prior choices that may relate to the bug)

3. Triage complexity.
   Ask the user: "Is this a quick fix or does it need full diagnosis?"
   - If quick fix → go to step 4.
   - If full diagnosis → go to step 5.
   - If the user already indicated, don't ask again.

--- QUICK FIX PATH ---

4. Quick diagnosis and fix plan.
   Read `pm_skills/prompts/bug-scoping.md` and follow
   its instructions. Output:
   - Bug description (expected vs actual, reproduction steps if known)
   - Root cause — search the codebase and cite evidence
   - Proposed fix — minimal upstream change
   - Files to modify (with one-line reason each)
   - Acceptance criteria

   Present to the user. After approval, implement the fix.
   Go to step 8.

--- FULL DIAGNOSIS PATH ---

5. Reproduce and observe.
   Confirm the reproduction steps. If the bug is not reliably
   reproducible, note what conditions trigger it and what has been
   tried. Document:
   - Steps to reproduce (or best-known trigger)
   - Expected behaviour
   - Actual behaviour
   - Environment details if relevant

   Present to the user for confirmation before continuing.

6. Diagnose root cause.
   Read `pm_skills/prompts/bug-scoping.md` and follow
   its instructions. Search the codebase, trace the fault, and
   cite evidence. Output:
   - Root cause — state the cause, not the symptoms. Cite file
     paths and line ranges.
   - If the cause is uncertain, state competing hypotheses and
     what evidence would distinguish them.
   - Regression surface — what existing behaviour could break if
     this area is changed.

   Present diagnosis to the user. Wait for approval before
   continuing. Do not propose a fix until the root cause is
   confirmed.

7. Plan the fix.
   Output:
   - Proposed fix — the minimal upstream change that addresses
     the root cause
   - Files to modify (with one-line reason each)
   - Files not to touch
   - Regression checks or tests to run
   - Acceptance criteria — how we know the bug is fixed and no
     regressions were introduced

   Present to the user. After approval, implement the fix.

--- VERIFY ---

8. Verify the fix.
   After implementation:
   - Confirm the original bug is resolved against the reproduction
     steps or trigger conditions.
   - Check for regressions against the identified regression surface.
   - Run existing tests if a test runner is available.

   Report results to the user.

--- CLOSE ---

9. Update project memory.
   After the fix is verified, update:
   - `pm_skills/project/backlog.md` — move this task to the
     Completed section, note any follow-up tasks in Active.
   - `pm_skills/project/file-map.md` — add or
     update entries for files created or changed.
   - `pm_skills/project/decision-log.md` — record
     the key design decision from this task.
   - `pm_skills/project/conventions.md` — if new
     conventions were established or existing ones changed.
   - `README.md` — if architecture, dev workflow, or key
     infrastructure changed significantly.
   - `AGENTS.md` — if this task established new invariants, data model
     changes, protected modules, event namespaces, or anti-patterns.
   - `UI-STANDARDS.md` — if this task established new token systems or
     UI conventions.
   - `DEV-INFRASTRUCTURE.md` — if this task changed build, dev server,
     versioning, or script conventions.

   Present the memory updates to the user for review.
