<!-- markdownlint-disable MD013 MD060 -->
# Route Plotter review dossier

This directory makes the 26 August 2026 repository review, its remediation
handover and the 22 September 2026 abstraction plan durable inside the
repository. It is source documentation. It is not
part of the generated GitHub Pages application and must not be copied into or
hand-edited under `docs/`.

## Start here

| File | Role |
| --- | --- |
| `route-plotter-continuation-prompt-2026-09-26.md` | **Current** paste-ready prompt for the next development chat: land the open pull requests of the post-W2 queue and W3's pilot (#35 to #43), resolving the text conflicts between them, then finalise and merge the close-out (#44); then DEF-28, once Joe has made its design call, and whatever Joe accepts of DEF-40 to DEF-46 and TST-04. |
| `route-plotter-continuation-prompt-2026-09-25.md` | Superseded by the 2026-09-26 prompt. Historical provenance: it briefed the rest of the post-W2 queue and the W3 pilot; DEF-36 (#34) merged from it on 2026-09-25, unreleased, and every other item in it has a pull request. |
| `route-plotter-continuation-prompt-2026-09-24.md` | Superseded by the 2026-09-25 prompt. Historical provenance: it briefed the post-W2 queue; DEF-34 (#31) and TST-17 (#32) merged from it on 2026-09-24, unreleased. |
| `route-plotter-continuation-prompt-w2-2026-09-23.md` | Superseded by the 2026-09-24 prompt. Historical provenance: it briefed W2 (the live defects), released as v3.2.692. |
| `route-plotter-continuation-prompt-2026-09-23.md` | Superseded by the W2 prompt. Historical provenance: it briefed W1 (the safety net). |
| `route-plotter-continuation-prompt-2026-09-22.md` | Superseded by the 2026-09-23 prompt. Historical provenance: it briefed W0. |
| `codebase-abstraction-and-auditability-plan-2026-09-22.md` | **Adopted** refactoring programme (2026-09-22): a two-round Claude and Codex abstraction and auditability review of `main` @ `2e4d78e`, with 111 items in waves W0–W12. The owner accepted every §20 default. The backlog carries the current wave plus any unwaved defects whose prerequisite has landed. |
| `route-plotter-continuation-prompt-2026-08-27.md` | Superseded by the 2026-09-22 prompt. Historical provenance: every original review finding was dispositioned into the PM-Skills backlog. |
| `route-plotter-review-remediation-continuation-prompt-2026-08-26.md` | Superseded. Historical provenance for the remediation run it briefed. |
| `route-plotter-v3-comprehensive-repository-review-2026-08-26.md` | Full read-only review of Route Plotter at commit `cec0191`. This is historical evidence, not a description of the remediated branch's present health. |
| `route-plotter-review-finding-crosswalk-2026-08-26.md` | Maps every original `RP-01`–`RP-18` finding to the implemented work and any residual ticket, plus an audit of the review's Optional roadmap and unresolved uncertainties (updated 2026-08-27). |
| `route-plotter-review-headlines-for-novices-2026-08-26.md` | Plain-language summary of the original review, clearly labelled as a pre-remediation snapshot. |
| `read-only-comprehensive-repository-review-prompt.md` | The original review brief. It records provenance only; its read-only instruction does not govern later remediation work. |

The current product and project-management sources remain `AGENTS.md`,
`README.md`, `DEV-INFRASTRUCTURE.md`, `UI-STANDARDS.md` and
`pm_skills/project/`. If a historical review statement conflicts with current
source, tests or project memory, verify current source and record the evidence.

## Cross-project filename guard

The previous user message named
`uon-video-helper-comprehensive-review-2026-08-26.md`. That file was inspected
and is genuinely a review of the separate **UoN Video Helper** repository at
commit `66227e5`; it is not the Route Plotter review. It was intentionally not
copied here, because doing so would mix project evidence and publish unrelated
repository details. The correct Route Plotter review is the file listed above.

If a future user really intends work on UoN Video Helper, stop and switch to
that repository. Do not apply its findings, commits or paths to Route Plotter.

## Provenance and publication

The Route Plotter report and original brief were copied into this directory on
26 August 2026 after HEAD-01 shipped. The report's two machine-specific home
paths were generalised for public use; its findings, severities, evidence,
limitations and recommendations were otherwise preserved. No private samples,
temporary test artefacts, credentials or unrelated review were added.
