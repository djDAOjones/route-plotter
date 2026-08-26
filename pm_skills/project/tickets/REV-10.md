# REV-10 — Reference-aware image asset pruning

> **Status:** Phase 1 — ready.

## Intent

Prevent repeated custom marker/head replacement from exhausting the bounded
project asset budget without breaking undo, recovery or saved projects.

## Done when

- A single reference collector accounts for live waypoint markers, the route
  head, scene state and every retained undo/redo snapshot.
- Assets are removed only at documented safe boundaries; undo/redo can still
  restore every referenced image and replacement cannot resurrect stale work.
- Replacement, deletion, Clear All, project import/export, autosave degradation
  and history truncation have round-trip tests at the 128-asset/40 MiB limits.
- Pruning is deterministic and cannot delete assets from a staged but
  uncommitted project load.

## Approach

Compute reachability from serialisable model/history roots and sweep the asset
service after commits that make references unreachable. Keep staging detached
until project commit and prefer a conservative retained asset over data loss.

## Constraints

Preserve existing asset IDs and transactional import rollback. Do not inspect
opaque image bytes to infer ownership.

## Open questions

Whether autosave keeps a separate recovery-reference root; the best sweep
boundary after undo-history eviction.
