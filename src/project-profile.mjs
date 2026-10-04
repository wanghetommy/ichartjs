/** Public project-visualization profile entry. */
import { createProfileChart, ProfileChart, normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, ChartValidationError } from './profile-runtime.mjs';
import { buildProjectScene, projectTypes, projectTooltip } from './project.mjs';

export const profile = 'project';
export const chartTypes = projectTypes.slice(0, 4);
export function createChart(spec = {}) { return createProfileChart(spec, { profile, types: chartTypes, buildScene: buildProjectScene }); }
export { ProfileChart, normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, ChartValidationError, projectTooltip };
export function getCapabilities() { return { version: '2.0', profile, chartTypes: [...chartTypes], renderers: ['svg', 'canvas'], exports: ['svg', 'png', 'json'], defaults: { renderer: 'auto', navigation: false, editing: false } }; }
