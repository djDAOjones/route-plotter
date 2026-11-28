// CORE-03: every message Save and Open show an author holds to the glossary, using none of the retired words (the
// plan's §10). STACK-04's M6 scans only the interface's .tsx files, so io's words are held here; every refusal the
// other tests make is held to it as well (preflight.test.ts, open.test.ts).
import { describe, expect, it } from 'vitest';
import { RETIRED_WORDS } from './fixtures';
import { SAVE_NOTICE, WORDS } from './words';
import type { Problem } from './words';

const problem: Problem = { path: 'scene.routes[0].points[0].x', rule: 'range', expected: 'a number from 0 to 1', received: '2' };

/** Every message, by its name in WORDS: the type makes a new message fail to compile until it is added here. */
const MESSAGES: Readonly<Record<keyof typeof WORDS, string>> = {
  savedInvalid: WORDS.savedInvalid([problem]),
  savedTooLarge: WORDS.savedTooLarge('it needs 51 MB, and a file holds at most 50 MB'),
  savedUnsafe: WORDS.savedUnsafe('its settings are nested more than 64 deep'),
  openedNotAProject: WORDS.openedNotAProject,
  openedUnsafe: WORDS.openedUnsafe('it is encrypted'),
  openedTooLarge: WORDS.openedTooLarge('image 1 is over 16 MB'),
  openedV3: WORDS.openedV3,
  openedOtherPreview: WORDS.openedOtherPreview('2', 1),
  openedUnknown: WORDS.openedUnknown({ features: ['crowd'], fields: ['scene.extra'], files: ['notes.txt'] }),
  openedInvalid: WORDS.openedInvalid([problem]),
};

describe('the words Save and Open show an author', () => {
  it('use none of the retired words, in any message or the Save notice', () => {
    for (const [name, message] of Object.entries({ ...MESSAGES, SAVE_NOTICE })) expect(message, name).not.toMatch(RETIRED_WORDS);
  });

  it('end by saying that nothing changed', () => {
    for (const [name, message] of Object.entries(MESSAGES)) {
      expect(message, name).toMatch(name.startsWith('saved') ? /Nothing was saved\.$/ : /Nothing was opened\.$/);
    }
  });

  it('say, when they refuse to open, what to choose instead, just before saying nothing was opened (STACK-08, 3.3.3)', () => {
    for (const [name, message] of Object.entries(MESSAGES)) {
      if (name.startsWith('opened')) expect(message, name).toMatch(/ (Choose|Open it in) [^.]+(\.[^ .][^.]*)*\. Nothing was opened\.$/);
    }
  });

  it('list the first five things found, then how many more', () => {
    const files = Array.from({ length: 7 }, (_, index) => `file${index + 1}.txt`);
    expect(WORDS.openedUnknown({ features: [], fields: [], files })).toBe(
      'This file holds what this preview of Route Plotter does not know (files: file1.txt, file2.txt, file3.txt, ' +
        'file4.txt, file5.txt and 2 more). Choose a project saved by this preview. Nothing was opened.',
    );
  });
});
