# DEF-98 — Restore drops the background

## Intent

A session that browser recovery restores opens on a blank canvas: the route, its waypoints and its crowds come back, and the background they were placed on does not. Recovery is model-only by design: its snapshot keeps the route model and never a background's bytes or name (`src/app/persistence.js` (:636–668)), and start-up loads the default map only when nothing was restored (`src/app/startup.js` (:14)). So even a background the app ships comes back white: the default map, an Example Backgrounds image, or an example project's own (`src/examples/index.js` (:196–226)). Nothing on screen says so. The omission notice goes only to the screen-reader announcer (`index.html` (:18), `sr-only`), once per project opened, restored or cleared (`src/app/persistence.js` (:678–693), (:1126–1131)), when its first autosave leaves the background out; an ordinary restore then says "Previous session restored". A record from before the model-only rule that still holds a background's bytes is restored with it once, then rewritten without it (:505–510), (:1516–1531), so that background is lost at the next reload. Waypoints are stored as normalised image coordinates (`src/utils/imageCoordinates.js`), so the only background that fits a restored route is the one it was made on. The owner met it in use on 2026-10-13 and chose that recovery keeps the background, an uploaded one included, superseding the model-only boundary for backgrounds (the decisions, DEF-98). **P2**

## Acceptance criteria

- A session restored from browser recovery shows the background it was saved with, bundled (the default map, an Example Backgrounds image, an example project's) or uploaded (PNG, JPEG or WebP), at the same fit, overlay and zoom, with the route where it was on it.
- After that restore, Save Project and the ZIP and HTML exports carry the background as they would had it been chosen in this visit (`getRetainedBackgroundDataURL`, `src/app/persistence.js` (:578–605)).
- A record that still holds a background's bytes, from before the model-only rule, keeps them through its restore: the background survives a second reload.
- A background that cannot come back (a model-only record from before the fix, or one the browser refused to keep or has since lost) is said on screen, not only to the announcer, with a way to choose it again; the restore never puts another image in its place.
- A background that cannot be kept when recovery is written is said on screen and announced then, not first at the next restore; recovery is never reported as kept when it was not; and a recovery point never pairs a route with a background from another state.
- A background recovery keeps raises no background-omission warning (`reportAutosaveOmissions`, `src/app/persistence.js` (:678–693)); custom images it leaves out still raise theirs.
- Clear All removes the kept background with the rest of the recovery point and stops any write of it still pending, so a cleared background cannot return on reload, by a late write or by undo; Clear All's non-undoable empty baseline and a restore's history reset stay as they are (`src/app/projectReset.js` (:102–113); `src/app/persistence.js` (:1106)).
- The documents that state the model-only boundary state the new one: `project/brief.md` (:97–98), README's Auto-save section (:142–146) and its pitfall line (:343–345), and the comments in `src/app/persistence.js` (:636–640) and `src/app/backgroundLoading.js` (:101–102), (:145).
- A regression test fails before the fix and passes after it: an uploaded background and a bundled one, each autosaved, then the app booted again from that record, shows the same image at the same size under the route.
- No new dependency (the rules: jszip and mediabunny only); every existing test stays green; none is deleted, skipped or weakened.

## Context and sources

- `src/app/startup.js` (:9–18): restore first; the default map only when nothing was restored
- `src/app/persistence.js` (:578–605), (:613–693), (:1480–1555): the retained source bytes, the model-only snapshot and its omission notice, `loadAutosave`
- `src/app/backgroundLoading.js` (:93–165): the two background loaders and their export-only source cache
- `src/services/StorageService.js` (:7): the recovery record's 4 MiB cap; `src/models/ImageAsset.js` (:6): a background may be 16 MiB
- `src/examples/index.js` (:196–226): each example project's bundled background
- `index.html` (:18): the announcer, screen-reader only
- `project/brief.md` (:97–98): image bytes kept "only in explicit saves/exports"
- `pm_skills/project/archive/decision-log-2026-08-17-to-2026-08-26.md` (:424–448): REV-10's persistence boundary, "Autosave remains deliberately model-only"
- [The decisions](../decisions.md): DEF-98 (the filing, with the owner's question and answers)

## Notes

- 2026-10-13 — Filed on the owner's word; Codex r1 on the filing (`19b36e2`) added the write-failure, omission-warning and image-bearing-record criteria and Clear All's pending writes. The filing session confirmed it in Chromium on live v3.2.717 (the pane, 1280×800): a recovery record the live smokes had left, the Open day example's route and crowd (6 waypoints, 1 crowd), was restored on a white canvas, with `app.background.image` null. The fallback criterion (a background that cannot come back is said on screen with a way to choose it again, and never replaced) is the filing session's proposal, for the owner to confirm, as is P2. Where the background's bytes are kept is not decided: not every supported background fits in today's 4 MiB record, whose text grows by a third in base64.
