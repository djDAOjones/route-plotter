#!/usr/bin/env node
// pm-next-v3 harness configuration generator. Zero dependencies.
// usage: node tools/harness.mjs [--root <dir>] [--harness claude,codex] [--print] [--force] [--hooks-only]
//
// Writes, for every harness the profile names, the settings the profile's Push and Network lines ask for (sessions) and a
// second set with the network open for the intake verb only, each carrying the two session hooks of specification 3.15:
// the compaction hook (SessionStart, source compact) and the sensor (PostToolUse and the other SessionStart sources), both
// `tools/session.mjs`. `--hooks-only` merges the hooks alone into the existing settings, unrelated settings preserved, for a
// project that keeps its own permissions. Two facts learned the hard way, still encoded:
//   * A Codex prefix rule in a rules file is NOT a network control — a compound command walks straight past it. Only
//     [permissions.<profile>.network] closes the network.
//   * Codex >=0.134 layers a named profile over user config; trusted project config can override it.
// Where a harness cannot enforce a value, the line is an instruction and the generated file says so. The owner reviews
// everything this writes; a generated file is not an enforcement test.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { options, field, pushRoute, networkChoice } from './ledger.mjs';

const args = options(['harness', 'print', 'force', 'hooks-only']);
const root = args.root, print = args.print, force = args.force, hooksOnly = args['hooks-only'];
const git = (...a) => { try { return execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const prefix = git('rev-parse', '--show-prefix'); // an adapter below the repository root owns its installation root
const hooksRoot = hooksOnly && prefix ? git('rev-parse', '--show-toplevel') || root : root;
const hookPath = (rel) => hooksRoot === root ? rel : join(hooksRoot, rel); // name the repository-level destination in notes
const profilePath = join(root, 'project', 'profile.md');
const profile = existsSync(profilePath) ? readFileSync(profilePath, 'utf8') : '';

// ---- which harnesses
let names = (args.harness || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!names.length) {
  const line = field(profile, 'Harness');
  if (/claude/i.test(line)) names.push('claude');
  if (/codex/i.test(line)) names.push('codex');
}
if (!names.length || names.some((n) => !['claude', 'codex'].includes(n))) {
  console.error('harness: name the harnesses — `--harness claude,codex`, or fill the profile\'s Harness line.');
  process.exit(2);
}
names = [...new Set(names)];

// ---- the profile's Push and Network lines (3.5): the same grammar as the checker; nothing defaulted
const pushLine = field(profile, 'Push'), networkLine = field(profile, 'Network');
const route = pushRoute(pushLine), choice = networkChoice(networkLine);
if (!route || !choice) { console.error('harness: the profile needs a Push line (the harness pushes to origin or a named host, or owner-operated) and a Network line (closed, listed hosts with host names, or open); neither is defaulted.'); process.exit(2); }
const harnessPush = route === 'harness', network = choice.kind, hosts = choice.hosts;
const sessionLine = field(profile, 'Session') || '200k tokens of context';
const pushNote = harnessPush
  ? `Push: ${pushLine} — git push is allowed and runs at every close${network === 'closed' ? '; the Network line is closed, so the push host is unreachable here and each close reports a pending push until Network lists it' : network === 'listed' ? '; the listed hosts must include the push host' : ''}.`
  : `Push: ${pushLine} — the owner pushes from outside; Claude Code denies git push in sessions, Codex has no push control, so there the line is an instruction only.`;
const networkNote = { closed: 'Network: closed — shell network denied where the client enforces it.', listed: `Network: listed hosts ${hosts.join(', ')} — allowed where the client enforces a host list; where it cannot, this is an instruction and the value degrades to open.`, open: 'Network: open.' }[network];
const hooksNote = `Session hooks (3.15): SessionStart(compact) adds the re-read and session-end notice; tools/session.mjs on PostToolUse and the other SessionStart sources watches this session's context against the profile's Session line (${sessionLine}). They force nothing and cannot show that a re-read happened; where the client does not run them, or denies them the transcript, the Session line is an instruction only.`;

const H = homedir();
const slug = (basename(root) || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
// Directories no session should read or write, whichever harness is running. The sensor reads the transcript the hook names
// as the harness's own process, outside this sandbox; nothing here is weakened for it.
const secretDirs = [`${H}/.ssh`, `${H}/.aws`, `${H}/.gnupg`, `${H}/.config/gcloud`, `${H}/.claude`, `${H}/.codex`, `${H}/.npmrc`];
const badPrefixes = ['curl', 'wget', 'gh', 'git clone', 'git fetch', 'git pull', ...(harnessPush ? [] : ['git push']), 'npx -y', 'npx --yes', 'pip install', 'brew'];
const out = {}, merged = {}, notes = [];
const SENSOR = 'tools/session.mjs';
const OURS = /tools[\\/]session\.mjs['"]? --harness (claude|codex)\b/;
const hook = (command) => ({ type: 'command', command, timeout: 5 });
const hookSet = (command, sources) => ({
  SessionStart: [{ matcher: 'compact', hooks: [hook(command)] }, { matcher: sources, hooks: [hook(command)] }],
  PostToolUse: [{ hooks: [hook(command)] }],
});
// Merge our hook entries into an existing hooks object, replacing only entries that run the sensor; unrelated hooks stay.
const mergeHooks = (existing = {}, ours) => {
  const result = { ...existing };
  for (const [event, groups] of Object.entries(ours)) {
    const kept = (existing[event] || []).map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !(typeof h.command === 'string' && OURS.test(h.command))) })).filter((g) => g.hooks.length);
    result[event] = [...kept, ...groups];
  }
  return result;
};
// The hook set as TOML arrays of tables, for the Codex profile.
const toml = (set) => Object.entries(set).map(([event, groups]) => groups.map((g) => `[[hooks.${event}]]\n${g.matcher ? `matcher = ${JSON.stringify(g.matcher)}\n` : ''}${g.hooks.map((k) => `[[hooks.${event}.hooks]]\ntype = "command"\ncommand = ${JSON.stringify(k.command)}\ntimeout = ${k.timeout}\n`).join('')}`).join('\n')).join('\n');
const readJson = (rel) => {
  if (!existsSync(join(hooksRoot, rel))) return null;
  try { return JSON.parse(readFileSync(join(hooksRoot, rel), 'utf8')); } catch { console.error(`harness: ${hookPath(rel)} exists but is not valid JSON; repair it first. Nothing written.`); process.exit(1); }
};

if (names.includes('claude')) {
  const claudeHooks = hookSet(`node "\${CLAUDE_PROJECT_DIR}/${prefix}${SENSOR}" --harness claude`, 'startup|resume|clear|fork');
  const deny = [
    ...(network === 'open' ? [] : ['WebFetch', 'WebSearch']), 'RemoteTrigger', 'EnterWorktree', 'ExitWorktree',
    'CronCreate', 'CronDelete', 'CronList', 'ScheduleWakeup', 'SendMessage', 'Workflow', 'ReportFindings',
    ...badPrefixes.map((p) => `Bash(${p} *)`),
    ...secretDirs.flatMap((d) => [`Read(//${d.replace(/^\//, '')}/**)`, `Edit(//${d.replace(/^\//, '')}/**)`, `Write(//${d.replace(/^\//, '')}/**)`]),
  ];
  const sessions = {
    permissions: { deny },
    autoMemoryEnabled: false,
    sandbox: {
      enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: false,
      filesystem: { denyRead: secretDirs, denyWrite: secretDirs },
      network: network === 'open' ? { allowedDomains: ['*'], strictAllowlist: false } : { allowedDomains: hosts, strictAllowlist: true },
      // the documented shape: entries with a name and a mode; v2 wrote an object keyed by deny, which Claude Code rejected along with the whole file
      credentials: { envVars: ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN', 'AWS_SECRET_ACCESS_KEY'].map((name) => ({ name, mode: 'deny' })) },
    },
    hooks: claudeHooks,
    _pm_next_v3: `Sessions. ${pushNote} ${networkNote} Cloud-session and scheduling tools denied; secret directories unreadable; the harness's own auto-memory off (this ledger is the record). ${hooksNote} Claude Code loads these hooks from .claude/settings.json; the desktop app applied no generated setting in the exposed week, so verify in the client. Generated by tools/harness.mjs — review, then commit. Claude Code reads CLAUDE.md, which imports AGENTS.md.`,
  };
  const intake = JSON.parse(JSON.stringify(sessions));
  intake.permissions.deny = deny.filter((d) => d !== 'WebFetch' && d !== 'WebSearch');
  intake.sandbox.network = { allowedDomains: ['*'], strictAllowlist: false };
  intake._pm_next_v3 = `INTAKE ONLY: the network is open so official sources can be read for digests, whatever the Network line says for sessions. Run \`claude --settings .claude/settings.intake.json\`, with the owner present. Ordinary sessions use settings.json. ${hooksNote} Claude Code merges hooks from every settings file it loads, so with the project settings present each hook runs twice in intake; the sensor's state makes the second threshold notice silent, and the compaction notice repeats.`;
  if (hooksOnly) {
    const existing = readJson('.claude/settings.json') || {};
    merged['.claude/settings.json'] = JSON.stringify({ ...existing, hooks: mergeHooks(existing.hooks, claudeHooks) }, null, 2) + '\n';
    notes.push(`claude   hooks merged into ${hookPath('.claude/settings.json')} (existing settings kept); Claude Code loads them from there in every session`);
  } else {
    out['.claude/settings.json'] = JSON.stringify(sessions, null, 2) + '\n';
    out['.claude/settings.intake.json'] = JSON.stringify(intake, null, 2) + '\n';
    notes.push(`claude   sessions: default (.claude/settings.json is picked up automatically)\n         intake:   claude --settings .claude/settings.intake.json`);
  }
}

if (names.includes('codex')) {
  const quoted = `'${join(root, SENSOR).replace(/'/g, `'"'"'`)}'`; // the hook's cwd may be a subdirectory: an absolute, shell-quoted path
  const codexHooks = hookSet(`node ${quoted} --harness codex`, 'startup|resume|clear');
  const fsDeny = secretDirs.map((d) => `${JSON.stringify(d)} = "deny"`).join('\n');
  const domains = hosts.map((h) => `${JSON.stringify(h)} = "allow"`).join('\n');
  const body = (name, net) => `# pm-next-v3 — Codex settings for ${slug}${net ? ' (INTAKE: network open)' : ''}.
# Generated by tools/harness.mjs; review, then install:
#   cp harness/codex/${name}.config.toml "\${CODEX_HOME:-$HOME/.codex}/${name}.config.toml"
# and run with:  codex -p ${name}
# Codex >=0.134: -p layers this file over user config. Trusted project config may override it.
# ${net ? 'Intake: the network is open, whatever the Network line says for sessions.' : `${pushNote} ${networkNote}`}
# ${hooksNote}
# These hooks ride this profile; a project's own hooks file (written by --hooks-only) loads only when its .codex layer is
# trusted. Codex runs a hook only once it has recorded trust in that hook's hash (/hooks); review any other hook trusted there. --dangerously-bypass-hook-trust is for automation
# that already vets its hook sources. Hooks run as Codex's own process, outside the sandbox below.
# Review effective permissions on the installed client; a generated file is not an enforcement test.
approval_policy = "never"
default_permissions = "${name}"
web_search = ${net || network === 'open' ? '"live"' : '"disabled"'}

[features]
memories = false          # this ledger is the record, not the harness's memory
apps = false              # ChatGPT connector apps (GitHub write, site deploys) are ON by default
browser_use = false
browser_use_external = false
computer_use = false
in_app_browser = false
image_generation = false
hooks = true              # the two session hooks in .codex/hooks.json (3.15)

[permissions.${name}]
extends = ":workspace"

[permissions.${name}.filesystem]
${fsDeny}

[permissions.${name}.network]
enabled = ${net || network !== 'closed' ? 'true' : 'false'}${net ? '            # intake only, owner present' : network === 'closed' ? '           # sessions: closed. Installs happen in intake, or by the owner.' : network === 'listed' ? '            # listed hosts below; a client without domain rules treats this as open' : '            # open'}
${!net && network === 'listed' ? `\n[permissions.${name}.network.domains]\n${domains}\n` : ''}
# Prefix-rule syntax belongs in .rules files, never TOML. Network permissions are the control.

# The two session hooks (3.15), carried by this profile so that no project layer need be trusted for them; a project
# that keeps its own permissions installs them with --hooks-only into the project's Codex hooks file instead. Headless: codex exec
# runs them only with recorded trust or --dangerously-bypass-hook-trust.
${toml(codexHooks)}`;
  if (hooksOnly) {
    const existing = readJson('.codex/hooks.json') || {};
    merged['.codex/hooks.json'] = JSON.stringify({ ...existing, hooks: mergeHooks(existing.hooks, codexHooks) }, null, 2) + '\n';
    notes.push(`codex    hooks merged into ${hookPath('.codex/hooks.json')} (existing hooks kept); set \`hooks = true\` under [features] in the profile you run, trust this project's .codex layer, then trust each hook in /hooks`);
  } else {
    out[`harness/codex/${slug}.config.toml`] = body(slug, false);
    out[`harness/codex/${slug}-intake.config.toml`] = body(`${slug}-intake`, true);
    notes.push(`codex    sessions: codex -p ${slug}\n         intake:   codex -p ${slug}-intake   (after copying both files into $CODEX_HOME; the profiles carry the two hooks — trust them in /hooks)`);
  }
}

// Preflight the whole output set. A conflict never leaves a mixed configuration; merged hook files replace by design.
const conflicts = Object.entries(out).filter(([rel, body]) => existsSync(join(root, rel)) && readFileSync(join(root, rel), 'utf8') !== body);
if (!print && !force && conflicts.length) {
  console.error(`harness: existing files differ: ${conflicts.map(([rel]) => rel).join(', ')}; review the diff, then use --force if intended. Nothing written.`);
  process.exit(1);
}
for (const [rel, body] of Object.entries({ ...out, ...merged })) {
  if (print) { console.log(`--- ${hookPath(rel)} ---\n${body}`); continue; }
  const p = join(hooksRoot, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  if (!existsSync(p) || readFileSync(p, 'utf8') !== body) writeFileSync(p, body);
  console.log(`harness: ready ${hookPath(rel)}${merged[rel] ? ' (merged)' : ''}`);
}
console.log(`\nhow to run (${names.join(' + ')}):\n${notes.join('\n')}`);
if (names.length > 1) {
  console.log(`
both harnesses on one folder: the record is the handoff — one plans, the other executes from the backlog line and its
item file; one writer per checkout at a time, a second session in its own clone or worktree. State that split on the
profile's Handoff line.`);
}
console.log(`\nheadless forms (3.15): Claude Code loads a project's own settings only once the workspace is trusted, so a runner passes
the generated file by \`claude -p --settings <a copy outside the project>\`; Codex skips an untrusted project layer, so a
runner passes the profile's [hooks] table by \`-c\` or installs the profile, and runs hooks only with recorded trust or
--dangerously-bypass-hook-trust. The desktop app applied no generated setting in the exposed week; verify in each client.`);
console.log(`\nreview before use: these files are proposed settings, not evidence of effective isolation. Verify the client version,
merged config, sandbox availability, inherited tools, plugins and local network needs. ${pushNote} ${networkNote}
${hooksNote} Review the deny lists, the secret directories, and any sibling checkout in the parent folder
that this project's sessions must not read (add it to denyRead / filesystem deny).`);
