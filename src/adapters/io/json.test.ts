// CORE-03: project.json to plain data: strict UTF-8, then v3's tree guard (v3/src/app/persistence.js:80, :132–172).
// v3 has no test aimed at the forbidden keys; each has one here, at the top and nested.
import { describe, expect, it } from 'vitest';
import { parseProjectJson } from './json';
import { TREE_LIMITS } from './limits';

const bytesOf = (text: string) => new TextEncoder().encode(text);

const refusalOf = (bytes: Uint8Array) => {
  const parsed = parseProjectJson(bytes);
  if (parsed.ok) throw new Error('the bytes were not refused');
  return parsed.refusal;
};

describe('project.json to plain data', () => {
  it('parses UTF-8 JSON, an emoji included', () => {
    expect(parseProjectJson(bytesOf('{"label":"🙂","n":[1,2]}'))).toEqual({ ok: true, value: { label: '🙂', n: [1, 2] } });
  });

  it('refuses a broken UTF-8 sequence rather than replacing it (DEF-101)', () => {
    const emoji = bytesOf('{"label":"🙂"}');
    const cut = Uint8Array.from([...emoji.slice(0, 11), ...emoji.slice(13)]);
    expect(refusalOf(cut)).toMatchObject({ reason: 'unsafe' });
    expect(refusalOf(cut).message).toMatch(/not readable text/);
  });

  it('refuses text that is not JSON as not a project', () => {
    expect(refusalOf(bytesOf('<svg/>')).reason).toBe('not-a-project');
  });

  for (const key of ['__proto__', 'prototype', 'constructor']) {
    it(`refuses the key ${key} at the top and nested`, () => {
      for (const text of [`{"${key}":{}}`, `{"scene":{"routes":[{"${key}":1}]}}`]) {
        const refusal = refusalOf(bytesOf(text));
        expect(refusal.reason, text).toBe('unsafe');
        expect(refusal.message, text).toContain(`"${key}"`);
      }
    });
  }

  it('refuses nesting deeper than 64, and accepts 64', () => {
    const nested = (depth: number) => '['.repeat(depth) + ']'.repeat(depth);
    expect(parseProjectJson(bytesOf(nested(TREE_LIMITS.depth))).ok).toBe(true);
    expect(refusalOf(bytesOf(nested(TREE_LIMITS.depth + 2))).message).toMatch(/nested more than 64 deep/);
  });

  it('refuses more than 100,000 values', () => {
    const many = `[${new Array(TREE_LIMITS.values).fill(0).join(',')}]`;
    expect(refusalOf(bytesOf(many))).toMatchObject({ reason: 'too-large' });
  });

  it('refuses one text over 100,000 characters, and texts over 2 MB in all', () => {
    expect(refusalOf(bytesOf(`["${'x'.repeat(TREE_LIMITS.textLength + 1)}"]`)).message).toMatch(/longer than 100,000/);
    const texts = new Array(22).fill(`"${'x'.repeat(TREE_LIMITS.textLength)}"`).join(',');
    expect(refusalOf(bytesOf(`[${texts}]`)).message).toMatch(/more than 2 MB/);
  });

  it('refuses a number JSON.parse makes infinite', () => {
    expect(refusalOf(bytesOf('{"x":1e400}')).message).toMatch(/number too large/);
  });

  it('runs on a stack: a tree 100,000 values long and 64 deep does not overflow', () => {
    const deep = `${'{"a":'.repeat(TREE_LIMITS.depth)}1${'}'.repeat(TREE_LIMITS.depth)}`;
    expect(parseProjectJson(bytesOf(deep)).ok).toBe(true);
  });
});
