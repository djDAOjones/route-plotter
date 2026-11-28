// CORE-03: every word Save and Open show an author, in one home, so the item that first offers Save shows SAVE_NOTICE
// and the shell shows a refusal's `message` as it stands (Nielsen: errors say what happened and what next). Plain
// English, for an author; none of the retired words (STACK-04's M6; words.test.ts holds every message to it). Each
// refusal to open says what to choose instead before "Nothing was opened." (STACK-08, WCAG 3.3.3; D280).
import type { Checked } from '../../core/schema/check';

/** Shown wherever the editor offers Save, until v4.0 is declared (PLAN-7, D82). */
export const SAVE_NOTICE =
  'This is a preview of Route Plotter v4. A file saved in this preview may not open in a later preview.';

/** One thing a check found wrong: where, the rule, what was expected and what was found. */
export type Problem = Extract<Checked<unknown>, { ok: false }>['problems'][number];

/** Why a file was not saved or not opened, with the words to show. Nothing changed in either case. */
export type Refusal =
  | { readonly reason: 'not-a-project' | 'unsafe' | 'too-large' | 'v3'; readonly message: string }
  | { readonly reason: 'other-preview'; readonly message: string; readonly version: string }
  | {
      readonly reason: 'unknown';
      readonly message: string;
      /** Features this preview does not know, by id. */
      readonly features: readonly string[];
      /** Fields no declaration holds, by their place in project.json. */
      readonly fields: readonly string[];
      /** Files in the ZIP that the project does not name. */
      readonly files: readonly string[];
    }
  | { readonly reason: 'invalid'; readonly message: string; readonly problems: readonly Problem[] };

const FIRST = 5;

/** The first few, then how many more: a message stays readable however much a file holds. */
const some = (items: readonly string[]) =>
  items.slice(0, FIRST).join(', ') + (items.length > FIRST ? ` and ${items.length - FIRST} more` : '');

const listed = (problems: readonly Problem[]) =>
  problems
    .slice(0, FIRST)
    .map(({ path, expected, received }) => `${path || 'the project'}: expected ${expected}, found ${received}`)
    .join('; ') + (problems.length > FIRST ? `; and ${problems.length - FIRST} more` : '');

export const WORDS = {
  savedInvalid: (problems: readonly Problem[]) =>
    `This project could not be saved, because some of it is outside what Route Plotter allows (${listed(problems)}). ` +
    'Nothing was saved.',
  savedTooLarge: (what: string) => `This project is too large to save: ${what}. Nothing was saved.`,
  savedUnsafe: (why: string) => `This project could not be saved, because ${why}. Nothing was saved.`,
  openedNotAProject:
    'This file is not a Route Plotter project, or it is damaged. Choose a project saved by Route Plotter v4 (a .zip ' +
    'file). Nothing was opened.',
  openedUnsafe: (why: string) =>
    `This file cannot be opened safely, because ${why}. Choose a project saved by Route Plotter v4 and not changed ` +
    'since. Nothing was opened.',
  openedTooLarge: (what: string) =>
    `This file is too large to open: ${what}. Choose a smaller project. Nothing was opened.`,
  openedV3:
    'This project was saved by Route Plotter v3, which Route Plotter v4 does not open. Open it in Route Plotter v3. ' +
    'Nothing was opened.',
  openedOtherPreview: (found: string, opens: number) =>
    `This file was saved by another preview of Route Plotter v4 (save format ${found}); this preview opens save ` +
    `format ${opens} only. Choose a project saved by this preview. Nothing was opened.`,
  openedUnknown: (unknown: { features: readonly string[]; fields: readonly string[]; files: readonly string[] }) => {
    const parts = [
      unknown.features.length > 0 ? `features: ${some(unknown.features)}` : '',
      unknown.fields.length > 0 ? `settings: ${some(unknown.fields)}` : '',
      unknown.files.length > 0 ? `files: ${some(unknown.files)}` : '',
    ].filter((part) => part !== '');
    return (
      `This file holds what this preview of Route Plotter does not know (${parts.join('; ')}). ` +
      'Choose a project saved by this preview. Nothing was opened.'
    );
  },
  openedInvalid: (problems: readonly Problem[]) =>
    `This project could not be opened, because some of it is outside what Route Plotter allows (${listed(problems)}). ` +
    'Choose a project saved by Route Plotter v4 and not changed since. Nothing was opened.',
};
