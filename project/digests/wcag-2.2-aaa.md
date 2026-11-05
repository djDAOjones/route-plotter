---
standard: WCAG 2.2, level AAA
source: https://www.w3.org/TR/WCAG22/
version: W3C Recommendation first published 5 October 2023; this version 12 December 2024; errata at https://www.w3.org/WAI/WCAG22/errata/
retrieved: 2026-10-30
next-check: 2027-04-30
licence: Copyright © 2020-2024 World Wide Web Consortium; W3C liability, trademark and document use rules apply — summarised with attribution, not copied
---
# WCAG 2.2 AAA — digest

Level AAA means every A, AA and AAA success criterion applies. These
bite in a typical interface; the full list is the source. A
close cites its criterion. 4.1.1 Parsing is removed in 2.2.

## Rules that bite here

- 1.4.6 Contrast (Enhanced), AAA: text and images of text at least
  7:1, large-scale 4.5:1; none for incidental text or logotypes.
- 2.5.5 Target Size (Enhanced), AAA: pointer targets at least 44 by 44
  CSS pixels, except an equivalent same-page link or control that size,
  in a sentence or text block, an unmodified user-agent size, or an
  essential presentation.
- 2.5.8 Target Size (Minimum), AA: pointer targets at least 24 by 24
  CSS pixels, subject to the source's five exceptions.
- 2.1.3 Keyboard (No Exception), AAA: all functionality operable by
  keyboard, path-dependent functions included, with no keystroke timing
  required.
- 2.4.12 Focus Not Obscured (Enhanced), AAA: a component receiving
  keyboard focus has no part hidden by author-created content.
- 2.4.13 Focus Appearance, AAA: when visible, a keyboard focus indicator
  has an area at least that of a 2 CSS pixel thick perimeter of the
  unfocused component or sub-component, with at least 3:1 contrast
  between the same pixels focused and unfocused; exempt if the user
  agent fixes it, or the author modifies neither it nor
  its background colour.
- 2.3.3 Animation from Interactions, AAA: motion animation from
  interaction can be disabled unless essential. 2.3.2 Three Flashes,
  AAA: nothing flashes more than three times in any one second.
- 3.2.5 Change on Request, AAA: any change of context starts only at
  the user's request, or the user can turn them off.
- 1.4.8 Visual Presentation, AAA, for blocks of text: a mechanism,
  possibly the browser's, gives user-chosen foreground and background
  colours, width at most 80 characters or glyphs (40 for CJK),
  unjustified text, line spacing at least space-and-a-half, paragraph
  spacing at least 1.5 times that, and text resizable to 200% without
  assistive technology or horizontal scrolling to read a line on a
  full-screen window.
- 2.2.6 Timeouts, AAA: warn of the duration of inactivity that could
  lose data, unless it survives over 20 hours without user action.
- 3.3.6 Error Prevention (All), AAA: submissions are reversible, or
  input is checked with a chance to correct, or the user can review,
  confirm and correct before finalising.
- 2.5.7 Dragging Movements, AA: dragging also works by a single pointer
  without dragging, unless essential or unmodified user-agent behaviour.
- 2.4.9 Link Purpose (Link Only), AAA: a mechanism lets link text alone
  give each link's purpose, unless ambiguous to users generally.
- 1.4.9 Images of Text (No Exception), AAA: only pure decoration or an
  essential presentation; logotypes count as essential.
- 2.4.10 Section Headings, 3.3.5 Help: AAA.

## Checklist by task type

- Controls: 2.5.5, 2.5.8, 2.1.3, 2.4.12, 2.4.13, 3.2.5.
- Text and colour: 1.4.6, 1.4.8, 1.4.9.
- Motion: 2.3.3, 2.3.2.
- Forms: for automatically detected input errors, identify the item and
  describe the error in text (3.3.1); give known correction suggestions
  unless jeopardising security or content purpose (3.3.3); 3.3.6, 2.2.6,
  3.3.5.
- Media: 1.2.x at AAA.
- Navigation: 2.4.10, 2.4.9, 2.4.8.

## Exceptions recorded

- none. An exception is a decision entry naming the criterion and why.

## Deeper references

- Each criterion: <https://www.w3.org/TR/WCAG22/>
- Understanding documents: <https://www.w3.org/WAI/WCAG22/Understanding/>
