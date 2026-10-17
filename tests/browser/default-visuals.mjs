export async function verifyDefaultVisuals() {
  const runtime = await import('/src/index.mjs'), profile = await import('/src/diagram-profile.mjs');
  const { createSoftFlow } = await import('/playground/diagram-visuals.mjs');
  const { galleryCases } = await import('/playground/gallery-cases.mjs');
  const report = { softCases: 0, defaultCases: 0, checks: { finalTextBounds: true, opaquePixels: true, transparentPixels: true, parity: true, checkpointStable: true, defaultRenderable: true, staticDefaults: true, ordinaryLabelsPlateFree: true } };
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'absolute', left: '-10000px', width: '1024px', height: '450px' });
  document.body.append(host);
  const pixel = async (chart, point) => {
    const bitmap = await createImageBitmap(chart.export({ type: 'png', as: 'blob' })), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
    const result = [...context.getImageData(Math.round(point.x * bitmap.width / chart.getSpec().width), Math.round(point.y * bitmap.height / chart.getSpec().height), 1, 1).data];
    bitmap.close(); return result;
  };
  try {
    for (const width of [390, 560, 768, 1024]) for (const mode of ['light', 'dark', 'contrast']) {
      let previous;
      for (const renderer of ['svg', 'canvas']) for (const factory of [runtime.createChart, profile.createChart]) {
        host.style.width = `${width}px`;
        const chart = factory({ ...createSoftFlow(width), container: host, renderer, theme: { mode, palette: 'soft' }, responsive: false });
        try {
          report.softCases += 1;
          const visible = [];
          chart.model.scene.walk(node => { if (node.id !== 'root') visible.push({ id: node.id, type: node.type, geometry: node.geometry, style: node.style }); });
          const signature = JSON.stringify(visible);
          if (previous !== undefined && previous !== signature && !report.difference) {
            const index = [...signature].findIndex((character, index) => character !== previous[index]);
            report.difference = { width, mode, renderer, before: previous.slice(Math.max(0, index - 50), index + 120), after: signature.slice(Math.max(0, index - 50), index + 120) };
          }
          report.checks.parity &&= previous === undefined || previous === signature;
          previous = signature;
          if (renderer === 'svg') {
            const texts = [...host.querySelectorAll('text[id^="edge-label-"]')];
            for (const text of texts) {
              const plate = host.querySelector(`[id="${text.id}-background"]`);
              if (!plate) continue;
              const box = text.getBBox(), background = plate.getBBox();
              report.checks.finalTextBounds &&= box.x >= background.x - 0.1 && box.y >= background.y - 0.1 && box.x + box.width <= background.x + background.width + 0.1 && box.y + box.height <= background.y + background.height + 0.1;
            }
          }
          if (width === 768) {
            const label = chart.model.scene.find('edge-label-3'), line = chart.model.scene.find('edge-3'), plate = chart.model.scene.find('edge-label-3-background');
            const point = { x: line.geometry.points.at(-1).x, y: plate.geometry.y + plate.geometry.height - 1 };
            const before = JSON.stringify(chart.getSpec()), opaque = await pixel(chart, point), background = chart.getSpec().theme.background;
            const expected = [1, 3, 5].map(index => parseInt(background.slice(index, index + 2), 16));
            report.checks.opaquePixels &&= plate.style.opacity === 1 && opaque[3] === 255 && expected.every((value, index) => Math.abs(value - opaque[index]) <= 2);
            report.checks.checkpointStable &&= before === JSON.stringify(chart.getSpec()) && label.geometry.text === 'High risk';
            chart.update({ background: 'transparent' });
            const transparent = await pixel(chart, point);
            report.checks.transparentPixels &&= transparent[3] === 0 && !chart.model.scene.find('edge-label-3-background');
            host.style.width = '800px'; chart.resize(800, 480);
            chart.setTheme({ mode: mode === 'dark' ? 'light' : 'dark', palette: 'soft' });
            report.checks.checkpointStable &&= chart.model.scene.find('edge-3').geometry.exclusions?.length > 0;
          }
        } finally { chart.destroy(); }
      }
    }
    for (const sample of galleryCases.filter(item => item.id !== 'flow-soft')) for (const width of [390, 560, 768, 1024]) for (const mode of ['light', 'dark', 'contrast']) for (const renderer of ['svg', 'canvas']) {
      const spec = structuredClone(sample.spec); delete spec.padding; delete spec.view;
      host.style.width = `${width}px`;
      Object.assign(spec, { width, height: 420, container: host, renderer, theme: { mode }, responsive: false, interaction: {} });
      if (spec.nodes) { spec.nodes = spec.nodes.map(({ position, size, ...node }) => node); spec.diagram = { layout: spec.type === 'mindmap' ? 'tree' : 'layered' }; }
      const chart = runtime.createChart(spec);
      try {
        report.defaultCases += 1;
        report.checks.defaultRenderable &&= chart.getState().health.renderable && !/(?:NaN|Infinity)/.test(chart.export({ type: 'svg' }));
        report.checks.staticDefaults &&= chart.getSpec().interaction.zoom === false && chart.getSpec().interaction.pan === false;
        if (!spec.nodes) report.checks.ordinaryLabelsPlateFree &&= !chart.export({ type: 'svg' }).includes('-label-background');
      } finally { chart.destroy(); }
    }
  } finally { host.remove(); }
  return report;
}
