# intake — init or adopt

Builds the ledger, the profile and the rules file for a repository,
new or existing, from what can be inferred and what the owner
supplies. Runs with the network on, with the owner present, whatever
the Network line says for sessions. It is the route for a canon or bare
project; a v2 installation follows the migration note in `CHANGELOG.md`
instead.

0. **Prepare the harness settings.** Run `node tools/harness.mjs`
   (it reads the profile's Harness line, or takes `--harness`),
   review the client version and merged settings, then use the intake
   settings for this verb only: Claude Code
   `--settings .claude/settings.intake.json`; Codex
   `-p {project-slug}-intake` after installing the generated profile.
   Sessions use the settings written from the profile's Push and
   Network lines. Generated files do not prove enforcement. Confirm
   sandbox availability and permitted surfaces in each actual client.
1. **Read the repository first.** Package and build files, lint and
   test configuration, CI, any existing docs, README, any existing
   project memory (canon or otherwise) and its rulebooks. Draft the
   profile's Identity, Stack and Conventions from that, and mark every
   field you had to guess. Then the hazard check: inventory the owner's
   live state beyond the repository, asking where you cannot see it —
   every working checkout and its branch, with work uncommitted or not
   pushed; open pull requests that write the record; work held only in
   session transcripts or scratchpads; and saved scheduled prompts or
   tasks naming the project. Before step 5 each is landed, carried into
   the record, or set aside on the owner's word, recorded.
2. **Ask only what you cannot infer**, in one short list: the gate
   command if none exists, hosting, the harness and its surface, the
   Handoff role split (never defaulted), the Secrets store ("none
   held" allowed), the Network line — proposed from the recorded
   practice, confirmed by the owner, never defaulted — and which
   standards the owner adopts. Accept any form of input: a
   conversation, a paste, URLs, a list of tools and philosophies.
3. **For each adopted standard, build or verify the digest** — follow
   "Step 3 — Build or verify the digest" below.
4. **Write the structure file.** Run `node tools/structure.mjs`, then
   fill in each directory's role and the entry points from what you
   read in step 1. Re-run the tool later to add directories; it keeps
   the roles.
5. **Write the ledger.** For a new project: the brief, Direction first,
   from the owner's description; an empty backlog with three
   milestones; empty decisions, trajectory and wish-list. For an
   existing project: the brief from what is known, the open work you
   can find as backlog lines with IDs, and one decision recording the
   adoption and what was carried over. For both: the rules file from the
   existing rulebooks, every guess marked and any migration-only
   constraint carrying `until:`; the profile's Push line (the harness
   pushes to origin after every close unless the owner records
   otherwise), Network line, Session line (350k unless the owner
   records another) and Budget line.
6. **Remove every placeholder; the Secrets line is a choice, not a
   placeholder. The owner signs** the profile, the brief and the rules
   file; a signature written under the owner's advance authorisation
   is recorded as delegated and cites its authority. Then run
   `node tools/check.mjs` and close with a commit `INTAKE: <summary>`.

After this verb the Network line governs. If a digest is needed later
and the source is unreachable, record a wish-list line; do not write
the digest from memory.

## Step 3 — Build or verify the digest

For each adopted standard, build or verify the digest from the
official source — fetch it, write the header with source, version,
retrieved date and next-check date, then the four sections; cite
sections, do not reproduce text — or, for the owner's own
conventions, a house digest with a repository source. Show the
owner the "rules that bite here" block and put the same lines in
the profile.

## Accessibility testing — with the app flag only

Dormant until V3-APP-FLAG's switch lands: v3.1 carries no app flag,
so intake never asks this yet, and the pilot's intake, by hand, is
its first use (specification 3.18). Without the line, none of this
runs and the project gains no file, read or check.

- **Ask,** with the app flag on and never without it, "Accessibility
  testing: standard or extended? (standard)". Until the pilot passes,
  only the pilot takes the pack. An existing project adopts either
  depth by its own decision; nothing is retrofitted.
- **Copy** from the source distribution, never a download: `node
  <source>/a11y/install.mjs --to . --depth <depth> --level <AA or
  AAA>`, the adopted digest's level. It copies the depth's files,
  writes the coverage file with every feature unknown, writes nothing
  if a file differs, and prints the rest.
- **By hand:** the profile's line and the rules file's By-task row,
  as the templates' comments give them; the depth's entries from
  `a11y/package.fragment.json` merged into package.json, nothing
  overwritten; `eslint.a11y.mjs` imported; `npm run a11y` in the gate;
  each new dev dependency on the owner's approval; then
  `node tools/check.mjs`.
- **The keep decision,** when the app flag's re-ask prompts it: a
  project on standard is offered extended once. Yes: the helper again
  with `--depth extended`, which adds files and keeps declarations and
  evidence, the line rewritten, the extended entries merged, then
  `npm run a11y:extended` before the keep decision closes. No: a
  decision, never offered again. A project on extended runs
  `npm run a11y:extended` before it.
