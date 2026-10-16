export async function verifyExportDelivery(entries) {
  const reports = [], originalRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const imageData = async blob => {
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const result = { width: bitmap.width, height: bitmap.height, corner: [...pixels.slice(0, 4)], pixels };
    bitmap.close(); canvas.width = canvas.height = 0; return result;
  };
  const source = entry => entry === 'project'
    ? { type: 'gantt', data: [{ id: 'task', name: 'Deliver', start: '2026-01-01', end: '2026-01-05' }] }
    : entry === 'diagram' ? { type: 'flow', theme: { palette: 'soft' }, diagram: { appearance: 'soft' }, nodes: [{ id: 'a', label: 'Start', kind: 'start', icon: 'user', size: { width: 150, height: 80 } }, { id: 'b', label: 'Done', kind: 'end', icon: 'check', size: { width: 150, height: 80 } }], edges: [{ id: 'edge', from: 'a', to: 'b' }] }
    : entry === 'board' ? { items: [{ id: 'text', kind: 'text', text: 'Deliver', position: { x: 20, y: 20 }, size: { width: 120, height: 32 } }, { id: 'shape', kind: 'shape', icon: 'database', position: { x: 40, y: 80 }, size: { width: 60, height: 60 }, style: { fill: '#e1f0ee', stroke: '#008080' } }, { id: 'chart', kind: 'chart', position: { x: 160, y: 140 }, size: { width: 180, height: 100 }, spec: { type: 'line', data: [{ name: 'A', value: 1 }, { name: 'B', value: 3 }] } }] }
    : { type: 'line', title: { text: 'Deliver' }, data: [{ id: 'a', name: 'A', value: 2 }, { id: 'b', name: 'B', value: 5 }] };
  try {
    for (const [entry, url] of Object.entries(entries)) for (const renderer of ['svg', 'canvas']) for (const ratio of [1, 2]) {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: ratio });
      const api = await import(url), host = document.createElement('div'); host.style.width = '360px'; document.body.append(host);
      const input = { ...source(entry), renderer, width: 360, height: 260, background: '#ffffff' };
      const chart = entry === 'board' ? api.createBoard(input).mount(host) : api.createChart({ ...input, container: host });
      const checks = {}, artifacts = [];
      try {
        const surface = host.firstChild, markup = host.innerHTML, before = JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
        checks.strictFormats = ['pdf', 'application/not-svg', 'png-extra'].every(type => chart.export({ type }).code === 'EXPORT_TYPE_UNSUPPORTED');
        checks.strictRepresentations = ['svg', 'png', 'jpeg'].every(type => chart.export({ type, as: 'object' }).code === 'EXPORT_TYPE_UNSUPPORTED');
        for (const type of ['png', 'jpeg']) {
          const url = chart.export({ type }), blob = chart.export({ type, as: 'blob' });
          const bytes = new Uint8Array(await blob.arrayBuffer()), image = await imageData(blob);
          artifacts.push({ type, bytes: blob.size, width: image.width, height: image.height, corner: image.corner });
          checks[`${type}Mime`] = blob.type === `image/${type}` && url.startsWith(`data:image/${type};base64,`);
          checks[`${type}Signature`] = type === 'png' ? [...bytes.slice(0, 8)].join(',') === '137,80,78,71,13,10,26,10' : bytes[0] === 255 && bytes[1] === 216;
          checks[`${type}Dimensions`] = image.width === 360 && image.height === 260;
          checks[`${type}Background`] = image.corner.slice(0, 3).every(value => value > 245) && image.corner[3] === 255;
          checks[`${type}Content`] = image.pixels.some((value, index) => index % 4 !== 3 && value < 180);
          checks[`${type}StringAlias`] = chart.export({ type, as: 'string' }).startsWith(`data:image/${type};`);
        }
        const svg = chart.export({ type: 'svg', as: 'blob' }), xml = new DOMParser().parseFromString(await svg.text(), 'image/svg+xml');
        checks.svgContent = svg.type === 'image/svg+xml' && !xml.querySelector('parsererror') && /Deliver|Start/.test(xml.documentElement.textContent);
        if (entry === 'diagram' || entry === 'board') checks.builtInIcons = xml.querySelectorAll('[id^="icon-"]').length > 0;
        checks.svgDataurl = chart.export({ type: 'svg', as: 'dataurl' }).startsWith('data:image/svg+xml;');
        const object = chart.export({ type: 'json', as: 'object' }), json = chart.export({ type: 'json', as: 'blob' });
        checks.jsonRoundtrip = JSON.stringify(object) === JSON.stringify(JSON.parse(await json.text()));
        const getContext = HTMLCanvasElement.prototype.getContext, toDataURL = HTMLCanvasElement.prototype.toDataURL;
        try {
          HTMLCanvasElement.prototype.getContext = () => null;
          checks.contextDiagnostic = chart.export({ type: 'png' }).code === 'EXPORT_CONTEXT_UNAVAILABLE';
          HTMLCanvasElement.prototype.getContext = getContext;
          HTMLCanvasElement.prototype.toDataURL = () => { throw new DOMException('Blocked by origin policy', 'SecurityError'); };
          checks.taintDiagnostic = chart.export({ type: 'png' }).code === 'EXPORT_TAINTED_CANVAS';
        } finally { HTMLCanvasElement.prototype.getContext = getContext; HTMLCanvasElement.prototype.toDataURL = toDataURL; }
        checks.failureRecovery = chart.export({ type: 'png', as: 'blob' }) instanceof Blob;
        checks.viewUnchanged = surface === host.firstChild && markup === host.innerHTML && before === JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
        chart.update({ background: 'transparent' });
        const transparent = await imageData(chart.export({ type: 'png', as: 'blob' }));
        const opaque = await imageData(chart.export({ type: 'jpeg', as: 'blob' }));
        checks.transparentPng = transparent.corner[3] === 0;
        checks.whiteJpegMatte = opaque.corner.slice(0, 3).every(value => value > 245) && opaque.corner[3] === 255;
        chart.update({ background: '#0f172a' });
        const dark = await imageData(chart.export({ type: 'png', as: 'blob' }));
        checks.currentBackground = dark.corner.slice(0, 3).join(',') === '15,23,42';
        if (entry === 'board' && ratio === 1) {
          const square = document.createElement('canvas'); square.width = square.height = 8;
          const context = square.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 8, 8);
          const src = square.toDataURL(); square.width = square.height = 0;
          const image = { id: 'image', kind: 'image', assetId: 'asset', position: { x: 180, y: 80 }, size: { width: 40, height: 40 } };
          chart.update({ assets: [{ id: 'asset', type: 'image', src }], items: [...chart.getSpec().items, image] });
          checks.pendingAssetRejects = chart.export({ type: 'png' }).code === 'EXPORT_ASSET_UNAVAILABLE';
          chart.update({ items: chart.getSpec().items.map(item => item.id === 'image' ? { ...item, visible: false } : item) });
          checks.hiddenAssetDoesNotBlock = chart.export({ type: 'png', as: 'blob' }) instanceof Blob;
          chart.update({ items: chart.getSpec().items.map(item => item.id === 'image' ? { ...item, visible: true } : item) });
          await chart.ready();
          const loaded = await imageData(chart.export({ type: 'png', as: 'blob' })), offset = (100 * loaded.width + 200) * 4;
          checks.loadedAssetPixels = loaded.pixels[offset] === 255 && loaded.pixels[offset + 1] === 0;
          chart.update({ assets: [{ id: 'asset', type: 'image', src: 'data:image/png;base64,broken' }] });
          await chart.ready();
          checks.failedAssetRejects = chart.getState().assets[0].status === 'failed' && chart.export({ type: 'png' }).code === 'EXPORT_ASSET_UNAVAILABLE';
          chart.update({ assets: [{ id: 'asset', type: 'image', src }] }); await chart.ready();
          checks.assetRecovery = chart.export({ type: 'png', as: 'blob' }) instanceof Blob;
        }
        if (ratio === 1) {
          const free = entry === 'board' ? api.createBoard(input) : api.createChart(input);
          try { const image = await imageData(free.export({ type: 'png', as: 'blob' })); checks.unmountedDelivery = image.width === 360 && image.height === 260; }
          finally { free.destroy(); }
        }
        reports.push({ entry, renderer, ratio, checks, artifacts });
      } finally { chart.destroy(); host.remove(); }
    }
  } finally { if (originalRatio) Object.defineProperty(window, 'devicePixelRatio', originalRatio); }
  return reports;
}
