/**
 * GraphRenderer — draws graph nodes and edges onto a canvas context.
 * Stateless: receives everything it needs per frame via render().
 *
 * Draw order: edges first (lines), then nodes (filled circles),
 * then selection indicators, then type badges.
 * All positions are normalised (0–1) and converted to canvas pixels
 * via the provided imageToCanvas function.
 */

/** @constant {string} Node fill colour — Okabe-Ito Blue */
const NODE_COLOR = '#0072B2';
/** @constant {string} Entry node fill — Okabe-Ito Bluish Green */
const ENTRY_COLOR = '#009E73';
/** @constant {string} Exit node fill — Okabe-Ito Vermillion */
const EXIT_COLOR = '#D55E00';
/** @constant {string} Edge stroke colour */
const EDGE_COLOR = '#525252';
/** @constant {string} Selected item highlight — bright blue */
const SELECTION_COLOR = '#4589FF';

/** @constant {number} Base node radius in relative-size units (% of diagonal) */
const NODE_RADIUS_PCT = 0.6;
/** @constant {number} Minimum edge stroke width (px) */
const EDGE_MIN_WIDTH = 1;
/** @constant {number} Maximum edge stroke width (px) */
const EDGE_MAX_WIDTH = 12;
/** @constant {number} Weight-to-pixel multiplier */
const EDGE_WEIGHT_SCALE = 2;
/** @constant {number} Selection ring offset beyond node radius (px) */
const SELECTION_RING_GAP = 3;
/** @constant {number} Selection ring stroke width (px) */
const SELECTION_RING_WIDTH = 2.5;

export class GraphRenderer {
  /**
   * Render the graph onto a canvas context.
   *
   * @param {CanvasRenderingContext2D} ctx — The vector-layer context.
   * @param {import('../models/GraphModel.js').GraphModel} graphModel
   * @param {Function} imageToCanvas — (normX, normY) => {x, y} in canvas px.
   * @param {import('./CoordinateTransform.js').CoordinateTransform} coordinateTransform
   * @param {Object} [options] — Optional rendering hints.
   * @param {string|null} [options.selectedNodeId] — ID of the selected node.
   * @param {string|null} [options.selectedEdgeId] — ID of the selected edge.
   */
  render(ctx, graphModel, imageToCanvas, coordinateTransform, options = {}) {
    if (!graphModel || !imageToCanvas) return;

    const nodes = graphModel.getNodes();
    const edges = graphModel.getEdges();
    if (nodes.length === 0) return;

    const selectedNodeId = options.selectedNodeId || null;
    const selectedEdgeId = options.selectedEdgeId || null;

    // Pre-compute canvas positions for all nodes (keyed by id)
    const positions = new Map();
    for (const node of nodes) {
      positions.set(node.id, imageToCanvas(node.x, node.y));
    }

    // Compute node radius using relative sizing (matches existing scaleSize pattern)
    const baseRadius = coordinateTransform
      ? coordinateTransform.scaleSize(NODE_RADIUS_PCT)
      : 6;

    // ── Edges ─────────────────────────────────────────
    for (const edge of edges) {
      const from = positions.get(edge.sourceId);
      const to = positions.get(edge.targetId);
      if (!from || !to) continue;

      const isSelected = edge.id === selectedEdgeId;
      const width = Math.max(
        EDGE_MIN_WIDTH,
        Math.min(EDGE_MAX_WIDTH, edge.weight * EDGE_WEIGHT_SCALE)
      );

      // Selected edge: draw wider highlight underneath
      if (isSelected) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = width + 4;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = isSelected ? SELECTION_COLOR : EDGE_COLOR;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Direction arrow for one-way edges
      if (edge.direction === 'one-way') {
        this._drawArrowhead(ctx, from, to, width, isSelected);
      }
    }

    // ── Nodes ─────────────────────────────────────────
    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;
      const isSelected = node.id === selectedNodeId;

      // Selection ring (drawn behind the node fill)
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, baseRadius + SELECTION_RING_GAP, 0, Math.PI * 2);
        ctx.strokeStyle = SELECTION_COLOR;
        ctx.lineWidth = SELECTION_RING_WIDTH;
        ctx.stroke();
      }

      // Node fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, baseRadius, 0, Math.PI * 2);
      if (node.type === 'entry') {
        ctx.fillStyle = ENTRY_COLOR;
      } else if (node.type === 'exit') {
        ctx.fillStyle = EXIT_COLOR;
      } else {
        ctx.fillStyle = NODE_COLOR;
      }
      ctx.fill();

      // Thin outline for contrast on any background
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Type badge — small letter inside the node for entry/exit
      if (node.type === 'entry' || node.type === 'exit') {
        const letter = node.type === 'entry' ? 'E' : 'X';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(9, baseRadius)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, pos.x, pos.y + 0.5);
      }
    }
  }

  /**
   * Draw a small arrowhead at the midpoint of a one-way edge.
   * @private
   */
  _drawArrowhead(ctx, from, to, lineWidth, isSelected) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const size = Math.max(8, lineWidth * 2);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();
    ctx.fillStyle = isSelected ? SELECTION_COLOR : EDGE_COLOR;
    ctx.fill();
    ctx.restore();
  }
}
