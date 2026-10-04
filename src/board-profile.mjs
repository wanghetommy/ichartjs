/**
 * Board profile entry. Board itself is already a separate rendering surface;
 * this entry deliberately exposes the board contract without importing the
 * complete chart runtime.
 */
import { FreeformBoard as FreeformBoardRuntime, validateBoardSpec, planCanvas } from './board.mjs';
import { boardCapabilities } from './board-contract.mjs';
import { normalizeSpec } from './spec.mjs';
import { resolveTheme } from './theme.mjs';
import { buildStandardScene } from './profile-standard.mjs';

export const profile = 'board';
function prepareEmbeddedChart(input) {
  const spec = normalizeSpec(input);
  const theme = resolveTheme(spec.theme, spec);
  return { ...spec, theme, colors: spec.colors || [...theme.colors], background: spec.background || theme.background, padding: spec.padding || theme.layout.padding };
}
const buildEmbeddedChart = input => buildStandardScene(prepareEmbeddedChart(input));
export class FreeformBoard extends FreeformBoardRuntime {
  constructor(spec = {}) { super(spec, { buildChartScene: buildEmbeddedChart }); }
}
export function createBoard(spec = {}) { return new FreeformBoard(spec); }
export { validateBoardSpec, planCanvas, boardCapabilities };
export function getCapabilities() { return { version: '2.0', profile, boardCapabilities, renderers: ['svg', 'canvas'], exports: ['svg', 'png', 'json'], defaults: { navigation: false, editing: false } }; }
