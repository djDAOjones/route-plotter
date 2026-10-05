# Digests — schema and housekeeping

A digest is a compacted, cited summary of one standard the owner has
adopted, written by the intake verb from the official source with the
network on and the owner present, or as a house digest of the owner's
own conventions and coding standards with a repository source.
The By-task table in project/rules.md routes to digests.
Agents read a digest when a task touches its domain and name the rule
they applied at close. Digests
are summaries with citations, never copies; Nielsen's heuristics are
paraphrased. Markdown, because the owner must be able to verify every
line.

## File

`project/digests/{slug}.md`, one per standard — the profile adopts it as `digest: {slug}` — with this header:

```markdown
---
standard: WCAG 2.2, level AAA
source: https://www.w3.org/TR/WCAG22/
version: W3C Recommendation, 5 October 2023 (with errata to <date>)
retrieved: 2026-09-13
next-check: 2027-03-13
licence: W3C Document Licence — summarised with attribution, not copied
---
```

Then four sections, in this order:

1. **Rules that bite here** — the ones the profile lists, each with the
   success criterion or section it comes from, one line each.
2. **Checklist by task type** — what to check when the task touches
   controls, text, colour, motion, forms, media, navigation; short.
3. **Exceptions recorded** — links to the decisions that grant them.
4. **Deeper references** — section URIs into the official source, and
   the path of a local copy if one is kept; repository paths and
   sections for a house digest.

## House digest

For owner-authored standards, use the same header fields and four
sections. Set `source:` to a repository path, `licence:` to the owner's
licence, and `version:` to the commit or date. Reuse never invents
provenance. The profile adopts the digest and the By-task table routes
to it.

```markdown
---
standard: {owner-authored standard}
source: {repository path}
version: {commit or date}
retrieved: {YYYY-MM-DD}
next-check: {YYYY-MM-DD}
licence: {owner's licence}
---
```

## Housekeeping

- `next-check` is six months after `retrieved`. The validator warns
  when it has passed; the intake verb re-checks the source for a newer
  version on request and rewrites the header and any changed rule.
- A local copy of an official document is kept only where its licence
  allows and its URI is unstable; the digest links to the URI first.
- A digest never states a rule the source does not; if the owner wants
  a stricter rule than the standard, it goes in a house digest,
  marked as the owner's, adopted in the profile and routed by the
  By-task table.
