# Accessibility testing

Read on any task that touches a UI state, component or journey. The
profile's `Accessibility testing` line sets the depth; the coverage
file sets the level and the features.

## Method

- `npm run a11y` is the gate: axe at the level's tags, measured
  contrast, targets and focus, the adaptations, keyboard walks and
  the authored journeys, then the report. Its output stays outside
  the checkout.
- Declare each new state, dialog, keyboard function and journey in
  tests/a11y/project.mjs, with a reviewed ARIA snapshot. Keep the
  coverage file's features true: an unknown feature is never absent.
- `npm run a11y:sample`, by hand against test data, walks the app
  for states nobody declared, samples them by WCAG-EM's rule and
  checks each against its own default render. Declare a state it
  finds that matters.
- A failure is fixed in the product. Never weaken a check, skip a
  test, add a delay to input or update a snapshot to pass; an
  exception is the owner's, recorded in decisions.

## Reading the report

Four outcomes stay apart: the suite result; each criterion's status
(failed, checked, unverified, blocked, not applicable); completeness;
and the release decision, the owner's. Checked means every automated
method passed and says nothing of the human part. Blocked and empty
runs fail. An indicator or an axe incomplete is a candidate for
review, never a pass.

## The claim

Never write "conforms" or "accessible". The report's footer is the
claim: "Configured checks passed for the stated scope" or the
failures; "these criteria remain unverified" with the list;
"participant testing was not conducted", or the participation
record's date.
