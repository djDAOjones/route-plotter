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
- When the item ships, the file stays where it is: the trajectory line
  says "— see decisions", and the decisions entry cites the item file
  if the criteria matter to the why.
