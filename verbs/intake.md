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
   standards the owner adopts, and, for a new web app only, the app
   flag, the profile's App opinion line ("The app flag" below). Accept any form of input: a
   conversation, a paste, URLs, a list of tools and philosophies.
3. **For each adopted standard, build or verify the digest** — follow
   "Step 3 — Build or verify the digest" below.
4. **Write the structure file.** Run `node tools/structure.mjs`, then
   fill in each directory's role and the entry points from what you
   read in step 1. Re-run the tool later to add directories; it keeps
   the roles. If step 1 found more than one container or an outside
   system, follow "Architecture record" below.
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
   records another) and Budget line. Whether or not the flag is on,
   every initialisation keeps dependency folders outside OneDrive:
   where the repository sits in a synced folder, install them
   elsewhere or exclude them from sync, and say where in the profile.
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

## The app flag — new web apps only

Specification 3.28. The flag is the profile's one line adopting the
owner's app opinion; without it none of this runs and the project
gains no file, read or check.

- **Ask** only for a new web app, one begun in this initialisation,
  never for a repository without an app, nor one adopted or migrated
  in: "App opinion for this web app: editor, forms or unsure? (on by
  default; say off to opt out)", an opt-out being recorded. The kind is the editor (a canvas or
  timeline tool with a player or export), the forms tool, or unsure,
  which takes the tooling now and the UI layer at the keep decision.
  Then Accessibility testing and the sections after it, each with
  the flag on.
- **Yes,** the default: copy from the source distribution, never a
  download, `node <source>/app/install.mjs --to . --kind <kind>`,
  after the accessibility pack (`eslint.base.mjs` imports its
  fragment). It writes nothing on a conflict and prints the rest. By
  hand: `- App opinion: <kind>, <date>` in Stack and infrastructure,
  `- The owner's app opinion → digest: app-opinion` in Standards, the
  By-task row and package merge it prints, `npm run typecheck`,
  `npm run boundaries` and `npm test` in the Gate line beside
  `npm run a11y`. Every package is the project's own dependency on
  the owner's approval. Set 1 is pinned here on his word, its known
  conflicts re-read, and recorded in project/app/set1.json.
- **Off:** write `- App opinion: off, <date>`, copy nothing, and ask
  once more at about twenty commits or a week: the checker warns when
  due. On a yes, take the whole of the Yes steps above, accessibility and
  the sections after it included, and write the line as the kind; on a no, add
  `, asked again <date>` and never ask again.
- **No retrofit:** an existing repository is never retrofitted. One
  adopted or migrated in, and one without an app, gets no line and
  none of this; adopting a part is its own decision.
- **The keep decision** is the owner's. An undecided app counts as a
  keeper at about fifty commits, and the checker warns an unsure kind
  then: ask the kind, write it in the line, and run the helper again
  with `--kind <kind>`: it adds that kind's files, replaces the
  common ESLint configuration while it is unedited (an edited one is a
  conflict, merged by hand), and prints the kind's scripts and
  dependencies to merge into package.json, nothing overwritten. The checker's other warnings are Set 1's: T2 when it was
  signed more than 183 days before the keep decision, or before today
  while none is recorded, T3 when a
  recorded end of life has passed; either asks the owner to
  re-certify, and only security patches within the certified majors
  are pre-approved.
- **The pilot's pre-registration** is unchanged: the first app's
  dated row before its first session, read at the later of day 30 and
  commit 30 by the signed outcomes. The flag claims nothing before a
  pass.

## Accessibility testing — with the app flag only

Asked with the app flag (the section above, specification 3.18).
Without the line, none of this runs and the project gains no file,
read or check.

- **Ask,** with the app flag on and never without it, "Accessibility
  testing: standard or extended? (standard)". An existing project
  adopts either depth by its own decision; nothing is retrofitted.
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

## JSDoc type check — with the app flag only

Asked with the app flag, as accessibility's is (specification 3.23).
The flag's signed stack gives a new app strict TypeScript, so the
question waits for an app kept in JavaScript by its own decision; an existing plain-JavaScript project adopts by
its own decision, by the same steps. A project that adopts neither
gains no file, read or check.

- **Ask,** with the app flag on and only when the source is plain
  JavaScript, with no TypeScript source, "Adopt the house JSDoc digest
  and the ratchet type check? (yes)". A yes authorises no dependency:
  ask the owner next for TypeScript 5.6 or later as the project's own
  dev dependency.
- **TypeScript declined:** copy `jsdoc/project/digests/jsdoc.md` alone,
  overwriting no file that differs, adopt it in Standards with its
  By-task row, and write no line: no ratchet, configuration or
  compiler check.
- **TypeScript approved:** copy from the source distribution, never a
  download, overwriting no file that differs,
  `jsdoc/project/digests/jsdoc.md`, `jsdoc/tools/jsdoc-ratchet.mjs` and
  `jsdoc/tsconfig.jsdoc.json`, each to its path without the `jsdoc/`
  prefix. By hand: the configuration's include and lib fitted to the
  source; the `typecheck` script from `jsdoc/package.fragment.json`
  merged, nothing overwritten; the profile's line, the Standards block
  and the By-task row as the templates' comments give them; `npm run
  typecheck` in the Gate line; the ratchet's `--init` once, the count
  named in a decision; then `node tools/check.mjs`.

## Model evaluations — with the app flag only

Asked with the app flag, as accessibility's is (specification 3.25).
An existing project that ships model behaviour
adopts by its own decision, by the same steps. A project that adopts
nothing gains no file, read or check.

- **Ask,** with the app flag on and only for a project that ships
  model behaviour, an app that sends a prompt to a model at run time,
  "This app sends prompts to a model. Adopt the promptfoo evaluation
  pack? (yes)". A yes authorises no dependency: ask the owner next for
  promptfoo as the project's own dev dependency.
- **promptfoo declined:** copy `promptfoo/docs/evals.md` alone to
  docs/evals.md, overwriting no file that differs, add its By-task
  row, and write no line: no configuration, replay or check.
- **promptfoo approved:** copy from the source distribution, never a
  download, overwriting no file that differs, `promptfoo/docs/evals.md`
  and everything under `promptfoo/evals/`, each to its path without
  the `promptfoo/` prefix. By hand: the example prompt, cases and
  recordings replaced by the app's own, outputs recorded live only on
  the owner's word, the provider, host and cost named in a decision;
  the two scripts from `promptfoo/package.fragment.json` merged,
  nothing overwritten; the profile's line and the By-task row as the
  templates' comments give them; `node evals/check.mjs` and `npm run
  evals` in the Gate line; then `node tools/check.mjs`.

## Architecture record — offered, default no

Not under the app flag: the file is record, not an app opinion
(specification 3.26). An existing project adopts by its own decision,
by the same steps. A project that adopts nothing gains no file, page,
read or check: the record is the file that carries the template's
mark line, `<!-- pm-next architecture record, specification 3.26 — keep this line -->`,
and a document of the project's own at the same path, without it, is
read, shown and checked as before. Such a project adopts only by
moving its document first, by its own decision.

- **Offer,** only when step 1 found more than one container — an
  application or data store that runs on its own — or an outside
  system the project talks to, never inferred from directories alone:
  "Record the system's context and containers as diagrams in
  project/architecture.md? (no)". Declined, nothing is written.
- **Accepted:** copy `architecture/template.md` from the source
  distribution to project/architecture.md, overwriting no file that
  differs. Fill it from what step 1 read the project running: the
  system context, the containers only for more than one, each text
  alternative in sentences with every guess marked [guess], then the
  Updated line, keeping the mark line. Add the By-task row as the rules template's comment
  gives it; then `node tools/check.mjs` and `node tools/view.mjs`.
