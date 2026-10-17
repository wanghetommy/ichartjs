export async function verifyEdgeLabelGaps() {
  const runtime = await import('/src/index.mjs'), profile = await import('/src/diagram-profile.mjs');
  const { edgeGapSpec } = await import('/tests/fixtures/edge-label-layout.mjs');
  const { fontPixels, estimateTextWidth } = await import('/src/layout.mjs');
  const { visualScale } = await import('/src/chart-chrome.mjs');
  const report = { cases: 0, checks: { gap: true, unmasked: true, visibleLine: true, clearGapPixels: true, svgBounds: true, checkpoints: true } };
  const host = document.createElement('div'); host.style.width = '900px'; document.body.append(host);
  try {
    for (const factory of [runtime.createChart, profile.createChart]) for (const renderer of ['svg', 'canvas']) for (const vertical of [false, true]) for (const scale of [.64, 1.5]) for (const size of [12, 20]) for (const lineWidth of [1, 6]) {
      const spec = edgeGapSpec({ renderer, vertical, scale, size, lineWidth, label: vertical ? '审核' : 'Release' });
      const chart = factory({ ...spec, container: host, responsive: false });
      try {
        report.cases += 1;
        const before = JSON.stringify(chart.getSpec()), label = chart.model.scene.find('edge-label-0'), edge = chart.model.scene.find('edge-0');
        const width = estimateTextWidth(label.geometry.text, fontPixels(label.style.font), label.style.font), point = edge.geometry.points[0];
        const gap = vertical ? label.geometry.x - width / 2 - point.x - edge.style.strokeWidth / 2 : point.y - label.geometry.y - size * .6 - edge.style.strokeWidth / 2;
        const target = Math.max(2, Math.min(10, (fontPixels(label.style.font) / 4 + edge.style.strokeWidth / 2) * visualScale(chart.getSpec(), chart.model.state.plot)));
        report.checks.gap &&= gap >= 2 - 1e-6 && gap <= 10 + 1e-6 && Math.abs(gap - target) < 1e-6;
        report.checks.unmasked &&= !edge.geometry.exclusions && !chart.model.scene.find('edge-label-0-background');
        const anchor = vertical ? { x: point.x, y: label.geometry.y } : { x: label.geometry.x, y: point.y };
        const clear = vertical ? { x: point.x + edge.style.strokeWidth / 2 + 1, y: anchor.y } : { x: anchor.x, y: point.y - edge.style.strokeWidth / 2 - 1 };
        const bitmap = await createImageBitmap(chart.export({ type: 'png', as: 'blob' })), canvas = document.createElement('canvas');
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
        const ratio = canvas.width / spec.width, alpha = value => context.getImageData(Math.floor(value.x * ratio), Math.floor(value.y * ratio), 1, 1).data[3];
        report.checks.visibleLine &&= alpha(anchor) > 0;
        report.checks.clearGapPixels &&= alpha(clear) === 0;
        if (renderer === 'svg') {
          const bounds = host.querySelector('#edge-label-0').getBBox();
          const actual = vertical ? bounds.x - point.x - edge.style.strokeWidth / 2 : point.y - bounds.y - bounds.height - edge.style.strokeWidth / 2;
          report.checks.svgBounds &&= actual >= 1;
        }
        chart.resize(1000, 700);
        const resizedLabel = chart.model.scene.find('edge-label-0'), resizedEdge = chart.model.scene.find('edge-0'), resizedSize = fontPixels(resizedLabel.style.font);
        const resizedWidth = estimateTextWidth(resizedLabel.geometry.text, resizedSize, resizedLabel.style.font), resizedPoint = resizedEdge.geometry.points[0];
        const resizedGap = vertical ? resizedLabel.geometry.x - resizedWidth / 2 - resizedPoint.x - resizedEdge.style.strokeWidth / 2 : resizedPoint.y - resizedLabel.geometry.y - resizedSize * .6 - resizedEdge.style.strokeWidth / 2;
        const resizedTarget = Math.max(2, Math.min(10, (resizedSize / 4 + resizedEdge.style.strokeWidth / 2) * visualScale(chart.getSpec(), chart.model.state.plot)));
        report.checks.gap &&= Math.abs(resizedGap - resizedTarget) < 1e-6;
        report.checks.checkpoints &&= JSON.stringify(chart.getSpec().nodes) === JSON.stringify(spec.nodes) && JSON.stringify(chart.getSpec().view) === JSON.stringify(spec.view) && before !== JSON.stringify(chart.getSpec());
      } finally { chart.destroy(); }
    }
  } finally { host.remove(); }
  return report;
}
