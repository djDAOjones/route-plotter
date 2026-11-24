# The review of decisions D1 to D200, and the owner's answers of 24 November 2026

This file is the word-for-word record of the owner's answers to the ten
findings, D202 to D211, of a review of the decisions taken for him so far,
D1 to D200 in the night's decisions list (`DECISIONS-FOR-JOE.md`, kept in
the session notes outside this repository). On 24 Nov he opened a chat and
asked it to review them; it raised the ten findings and put each to him by
question dialogs, in three rounds, at about 14:51 UTC. That chat kept his
answers in `JOE-ANSWERS-2026-11-24-1451.md`, also in the session notes.
Everything quoted from him below is copied from that file. Nothing here is
a decision: the PLAN-9 decision entry of 2026-11-24 cites this file and
rules on it.

## How to read this file

- Each answer is marked either **label**, an option's label he selected in
  a dialog, or **typed**, his own words. The labels, the questions and the
  options' words were written by the asking chat, not by him; what he chose
  is the option. His spelling is kept.
- **Asked** is the question as the dialog showed it. **The option read** is
  the words of the option he chose, as the dialog showed them: the asking
  chat's words, not his. **Not chosen** lists the other options' labels.
- He typed three things in all: the chat's opening line, and two lines on
  D207's try. Everything else of his below is a label he selected.
- Readings, the asking chat's, are in a section of their own at the end,
  marked as readings. A reading is a proposal until he confirms it.

## How he came to be asked

- Typed, the chat's first message: "can you review the 200 decisions made so far and highlight you any you think were decided wrong"
- Then "Yes, write them", and later "Yes, go through them". Each is word for word a button the asking chat had offered under its reply, so each is read as that button chosen (a label written by the asking chat), not as words he typed.

## Round 1

- **D202** — Asked: "D202: the preview takes your picture's shape, but label widths, label offsets and line sizes are measured against the frame being drawn. A video of another shape will draw them differently (a label 15% wide becomes 20% of a 4:3 map in a 16:9 video). What should happen?"
  - His answer, label: "Video's shape (b) (Recommended)"
  - The option read: "The preview takes the video's shape, with your picture fitted inside and the bands showing, so it draws the frame the video draws. Small change, cheapest before CORE-06."
  - Not chosen: "Measure by picture (c)", "As it stands (a)".
- **D203** — Asked: "D203: a label's half-second fade gets shorter on a route with pauses (312 ms on a 10-second walk with 6 seconds of pauses), because v3's sum was copied. What should the fade be?"
  - His answer, label: "Half a second (b) (Recommended)"
  - The option read: "500 ms of the lead's moving, whatever the pauses. One line and its test figures."
  - Not chosen: "A setting later (c)", "As it stands (a)".
- **D204** — Asked: "D204: the comet trail's length goes up to 4, but every setting from 0.8 up draws the same trail while the lead moves. Above 0.8 it only makes the scene run on longer (40.5 seconds after a 10-second walk at 4, against 8.5 at 0.8). What should happen?"
  - His answer, label: "Stop at 0.8 (b) (Recommended)"
  - The option read: "The setting's top becomes 0.8, taken into the rework of the run-on you already asked for (PLAN-8.2). The trail still completes, with its half second."
  - Not chosen: "Shorter run-on (c)", "As it stands (a)".
- **D205** — Asked: "D205: Home, comma and < all skip to the start; End, full stop and > all skip to the end; no key steps one frame. What should comma and full stop do?"
  - His answer, label: "Step a frame (b) (Recommended)"
  - The option read: "Comma steps one frame back and full stop one frame forward, pausing a playing scene. Home, End, < and > still skip."
  - Not chosen: "Arrows on timeline (c)", "As it stands (a)".

## Round 2

- **D206** — Asked: "D206: with keyboard focus on Help's Close button it takes two presses of Escape to close Help; with the pointer resting on it, one. The label the first press hides covers nothing, so the accessibility rule is met either way. Should one Escape always close Help?"
  - His answer, label: "One Escape always (b) (Recommended)"
  - The option read: "The dialog takes Escape first, so one press closes Help, label and all, wherever focus is."
  - Not chosen: "As it stands (a)".
- **D207** — Asked: "D207: 'Open project' was given no Cmd/Ctrl+O because the entry said a web page cannot take that key. I believe Chrome lets a page take it, but I have not tried it. What should happen?"
  - His answer, label: "Try it, then add (b) (Recommended)"
  - The option read: "One try by hand in Chrome; if the page can take the key, Cmd/Ctrl+O opens a project and Help lists it."
  - Not chosen: "No shortcut (a)".
  - Then the try, and his second answer: the two sections on D207 below.
- **D208** — Asked: "D208: when the pointer rests on a stretch of route, v4 as built turns it into a pale blue band and hides the line's own colour (v3 showed your line with a halo). Hovering first arrives with CORE-06. What should CORE-06 build?"
  - His answer, label: "Line with a halo (b) (Recommended)"
  - The option read: "The glow redraws the stretch's own line on top, so its colour shows again, as in v3. One file and its tests."
  - Not chosen: "As built for now (a)".
- **D209** — Asked: "D209: the 'Version 4 is being built here' paragraph still sits above the preview because accessibility checks lean on its link, and the preview is capped at two fifths of the window's height (at most 288 pixels on a 1280 by 720 screen). What should happen when CORE-06 starts?"
  - His answer, label: "Remove and enlarge (b) (Recommended)"
  - The option read: "The paragraph goes, its checks move to the page's real controls, and the preview takes the height left between the header and the play bar."
  - Not chosen: "Only enlarge (c)", "As it stands (a)".

## Round 3

- **D210** — Asked: "D210: two choices about the automatic checks that I would not have made. A publishing commit GitHub's record cannot vouch for now fails on main (it guards against forgery on a branch you chose to leave unprotected), and the record tools' own code counts as record-only. Both are built and passing. What should happen?"
  - His answer, label: "Leave both (a) (Recommended)"
  - The option read: "Both stay as built. When GitHub's 90-day log limit first stops a publish (wish GATE-02.2), the publishing check is made simpler, not built round."
  - Not chosen: "Soften publish check (b)", "Tools as code (c)".
- **D211** — Asked: "D211: the public address (djdaojones.github.io/route-plotter) has shown v4's 'being built' page since 19 Nov; v3 is on Xerte and at its tag only. Your publishing words cover it. Should it stay that way?"
  - His answer, label: "Leave as it is (a) (Recommended)"
  - The option read: "v4's previews stay at the address until v4.0. Right if nobody but you and Gary relies on the address."
  - Not chosen: "Put v3 back (b)".
  - The option's second sentence is the asking chat's, not his. Choosing the option is read as leaving the address as it is, not as his statement about who uses the address.

## D207's try, 15:08 UTC

- Typed, after the asking chat offered a one-page test: "I just tested, command + O does execute open in chrome. maybe this opens a page and doesn't work for the app"
- Typed, when given a test page to open in Chrome: "I am using the computer via splashtop, and it wont do key commands. can you do a test on it?"
- What the asking chat then did, as it recorded it, at about 15:07 UTC: in his Chrome, through the Claude browser extension, on a tab of its own at example.com (closed afterwards), it gave a page a key handler that claims Cmd+O and had the extension press Cmd+O. The page received a trusted key press that Chrome counted as a user action, and the claim held. With the handler no longer claiming the key, a second press reached the page and, as far as the page could tell, Chrome's own Open File window did not appear. Its own reading: the extension's key presses do not pass through Chrome's own shortcuts, so this cannot show whether Chrome hands a real Cmd+O to the page before using it itself; it does show that a page which gets the key can claim it. It also cited Google's help for Docs, which lists Cmd+O as Open on a Mac: documentation, not a test made here. He was not asked what he saw on screen. Nothing was run in this repository.

## D207 settled, 15:10 UTC

- Asked: "Is this evidence enough to add Cmd/Ctrl+O, or should it wait for a real key press?", with the asking chat's recommendation that it is enough.
- His answer, label: "Enough, add it"
- Not chosen: "Wait for real press".

## Readings (the asking chat's; proposals until he confirms them)

- All ten stand as recommended: (b) on D202 to D209, (a) on D210 and D211. None was answered in his own words, so there is nothing of his to quote on them beyond the labels.
- D202: the preview takes the video's shape (the export settings' width to height). D199's other parts are not reopened; D150 and D126 stand as built, and wish PLAN-8.3's review of D126 still stands.
- D203: a label fades over 500 ms of the lead's moving. It changes merged code (CORE-04's labels).
- D204: wish PLAN-8.2 is read as widened to take D140: the trail setting's top becomes 0.8. His earlier typed words on D141 still govern the run-on; they are quoted whole in CORE-04's Notes (`project/items/CORE-04.md`).
- D205, D206: changes to the editor shell's own code, which is on CORE-05's unmerged branch.
- D207: his first typed line is read as describing Chrome's own Open File, which is what the key does on a page that does not claim it; he did not say whether he used the key or the menu. After "Enough, add it" the try by hand is no longer owed: Cmd or Ctrl+O is added as Open project to the key table and to Help, and the first real key press on the built page remains the check that Chrome gives the key up; if it does not, Chrome's own Open File opens as it does now, and the row comes out of Help.
- D208: CORE-06 builds D158's option (c) with its hover; wish CORE-04.13 is read as settled by this, not retired until it is built.
- D209: at CORE-06's start. Where the sentence "Its progress is on GitHub" goes, if anywhere, was not asked.
- D210: nothing changes. The steer, to make the publishing check simpler when wish GATE-02.2 first bites, is a line to add to that wish.
- D211: nothing changes, as read above.
- The findings were reached by reading the decisions list and the code (branch `core-05/editor-shell` at 4dcfcc5, `main` at 20798b3). Nothing was run, so every figure in the findings comes from reading the code, not from a run.
