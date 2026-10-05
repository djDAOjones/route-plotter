#!/usr/bin/env node
// Explicit maintenance, never an automatic side effect of checking.
// Copy before removing; interruption leaves duplicates, never lost entries.
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { options, decisionEntries, archiveRow, inspect } from './ledger.mjs';
try {
  const { root } = options();
  const dir = join(root, 'project', 'archive'), livePath = join(root, 'project', 'decisions.md');
  const live = readFileSync(livePath, 'utf8');
  if (!live.endsWith('\n')) throw Error('decisions.md needs a terminal newline before archival');
  if (live.includes('\r')) throw Error('archive requires LF decision files; convert explicitly before moving');
  const parts = live.split(/^(?=## )/m), preamble = parts.shift();
  const errors = [];
  const parsed = decisionEntries(live, 'decisions.md', (m) => errors.push(m));
  if (parsed.length !== parts.length || errors.length) throw Error(errors.join('\n') || 'unrecognised decision boundary');
  mkdirSync(dir, { recursive: true });
  const chunks = new Map();
  for (const file of readdirSync(dir).filter((n) => /^decisions-.*\.md$/.test(n))) chunks.set(file, readFileSync(join(dir, file), 'utf8'));
  const original = new Map(chunks);
  for (const [file, text] of chunks) if (!text.endsWith('\n')) throw Error(`${file}: needs a terminal newline before appending`);
  const preflight = inspect(root).fails.filter((m) => !m.startsWith('project/archive/INDEX.md:') && !m.startsWith('graph: duplicate decision heading '));
  if (preflight.length) throw Error(`repair ledger before archiving:\n${preflight.join('\n')}`);
  for (let i = 45; i < parts.length; i++) {
    const file = `decisions-${parsed[i].date.slice(0, 7)}.md`;
    let text = chunks.get(file) || '# Decisions archive\n\n';
    const existing = text.split(/^(?=## )/m).find((s) => s.split('\n')[0] === parts[i].split('\n')[0]);
    if (existing && existing !== parts[i]) throw Error(`archive conflict: ${parsed[i].head}; restore or compare the two copies`);
    if (!existing) text += parts[i];
    chunks.set(file, text);
  }
  const rows = [], heads = new Set(parsed.slice(0, 45).map((e) => e.head));
  for (const [file, text] of [...chunks].sort(([a], [b]) => a.localeCompare(b))) {
    const entries = decisionEntries(text, file, (m) => errors.push(m));
    if (!entries.length) errors.push(`${file}: empty archive`);
    for (const e of entries) { if (heads.has(e.head)) errors.push(`duplicate heading ${e.head}`); heads.add(e.head); }
    rows.push(archiveRow(file, entries));
  }
  if (errors.length) throw Error(errors.join('\n'));
  const save = (file, text) => {
    if (existsSync(file) && readFileSync(file, 'utf8') === text) return;
    const tmp = file + '.tmp'; writeFileSync(tmp, text, { flag: 'wx' }); renameSync(tmp, file);
  };
  for (const [file, text] of chunks) if (original.get(file) !== text) save(join(dir, file), text);
  save(join(dir, 'INDEX.md'), '# Archive index\n\n' + rows.join('\n') + (rows.length ? '\n' : ''));
  save(livePath, preamble + parts.slice(0, 45).join(''));
  const checked = inspect(root);
  if (checked.fails.length) throw Error(`archive saved; ledger needs repair:\n${checked.fails.join('\n')}`);
  console.log(`archive: ${Math.max(0, parts.length - 45)} entries moved verbatim; ${rows.length} indexed chunks; latest 45 kept`);
} catch (e) { console.error(`archive: ${e.message}`); process.exitCode = 1; }
