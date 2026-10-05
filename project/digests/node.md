---
standard: Node.js release lines and support
source: https://nodejs.org/en/about/previous-releases (schedule data at https://github.com/nodejs/Release)
version: release schedule as of 2026-09-13
retrieved: 2026-09-13
next-check: 2026-10-28
licence: Copyright OpenJS Foundation and Node.js contributors; schedule summarised with attribution
---
# Node.js — digest

Which line to run on, and when that changes. The next-check date is
the October transition, when v26 becomes LTS and v24 enters
maintenance, rather than the usual six months.

## Rules that bite here

- Pin an LTS line and say so in the profile and `package.json`
  (`engines`). As of 2026-09-13: v24 Krypton is Active LTS (LTS since
  2025-10-28, maintenance from 2026-10-20, end of life 2028-04-30);
  v22 Jod is Maintenance LTS (end of life 2027-04-30); v20 Iron is
  end of life (2026-04-30) and must not be used; v26 is Current and
  becomes LTS on 2026-10-28.
- Move lines deliberately: a change of the pinned line is a decision,
  made when the current line enters maintenance, not when it dies.
- ES modules by default; no build step that the gate cannot run.
- Dependencies are the project's own rule, stated in the profile, not
  Node's.

## Checklist by task type

- New project or upgrade: `engines` set to the pinned line; the gate
  runs on it; CI matches it.
- Any dependency change: the profile's dependency rule and a decision.
- October each year: re-check the schedule; plan the move before the
  line enters maintenance.

## Exceptions recorded

- none.

## Deeper references

- Release schedule: <https://nodejs.org/en/about/previous-releases>
- Machine-readable schedule:
  <https://raw.githubusercontent.com/nodejs/Release/main/schedule.json>
- Documentation: <https://nodejs.org/docs/latest-v24.x/api/>
