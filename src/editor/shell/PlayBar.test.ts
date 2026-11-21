// CORE-05, stage 5: what the play bar draws (react-dom/server, no page). A group named "Playback" of three buttons in
// v3's order with their words visible; the middle one named "Play" while nothing plays and "Pause" while it plays;
// Play disabled and described by the reason line, which shows the editor's transport's own words, only while there is
// nothing to play and nothing plays; the name never holds the reason (UI-06 J-21). Each button's press is the
// transport's function its key calls. The two skips' presses are proved on the page (tests/a11y/project.mjs), where a
// press is real; Play and Pause pressed are owed to stage 6's page, since today's page has nothing to play.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../transport/transport';
import { PLAY_REASON, PlayBar } from './PlayBar';

const nothing = (): void => undefined;
const draw = (playing: boolean, canPlay: boolean) =>
  renderToStaticMarkup(
    createElement(PlayBar, {
      transport: { playPause: nothing, skipToStart: nothing, skipToEnd: nothing },
      subscribe: () => nothing,
      playing: () => playing,
      canPlay: () => canPlay,
    }),
  );
const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map((m) => ({ attrs: m[1] ?? '', name: m[2] }));

describe('the play bar, as it draws', () => {
  it('is a group named Playback of three buttons in v3’s order: Skip to start, Play or Pause, Skip to end', () => {
    for (const [playing, canPlay, middle] of [[false, true, 'Play'], [false, false, 'Play'], [true, true, 'Pause'], [true, false, 'Pause']] as const) {
      const html = draw(playing, canPlay);
      expect(html).toMatch(/^<div role="group" aria-label="Playback"[^>]*>/);
      expect(buttons(html).map(({ name }) => name)).toEqual(['Skip to start', middle, 'Skip to end']);
      expect(html).not.toMatch(/aria-pressed|<svg/);
    }
  });

  it('with nothing to play and nothing playing: Play disabled, described by the reason line in the transport’s words', () => {
    const html = draw(false, false);
    const play = buttons(html)[1];
    expect(play?.attrs).toMatch(/ disabled=""/);
    expect(play?.attrs).toContain(`aria-describedby="${PLAY_REASON}"`);
    expect(play?.name).toBe('Play');
    expect(html).toContain(`<p id="${PLAY_REASON}">${WORDS.nothingToPlay}</p>`);
  });

  it('with something to play, or while playing: every button on, no reason line, nothing described', () => {
    for (const [playing, canPlay] of [[false, true], [true, true], [true, false]] as const) {
      const html = draw(playing, canPlay);
      for (const { attrs } of buttons(html)) expect(attrs).not.toMatch(/disabled|aria-describedby/);
      expect(html).not.toContain(PLAY_REASON);
      expect(html).not.toContain(WORDS.nothingToPlay);
    }
  });
});
