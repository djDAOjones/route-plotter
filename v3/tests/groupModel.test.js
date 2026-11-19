import { describe, expect, test } from 'vitest';
import { Emitter } from '../src/models/Emitter.js';
import { Scene } from '../src/models/Scene.js';
import { groupsActive, groupsUnavailableReason } from '../src/utils/groupSettings.js';

const saved = { id: 'e', seed: 41, lifecycleMode: 'collect' };

describe('strict additive group settings', () => {
  test('defaults omit all new keys and preserve the whole legacy emitter JSON', () => {
    const e = new Emitter(saved), json = e.toJSON();
    expect([e.groups, e.groupSize, e.groupWidth]).toEqual([false, 4, 0.02]);
    expect(Object.keys(json)).toEqual(['id', 'seed', 'dotCount', 'speed', 'speedVariance', 'dotSize',
      'dotColor', 'lifecycleMode', 'releaseStart', 'releaseDuration', 'onsetVariance', 'intensityRamp',
      'busynessEnvelope', 'wobble']);
    expect(Emitter.fromJSON(json).toJSON()).toEqual(json);
  });
  test.each([[1, 0], [4, 0.02], [5000, 0.2], [19, 0.12345678901234567], [2, Number.MIN_VALUE]])(
    'retains size %s and width %s through Scene, including inactive and size1', (groupSize, groupWidth) => {
      const e = new Emitter({ ...saved, groups: true, groupSize, groupWidth });
      const scene = Scene.fromJSON({ flowLayers: [{ id: 'crowd', guideType: 'route', emitters: [e.toJSON()] }] });
      const reopened = scene.getFlowLayer('crowd').emitters[0];
      expect([reopened.groups, reopened.groupSize, reopened.groupWidth]).toEqual([true, groupSize, groupWidth]);
      reopened.update({ groups: false });
      const again = Emitter.fromJSON(reopened.toJSON());
      expect([again.groups, again.groupSize, again.groupWidth]).toEqual([false, groupSize, groupWidth]);
    });
  const invalid = [
    ...[null, undefined, 0, 1, 'true', {}].map(groups => ({ groups })),
    ...[null, undefined, 0, 1.1, 5001, '4', NaN, Infinity].map(groupSize => ({ groupSize })),
    ...[null, undefined, -Number.MIN_VALUE, 0.20000000000000004, '0.02', NaN, Infinity].map(groupWidth => ({ groupWidth })),
  ];
  test.each(invalid)('rejects supplied invalid setting before ANY partial writes: %j', partial => {
    expect(() => new Emitter({ ...saved, ...partial })).toThrow(/group/i);
    expect(() => Emitter.fromJSON({ ...saved, ...partial })).toThrow(/group/i);
    expect(() => Emitter.assertValidJSON({ ...saved, ...partial })).toThrow(/group/i);
    const e = new Emitter(saved), before = e.toJSON();
    expect(() => e.update({ dotCount: 123, speed: 4, ...partial })).toThrow(/group/i);
    expect(e.toJSON()).toEqual(before);
  });
  test.each(['route', 'respawn', 'loop', 'waiting', 'single', 'off'])('inactivity %s retains configuration', mode => {
    const layer = { guideType: mode === 'route' ? 'route' : 'graph' };
    const e = new Emitter({ ...saved, groups: mode !== 'off', groupSize: mode === 'single' ? 1 : 3,
      groupWidth: 0.13, lifecycleMode: ['respawn', 'loop'].includes(mode) ? mode : 'collect' });
    if (mode === 'waiting') e.waitAtStart = true;
    expect(groupsActive(layer, e)).toBe(false);
    if (!['single', 'off'].includes(mode)) expect(groupsUnavailableReason(layer, e)).toBeTruthy();
    expect(e.groupWidth).toBe(0.13);
  });
  test.each(['collect', 'disappear'])('own finite network is active: %s', lifecycleMode => {
    const e = new Emitter({ ...saved, groups: true, lifecycleMode });
    expect(groupsActive({ guideType: 'graph' }, e)).toBe(true);
    expect(groupsUnavailableReason({ guideType: 'graph' }, e)).toBe('');
  });
});
