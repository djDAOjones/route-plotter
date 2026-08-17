# Release

Run this in the **framework source repo** (not a consuming project)
whenever you change any `framework`-class file. It keeps `VERSION`,
`CHANGELOG.md`, and `MANIFEST.md` in sync so that downstream upgrades
stay a declarative read instead of a forensic diff.

If `VERSION`, the changelog, and the manifest drift out of sync, the
upgrade fast path silently breaks and every consuming project pays the
full-diff cost again. This checklist is the safeguard.

## 1. Decide the bump

Classify the change against `CHANGELOG.md` semver rules:

- **patch** — wording, clarification, or fix. No new files, no
  migration.
- **minor** — new file or capability, backward compatible (a new
  prompt, integration, or template section).
- **major** — structural or breaking change needing a migration
  (renamed/removed files, restructured templates, changed memory
  contracts).

State the chosen level and a one-line reason before editing metadata.

## 2. Bump `VERSION`

Overwrite `pm_skills/VERSION` with the new number. One line, no
prefix (e.g. `1.2.0`).

## 3. Append a changelog entry

Prepend a new entry to `pm_skills/CHANGELOG.md` (newest at top, never
rewrite a published entry). Use this shape:

```markdown
## X.Y.Z — YYYY-MM-DD

One-line summary of the release.

### Added
- `path` — what and why.

### Changed
- `path` — what and why.

### Removed
- `path` — what and why.

### Upgrade actions
- The mechanical steps to move a project from the previous version to
  this one, oldest concern first. Name exact paths. Flag any path that
  needs the Step 4 customisation check or a project-memory migration.
```

Omit empty sections. The **Upgrade actions** block is mandatory — it
is what `prompts/upgrade.md` executes.

## 4. Update the manifest

If this release added, removed, renamed, or reclassified any path,
update `pm_skills/MANIFEST.md`:

- New file in `prompts/` or `integrations/` → inherits `framework`;
  add a row only if you want it explicit.
- New file elsewhere, or a class that differs from its directory
  default → add an explicit row and state the class in the changelog
  entry.
- Removed file → delete its row.

## 5. Update wiring docs

- `pm_skills/GUIDE.md` — update the "What's in this folder" file tree
  and any per-task lists if files were added or removed.
- `README.md` — update only if the change affects quick start,
  upgrading, or "what's in this repo".
- `pm_skills/integrations/task.md` — points to the stage prompts (`scoping.md`,
  `design-options.md`, `implementation-plan.md`, `validation.md`,
  `quick-task.md`) rather than echoing their output lists, so a change
  to a prompt's **output list** needs no workflow edit. Update a
  workflow only if a stage prompt is **renamed, added, or removed**, so
  its "Read `pm_skills/prompts/X.md`" reference stays valid.

## 6. Verify

- `pm_skills/VERSION` matches the new top changelog entry.
- The changelog entry has an **Upgrade actions** block.
- If the release removes or renames any user-invocable file
  (`prompts/` or `integrations/`), the Upgrade actions include an
  explicit old → new mapping table — `upgrade.md` Step 6 builds its
  workflow-dir sweep and tombstones from it.
- **Coverage:** every changed distributed file is named in the entry.
  List the uncommitted/staged changes and check each `pm_skills/**` or
  root-template path appears in the top changelog entry — a changed
  framework file the entry does not name will silently downgrade on a
  consuming project's next upgrade.
- `MANIFEST.md` lists every shipped path (no orphans, no missing new
  files).
- `GUIDE.md` file tree matches the actual `pm_skills/` contents.

Run a quick consistency check:

```sh
echo "VERSION: $(cat pm_skills/VERSION)"
echo "Top changelog heading:"; grep -m1 '^## ' pm_skills/CHANGELOG.md
echo "Changed distributed files not named in the top entry:"
TOP=$(awk '/^## /{n++} n==1' pm_skills/CHANGELOG.md)
git status --porcelain | awk '{print $2}' | \
  grep -E '^(pm_skills/|AGENTS\.md|UI-STANDARDS\.md|DEV-INFRASTRUCTURE\.md)' | \
  grep -v 'CHANGELOG.md\|VERSION' | while read -r f; do
  echo "$TOP" | grep -q "$(basename "$f")" || echo "  MISSING: $f"
done
echo "Files not in MANIFEST:"
for f in pm_skills/prompts/* pm_skills/integrations/*; do
  grep -q "$(basename "$f")" pm_skills/MANIFEST.md || \
  echo "  (ok if covered by a /* wildcard) $f"
done
echo "Top-level files missing from the GUIDE tree:"
for f in pm_skills/VERSION pm_skills/*.md; do
  grep -q "$(basename "$f")" pm_skills/GUIDE.md || echo "  MISSING: $f"
done
```

## Rules

- One version bump per release. Do not batch unrelated changes under
  one number without listing them all.
- The changelog is append-only. Fix a mistake with a new entry, never
  by editing a published one.
- Never bump `VERSION` without an Upgrade actions block — a version
  with no documented deltas forces consuming projects back to a full
  diff.
