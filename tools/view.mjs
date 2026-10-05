#!/usr/bin/env node
// pm-next-v2 view generator. Zero dependencies. usage: node tools/view.mjs [--root <dir>] [--out project/view.html]
// Humans read this; agents read the source. Static, opens locally, no network.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inspect, options, active } from './ledger.mjs';
const args = options(['out']);
const root = args.root;
const out = args.out || join(root, 'project', 'view.html');
const state = inspect(root);
if (state.fails.length) {
  console.error(state.fails.map((m) => `FAIL  ${m}`).join('\n'));
  console.error('view: source is invalid; existing output was not replaced');
  process.exit(1);
}
const { milestones, decisions, tphases, recall, wish, digests, archives } = state;
const profile = active(state.files.profile);
const needsOwner = [...state.open.values()].filter((i) => i.mark === '!');
const delegated = (state.signatures || []).filter((s) => s.delegated);
const itemFile = (id) => state.items.get(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const title = (profile.match(/^# Profile — (.+)$/m) || [, 'project'])[1];
const markLabel = { ' ': 'open', '~': 'in progress', '!': 'needs the owner' };
const mdBlock = (t) => t.split('\n').map((l) => { let m; if ((m = l.match(/^## (.+)/))) return `<h3>${inline(m[1])}</h3>`; if ((m = l.match(/^- (.+)/))) return `<li>${inline(m[1])}</li>`; if (/^#/.test(l) || !l.trim()) return ''; return `<p>${inline(l)}</p>`; }).join('\n').replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (s) => `<ul>${s}</ul>`);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — ledger</title>
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
:focus-visible{outline:3px solid var(--accent);outline-offset:3px}details summary{min-height:44px;display:list-item;cursor:pointer;color:var(--accent)}ul{margin:.3rem 0 .3rem 1.2rem}.tw{overflow-x:auto}
</style></head><body><div class="wrap">
<h1>${esc(title)}</h1><div class="meta">Snapshot generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from <code>project/</code>. Regenerate after ledger changes. Agents read the source files.</div>
${needsOwner.length || delegated.length ? `<div class="card owner"><strong>Needs the owner</strong><ul>${needsOwner.map((i) => `<li><span class="id">${i.id}</span> — ${inline(i.title)}${i.from ? `<br><span class="meta">from: ${esc(i.from)}</span>` : ''}${i.blocked ? ` <span class="tag">blocked: ${esc(i.blocked)}</span>` : ''}</li>`).join('')}${delegated.map((s) => `<li>${esc(s.file)} — signed by delegation by ${esc(s.name)} on ${esc(s.date)}, authority: ${esc(s.authority)} — needs the owner's reviewed signature</li>`).join('')}</ul></div>` : `<div class="card ok"><strong>Nothing waits on the owner.</strong></div>`}
${recall ? `<div class="card ${recall.score === '8' ? 'ok' : 'owner'}"><strong>Last recall check:</strong> ${recall.score}/8 on ${recall.date} (${recall.mode})</div>` : ''}
${state.warns.length ? `<div class="card owner"><strong>Maintenance warnings</strong><ul>${state.warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
<h2>Open work</h2>
${milestones.map((m) => `<h3>${m.name}</h3>${m.phases.map((p) => `${p.name ? `<div class="meta">${esc(p.name)}</div>` : ''}<div class="tw"><table><tr><th>ID</th><th>Item</th><th>State</th><th>Since</th></tr>${p.items.map((i) => { const it = itemFile(i.id); return `<tr><td class="id">${i.id}</td><td>${inline(i.title)}${i.from ? `<br><span class="meta">from: ${esc(i.from)}</span>` : ''}${i.blocked ? `<br><span class="tag">blocked: ${esc(i.blocked)}</span>` : ''}${it ? `<details><summary>criteria (${it.criteria.length})</summary>${it.intent ? `<p class="meta">${inline(it.intent)}</p>` : ''}<ul>${it.criteria.map((c) => `<li>${inline(c)}</li>`).join('')}</ul></details>` : ''}</td><td><span class="tag${i.mark === '!' ? ' owner' : ''}">${markLabel[i.mark]}</span></td><td>${i.since}</td></tr>`; }).join('') || '<tr><td colspan="4" class="meta">none</td></tr>'}</table></div>`).join('')}`).join('')}
<h2>Decisions <span class="meta">(${decisions.length}, newest first)</span></h2>
${decisions.map((d) => `<details><summary>${inline(d.head)}</summary><div class="card"><p><strong>Decision:</strong> ${inline(d.decision)}</p><p><strong>Rationale:</strong> ${inline(d.rationale)}</p><p class="meta">Supersedes: ${inline(d.supersedes || 'none')}</p></div></details>`).join('')}
<h2>Archived decisions <span class="meta">(${archives.reduce((n, a) => n + a.entries.length, 0)})</span></h2>
${archives.map((a) => `<details><summary>${esc(a.file)} (${a.entries.length})</summary>${a.entries.map((d) => `<details class="card"><summary>${inline(d.head)}</summary><p><strong>Decision:</strong> ${inline(d.decision)}</p><p><strong>Rationale:</strong> ${inline(d.rationale)}</p><p>Supersedes: ${inline(d.supersedes)}</p></details>`).join('')}</details>`).join('') || '<p class="meta">none</p>'}
<h2>Shipped</h2>
${tphases.map((p) => `<h3>${esc(p.name)}</h3><ul>${p.lines.map((l) => `<li>${inline(l)}</li>`).join('') || '<li class="meta">nothing yet</li>'}</ul>`).join('')}
<h2>Wish-list <span class="meta">(${wish.length})</span></h2><ul>${wish.map((l) => `<li>${inline(l)}</li>`).join('') || '<li class="meta">empty</li>'}</ul>
<h2>Standards adopted</h2>
<div class="tw"><table><tr><th>Digest</th><th>Standard</th><th>Version</th><th>Retrieved</th><th>Next check</th></tr>${digests.map((d) => `<tr><td class="id">${esc(d.file.replace(/\.md$/, ''))}</td><td>${esc(d.standard)}${d.source ? ` <a href="${esc(d.source)}">source</a>` : ''}</td><td>${esc(d.version)}</td><td>${esc(d.retrieved)}</td><td>${esc(d.next)}</td></tr>`).join('') || '<tr><td colspan="5" class="meta">no digests yet — run intake</td></tr>'}</table></div>
<h2>Profile</h2><div class="card">${mdBlock(profile)}</div>
</div></body></html>`;
writeFileSync(out, html);
console.log(`view: wrote ${out} (${milestones.reduce((n, m) => n + m.phases.reduce((k, p) => k + p.items.length, 0), 0)} open items, ${decisions.length} decisions, ${digests.length} digests${needsOwner.length ? `, ${needsOwner.length} need the owner` : ''}${delegated.length ? `, ${delegated.length} delegated signatures` : ''})`);
