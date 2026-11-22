// CORE-05, stage 6: the kit's file button (brief 75, ruling 3's fallback), by its markup (react-dom/server, no page)
// and its choice on a stand-in input. A press opening the browser's chooser, and the browser's own input meeting the
// clearing, are the page's to prove.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileButton, takeChoice } from './FileButton';

const draw = () => renderToStaticMarkup(createElement(FileButton, { id: 'pick', accept: ['.zip', '.json'], onChoose: () => undefined, children: 'Pick a file' }));

describe('the file button, as it draws', () => {
  it('draws one Carbon button named by its word, and a file input that is hidden, one file, the types offered', () => {
    const html = draw();
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/^<button id="pick" class="cds--btn cds--btn--primary" type="button">Pick a file<\/button>/);
    expect(html.match(/<input/g)).toHaveLength(1);
    const input = /<input[^>]*>/.exec(html)?.[0] ?? '';
    expect(input).toMatch(/type="file"/);
    expect(input).toMatch(/\shidden=""/);
    expect(input).toMatch(/tabindex="-1"/);
    expect(input).toMatch(/accept="\.zip,\.json"/);
    expect(input).not.toMatch(/multiple|id=|aria-/);
    expect(html).not.toMatch(/<label|disabled/);
  });
});

describe('a choice', () => {
  it('hands on the first file chosen, then clears the input', () => {
    const input = { files: ['first', 'second'], value: 'C:\\fakepath\\first' };
    const handed: { file: string; value: string }[] = [];
    takeChoice(input, (file) => {
      handed.push({ file, value: input.value });
    });
    expect(handed).toEqual([{ file: 'first', value: 'C:\\fakepath\\first' }]);
    expect(input.value).toBe('');
  });

  it('with nothing chosen hands on nothing, and leaves the input clear', () => {
    for (const files of [[], null]) {
      const input = { files, value: '' };
      const handed: unknown[] = [];
      takeChoice(input, (file) => {
        handed.push(file);
      });
      expect(handed).toEqual([]);
      expect(input.value).toBe('');
    }
  });
});
