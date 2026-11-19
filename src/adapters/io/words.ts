// CORE-03: every word Save and Open show an author, in one home, so the item that first offers Save shows SAVE_NOTICE
// and the shell shows a refusal's `message` as it stands (Nielsen: errors say what happened and what next). Plain
// English, for an author; none of the retired words (STACK-04's M6).
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
      readonly features: readonly string[];
      readonly fields: readonly string[];
    }
  | { readonly reason: 'invalid'; readonly message: string; readonly problems: readonly Problem[] };

const listed = (problems: readonly Problem[]) =>
  problems
    .slice(0, 5)
    .map(({ path, expected, received }) => `${path || 'the project'}: expected ${expected}, found ${received}`)
    .join('; ') + (problems.length > 5 ? `; and ${problems.length - 5} more` : '');

export const WORDS = {
  savedInvalid: (problems: readonly Problem[]) =>
    `This project could not be saved, because some of it is outside what Route Plotter allows (${listed(problems)}). ` +
    'Nothing was saved.',
  savedTooLarge: (what: string) => `This project is too large to save: ${what}. Nothing was saved.`,
};
