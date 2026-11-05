#!/usr/bin/env node
// pm-next v3.1 status site. Zero dependencies. usage: node tools/view.mjs [--root <dir>] [--out project/view.html] [--date YYYY-MM-DD] [--open] [--quiet]
// Humans read this; agents read the source. Static, opens locally, no network, no model, no script (V3-STATUS-VIEW).
// A small site (V31-STATUS-SITE): --out is the dashboard; beside it, view.site/<generation>/ holds its pages: index.html
// the same dashboard, items/<ID>.html one per item file, record.html the rest of the record.
// It reads the ledger only through inspect; Git gives the commit, the ledger's uncommitted changes and the last session end.
// The check date is its only date input, so two builds from the same ledger, commit, renderer and date are byte-identical
// while the files its links name, what they are and where the pages are written stay the same (FX-12).
// Invalid source, a moved HEAD or a failed write exits non-zero, opens nothing and leaves the old site whole.
import { writeFileSync, renameSync, rmSync, mkdirSync, rmdirSync, linkSync, unlinkSync, lstatSync, readdirSync, readFileSync, utimesSync, statSync, realpathSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, basename, resolve, relative, isAbsolute, sep } from 'node:path';
import { inspect, options, active, datesMentioned, sessionEndLines, sessionEnd, a11yPack } from './ledger.mjs';
export const RENDERER = 'pm-next v3.1 status site 1';
const GENERATOR = 'pm-next v3.1 status site'; // the mark a folder carries before a build may replace it
const args = options(['out', 'date', 'open', 'quiet']);
const root = args.root;
const out = args.out || join(root, 'project', 'view.html');
const siteDir = `${out.replace(/\.html?$/i, '')}.site`, siteName = basename(siteDir);
const say = (line) => { if (!args.quiet || line.startsWith('view: failed')) (line.startsWith('view: failed') ? console.error : console.log)(line); };
const failed = (why) => { say(`view: failed — ${why}; the old site was not replaced`); process.exit(1); };
const date = args.date || new Date().toISOString().slice(0, 10);

// ---- Git, with inherited routing cleared so a hook's GIT_DIR or GIT_INDEX_FILE cannot point it elsewhere. HEAD is read
// before the ledger and again before publishing; a Git read that fails inside a checkout refuses, never reassures.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
const call = (...a) => spawnSync('git', ['--no-optional-locks', '-C', root, ...a], { encoding: 'utf8', env, maxBuffer: 64 << 20 });
const git = (...a) => { const r = call(...a); return r.status === 0 ? r.stdout : null; };
const must = (what, ...a) => git(...a) ?? failed(`cannot read Git's ${what}`);
const probe = call('rev-parse', '--is-inside-work-tree'); // only Git's own "not a git repository" means outside Git
const inGit = probe.status === 0 && probe.stdout.trim() === 'true';
if (!inGit && !(probe.status === 128 && /not a git repository/i.test(probe.stderr))) failed('cannot tell whether this is a Git checkout');
const readHead = () => { // '' only for a branch with no commit yet; any other failure refuses
  if (!inGit) return '';
  const h = git('rev-parse', '--verify', '-q', 'HEAD'); if (h) return h.trim();
  const ref = git('symbolic-ref', '-q', 'HEAD')?.trim();
  if (ref && call('show-ref', '--verify', '-q', ref).status === 1) return '';
  return failed("cannot read Git's HEAD");
};
const head = readHead();
let state; try { state = inspect(root, { checkDate: date }); } catch (e) { failed(`cannot read the ledger: ${e.code || e.message}`); }
if (state.fails.length) failed(`source is invalid: ${state.fails.join(' | ')}`);
const sourcePaths = [...state.sources.keys()].sort();
const dirty = inGit ? must('status', 'status', '--porcelain=v1', '--untracked-files=all', '--', 'project', ...sourcePaths.filter((p) => !p.startsWith('project/'))).split('\n').filter(Boolean) : [];
const SEARCH = 1000;
let lastEnd = null;
if (head) {
  const log = must('history', 'log', '--first-parent', '-n', String(SEARCH), '--format=%H%x00%B%x1e', 'HEAD');
  for (const rec of log.split('\x1e')) {
    const [hash, message = ''] = rec.replace(/^\n/, '').split('\x00');
    if (!hash || !sessionEndLines(message).length) continue;
    const { lines, end } = sessionEnd(message);
    lastEnd = { hash, lines, end }; break; // the nearest one only; a malformed line never falls back to an older one
  }
}
const hash = createHash('sha256');
for (const p of sourcePaths) hash.update(p + '\n').update(state.sources.get(p));
const a11y = state.a11y ? a11yPack(root) : null; // V31-A11Y (3.18): the pack's section, only with the profile's line
hash.update(RENDERER); if (a11y) hash.update(a11y.RENDERER);
const fingerprint = hash.digest('hex');

// ---- text: everything from the ledger is escaped; IDs with an item file link to its page, and a Markdown link to a file
// in the checkout to that file (FX-12); nothing else is linked in
const { milestones, decisions, tphases, recall, wish, digests, archives } = state;
const profile = active(state.files.profile);
const openItems = [...state.open.values()];
const needsOwner = openItems.filter((i) => i.mark === '!');
const delegated = (state.signatures || []).filter((s) => s.delegated);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ID_TOKEN = /(?<![\p{L}\p{N}_.\/-])([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)(?![\p{L}\p{N}_-]|\.[\p{L}\p{N}])/gu; // never a wish ID's stem
const page = (id, up) => `${up}items/${id}.html`;
const ids = (escaped, up) => escaped.replace(ID_TOKEN, (m, id) => state.items.has(id) ? `<a href="${page(id, up)}" title="${esc(state.items.get(id).title)}">${id}</a>` : m); // a title names an in-text ID (V-13)
const bold = (escaped) => escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const words = (s, up) => ids(bold(esc(s)), up); // bold first: a title in an ID link's attribute is never read as Markdown
const label = (s) => bold(esc(s)); // a link's own text: never linked again, so no link sits inside another
// A linked text file opens as a copy (V31-SITE-FIX, V-18): a browser reading a local text file guesses its encoding, and
// WebKit read UTF-8 as another, garbling dashes and accents. The copy is a page of the same text in the generation, its
// encoding declared, the file itself linked from it. Only a text file of a known kind, valid UTF-8, no NUL, at most 1 MiB;
// any other stays a link to the file. Each is looked up once a build; the generation's name covers the copies' bytes.
const COPY_KIND = /\.(md|txt|json|jsonl|mjs|cjs|js|ts|css|yml|yaml|toml|csv|log|sh|diff|patch)$/i, COPY_MAX = 1 << 20;
const copies = new Map(); // by canonical path, so an alias of a file is one copy, linked as the first page to name it did; null where the file stays a link
const copyOf = (target) => {
  let real; try { real = realpathSync(target); } catch { return null; }
  if (!copies.has(real)) copies.set(real, (() => {
    const rel = relative(checkout, real);
    if (!COPY_KIND.test(real) || !rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return null; // the canonical file itself is bound to the checkout
    let fd; try {
      fd = openSync(real, 'r');
      if (!fstatSync(fd).isFile()) return null;
      const buf = Buffer.alloc(COPY_MAX + 1), n = readSync(fd, buf, 0, COPY_MAX + 1, 0); // never more than the cap and one byte
      if (n > COPY_MAX) return null;
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, n));
      if (text.includes('\0')) return null;
      const path = rel.split(sep).join('/');
      return { target, rel: path, text, name: `${createHash('sha256').update(path).digest('hex').slice(0, 12)}-${basename(path).replace(/[^A-Za-z0-9._-]/g, '_').slice(-60)}.html` };
    } catch { return null; } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* read already */ } }
  })());
  return copies.get(real);
};
// A Markdown link (V31-DESIGN-REVIEW FX-12, V-18). `from` is the source file's path in the installation, so a path
// resolves from that file's own folder. A web address stays a link. An item file becomes its page, a fragment kept only
// when it is one of that page's section anchors. Any other file in the checkout, the Git work tree or the installation
// outside Git, becomes a link to that file from the page's own folder, each name encoded. A fragment a link cannot follow
// is shown beside it: a source file is not proven to hold that anchor. A label that is an item ID keeps its page beside
// the file it names. A missing path, a folder, a path outside the checkout, once every symbolic link in it is followed,
// an absolute path or any other scheme is shown, never followed. Each file is looked up once a build, so every page agrees.
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
const anchored = (id) => { const seen = new Set(['contents-nav']); return state.items.get(id).sections.map(([name, body]) => { let s = slug(name); while (seen.has(s)) s += '-'; seen.add(s); return [s, name, body]; }); };
const checkout = (() => { const at = inGit ? must('work tree', 'rev-parse', '--show-toplevel').trim() : root; try { return realpathSync(at); } catch (e) { return failed(`cannot read ${at}: ${e.code || e.message}`); } })();
const looked = new Map();
const inCheckout = (target) => { // a file, not a folder, inside the checkout
  if (!looked.has(target)) looked.set(target, (() => { try { const real = realpathSync(target), r = relative(checkout, real); return statSync(real).isFile() && !!r && r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r); } catch { return false; } })());
  return looked.get(target);
};
// A page's folder from its prefix to the generation: '' is the generation's own folder, '../' its items folder, any other
// prefix the top dashboard's, beside --out. A path from inside a generation does not depend on its name, so a stand-in serves.
const GEN_AT = join(resolve(siteDir), 'generation');
const pageDir = (up) => up === '' ? GEN_AT : up === '../' ? join(GEN_AT, 'items') : dirname(resolve(out));
const fileHref = (target, up) => esc(relative(pageDir(up), target).split(sep).map(encodeURIComponent).join('/'));
const ITEM_ID = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$/;
const mdLink = (text, href, up, from) => {
  if (/^https?:\/\//i.test(href)) return `<a href="${esc(href)}">${label(text)}</a>`;
  const its = ITEM_ID.test(text) && state.items.has(text) ? `<a href="${page(text, up)}">${text}</a>` : '';
  const shown = (why) => `${its || label(text)} (<code>${esc(href)}</code>, ${why})`;
  if (/^[a-z][a-z0-9+.-]*:|^[/\\]/i.test(href)) return shown('not followed');
  const at = href.indexOf('#'), path = (at < 0 ? href : href.slice(0, at)).split('?')[0], frag = at < 0 ? '' : href.slice(at + 1);
  let name = path; try { name = decodeURIComponent(path); } catch { /* a malformed escape: the path as written */ }
  const target = resolve(root, name ? join(dirname(from), name) : from);
  const unfollowed = (followed) => frag && !followed ? ` (<code>${esc(`#${frag}`)}</code> not followed)` : '';
  const item = relative(resolve(root), target).split(sep).join('/').match(/^project\/items\/([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)\.md$/);
  if (item && state.items.has(item[1])) {
    const known = anchored(item[1]).some(([s]) => s === frag), to = `${page(item[1], up)}${known ? `#${frag}` : ''}`;
    return its && text !== item[1] ? `${its} (<a href="${to}">${item[1]}</a>${unfollowed(known)})` : `<a href="${to}">${label(text)}</a>${unfollowed(known)}`;
  }
  if (!inCheckout(target)) return shown('not in this checkout');
  const copy = copyOf(target), to = copy ? `${up}files/${copy.name}` : fileHref(target, up);
  return its ? `${its} (<a href="${to}"><code>${esc(href)}</code></a>${frag ? ', its fragment not followed' : ''})` : `<a href="${to}">${label(text)}</a>${unfollowed(false)}`;
};
const inline = (s, up, from) => String(s).split(/(`[^`]+`|\[[^\]\n]+\]\([^)\s]+\))/).map((part, n) => {
  if (n % 2 === 0) return words(part, up);
  if (part.startsWith('`')) return `<code>${ids(esc(part.slice(1, -1)), up)}</code>`;
  const [, text, href] = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/); return mdLink(text, href, up, from);
}).join('');
const paras = (t, up, from) => String(t || '').trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => /^- /.test(p) ? `<ul>${p.split(/\n(?=- )/).map((l) => `<li>${inline(l.slice(2).replace(/\n\s*/g, ' '), up, from)}</li>`).join('')}</ul>` : `<p>${inline(p.replace(/\n\s*/g, ' '), up, from)}</p>`).join('');
// Each text's source file, for its links
const SRC = { backlog: 'project/backlog.md', trajectory: 'project/trajectory.md', decisions: 'project/decisions.md', wish: 'project/wish-list.md', profile: 'project/profile.md' };
const itemSrc = (id) => `project/items/${id}.md`;

// A small Markdown reader for item files: headings, paragraphs, nested lists with continuation lines, tables. Any line it
// does not know is a paragraph's text, escaped; nothing in a file can add markup of its own.
const indent = (l) => l.match(/^ */)[0].length;
const LIST = /^( *)([-*+]|\d+\.) (.*)$/;
// A line opens a list when it is a bullet, an ordered "1.", or any ordered item at a block's start: the first line, after
// a blank line, a heading or a table row. A wrapped line that happens to begin "487." stays text, its number kept
// (CommonMark's interruption rule).
const opens = (lines, k) => { const m = lines[k]?.match(LIST); return !!m && (!/\d/.test(m[2]) || m[2] === '1.' || k === 0 || !lines[k - 1].trim() || /^ *(\||#{3,6} )/.test(lines[k - 1])); };
const cells = (row) => row.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
// A table's scrolling box (V31-DESIGN-REVIEW FX-3, V-01): a keyboard stop, a named region, so a table wider than the
// page scrolls by arrow keys in every browser; with no script, every box is a stop, overflowing or not.
const tw = (name, table) => `<div class="tw" tabindex="0" role="region" aria-label="${name}">${table}</div>`;
// An item file's tables are named by their section; the count is known only after the section is read, so md() leaves
// a mark no escaped text can hold, and the section names its tables after.
const TW_MARK = /<tw#(\d+)>/g;
const nameTables = (html, section) => { const total = (html.match(TW_MARK) || []).length; return html.replace(TW_MARK, (m, k) => esc(total > 1 ? `${section}, table ${k} of ${total}` : `${section}, table`)); };
function md(text, up, from, count = { n: 0 }) {
  const lines = String(text || '').replace(/\t/g, '    ').split('\n'); const html = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i]; let m;
    if (!l.trim()) { i++; continue; }
    if ((m = l.match(/^ *(#{3,6}) (.+)$/))) { const n = Math.min(m[1].length, 4); html.push(`<h${n}>${inline(m[2], up, from)}</h${n}>`); i++; continue; }
    if (/^ *\|/.test(l)) {
      const rows = []; while (i < lines.length && /^ *\|/.test(lines[i])) rows.push(lines[i++]);
      const sep = rows.length > 1 && /^[\s|:-]+$/.test(rows[1]);
      const headCells = sep ? cells(rows[0]) : null, body = (sep ? rows.slice(2) : rows).map(cells);
      html.push(tw(`<tw#${++count.n}>`, `<table>${headCells ? `<tr>${headCells.map((c) => `<th>${inline(c, up, from)}</th>`).join('')}</tr>` : ''}${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c, up, from)}</td>`).join('')}</tr>`).join('')}</table>`));
      continue;
    }
    if (opens(lines, i) && (m = l.match(LIST))) {
      const at = m[1].length, ordered = /\d/.test(m[2]), tag = ordered ? 'ol' : 'ul', items = [], start = parseInt(m[2], 10);
      while (i < lines.length && (m = lines[i].match(LIST)) && m[1].length === at && /\d/.test(m[2]) === ordered) {
        const body = [m[3]], inner = at + m[2].length + 1; i++;
        while (i < lines.length) {
          const next = lines[i];
          if (next.trim() && indent(next) > at) { body.push(next.slice(Math.min(indent(next), inner))); i++; continue; }
          if (!next.trim()) { let k = i; while (k < lines.length && !lines[k].trim()) k++; if (k < lines.length && indent(lines[k]) > at) { while (i < k) body.push(lines[i++].trim()); continue; } }
          break;
        }
        const own = body.findIndex((b, n) => n > 0 && (!b.trim() || opens(body, n) || /^ *(\||#{3,6} )/.test(b)));
        const first = own < 0 ? body : body.slice(0, own), rest = own < 0 ? [] : body.slice(own);
        const nested = rest.length ? md(rest.join('\n'), up, from, count) : '', text = inline(first.map((b) => b.trim()).join(' '), up, from);
        // A point holding a table, at any depth, keeps the page's width for it; only its own text takes the measure (FX-9).
        items.push(nested.includes('<tw#') ? `<li class="wide"><span class="lead">${text}</span>${nested}</li>` : `<li>${text}${nested}</li>`);
        while (i < lines.length && !lines[i].trim()) { let k = i; while (k < lines.length && !lines[k].trim()) k++; const n = lines[k]?.match(LIST); if (n && n[1].length === at) i = k; else break; }
      }
      html.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</${tag}>`); continue;
    }
    const para = []; while (i < lines.length && lines[i].trim() && !(para.length && opens(lines, i)) && !/^ *(\||#{3,6} )/.test(lines[i])) para.push(lines[i++].trim());
    html.push(`<p>${inline(para.join(' '), up, from)}</p>`);
  }
  return html.join('\n');
}

// ---- shared parts of every page
const title = (profile.match(/^# Profile — (.+)$/m) || [, 'project'])[1];
const markLabel = { ' ': 'open', '~': 'in progress', '!': 'needs the owner' };
const mdBlock = (t) => t.split('\n').map((l) => { let m; if ((m = l.match(/^## (.+)/))) return `<h3>${inline(m[1], '', SRC.profile)}</h3>`; if ((m = l.match(/^- (.+)/))) return `<li>${inline(m[1], '', SRC.profile)}</li>`; if (/^#/.test(l) || !l.trim()) return ''; return `<p>${inline(l, '', SRC.profile)}</p>`; }).join('\n').replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (s) => `<ul>${s}</ul>`);
const meta = (i, up) => `${i.from ? `<br><span class="meta">from: ${inline(i.from, up, SRC.backlog)}</span>` : ''}${i.blocked ? `<br><strong>blocked:</strong> ${inline(i.blocked, up, SRC.backlog)}` : ''}`;
// A decision's anchor on the record page: its date, ID and a hash of its heading, so it stays put as entries are added or
// archived (V31-SITE-FIX, V-15, V-20); a live decision has a way back, an archived one none, to keep the stops down. Beside "no item file", where an orphan's record is: its decision, else its phase.
const decisionAnchor = (e) => `decision-${e.date}-${e.id}-${createHash('sha256').update(e.head).digest('hex').slice(0, 16)}`;
const firstDecision = new Map();
for (const e of [...decisions, ...archives.flatMap((a) => a.entries)]) if (!firstDecision.has(e.id)) firstDecision.set(e.id, e);
const noFile = (id, up = '') => {
  const e = firstDecision.get(id), phase = state.open.get(id)?.phase;
  return `<span class="tag">no item file</span>${e ? ` <a class="meta" href="${up}record.html#${decisionAnchor(e)}">its decision</a>` : phase ? ` <span class="meta">in ${esc(phase)}</span>` : ''}`;
};
const idCell = (id, up = '') => state.items.has(id) ? `<a class="id" href="${page(id, up)}">${id}</a>` : `<span class="id">${id}</span> ${noFile(id, up)}`;
const shippedAll = tphases.flatMap((p) => p.lines.map((l) => ({ phase: p.name, line: l, s: [...state.shipped.values()].find((x) => l.startsWith(x.id + ' — ')) })));
// The latest four by date, equal dates in rule 1's trajectory order: the phase standing first, then a phase's later line.
const latest = tphases.flatMap((p) => [...p.lines].reverse()).map((l, n) => ({ ...shippedAll.find((y) => y.line === l), n })).filter((x) => x.s).sort((a, b) => b.s.date.localeCompare(a.s.date) || a.n - b.n).slice(0, 4);
const shippedLine = (x, up = '') => `${inline(x.line, up, SRC.trajectory)}${x.s && !state.items.has(x.s.id) ? ` ${noFile(x.s.id, up)}` : ''}`;
const dates = datesMentioned(state.open);
const stamp = inGit && !head ? 'A Git checkout with no commit yet.' : head
  ? `Commit <span class="stamp">${head}</span>; ${dirty.length ? `<strong>the ledger had ${dirty.length} uncommitted change(s) when this was built</strong> (${dirty.map((l) => esc(l.slice(3))).join(', ')})` : 'the ledger had no uncommitted changes when this was built'}.`
  : 'Not built in a Git checkout: no commit can be named.';
const KEEP_HOURS = 24; // how long a generation outlives its last publication, so a page left open survives refreshes
// The site bar's and the contents' links are each a 44 × 44 px target with a gap between (V31-DESIGN-REVIEW FX-4, V-03);
// links inside sentences and tables keep their size.
// Every text colour (ink, muted, accent, warn) is at least 7:1 on every surface (surface, ground, warn-soft, ok-soft) in
// both schemes (FX-8, V-02).
// Body text is 0.9375rem, 15 px at the default size, so a larger default font reaches it too (FX-7, V-07).
// A focused link scrolls in with its 6 px ring inside the viewport: browsers scroll to the box, leaving the ring past the
// edge (V31-SITE-FIX, V-14, measured).
// Inline code has no side padding in a sentence: a wrapped token's padding stood 2–3 px past its box in WebKit (V-17, measured).
// Paragraph and list text keeps a measure of about 65–70 characters; tables, and a point holding one, keep the page's width
// (FX-9, V-06).
const CSS = `:root{--ink:#14181F;--muted:#48505C;--rule:#D9E0E9;--surface:#fff;--ground:#F6F8FA;--accent:#1F4E8C;--warn:#754308;--warn-soft:#FBF0DE;--ok:#1F6B4A;--ok-soft:#E4F3EB}
@media(prefers-color-scheme:dark){:root{--ink:#E8ECF2;--muted:#A8B2BF;--rule:#2A323E;--surface:#171C24;--ground:#10141A;--accent:#87B5ED;--warn:#E1A753;--warn-soft:#2E2413;--ok:#63C79A;--ok-soft:#14281E}}
body{margin:0;background:var(--ground);color:var(--ink);font:0.9375rem/1.5 system-ui,sans-serif}.wrap{max-width:960px;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.1rem;margin:1.6rem 0 .5rem;border-bottom:1px solid var(--rule);padding-bottom:.25rem}h3,h4{font-size:.95rem;margin:1rem 0 .3rem;color:var(--muted)}
.meta{color:var(--muted);font-size:.85rem}.card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:.8rem 1rem;margin:.5rem 0}
.owner{border-left:3px solid var(--warn);background:var(--warn-soft)}.warns{border-left:3px solid var(--muted)}.ok{border-left:3px solid var(--ok);background:var(--ok-soft)}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--rule);vertical-align:top}th{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
code{background:var(--ground);border:1px solid var(--rule);border-radius:3px;padding:.05em .3em;font-size:.9em}.id{font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap}
.tag{display:inline-block;font-size:.72rem;padding:.05rem .45rem;border-radius:3px;border:1px solid var(--rule);color:var(--muted)}.tag.owner{border-color:var(--warn);color:var(--warn);background:var(--warn-soft)}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}nav ul{columns:2 12rem;margin:.3rem 0 0 1.2rem}a{color:var(--accent)}td,li,p{overflow-wrap:anywhere}.stamp{font-family:ui-monospace,monospace;font-size:.8rem;overflow-wrap:anywhere}ul,ol{margin:.3rem 0 .3rem 1.2rem}.tw{overflow-x:auto}
.site{margin:0 0 .6rem;font-size:.9rem;display:flex;flex-wrap:wrap;gap:.25rem 1rem}nav li{margin:.25rem 0;break-inside:avoid}
.site a,nav li a{display:inline-flex;align-items:center;box-sizing:border-box;min-height:44px;min-width:44px;padding:0 .25rem}
p,li,.lead{max-width:58ch}li.wide{max-width:none}.lead{display:block}a,[tabindex]{scroll-margin:.75rem}li code,p code{padding-inline:0}pre.file{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:.8rem 1rem;font:.85rem/1.45 ui-monospace,monospace}`;
// What the page is and how fresh: after the heading, or where a page's body places it: the dashboard's after the owner's
// card, so what waits on the owner comes first (V31-DESIGN-REVIEW FX-10, V-04).
const about = (links) => `<p class="meta">A snapshot as of its last refresh, never live: refresh it after the ledger changes. ${stamp} Ledger fingerprint <span class="stamp">${fingerprint}</span>, over ${sourcePaths.length} files the checker read. Check date ${date}. ${esc(RENDERER)}. Agents read the source files.</p>${links.latest ? `\n<p class="meta">This page is one refresh's copy: This refresh opens the dashboard of the same refresh, Dashboard the newest one. A copy is kept for at least ${KEEP_HOURS} hours after it was last refreshed, and always while it is the newest or the one before; after that a refresh may remove it, and this page then fails to reload: open ${esc(basename(out))} again.</p>` : ''}`;
// One main landmark holds the page; the site bar is a navigation landmark named Site, the contents another named Contents
// (V31-DESIGN-REVIEW FX-6, V-12).
// links: home, the dashboard of the same build; latest, the refreshed dashboard, only on a generation's pages; gen, the
// generation a top dashboard names, so the next build knows which one to keep beside its own.
const shell = (heading, up, links, nav, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="${esc(RENDERER)}">${links.gen ? `<meta name="pm-next-generation" content="${links.gen}">` : ''}<title>${esc(heading.startsWith(title) ? heading : `${heading} — ${title}`)}</title>
<style>
${CSS}
</style></head><body><div class="wrap">
<nav class="site" aria-label="Site"><a href="${links.home}">${links.latest ? 'This refresh' : 'Dashboard'}</a><a href="${up}record.html">Record</a><a href="${up}record.html#items">Item pages</a>${links.latest ? `<a href="${links.latest}">Dashboard</a>` : ''}</nav>
<main>
<h1>${esc(heading)}</h1>
${typeof body === 'function' ? '' : `${about(links)}\n`}${nav.length ? `<nav aria-label="Contents" id="contents-nav"><ul>${nav.map(([id, name]) => `<li><a href="#${id}">${esc(name)}</a></li>`).join('')}</ul></nav>\n` : ''}${typeof body === 'function' ? body(about(links)) : body}
</main>
</div></body></html>
`;

// ---- the dashboard: what the single page showed first, every ID with a file linked to its page
// A closed phase holds no open item (the checker refuses one): one line names them all, in place of a table saying none
// for each (FX-11, V-04). An open phase with no item keeps its table.
const shut = (p) => !p.items.length && / — CLOSED /.test(p.name);
const dashNav = [['owner', 'Needs the owner'], ['session', 'Last session end'], ['open', 'Open work'], ['latest', 'Latest outcomes'], ['dates', 'Dates mentioned']];
// An owner card entry: the ID, its blocker and next step, its title only where it has neither; open work has the rest (V-16).
const ownerEntry = (i, up) => {
  const next = (state.items.get(i.id)?.now || '').match(/^Next step:\s*(\S[\s\S]*?)\s*(?:\n\s*\n|$(?![\s\S]))/m)?.[1].replace(/\s*\n\s*/g, ' '), parts = [i.blocked && `<strong>blocked:</strong> ${inline(i.blocked, up, SRC.backlog)}`, next && `<strong>next:</strong> ${inline(next, up, itemSrc(i.id))}`].filter(Boolean);
  return `${idCell(i.id, up)} — ${parts.join(' — ') || inline(i.title, up, SRC.backlog)}`;
};
const dashboardAt = (up, links) => shell(`${title} — status`, up, links, dashNav, (about) => `<h2 id="owner">Needs the owner</h2>
${needsOwner.length || delegated.length ? `<div class="card owner"><ul>${needsOwner.map((i) => `<li>${ownerEntry(i, up)}</li>`).join('')}${delegated.map((s) => `<li>${esc(s.file)} — signed by delegation by ${esc(s.name)} on ${esc(s.date)}, authority: ${esc(s.authority)} — needs the owner's reviewed signature</li>`).join('')}</ul></div>` : `<div class="card ok"><strong>Nothing waits on the owner.</strong></div>`}
${about}
<h2 id="session">Last session end</h2>
${!head ? '<p class="meta">No Git history to read.</p>' : !lastEnd ? '<p class="meta">No commit among the latest ' + SEARCH + ' on the first-parent history carries a Session-end line.</p>' : `<div class="card">${lastEnd.end ? `<p>${ids(esc(`Session-end: ${lastEnd.end.status} — next ${lastEnd.end.next} — ${lastEnd.end.reason}`), up)}</p><p class="meta">Commit <span class="stamp">${lastEnd.hash}</span>; next item ${lastEnd.end.next === 'none' ? 'none' : idCell(lastEnd.end.next, up)}. History, not an instruction: a session continues only as the record says.</p>` : `<p><strong>The nearest Session-end lines are malformed</strong> in commit <span class="stamp">${lastEnd.hash}</span>:</p><ul>${lastEnd.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`}</div>`}
${recall ? `<div class="card ${recall.score === '8' ? 'ok' : 'owner'}"><strong>Last recall check:</strong> ${recall.score}/8 on ${recall.date} (${recall.mode})</div>` : ''}
${state.warns.length ? `<div class="card warns"><strong>Maintenance warnings</strong><ul>${state.warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
<h2 id="open">Open work</h2>
<p class="meta">State is the line's mark alone; a blocker is shown apart and does not make a line the owner's. An ID with an item file opens its page: its acceptance criteria, its notes.</p>
${milestones.map((m) => { const closed = m.phases.filter(shut); return `<h3>${m.name}</h3>${m.phases.filter((p) => !shut(p)).map((p) => `${p.name ? `<div class="meta">${esc(p.name)}</div>` : ''}${tw(esc(`Open work: ${m.name}${p.name ? `, ${p.name}` : ''}`), `<table><tr><th>ID</th><th>Item</th><th>State</th><th>Since</th></tr>${p.items.map((i) => { const it = state.items.get(i.id); return `<tr id="item-${i.id}"><td>${idCell(i.id, up)}</td><td>${inline(i.title, up, SRC.backlog)}${meta(i, up)}${it?.now ? `<div class="now"><strong>Now:</strong>${paras(it.now, up, itemSrc(i.id))}</div>` : ''}${it ? `<br><a class="meta" href="${page(i.id, up)}#acceptance-criteria">${i.id}: acceptance criteria (${it.criteria.length})</a>` : ''}</td><td><span class="tag${i.mark === '!' ? ' owner' : ''}">${markLabel[i.mark]}</span></td><td>${i.since}</td></tr>`; }).join('') || '<tr><td colspan="4" class="meta">none</td></tr>'}</table>`)}`).join('')}${closed.length ? `<p class="meta">Closed, nothing open: ${closed.map((p) => esc(p.name)).join('; ')}.</p>` : ''}`; }).join('')}
<h2 id="latest">Latest outcomes</h2>
<p class="meta">The newest trajectory lines, word for word: each says its own outcome.</p>
<ul>${latest.map((x) => `<li>${shippedLine(x, up)}</li>`).join('') || '<li class="meta">nothing yet</li>'}</ul>
<h2 id="dates">Dates mentioned</h2>
<p class="meta">Every date in an open line's title or blocker, oldest first; since dates left out. None of them is called a deadline here.</p>
${tw('Dates mentioned', `<table><tr><th>Date</th><th>ID</th><th>Where</th><th>Clause</th></tr>${dates.map((d) => `<tr><td>${d.date}</td><td>${idCell(d.id, up)}</td><td>${d.part}</td><td>${inline(d.clause, up, SRC.backlog)}</td></tr>`).join('') || '<tr><td colspan="4" class="meta">none</td></tr>'}</table>`)}
<p class="meta">The decisions, archives, trajectory, wish-list, standards, profile and <a href="${up}record.html#terms">the site's terms</a> are on <a href="${up}record.html">the record page</a>.</p>`);

// ---- the record page: everything else the single page showed, item criteria now on the item pages
const itemIds = [...state.items.keys()].sort();
const where = (id) => state.open.has(id) ? `open, ${markLabel[state.open.get(id).mark]}` : state.shipped.has(id) ? `recorded ${state.shipped.get(id).date}` : state.retired?.has(id) ? `retired unshipped ${state.retired.get(id).date}, by ${esc(state.retired.get(id).head)}` : 'neither open nor in the trajectory';
const backToContents = '<p class="meta"><a href="#contents-nav">Back to contents</a></p>';
const entryCard = (from, back = true) => (d) => `<div class="card" id="${decisionAnchor(d)}"><h3>${inline(d.head, '', from)}</h3><p><strong>Decision:</strong> ${inline(d.decision, '', from)}</p><p><strong>Rationale:</strong> ${inline(d.rationale, '', from)}</p><p class="meta">Supersedes: ${inline(d.supersedes || 'none', '', from)}</p>${back ? backToContents : ''}</div>`;
// The site's own terms, the ones the owner's journeys meet undefined (V31-SITE-FIX, V-13's audit).
const GLOSSARY = [['Item file', 'one work item\'s criteria, current state and notes, under project/items/.'], ['Now', 'an item file\'s dated state: its next step and open question.'], ['Trajectory', 'each item\'s outcome in one line, by phase.'], ['Wish-list', 'deferred ideas, not yet work.'], ['Session-end', 'a commit\'s line saying how a session ended and what comes next.'], ['Recall check', 'a fresh reader\'s score out of 8 on what the record says at a phase close.'], ['Ledger fingerprint', 'a hash of the files this site was built from; it changes when they do.'], ['Refresh', 'one build of this site; its pages are kept as a copy for a time.']];
const glossary = `<h2 id="terms">Terms</h2><dl>${GLOSSARY.map(([t, d]) => `<dt><strong>${t}</strong></dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
const recordNav = [['terms', 'Terms'], ['items', 'Item pages'], ['decisions', 'Decisions'], ['archives', 'Archived decisions'], ['shipped', 'Trajectory'], ['wish', 'Wish-list'], ['standards', 'Standards adopted'], ...(a11y ? [[a11y.SECTION.id, a11y.SECTION.name]] : []), ['profile', 'Profile']];
const href = (name) => esc(encodeURIComponent(name)); // an output file or folder name, safe in an attribute and a URL
const genLinks = (up) => ({ home: `${up}index.html`, latest: `${up}../../${href(basename(out))}` });
const record = shell(`${title} — record`, '', genLinks(''), recordNav, `${glossary}
<h2 id="items">Item pages <span class="meta">(${itemIds.length})</span></h2>
${tw('Item pages', `<table><tr><th>ID</th><th>Item</th><th>Where</th></tr>${itemIds.map((id) => `<tr><td>${idCell(id)}</td><td>${inline(state.items.get(id).title, '', itemSrc(id))}</td><td>${where(id)}</td></tr>`).join('') || '<tr><td colspan="3" class="meta">No item has a file.</td></tr>'}</table>`)}
<h2 id="decisions">Decisions <span class="meta">(${decisions.length}, newest first)</span></h2>
${decisions.map(entryCard(SRC.decisions)).join('')}
<h2 id="archives">Archived decisions <span class="meta">(${archives.reduce((n, a) => n + a.entries.length, 0)})</span></h2>
${archives.map((a) => `<h3>${esc(a.file)} (${a.entries.length})</h3>${a.entries.map(entryCard(`project/${a.file}`, false)).join('')}`).join('') || '<p class="meta">none</p>'}
<h2 id="shipped">Trajectory</h2>
<p class="meta">Every trajectory line as the record words it, by phase. Each item with a file has its page, with what it had to do.</p>
${backToContents}
${tphases.map((p) => `<h3>${esc(p.name)}</h3>${p.lines.length ? `<ul>${p.lines.map((l) => `<li>${shippedLine(shippedAll.find((y) => y.line === l))}</li>`).join('')}</ul>` : '<p class="meta">nothing yet</p>'}`).join('')}
<h2 id="wish">Wish-list <span class="meta">(${wish.length})</span></h2><ul>${wish.map((l) => `<li>${inline(l, '', SRC.wish)}</li>`).join('') || '<li class="meta">empty</li>'}</ul>
<h2 id="standards">Standards adopted</h2>
${tw('Standards adopted', `<table><tr><th>Digest</th><th>Standard</th><th>Version</th><th>Retrieved</th><th>Next check</th></tr>${digests.map((d) => `<tr><td class="id">${esc(d.file.replace(/\.md$/, ''))}</td><td>${esc(d.standard)}${/^https?:\/\//.test(d.source) ? ` <a href="${esc(d.source)}">source</a>` : ''}</td><td>${esc(d.version)}</td><td>${esc(d.retrieved)}</td><td>${esc(d.next)}</td></tr>`).join('') || '<tr><td colspan="5" class="meta">no digests yet — run intake</td></tr>'}</table>`)}
${a11y ? a11y.sectionA11y(state.a11y, esc) : ''}<h2 id="profile">Profile</h2><div class="card">${mdBlock(profile)}</div>`);

// ---- one page per item file: its line, then every section of the file in order
const itemPage = (id) => {
  const it = state.items.get(id), o = state.open.get(id), lines = shippedAll.filter((x) => x.s?.id === id);
  const status = o ? `<div class="card${o.mark === '!' ? ' owner' : ''}"><p>${inline(o.title, '../', SRC.backlog)}</p><p><span class="tag${o.mark === '!' ? ' owner' : ''}">${markLabel[o.mark]}</span> ${esc(o.milestone)}${o.phase ? `, ${esc(o.phase)}` : ''} — since ${o.since}${meta(o, '../')}</p><p class="meta">Its backlog line, as the dashboard shows it under <a href="../index.html#item-${id}">open work</a>.</p></div>`
    : lines.length ? `<div class="card ok">${lines.map((x) => `<p>${inline(x.line, '../', SRC.trajectory)}</p><p class="meta">Its trajectory line, under ${esc(x.phase)}.</p>`).join('')}</div>`
    : state.retired?.has(id) ? `<div class="card"><p class="meta">Retired unshipped on ${state.retired.get(id).date}, by the decision ${esc(state.retired.get(id).head)}.</p></div>`
    : '<div class="card"><p class="meta">Neither open in the backlog nor in the trajectory: the file stands alone.</p></div>';
  const named = anchored(id);
  const shown = [...named.filter(([, name]) => name === 'Now'), ...named.filter(([, name]) => name !== 'Now')]; // Now right after the line's card, once (FX-10)
  return shell(`${id} — ${it.title}`, '../', genLinks('../'), shown.map(([s, name]) => [s, name]), `${status}\n${shown.map(([s, name, body]) => `<h2 id="${s}">${esc(name)}</h2>\n${nameTables(md(body, '../', itemSrc(id)), name)}`).join('\n')}`);
};
const copyPage = (c) => shell(c.rel, '../', genLinks('../'), [], `<p class="meta">A copy of <code>${esc(c.rel)}</code> as of this build, declared UTF-8 so every browser reads it alike. <a href="${fileHref(c.target, '../')}">The file itself</a> opens in the browser's own reading of it.</p>\n<pre class="file">\n${esc(c.text)}</pre>`); // the newline after the tag is dropped by HTML, so a file's own first line break survives
const rendered = [['index.html', dashboardAt('', genLinks(''))], ['record.html', record], ...itemIds.map((id) => [`items/${id}.html`, itemPage(id)])];
const copied = () => [...copies.values()].filter(Boolean).sort((x, y) => x.name < y.name ? -1 : 1);
const pages = [...rendered, ...copied().map((c) => [`files/${c.name}`, copyPage(c)])];
const copyCount = copied().length;

// ---- publish (V31-STATUS-SITE): the dashboard stays one file at --out; the pages it links to are one generation, a
// folder named by the hash of its own bytes in the site folder beside it. A build writes its generation in full, then
// the dashboard to a temporary sibling, rechecks HEAD and renames that file over the old dashboard: the one step that
// publishes. Before it, a failure removes only what this build made; the old dashboard and its generation stay whole.
// After it, under the site's lock, a generation is removed only when it is neither the new one, nor the one the old
// dashboard named, nor published in the last KEEP_HOURS hours, and only by a build that changed the generation the
// dashboard names (V31-DESIGN-REVIEW FX-1, the owner's ruling of 2026-10-27).
// The site folder carries a mark; a folder without it, or a symbolic link, is never written into or emptied. A failure
// removes only this build's own files, never the shared site folder, even one this build made.
const SITE_MARK = '.pm-next-status-site', GEN = /^[0-9a-f]{16}$/;
const made = []; let locked = false;
const lock = join(siteDir, '.lock'), breaker = join(siteDir, '.lock.break');
const cleanup = () => { // what this build made, then its lock; a removal that fails is said, never hidden
  const left = [];
  for (const p of made.reverse()) try { rmSync(p, { recursive: true, force: true }); } catch (e) { left.push(`${p} (${e.code || e.message})`); }
  made.length = 0;
  if (locked) try { unlinkSync(lock); } catch (e) { left.push(`${lock} (${e.code || e.message})`); }
  locked = false;
  if (left.length) console.error(`view: could not remove ${left.join(', ')}`);
};
process.on('exit', cleanup);
const refuse = (why) => { cleanup(); failed(why); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const kind = (p) => { try { const st = lstatSync(p); return st.isSymbolicLink() ? 'link' : st.isDirectory() ? 'dir' : 'file'; } catch (e) { if (e.code === 'ENOENT') return ''; return refuse(`cannot read ${p}: ${e.code || e.message}`); } };
if (kind(out) && kind(out) !== 'file') refuse(`cannot write ${out}: not a file`);
const siteKind = kind(siteDir);
if (siteKind === 'link' || siteKind === 'file') refuse(`${siteDir} is not a folder this view wrote`);
const listing = (dir) => { try { return readdirSync(dir); } catch (e) { return refuse(`cannot read ${dir}: ${e.code || e.message}`); } };
if (siteKind === 'dir' && listing(siteDir).length && kind(join(siteDir, SITE_MARK)) !== 'file') refuse(`${siteDir} holds files this view did not write`);
try {
  if (!siteKind) try { mkdirSync(siteDir); } catch (e) { if (e.code !== 'EEXIST' || kind(siteDir) !== 'dir') throw e; } // made a moment ago by another first build; never recursive: a missing parent folder is a failed write. Never removed by a failed build: another build may be using it
  if (kind(join(siteDir, SITE_MARK)) !== 'file') writeFileSync(join(siteDir, SITE_MARK), `${GENERATOR}: generated by tools/view.mjs, never committed; safe to delete with the dashboard\n`);
} catch (e) { refuse(`cannot write ${out}: ${e.code || e.message}`); }
// One build of a site at a time. The lock is a file holding its owner's pid, written aside and hard-linked into place:
// the link fails while any lock exists, even an empty one, so no build sees a lock without its pid, and its owner
// releases it in one unlink. A lock whose process has gone is removed only under a second lock, the breaker, after its
// pid is read again; only its owner or a breaker removes a lock, so a live build's lock is never moved or removed.
const lockPid = (p) => { try { return Number(readFileSync(p, 'utf8')) || 0; } catch (e) { return e.code === 'ENOENT' ? -1 : 0; } }; // -1 gone, 0 unreadable
try {
  const mine = join(siteDir, `.lock.${process.pid}`); made.push(mine);
  writeFileSync(mine, String(process.pid), { flag: 'wx' });
  for (let attempt = 0; !locked; attempt++) {
    try { linkSync(mine, lock); locked = true; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = lockPid(lock);
      if (attempt || pid === 0 || (pid > 0 && alive(pid))) refuse(`another build of ${siteDir} is running${pid > 0 ? ` (process ${pid})` : ''}`);
      if (pid < 0) continue; // released meanwhile
      try { mkdirSync(breaker); } catch (b) { if (b.code === 'EEXIST') refuse(`another build of ${siteDir} is clearing a lock left by process ${pid}; if none is, remove ${breaker}`); throw b; }
      try { if (lockPid(lock) === pid) unlinkSync(lock); } finally { rmdirSync(breaker); }
    }
  }
  unlinkSync(mine); made.pop();
} catch (e) { refuse(`cannot write ${out}: ${e.code || e.message}`); }
const gen = createHash('sha256'); for (const [rel, html] of pages) gen.update(rel + '\n').update(html).update('\0');
const G = gen.digest('hex').slice(0, 16), genDir = join(siteDir, G);
const top = dashboardAt(`${href(siteName)}/${G}/`, { home: href(basename(out)), gen: G });
if (copied().length !== copyCount) refuse('the dashboard linked a file the generation holds no copy of');
const previous = (() => { // the generation open pages may still be reading; a dashboard that cannot be read refuses
  try { return readFileSync(out, 'utf8').match(/<meta name="pm-next-generation" content="([0-9a-f]{16})">/)?.[1] || ''; }
  catch (e) { return e.code === 'ENOENT' ? '' : refuse(`cannot read ${out}: ${e.code || e.message}`); }
})();
const tmp = join(dirname(out), `.${basename(out)}.${process.pid}.tmp`), now = Date.now();
try {
  if (kind(genDir) === 'dir') { // the same files and bytes as this build, by its name; checked, never overwritten
    const has = (dir, rel = '') => readdirSync(join(dir, rel)).flatMap((n) => kind(join(dir, rel, n)) === 'dir' ? has(dir, join(rel, n)) : [join(rel, n)]);
    const differs = has(genDir).sort().join('\n') !== pages.map(([rel]) => rel).sort().join('\n') || pages.some(([rel, html]) => readFileSync(join(genDir, rel), 'utf8') !== html);
    if (differs) refuse(`${genDir} differs from this build; remove it and build again`);
  } else {
    const staging = join(siteDir, `.staging.${process.pid}`); made.push(staging);
    mkdirSync(staging); mkdirSync(join(staging, 'items')); if (copyCount) mkdirSync(join(staging, 'files'));
    for (const [rel, html] of pages) writeFileSync(join(staging, rel), html);
    renameSync(staging, genDir); made.pop(); made.push(genDir);
  }
  utimesSync(genDir, now / 1000, now / 1000); // its publication, recorded before the dashboard names it: a failure refuses
  made.push(tmp); writeFileSync(tmp, top);
  if (readHead() !== head) refuse('HEAD moved while the site was built');
  renameSync(tmp, out); made.length = 0; // published
} catch (e) { refuse(`cannot write ${out}: ${e.code || e.message}`); }
// After publishing: generations last published more than KEEP_HOURS ago, other than this one and the one the old
// dashboard named, and the staging folders and lock files of builds that have gone. A build that republished the old
// dashboard's own generation removes no generation, so the one before it stays until a new one is published. A
// generation's folder time is its publication, set as it is published, even when its bytes were already there; its
// files are never rewritten. An attempt that fails after setting it leaves a later time, which only keeps more. The
// site stands either way; a failure here is one line and changes nothing already published.
let leftOver = '';
try {
  for (const name of readdirSync(siteDir)) {
    const owner = name.match(/^\.(?:staging|lock)\.(\d+)$/);
    const expired = GEN.test(name) && name !== G && name !== previous && previous !== G && now - lstatSync(join(siteDir, name)).mtimeMs >= KEEP_HOURS * 3600e3;
    if (expired || (owner && !alive(Number(owner[1])))) rmSync(join(siteDir, name), { recursive: true, force: true });
  }
} catch (e) { leftOver = `; an older generation could not be removed (${e.code || e.message})`; }
cleanup();
const openCount = milestones.reduce((n, m) => n + m.phases.reduce((k, p) => k + p.items.length, 0), 0);
say(`view: wrote ${out} and ${pages.length} pages in ${siteName}/${G}${leftOver} (${itemIds.length} item pages, ${openCount} open items, ${decisions.length} decisions, ${digests.length} digests${needsOwner.length ? `, ${needsOwner.length} need the owner` : ''}${delegated.length ? `, ${delegated.length} delegated signatures` : ''}; ${head ? `commit ${head.slice(0, 12)}${dirty.length ? ', uncommitted ledger changes' : ''}` : 'no commit'})`);
if (args.open) {
  const opener = process.env.PM_NEXT_VIEW_OPENER || (process.platform === 'darwin' ? 'open' : 'xdg-open');
  const r = spawnSync(opener, [out], { stdio: 'ignore' });
  if (r.status !== 0) { console.error(`view: the site was written but ${opener} could not open it`); process.exit(1); }
}
