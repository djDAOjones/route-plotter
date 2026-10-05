---
standard: IBM Carbon Design System, productive style
source: https://carbondesignsystem.com/ (guidelines and elements; site source at https://github.com/carbon-design-system/carbon-website)
version: Carbon v11; @carbon/react 1.116.0 at retrieval
retrieved: 2026-09-13
next-check: 2027-03-13
licence: Apache-2.0 (Copyright 2018 IBM Corp., code and site source) — summarised with attribution
---
# IBM Carbon — digest

Carbon is the reference design system: its components, patterns,
tokens and conventions come first, and a custom control needs a
reason. Carbon targets WCAG AA; a project that targets AAA adapts
Carbon's defaults where they meet AA only.

## Rules that bite here

- Component first: use the Carbon component or pattern that fits
  before inventing one; a custom control is a decision that says why.
- Productive style for the working interface: the "-01" type styles,
  condensed for task focus; expressive "-02" styles only for editorial
  or marketing surfaces.
- Type: IBM Plex Sans, Serif and Mono with their fallbacks; a type
  scale from a 12 px base, stepped by the scale formula.
- Spacing: the spacing tokens spacing-01 to spacing-13 are 2, 4, 8,
  12, 16, 24, 32, 40, 48, 64, 80, 96 and 160 px; spacing is multiples
  of 2, 4 and 8 on the 2x grid; jump steps on the scale by
  breakpoint rather than inventing values.
- Accessibility: Carbon components follow the IBM Accessibility
  Checklist, which is based on WCAG AA, Section 508 and the European
  standard; product teams remain responsible for keyboard paths,
  screen-reader testing, logical reading order, no autoplay and no
  flashing content, captions and transcripts. Where this project's
  profile says AAA (7:1 contrast, 44 px targets), those override
  Carbon's AA defaults.
- Tokens, not literals: colour, layer, border, interaction-state and
  motion tokens; a raw hex or pixel value in component code is a
  smell.

## Checklist by task type

- New control: which Carbon component or pattern; which tokens; which
  states (hover, focus, active, disabled, error) it exposes.
- Layout: the 2x grid, the spacing scale, the productive type styles.
- Colour: tokens, then the project's contrast rule on top.
- Motion: Carbon's motion tokens, and the project's reduced-motion
  rule.
- Review: name the component followed, or the reason a custom one was
  necessary.

## Exceptions recorded

- none.

## Deeper references

- Accessibility overview:
  <https://carbondesignsystem.com/guidelines/accessibility/overview/>
- Spacing: <https://carbondesignsystem.com/elements/spacing/overview/>
- Typography: <https://carbondesignsystem.com/elements/typography/overview/>
- 2x grid: <https://carbondesignsystem.com/elements/2x-grid/overview/>
- Components: <https://carbondesignsystem.com/components/overview/>
- Source and versions: <https://github.com/carbon-design-system/carbon>
