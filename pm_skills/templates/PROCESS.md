# Process — [Project Name]

<!-- OPTIONAL root template. Populate only if the project is complex
     enough to have macro phases, formal decision records (ADRs), or
     per-phase definitions of done — a simple project should skip this
     file entirely (init treats it as skippable without nag).
     Read tier: CONDITIONAL — read when a task touches a phase
     boundary, closes a decision record, or asks "is this phase
     done?"; never part of the every-task hot load.
     Non-content rule (learned from real use): this file holds ONLY
     what the framework does not — nothing task.md, backlog.md, or
     the decision log already owns. Point, never restate; duplicated
     content here is where this file rots. -->

## Macro phases

<!-- CUSTOMISE: name the project's large phases and, for each, its
     definition of done — the demonstrable condition that closes the
     phase, not a date. Example shape:
     1. Foundation — done when the data model round-trips and the
        walking skeleton deploys.
     2. Core loops — done when a first user completes the primary
        journey unaided.
     Keep to the phases and their exits; the day-to-day queue stays
     in the backlog. -->

## Decision / ADR closure protocol

<!-- CUSTOMISE if the project keeps formal decision records. The
     portable protocol, proven on a real deployment:
     1. An open question gets a timeboxed spike (one session max —
        task.md spike mode).
     2. Closure adds a dated "## Decision (YYYY-MM-DD)" section to
        the record and demotes any "current thinking" prose to a
        dated note beneath it.
     3. The decision is linked from the project decision log (the
        why lives once; the record points).
     4. Affected protected docs (SPEC and kin) are swept via the
        doc-deltas ledger, not edited ad hoc.
     Records themselves are project-owned; the framework blesses the
     protocol, not a file format. -->

## Always-four-stage triggers

<!-- CUSTOMISE: the project-specific surfaces that always take the
     full gated workflow regardless of apparent size — extending
     task.md's hard prohibitions, never replacing them. Typical
     entries: SPEC/ADR edits, event catalogues, data-model changes,
     deploy scripts, dependency changes. -->

## Demo and spike cadence

<!-- CUSTOMISE: when working software is shown (demo gates between
     phases, end-of-milestone walkthroughs) and how exploration is
     bounded (the spike timebox, one question per spike — task.md
     spike mode owns the mechanics). -->

## Risk watch list

<!-- CUSTOMISE: the small set of named risks worth re-checking at
     phase boundaries — each with its trigger condition and the
     response if it fires. Keep it short enough to actually re-read;
     retire risks that stop being live. -->

<!-- What does NOT belong here: per-task rhythm (task.md owns it),
     open work (backlog.md), decision rationale (decision-log.md),
     build/deploy facts (DEV-INFRASTRUCTURE.md). -->
