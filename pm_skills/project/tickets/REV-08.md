# REV-08 — Publication and privacy boundary

> **Status:** Phase 1 — approved and ready; gates SUPPORT-01 and DEMO-01.

## Intent

Make it explicit which local project data may enter a public Pages artifact,
shared export, or support bundle, then enforce that boundary mechanically.

## Approved contract

- The six allowlisted built-in backgrounds in the approved public branch may
  ship; legacy project ZIPs remain excluded until separately reviewed.
- Manual project/HTML exports preserve original bitmap bytes for fidelity and
  disclose that filenames/metadata may travel with an explicitly shared file;
  no destructive re-encoding happens silently.
- Diagnostics are previewed before copy/download and redact project content,
  raw storage, image bytes and user filenames by default. The app remains
  client-only with no telemetry or automatic upload.

## Done when

- The owner has reviewed provenance and publication permission for every
  shipped sample image and project archive.
- The build allowlist, compatible CSP, imported-style grammar, asset metadata
  policy, and diagnostics preview/redaction rules implement the approved
  boundary.
- Artifact, hostile-style, outbound-network, metadata, and sensitive-log
  fixtures demonstrate that only documented fields leave the browser.

## Evidence / context

RP-17 found that imported colours could reach CSS fetch-capable properties,
the old recursive build copied unreviewed archives, and original filenames,
metadata, route details and arbitrary log objects can cross a manual sharing
boundary. This branch switches to `backgroundColor`, strict bitmap formats and
an explicit Pages allowlist, but provenance, CSP, metadata and log policy need
an owner decision.

## Approach

Inventory each boundary separately: local recovery, project ZIP, standalone
HTML/video, public Pages files, and support diagnostics. Present the actual
fields and fidelity trade-offs before proposing redaction or re-encoding.

## Constraints

Do not remove public assets, rewrite history, strip metadata, or weaken image
fidelity without sign-off. Preserve the client-only/no-telemetry posture.

## Open questions

None at the policy gate. New sample projects still require an individual
provenance record before entering the public build allowlist.
