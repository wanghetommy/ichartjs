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

declare const spec: ChartSpec;
declare const command: EditCommand;
declare const filters: LinkedFilters;

const chart: Chart = createChart({ ...spec, type: spec.type || 'line', data: [{ id: 'row-1', name: 'A', value: 1 }] });
const listener = (event: ChartEvent) => event.chart.getState().revision;
chart.on('render', listener).off('render', listener);
chart.update({ labels: { enabled: true } }).setData([{ id: 'row-2', name: 'B', value: 2 }]);
chart.setLinkedFilters(filters).setLinkedSelection(['row-2']);
chart.getDiagramNodes();
chart.getDiagramEdges();
chart.getClipboard();
chart.export({ type: 'json', as: 'object' });
chart.export({ type: 'svg', as: 'string' });
chart.export({ type: 'png', as: 'dataurl' });
chart.export({ type: 'jpeg', as: 'blob' });
chart.previewEdit(command);
chart.validateData();
getCapabilities().contractVersion;
getBusinessSchema('mindmap-edge');
try { chart.update({ width: 0 }); } catch (error) { if (!(error instanceof ChartValidationError)) throw error; }
chart.destroy();
chart.destroy();
