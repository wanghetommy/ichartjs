/** Shared cubic path construction for drawing, SVG serialization and hit sampling. */
export function pathCommands(geometry) {
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
  for (const [kind, ...values] of pathCommands(geometry)) {
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
