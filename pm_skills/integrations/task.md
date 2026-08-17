---
description: Run the design-before-code task workflow (gating mode: full / checkpoint / auto-jazz / auto-jazz-lite / spike / refactor)
---

The single task workflow. One skeleton — goal → context → stages →
implement → verify → close — with a **gating mode** that sets where it
stops for the user. It replaces the former `feature.md`,
`checkpoint.md`, `auto-jazz.md`, and `auto-jazz-lite.md`; those names
survive as modes.

## Modes

| Mode | Gates | Stages | Use for |
| --- | --- | --- | --- |
| `full` (was feature) | 4 — scope, option, plan, validation | 4-stage | `[sign-off]` items, high-risk work |
| `checkpoint` — **default** | 2 — scope, option pick | 4-stage | everyday non-trivial tasks |
| `auto-jazz` | 0 | 4-stage | trusted end-to-end autonomous runs |
| `auto-jazz-lite` | 0 | 2-stage (quick-task) | small or low-risk tasks |
| `spike` | 0 | investigate → findings | timeboxed exploration; closing an unknown before committing to a design |
| `refactor` | 2 — scope (declared surface), option pick | 4-stage | behaviour-preserving restructuring within a named file set |

Infer the mode from how you were invoked ("run this as auto-jazz",
"fully gated", a `[sign-off]` flag on the item → `full`, a `[spike]`
flag → `spike`, a "refactor this" / "restructure X without changing
behaviour" intent → `refactor`). Default to `checkpoint`. If the user
already indicated the mode, don't ask.

At every **skipped** gate: make the best conservative decision, state
the assumption in one line, and continue. Only stop to ask if there is
a genuinely blocking ambiguity (one concise question, not a list).

Conservative defaults for ungated decisions:

- Prefer the smallest useful scope over the broader one.
- Prefer the recommended option from `design-options.md`.
- Prefer existing patterns and existing files over new abstractions.
- Prefer reversible changes; flag irreversible ones explicitly.
- If a validation check trips a real risk, narrow scope rather than
  push through.

Hard prohibitions — this is the **canonical copy** for all modes and
for the other gateless workflows (`init-mvp.md` references it). Stop
and ask before doing any of these, in any mode:

- Adding a runtime dependency.
- Modifying a file listed in `AGENTS.md` → "Files to never edit" or
  `DEV-INFRASTRUCTURE.md` → "Files agents must not hand-edit".
- Modifying a module listed in `AGENTS.md` → "Protected
  infrastructure" (if that section is populated).
- Destructive migrations, schema-altering operations, or data
  deletion.
- Refactors touching more than 5 files that were not explicitly in
  the stated scope. (In `refactor` mode this limit is lifted **within
  the declared surface** — see "Refactor mode"; files outside it still
  stop-and-ask.)
- Disabling, weakening, or deleting an existing test.

## Steps

1. State the goal and mode.
   One sentence: what the user asked for, and which mode this run uses.

2. Read project context.
   Load the standard project context per `AGENTS.md` → "Before every
   task". If `AGENTS.md` is not loaded as a global rule, read it now.
   Also read `pm_skills/project/backlog.md` (Active section) and scan
   `pm_skills/project/decision-log.md` (latest 10 headings; open only
   relevant bodies).

3. Size triage.
   If the task is small (one or two files, no design choice worth
   exploring) — or the mode is `auto-jazz-lite` — take the **quick
   path**: read `pm_skills/prompts/quick-task.md`, follow its
   instructions, and produce the deliverables it lists. Search the
   source tree first.
   - Gated modes (`full`, `checkpoint`): present the plan, wait for
     approval, then go to step 8.
   - `auto-jazz-lite`: state the scope in one line as an assumption
     and go to step 8. If the task is clearly larger than a quick
     task, stop and recommend a 4-stage mode instead.
   Otherwise continue with the 4-stage path.

4. Scoping (stage 1). (gate in full + checkpoint)
   Read `pm_skills/prompts/scoping.md`, follow its instructions, and
   produce the deliverables it lists. Search the source tree to
   confirm affected files.
   - `full`, `checkpoint`: present the scope; **wait for approval**.
   - `auto-jazz`: state the chosen scope in one line and continue.

5. Design options (stage 2). (gate in full + checkpoint)
   Read `pm_skills/prompts/design-options.md`, follow its
   instructions, and produce the deliverables it lists.
   - `full`, `checkpoint`: present options with a recommendation;
     **wait for the user to pick**.
   - `auto-jazz`: pick the recommended option, state it in one line,
     and continue.

   Resume insurance (all modes): if implementation is likely to span
   sessions (a large plan, an expected handover, a long-running task),
   persist the approved scope and picked option — a few lines each —
   to `pm_skills/project/tickets/<ITEM-ID>.md` (add the `[detail]`
   flag per `scoping.md`) before implementing, so an interrupted run
   resumes without re-deriving them. Skip for tasks that will finish
   in-session — insurance, not ritual.

6. Implementation plan (stage 3). (gate in full only)
   Read `pm_skills/prompts/implementation-plan.md`, follow its
   instructions, and produce the deliverables it lists.
   - `full`: present the plan; **wait for approval**.
   - `checkpoint`, `auto-jazz`: state any assumption in one line and
     continue.

7. Validation (stage 4). (gate in full only)
   Read `pm_skills/prompts/validation.md`, follow its instructions,
   and produce the deliverables it lists.
   - `full`: present; after approval ask "Ready to implement?" and
     wait.
   - `checkpoint`, `auto-jazz`: if a check surfaces a blocking concern
     (likely regression, broken invariant, scope obviously too large),
     stop and ask one concise question. Otherwise state "Validation
     passed" in one line and continue.

8. Implement.
   Implement the approved (or assumed) plan. Follow the minimal-change
   discipline in `AGENTS.md`. Match existing style. No runtime
   dependencies beyond any explicitly approved or assumed in the plan.

9. Verify.
   - Run the project's quality gate (`check`) if available — or its
     build and test steps. If neither exists, verify manually and note
     what was checked.
   - Confirm each acceptance criterion is met.
   - Check the regression surface identified in validation (or the
     quick-path watchouts).
   - Report what was run, what passed, and any open issues.

10. End-of-task housekeeping.
    Run the procedure in `pm_skills/prompts/end-of-task.md`. Record
    the assumptions made at skipped gates in the decision-log entry.
    Present the closing report. After a gateless run (`auto-jazz`,
    `auto-jazz-lite`), suggest `pm_skills/prompts/review.md` before
    the user accepts the work.

    **Close mode — `full` (default) or `lite`.** Infer from the
    invocation: a "commit and move on" / "batch this, reconcile later"
    style instruction implies `lite` **only if the user actually says
    so** — never default to it. On a `lite` close, `end-of-task.md`
    steps 1–2 (gate + boot) still run; the memory writes are deferred to
    a batch **Reconcile** and recorded as a `Close: lite` commit trailer.
    `lite` is **forbidden** for `[sign-off]` items and any `full`-mode
    run (their rationale is the record) — close those `full`.
    `auto-jazz` / `auto-jazz-lite` / `checkpoint` runs may close either
    way; when unsure, close `full`.

11. Commit and push (standard close step).
    Once the gate is green and memory is written (step 10), commit —
    and push when a remote is already configured. This gives every
    task a rollback point from its first week and makes `git log` a
    verification ledger. Since 4.2.0 this is a **standard step of the
    close**, not a proposal; a project that wants propose-only
    behaviour states so in its root `AGENTS.md`. The staged-set echo
    below still runs before the commit, and the agent never adds or
    changes a remote to make a push possible.

    - **Message shape** — align with the `Close: lite` trailer grammar
      (`end-of-task.md`) so lite and full closes read the same in
      `git log`: a `<ITEM-ID>: <summary>` title, then one what/why body
      line and a `Verify: typecheck 0 · <N> tests · build 0` line (adapt
      the fields to the stack). On a lite close, append the full
      `Close: lite` trailer block instead of restating it.
    - **Shell-safety** — one `-m` per line; never chain body text with a
      bare ` -m ` inside a single message. Correct form:
      `git commit -m "ITEM-ID: summary" -m "what/why" -m "Verify: …"`.
    - **No habitual bypass** — never step past a failing gate with
      `--no-verify` or its kin: fix the cause instead. A bypass used
      under pressure is exactly when the check mattered — the
      framework learned this the hard way.
    - **Staged-set echo** — before recommending the commit, list the
      files about to be committed against the files this task touched
      (code *and* memory). Flag any touched file missing from the staged
      set — this is the CHANGELOG-slip failure mode (a release commit
      that shipped without its own changelog entry), caught before the
      commit rather than after. When a **parallel session** may be
      running (see `prompts/session-start.md` → "Parallel-session
      claim"), stage explicit paths only — never `git add -A` — so you
      commit your own work and not another session's in-flight edits.
    - **Long runs** — for multi-milestone or cross-session work,
      recommend a checkpoint commit after each completed milestone
      (mirroring `init-mvp.md`), not only at close, so an interrupted
      run has recent rollback points.
    - **Not a git repo** — say so once and skip; the rest of the close
      is unaffected.

## Spike mode

A timeboxed exploratory mode: findings are the deliverable, code is
throwaway. Use it when the backlog item carries the `[spike]` flag or
the user says "spike this".

### Contract

- **State the question and timebox up front** (e.g. "Can library X
  handle our volume? Timebox: this session.").
- Investigation may write throwaway code in a scratch branch or
  directory — never merge it to `main`.
- At the timebox, **stop**. Inconclusive is a valid finding; report it
  as information with a retreat recommendation.
- One session, one question. A second question is a second spike.

### Spike deliverables

1. One **decision-log entry**: question, method, findings,
   recommendation, follow-up tickets (if any).
2. Optionally a `spec/<topic>-findings.md` for extended detail.
3. Backlog: the spike item is resolved **or** replaced by concrete
   follow-up tickets.

### Spike constraints

- All hard prohibitions from this file still apply — **no dependency
  installs even in a spike** (test a dependency only via ephemeral
  `/tmp` installs that never touch the project manifest, and say so).
- Spike code never merges without going back through a normal task mode.
- No SPEC/ADR/protected-doc edits from within a spike — findings
  *propose* them.

### Spike steps

1. State the question, the timebox, and the mode (`spike`).
2. Load project context (same as step 2 of the main flow).
3. Investigate — search, prototype, analyse. Write throwaway code only
   in a scratch location.
4. At the timebox or once the question is answered (whichever is
   first), stop and produce the deliverables above.
5. Close: **full, with a reduced surface**. The findings decision-log
   entry and the backlog resolution (deliverables above) ARE the memory
   writes; trajectory and file-map updates are skipped because
   throwaway code does not ship. Run `end-of-task.md` steps 1–2
   (gate + boot) as usual. Never close a spike `lite`: its entry is
   already written and its item already resolved, so a `Close: lite`
   trailer would hand Reconcile an item it cannot evict.

## Refactor mode

A behaviour-preserving restructuring mode: the acceptance criterion is
fixed — **observable behaviour unchanged** — and the payoff is internal
(clarity, structure), not new function. Use it when the user says
"refactor this" or "restructure X without changing behaviour". Gates
like `checkpoint`: the scope gate approves the **declared surface**, the
option gate approves the **restructuring shape**.

> Not to be confused with the **Refactor** verb in
> `memory-maintenance.md`, which tidies drifted project memory. This is
> a code/structure mode; that is a memory-cleanup verb.

### Declared surface

Scoping names the file set (or directory) the refactor may touch. The
">5 files not in scope" prohibition is lifted **within that set only** —
anything outside it stops-and-asks as usual. An under-declared surface
is the whole risk of this mode: name it deliberately at the scope gate.

### Baseline precondition

A green `check` before starting. If the surface has no test coverage,
state that and accept it at the scope gate — or land a safety-net test
*first* as its own step before restructuring.

### Preservation contract (validation checklist)

Name the contract at validation, then re-verify each item after
implementing:

- Tests unchanged and green **before and after** — no assertion
  weakened (existing hard rule).
- No event-catalogue, data-model, API, or route delta.
- An explicit **preserved-interface list** where DOM ids or module
  exports are involved, re-verified by grep after implementation (the
  element-ID-inventory pattern).
- Build-artefact sanity where relevant (e.g. grep the built output for
  paths that must not leak).

### Refactor constraints

- All hard prohibitions from this file still apply; protected /
  never-edit files stay protected regardless of the declared surface.
- Behaviour preservation covers **observable** behaviour; name
  performance-sensitive paths explicitly if they are in scope — don't
  over-promise.
- No mixing: feature work and refactor never share a run. If the
  refactor reveals a bug, log it (wish-list/backlog) — don't fix it
  in-flight. "Refactor + small improvement" is two runs.
- The decision-log entry must record the preserved-contract list — it
  is the durable evidence the next session checks against.
