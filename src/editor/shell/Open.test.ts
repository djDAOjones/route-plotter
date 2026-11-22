// CORE-05, stage 6: what Open's control and notice draw (react-dom/server, no page; brief 75, ruling 3), each drawn
// from a real opener's state: at rest, while a file is read (a file the test settles by hand), and with a refusal held,
// io's own. A click, a choice, Close and focus are the page's to prove.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { openProject } from '../../adapters/io/open';
import { newScene, type IdSource } from '../../core/model/scene';
import { createStore } from '../store/store';
import { createOpener, OPEN_WORDS } from './openLogic';
import { OpenButton, OpenNotice } from './Open';

function counter(prefix: string): IdSource {
  let n = 0;
  return () => `${prefix}-${String((n += 1))}`;
}

/** As react-dom/server escapes text. */
const asText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const NOT_A_FILE = Uint8Array.of(1, 2, 3, 4);

/** A real opener on an empty store; its decoder is never reached (no file here is a project). */
function openerOf() {
  const store = createStore({ project: { scene: newScene(counter('s')), images: [] }, nextId: counter('n') });
  return createOpener({ store, announce: () => undefined, decode: () => Promise.reject(new Error('not reached')) });
}

/** A file whose read never settles: the opener stays opening. */
const stillReading = (name: string) => ({ name, size: 4, arrayBuffer: () => new Promise<ArrayBuffer>(() => undefined) });
/** A file of `bytes`, read at once. */
const fileOf = (name: string, bytes: Uint8Array) => ({ name, size: bytes.byteLength, arrayBuffer: () => Promise.resolve(bytes.slice().buffer) });

const notice = (opener: ReturnType<typeof openerOf>) => renderToStaticMarkup(createElement(OpenNotice, { opener }));
const count = (html: string, pattern: RegExp) => html.match(pattern)?.length ?? 0;

describe('OpenNotice, as it draws', () => {
  it('at rest draws nothing at all', () => {
    expect(notice(openerOf())).toBe('');
  });

  it('while a file is read: one line “Opening <name>…” in a polite live region; no alert, no button', () => {
    const opener = openerOf();
    void opener.openFile(stillReading('walk.zip'));
    const html = notice(opener);
    expect(html).toMatch(/^<div class="cds--inline-loading" aria-live="polite">/);
    expect(html).toContain(`<div class="cds--inline-loading__text">${OPEN_WORDS.opening('walk.zip')}</div>`);
    expect(OPEN_WORDS.opening('walk.zip')).toBe('Opening walk.zip…');
    expect(html).not.toMatch(/role="alert"|<button/);
  });

  it('with a refusal held: one alert, its title “Could not open <name>”, io’s message whole, one button “Close”', async () => {
    const opener = openerOf();
    const result = await opener.openFile(fileOf('walk.zip', NOT_A_FILE));
    const io = await openProject(NOT_A_FILE, () => Promise.reject(new Error('not reached')));
    if (result.kind !== 'refused' || io.ok) throw new Error('refused expected');
    expect(result.refusal.message).toBe(io.refusal.message);
    const html = notice(opener);
    expect(count(html, /role="alert"/g)).toBe(1);
    expect(html).toMatch(/^<div role="alert" class="cds--inline-notification cds--inline-notification--error">/);
    expect(html).toContain(`<div class="cds--inline-notification__title" dir="auto">${OPEN_WORDS.refused('walk.zip')}</div>`);
    expect(OPEN_WORDS.refused('walk.zip')).toBe('Could not open walk.zip');
    expect(html).toContain(`<div class="cds--inline-notification__subtitle" dir="auto">${asText(io.refusal.message)}</div>`);
    expect(count(html, /<button/g)).toBe(1);
    expect(html).toMatch(/<button type="button" aria-label="Close" title="Close" class="cds--inline-notification__close-button">/);
    expect(html).not.toMatch(/inline-loading|aria-live/);
  });

  it('a refusal with no name (an open of bytes) is titled “Could not open the file”', async () => {
    const opener = openerOf();
    await opener.open(NOT_A_FILE);
    expect(notice(opener)).toContain(`>${OPEN_WORDS.refusedNoName}</div>`);
    expect(OPEN_WORDS.refusedNoName).toBe('Could not open the file');
  });

  it('a name holding < and & is drawn as text, in the line and in the title', async () => {
    const odd = '<b>walk</b> & "co".zip';
    const reading = openerOf();
    void reading.openFile(stillReading(odd));
    expect(notice(reading)).toContain(`>Opening ${asText(odd)}…</div>`);
    const refused = openerOf();
    await refused.openFile(fileOf(odd, NOT_A_FILE));
    const html = notice(refused);
    expect(html).toContain(`>Could not open ${asText(odd)}</div>`);
    expect(html).not.toContain('<b>');
  });

  it('dismissed, it draws nothing again', async () => {
    const opener = openerOf();
    await opener.openFile(fileOf('walk.zip', NOT_A_FILE));
    expect(notice(opener)).not.toBe('');
    opener.dismiss();
    expect(notice(opener)).toBe('');
  });
});

describe('OpenButton, as it draws', () => {
  it('draws one button named “Open project”, id open-project, Help’s kind, never disabled, over one hidden file input', () => {
    const opener = openerOf();
    const atRest = renderToStaticMarkup(createElement(OpenButton, { opener }));
    void opener.openFile(stillReading('walk.zip'));
    expect(opener.read().opening).toBe(true);
    const whileOpening = renderToStaticMarkup(createElement(OpenButton, { opener }));
    for (const html of [atRest, whileOpening]) {
      expect(count(html, /<button/g)).toBe(1);
      expect(html).toMatch(/^<button id="open-project" class="cds--btn cds--btn--primary" type="button">Open project<\/button>/);
      expect(count(html, /<input/g)).toBe(1);
      expect(html).toMatch(/<input type="file" hidden="" tabindex="-1" accept="\.zip"\/>$/);
      expect(html).not.toMatch(/multiple|disabled|<label/);
    }
    expect(OPEN_WORDS.button).toBe('Open project');
    expect(OPEN_WORDS.close).toBe('Close');
  });
});
