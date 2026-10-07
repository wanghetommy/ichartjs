# Chart Text and Annotations

Use chart text for presentation, annotations for data-linked explanations, and [Freeform Board](canvas-scenario.md) text for page-level notes. Content is plain text, not HTML or rich text. SVG and Canvas draw the same fitted Scene nodes.

## Discover and Choose

Read root `getCapabilities().text`, `.annotations` and `getChartContract(type).annotations.supported`. `/standard` also exposes `text` / `annotations` and independently renders standard charts; importing root first is not required.

| Need | Contract |
| --- | --- |
| Heading / subtitle | `title.text` / `title.subtitle`; explicit `\n`, at most two lines each, fitting then `TITLE_TRUNCATED` when necessary. |
| Axis title / tick format | `xAxis.title`, `yAxis.title`, axis `format`; chart-specific applicability still applies. |
| Numeric labels | `labels.enabled`, `format`, `font`, `color`; CSS pixel font such as `500 14px system-ui`. |
| Label position | Bar / Column: `labels.position: 'inside' | 'outside'`; other types diagnose explicit positions as unsupported. |
| Diagram labels | `nodes[].label`, `edges[].label`; explicit newlines, bounded wrapping/scaling/truncation, inline edge background plates. |
| Independent note | Board `kind: 'text'`: box, font, alignment, padding, wrap and minimum size. |
| Numeric threshold | `annotations[]` with `type: 'reference-line'`. |
| Explain an observation | `annotations[]` with `type: 'callout'`, stable `recordId` and optional measure `field`. |

Ordinary chart labels, including Pie and Gauge, have **no background plate**. Inside Bar/Column labels use contrasting colors and are suppressed when the mark is too small. Point collision checks use the effective font; insufficient space produces `LABELS_SUPPRESSED`. Small polar sectors may still produce `POLAR_LABEL_OVERFLOW`.

Label and Board pixel fonts are bounded to 8–160px. Browser fitting uses Canvas font metrics when a font is supplied; headless fitting uses estimates and can differ slightly. For web fonts, await `document.fonts.ready` before creating or re-rendering. Truncation preserves grapheme clusters, including joined emoji and combining marks.

## Minimal Data-Linked Example

<!-- docs-check: annotations -->
```js
import { createChart, validateSpec } from '@taylorwong/ichartjs/standard';
const spec = {
  type: 'line', renderer: 'svg', width: 640, height: 360,
  title: { text: 'Revenue\nTarget and observed peak' },
  legend: { visible: false },
  data: { values: [
    { id: 'jan', month: 'Jan', revenue: 24 },
    { id: 'feb', month: 'Feb', revenue: 42 },
    { id: 'mar', month: 'Mar', revenue: 33 }
  ] },
  encoding: { x: { field: 'month' }, y: { field: 'revenue' } },
  labels: { enabled: true, font: '500 13px system-ui' },
  annotations: [
    { id: 'target', type: 'reference-line', axis: 'y', value: 40, text: 'Target 40' },
    { id: 'peak', type: 'callout', recordId: 'feb', text: 'February peak', offset: { x: 20, y: 28 } }
  ]
};
const result = validateSpec(spec);
if (!result.valid) throw new Error(JSON.stringify(result.errors));
const chart = createChart(result.spec);
const svg = chart.export({ type: 'svg' });
const annotations = chart.getState().layout.annotations;
const warnings = chart.explain().warnings;
chart.destroy();
```

For a browser component, add `container: '#chart'`. Recipe `@taylorwong/ichartjs/recipes/text-annotations` is a starting template, not an executable task. Load JSON using your host's supported JSON import syntax or file loader.

## Annotation Boundaries

- Cartesian only: Line, Area, Bar, Column and Scatter; maximum 100, unique nonempty IDs.
- Reference lines require a finite numeric `value` and numeric `axis`. Bar uses `x`; others normally use `y`. `x` requires quantitative x encoding or Scatter. Categorical/temporal reference lines are not supported.
- Callouts require a **string** `data.values[].id`, resolved against transformed, visible data. `field` selects a measure when multiple series exist; omission selects the first visible matching mark. Reordering does not change the target.
- `offset.x/y` is a preferred chart-pixel offset from the mark. Text boxes fit the plot, at most three lines; callouts have a leader and dedicated background plate. Nearby vertical placements avoid numeric/annotation labels when possible; unresolved collisions report `ANNOTATION_LABEL_OVERLAP`. Inspect dense previews.
- Domains are not expanded. Omitted out-of-domain lines report `ANNOTATION_OUT_OF_VIEW`; missing/filtered records or unavailable measures report `ANNOTATION_TARGET_MISSING`; crowded text reports `ANNOTATION_TEXT_TRUNCATED`.
- `ChartSpec.annotations` survives `getSpec()` / JSON reconstruction and appears in SVG/Canvas exports. `/standard` PNG needs a mounted Canvas renderer; root follows the [full export contract](runtime-contract.md).
- No range bands, rich text, independent annotation editor or natural-language parser.

## Agent Changes and Self-Check

For “add a target at 40 and explain February”, inspect the contract and stable IDs, propose the array, validate the complete Spec, obtain host approval, then `chart.update({ annotations })`. This replaces the whole array: preserve existing IDs/content unless removal is requested; `annotations: []` clears it.

After data, size, theme or view changes, inspect `getState().layout.annotations`, warnings and an actual preview. Export JSON and reconstruct it to check persistence. These are ordinary Spec changes, not business edit commands; the host owns preview/approval, persistence and desired history. See the [conversational workflow](conversational-workflow.md).

`annotationPlugin()` remains an ephemeral pixel-line plugin. Only `type: 'line'` with finite `geometry.x1/y1/x2/y2` is supported; other entries report `INVALID_PLUGIN_ANNOTATION`. Installed plugins do not serialize into `ChartSpec.annotations`; prefer declarative annotations for Agent deliverables.

## Board Text

Explicit newlines are preserved even with `wrap: false`, which disables **automatic** wrapping only. Fitting respects width, height, `maxLines` and `minFontSize`. `style.font` takes precedence; otherwise use `fontSize` / `fontWeight` / `fontFamily`. Rendering uses the fitted font size.

Preserve the Board's aspect ratio in host CSS. When scaling a mounted SVG/Canvas to container width, use `width: 100%; height: auto`, not independent width/height stretching, which distorts text regardless of correct scene fitting.

Inspect `board.getState().layout.text` and `board.explain().warnings`: `TEXT_TRUNCATED` reports lost text; `TEXT_OVERFLOW` reports a box too short at the minimum size. Increase the box or reduce padding/minimum size.

Preview: `http://localhost:3000/playground/accessibility-lab.html` → **Text & Annotation**. Switch SVG/Canvas, theme and width; update April data and reconstruct JSON to verify the callout follows its record.
