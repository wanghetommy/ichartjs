/**
 * Small profile runtime shared by the public capability entries.
 * The complete root runtime remains in index.mjs; profile entries use this
 * runtime so unused project, diagram, and board code is not imported.
 */
import { normalizeSpec, validateSpec } from './spec.mjs';
import { normalizeData, inspectData, binData, applyTransforms } from './data.mjs';
import { CanvasRenderer, SVGRenderer } from './renderer.mjs';
import { sceneToSvgString } from './scene-svg.mjs';
import { resolveRenderer } from './renderer-policy.mjs';
import { resolveTheme } from './theme.mjs';
import { ChartValidationError } from './errors.mjs';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function prepareSpec(input) {
  const spec = normalizeSpec(input);
  const theme = resolveTheme(spec.theme, spec);
  return {
    ...spec,
    theme,
    colors: spec.colors || [...theme.colors],
    background: spec.background || theme.background,
    padding: spec.padding || theme.layout.padding
  };
}

function isEmptyOrZero(result) {
  return result.data.rows.length === 0 || result.data.warnings?.some(item => item.code === 'ZERO_TOTAL');
}

function lineageFor(model) {
  const rows = model?.data?.rows || [];
  return {
    recordIds: rows.map((row, index) => String(row.id ?? row.key ?? `record-${index}`)),
    sourcePreserved: true
  };
}

export class ProfileChart {
  constructor(input, options = {}) {
    const result = validateSpec(input);
    if (!result.valid) throw new ChartValidationError('create', result.errors);
    if (options.types && !options.types.includes(result.spec.type)) {
      throw new ChartValidationError('create', [{
        code: 'PROFILE_TYPE_UNSUPPORTED',
        path: 'type',
        message: `${result.spec.type} is not included in the ${options.profile || 'selected'} profile.`,
        suggestion: `Use one of ${options.types.join(', ')} or import the matching profile entry.`
      }]);
    }
    this.profile = options.profile || 'custom';
    this._buildScene = options.buildScene;
    this._types = options.types || [];
    this._diagnostics = { warnings: result.warnings, normalizations: result.normalizations };
    this.spec = prepareSpec(result.spec);
    this.container = typeof document === 'undefined' ? null : (typeof this.spec.container === 'string' ? document.querySelector(this.spec.container) : this.spec.container);
    this._rendererSelection = resolveRenderer(this.spec);
    this.renderer = this._rendererSelection.effective === 'svg' ? new SVGRenderer(this.spec) : new CanvasRenderer(this.spec);
    this._destroyed = false;
    if (this.container) this.renderer.mount(this.container);
    this.render();
  }

  render() {
    if (this._destroyed) throw new Error('Chart has been destroyed.');
    this.model = this._buildScene(this.spec);
    if (this.renderer.container) {
      this.renderer.options = this.spec;
      this.renderer.resize(this.spec.width, this.spec.height);
      this.renderer.render(this.model.scene);
    }
    return this;
  }

  resize(width, height = this.spec.height) {
    this.spec.width = Math.max(1, Number(width) || this.spec.width);
    this.spec.height = Math.max(1, Number(height) || this.spec.height);
    return this.render();
  }

  update(patch = {}) {
    const next = { ...this.spec, ...patch };
    const result = validateSpec(next);
    if (!result.valid) throw new ChartValidationError('update', result.errors);
    this._diagnostics = { warnings: result.warnings, normalizations: result.normalizations };
    this.spec = prepareSpec(result.spec);
    return this.render();
  }

  setTheme(theme) { return this.update({ theme }); }
  getSpec() { return clone(this.spec); }
  getData() { return clone(this.model?.data || normalizeData(this.spec.data)); }
  getState() {
    const warnings = [...(this._diagnostics.warnings || []), ...(this.model?.data?.warnings || [])];
    const empty = isEmptyOrZero(this.model || { data: { rows: [] } });
    return {
      version: '1.0',
      profile: this.profile,
      type: this.spec.type,
      renderer: this._rendererSelection.effective,
      rendererSelection: { ...this._rendererSelection, requested: this.spec.renderer },
      warnings,
      normalizations: this._diagnostics.normalizations || [],
      health: { status: empty ? 'empty' : warnings.length ? 'degraded' : 'ready', renderable: !empty, issues: warnings.map(item => item.code) },
      layout: this.model?.state || {},
      lineage: lineageFor(this.model)
    };
  }

  explain() {
    const state = this.getState();
    return {
      version: '1.0',
      profile: this.profile,
      type: this.spec.type,
      renderer: state.renderer,
      requiredFields: [this.spec.encoding?.x?.field, this.spec.encoding?.y?.field || this.spec.encoding?.value?.field].filter(Boolean),
      assumptions: ['Profile entries keep the root Spec contract but load only the selected capability family.', 'Navigation and editing remain disabled unless explicitly enabled by the host.'],
      warnings: state.warnings,
      health: state.health,
      lineage: state.lineage
    };
  }

  export(options = {}) {
    const type = String(options.type || 'svg').toLowerCase();
    if (type === 'json' || type === 'application/json') return options.as === 'object' ? { spec: this.getSpec(), state: this.getState() } : JSON.stringify({ spec: this.getSpec(), state: this.getState() }, null, 2);
    if (type.includes('svg')) {
      const svg = this.renderer instanceof SVGRenderer && this.renderer.container ? this.renderer.exportString() : sceneToSvgString(this.model.scene, this.spec);
      return options.as === 'dataurl' ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : svg;
    }
    if (this.renderer instanceof CanvasRenderer && this.renderer.canvas) return this.renderer.exportImage(type.includes('jpeg') ? 'image/jpeg' : 'image/png');
    return { valid: false, code: 'PROFILE_RASTER_UNSUPPORTED', message: 'Raster export requires a mounted Canvas renderer.', suggestion: 'Use export({ type: "svg" }) or mount the profile with renderer: "canvas".' };
  }

  destroy() { this.renderer.destroy(); this.container = null; this.model = null; this._destroyed = true; }
}

export function createProfileChart(spec, options) { return new ProfileChart(spec, options); }
export { normalizeSpec, validateSpec, normalizeData, inspectData, binData, applyTransforms, ChartValidationError };
