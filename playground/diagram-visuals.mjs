import { getCapabilities, resolveTheme } from './runtime.mjs';

export function createSoftFlow(width = 560) {
  const node = (id, label, icon, x, y, portion = 0.25, tone = 'accent') => ({ id, label, icon, tone, kind: 'process', position: { x: width * x, y }, size: { width: width * portion, height: 64 } });
  return {
    type: 'flow', width, height: 450, renderer: 'svg', theme: { mode: 'light', palette: 'soft' },
    title: { text: 'Agent approval workflow', subtitle: 'Soft visuals · explicit roles · shared geometry' },
    diagram: { appearance: 'soft', layout: 'manual', routing: 'auto' },
    nodes: [{ ...node('request', 'User request', 'user', 0.03, 62, 0.28), kind: 'start', size: { width: width * 0.28, height: 80 } }, node('agent', 'Agent drafts action', 'agent', 0.365, 70), { ...node('risk', 'Risk check', 'shield', 0.70, 70), ports: [{ id: 'low', side: 'bottom', offset: 0.25 }, { id: 'high', side: 'bottom', offset: 0.75 }] }, node('auto', 'Auto-execute', 'bolt', 0.10, 220, 0.3, 'success'), node('human', 'Human approval', 'user', 0.61, 220, 0.34, 'danger'), { ...node('audit', 'Audit log', 'document', 0.33, 360, 0.4, 'secondary'), kind: 'end', ports: [{ id: 'auto', side: 'top', offset: 0.25 }, { id: 'human', side: 'top', offset: 0.75 }] }],
    edges: [{ id: 'request-agent', from: 'request', to: 'agent' }, { id: 'agent-risk', from: 'agent', to: 'risk' }, { id: 'low', from: 'risk', fromPort: 'low', to: 'auto', label: 'Low risk', tone: 'success' }, { id: 'high', from: 'risk', fromPort: 'high', to: 'human', label: 'High risk', tone: 'danger' }, { id: 'auto-audit', from: 'auto', to: 'audit', toPort: 'auto', tone: 'success' }, { id: 'human-audit', from: 'human', to: 'audit', toPort: 'human', tone: 'secondary' }]
  };
}

export function createIconBoard(mode = 'light') {
  const theme = resolveTheme({ mode, palette: 'soft' });
  return { width: 800, height: 450, renderer: 'svg', background: theme.background, items: getCapabilities().diagram.visuals.icons.flatMap((name, index) => {
    const x = 25 + index % 8 * 96, y = 32 + Math.floor(index / 8) * 200;
    return [{ id: `badge-${name}`, kind: 'shape', shape: 'ellipse', icon: name, position: { x: x + 14, y }, size: { width: 58, height: 58 }, style: { fill: theme.surface, stroke: theme.colors[index % theme.colors.length], strokeWidth: 1.5 } }, { id: `label-${name}`, kind: 'text', text: name, position: { x, y: y + 70 }, size: { width: 88, height: 54 }, textAlign: 'center', fontSize: 13, style: { fill: theme.text } }];
  }) };
}
