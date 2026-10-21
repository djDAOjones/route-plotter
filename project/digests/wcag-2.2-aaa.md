---
standard: WCAG 2.2, level AAA
source: https://www.w3.org/TR/WCAG22/
version: W3C Recommendation first published 5 October 2023; this version 12 December 2024; errata at https://www.w3.org/WAI/WCAG22/errata/
retrieved: 2026-09-13
next-check: 2027-03-13
licence: Copyright © 2020-2024 World Wide Web Consortium; W3C liability, trademark and document use rules apply — summarised with attribution, not copied
---
# WCAG 2.2 AAA — digest

Level AAA means every A, AA and AAA success criterion applies. The
lines below are the ones that bite in a typical product interface;
the full list is the source. Each line names its success criterion so
a close can cite it. 4.1.1 Parsing is obsolete and removed in 2.2.

## Rules that bite here

- 1.4.6 Contrast (Enhanced), AAA: text contrast at least 7:1; large
  text and images of large text at least 4.5:1.
- 2.5.5 Target Size (Enhanced), AAA: pointer targets at least 44 by
  44 CSS pixels, except an equivalent control of that size on the same
  page, a target inline in text, a user-agent-sized target, or an
  essential presentation. (2.5.8, AA, sets the floor at 24 by 24.)
- 2.1.3 Keyboard (No Exception), AAA: all functionality operable by
  keyboard, path-dependent functions included (2.1.1 exempts them),
  with no keystroke timing required. No Keyboard Trap is 2.1.2, A.
- 2.4.12 Focus Not Obscured (Enhanced), AAA: no part of the focused
  component is hidden by author-created content. 2.4.13 Focus
  Appearance, AAA: the indicator is at least as large as a 2 CSS pixel
  thick perimeter and has at least 3:1 contrast against its unfocused
  state.
- 2.3.3 Animation from Interactions, AAA: motion triggered by
  interaction can be disabled unless essential — honour
  `prefers-reduced-motion`. 2.3.2 Three Flashes, AAA: nothing flashes
  more than three times in any one second.
- 3.2.5 Change on Request, AAA: any change of context starts only at
  the user's request, or the user can turn such changes off.
- 1.4.8 Visual Presentation, AAA, for blocks of text: a mechanism,
  possibly the browser's, gives user-chosen foreground and background
  colours, width at most 80 characters or glyphs (40 for CJK),
  unjustified text, line spacing at least space-and-a-half, paragraph
  spacing at least 1.5 times that, and text resizable to 200% without
  assistive technology or horizontal scrolling to read a line on a
  full-screen window.
- 2.2.6 Timeouts, AAA: warn of any inactivity timeout that can lose
  data unless the data is kept for more than 20 hours.
- 3.3.6 Error Prevention (All), AAA: submissions are reversible,
  checked, or confirmed before they commit.
- 2.5.7 Dragging Movements, AA: any drag has a single-pointer
  alternative. 2.4.9 Link Purpose (Link Only), 2.4.10 Section
  Headings, 3.3.5 Help, 1.4.9 Images of Text (No Exception): AAA.

## Checklist by task type

- Controls: 44 by 44 target or a stated exception; keyboard path;
  visible focus of 2 px perimeter and 3:1; no context change on focus.
- Text and colour: 7:1, or 4.5:1 for large text; no images of text;
  1.4.8's mechanism for reading blocks.
- Motion: reduced-motion honoured; no flash above three per second;
  interaction animation can be turned off.
- Forms: errors prevented, then recoverable; submissions reversible or
  confirmed; timeouts warned; help available in context.
- Media: captions, audio description, sign language and media
  alternatives per 1.2.x at AAA.
- Navigation: section headings; link text that stands alone; location
  cues (2.4.8).

## Exceptions recorded

- none. An exception is a decision entry that names the success
  criterion and the reason.

## Deeper references

- <https://www.w3.org/TR/WCAG22/#contrast-enhanced> ·
  <https://www.w3.org/TR/WCAG22/#target-size-enhanced> ·
  <https://www.w3.org/TR/WCAG22/#focus-appearance> ·
  <https://www.w3.org/TR/WCAG22/#animation-from-interactions> ·
  <https://www.w3.org/TR/WCAG22/#visual-presentation> ·
  <https://www.w3.org/TR/WCAG22/#error-prevention-all>
- Understanding documents: <https://www.w3.org/WAI/WCAG22/Understanding/>
- What is new in 2.2: <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>
- Quick reference: <https://www.w3.org/WAI/WCAG22/quickref/>
