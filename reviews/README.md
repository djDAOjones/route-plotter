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
| `route-plotter-continuation-prompt-w2-2026-09-23.md` | **Current** paste-ready prompt for the next development chat: fix the live defects (W2 and the eight ground-rule-8 defects W1 released), with Codex as the comparative reviewer. |
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
