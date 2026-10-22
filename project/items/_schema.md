# Items — schema

An item that has criteria or context worth keeping gets a file,
`project/items/{ID}.md`, with the backlog line as its index. The line
carries status, milestone and date; the file carries what a single
line loses. Two guards, from the long stream: the wish-list line stays
the cheap capture surface, so a passing thought never pays the record
cost, and the plan verb is what promotes a line into an item; close
never has to write one.

## File

```markdown
# {ID} — {title}

## Intent

One paragraph: what changes for whom, and why now.

## Acceptance criteria

- one line each, checkable at close

## Now

Updated: YYYY-MM-DD

Next step: the next concrete action, or None.

Open question: the question still unresolved, or None.

## Context and sources

- the decisions, digests, files or URLs this item derives from, one
  line each, as paths or links (the validator checks that named paths
  exist)

## Notes

- anything learned while the item is open; dated lines
```

## Rules

- The ID in the heading matches the file name and a backlog line while
  the item is open, or a trajectory line once shipped. A file with
  neither is an orphan and the validator warns. Exactly one top-level
  heading and nonempty intent, criteria and sources are required.
- Status lives only on the backlog line; the file never repeats it.
- Now is optional and rewritten, never appended: one `Updated:` date,
  the date of its last rewrite, then `Next step:` and `Open question:`
  in that order, each a non-empty paragraph. It never carries status
  or a backlog mark; a question for the owner begins `Owner:` while
  its `[!]` mark stays on the backlog line. A new file includes it; an
  existing file gains it at its next close, with no bulk backfill.
  Notes stay the history, each entry beginning `- YYYY-MM-DD —`.
- A session resuming an item reads its heading, Intent, criteria and
  Now, and opens Notes when the Now does not answer.
- The checker reports, as information only, a Now updated before the
  item's latest dated note, or one without a single valid date. It
  compares dates, so a same-day rewrite that missed a note goes
  unseen.
- When the item ships, the file stays where it is: the trajectory line
  says "— see decisions", and the decisions entry cites the item file
  if the criteria matter to the why.
