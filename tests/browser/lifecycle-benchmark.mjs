export async function measureMountedLifecycle(counts = [1000, 10000, 50000]) {
  const { createChart } = await import('/src/standard.mjs');
  await document.fonts.ready;
  const host = document.createElement('div');
  host.id = 'lifecycle-benchmark';
  host.style.width = '960px';
  document.body.append(host);
  const reports = [];
  try {
    for (const count of counts) {
      const data = Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `P${index}`, value: index % 100 }));
      const timings = [];
      for (let run = 0; run < 4; run += 1) {
        let chart;
        try {
          let start = performance.now();
          chart = createChart({ type: 'line', renderer: 'canvas', container: '#lifecycle-benchmark', width: 960, height: 480, data });
          const create = performance.now() - start;
          start = performance.now(); chart.update({ data }); const update = performance.now() - start;
          start = performance.now(); chart.resize(800, 400); const resize = performance.now() - start;
          start = performance.now(); chart.setTheme({ mode: 'dark' }); const theme = performance.now() - start;
          if (run) timings.push({ create, update, resize, theme });
        } finally { chart?.destroy(); host.replaceChildren(); }
      }
      const median = key => timings.map(item => item[key]).sort((left, right) => left - right)[1];
      reports.push({ count, ...Object.fromEntries(['create', 'update', 'resize', 'theme'].map(key => [key, Number(median(key).toFixed(2))])) });
    }
    return reports;
  } finally { host.remove(); }
}
