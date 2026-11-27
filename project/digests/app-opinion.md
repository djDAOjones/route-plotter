---
standard: The owner's app opinion, for an app under the app-opinion flag
source: project/digests/app-opinion.md (copied from lab/next-v31/app/README.md in pm-skills' source, "Provenance")
version: signed 2026-10-28; pack 2026-11-11
retrieved: 2026-11-11
next-check: 2027-05-11
licence: the owner's, as the repository's
---
# The app opinion — house digest

<!-- cspell:ignore playhead -->

His conventions signed on 2026-10-28, his three lines quoted;
"Advice — unsigned" marks the lab's.

## Rules that bite here

- **Level:** AAA aim, AA floor: a shortfall recorded, then fixed or
  excepted, never silent; an AA failure blocks.
- **Both kinds:** fonts and assets bundled, none fetched; 44 px
  targets or a named 2.5.5 exception, measured; contrast
  measured on the tokens at 1.4.6's 7:1, or 4.5:1 for large text;
  focus at 2.4.12 and 2.4.13; Carbon's layout tokens imported; a
  custom control records why.
- **The editor** (a canvas or timeline tool with a player or export):
  React renders the chrome and a semantic view of the canvas, may
  mount the canvas host, never draws, evaluates frames or moves the
  playhead. Carbon React for standard chrome controls, its gaps
  bespoke on its tokens; a native input may replace its number input
  until Route Plotter's digit loss is understood. Plain TypeScript for
  canvas loop, playhead, transport, hit-testing, key dispatch, export
  and player, the core's state readable without React; no store
  prescribed; one owner per DOM subtree. One shortcut dispatcher with
  a role table: keys stand down in text entry, composition and widgets
  owning their keys; single keys can be turned off or remapped
  (2.1.4); every canvas action and drag has a keyboard path (2.1.3);
  focus returns after dismissal; focused controls never remount. The
  player: no React, no Carbon, no network.
- **The forms tool** (data entry, settings, admin): React renders it
  all, Carbon React throughout; plain TypeScript holds validation,
  persistence and export. Labels visible, errors recoverable;
  submissions reversible, checked or confirmed (3.3.6); focus to an
  error summary on a failed submit; shortcuts through the editor's
  dispatcher.
- **Unsure:** the tooling and his signed lines now; no React or Carbon
  default until the keep decision asks the kind; the accessibility
  line asked as usual. Undecided at about 50 commits, it counts as a
  keeper and the re-ask asks its kind.
- **Line 1:** "one owner for each piece of data; changes through
  commands only where undo, autosave or export snapshots exist,
  reconciled with Route Plotter’s event-bus rule (commands for
  changes, events for notifications)". Read: a command may travel on a
  synchronous bus; an event never changes data; durable data only,
  not focus, menus or uncommitted drafts. Enforced in part. Hypothesis.
- **Line 2:** "a deterministic core with no wall clock wherever
  there’s a timeline". Read: time, model and seed are inputs, and the
  same inputs give the same frames; drawing, scheduling and storage
  sit outside the core. Enforced in part. Hypothesis.
- **Line 3:** "players and exports import only the core, never the
  editor or a UI framework, enforced by dependency-cruiser". Read,
  "core plus adapters": the core is the evaluation plus adapters that
  import neither the editor nor a UI framework; "exports" is the
  exported artefact's code, not the editor's export orchestration.
  Enforced for imports only. Hypothesis.

## Checklist by task type

- A control: Carbon's, or why not; target and contrast measured.
- A canvas action, drag or shortcut: its keyboard path and role.
- A core change: no wall clock where there’s a timeline, no DOM types.
- A dependency or departure: rules 7 and 8; departing from a signed
  default or line is a decision he signs.
- The core in src/core/, checked by `npm run
  typecheck`; a player or exported import checked by `npm run
  boundaries`; the core test-first in Vitest; the interface in a real
  browser, no jsdom; Carbon's button and link tokens toward 7:1.

## Exceptions recorded

- 2026-11-27 — Line 3, the player: the exported player uses each
  feature's `model/` and `draw/` parts through the player-safe
  catalogue (`src/features/catalogue.ts`:12-24,
  `src/player/compose.ts`:17), the feature folders the owner asked
  for; it still holds no editor part, React or Carbon, checked by
  `npm run boundaries` (`.dependency-cruiser.cjs`:58-59). Decision
  STACK-05, 2026-11-27, on his word "ideally you just decide what is
  best, but I want the full suite minus promptfoo".
- 2026-11-27, dated and temporary — "focused controls never
  remount": the editor's Carbon slider is remounted, focused or not,
  its focus taken back, after a key that moved it, a refused report or
  a new setting (`src/editor/kit/SettingSlider.tsx`:24-38, 103-113,
  226). Fixed before CORE-13 or CORE-12 adds another slider, by a
  trial of the browser's own range input in that file; until then this
  exception stands. Decision STACK-05, 2026-11-27, on the same word.

## Deeper references

- `lab/next-v31/app/README.md`: provenance, templates, proposals.
- The Carbon and WCAG 2.2 AAA digests.
