# design-review — a staged design, UX and accessibility review

An add-on no rule reads (specification 3.20), run only when the owner
asks for a review of a product with a user interface. Its stage
documents and templates sit in the source distribution's
`design-review/` folder, which installation does not copy.

1. **Start.** Name the item, its approved timebox and an evidence lane
   the project's evidence rule allows. Find the local v3.1 source;
   if it is not on this machine, ask the owner where it is, never
   fetch it or write the stages from memory. Copy its
   `design-review/` folder into the lane as `<run>/method/`, record the
   source commit and each file's SHA-256, and read
   `<run>/method/README.md`.
2. **Roles.** One model writes everything. A second model reviews at
   seven fixed checkpoints, read-only, and never edits; save its
   output word for word beside the brief it was given.
3. **Plan, stage 1.** Fill every `{{SLOT:…}}` in the plan from the
   project's own standards, journeys, languages and design rule;
   checkpoint 1; then ask the owner.
4. **Tools, stage 2.** Freeze a snapshot outside the working copy and
   launch checkpoint 2, the blind review, first. Prove each tool,
   keep the manifest, run a pilot; checkpoint 3.
5. **Evidence and judging, stages 3 and 4.** Run the matrix, account
   for every cell, check earlier fixes; judge the journeys and each
   standard's table; draft findings and the person's script.
6. **Report and fix plan, stages 5 and 6.** Merge the blind review;
   checkpoint 4. Rank 1 and 2 findings become fix items with their
   cost, rank 3 suggestions; checkpoint 5; then ask the owner.
7. **Fix items.** One at a time, built as any change; checkpoint 6
   reviews the final candidate before its commit, and a verdict on an
   earlier version never certifies a changed one.
8. **Final check and close, stages 7 and 8.** Measure everything
   again beside the first run, explain every change; checkpoint 7;
   then ask the owner and close.

Throughout:

- **Ask the owner at four points:** the plan, the fix plan, any rank 1
  finding found mid-review, at once, and the close.
- **The design rule limits the fixes, never the findings.** A fix that
  would break it goes to the owner, flagged and recommended against.
- **Findings are numbered across all passes** (V-01, V-02, …), never
  reused or renumbered; a regression or a half-finished fix keeps its
  number.
- **Disagreements:** facts by evidence, both views kept, or
  "unresolved"; judgement calls go to the owner with both positions,
  and only the contested fix waits.
- **Keep unchanged, whatever is adapted:** proving the tools before
  trusting them; the manifest that accounts for every cell; the blind
  review saved before any findings; "unverified" and "unresolved" as
  allowed answers; the second full run at the end.
- **Never claim full conformance.** The person's script is handed over;
  its results are not a close gate, and every check not performed is
  listed.
- **Keep the evidence small:** commit the plan, the manifest, one
  summary per tool, the tools and only the screenshots a finding
  cites; raw runs and verbatim reviews follow the project's evidence
  rule.
