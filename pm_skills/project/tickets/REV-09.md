# REV-09 — Licence, security, and support governance

> **Status:** Phase 1 — approved and ready; gates SUPPORT-01.

## Intent

Give contributors and downstream users an owner-approved statement of reuse,
third-party source/notice obligations, vulnerability reporting, and support.

## Approved contract

- First-party source is MIT licensed. A third-party notice names bundled
  dependencies, their licences and upstream source locations; generated
  bundles keep required licence comments.
- Security reports use GitHub private vulnerability reporting. General support
  uses GitHub Issues on a best-effort basis with no response-time commitment.
- V1 does not publish a per-release SBOM; the lockfile plus checked notice and
  release inventory are the reproducible dependency record.

## Done when

- The owner/legal reviewer selects the repository licence and confirms the
  treatment of bundled MPL and other third-party material.
- A top-level licence, required notices/source links, security-reporting route,
  and support/maintenance scope ship with a checked release inventory.
- CI verifies that required governance files and generated-artifact notices are
  present without presenting technical checks as legal advice.

## Evidence / context

RP-15 found no top-level licence, notice/SBOM, security policy, CODEOWNERS, or
documented support route. Runtime and CI pins are technical work; choosing legal
terms and a disclosure channel is not.

## Approach

Prepare an inventory of first-party ownership, direct/transitive licences,
bundled comments and source-link requirements. Present options and repository
diffs for per-document sign-off before writing policy text.

## Constraints

Do not infer a licence from repository visibility or package metadata. Do not
publish an email or response commitment the maintainer has not approved.

## Open questions

None at the governance gate. This records an owner decision, not legal advice.
