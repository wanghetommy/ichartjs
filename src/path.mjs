/** Shared cubic drawing paths and display-only text exclusions; hit sampling retains logical geometry. */
export function pathCommands(geometry) {
  if (geometry.exclusions?.length) return excludeCommands(pathCommands({ ...geometry, exclusions: null }), geometry.exclusions).commands;
  const points = geometry.renderPoints || geometry.points || [];
  if (!points.length) return [];
  if (geometry.curve === 'cubic' && points.length === 4) return [['M', points[0].x, points[0].y], ['C', ...points.slice(1).flatMap(point => [point.x, point.y])], ...(geometry.closed ? [['Z']] : [])];
  const commands = [], closed = geometry.closed;
  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
    const before = Math.hypot(point.x - previous.x, point.y - previous.y), after = Math.hypot(next.x - point.x, next.y - point.y);
    const radius = !closed && (!index || index === points.length - 1) ? 0 : Math.min(geometry.cornerRadii?.[index] ?? geometry.radius ?? 0, before / 2, after / 2);
    if (!(radius > 0) || !before || !after) { commands.push([index ? 'L' : 'M', point.x, point.y]); return; }
    const entry = { x: point.x + (previous.x - point.x) * radius / before, y: point.y + (previous.y - point.y) * radius / before };
    const exit = { x: point.x + (next.x - point.x) * radius / after, y: point.y + (next.y - point.y) * radius / after }, bend = 0.5522847498;
    commands.push([index ? 'L' : 'M', entry.x, entry.y], ['C', entry.x + (point.x - entry.x) * bend, entry.y + (point.y - entry.y) * bend, exit.x + (point.x - exit.x) * bend, exit.y + (point.y - exit.y) * bend, exit.x, exit.y]);
  });
  if (closed) commands.push(['Z']);
  return commands;
}

export function pathString(geometry) { return pathCommands(geometry).map(command => command.join(' ')).join(' '); }

export function samplePath(geometry) {
  const points = [];
  for (const [kind, ...values] of pathCommands({ ...geometry, exclusions: null })) {
    if (kind === 'M' || kind === 'L') points.push({ x: values[0], y: values[1] });
    else if (kind === 'C') {
      const start = points.at(-1);
      for (let step = 1; step <= 20; step += 1) {
        const ratio = step / 20, inverse = 1 - ratio;
        points.push({ x: inverse ** 3 * start.x + 3 * inverse ** 2 * ratio * values[0] + 3 * inverse * ratio ** 2 * values[2] + ratio ** 3 * values[4], y: inverse ** 3 * start.y + 3 * inverse ** 2 * ratio * values[1] + 3 * inverse * ratio ** 2 * values[3] + ratio ** 3 * values[5] });
      }
    }
  }
  return points;
}

export function rectanglePath(box) { return { points: [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }], closed: true, radius: box.radius }; }

function excludeCommands(commands, boxes) {
  const output = [];
  let current, tail, changed = false;
  const inside = (point, box) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  const emit = (start, command, end) => {
    if (!tail || tail.x !== start.x || tail.y !== start.y) output.push(['M', start.x, start.y]);
    output.push(command); tail = end;
  };
  const line = (start, end) => {
    const cuts = [0, 1], delta = { x: end.x - start.x, y: end.y - start.y };
    for (const box of boxes) for (const axis of ['x', 'y']) if (delta[axis]) for (const bound of [box[axis], box[axis] + box[axis === 'x' ? 'width' : 'height']]) {
      const ratio = (bound - start[axis]) / delta[axis];
      if (ratio > 0 && ratio < 1) cuts.push(ratio);
    }
    cuts.sort((left, right) => left - right);
    const point = ratio => ({ x: start.x + delta.x * ratio, y: start.y + delta.y * ratio });
    for (let index = 1; index < cuts.length; index += 1) {
      if (cuts[index] === cuts[index - 1]) continue;
      if (boxes.some(box => inside(point((cuts[index] + cuts[index - 1]) / 2), box))) { changed = true; tail = null; continue; }
      const first = point(cuts[index - 1]), last = point(cuts[index]);
      emit(first, ['L', last.x, last.y], last);
    }
  };
  const curve = (points, depth = 0) => {
    const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x)), top = Math.min(...points.map(point => point.y)), bottom = Math.max(...points.map(point => point.y));
    const nearby = boxes.filter(box => left <= box.x + box.width && right >= box.x && top <= box.y + box.height && bottom >= box.y);
    if (!nearby.length) { emit(points[0], ['C', ...points.slice(1).flatMap(point => [point.x, point.y])], points[3]); return; }
    if (nearby.some(box => points.every(point => inside(point, box))) || depth >= 14 || Math.max(right - left, bottom - top) < 0.1) { changed = true; tail = null; return; }
    const middle = (first, second) => ({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 });
    const first = middle(points[0], points[1]), second = middle(points[1], points[2]), third = middle(points[2], points[3]), before = middle(first, second), after = middle(second, third), split = middle(before, after);
    curve([points[0], first, before, split], depth + 1); curve([split, after, third, points[3]], depth + 1);
  };
  for (const [kind, ...values] of commands) {
    const end = { x: values.at(-2), y: values.at(-1) };
    if (kind === 'M') { current = end; tail = null; }
    else if (kind === 'L') { line(current, end); current = end; }
    else if (kind === 'C') { curve([current, { x: values[0], y: values[1] }, { x: values[2], y: values[3] }, end]); current = end; }
    else output.push([kind]);
  }
  return { commands: changed ? output : commands, changed };
}

export function pathIntersectsBox(geometry, box) { return excludeCommands(pathCommands({ ...geometry, exclusions: null }), [box]).changed; }
