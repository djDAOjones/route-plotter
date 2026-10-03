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

/**
 * A call's top-level arguments, between its brackets: each one's text, with
 * white space folded, and its span in the code.
 */
function argumentsOf(lexed, open, close) {
  const spans = [];
  let depth = 0;
  let start = open + 1;
  for (let at = open + 1; at < close; at += 1) {
    if (lexed.kind[at] !== 'c') continue;
    const char = lexed.code[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (char === ',' && depth === 0) {
      spans.push([start, at]);
      start = at + 1;
    }
  }
  spans.push([start, close]);
  const args = spans.map(([from, to]) => ({ text: lexed.code.slice(from, to).replace(/\s+/g, ' ').trim(), from, to }));
  // No argument, or a trailing comma, leaves an empty last entry.
  if (args.length > 0 && args.at(-1).text === '') args.pop();
  return args;
}

/** A string literal's value, or null when the text is anything else (a template with `${` included). */
export function literalValue(text) {
  const match = /^(['"`])((?:(?!\1)[^\\$\n])*)\1$/.exec(text.trim());
  return match ? match[2] : null;
}

const skipSpace = (code, at) => {
  let index = at;
  while (index < code.length && /\s/.test(code[index])) index += 1;
  return index;
};

/** The offset of the last code character before `at` that is not white space, or -1. */
function codeBefore(lexed, at) {
  let index = at - 1;
  while (index >= 0 && (lexed.kind[index] !== 'c' || /\s/.test(lexed.code[index]))) index -= 1;
  return index;
}

/** The receiver an access ends with, as `a.b.c`, from the code that ends at `end`. */
function receiverEnding(code, end) {
  const before = code.slice(Math.max(0, end - 200), end).replace(/\s*\??\.?\s*$/, '');
  return /([A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*)$/.exec(before)?.[1].replace(/\s+/g, '')
    .replace(/\?\./g, '.') ?? '';
}

/** Every string literal in the code (quoted, or a template with no `${`), as its value and span. */
function stringsIn(lexed) {
  const found = [];
  const { kind, source } = lexed;
  let at = 0;
  while (at < source.length) {
    if (kind[at] !== 's' && kind[at] !== 't') {
      at += 1;
      continue;
    }
    let end = at;
    while (end < source.length && kind[end] === kind[at]) end += 1;
    const quote = source[at];
    if ('\'"`'.includes(quote) && end - at >= 2 && source[end - 1] === quote) {
      found.push({ value: source.slice(at + 1, end - 1), from: at, to: end });
    }
    at = end;
  }
  return found;
}

/**
 * Every place `name` appears in a lexed file: each call, with its arguments,
 * and each mention that is not a call. A call is `name(…)`, `name?.(…)`, or a
 * computed member, `obj['name'](…)`; a string naming `name` anywhere else,
 * and any other mention (an alias, `.bind`, a feature test), is in `others`,
 * so a scan that checks `others` is empty cannot be dodged by spelling.
 *
 * @returns {{ calls: Array<{index: number, line: number, args: string[], spans: number[][],
 *   receiver: string}>, others: number[] }}
 */
export function callsOf(lexed, name) {
  const calls = [];
  const others = [];
  const callAt = (index, open, receiver) => {
    const close = closing(lexed, open);
    const args = argumentsOf(lexed, open, close);
    calls.push({
      index,
      line: lineAt(lexed.source, index),
      args: args.map(({ text }) => text),
      spans: args.map(({ from, to }) => [from, to]),
      receiver
    });
  };
  /** The `(` a call opens after `at`, past white space and an optional `?.`, or -1. */
  const openAfter = at => {
    let open = skipSpace(lexed.code, at);
    if (lexed.code.startsWith('?.', open)) open = skipSpace(lexed.code, open + 2);
    return lexed.code[open] === '(' && lexed.kind[open] === 'c' ? open : -1;
  };

  const pattern = new RegExp(`(?<![\\w$])${name.replace(/[$]/g, '\\$')}(?![\\w$])`, 'g');
  for (const match of lexed.code.matchAll(pattern)) {
    if (lexed.kind[match.index] !== 'c') continue;
    const open = openAfter(match.index + name.length);
    if (open === -1) others.push(match.index);
    else callAt(match.index, open, receiverEnding(lexed.code, match.index));
  }
  for (const { value, from, to } of stringsIn(lexed)) {
    if (value !== name) continue;
    const bracket = codeBefore(lexed, from);
    const after = skipSpace(lexed.code, to);
    const open = lexed.code[bracket] === '[' && lexed.code[after] === ']' ? openAfter(after + 1) : -1;
    if (open === -1) others.push(from);
    else callAt(from, open, receiverEnding(lexed.code, bracket));
  }
  calls.sort((a, b) => a.index - b.index);
  others.sort((a, b) => a - b);
  return { calls, others };
}

// ---------------------------------------------------------------------------
// What a key handler reads of its event
// ---------------------------------------------------------------------------

const WORD_AT = /^[A-Za-z_$][\w$]*/;
const EQUALITY = /^(?:===|!==|==|!=)/;
const NOT_CALLS = new Set(['if', 'for', 'while', 'switch', 'return', 'typeof', 'catch', 'with', 'await', 'void']);

/**
 * A quoted string's value, or a template's with no `${`; null for anything
 * else. Escapes are not decoded, so a literal with one is not read either.
 */
const QUOTED = /^(['"])((?:(?!\1)[^\\\n])*)\1$|^`((?:[^`\\$]|\$(?!\{))*)`$/;
function quotedValue(text) {
  const match = QUOTED.exec(text.trim());
  if (!match) return null;
  return match[1] ? match[2] : match[3];
}

/**
 * The string or template that starts at `first`, or ends at `last`: its span,
 * its text, and its value where it is a plain literal (null for a template
 * with `${`, or a literal with an escape). Null when none is there.
 */
function literalFrom(lexed, first) {
  const { kind, source } = lexed;
  if ((kind[first] !== 's' && kind[first] !== 't') || !'\'"`'.includes(source[first])) return null;
  let end = first + 1;
  while (end < source.length && kind[end] === kind[first]) end += 1;
  const text = source.slice(first, end);
  return { start: first, end, text, value: quotedValue(text) };
}
function literalTo(lexed, last) {
  const { kind, source } = lexed;
  if (last < 0 || (kind[last] !== 's' && kind[last] !== 't')) return null;
  let start = last;
  while (start > 0 && kind[start - 1] === kind[last]) start -= 1;
  const text = source.slice(start, last + 1);
  return { start, end: last + 1, text, value: '\'"`'.includes(source[start]) ? quotedValue(text) : null };
}

/** The offset of the last character before `at` that is neither white space nor a comment, or -1. */
function tokenBefore(lexed, at) {
  let index = at - 1;
  while (index >= 0 && (lexed.kind[index] === '/' || (lexed.kind[index] === 'c' && /\s/.test(lexed.code[index])))) {
    index -= 1;
  }
  return index;
}

/**
 * Whether the code after an operand that ends at `end` carries on its
 * expression: a member, a call, or an operator that binds more tightly than
 * `===` (`'F' + n`, `'q'.toUpperCase()`), so the operand is not what is compared.
 */
function carriesOn(lexed, end) {
  const at = skipSpace(lexed.code, end);
  if (at >= lexed.code.length) return false;
  if (lexed.kind[at] !== 'c') return true;
  const char = lexed.code[at];
  if (char === '?') return lexed.code[at + 1] === '.' && !/\d/.test(lexed.code[at + 2] ?? '');
  return '.[(`+-*/%<>'.includes(char) || /^(?:in|instanceof)(?![\w$])/.test(lexed.code.slice(at, at + 11));
}

/**
 * Whether the code before an operand that starts at `start` binds to it more
 * tightly than `===` does (`x + 'a' === e.key`, `typeof e.key === 'string'`,
 * `!e.key === 'a'`), so the operand is not what is compared.
 */
function boundBefore(lexed, start) {
  const at = tokenBefore(lexed, start);
  if (at < 0 || lexed.kind[at] !== 'c') return false;
  const before = lexed.code.slice(Math.max(0, at - 10), at + 1);
  if (/(?:^|[^\w$])(?:typeof|void|delete|in|instanceof)$/.test(before)) return true;
  if (/=>$/.test(before)) return false;
  if (/(?:[=!]=|[<>]=?)$/.test(before)) return true;
  if (/=$/.test(before)) return false;
  return /[-+*/%!~]$/.test(before);
}

/** The parameter at `index` of a parameter list, or null for a pattern or a default the scan cannot follow. */
function parameterAt(params, index) {
  const name = (params.split(',')[index] ?? '').trim();
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : null;
}

/** The end of an arrow's expression body: the first `,` `;` `)` `]` or `}` outside brackets. */
function expressionEnd(lexed, start) {
  let depth = 0;
  for (let at = start; at < lexed.code.length; at += 1) {
    if (lexed.kind[at] !== 'c') continue;
    const char = lexed.code[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) {
      if (depth === 0) return at;
      depth -= 1;
    } else if ((char === ',' || char === ';') && depth === 0) return at;
  }
  return lexed.code.length;
}

/**
 * The function whose text starts at `at`: an arrow or a function
 * expression. Returns its parameter list and body span, or null.
 */
export function functionAt(lexed, at) {
  const { code } = lexed;
  let index = skipSpace(code, at);
  if (/^async\s/.test(code.slice(index, index + 6))) index = skipSpace(code, index + 5);
  let params;
  let bodyStart;
  if (/^function\b/.test(code.slice(index, index + 9))) {
    const open = code.indexOf('(', index);
    const close = closing(lexed, open);
    params = code.slice(open + 1, close);
    bodyStart = skipSpace(code, close + 1);
    if (code[bodyStart] !== '{') return null;
  } else {
    if (code[index] === '(') {
      const close = closing(lexed, index);
      params = code.slice(index + 1, close);
      index = close + 1;
    } else {
      const word = WORD_AT.exec(code.slice(index));
      if (!word) return null;
      params = word[0];
      index += word[0].length;
    }
    index = skipSpace(code, index);
    if (!code.startsWith('=>', index)) return null;
    bodyStart = skipSpace(code, index + 2);
  }
  const end = code[bodyStart] === '{' ? closing(lexed, bodyStart) + 1 : expressionEnd(lexed, bodyStart);
  return { params, start: bodyStart, end };
}

/** A method's parameter list and body, from the offset of its name. */
function methodAt(lexed, at) {
  const open = lexed.code.indexOf('(', at);
  const close = closing(lexed, open);
  const body = skipSpace(lexed.code, close + 1);
  if (lexed.code[body] !== '{') return null;
  return { params: lexed.code.slice(open + 1, close), start: body, end: closing(lexed, body) + 1 };
}

/**
 * The functions a callee or a handler names in its file: `name` (a function
 * declaration, or a `const`/`let`/`var` holding a function) or `this.name` (a
 * function assigned to it, a method bound to it, or the method itself).
 * Returns the functions, or the reason they cannot be found.
 */
export function functionsNamed(lexed, reference) {
  const { code } = lexed;
  const member = /^this\.([A-Za-z_$][\w$]*)$/.exec(reference);
  const bare = /^[A-Za-z_$][\w$]*$/.test(reference) ? reference : null;
  const name = member?.[1] ?? bare;
  if (!name) return { functions: [], unfound: `${reference} is not a name the scan can look up` };
  const escaped = name.replace(/[$]/g, '\\$');
  const found = [];
  const unfound = [];
  const each = (pattern, take) => {
    for (const match of code.matchAll(pattern)) {
      if (lexed.kind[match.index] === 'c') take(match);
    }
  };
  const methods = () => {
    each(new RegExp(`^[ \\t]*(?:async[ \\t]+)?${escaped}[ \\t]*\\(`, 'gm'), match => {
      const method = methodAt(lexed, match.index + match[0].lastIndexOf(name));
      if (method) found.push(method);
    });
  };
  if (member) {
    let assigned = 0;
    each(new RegExp(`this\\.${escaped}\\s*=(?!=)`, 'g'), match => {
      assigned += 1;
      const at = match.index + match[0].length;
      const value = code.slice(at, expressionEnd(lexed, skipSpace(code, at))).replace(/\s+/g, ' ').trim();
      if (value === 'null') return;
      if (value === `this.${name}.bind(this)`) return;
      const fn = functionAt(lexed, at);
      if (fn) found.push(fn);
      else unfound.push(`this.${name} is assigned ${value}`);
    });
    if (found.length === 0) methods();
  } else {
    each(new RegExp(`\\bfunction\\s+${escaped}\\s*\\(`, 'g'), match => {
      const fn = functionAt(lexed, match.index);
      if (fn) found.push(fn);
    });
    each(new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=(?!=)`, 'g'), match => {
      const fn = functionAt(lexed, match.index + match[0].length);
      if (fn) found.push(fn);
      else unfound.push(`${name} holds something other than a function`);
    });
  }
  if (found.length === 0 && unfound.length === 0) unfound.push(`no function ${reference} in this file`);
  return { functions: found, unfound: unfound.join('; ') || null };
}

/** Every use of the word `word` as code between two offsets, not as a property name. */
function wordsIn(lexed, word, from, to) {
  const pattern = new RegExp(`(?<![\\w$.])${word.replace(/[$]/g, '\\$')}(?![\\w$])`, 'g');
  const found = [];
  for (const match of lexed.code.slice(from, to).matchAll(pattern)) {
    const at = from + match.index;
    if (lexed.kind[at] === 'c') found.push(at);
  }
  return found;
}

/** The `:` that ends a `case` expression begun at `from`: the first outside brackets that no `?` of its own opened. */
function caseEnd(lexed, from, end) {
  let depth = 0;
  let ternaries = 0;
  for (let at = from; at < end; at += 1) {
    if (lexed.kind[at] !== 'c') continue;
    const char = lexed.code[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (depth === 0 && char === '?' && !'.?'.includes(lexed.code[at + 1]) && lexed.code[at - 1] !== '?') {
      ternaries += 1;
    } else if (depth === 0 && char === ':') {
      if (ternaries === 0) return at;
      ternaries -= 1;
    }
  }
  return end;
}

/**
 * The `case` clauses of the `switch` block whose `(` closes at `close`, its
 * own and not those of a `switch` nested in one: the literal each compares,
 * and the text of each case that is not a literal, which the scan cannot read.
 */
function switchCases(lexed, close) {
  const { code, kind } = lexed;
  const open = skipSpace(code, close + 1);
  if (code[open] !== '{' || kind[open] !== 'c') return null;
  const end = closing(lexed, open);
  const literals = [];
  const unread = [];
  let depth = 0;
  for (let at = open + 1; at < end; at += 1) {
    if (kind[at] !== 'c') continue;
    const char = code[at];
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (depth === 0 && code.startsWith('case', at) && !WORD.test(code[at + 4] ?? '') &&
      !/[\w$.]/.test(code[at - 1] ?? '')) {
      const colon = caseEnd(lexed, at + 4, end);
      const first = skipSpace(code, at + 4);
      const literal = literalFrom(lexed, first);
      const text = code.slice(at + 4, colon).replace(/\s+/g, ' ').trim();
      if (literal && literal.value !== null && skipSpace(code, literal.end) === colon) literals.push(literal.value);
      else unread.push(`case ${text}`);
      at = colon;
    }
  }
  return { literals, unread };
}

/**
 * The members of the array literal whose `]` is at `close`, when every one is
 * a literal; the text of each that is not, otherwise. Null when the `[` is a
 * member access (`keys[0]`), not an array.
 */
function arrayMembers(lexed, close) {
  if (lexed.kind[close] !== 'c' || lexed.code[close] !== ']') return null;
  // The `[` that opens it: back over code brackets.
  let depth = 0;
  let open = -1;
  for (let at = close; at >= 0; at -= 1) {
    if (lexed.kind[at] !== 'c') continue;
    if (')]}'.includes(lexed.code[at])) depth += 1;
    else if ('([{'.includes(lexed.code[at])) {
      depth -= 1;
      if (depth === 0) {
        open = lexed.code[at] === '[' ? at : -1;
        break;
      }
    }
  }
  if (open === -1) return null;
  const before = tokenBefore(lexed, open);
  if (before >= 0 && (lexed.kind[before] !== 'c' || /[\w$)\]]/.test(lexed.code[before])) &&
    !/(?:^|[^\w$])(?:return|typeof|case|in|of|void|await|yield)$/
      .test(lexed.code.slice(Math.max(0, before - 6), before + 1))) {
    return null;
  }
  const literals = [];
  const unread = [];
  for (const { text, from, to } of argumentsOf(lexed, open, close)) {
    const literal = literalFrom(lexed, skipSpace(lexed.code, from));
    if (literal && literal.value !== null && skipSpace(lexed.code, literal.end) >= to) literals.push(literal.value);
    else unread.push(`[…] member ${text || '(a hole)'}`);
  }
  return { literals, unread };
}

/**
 * How the key is compared at a use that starts at `at` and ends at `after`:
 * `=== 'x'`, `'x' ===`, as the subject of a `switch`, or inside
 * `[…].includes(…)`. Returns the literals it is compared with and the parts of
 * the comparison the scan cannot read (a case or a member that is not a
 * literal; a literal, or the key, that is part of a larger expression), or
 * null when the use is none of these.
 */
function comparedWith(lexed, fn, at, after) {
  const { code } = lexed;
  const next = skipSpace(code, after);
  const operator = lexed.kind[next] === 'c' ? EQUALITY.exec(code.slice(next, next + 3))?.[0] : null;
  if (operator) {
    const literal = literalFrom(lexed, skipSpace(code, next + operator.length));
    if (literal) {
      const whole = literal.value !== null && !boundBefore(lexed, at) && !carriesOn(lexed, literal.end);
      return whole ? { literals: [literal.value], unread: [] }
        : { literals: [], unread: [`${code.slice(at, literal.end).replace(/\s+/g, ' ')}, not a whole literal`] };
    }
  }
  const leftOperator = tokenBefore(lexed, at);
  const operatorText = lexed.kind[leftOperator] === 'c'
    ? /(?:===|!==|==|!=)$/.exec(code.slice(Math.max(0, leftOperator - 2), leftOperator + 1))?.[0] : null;
  if (operatorText) {
    const literal = literalTo(lexed, tokenBefore(lexed, leftOperator - operatorText.length + 1));
    if (literal) {
      const whole = literal.value !== null && !boundBefore(lexed, literal.start) && !carriesOn(lexed, after);
      return whole ? { literals: [literal.value], unread: [] }
        : { literals: [], unread: [`${code.slice(literal.start, after).replace(/\s+/g, ' ')}, not a whole literal`] };
    }
  }
  const subject = code[next] === ')' && lexed.kind[next] === 'c';
  if (subject && /switch\s*\(\s*$/.test(code.slice(Math.max(fn.start, at - 40), at))) {
    return switchCases(lexed, next);
  }
  const includes = /\]\s*\.\s*includes\(\s*$/.exec(code.slice(Math.max(fn.start, at - 300), at));
  if (subject && includes) return arrayMembers(lexed, Math.max(fn.start, at - 300) + includes.index);
  return null;
}

/**
 * What a key handler reads of its event, from its source: the keys it
 * compares `event.key` with (as written, or `anyCase` where it lower-cases
 * first), the other properties it reads (`reads`), and every use of the
 * event it cannot account for (`unanalysed`). It follows the event into the
 * functions of the same file it is passed to, at whichever argument it is
 * passed as, and into a variable that holds the key. A comparison counts only
 * where every `case` of a `switch`, and every member of an `[…].includes`, is
 * a literal, and neither the literal nor the key is part of a larger
 * expression; the rest, the global `event` and `arguments` included, it
 * reports rather than ignores, so a check that `unanalysed` is empty fails
 * closed.
 *
 * @param {Object} lexed - The handler's file, lexed
 * @param {{params: string, start: number, end: number}} fn - The handler
 * @param {number} [index=0] - Which parameter is the event
 */
export function eventReads(lexed, fn, index = 0, seen = new Set()) {
  const result = { keys: new Set(), anyCase: new Set(), reads: new Set(), unanalysed: [] };
  const where = at => `line ${lineAt(lexed.source, at)}`;
  const merge = other => {
    for (const name of ['keys', 'anyCase', 'reads']) for (const value of other[name]) result[name].add(value);
    result.unanalysed.push(...other.unanalysed);
  };
  // A function is read once for each parameter the event arrives as: passed
  // first in one call and second in another, it is read for both.
  const visit = `${fn.start}:${index}`;
  if (seen.has(visit)) return result;
  seen.add(visit);
  const event = parameterAt(fn.params, index);
  if (!event) {
    result.unanalysed.push(`${where(fn.start)}: its event parameter is a pattern, has a default or is missing`);
    return result;
  }
  const { code, source } = lexed;
  const add = (literals, anyCase) => {
    for (const literal of literals) result[anyCase ? 'anyCase' : 'keys'].add(anyCase ? literal.toLowerCase() : literal);
  };
  /** A comparison's literals, and what of it the scan could not read. */
  const compared = (found, anyCase, at) => {
    add(found.literals, anyCase);
    for (const part of found.unread) result.unanalysed.push(`${where(at)}: the key is compared with ${part}`);
  };

  // The event under another name: the global `event`, bare or as a property
  // of the window through any of its names (`window.event`, `top['event']`),
  // so any property named `event`; and a function's `arguments`.
  const globals = event === 'event' ? [] : wordsIn(lexed, 'event', fn.start, fn.end);
  const eventProperty = /\??\.\s*event(?![\w$])|\[\s*(['"`])event\1\s*\]/g;
  for (const match of code.slice(fn.start, fn.end).matchAll(eventProperty)) {
    globals.push(fn.start + match.index);
  }
  for (const at of globals.sort((a, b) => a - b)) {
    if (lexed.kind[at] !== 'c') continue;
    result.unanalysed.push(`${where(at)}: the global event, or a property named event, is read`);
  }
  for (const at of wordsIn(lexed, 'arguments', fn.start, fn.end)) {
    result.unanalysed.push(`${where(at)}: arguments is read`);
  }

  /** A variable holding the key: every use must be a comparison too. */
  const keyHeldIn = (name, declaredAt, anyCase) => {
    for (const at of wordsIn(lexed, name, declaredAt, fn.end)) {
      if (/(?:const|let|var)\s+$/.test(code.slice(Math.max(fn.start, at - 10), at))) continue;
      const found = comparedWith(lexed, fn, at, at + name.length);
      if (found) compared(found, anyCase, at);
      else result.unanalysed.push(`${where(at)}: ${name}, which holds the key, is used other than in a comparison`);
    }
  };

  for (const at of wordsIn(lexed, event, fn.start, fn.end)) {
    let next = skipSpace(code, at + event.length);
    let property = null;
    let after = next;
    if (code.startsWith('?.', next) || (code[next] === '.' && code[next + 1] !== '.')) {
      next = skipSpace(code, next + (code[next] === '?' ? 2 : 1));
      if (code[next] === '[') {
        const close = closing(lexed, next);
        property = literalValue(source.slice(next + 1, close));
        after = close + 1;
      } else {
        property = WORD_AT.exec(code.slice(next))?.[0] ?? null;
        after = next + (property?.length ?? 0);
      }
    } else if (code[next] === '[') {
      const close = closing(lexed, next);
      property = literalValue(source.slice(next + 1, close));
      after = close + 1;
    }

    if (property === 'key') {
      let end = after;
      let anyCase = false;
      if (/^\s*\.\s*toLowerCase\(\s*\)/.test(code.slice(end))) {
        anyCase = true;
        end = code.indexOf(')', end) + 1;
      }
      const found = comparedWith(lexed, fn, at, end);
      if (found) {
        compared(found, anyCase, at);
        continue;
      }
      const held = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*$/.exec(code.slice(Math.max(fn.start, at - 60), at));
      if (held && code[skipSpace(code, end)] === ';') {
        keyHeldIn(held[1], at, anyCase);
        continue;
      }
      result.unanalysed.push(`${where(at)}: ${event}.key is used other than in a comparison`);
      continue;
    }
    if (property !== null) {
      result.reads.add(property);
      continue;
    }

    // Passed whole to a function of this file: follow it there.
    let depth = 0;
    let argument = 0;
    let open = -1;
    for (let back = at - 1; back >= fn.start; back -= 1) {
      if (lexed.kind[back] !== 'c') continue;
      const char = code[back];
      if (')]}'.includes(char)) depth += 1;
      else if ('([{'.includes(char)) {
        if (depth === 0) {
          open = char === '(' ? back : -1;
          break;
        }
        depth -= 1;
      } else if (char === ',' && depth === 0) argument += 1;
    }
    const closer = code[skipSpace(code, at + event.length)];
    // Only `name(…)` and `this.name(…)` are followed; a method of anything else is not.
    const chain = open === -1 ? null
      : /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*$/.exec(code.slice(Math.max(0, open - 100), open))?.[1]
        .replace(/\s+/g, '');
    const callee = chain && /^(?:this\.)?[A-Za-z_$][\w$]*$/.test(chain) ? chain : null;
    if (!callee || NOT_CALLS.has(callee) || !(closer === ',' || closer === ')')) {
      result.unanalysed.push(`${where(at)}: ${event} is used other than by reading a property of it`);
      continue;
    }
    const { functions, unfound } = functionsNamed(lexed, callee);
    if (unfound || functions.length === 0) {
      result.unanalysed.push(
        `${where(at)}: ${event} is passed to ${callee}, which the scan cannot follow (${unfound})`);
      continue;
    }
    for (const delegate of functions) merge(eventReads(lexed, delegate, argument, seen));
  }
  return result;
}

const KEY_EVENT_TYPES = ['keydown', 'keyup', 'keypress'];
const LISTENER_FLAGS = ['capture', 'once', 'passive'];

/**
 * The flags a listener's options set, from their text: none, `true` for
 * capture, or an object of literal `capture`, `once` and `passive` flags.
 * Null for any other options, which the scan cannot read.
 */
function listenerFlags(options) {
  if (options === undefined || options === 'false') return [];
  if (options === 'true') return ['capture'];
  const object = /^\{(.*)\}$/.exec(options);
  if (!object) return null;
  const set = {};
  for (const entry of object[1].split(',').map(each => each.trim()).filter(Boolean)) {
    const flag = /^(capture|once|passive)\s*:\s*(true|false)$/.exec(entry);
    if (!flag) return null;
    set[flag[1]] = flag[2] === 'true'; // as at run time, a later entry wins
  }
  return LISTENER_FLAGS.filter(flag => set[flag]);
}

/**
 * Every key listener registered in some lexed files, read as code: each
 * named by file, what it is added to, its type, its flags (`(capture)` when it
 * listens on the way down; `once`, `passive`), and its number when a file adds
 * more than one of a kind; with what its handler reads of the event
 * (`eventReads`). Also `unread`: every mention of `addEventListener` that is
 * not a call, every call whose type or options are not literals, and every
 * key event type named outside an `add` or `removeEventListener` call — each
 * a way to listen the scan cannot read, so a check that `unread` is empty
 * fails closed.
 */
export function keyListenersIn(files) {
  const found = [];
  const unread = [];
  for (const { file, lexed } of files) {
    const typeStrings = new Set();
    for (const method of ['addEventListener', 'removeEventListener']) {
      const { calls, others } = callsOf(lexed, method);
      for (const at of others) {
        unread.push(`${file}: ${receiverEnding(lexed.code, at)}.${method}, not called`);
      }
      for (const call of calls) {
        const type = literalValue(call.args[0] ?? '');
        if (call.spans[0]) typeStrings.add(skipSpace(lexed.code, call.spans[0][0]));
        if (type === null) {
          unread.push(`${file}:${call.line} ${method}(${call.args[0]}, …)`);
          continue;
        }
        if (method !== 'addEventListener' || !KEY_EVENT_TYPES.includes(type)) continue;
        const flags = call.args.length > 3 ? null : listenerFlags(call.args[2]);
        if (flags === null) {
          unread.push(`${file}:${call.line} ${method}(${call.args[0]}, …, ${call.args.slice(2).join(', ')})`);
          continue;
        }
        const [from, to] = call.spans[1] ?? [0, 0];
        const inline = call.spans[1] ? functionAt(lexed, from) : null;
        let reads;
        if (inline && inline.end <= to) {
          reads = eventReads(lexed, inline);
        } else {
          const { functions, unfound } = functionsNamed(lexed, call.args[1] ?? '');
          reads = { keys: new Set(), anyCase: new Set(), reads: new Set(), unanalysed: [] };
          if (unfound) reads.unanalysed.push(`its handler, ${call.args[1]}: ${unfound}`);
          for (const fn of functions) {
            const each = eventReads(lexed, fn);
            for (const name of ['keys', 'anyCase', 'reads']) for (const value of each[name]) reads[name].add(value);
            reads.unanalysed.push(...each.unanalysed);
          }
        }
        found.push({ name: `${file}: ${call.receiver} ${type}${flags.length > 0 ? ` (${flags.join(', ')})` : ''}`, file,
          line: call.line, handler: call.args[1], reads });
      }
    }
    for (const { value, from } of stringsIn(lexed)) {
      if (KEY_EVENT_TYPES.includes(value) && !typeStrings.has(from)) {
        unread.push(`${file}:${lineAt(lexed.source, from)} names '${value}' outside a listener call`);
      }
    }
  }
  const count = {};
  for (const { name } of found) count[name] = (count[name] ?? 0) + 1;
  const seen = {};
  const listeners = found.map(listener => {
    seen[listener.name] = (seen[listener.name] ?? 0) + 1;
    return count[listener.name] > 1 ? { ...listener, name: `${listener.name} #${seen[listener.name]}` } : listener;
  });
  return { listeners, unread };
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
