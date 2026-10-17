export function edgeGapSpec({ type = 'flow', renderer = 'svg', vertical = false, reverse = false, scale = 1, size = 12, lineWidth = 3, label = 'Release' } = {}) {
  return {
    type, renderer, width: 900, height: 650, background: 'transparent',
    theme: { marks: { lineWidth }, typography: { axis: { size, font: `400 ${size}px system-ui` } } },
    diagram: { layout: 'manual', routing: 'auto' }, view: { scale, offsetX: 10, offsetY: 10 },
    nodes: [
      { id: 'a', label: 'A', position: { x: 80, y: 80 }, size: { width: 80, height: 40 } },
      { id: 'b', label: 'B', position: vertical ? { x: 80, y: 260 } : { x: 360, y: 80 }, size: { width: 80, height: 40 } }
    ],
    edges: [{ id: 'link', from: reverse ? 'b' : 'a', to: reverse ? 'a' : 'b', label }],
    ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {})
  };
}

export function crossingEdgeLabelSpec(renderer = 'svg') {
  const spec = edgeGapSpec({ renderer });
  spec.theme = { marks: { lineWidth: 3 } };
  spec.width = 768; spec.height = 450;
  spec.nodes.push({ id: 'c', label: 'C', position: { x: 220, y: 0 }, size: { width: 80, height: 40 } }, { id: 'd', label: 'D', position: { x: 220, y: 180 }, size: { width: 80, height: 40 } });
  spec.edges.push({ id: 'crossing', from: 'c', to: 'd' });
  return spec;
}

export function edgeLabelLayoutSpec(renderer = 'svg') {
  return {
    type: 'flow', renderer, width: 960, height: 520,
    title: { text: '带标签穿越路径', subtitle: '边标签不应被连线穿过' },
    theme: { mode: 'light', palette: 'soft', marks: { lineWidth: 3 } },
    diagram: { appearance: 'soft', cornerRadius: 18, routing: 'auto' },
    labels: { font: '17px "PingFang SC", system-ui', iconPosition: 'top' },
    nodes: [
      { id: 'a', label: '下单' }, { id: 'b', label: '支付校验' },
      { id: 'c', label: '风控审核' }, { id: 'd', label: '履约调度' },
      { id: 'e', label: '出库' }, { id: 'f', label: '签收' }
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b', label: '提交' },
      { id: 'e2', from: 'b', to: 'c', label: '进入风控' },
      { id: 'e3', from: 'c', to: 'd', label: '放行' },
      { id: 'e4', from: 'd', to: 'e', label: '分拣' },
      { id: 'e5', from: 'e', to: 'f', label: '配送' },
      { id: 'r1', from: 'c', to: 'a', label: '拒绝退回' },
      { id: 'r2', from: 'f', to: 'd', label: '退货重调度' }
    ]
  };
}

export function manualEdgeLabelSpec(type = 'flow', reverse = false) {
  return {
    type, width: 640, height: 420,
    diagram: { layout: 'manual', routing: 'auto' },
    nodes: [
      { id: 'a', label: 'A', position: { x: 80, y: 180 }, size: { width: 112, height: 48 } },
      { id: 'b', label: 'B', position: { x: 240, y: 180 }, size: { width: 112, height: 48 } }
    ],
    edges: [{ id: 'link', from: reverse ? 'b' : 'a', to: reverse ? 'a' : 'b', label: '进入风控' }],
    ...(type === 'swimlane' ? { lanes: [{ id: 'team', label: 'Team' }] } : {})
  };
}
