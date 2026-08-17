# Validation — Stage 4 of 4

Using the project context, chosen design, and implementation plan, do a pre-code validation pass.

Chosen option:
<paste chosen option, or say "use the option from above">

Implementation plan:
<paste plan, or say "use the plan from above">

Output:

1. Design sanity checks — does this actually solve the problem?
2. Architecture checks — does this respect module boundaries?
3. Regression risks — what existing behavior could break?
4. Runtime impact — if this adds or changes a runtime component
   (server, worker, port, env var, generated output, dependency),
   confirm the design preserves one-command boot/reboot and a readiness
   check, and that `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle" will be
   updated. "Not applicable" if the task does not touch the runtime.
5. Diagnostics & redaction — if this adds runtime behaviour or a
   user-facing surface, confirm notable events route through the
   structured logger (not ad-hoc console.log) and that nothing sensitive
   (tokens, cookies, raw bodies, full storage, PII) can reach the
   copy-diagnostics bundle. "Not applicable" if the task adds no
   instrumentable behaviour.
6. Secret surface — if this task touches secrets, credentials, `.env` /
   config templates, or what the diagnostics bundle carries, confirm no
   secret can reach source, logs, or URLs, that committed templates hold
   only placeholders, and that `DEV-INFRASTRUCTURE.md` → "Security
   baseline" will be updated. "Not applicable" if the task touches no
   secret surface.
7. Test plan — name the invariants at risk, then the categories that
   apply (happy path, empty, error, boundary, permission/gating,
   regression, persistence round-trip). "Not applicable" is a valid
   answer per category. Flag anything only a manual check can cover.
8. Edge cases — what might we miss?
9. Signs the scope is too large or the design is wrong.

Rules:

- Be terse: one line per passing check is enough; spend words only on
  findings and risks.
- Say "not applicable" for irrelevant checks.
- Separate pre-existing issues from task-induced risks.
- Keep it concrete and actionable.
- In `refactor` mode, also run the preservation contract in
  `integrations/task.md` → "Refactor mode" (behaviour unchanged, no
  event/data/API/route delta, preserved-interface list).
- No code.
