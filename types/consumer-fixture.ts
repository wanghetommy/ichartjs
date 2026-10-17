import {
  ChartValidationError,
  Chart,
  ChartSpec,
  createChart,
  getCapabilities,
  getBusinessSchema,
  type ChartEvent,
  type EditCommand,
  type LinkedFilters
} from '@taylorwong/ichartjs';
import { createChart as createProfileChart, getCapabilities as getProfileCapabilities } from '@taylorwong/ichartjs/standard';
import { FreeformBoard as ProfileBoard, getCapabilities as getBoardProfileCapabilities } from '@taylorwong/ichartjs/board';

const profileBoundary: Extract<keyof ReturnType<typeof getProfileCapabilities>, 'intents' | 'charts' | 'editing'> extends never ? true : never = true;
const boardBoundary: Extract<keyof typeof import('@taylorwong/ichartjs/board'), 'createChart' | 'planChart' | 'getChartContract'> extends never ? true : never = true;
getProfileCapabilities().export.delivery.representations.svg;
getBoardProfileCapabilities().boardCapabilities.items;
new ProfileBoard({ items: [] }).destroy();

declare const spec: ChartSpec;
declare const command: EditCommand;
declare const filters: LinkedFilters;
declare const containerElement: HTMLElement;

createChart({ ...spec, container: containerElement }).destroy();
createProfileChart({ ...spec, container: containerElement }).destroy();

const chart: Chart = createChart({ ...spec, type: spec.type || 'line', data: [{ id: 'row-1', name: 'A', value: 1 }] });
chart.getState().warnings.forEach(warning => {
  warning.nodeId?.toUpperCase(); warning.nodeIds?.map(id => id.toUpperCase());
  warning.currentSize?.width.toFixed(); warning.recommendedSize?.height.toFixed();
  warning.nodeSize?.width.toFixed(); warning.fontSize?.toFixed();
  warning.count?.toFixed(); warning.recommendedMaximum?.toFixed(); warning.estimated?.valueOf();
});
const listener = (event: ChartEvent) => event.chart.getState().revision;
chart.on('render', listener).off('render', listener);
chart.update({ labels: { enabled: true } }).setData([{ id: 'row-2', name: 'B', value: 2 }]);
chart.setLinkedFilters(filters).setLinkedSelection(['row-2']);
chart.getDiagramNodes();
chart.getDiagramEdges();
chart.getState().edgeRoutes?.map(route => route.effectiveRoutingMode);
chart.explain().edgeRoutes?.map(route => route.reason);
chart.getClipboard();
chart.export({ type: 'json', as: 'object' });
chart.export({ type: 'svg', as: 'string' });
chart.export({ type: 'png', as: 'dataurl' });
chart.export({ type: 'jpeg', as: 'blob' });
const profileChart = createProfileChart({ type: 'line', data: [{ id: 'profile-row', name: 'A', value: 1 }] });
profileChart.getState().lineage.recordIds;
profileChart.update({ renderer: 'canvas' }).resize(600, 320).setTheme({ mode: 'dark' });
const effectiveProfileRenderer: 'svg' | 'canvas' = profileChart.getState().rendererSelection.effective;
profileChart.getState().rendererSelection.requested;
profileChart.explain().lineage.sourcePreserved;
profileChart.destroy();
chart.previewEdit(command);
chart.validateData();
getCapabilities().contractVersion;
const buildingPreview = chart.previewEdit({ type: 'layout-edit', operations: [
  { op: 'addNode', node: { id: 'new-step', label: 'New step', kind: 'process' } },
  { op: 'addEdge', id: 'new-edge', from: 'start', to: 'new-step' }
] });
buildingPreview.layout?.nodes['new-step'].width;
chart.getState().layout?.diagram?.coordinate;
getBusinessSchema('mindmap-edge');
try { chart.update({ width: 0 }); } catch (error) { if (!(error instanceof ChartValidationError)) throw error; }
chart.destroy();
chart.destroy();
const { createBoard, validateBoardCommand, boardCapabilities } = await import('@taylorwong/ichartjs/board');
const board = createBoard({ editing: { enabled: true, allowStructuralChanges: true } });
const boardCommand = { type: 'board-edit', operations: [{ op: 'addItem', item: { id: 'caption', kind: 'text', text: 'Build', position: { x: 40, y: 40 }, size: { width: 200, height: 40 } } }] } as const;
const boardPreview = board.previewEdit({ type: boardCommand.type, operations: [...boardCommand.operations] });
validateBoardCommand(boardCommand);
boardCapabilities.incrementalBuilding.commandFields.updateItem;
(await import('@taylorwong/ichartjs')).iChart.validateBoardCommand(boardCommand);
if (boardPreview.command) board.applyEdit(boardPreview.command, { preview: boardPreview, confirmed: true });
const unsubscribeBoard = board.subscribe(event => event.state.revision);
boardPreview.layout?.items.map(item => item.x);
unsubscribeBoard();
board.destroy();
const { annotationPlugin, dataZoomPlugin, dataLabelsPlugin, accessibilityPlugin } = await import('@taylorwong/ichartjs');
const annotatedSpec: ChartSpec = { type: 'line', data: [{ id: 'a', name: 'A', value: 10 }], annotations: [{ id: 'target', type: 'reference-line', axis: 'y', value: 8 }, { id: 'note', type: 'callout', recordId: 'a', text: 'Observation' }] };
const annotated = createChart(annotatedSpec);
annotated.getState().layout?.annotations?.map(item => item.visible);
annotated.explain().layout?.annotations?.map(item => item.anchor);
getCapabilities().annotations.types;
getCapabilities().text.labels.positions.bar;
annotationPlugin([{ type: 'line', geometry: { x1: 0, y1: 0, x2: 100, y2: 100 } }]);
dataZoomPlugin({ minSpan: 2 });
dataLabelsPlugin({ formatter: value => String(value) });
accessibilityPlugin({ description: 'Annotated series' });
annotated.destroy();
const annotatedProfile = (await import('@taylorwong/ichartjs/standard')).createChart(annotatedSpec);
annotatedProfile.getState().layout.annotations?.map(item => item.visible);
annotatedProfile.explain().layout.annotations?.map(item => item.visible);
const rasterBlob = annotatedProfile.export({ type: 'image/jpeg', as: 'blob' });
if (rasterBlob instanceof Blob) rasterBlob.type;
annotatedProfile.destroy();
const softDiagramSpec: ChartSpec = { type: 'flow', nodes: [{ id: 'start', label: 'Request', kind: 'start', icon: 'user', tone: 'accent' }], theme: { palette: 'soft' }, diagram: { appearance: 'soft', cornerRadius: 10, arrow: 'open', iconPosition: 'left', iconBadge: true } };
const softDiagram = (await import('@taylorwong/ichartjs/diagram')).createChart(softDiagramSpec);
getCapabilities().diagram?.visuals?.icons.map(name => name.toUpperCase());
(await import('@taylorwong/ichartjs/board')).boardCapabilities.icons.names.map(name => name.toUpperCase());
softDiagram.destroy();
