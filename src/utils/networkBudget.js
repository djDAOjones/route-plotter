/**
 * The room a crowd's network has, in its scene, for one more node, link or
 * bend: the loader's six graph counts (a crowd's nodes, links and bends, a
 * path's bends, the scene's nodes and links), which the outline and the
 * network editor's pen both check before they add one, so neither makes a
 * network past them (DEF-59). The project-wide budgets (how many values,
 * how much text, the file's size) are not counted here: DEF-04's.
 */
import { FLOW_LAYER_LIMITS } from '../models/FlowLayer.js';
import { SCENE_LIMITS } from '../models/Scene.js';

/** What the author is told when there is no room. */
export const NETWORK_FULL = Object.freeze({
  node: 'The project node limit has been reached.',
  edge: 'The project edge limit has been reached.',
  bend: 'The project bend-point limit has been reached.',
});

/**
 * @param {Array<import('../models/FlowLayer.js').FlowLayer>} layers - The scene's crowds, `layer` among them
 * @param {import('../models/FlowLayer.js').FlowLayer} layer - The crowd to add to
 * @param {import('../models/GraphEdge.js').GraphEdge|null} [edge] - The path a bend would go on
 * @returns {{node: boolean, edge: boolean, bend: boolean}} Whether one more fits
 */
export function networkRoom(layers, layer, edge = null) {
  const all = layers.includes(layer) ? layers : [...layers, layer];
  const nodes = all.reduce((sum, each) => sum + each.graph.getNodes().length, 0);
  const edges = all.reduce((sum, each) => sum + each.graph.getEdges().length, 0);
  const bends = layer.graph.getEdges().reduce((sum, each) => sum + each.controlPoints.length, 0);
  return {
    node: layer.graph.getNodes().length < FLOW_LAYER_LIMITS.MAX_GRAPH_NODES
      && nodes < SCENE_LIMITS.MAX_GRAPH_NODES_TOTAL,
    edge: layer.graph.getEdges().length < FLOW_LAYER_LIMITS.MAX_GRAPH_EDGES
      && edges < SCENE_LIMITS.MAX_GRAPH_EDGES_TOTAL,
    bend: (!edge || edge.controlPoints.length < FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_PER_EDGE)
      && bends < FLOW_LAYER_LIMITS.MAX_CONTROL_POINTS_TOTAL,
  };
}
