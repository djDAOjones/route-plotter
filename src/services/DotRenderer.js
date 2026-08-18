/**
 * Batched renderer for swarm dots (Phase 3).
 *
 * Draws the dots a SwarmEngine evaluation returns as plain filled arcs,
 * batched into one canvas path per (colour, size) group — an emitter's
 * dots share both, so a typical layer costs one or two fill() calls
 * regardless of dot count. Stateless: everything is derived from the
 * dots array each frame (deterministic-timeline mandate).
 */

/** Dot radius in reference pixels at dotSize = 1 (see scaleSizeClamped). */
const DOT_BASE_RADIUS_PX = 10;

export class DotRenderer {
  /**
   * Render one evaluated dot set.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{x:number, y:number, size:number, color:string}>} dots
   *        — Normalised dot positions from SwarmEngine.evaluate().
   * @param {Function} imageToCanvas — (normX, normY) => {x, y} canvas coords.
   * @param {import('./RenderingService.js').RenderingService} svc
   *        — Rendering service, for scaleSizeClamped().
   */
  static render(ctx, dots, imageToCanvas, svc) {
    if (!dots || dots.length === 0) return;

    // Group by colour + size so each group is a single batched fill.
    const groups = new Map();
    for (const dot of dots) {
      const key = `${dot.color}|${dot.size}`;
      let group = groups.get(key);
      if (!group) {
        group = { color: dot.color, size: dot.size, dots: [] };
        groups.set(key, group);
      }
      group.dots.push(dot);
    }

    ctx.save();
    for (const group of groups.values()) {
      const radius = svc.scaleSizeClamped(group.size * DOT_BASE_RADIUS_PX);
      if (radius <= 0) continue;
      ctx.fillStyle = group.color;
      ctx.beginPath();
      for (const dot of group.dots) {
        const p = imageToCanvas(dot.x, dot.y);
        ctx.moveTo(p.x + radius, p.y);
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.restore();
  }
}
