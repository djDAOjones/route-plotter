---
description: Run the design-before-code workflow for a task
---

Before implementing anything, complete the design workflow and get
user approval at each gate. Do not write code until all gates pass.

1. State the goal.
   One sentence: what the user asked for.

2. Read project context.
   Read:
   - `AGENTS.md`
   - `UI-STANDARDS.md` (if the task touches UI)
   - `DEV-INFRASTRUCTURE.md` (if it exists)
   - `pm_skills/project/brief.md`
   - `pm_skills/project/architecture.md`
   - `pm_skills/project/conventions.md` (if it exists)
   - `pm_skills/project/file-map.md`
   - `pm_skills/project/backlog.md`
   - `pm_skills/project/decision-log.md` (if the
     task involves design decisions or you need context on prior choices)

3. Determine task size.
   Ask the user: "Is this a full 4-stage task or a quick task?"
   - If quick → go to step 8.
   - If full → continue to step 4.
   - If the user already indicated the size, don't ask again.

--- FULL 4-STAGE WORKFLOW ---

4. Scoping (stage 1).
   Read `pm_skills/prompts/scoping.md` and follow
   its instructions. Output the scoping deliverables:
   - Problem framing
   - Affected areas
   - Key design decisions
   - Risks and dependencies
   - Smallest useful scope
   - Out of scope
   - Target file list
   - Open questions (only if genuinely blocking)

   Search the source tree to confirm affected files.
   Present scope to the user. Wait for approval before continuing.

5. Design options (stage 2).
   Read `pm_skills/prompts/design-options.md` and
   follow its instructions. Produce 2–3 design options with:
   - Summary, affected files, architectural fit, data flow, benefits,
     risks
   - A recommended option with rationale

   Present to the user. Wait for the user to pick an option.

6. Implementation plan (stage 3).
   Read `pm_skills/prompts/implementation-plan.md`
   and follow its instructions. Output:
   - Ordered file list with purpose
   - Data flow or architectural changes
   - New abstractions (with justification) or explicitly none
   - Tests to write or update
   - Step-by-step implementation sequence
   - Acceptance criteria
   - Watchouts
   - Files not to touch

   Present to the user. Wait for approval before continuing.

7. Validation (stage 4).
   Read `pm_skills/prompts/validation.md` and
   follow its instructions. Output:
   - Design sanity checks
   - Architecture checks
   - Regression risks
   - Test coverage assessment
   - Edge cases
   - Signs the scope is too large

   Present to the user. After approval, tell the user the design
   phase is complete and ask: "Ready to implement?"
   Wait for confirmation, then implement.
   Go to step 9.

--- QUICK TASK WORKFLOW ---

8. Quick scope and plan.
   Read `pm_skills/prompts/quick-task.md` and
   follow its instructions. Output:
   - What needs to change and why
   - Files to create or modify
   - Implementation sequence
   - Watchouts
   - Acceptance criteria

   Present to the user. After approval, implement.
   Go to step 9.

--- CLOSE TASK ---

9. Update project memory.
   After implementation is complete, update:
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
