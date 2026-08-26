import { describe, expect, test } from 'vitest';
import { FlowLayer } from '../src/models/FlowLayer.js';
import { Emitter } from '../src/models/Emitter.js';

describe('strict model boundaries', () => {
  test('rejects graph edges whose endpoints are not declared nodes', () => {
    expect(() => FlowLayer.assertValidJSON({
      graph: {
        nodes: [],
        edges: [{ id: 'orphan', sourceId: 'a', targetId: 'b', weight: 1 }],
      },
      emitters: [],
    })).toThrow(/endpoint does not exist/);
  });

  test('rejects persisted fractional dot counts and seeds before budget accounting', () => {
    expect(() => Emitter.fromJSON({ dotCount: 78.51 })).toThrow(/expected an integer/);
    expect(() => Emitter.fromJSON({ seed: 12.75 })).toThrow(/unsigned 32-bit/);
  });
});
