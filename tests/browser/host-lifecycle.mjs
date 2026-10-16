export async function verifyHostLifecycle(entries) {
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const waitForWidth = async (chart, width) => {
    for (let attempt = 0; attempt < 30 && chart.getSpec().width !== width; attempt += 1) await frame();
    return chart.getSpec().width === width;
  };
  const nativeObserver = window.ResizeObserver, activeObservers = new Set(), callbacks = [];
  window.ResizeObserver = class {
    constructor(callback) { callbacks.push(callback); this.native = new nativeObserver(callback); }
    observe(target) { activeObservers.add(this); this.native.observe(target); }
    disconnect() { activeObservers.delete(this); this.native.disconnect(); }
  };
  const reports = [];
  try {
    for (const [entry, url] of Object.entries(entries)) {
      const api = await import(url);
      const source = value => entry === 'project'
        ? { type: 'gantt', data: [{ id: 'plan', name: `Plan ${value}`, start: '2026-01-01', end: '2026-01-05' }] }
        : entry === 'diagram' ? { type: 'flow', nodes: [{ id: 'start', label: `Start ${value}`, kind: 'start' }, { id: 'end', label: 'Done', kind: 'end' }], edges: [{ id: 'edge', from: 'start', to: 'end' }] }
        : entry === 'board' ? { items: [{ id: 'label', kind: 'text', text: `Value ${value}`, position: { x: 20, y: 20 }, size: { width: 160, height: 48 } }] }
        : { type: 'line', data: [{ id: 'a', name: 'A', value }, { id: 'b', name: 'B', value: value + 2 }] };
      for (const renderer of ['svg', 'canvas']) {
        const host = document.createElement('div'); host.id = `host-${entry}-${renderer}`;
        Object.assign(host.style, { width: '640px', height: '320px' }); document.body.append(host);
        const create = container => entry === 'board'
          ? api.createBoard({ ...source(1), renderer, width: 640, height: 320 }).mount(container)
          : api.createChart({ ...source(1), renderer, width: 640, height: 320, container });
        let chart, observer, alive = true, sequence = 0;
        const checks = {};
        try {
          chart = create(`#${host.id}`);
          const mountCallbacks = callbacks.slice();
          if (entry !== 'root') {
            observer = new ResizeObserver(records => {
              const width = Math.round(records[0]?.contentRect.width || 0);
              if (alive && width && width !== chart.getSpec().width) {
                if (entry === 'board') chart.update({ width }); else chart.resize(width, 320);
              }
            });
            observer.observe(host);
          }
          await frame();
          host.style.width = '420px'; checks.parentResize = await waitForWidth(chart, 420);
          host.hidden = true; await frame(); checks.hiddenKeepsSize = chart.getSpec().width === 420;
          host.style.width = '520px'; host.hidden = false; checks.revealResizes = await waitForWidth(chart, 520);
          const load = async (value, delay) => {
            const token = ++sequence; await new Promise(resolve => setTimeout(resolve, delay));
            if (alive && token === sequence) chart.update(source(value));
          };
          await Promise.all([load(1, 40), load(7, 5)]);
          const spec = chart.getSpec();
          checks.lateResponseIgnored = entry === 'board' ? spec.items[0].text === 'Value 7' : entry === 'diagram' ? spec.nodes[0].label === 'Start 7' : entry === 'project' ? spec.data.values[0].name === 'Plan 7' : spec.data.values[0].value === 7;
          const before = JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
          try { chart.update({ renderer: 'invalid', background: '#abcdef' }); } catch {}
          checks.rejectionAtomic = before === JSON.stringify({ spec: chart.getSpec(), state: chart.getState() });
          if (entry === 'board') chart.update({ background: '#0f172a' }); else chart.setTheme('dark');
          checks.continuesAfterRejection = chart.getSpec().background === '#0f172a';
          const svg = new DOMParser().parseFromString(chart.export({ type: 'svg' }), 'image/svg+xml').documentElement;
          checks.svgDimensions = Number(svg.getAttribute('width')) === 520 && Number(svg.getAttribute('height')) === 320;
          const png = chart.export({ type: 'png' });
          {
            const image = new Image();
            await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = png; });
            checks.pngDimensions = image.width === 520 && image.height === 320;
          }
          const late = load(9, 20); alive = false; sequence += 1; observer?.disconnect(); chart.destroy();
          await late;
          checks.destroyedSurfaceRemoved = host.childElementCount === 0;
          checks.hostReferenceReleased = entry === 'board' ? chart._container === null : chart.container === null;
          checks.observersDisconnected = activeObservers.size === 0;
          let queuedSafe = true;
          if (entry === 'root') try { mountCallbacks.at(-1)?.([{ contentRect: { width: 600 } }]); } catch { queuedSafe = false; }
          checks.queuedResizeIgnored = queuedSafe;
          let missingRejected = false;
          try { const unused = create('#nonexistent-consumer-target'); unused.destroy(); } catch (error) { missingRejected = /container.*not.*found/i.test(error.message); }
          checks.missingTargetRejected = missingRejected;
          let cyclesClean = true;
          for (let cycle = 0; cycle < 3; cycle += 1) { const instance = create(`#${host.id}`); instance.destroy(); cyclesClean &&= host.childElementCount === 0; }
          checks.remountClean = cyclesClean && activeObservers.size === 0;
          const borrowed = renderer === 'svg' ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : document.createElement('canvas');
          host.append(borrowed); const instance = create(borrowed); instance.destroy();
          checks.callerSurfacePreserved = borrowed.parentNode === host;
          checks.elementBindingPortable = !Object.hasOwn(instance.getSpec(), 'container'); borrowed.remove();
          if (entry === 'board') {
            const destination = document.createElement('div'); document.body.append(destination);
            try {
              const board = create(host); board.mount(destination);
              checks.movedMountClean = host.childElementCount === 0 && destination.childElementCount === 1;
              board.destroy(); checks.movedDestroyClean = destination.childElementCount === 0;
            } finally { destination.remove(); }
          }
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = () => null;
          try {
            if (entry === 'board') {
              const board = api.createBoard({ ...source(1), renderer: 'canvas' });
              try { board.mount(host); } catch {}
              checks.failedBoardMountClean = host.childElementCount === 0;
              HTMLCanvasElement.prototype.getContext = getContext;
              board.mount(host); board.destroy();
            } else try { api.createChart({ ...source(1), container: host, renderer: 'canvas' }); } catch {}
            checks.initialFailureClean = host.childElementCount === 0 && activeObservers.size === 0;
          } finally { HTMLCanvasElement.prototype.getContext = getContext; }
          if (entry === 'root') {
            let destroyed = false;
            try { api.createChart({ ...source(1), container: host, renderer, plugins: [{ beforeRender() { throw new Error('host render failure'); }, destroy() { destroyed = true; } }] }); } catch {}
            checks.pluginFailureClean = destroyed && host.childElementCount === 0 && activeObservers.size === 0;
          }
          reports.push({ entry, renderer, checks });
        } finally { alive = false; observer?.disconnect(); chart?.destroy(); host.remove(); }
      }
    }
  } finally { window.ResizeObserver = nativeObserver; }
  return reports;
}
