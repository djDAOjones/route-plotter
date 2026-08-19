# Decision Log — 2026-04 (archived)

<!-- Archived from decision-log.md on 2026-08-19 (Phase 5 docs pass, owner-approved
     budget split). Entries verbatim, newest first. Never auto-read; grep +
     line-range only. See archive/INDEX.md. -->


## 2026-04-16 — Path casing as a global style toggle

**Decision:** Add `showPathCasing` boolean to `this.styles` (default
`true`) with a checkbox in the right sidebar. Guards casing draws in
RenderingService (2 locations) and HTMLExportService (1 location).

**Rationale:** Simple global style property, no new event type needed.
Uses `!== false` guard so existing saves without the property default
to casing on (backward compatible).

---

## 2026-04-16 — Adopted PM-Skills framework for AI guidance

**Decision:** Replace the previous ad-hoc AGENTS.md + feature-scoping
workflow with the PM-Skills two-tier memory system.

**Rationale:** The previous system had a single AGENTS.md and one
Windsurf workflow. PM-Skills provides structured project memory
(brief, architecture, conventions, backlog, file-map, decision-log),
permanent behavioral contracts (AGENTS.md, UI-STANDARDS.md,
DEV-INFRASTRUCTURE.md), reusable prompt workflows, and Windsurf
integrations. Better discipline, cheaper AI sessions.

**Alternatives considered:**

- Keep the old system: simpler but lacked project memory, UI standards,
  dev infrastructure rules, and structured workflows.
- Build a custom system: more work, less battle-tested.
