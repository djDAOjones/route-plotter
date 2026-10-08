// UI-06 static contrast check — WCAG 2.x relative luminance / contrast ratio.
// Pairs are the token/colour pairs actually used by styles/*.css and the
// exported player template (src/services/HTMLExportService.js). Alpha
// colours are composited over the stated backdrop first.
const hex = (h) => {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (fg, bg) => { const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const over = (fg, alpha, bg) => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
const toHex = (rgb) => '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();

const T = {
  text01: '#0F0F0F', text02: '#3A3A3A', text03: '#595959', text04: '#FFFFFF', disabled03: '#8D8D8D',
  ui00: '#FFFFFF', ui01: '#FBFBFB', ui02: '#F4F4F4', ui03: '#EAEAEA', ui05: '#10263B', cap: '#E5E5E5',
  hover: '#E9E9E9', selected: '#E0E0E0', rowSel: '#EDEDED', canvasArea: '#FAFAFA',
  uonBlue: '#003A65', activePrimary: '#0C1C2C', paramTip: '#161616', focus: '#0F62FE',
  error: '#B91C2E', errorBg: '#F1D2D5', warnBg: '#FEE6CE', warnStrong: '#D06A05', link: '#10263B', visited: '#792D85',
  borderInteractive: '#767676', borderSubtle: '#D8D8D8', borderStrongest: '#5A5A5A', icon02: '#595959',
  scopeWpBg: '#FBF1E8', scopeWpFg: '#79380A', scopeRtBg: '#EAF2F8', scopeRtFg: '#1D4E75', scopeCrBg: '#E7F2EE', scopeCrFg: '#0E4A38',
  mapWhite: '#FFFFFF', mapYellow: '#F0E442',
  playerText2: '#525252', playerText1: '#161616', playerSurf2: '#F4F4F4',
};
const rows = [];
const add = (where, fg, bg, size, note = '') => rows.push({ where, fg: toHex(fg), bg: toHex(bg), r: ratio(fg, bg), size, note });
const H = (k) => hex(T[k]);

// --- Body / labels / readouts (14px or 12px, normal weight unless noted) ---
add('body text --text-01 on --ui-00', H('text01'), H('ui00'), '14px');
add('body text --text-01 on --ui-02 (section content)', H('text01'), H('ui02'), '14px');
add('.section-title --text-01 on --cap-system', H('text01'), H('cap'), '12px 600 caps');
add('.section-title on --cap-last (rgba(15,98,254,.08) over #F4F4F4)', H('text01'), over(H('focus'), 0.08, H('ui02')), '12px 600 caps');
add('card label span:first-child --text-02 on --ui-02', H('text02'), H('ui02'), '12px 500');
add('readout span:last-child --text-02 on --ui-02', H('text02'), H('ui02'), '14px mono 500');
add('.section-hint --text-02 on --ui-02', H('text02'), H('ui02'), '12px');
add('.mode-label --text-02 on --ui-02', H('text02'), H('ui02'), '14px 500');
add('.time (playbar) --text-02 on --ui-01', H('text02'), H('ui01'), '14px mono');
add('.modal-content p --text-02 on --ui-02', H('text02'), H('ui02'), '14px');
add('.waypoint-minor-tag --text-02 on --ui-02', H('text02'), H('ui02'), '12px');
add('.swatch-legend --text-02 on --ui-02', H('text02'), H('ui02'), '12px 500');

// --- --text-03 usages (the 7.0:1-on-white token) ---
add('.dropdown-submenu-label --text-03 on --ui-00', H('text03'), H('ui00'), '12px 600 caps');
add('.control-row-inline > span:last-child (#camera-zoom-value, This Zoom readout) --text-03 on --tint-camera #F4F4F4', H('text03'), H('ui02'), '12px');
add('.slider-value-readonly (Prev/Next Zoom) --text-03 italic on #F4F4F4', H('text03'), H('ui02'), '12px italic');
add('.waypoint-list-empty .hint --text-03 on .waypoint-list --ui-02', H('text03'), H('ui02'), '12px');
add('.waypoint-move-btn glyph ▲▼ --icon-02 on --ui-01 (icon-like, 8px font)', H('icon02'), H('ui01'), '8px glyph');
add('.waypoint-delete × --icon-02 on --ui-01 (icon-like)', H('icon02'), H('ui01'), '20px glyph');
add('.section-chevron --icon-02 on --cap-system (icon)', H('icon02'), H('cap'), 'icon');

// --- opacity-faded text ---
add('.dropdown-item kbd ⌘S: --text-02 @0.7 over (kbd bg #F4F4F4 @0.7 over menu #FFF)', over(H('text02'), 0.7, over(H('ui02'), 0.7, H('ui00'))), over(H('ui02'), 0.7, H('ui00')), '11px mono 500');
add('#marker-filename inline opacity:.7 (--text-01 over #F4F4F4)', over(H('text01'), 0.7, H('ui02')), H('ui02'), '12px');
add('.layer-item.layer-hidden .layer-title opacity:.45 (--text-01 over --ui-01)', over(H('text01'), 0.45, H('ui01')), H('ui01'), '14px');
add('.layer-item.layer-hidden.selected .layer-title opacity:.45 over --selected-ui', over(H('text01'), 0.45, H('selected')), H('selected'), '14px 600');
add('.scope-route-btn:disabled opacity:.55 (route chip fg over bg) — disabled, exempt', over(H('scopeRtFg'), 0.55, H('scopeRtBg')), H('scopeRtBg'), '12px 600');
add('.scope-route-btn:disabled opacity:.55 on waypoint chip — disabled, exempt', over(H('scopeRtFg'), 0.55, H('scopeWpBg')), H('scopeWpBg'), '12px 600');
add('.toast-dismiss × opacity:.7 (white over --ui-05)', over(H('text04'), 0.7, H('ui05')), H('ui05'), '14px glyph');
add('.btn:disabled --disabled-03 on --disabled-01 (export progress text "Exporting... 42%" lives here)', H('disabled03'), H('ui02'), '14px 600');
add('.dropdown-menu [role=menuitem]:disabled --disabled-03 on --ui-00 — disabled, exempt', H('disabled03'), H('ui00'), '14px');

// --- inverse / chips / danger / links ---
add('.btn-primary --text-04 on --uon-blue', H('text04'), H('uonBlue'), '14px 600');
add('.toast / .tooltip --text-04 on --ui-05', H('text04'), H('ui05'), '12px');
add('.param-tooltip #fff on #161616', H('text04'), H('paramTip'), '12px');
add('PREVIEW badge white on --interactive-01 @0.9 over #FAFAFA', H('text04'), over(H('uonBlue'), 0.9, H('canvasArea')), '12px 600 caps');
add('.scope-chip waypoint fg/bg', H('scopeWpFg'), H('scopeWpBg'), '12px 600');
add('.scope-chip route fg/bg', H('scopeRtFg'), H('scopeRtBg'), '12px 600');
add('.scope-chip crowd fg/bg', H('scopeCrFg'), H('scopeCrBg'), '12px 600');
add('.dropdown-item-danger / .context-menu-item.is-danger --support-error on --ui-00', H('error'), H('ui00'), '14px');
add('.dropdown-item-danger:hover --support-error on --support-error-bg', H('error'), H('errorBg'), '14px');
add('.btn-danger:hover --support-error on --support-error-bg', H('error'), H('errorBg'), '14px 600');
add('.context-menu-item.is-danger:hover --support-error on --hover-ui', H('error'), H('hover'), '14px');
add('a --link-01 on --ui-02 (modal)', H('link'), H('ui02'), '14px');
add('a --link-01 on --support-warning-bg (diagnostics public warning)', H('link'), H('warnBg'), '14px');
add('a:visited --link-visited on --ui-02', H('visited'), H('ui02'), '14px');
add('a:visited --link-visited on --support-warning-bg', H('visited'), H('warnBg'), '14px');
add('.unrestored-notice --text-01 on --support-warning-bg', H('text01'), H('warnBg'), '12px');
add('.control-warning --text-01 on --support-error-bg', H('text01'), H('errorBg'), '12px');

// --- non-text (3:1): focus, borders, swatch chips ---
add('[non-text] focus ring --focus-outer on --ui-00', H('focus'), H('ui00'), '3:1 rule');
add('[non-text] focus ring --focus-outer on --ui-02', H('focus'), H('ui02'), '3:1 rule');
add('[non-text] focus ring --focus-outer on --cap-system', H('focus'), H('cap'), '3:1 rule');
add('[non-text] --border-interactive on --ui-02 (select/slider rail)', H('borderInteractive'), H('ui02'), '3:1 rule');
add('[non-text] .swatch-chip border rgba(0,0,0,.18) over #F4F4F4 (only boundary of the white chip)', over(hex('#000000'), 0.18, H('ui02')), H('ui02'), '3:1 rule');
add('[non-text] white swatch chip #FFFFFF on --ui-02 (no border counted)', H('mapWhite'), H('ui02'), '3:1 rule');
add('[non-text] yellow swatch chip #F0E442 on --ui-02', H('mapYellow'), H('ui02'), '3:1 rule');
add('[non-text] .waypoint-color-dot border --border-subtle on --ui-01 (white marker dot)', H('borderSubtle'), H('ui01'), '3:1 rule');
add('[non-text] .param-hint-glyph border --border-strongest on --ui-02', H('borderStrongest'), H('ui02'), '3:1 rule');

// --- exported player (HTMLExportService template) ---
add('[player] .scene-summary --text-secondary #525252 on #fff', H('playerText2'), hex('#FFFFFF'), '13px');
add('[player] .time-display #525252 on .controls --surface-secondary #f4f4f4', H('playerText2'), H('playerSurf2'), '13px');
add('[player] .btn-secondary #161616 on #fff', H('playerText1'), hex('#FFFFFF'), '14px');
add('[player] .btn-primary #fff on --uon-blue', hex('#FFFFFF'), H('uonBlue'), '14px');
add('[player] label text #161616 on #f4f4f4', H('playerText1'), H('playerSurf2'), '13px');

const fmt = (r) => r.toFixed(2);
console.log('| where | fg | bg | ratio | size | verdict |');
console.log('|---|---|---|---|---|---|');
for (const row of rows) {
  const nonText = row.where.startsWith('[non-text]');
  const large = /(^|\s)(24px|19px bold|18\.66px)/.test(row.size);
  const need = nonText ? 3 : (large ? 4.5 : 7);
  const exempt = /exempt/.test(row.where);
  const verdict = row.r >= need ? 'pass' : (exempt ? 'below (exempt)' : `FAIL <${need}:1`);
  console.log(`| ${row.where} | ${row.fg} | ${row.bg} | ${fmt(row.r)}:1 | ${row.size} | ${verdict} |`);
}
