---
description: Sign off the foundation and a scope band, then autonomously build (and optionally ship) from a spec
---

The guided-then-autonomous greenfield path. Marries the gated
foundation (`pm_skills/init.md` in agent mode) with gateless execution
(`task.md` auto-jazz mode): you review and **sign off the foundation**
— the product read, the stack, and the MVP backlog — plus a **scope
band** (how far this run goes), and then the agent builds to
completion without further gates. It replaces the former
`spec-to-prod.md`, which is now simply Bands 1–3 of this workflow.

Use this when you have wants or specs (loose is fine) and want to
steer the *what* and the *how much* once, then hand the build off. It
applies the same rigour and opinions as the rest of the framework —
design-before-code, Carbon, WCAG 2.2 AAA, minimal dependencies, live
project memory — de-risked by **staged rollback checkpoints** and a
**stop-and-narrow rule** that only re-summons you if the plan proves
wrong.

When **not** to use it:

- The project already has code or populated project memory — use
  `task.md` (or Start B in `session-start.md`) instead. This mode
  assumes greenfield.
- You only want project setup, no code yet — run `pm_skills/init.md`
  (agent mode) and stop after its readiness check.
- You want to approve every implementation step — run `init.md`, then
  `task.md` in `full` mode per backlog item.

## The scope band (gate 2)

This run goes exactly as far as the band you sign off — no further.
Pick one in Phase A and quote it back:

- **Band 0 — Local MVP (default).** The first milestone only, built
  and verified locally. No deploy. Proves the product idea, then hands
  back.
- **Band 1 — Deployed MVP.** Band 0, then a production deploy via
  `prompts/deploy.md`. Proves the idea *in production* with the least
  exposure.
- **Band 2 — Deployed Current milestone.** Everything under the
  backlog's **Current milestone**, then deploy. Choose when the MVP
  alone is not shippable to real users.
- **Band 3 — Full backlog to production.** Every committed milestone
  (Current + Next), then deploy. The most autonomy and the most risk;
  requires explicit sign-off and a backlog you trust is correctly
  ordered. Never the silent default.

The band is a hard ceiling. Reaching it ends the build phase — the
workflow does not improvise past it. To go further later, start a new
session with Start B (`session-start.md`).

## Version control (expectation, not requirement)

**Expect this project to live in a Git repository with a remote.** Not
strictly required, but the assumed default: the rollback checkpoints
are *commits*, and a deploy ships a clean, committed tree mapped to a
known revision. In Phase A:

- Already a Git repo with a remote → say so and continue.
- A repo with no remote → **recommend** adding one before Phase B.
- Not a repo → **recommend** `git init` + a remote before any code.
  Proceed without only if the user explicitly declines — then warn,
  once, that checkpoints degrade to local backups and (for deploy
  bands) the clean-tree guarantee cannot hold.

Recommend, do not perform: never run `git init`, or create or push to
a remote, without the user's go-ahead.

## Conservative defaults (gateless phases)

- Prefer the smallest stack and the smallest milestone that proves the
  product idea. An MVP, not v1.
- Prefer the recommended option at every internal decision (per
  `design-options.md`).
- Prefer boring, well-understood, low-dependency technology over
  novelty.
- Prefer reversible steps and frequent verification; flag anything
  irreversible explicitly.
- If a check trips a real risk, narrow scope rather than push through.

## Hard prohibitions

The canonical gateless list in `pm_skills/integrations/task.md`
applies in full; this mode adds its own and one greenfield adaptation
(stop and ask one concise question before any of these):

- **Building beyond the signed-off band in one run.** Finish the band,
  then hand back. Do not improvise a v2.
- **Adding a runtime dependency the recorded architecture does not
  name.** The greenfield form of the canonical no-new-dependency rule —
  see the exception below.
- Destructive operations against anything that pre-exists the run
  (existing files, git history, external state, schemas, data).
- **Deploying off an undocumented pipeline** (deploy bands only) —
  `prompts/deploy.md` step 1 governs: if `DEV-INFRASTRUCTURE.md` →
  Deployment is unpopulated, populate it (with sign-off) before
  shipping.
- **Deploying without both gates passed** — foundation sign-off and
  scope-band sign-off.

Greenfield exception to the dependency rule: a greenfield build must
choose a stack. Phase A step 4 **fixes and records** the tech stack
and dependency policy in `architecture.md` and `DEV-INFRASTRUCTURE.md`.
Every runtime dependency that record names is authorised by the act of
writing it. Introducing any runtime dependency the record does **not**
name still trips the stop-and-ask rule. Keep the recorded set minimal.

This mode adds no new design stages. It runs the standard pm-skills
four-stage approach at two altitudes:

- **Once, at project altitude, gated (Phase A):** scoping = the product
  read and MVP cut; design options = the stack and architecture;
  implementation plan = the dependency-ordered backlog and
  skeleton-first sequencing; validation = the readiness check. You sign
  this off.
- **Per backlog item, at item altitude, gateless (Phase B):** the four
  stages collapse to the `task.md` auto-jazz loop, because the
  project-altitude design already settled options and plan. Each item
  is confirm → implement → verify.

--- PHASE A: FOUNDATION + MANDATE (gated) ---

Present each artifact for review and wait. The readback (step 3), the
foundation sign-off (step 5), and the band sign-off (step 6) are real
gates — do not write product code until steps 5 and 6 are approved.

1. State the goal.
   One sentence: the product to build (and ship, if a deploy band is
   in play), noting this is a guided foundation followed by an
   autonomous build within a signed-off scope band.

2. Read framework context.
   Read `AGENTS.md`, `UI-STANDARDS.md`, and `DEV-INFRASTRUCTURE.md`
   (the root rulebooks — if absent, copy them from
   `pm_skills/templates/` first, per `pm_skills/init.md` Step 0) and
   `pm_skills/init.md`. These carry the rigour and opinions this run
   must honour. There is no project memory to read yet — this run
   creates it.

3. Capture the wants and read the interpretation back. (gate)
   Gather the wants from, in order of preference: the user's message;
   an already-filled `pm_skills/project/brief.md`; otherwise ask.
   Loose input is fine — turning it into something precise is this
   step's job. Before building anything, **restate it back**:
   - A one-paragraph product definition — what it is and who it's for.
   - The proposed MVP scope — the candidate first milestone as a short
     bullet list.
   - The assumptions and exclusions you are reading into the input.
   Do not invent a product. Present this read and **wait for the user
   to confirm or correct it.** Only once confirmed, write it to
   `pm_skills/project/brief.md` and continue.

4. Build out the foundation. (gated, per `init.md` agent mode)
   Follow `pm_skills/init.md` Steps 2–9 in agent mode, presenting each
   artifact for review. Produce, in order:
   - `architecture.md` — **this is where the stack and dependency
     policy are fixed and recorded.** Keep the runtime dependency set
     minimal and explicit.
   - `backlog.md` — the **first milestone is the MVP scope.** Order it
     by dependency so it can be built top-to-bottom.
   - `conventions.md` (only if the specs imply real conventions; else
     skip), `README.md`, `AGENTS.md`, `UI-STANDARDS.md` (if there is
     UI), `DEV-INFRASTRUCTURE.md` (if there is a build step), and the
     scaffold files.

5. Readiness check, foundation sign-off + Checkpoint 1. (gate)
   Run `init.md` Step 10 (readiness check + placeholder lint) and
   resolve anything it flags. Confirm the version-control expectation
   above. Then summarise the stack, the MVP scope (first milestone,
   quoted), and the assumptions made, and **get explicit sign-off.**
   Recommend the user commit now so this is a clean rollback point; do
   not auto-commit.

6. Sign off the scope band. (gate)
   Present the bands, recommend Band 0 (or Band 1 if the user asked to
   ship), and **wait** for the user to pick. Quote the chosen band —
   and the exact backlog milestones it covers — verbatim. This is the
   **last gate** — after it, the run continues to the band ceiling
   without pausing, except for the hard prohibitions and the
   stop-and-narrow rule.

--- PHASE B: BUILD (gateless within the band) ---

No approval gates from here until the band is built. Keep project
memory live as you go.

7. Lock the MVP scope.
   Quote the first milestone of `backlog.md` verbatim. That set is the
   Band 0 scope; larger bands extend beyond it milestone by milestone,
   never item by improvised item.

8. Stand up a runnable skeleton + Checkpoint 2.
   Before any feature work, create the smallest thing that **runs**:
   build tooling, dev server, entry point, and a trivial "it loads"
   view or output, consistent with the recorded architecture. Record
   the canonical boot/reboot command and its readiness check in
   `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle" as you stand this up —
   the skeleton is the cheapest moment to establish one-command
   recovery. At the same time, wire the minimal diagnostics path — a
   structured logger plus a global `error` / `unhandledrejection`
   hook, per `DEV-INFRASTRUCTURE.md` → "Maintainer diagnostics" — so
   failures are legible from the first run. Verify it actually runs to
   a verified-ready state (health/output, not just a launched process).
   State **Checkpoint 2: runnable skeleton** and recommend a commit.
   If the skeleton will not run, stop and fix it before going further —
   never build features on a base that does not run.

9. Burn down the milestone(s).
   Work the locked milestone items in dependency order. For each item,
   run the `task.md` auto-jazz loop in lightweight form (the shared
   `architecture.md` and `backlog.md` already supply scope, options,
   and plan — confirm, then build):
   - Implement following the minimal-change discipline in `AGENTS.md`;
     imports at the top; match the conventions just recorded; stay
     within the recorded dependency set.
   - Verify: run build/tests; confirm the whole thing still runs.
   - Update project memory as you go: item status in `backlog.md`, new
     files in `file-map.md`, notable decisions noted for the
     consolidated decision-log entry in step 13.

   For Bands 2–3, continue milestone by milestone up to the band
   ceiling: pick the next batch as `session-start.md` → Start B
   describes (but do not stop for go-ahead — the band sign-off already
   authorised it), and recommend a commit after each completed
   milestone. These are the rollback checkpoints; state each one.

10. Stop-and-narrow rule.
    If an item reveals the architecture is wrong, the build stops
    running, the recorded dependency set is insufficient, or the scope
    is ballooning — **stop.** Fix the base, or descope (move the
    offending items to a later milestone in `backlog.md`), and report
    it. Do not burn the rest of the band on a broken or runaway base.

--- PHASE C: SHIP (Bands 1–3 only) ---

11. Deploy to production.
    Run `pm_skills/prompts/deploy.md` end to end: confirm the pipeline
    is defined, pre-flight (clean tree, green build, version stamped,
    secrets external), run the documented pipeline, verify the live
    result, and roll back on failure. If Deployment is undocumented,
    populate `DEV-INFRASTRUCTURE.md` → Deployment with sign-off, then
    deploy. Band 0 skips this phase.

--- VERIFY + CLOSE ---

12. Integration verification.
    - The whole build boots to a verified-ready state (health or
      expected output, not just a launched process) via the canonical
      command in `DEV-INFRASTRUCTURE.md` → "Runtime lifecycle".
    - Diagnostics work: uncaught errors are captured and legible; if
      there is UI, the dev-only copy-diagnostics affordance produces a
      redacted bundle and is hidden in production.
    - Every item in the signed-off band is implemented and ticked, or
      explicitly descoped with a one-line reason.
    - Re-run the placeholder lint from `init.md` Step 10.
    - Accessibility and UI sanity per `UI-STANDARDS.md` if there is UI.
    - For deploy bands: the live deployment is verified (version
      match, critical-path smoke test, healthy logs).
    - Report what was run, what passed, and any open issues.

13. End-of-task housekeeping.
    Run `pm_skills/prompts/end-of-task.md` once for the whole run.
    Record a single consolidated decision-log entry covering the stack
    choice, the MVP cut, the chosen band, the deploy (if any), and
    every assumption made. Record the shipped milestone(s) as phases
    in `trajectory.md`; confirm `backlog.md` holds only open or
    descoped work. Run the memory size check. Present a closing report
    naming the rollback checkpoints (foundation, skeleton,
    per-milestone commits), the live deploy result (if any), and the
    next steps (`pm_skills/prompts/review.md` to review this
    autonomous run, then Start B for the first milestone beyond the
    band).
