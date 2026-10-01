const diagramTypes = new Set(['flow', 'swimlane', 'architecture', 'mindmap']);
const continuousInteractionKeys = ['zoom', 'pan', 'brush', 'drag', 'edgeDrag', 'portConnect'];
const autoCanvasRecordThreshold = 400;

function countRecords(spec = {}) {
  const values = Array.isArray(spec.data?.values) ? spec.data.values.length : Array.isArray(spec.data) ? spec.data.length : 0;
  const nodes = Array.isArray(spec.nodes) ? spec.nodes.length : Array.isArray(spec.data?.nodes) ? spec.data.nodes.length : 0;
  const edges = Array.isArray(spec.edges) ? spec.edges.length : Array.isArray(spec.data?.edges) ? spec.data.edges.length : 0;
  const lanes = Array.isArray(spec.lanes) ? spec.lanes.length : Array.isArray(spec.data?.lanes) ? spec.data.lanes.length : 0;
  return Math.max(values, nodes + edges + lanes);
}

function explicitSelection(renderer) {
  return { requested: renderer, effective: renderer, reasons: ['explicit-renderer'], recordCount: null, policy: 'explicit' };
}

export function resolveRenderer(spec = {}) {
  const requested = spec.renderer || 'canvas';
  if (requested !== 'auto') return explicitSelection(requested);

  const recordCount = countRecords(spec);
  const reasons = [];
  if (spec.accessibility?.enabled) {
    reasons.push('accessibility-and-dom-inspection');
    return { requested, effective: 'svg', reasons, recordCount, policy: 'auto-v1' };
  }
  if (recordCount > autoCanvasRecordThreshold) {
    reasons.push('large-scene');
    if (spec.editing?.enabled || continuousInteractionKeys.some(key => spec.interaction?.[key])) reasons.push('continuous-interaction');
    return { requested, effective: 'canvas', reasons, recordCount, policy: 'auto-v1' };
  }
  if (diagramTypes.has(spec.type)) reasons.push('text-and-structure-heavy');
  else reasons.push('small-or-medium-scene');
  return { requested, effective: 'svg', reasons, recordCount, policy: 'auto-v1' };
}

export const rendererPolicy = {
  version: '1.0',
  auto: 'deterministic-at-creation',
  default: 'svg',
  largeSceneThreshold: autoCanvasRecordThreshold,
  canvasReasons: ['large-scene'],
  secondaryReasons: ['continuous-interaction'],
  svgReasons: ['accessibility-and-dom-inspection', 'text-and-structure-heavy', 'small-or-medium-scene']
};
