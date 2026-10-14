import { afterEach, describe, expect, test, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { NetworkEditService } from '../src/services/NetworkEditService.js';
import { RenderingService } from '../src/services/RenderingService.js';
import { SwarmEngine } from '../src/services/SwarmEngine.js';
import { FlowLayer } from '../src/models/FlowLayer.js';

afterEach(() => vi.restoreAllMocks());

function fixture(shape) {
  const layer = new FlowLayer({ guideType: 'graph' });
  const node = layer.graph.addNode({ x: 0.5, y: 0.5, type: 'entry',
    area: shape ? { shape, width: 0.4, height: 0.2, turn: 90 } : null });
  const end = layer.graph.addNode({ x: 0.9, y: 0.5, type: 'exit' });
  layer.graph.addEdge({ sourceId: node.id, targetId: end.id });
  const net = new NetworkEditService(new EventBus());
  const ctx = document.createElement('canvas').getContext('2d');
  const svc = new RenderingService();
  const state = { imageToCanvas: (x, y) => ({ x: x * 200, y: y * 100 }),
    coordinateTransform: { imageWidth: 200, imageHeight: 100 }, swarmEngine: new SwarmEngine(),
    selectedCrowd: layer, networkEditService: net, previewMode: false };
  return { layer, node, net, ctx, svc, state };
}

describe('start area guide overlay', () => {
  test('the rectangle follows the resolved anchor, uses intrinsic rotation, clips bounds and precedes the edges', () => {
    const { layer, node, net, ctx, svc, state } = fixture('rectangle');
    node.applyAnchor(0.3, 0.4);
    net.renderGuide(svc, ctx, state, layer);
    // Image-plane 80×20 rectangle turned clockwise: corners (70,0),(70,80),(50,80),(50,0).
    const corners = [ctx.moveTo.mock.calls[0], ...ctx.lineTo.mock.calls.slice(0, 3)];
    [[70, 0], [70, 80], [50, 80], [50, 0]].forEach((corner, i) => {
      // cos(π/2) is a few ulps from zero; the image-plane oracle is exact.
      expect(corners[i][0]).toBeCloseTo(corner[0], 12);
      expect(corners[i][1]).toBeCloseTo(corner[1], 12);
    });
    expect(ctx.rect).toHaveBeenCalledWith(-2000, -1000, 4200, 2100);
    expect(ctx.clip).toHaveBeenCalledTimes(1);
    expect(ctx.strokeText).toHaveBeenCalledWith('Start area', expect.any(Number), expect.any(Number));
    expect(node.x).toBe(0.5); // authored anchor fallback is not changed
    expect(ctx.strokeText.mock.invocationCallOrder[0]).toBeLessThan(ctx.moveTo.mock.invocationCallOrder[1]);
  });

  test('the ellipse uses both shared image-plane axes, including a non-square no-image canvas', () => {
    const { layer, net, ctx, svc, state } = fixture('ellipse');
    net.renderGuide(svc, ctx, state, layer);
    const [a, b, c, d, e, f] = ctx.transform.mock.calls[0];
    expect(a).toBeCloseTo(0, 12); expect(b).toBeCloseTo(40, 12);
    expect(c).toBeCloseTo(-10, 12); expect(d).toBeCloseTo(0, 12);
    expect([e, f]).toEqual([100, 50]);
    expect(ctx.arc).toHaveBeenCalledWith(0, 0, 1, 0, Math.PI * 2);
    ctx.transform.mockClear();
    state.coordinateTransform = { imageWidth: 0, imageHeight: 0 };
    net.renderGuide(svc, ctx, state, layer);
    expect(ctx.transform.mock.calls[0][1]).toBeCloseTo(20, 12);
    expect(ctx.transform.mock.calls[0][2]).toBeCloseTo(-20, 12);
  });

  test('no area adds no clip; preview/export never invoke the guide; inactive node types keep no start overlay', () => {
    const { layer, node, net, ctx, svc, state } = fixture(null);
    net.renderGuide(svc, ctx, state, layer);
    expect(ctx.clip).not.toHaveBeenCalled();
    node.area = { shape: 'rectangle', width: 0.1, height: 0.1, turn: 0 };
    node.type = 'exit';
    net.renderGuide(svc, ctx, state, layer);
    expect(ctx.clip).not.toHaveBeenCalled();
    node.type = 'entry';
    const spy = vi.spyOn(net, 'renderGuide');
    const guide = RenderingService.VECTOR_LAYERS.find(each => each.name === 'network-guide');
    guide.draw(svc, ctx, { ...state, previewMode: true }, {});
    expect(spy).not.toHaveBeenCalled();
    guide.draw(svc, ctx, state, {});
    expect(spy).toHaveBeenCalledOnce();
    expect(ctx.clip).toHaveBeenCalledOnce();
  });
});
