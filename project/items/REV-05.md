# REV-05 — Accessibility assurance · Accessibility assurance

## Intent

Everything automatable is done and green: structural audit, AAA contrast sampling, 400%-zoom reflow, and axe over both the static shell and the shell as JavaScript leaves it (48 rules, zero violations, contrast evaluated live in Chromium). A11Y-01 and A11Y-02 closed the two findings this audit spun out, so forced-colours fallbacks now exist and are proved to ship — what remains is *looking* at them under a real high-contrast theme, a reduced-motion emulation pass including canvas motion (restored 2026-09-22; it left this residual at `24e650c` without an owner call), plus the screen-reader pass. All stay owner-run.

## Acceptance criteria

- Complete the outcome in Intent within the canon line's constraints; the canon text below is the record, and the owner's notes in it stand.
- The owner's part is named on the backlog line's blocker; nothing closes without it.

## Context and sources

- [The canon backlog line](../../pm_skills/project/backlog.md) — carried verbatim below at the migration (2026-10-01)
- [The frozen canon record](../history.md) — decisions and shipped work before the migration

## Notes

- 2026-10-01 — Carried verbatim from canon 4.7.0 at 75ba7ae by the v3 migration (V3-FIELD-2); the canon section was "Current", flags [verify: NVDA/VoiceOver + forced-colours + reduced-motion emulation]. The canon line (its ticket link re-pointed to the frozen ticket):

```text
- [~] **REV-05 Accessibility assurance** · Accessibility assurance
[verify: NVDA/VoiceOver + forced-colours + reduced-motion emulation] —
Everything automatable is done and green: structural audit, AAA contrast
sampling, 400%-zoom reflow, and axe over both the static shell and the shell
as JavaScript leaves it (48 rules, zero violations, contrast evaluated live in
Chromium). A11Y-01 and A11Y-02 closed the two findings this audit spun out, so
forced-colours fallbacks now exist and are proved to ship — what remains is
*looking* at them under a real high-contrast theme, a reduced-motion
emulation pass including canvas motion (restored 2026-09-22; it left this
residual at `24e650c` without an owner call), plus the screen-reader pass.
All stay owner-run.
```
