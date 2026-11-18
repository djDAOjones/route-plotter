import { afterEach, expect, test, vi } from 'vitest';
import { blankProject, drawCrowd, settled } from './helpers/noRouteScene.js';
import { WAITING_HINT, WAITING_FIELD_HINT, WAITING_RELEASE_HINTS } from '../src/utils/waitingSettings.js';

const tip = id => document.getElementById(id).getAttribute('data-tip');
const description = field => (field.getAttribute('aria-describedby') || '').split(/\s+/)
  .map(id => document.getElementById(id)?.textContent || '').join(' ');
async function setup() {
  const app = await blankProject(), { layer, entry } = drawCrowd(app), emitter = layer.emitters[0];
  entry.area = { shape: 'ellipse', width: 0.2, height: 0.2, turn: 0 };
  emitter.update({ lifecycleMode: 'collect' });
  app.eventBus.emit('scene-outline:command', { action: 'select', kind: 'emitter', layerId: layer.id, emitterId: emitter.id });
  await settled(); return { app, layer, entry, emitter };
}
const author = async value => {
  const form = document.getElementById('crowd-wait-form');
  form.elements.waitAtStart.checked = value;
  form.elements.waitAtStart.dispatchEvent(new Event('input', { bubbles: true }));
  form.querySelector('[type="submit"]').click(); await settled();
};
afterEach(() => { vi.restoreAllMocks(); localStorage.getItem.mockImplementation(() => null); });

test('active G release descriptions say reference/nearest-first and restore exact ordinary text when off', async () => {
  const { emitter } = await setup();
  const ids = ['crowd-release-start-label', 'crowd-release-duration-label',
    'crowd-onset-variance-label', 'crowd-intensity-ramp-label', 'crowd-speed-variance-label'];
  const before = ids.map(tip);
  await author(true); expect(emitter.waitAtStart).toBe(true);
  expect(ids.slice(0, 4).map(tip)).toEqual(Object.values(WAITING_RELEASE_HINTS));
  expect(description(document.getElementById('crowd-release-start'))).toContain(WAITING_RELEASE_HINTS.start);
  expect(tip('crowd-speed-variance-label')).toBe(before[4]);
  const outline = document.querySelector('form[data-outline-action="update-emitter"]');
  expect(description(outline.elements.releaseStart)).toContain(WAITING_RELEASE_HINTS.start);
  expect(description(outline.elements.onsetVariance)).toContain(WAITING_RELEASE_HINTS.timing);
  expect(description(outline.elements.intensityRampDirection)).toContain(WAITING_RELEASE_HINTS.bias);
  await author(false); expect(ids.map(tip)).toEqual(before);
});

test.each(['card', 'outline'])('%s waiting parameter and form instructions survive refresh with separate descriptions', async surface => {
  const { app } = await setup();
  const current = () => surface === 'card' ? document.getElementById('crowd-wait-form')
    : document.querySelector('form[data-outline-action="update-waiting"]');
  for (let i = 0; i < 2; i++) {
    const field = current().elements.waitAtStart, hint = [...field.labels]
      .map(label => label.querySelector('[data-tip]')).find(Boolean);
    expect(hint.getAttribute('data-tip')).toBe(WAITING_FIELD_HINT);
    expect(description(field)).toContain(WAITING_FIELD_HINT);
    expect(description(field)).toContain(WAITING_HINT);
    expect([...field.labels].map(label => label.textContent.trim()).join(' ')).toBe('Final whistle');
    app.syncCrowdEditor(); app._queueSceneOutlineRefresh(); await settled();
  }
});
