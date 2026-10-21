#!/usr/bin/env node
// pm-next v3.1 status page. Zero dependencies. usage: node tools/view.mjs [--root <dir>] [--out project/view.html] [--date YYYY-MM-DD] [--open] [--quiet]
// Humans read this; agents read the source. Static, opens locally, no network, no model, no script (V3-STATUS-VIEW).
// It reads the ledger only through inspect; Git gives the commit, the ledger's uncommitted changes and the last session end.
// The check date is its only date input, so two builds from the same ledger, commit, renderer and date are byte-identical.
// Invalid source, a moved HEAD or a failed write exits non-zero, opens nothing and leaves the old page in place.
import { writeFileSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname, basename } from 'node:path';
import { inspect, options, active, datesMentioned, sessionEndLines, sessionEnd } from './ledger.mjs';
export const RENDERER = 'pm-next v3.1 status view 1';
const args = options(['out', 'date', 'open', 'quiet']);
const root = args.root;
const out = args.out || join(root, 'project', 'view.html');
const say = (line) => { if (!args.quiet || line.startsWith('view: failed')) (line.startsWith('view: failed') ? console.error : console.log)(line); };
const failed = (why) => { say(`view: failed — ${why}; the old page was not replaced`); process.exit(1); };
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
const state = inspect(root, { checkDate: date });
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
const fingerprint = hash.update(RENDERER).digest('hex');

// ---- rendering
const { milestones, decisions, tphases, recall, wish, digests, archives } = state;
const profile = active(state.files.profile);
const openItems = [...state.open.values()];
const needsOwner = openItems.filter((i) => i.mark === '!');
const delegated = (state.signatures || []).filter((s) => s.delegated);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const paras = (t) => String(t || '').trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => /^- /.test(p) ? `<ul>${p.split(/\n(?=- )/).map((l) => `<li>${inline(l.slice(2).replace(/\n\s*/g, ' '))}</li>`).join('')}</ul>` : `<p>${inline(p.replace(/\n\s*/g, ' '))}</p>`).join('');
const title = (profile.match(/^# Profile — (.+)$/m) || [, 'project'])[1];
const markLabel = { ' ': 'open', '~': 'in progress', '!': 'needs the owner' };
const anchor = (id) => `item-${id}`;
const mdBlock = (t) => t.split('\n').map((l) => { let m; if ((m = l.match(/^## (.+)/))) return `<h3>${inline(m[1])}</h3>`; if ((m = l.match(/^- (.+)/))) return `<li>${inline(m[1])}</li>`; if (/^#/.test(l) || !l.trim()) return ''; return `<p>${inline(l)}</p>`; }).join('\n').replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (s) => `<ul>${s}</ul>`);
const meta = (i) => `${i.from ? `<br><span class="meta">from: ${esc(i.from)}</span>` : ''}${i.blocked ? `<br><span class="meta">blocked: ${inline(i.blocked)}</span>` : ''}`;
const agreed = (id) => { const it = state.items.get(id); return it ? `${it.intent ? `<div class="meta">${paras(it.intent)}</div>` : ''}<ul>${it.criteria.map((c) => `<li>${inline(c)}</li>`).join('')}</ul>` : '<p class="meta">No item file is recorded for this item.</p>'; };
const shippedAll = tphases.flatMap((p) => p.lines.map((l) => ({ phase: p.name, line: l, s: [...state.shipped.values()].find((x) => l.startsWith(x.id + ' — ')) })));
const latest = shippedAll.map((x, n) => ({ ...x, n })).filter((x) => x.s).sort((a, b) => b.s.date.localeCompare(a.s.date) || b.n - a.n).slice(0, 4);
const dates = datesMentioned(state.open);
const sections = [['owner', 'Needs the owner'], ['session', 'Last session end'], ['open', 'Open work'], ['latest', 'Latest shipped'], ['dates', 'Dates mentioned'], ['open-agreed', 'What open items must do'], ['decisions', 'Decisions'], ['archives', 'Archived decisions'], ['shipped', 'Shipped, with what each had to do'], ['wish', 'Wish-list'], ['standards', 'Standards adopted'], ['profile', 'Profile']];
const stamp = inGit && !head ? 'A Git checkout with no commit yet.' : head
  ? `Commit <span class="stamp">${head}</span>; ${dirty.length ? `<strong>the ledger had ${dirty.length} uncommitted change(s) when this was built</strong> (${dirty.map((l) => esc(l.slice(3))).join(', ')})` : 'the ledger had no uncommitted changes when this was built'}.`
  : 'Not built in a Git checkout: no commit can be named.';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — status</title>
<style>
:root{--ink:#14181F;--muted:#5A6472;--rule:#D9E0E9;--surface:#fff;--ground:#F6F8FA;--accent:#1F4E8C;--warn:#A8600B;--warn-soft:#FBF0DE;--ok:#1F6B4A;--ok-soft:#E4F3EB}
@media(prefers-color-scheme:dark){:root{--ink:#E8ECF2;--muted:#9BA6B5;--rule:#2A323E;--surface:#171C24;--ground:#10141A;--accent:#7FB0EC;--warn:#E0A44E;--warn-soft:#2E2413;--ok:#63C79A;--ok-soft:#14281E}}
body{margin:0;background:var(--ground);color:var(--ink);font:15px/1.5 system-ui,sans-serif}.wrap{max-width:960px;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.1rem;margin:1.6rem 0 .5rem;border-bottom:1px solid var(--rule);padding-bottom:.25rem}h3{font-size:.95rem;margin:1rem 0 .3rem;color:var(--muted)}
.meta{color:var(--muted);font-size:.85rem}.card{background:var(--surface);border:1px solid var(--rule);border-radius:6px;padding:.8rem 1rem;margin:.5rem 0}
.owner{border-left:3px solid var(--warn);background:var(--warn-soft)}.ok{border-left:3px solid var(--ok);background:var(--ok-soft)}
table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:.4rem .5rem;border-bottom:1px solid var(--rule);vertical-align:top}th{color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.06em}
code{background:var(--ground);border:1px solid var(--rule);border-radius:3px;padding:.05em .3em;font-size:.9em}.id{font-family:ui-monospace,monospace;font-weight:600;white-space:nowrap}
.tag{display:inline-block;font-size:.72rem;padding:.05rem .45rem;border-radius:3px;border:1px solid var(--rule);color:var(--muted)}.tag.owner{border-color:var(--warn);color:var(--warn);background:var(--warn-soft)}
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}nav ul{columns:2 12rem;margin:.3rem 0 0 1.2rem}a{color:var(--accent)}td,li,p{overflow-wrap:anywhere}.stamp{font-family:ui-monospace,monospace;font-size:.8rem;overflow-wrap:anywhere}ul{margin:.3rem 0 .3rem 1.2rem}.tw{overflow-x:auto}
</style></head><body><div class="wrap">
<h1>${esc(title)} — status</h1>
<p class="meta">A snapshot as of its last refresh, never live: refresh it after the ledger changes. ${stamp} Ledger fingerprint <span class="stamp">${fingerprint}</span>, over ${sourcePaths.length} files the checker read. Check date ${date}. ${esc(RENDERER)}. Agents read the source files.</p>
<nav aria-label="Contents"><ul>${sections.map(([id, name]) => `<li><a href="#${id}">${name}</a></li>`).join('')}</ul></nav>
<h2 id="owner">Needs the owner</h2>
${needsOwner.length || delegated.length ? `<div class="card owner"><ul>${needsOwner.map((i) => `<li><a class="id" href="#${anchor(i.id)}">${i.id}</a> — ${inline(i.title)} — since ${i.since}${meta(i)}</li>`).join('')}${delegated.map((s) => `<li>${esc(s.file)} — signed by delegation by ${esc(s.name)} on ${esc(s.date)}, authority: ${esc(s.authority)} — needs the owner's reviewed signature</li>`).join('')}</ul></div>` : `<div class="card ok"><strong>Nothing waits on the owner.</strong></div>`}
<h2 id="session">Last session end</h2>
${!head ? '<p class="meta">No Git history to read.</p>' : !lastEnd ? '<p class="meta">No commit among the latest ' + SEARCH + ' on the first-parent history carries a Session-end line.</p>' : `<div class="card">${lastEnd.end ? `<p>${esc(`Session-end: ${lastEnd.end.status} — next ${lastEnd.end.next} — ${lastEnd.end.reason}`)}</p><p class="meta">Commit <span class="stamp">${lastEnd.hash}</span>; next item ${lastEnd.end.next === 'none' ? 'none' : `<a href="#${anchor(lastEnd.end.next)}">${lastEnd.end.next}</a>`}. History, not an instruction: a session continues only as the record says.</p>` : `<p><strong>The nearest Session-end lines are malformed</strong> in commit <span class="stamp">${lastEnd.hash}</span>:</p><ul>${lastEnd.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`}</div>`}
${recall ? `<div class="card ${recall.score === '8' ? 'ok' : 'owner'}"><strong>Last recall check:</strong> ${recall.score}/8 on ${recall.date} (${recall.mode})</div>` : ''}
${state.warns.length ? `<div class="card owner"><strong>Maintenance warnings</strong><ul>${state.warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
<h2 id="open">Open work</h2>
<p class="meta">State is the line's mark alone; a blocker is shown apart and does not make a line the owner's.</p>
${milestones.map((m) => `<h3>${m.name}</h3>${m.phases.map((p) => `${p.name ? `<div class="meta">${esc(p.name)}</div>` : ''}<div class="tw"><table><tr><th>ID</th><th>Item</th><th>State</th><th>Since</th></tr>${p.items.map((i) => { const it = state.items.get(i.id); return `<tr id="${anchor(i.id)}"><td class="id">${i.id}</td><td>${inline(i.title)}${meta(i)}${it?.now ? `<div class="meta"><strong>Now:</strong>${paras(it.now)}</div>` : ''}${it ? `<br><a class="meta" href="#agreed-${i.id}">what it must do (${it.criteria.length})</a>` : ''}</td><td><span class="tag${i.mark === '!' ? ' owner' : ''}">${markLabel[i.mark]}</span></td><td>${i.since}</td></tr>`; }).join('') || '<tr><td colspan="4" class="meta">none</td></tr>'}</table></div>`).join('')}`).join('')}
<h2 id="latest">Latest shipped</h2>
<ul>${latest.map((x) => `<li><a href="#shipped-${x.s.id}">${inline(x.line)}</a></li>`).join('') || '<li class="meta">nothing yet</li>'}</ul>
<h2 id="dates">Dates mentioned</h2>
<p class="meta">Every date in an open line's title or blocker, oldest first; since dates left out. None of them is called a deadline here.</p>
<div class="tw"><table><tr><th>Date</th><th>ID</th><th>Where</th><th>Clause</th></tr>${dates.map((d) => `<tr><td>${d.date}</td><td class="id"><a href="#${anchor(d.id)}">${d.id}</a></td><td>${d.part}</td><td>${inline(d.clause)}</td></tr>`).join('') || '<tr><td colspan="4" class="meta">none</td></tr>'}</table></div>
<h2 id="open-agreed">What open items must do</h2>
${openItems.filter((i) => state.items.has(i.id)).map((i) => `<div class="card" id="agreed-${i.id}"><strong class="id">${i.id}</strong> — ${inline(i.title)}${agreed(i.id)}</div>`).join('') || '<p class="meta">No open item has a file.</p>'}
<h2 id="decisions">Decisions <span class="meta">(${decisions.length}, newest first)</span></h2>
${decisions.map((d) => `<div class="card"><h3>${inline(d.head)}</h3><p><strong>Decision:</strong> ${inline(d.decision)}</p><p><strong>Rationale:</strong> ${inline(d.rationale)}</p><p class="meta">Supersedes: ${inline(d.supersedes || 'none')}</p></div>`).join('')}
<h2 id="archives">Archived decisions <span class="meta">(${archives.reduce((n, a) => n + a.entries.length, 0)})</span></h2>
${archives.map((a) => `<h3>${esc(a.file)} (${a.entries.length})</h3>${a.entries.map((d) => `<div class="card"><h3>${inline(d.head)}</h3><p><strong>Decision:</strong> ${inline(d.decision)}</p><p><strong>Rationale:</strong> ${inline(d.rationale)}</p><p class="meta">Supersedes: ${inline(d.supersedes)}</p></div>`).join('')}`).join('') || '<p class="meta">none</p>'}
<h2 id="shipped">Shipped, with what each had to do</h2>
${tphases.map((p) => `<h3>${esc(p.name)}</h3>${p.lines.map((l) => { const x = shippedAll.find((y) => y.line === l); return x?.s ? `<div class="card" id="shipped-${x.s.id}"><p>${inline(l)}</p>${agreed(x.s.id)}</div>` : `<div class="card"><p>${inline(l)}</p></div>`; }).join('') || '<p class="meta">nothing yet</p>'}`).join('')}
<h2 id="wish">Wish-list <span class="meta">(${wish.length})</span></h2><ul>${wish.map((l) => `<li>${inline(l)}</li>`).join('') || '<li class="meta">empty</li>'}</ul>
<h2 id="standards">Standards adopted</h2>
<div class="tw"><table><tr><th>Digest</th><th>Standard</th><th>Version</th><th>Retrieved</th><th>Next check</th></tr>${digests.map((d) => `<tr><td class="id">${esc(d.file.replace(/\.md$/, ''))}</td><td>${esc(d.standard)}${d.source ? ` <a href="${esc(d.source)}">source</a>` : ''}</td><td>${esc(d.version)}</td><td>${esc(d.retrieved)}</td><td>${esc(d.next)}</td></tr>`).join('') || '<tr><td colspan="5" class="meta">no digests yet — run intake</td></tr>'}</table></div>
<h2 id="profile">Profile</h2><div class="card">${mdBlock(profile)}</div>
</div></body></html>
`;

// ---- publish: HEAD rechecked, a temporary sibling renamed over the page, then opened only on success
if (readHead() !== head) failed('HEAD moved while the page was built');
const tmp = join(dirname(out), `.${basename(out)}.${process.pid}.tmp`);
try { writeFileSync(tmp, html); renameSync(tmp, out); }
catch (e) { try { rmSync(tmp, { force: true }); } catch {} failed(`cannot write ${out}: ${e.code || e.message}`); }
const openCount = milestones.reduce((n, m) => n + m.phases.reduce((k, p) => k + p.items.length, 0), 0);
say(`view: wrote ${out} (${openCount} open items, ${decisions.length} decisions, ${digests.length} digests${needsOwner.length ? `, ${needsOwner.length} need the owner` : ''}${delegated.length ? `, ${delegated.length} delegated signatures` : ''}; ${head ? `commit ${head.slice(0, 12)}${dirty.length ? ', uncommitted ledger changes' : ''}` : 'no commit'})`);
if (args.open) {
  const opener = process.env.PM_NEXT_VIEW_OPENER || (process.platform === 'darwin' ? 'open' : 'xdg-open');
  const r = spawnSync(opener, [out], { stdio: 'ignore' });
  if (r.status !== 0) { console.error(`view: the page was written but ${opener} could not open it`); process.exit(1); }
}
