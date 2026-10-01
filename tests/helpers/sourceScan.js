/**
 * Reading `src/` as code rather than as lines (TST-13).
 *
 * A scan that splits a file into lines misses a call written across lines,
 * and one that matches raw text counts calls inside comments and strings.
 * `lex` reads just enough of JavaScript's lexical grammar to tell code from a
 * comment, a string, template text or a regular expression, and blanks the
 * comments to spaces, keeping every newline, so a match may span lines and
 * still report the line it starts on. It is a tokeniser, not a parser: it
 * decides whether `/` starts a regular expression from the character before
 * it, which is the usual rule and holds for this code base; `tests/elementIds`
 * pins it on small fixtures.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Characters after which `/` starts a regular expression rather than a division. */
const BEFORE_REGEX = new Set([...'(,=:[!&|?{};+-*%<>~^']);
/** Words after which `/` starts a regular expression. */
const WORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else',
  'yield', 'await'
]);
const WORD = /[\w$]/;

/**
 * Lex a source text.
 *
 * @param {string} source
 * @returns {{ source: string, code: string, kind: string[] }} `code` is the
 *   source with every comment blanked; `kind` has one letter per character:
 *   `c` code, `s` string, `t` template text, `r` regular expression, `/`
 *   comment.
 */
export function lex(source) {
  const kind = new Array(source.length);
  const out = source.split('');
  const mark = (from, to, letter) => {
    for (let at = from; at < to; at += 1) kind[at] = letter;
  };
  const blank = (from, to) => {
    for (let at = from; at < to; at += 1) {
      kind[at] = '/';
      if (out[at] !== '\n') out[at] = ' ';
    }
  };

  // Template literals nest through `${ … }`: each open one remembers the
  // brace depth at which its expression ends.
  const templates = [];
  let depth = 0;
  let before = '';      // the last code character that is not white space
  let lastWord = '';    // the word that character ended, if any
  let at = 0;

  /** Scan template text from `from` until its end (returns past the backtick) or a `${`. */
  const templateText = from => {
    let index = from;
    while (index < source.length) {
      if (source[index] === '\\') { index += 2; continue; }
      if (source[index] === '`') { mark(from, index + 1, 't'); before = 'x'; lastWord = ''; return index + 1; }
      if (source[index] === '$' && source[index + 1] === '{') {
        mark(from, index + 2, 't');
        templates.push(depth);
        before = '{';
        lastWord = '';
        return index + 2;
      }
      index += 1;
    }
    mark(from, index, 't');
    return index;
  };

  while (at < source.length) {
    const char = source[at];
    const next = source[at + 1];

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', at);
      const stop = end === -1 ? source.length : end;
      blank(at, stop);
      at = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', at + 2);
      const stop = end === -1 ? source.length : end + 2;
      blank(at, stop);
      at = stop;
      continue;
    }
    if (char === '\'' || char === '"') {
      let index = at + 1;
      while (index < source.length && source[index] !== char && source[index] !== '\n') {
        index += source[index] === '\\' ? 2 : 1;
      }
      mark(at, index + 1, 's');
      at = index + 1;
      before = 'x';
      lastWord = '';
      continue;
    }
    if (char === '`') {
      kind[at] = 't';
      at = templateText(at + 1);
      continue;
    }
    if (char === '/' && (before === '' || BEFORE_REGEX.has(before) || WORDS_BEFORE_REGEX.has(lastWord))) {
      let index = at + 1;
      let inClass = false;
      while (index < source.length && source[index] !== '\n') {
        const current = source[index];
        if (current === '\\') { index += 2; continue; }
        if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        else if (current === '/' && !inClass) break;
        index += 1;
      }
      index += 1;
      while (index < source.length && /[a-z]/i.test(source[index])) index += 1;
      mark(at, index, 'r');
      at = index;
      before = 'x';
      lastWord = '';
      continue;
    }

    kind[at] = 'c';
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      if (templates.length > 0 && templates.at(-1) === depth) {
        templates.pop();
        kind[at] = 't';
        at = templateText(at + 1);
        continue;
      }
      depth -= 1;
    }
    if (WORD.test(char)) {
      let end = at;
      while (end < source.length && WORD.test(source[end])) end += 1;
      mark(at, end, 'c');
      lastWord = source.slice(at, end);
      before = source[end - 1];
      at = end;
      continue;
    }
    if (!/\s/.test(char)) {
      before = char;
      lastWord = '';
    }
    at += 1;
  }
  return { source, code: out.join(''), kind };
}

/** The 1-based line a character offset is on. */
export function lineAt(text, index) {
  let line = 1;
  for (let at = 0; at < index; at += 1) if (text[at] === '\n') line += 1;
  return line;
}

/** The offset of the code bracket that closes the one at `open`, or -1. */
export function closing(lexed, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const want = pairs[lexed.code[open]];
  let depth = 0;
  for (let at = open; at < lexed.code.length; at += 1) {
    if (lexed.kind[at] !== 'c') continue;
    const char = lexed.code[at];
    if (char === lexed.code[open]) depth += 1;
    else if (char === want) {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return -1;
}

/** Split a call's argument text (from the lexed code, between its brackets) at its top-level commas. */
function argumentsOf(lexed, open, close) {
  const args = [];
  let depth = 0;
  let start = open + 1;
  for (let at = open + 1; at < close; at += 1) {
    if (lexed.kind[at] !== 'c') continue;
    const char = lexed.code[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (char === ',' && depth === 0) {
      args.push(lexed.code.slice(start, at));
      start = at + 1;
    }
  }
  args.push(lexed.code.slice(start, close));
  return args.map(text => text.replace(/\s+/g, ' ').trim()).filter((text, index, all) =>
    text !== '' || index < all.length - 1);
}

/** A string literal's value, or null when the text is anything else (a template with `${` included). */
export function literalValue(text) {
  const match = /^(['"`])((?:(?!\1)[^\\$\n])*)\1$/.exec(text.trim());
  return match ? match[2] : null;
}

/**
 * Every place `name` appears as code in a lexed file: each call, with its
 * arguments, and each mention that is not a call (an alias, say), which a
 * scan of calls would otherwise miss.
 *
 * @returns {{ calls: Array<{index: number, line: number, args: string[], receiver: string}>, others: number[] }}
 */
export function callsOf(lexed, name) {
  const calls = [];
  const others = [];
  const pattern = new RegExp(`(?<![\\w$])${name.replace(/[$]/g, '\\$')}(?![\\w$])`, 'g');
  for (const match of lexed.code.matchAll(pattern)) {
    if (lexed.kind[match.index] !== 'c') continue;
    let open = match.index + name.length;
    while (open < lexed.code.length && /\s/.test(lexed.code[open])) open += 1;
    // An optional call, `name?.(…)`, is still a call.
    if (lexed.code.startsWith('?.', open)) open += 2;
    if (lexed.code[open] !== '(' || lexed.kind[open] !== 'c') {
      others.push(match.index);
      continue;
    }
    const close = closing(lexed, open);
    const receiver = /([A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*)\s*\??\.\s*$/
      .exec(lexed.code.slice(Math.max(0, match.index - 200), match.index))?.[1].replace(/\s+/g, '') ?? '';
    calls.push({
      index: match.index,
      line: lineAt(lexed.source, match.index),
      args: argumentsOf(lexed, open, close),
      receiver: receiver.replace(/\?$/, '')
    });
  }
  return { calls, others };
}

/**
 * The body of the first method or function whose head matches `head` (a
 * regular expression tested against the code), from its `{` to its `}`.
 */
export function bodyOf(lexed, head) {
  const found = new RegExp(head.source, head.flags.includes('g') ? head.flags : `${head.flags}g`);
  for (const match of lexed.code.matchAll(found)) {
    if (lexed.kind[match.index] !== 'c') continue;
    const open = lexed.code.indexOf('{', match.index + match[0].length - 1);
    const close = closing(lexed, open);
    return { start: open, end: close, code: lexed.code.slice(open, close + 1), lexed };
  }
  return null;
}

/** Every `.js` file under a directory, as paths relative to `root`, with its lexed text. */
export function lexedFiles(root, dir) {
  const files = [];
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.js')) files.push(path);
    }
  };
  walk(join(root, dir));
  return files.sort().map(path => ({ file: relative(root, path), lexed: lex(readFileSync(path, 'utf8')) }));
}
