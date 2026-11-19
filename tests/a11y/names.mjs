// V31-A11Y-VERDICTS: the label in name algorithm (ACT's glossary, which rule 2ee8b8 uses for 2.5.3), as plain strings
// in and an answer out, so its cases have known answers a test can hold. helpers.ts gathers each control's visible
// inner text in the page, leaving out its non-text content, and its accessible name from the ARIA snapshot.
//  - Tokens: round brackets go with all they hold, nested or not, and an unmatched one is only a character; case is
//    folded and the string decomposed (NFKD), its combining marks dropped, as the pack did before, so an accent is not
//    a word break; every other character that is not a letter or a digit becomes a space; words split on whitespace.
//  - Contained: the label's tokens are a contiguous run of the name's; an empty label is in any name.
//  - Non-text content, a judgement the page makes from these: a lone letter that the control's aria-label or
//    aria-labelledby renames, such as an "X" meaning close, and a word drawn by an icon font, whose first family is
//    named for icons or symbols, such as Material Icons or Font Awesome.
export function tokens(s) {
  let t = String(s ?? ''), prev;
  do { prev = t; t = t.replace(/\([^()]*\)/g, ' '); } while (t !== prev);
  t = t.replace(/[()]/g, ' ').toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return t ? t.split(/\s+/) : [];
}
export function contained(label, name) {
  const l = tokens(label), n = tokens(name);
  for (let i = 0; i + l.length <= n.length; i++) if (l.every((w, k) => n[i + k] === w)) return true;
  return false;
}
export const symbolic = (text) => /^\p{L}$/u.test(String(text ?? '').trim());
export const iconFont = (family) => /\b(icons?|symbols?|glyphicons?|awesome|icomoon|fontello)\b/i.test(String(family ?? '').split(',')[0].replace(/["']/g, ''));
// The label from the page's walk of the visible inner text: each part a visible text node ({ t, font }) or the space or
// line break the walk puts for an element ({ sep }); a word an icon font draws gives a space, whitespace is normalised,
// and a label that is then one letter alone is non-text where the control is named by aria-label or aria-labelledby
// (`named`), never a letter among other text.
export function labelFrom(parts, named) {
  const label = parts.map((p) => p.sep ?? (iconFont(p.font) ? ' ' : p.t)).join('').replace(/\s+/g, ' ').trim();
  return named && symbolic(label) ? '' : label;
}
