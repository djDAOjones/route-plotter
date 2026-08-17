# Manifest

Declares the **class** of every path the framework ships, so an
upgrade never has to infer whether a file is safe to overwrite. The
upgrade procedure (`prompts/upgrade.md`) reads this file to decide how
to treat each path in a consuming project.

Classes describe behaviour **during an upgrade inside a consuming
project**, not inside this source repo.

## Classes

| Class | Upgrade behaviour |
| --- | --- |
| `framework` | Overwrite wholesale with the new version — *after* the Step 4 customisation check. The user should never edit these in place. |
| `root-template` | Ships in `pm_skills/templates/`; copied to the project root at init (init.md Step 0) and populated by the user there. On upgrade, 3-way merge the new template into the project's root copy: take the new structure, preserve every populated section verbatim. Never overwrite wholesale. The shipped template file itself is replaced like a `framework` file. |
| `project-memory` | Living project memory. Never overwritten, never deleted on upgrade. Only additive section reconciliation against the template is allowed. |
| `scaffold` | Copied once into the project root at init. The user owns their copy thereafter. Never touched on upgrade. |

## Paths

| Path | Class |
| --- | --- |
| `pm_skills/VERSION` | `framework` |
| `pm_skills/CHANGELOG.md` | `framework` |
| `pm_skills/MANIFEST.md` | `framework` |
| `pm_skills/GUIDE.md` | `framework` |
| `pm_skills/init.md` | `framework` |
| `pm_skills/memory-policy.md` | `framework` |
| `pm_skills/prompts/*` | `framework` |
| `pm_skills/integrations/*` | `framework` |
| `pm_skills/templates/AGENTS.md` | `root-template` |
| `pm_skills/templates/UI-STANDARDS.md` | `root-template` |
| `pm_skills/templates/DEV-INFRASTRUCTURE.md` | `root-template` |
| `pm_skills/templates/PROCESS.md` | `root-template` |
| `pm_skills/CHANGELOG-1x.md` | `framework` |
| `pm_skills/CHANGELOG-2x.md` | `framework` |
| `pm_skills/CHANGELOG-3x.md` | `framework` |
| `pm_skills/project/brief.md` | `project-memory` |
| `pm_skills/project/architecture.md` | `project-memory` |
| `pm_skills/project/conventions.md` | `project-memory` |
| `pm_skills/project/backlog.md` | `project-memory` |
| `pm_skills/project/trajectory.md` | `project-memory` |
| `pm_skills/project/wish-list.md` | `project-memory` |
| `pm_skills/project/doc-deltas.md` | `project-memory` |
| `pm_skills/project/file-map.md` | `project-memory` |
| `pm_skills/project/decision-log.md` | `project-memory` |
| `pm_skills/project/tickets/*` | `project-memory` |
| `pm_skills/project/archive/*` | `project-memory` |
| `pm_skills/scaffold/*` | `scaffold` |

## Rules

- A new file added under `pm_skills/prompts/` or
  `pm_skills/integrations/` inherits the `framework` class. A new file
  under `pm_skills/project/` inherits `project-memory`; under
  `pm_skills/templates/`, `root-template`. The changelog
  entry that introduces it states its class only if it differs from
  the directory default.
- **Never customise a `framework` file in place** in a consuming
  project. Project-specific behaviour belongs in a `root-template`
  (`AGENTS.md`, `UI-STANDARDS.md`, `DEV-INFRASTRUCTURE.md`) or in
  `project-memory`, both of which survive upgrades. Editing a
  framework prompt directly means the next upgrade either downgrades
  your change or stops to reconcile it — neither is free.
- `README.md` at the project root is **not** a framework file. Most
  consuming projects keep their own root README. The framework's own
  `README.md` (in this source repo) is documentation for the repo,
  not a distributable.
