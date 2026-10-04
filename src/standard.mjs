/** Public standard-chart profile entry. */
import { createProfileChart, ProfileChart, normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, ChartValidationError } from './profile-runtime.mjs';
import { buildStandardScene, standardChartTypes } from './profile-standard.mjs';

export const profile = 'standard';
export const chartTypes = standardChartTypes;
export function createChart(spec = {}) { return createProfileChart(spec, { profile, types: chartTypes, buildScene: buildStandardScene }); }
export { ProfileChart, normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, ChartValidationError };
export function getCapabilities() { return { version: '2.0', profile, chartTypes: [...chartTypes], renderers: ['svg', 'canvas'], exports: ['svg', 'png', 'json'], defaults: { renderer: 'auto', navigation: false, editing: false } }; }
