/**
 * JSON-safe public contract metadata shared by runtime discovery and release checks.
 * Keep this module dependency-free so browser consumers can import the registry safely.
 */
export const contractVersion = '1.1';
export const chartTypes = ['line', 'area', 'bar', 'column', 'pie', 'scatter', 'funnel', 'gauge', 'heatmap', 'radar', 'gantt', 'timeline', 'milestone', 'burndown', 'flow', 'swimlane', 'architecture', 'mindmap'];
export const renderers = ['canvas', 'svg'];
export const exportTypes = ['png', 'jpeg', 'svg', 'json'];
export const interactionDefaults = { zoom: false, pan: false, brush: false, drag: false, edgeDrag: false, portConnect: false, editing: false };
export const commandTypes = ['updateField', 'updateRecord', 'updateTask', 'shiftTask', 'updateProgress', 'addDependency', 'removeDependency', 'updateMilestone', 'moveNode', 'moveNodes', 'moveNodeToLane', 'resizeNode', 'alignNodes', 'snapNodes', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'updateEdge', 'removeEdge', 'addEdge', 'toggleGroupCollapse', 'duplicateSelection', 'pasteSelection'];
export const diagramOperations = ['moveNode', 'moveNodes', 'resizeNode', 'alignNodes', 'snapNodes', 'moveNodeToLane', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'updateEdge', 'removeEdge', 'addEdge', 'toggleGroupCollapse', 'duplicateSelection', 'pasteSelection'];
export const businessModels = ['project-task', 'timeline-event', 'milestone', 'burndown-sample', 'flow-node', 'flow-edge', 'swimlane', 'architecture-node', 'architecture-edge', 'mindmap-edge', 'mindmap-node'];
export const diagramEdgeModels = ['flow-edge', 'architecture-edge', 'mindmap-edge'];

const status = (supported, notApplicable = []) => Object.fromEntries(supported.map(name => [name, 'supported']).concat(notApplicable.map(name => [name, 'not-applicable'])));
const commonPresentation = ['title', 'subtitle', 'theme', 'responsive', 'empty-state', 'invalid-data-state', 'export', 'branding'];

export const chartDefinitions = {
  line: { family: 'cartesian', intents: ['trend', 'time-series'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'crosshair', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'dual-axis']) },
  area: { family: 'cartesian', intents: ['trend', 'composition'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'crosshair', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked']) },
  bar: { family: 'cartesian', intents: ['comparison', 'ranking'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked']) },
  column: { family: 'cartesian', intents: ['comparison', 'distribution', 'composition'], required: ['dimension', 'measure'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'legend', 'labels', 'formatting', 'multi-series', 'stacked', 'percent-stacked', 'mixed-line-column', 'dual-axis', 'bin']) },
  pie: { family: 'part-to-whole', intents: ['part-to-whole'], required: ['dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'legend', 'labels', 'formatting', 'donut', 'zero-total'], ['axes', 'grid', 'zoom', 'pan']) },
  scatter: { family: 'cartesian', intents: ['relationship', 'correlation'], required: ['measure', 'measure'], optional: ['dimension'], interactions: ['hover', 'tooltip', 'selection', 'brush', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'grid', 'labels', 'formatting'], ['stacked']) },
  funnel: { family: 'stage', intents: ['funnel', 'conversion'], required: ['dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting'], ['axes', 'grid', 'zoom', 'pan']) },
  gauge: { family: 'indicator', intents: ['progress', 'single-value'], required: ['measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting', 'domain'], ['axes', 'grid', 'legend', 'zoom', 'pan']) },
  heatmap: { family: 'matrix', intents: ['matrix', 'correlation-grid'], required: ['dimension', 'dimension', 'measure'], optional: [], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'matrix-labels', 'labels', 'formatting', 'color-scale', 'missing-values'], ['axes', 'zoom', 'pan']) },
  radar: { family: 'radial', intents: ['multidimensional', 'profile'], required: ['three-or-more-measures'], optional: ['series'], interactions: ['hover', 'tooltip', 'selection', 'keyboard'], features: status([...commonPresentation, 'legend', 'labels', 'formatting', 'multi-series', 'indicator-domains', 'mixed-unit-warning'], ['axes', 'grid', 'zoom', 'pan']) },
  gantt: { family: 'project', intents: ['schedule', 'variance'], required: ['id', 'start', 'end'], optional: ['dependencies', 'progress', 'baseline', 'actual'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard', 'linked-filter', 'linked-selection'], features: status([...commonPresentation, 'labels', 'formatting', 'critical-path', 'slack', 'baseline-actual-variance', 'working-calendar', 'dependencies']) },
  timeline: { family: 'project', intents: ['timeline', 'milestone'], required: ['date', 'title'], optional: ['status'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting']) },
  milestone: { family: 'project', intents: ['milestone'], required: ['date', 'title'], optional: ['baselineDate', 'actualDate'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'labels', 'formatting', 'baseline-actual-variance']) },
  burndown: { family: 'project', intents: ['progress', 'release'], required: ['date', 'remaining'], optional: ['ideal', 'scopeChange'], interactions: ['hover', 'tooltip', 'selection', 'zoom', 'pan', 'keyboard'], features: status([...commonPresentation, 'axes', 'labels', 'formatting', 'scope-change', 'release-forecast']) },
  flow: { family: 'diagram', intents: ['workflow'], required: ['nodes'], optional: ['edges', 'groups', 'ports'], interactions: ['hover', 'tooltip', 'selection', 'edge-selection', 'drag', 'edgeDrag', 'zoom', 'pan', 'keyboard', 'keyboard-edit', 'keyboard-port-connect', 'portConnect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'manual-routing', 'layout', 'groups', 'ports', 'history'], ['axes', 'grid', 'legend']) },
  swimlane: { family: 'diagram', intents: ['responsibility'], required: ['nodes', 'lanes'], optional: ['edges', 'groups', 'ports'], interactions: ['hover', 'tooltip', 'selection', 'edge-selection', 'drag', 'edgeDrag', 'zoom', 'pan', 'keyboard', 'keyboard-edit', 'keyboard-port-connect', 'portConnect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'manual-routing', 'layout', 'groups', 'ports', 'lanes', 'history'], ['axes', 'grid', 'legend']) },
  architecture: { family: 'diagram', intents: ['architecture', 'business-architecture', 'data-architecture', 'technical-architecture'], required: ['nodes'], optional: ['edges', 'layers', 'boundaries', 'groups', 'ports'], interactions: ['hover', 'tooltip', 'selection', 'edge-selection', 'drag', 'edgeDrag', 'zoom', 'pan', 'keyboard', 'keyboard-edit', 'keyboard-port-connect', 'portConnect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'manual-routing', 'layout', 'layers', 'boundaries', 'groups', 'ports', 'history'], ['axes', 'grid', 'legend']) },
  mindmap: { family: 'diagram', intents: ['mindmap', 'hierarchy', 'brainstorm'], required: ['nodes'], optional: ['parentId', 'edges', 'groups'], interactions: ['hover', 'tooltip', 'selection', 'edge-selection', 'drag', 'edgeDrag', 'zoom', 'pan', 'keyboard', 'keyboard-edit', 'keyboard-port-connect', 'portConnect', 'copy-paste'], features: status([...commonPresentation, 'labels', 'routing', 'cubic-bezier', 'curve-tension', 'obstacle-fallback', 'manual-routing', 'layout', 'tree-layout', 'radial-layout', 'history'], ['axes', 'grid', 'legend']) }
};

export const chartProfiles = Object.fromEntries(chartTypes.map(type => [type, {
  type,
  ...chartDefinitions[type],
  dataShapes: chartDefinitions[type].family === 'diagram' ? ['diagram-spec'] : chartDefinitions[type].family === 'project' ? ['records'] : ['records', 'data-table'],
  renderers: [...renderers],
  exports: [...exportTypes],
  limits: type === 'pie' ? { recommendedCategories: 8 } : type === 'radar' ? { minimumIndicators: 3, recommendedIndicators: 8 } : type === 'heatmap' ? { recommendedCells: 2500 } : {}
}]));

export const contractRegistry = Object.freeze({
  contractVersion,
  chartTypes: [...chartTypes],
  chartProfiles: JSON.parse(JSON.stringify(chartProfiles)),
  renderers: [...renderers],
  exportTypes: [...exportTypes],
  interactionDefaults: { ...interactionDefaults },
  commandTypes: [...commandTypes],
  diagramOperations: [...diagramOperations],
  businessModels: [...businessModels],
  diagramEdgeModels: [...diagramEdgeModels]
});
