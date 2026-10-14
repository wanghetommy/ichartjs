/**
 * Render-focused profile runtime with atomic updates and renderer replacement.
 * The complete interaction and editing runtime remains in index.mjs.
 */
import { normalizeSpec, validateSpec } from './spec.mjs';
import { normalizeData, inspectData, binData, applyTransforms } from './data.mjs';
import { CanvasRenderer, SVGRenderer } from './renderer.mjs';
import { sceneToSvgString } from './scene-svg.mjs';
import { resolveRenderer } from './renderer-policy.mjs';
import { resolveTheme } from './theme.mjs';
import { ChartValidationError } from './errors.mjs';

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function prepareSpec(input, source = input) {
  const spec = normalizeSpec(input);
  const theme = resolveTheme(spec.theme, spec);
  return {
    ...spec,
    theme,
    colors: source.colors !== undefined ? spec.colors : [...theme.colors],
    background: source.background !== undefined ? spec.background : theme.background,
    padding: source.padding !== undefined ? spec.padding : theme.layout.padding
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

function assertProfileType(type, options, operation = 'create') {
  if (!options.types || options.types.includes(type)) return;
  throw new ChartValidationError(operation, [{
    code: 'PROFILE_TYPE_UNSUPPORTED',
    path: 'type',
    message: `${type} is not included in the ${options.profile || 'selected'} profile.`,
    suggestion: `Use one of ${options.types.join(', ')} or import the matching profile entry.`
  }]);
}

export class ProfileChart {
  constructor(input, options = {}) {
    const result = validateSpec(input);
    if (!result.valid) throw new ChartValidationError('create', result.errors);
    assertProfileType(result.spec.type, options);
    this.profile = options.profile || 'custom';
    this._buildScene = options.buildScene;
    this._types = options.types || [];
    this._styleOverrides = { colors: input.colors !== undefined, background: input.background !== undefined, padding: input.padding !== undefined };
    this._diagnostics = { warnings: result.warnings, normalizations: result.normalizations };
    this.spec = prepareSpec(result.spec, input);
    this.container = typeof document === 'undefined' ? null : (typeof this.spec.container === 'string' ? document.querySelector(this.spec.container) : this.spec.container);
    this._rendererSelection = resolveRenderer(this.spec);
    this.renderer = this._rendererSelection.effective === 'svg' ? new SVGRenderer(this.spec) : new CanvasRenderer(this.spec);
    this._destroyed = false;
    if (this.container) this.renderer.mount(this.container);
    this.render();
  }

  render() {
    return this._publish(this.spec);
  }

  _paint() {
    if (!this.renderer.container) return;
    this.renderer.options = this.spec;
    const surface = this.renderer.svg || this.renderer.canvas;
    if (surface?.style) surface.style.background = this.spec.background;
    this.renderer.resize(this.spec.width, this.spec.height);
    this.renderer.render(this.model.scene);
  }

  _publish(spec) {
    if (this._destroyed) throw new Error('Chart has been destroyed.');
    const model = this._buildScene(spec), selection = resolveRenderer(spec);
    const previous = { spec: this.spec, model: this.model, renderer: this.renderer, selection: this._rendererSelection };
    const renderer = selection.effective === previous.selection.effective ? previous.renderer : selection.effective === 'svg' ? new SVGRenderer(spec) : new CanvasRenderer(spec);
    try {
      this.spec = spec;
      this.model = model;
      this.renderer = renderer;
      this._rendererSelection = selection;
      if (renderer !== previous.renderer && this.container) renderer.mount(this.container);
      this._paint();
    } catch (error) {
      this.spec = previous.spec;
      this.model = previous.model;
      this.renderer = previous.renderer;
      this._rendererSelection = previous.selection;
      try {
        if (renderer !== previous.renderer) { renderer.destroy(); if (this.container) previous.renderer.mount(this.container); }
        if (previous.model) this._paint();
      } catch {}
      throw error;
    }
    if (renderer !== previous.renderer) previous.renderer.destroy();
    return this;
  }

  resize(width, height = this.spec.height) {
    return this.update({ width: Math.max(1, Number(width) || this.spec.width), height: Math.max(1, Number(height) || this.spec.height) });
  }

  update(patch = {}) {
    if (this._destroyed) throw new Error('Chart has been destroyed.');
    const next = { ...this.spec, ...patch };
    const source = { ...next };
    const overrides = { ...this._styleOverrides };
    for (const key of ['colors', 'background', 'padding']) if (patch[key] !== undefined) overrides[key] = true;
    if (patch.theme !== undefined) {
      for (const key of ['colors', 'background', 'padding']) if (patch[key] === undefined && !overrides[key]) {
        delete next[key];
        delete source[key];
      }
    }
    const result = validateSpec(next);
    if (!result.valid) throw new ChartValidationError('update', result.errors);
    assertProfileType(result.spec.type, { types: this._types, profile: this.profile }, 'update');
    this._publish(prepareSpec(result.spec, source));
    this._diagnostics = { warnings: result.warnings, normalizations: result.normalizations };
    this._styleOverrides = overrides;
    return this;
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
      layout: state.layout,
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
