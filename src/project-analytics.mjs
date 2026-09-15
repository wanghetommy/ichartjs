/**
 * Project analytics, adapters, and deterministic schedule calculations.
 * Keeps derived values separate from source rows and prefers explicit rules.
 */
import { copyJSON, issue } from './schema.mjs';

const day = 86400000;
const weekdaySet = new Set([1, 2, 3, 4, 5]);
const dateValue = value => {
  if (value == null || value === '') return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const dateMs = value => dateValue(value)?.getTime() ?? NaN;
const dateLabel = value => dateValue(value)?.toISOString().slice(0, 10) ?? null;
const diffDays = (left, right) => {
  const start = dateMs(left), end = dateMs(right);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / day) : null;
};
const statusDone = value => value === 'done';

function normalizeArray(value) { return Array.isArray(value) ? copyJSON(value) : []; }

export function normalizeProjectCalendar(input = {}) {
  const calendar = copyJSON({
    timezone: input.timezone || 'UTC',
    workingWeekdays: Array.isArray(input.workingWeekdays) ? input.workingWeekdays : [...weekdaySet],
    holidays: Array.isArray(input.holidays) ? input.holidays : [],
    nonWorkingDayPolicy: input.nonWorkingDayPolicy || 'next-working-day'
  });
  const warnings = [];
  if (calendar.timezone !== 'UTC') {
    warnings.push(issue('UNSUPPORTED_TIMEZONE', 'calendar.timezone', `Unsupported timezone ${calendar.timezone}.`, 'Use UTC for deterministic calendar calculations.'));
    calendar.timezone = 'UTC';
  }
  const weekdays = calendar.workingWeekdays.filter(value => Number.isInteger(value) && value >= 0 && value <= 6);
  if (!weekdays.length) {
    warnings.push(issue('INVALID_WORKING_WEEKDAYS', 'calendar.workingWeekdays', 'Working weekdays were empty or invalid.', 'Use weekday integers 0-6.'));
    calendar.workingWeekdays = [...weekdaySet];
  } else calendar.workingWeekdays = [...new Set(weekdays)].sort((left, right) => left - right);
  calendar.holidays = calendar.holidays.map(dateLabel).filter(Boolean);
  if (!['next-working-day', 'previous-working-day', 'allow'].includes(calendar.nonWorkingDayPolicy)) {
    warnings.push(issue('INVALID_NON_WORKING_POLICY', 'calendar.nonWorkingDayPolicy', `Unsupported policy ${calendar.nonWorkingDayPolicy}.`, 'Use next-working-day, previous-working-day, or allow.'));
    calendar.nonWorkingDayPolicy = 'next-working-day';
  }
  return { calendar, warnings };
}

function isWorkingDay(date, calendar) {
  return calendar.workingWeekdays.includes(date.getUTCDay()) && !calendar.holidays.includes(date.toISOString().slice(0, 10));
}

export function applyWorkingCalendar(value, options = {}) {
  const { calendar } = normalizeProjectCalendar(options.calendar || options);
  const source = dateValue(value);
  if (!source) return { date: null, adjusted: false, warnings: [issue('INVALID_DATE', 'date', 'Calendar adjustment requires a valid date.')] };
  if (calendar.nonWorkingDayPolicy === 'allow' || isWorkingDay(source, calendar)) return { date: source.toISOString().slice(0, 10), adjusted: false, warnings: [] };
  const direction = calendar.nonWorkingDayPolicy === 'previous-working-day' ? -1 : 1;
  const probe = new Date(source);
  for (let step = 0; step < 370; step += 1) {
    probe.setUTCDate(probe.getUTCDate() + direction);
    if (isWorkingDay(probe, calendar)) return { date: probe.toISOString().slice(0, 10), adjusted: true, warnings: [] };
  }
  return { date: source.toISOString().slice(0, 10), adjusted: false, warnings: [issue('CALENDAR_RESOLUTION_FAILED', 'date', 'Working calendar could not find a valid working day within one year.')] };
}

function addWorkingDays(value, amount, calendar) {
  const source = dateValue(value);
  if (!source || !Number.isFinite(amount)) return null;
  const direction = amount < 0 ? -1 : 1;
  let remaining = Math.abs(Math.round(amount));
  const probe = new Date(source);
  while (remaining > 0) {
    probe.setUTCDate(probe.getUTCDate() + direction);
    if (isWorkingDay(probe, calendar)) remaining -= 1;
  }
  return probe.toISOString().slice(0, 10);
}

function workingSpanDays(start, end, calendar) {
  const first = dateValue(start), last = dateValue(end);
  if (!first || !last || last < first) return null;
  let days = 0;
  const probe = new Date(first);
  while (probe <= last) {
    if (isWorkingDay(probe, calendar)) days += 1;
    probe.setUTCDate(probe.getUTCDate() + 1);
  }
  return Math.max(1, days);
}

export function normalizeDependencies(rows, options = {}) {
  const warnings = [];
  const normalized = rows.map(row => {
    const dependencies = (row.dependencies || []).map((dependency, index) => {
      if (typeof dependency === 'string') return { id: dependency, type: 'finish-to-start', lag: 0, lead: 0 };
      if (dependency && typeof dependency === 'object' && typeof dependency.id === 'string') {
        const type = dependency.type || 'finish-to-start';
        if (!['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'].includes(type)) warnings.push(issue('UNSUPPORTED_DEPENDENCY_TYPE', `rows.${row.id || index}.dependencies.${index}.type`, `Unsupported dependency type ${type}.`, 'Use finish-to-start, start-to-start, finish-to-finish, or start-to-finish.'));
        return { id: dependency.id, type: ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'].includes(type) ? type : 'finish-to-start', lag: Number(dependency.lag || 0), lead: Number(dependency.lead || 0) };
      }
      warnings.push(issue('INVALID_DEPENDENCY', `rows.${row.id || index}.dependencies.${index}`, 'Dependency must be a string id or object with id.'));
      return null;
    }).filter(Boolean);
    return { ...copyJSON(row), dependencies };
  });
  return { rows: normalized, warnings };
}

function predecessorConstraint(predecessor, dependency, duration, calendar) {
  const offset = Number(dependency.lag || 0) - Number(dependency.lead || 0);
  const type = dependency.type || 'finish-to-start';
  if (type === 'start-to-start') return predecessor.earliestStart ? addWorkingDays(predecessor.earliestStart, offset, calendar) : null;
  if (type === 'finish-to-finish') {
    const finish = predecessor.earliestFinish ? addWorkingDays(predecessor.earliestFinish, offset, calendar) : null;
    return finish ? addWorkingDays(finish, -(duration - 1), calendar) : null;
  }
  if (type === 'start-to-finish') {
    const finish = predecessor.earliestStart ? addWorkingDays(predecessor.earliestStart, offset, calendar) : null;
    return finish ? addWorkingDays(finish, -(duration - 1), calendar) : null;
  }
  return predecessor.earliestFinish ? addWorkingDays(predecessor.earliestFinish, 1 + offset, calendar) : null;
}

function successorConstraint(successor, dependency, duration, calendar) {
  const offset = Number(dependency.lag || 0) - Number(dependency.lead || 0);
  const type = dependency.type || 'finish-to-start';
  if (type === 'start-to-start') return successor.latestStart ? addWorkingDays(successor.latestStart, -offset, calendar) : null;
  if (type === 'finish-to-finish') {
    const finish = successor.latestFinish ? addWorkingDays(successor.latestFinish, -offset, calendar) : null;
    return finish ? addWorkingDays(finish, -(duration - 1), calendar) : null;
  }
  if (type === 'start-to-finish') {
    const finish = successor.latestFinish ? addWorkingDays(successor.latestFinish, -offset, calendar) : null;
    return finish || null;
  }
  const latestFinish = successor.latestStart ? addWorkingDays(successor.latestStart, -1 - offset, calendar) : null;
  return latestFinish ? addWorkingDays(latestFinish, -(duration - 1), calendar) : null;
}

export function analyzeSchedule(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const { calendar, warnings: calendarWarnings } = normalizeProjectCalendar(options.calendar || {});
  const { rows: normalizedRows, warnings: dependencyWarnings } = normalizeDependencies(rows, options);
  const warnings = [...calendarWarnings, ...dependencyWarnings];
  const taskMap = new Map();
  normalizedRows.forEach((row, index) => {
    const startAdjustment = applyWorkingCalendar(row.start, { calendar });
    const endAdjustment = applyWorkingCalendar(row.end, { calendar });
    if (!row.start || !row.end) warnings.push(issue('INCOMPLETE_DATES', `rows.${index}`, 'Task requires both start and end dates.'));
    if (row.start && row.end && dateMs(row.end) < dateMs(row.start)) warnings.push(issue('INVERTED_RANGE', `rows.${index}`, 'Task end precedes task start.'));
    if (row.status && statusDone(row.status) && Number(row.progress || 0) < 100) warnings.push(issue('INCONSISTENT_COMPLETION', `rows.${index}`, 'Done task has progress below 100.'));
    if (row.progress >= 100 && row.status && !statusDone(row.status)) warnings.push(issue('INCONSISTENT_COMPLETION', `rows.${index}`, 'Progress is 100 but status is not done.'));
    const duration = workingSpanDays(startAdjustment.date || row.start, endAdjustment.date || row.end, calendar) || 1;
    taskMap.set(row.id, {
      ...row,
      dependencies: row.dependencies || [],
      adjustedStart: startAdjustment.date || row.start || null,
      adjustedEnd: endAdjustment.date || row.end || null,
      duration,
      successors: [],
      warnings: [...startAdjustment.warnings, ...endAdjustment.warnings]
    });
  });
  taskMap.forEach(task => task.dependencies.forEach(dependency => {
    const predecessor = taskMap.get(dependency.id);
    if (!predecessor) warnings.push(issue('MISSING_DEPENDENCY', `rows.${task.id}.dependencies`, `Dependency ${dependency.id} was not found.`, 'Use an existing task id.'));
    else predecessor.successors.push({ id: task.id, dependency });
  }));
  const pending = new Map([...taskMap.values()].map(task => [task.id, task.dependencies.filter(dependency => taskMap.has(dependency.id)).length]));
  const queue = [...taskMap.keys()].filter(id => pending.get(id) === 0);
  const order = [];
  for (let index = 0; index < queue.length; index += 1) {
    const current = taskMap.get(queue[index]);
    current.earliestStart = current.adjustedStart;
    current.dependencies.forEach(dependency => {
      const predecessor = taskMap.get(dependency.id);
      if (!predecessor) return;
      const candidate = predecessorConstraint(predecessor, dependency, current.duration, calendar);
      if (candidate && dateMs(candidate) > dateMs(current.earliestStart)) current.earliestStart = candidate;
    });
    current.earliestFinish = addWorkingDays(current.earliestStart, current.duration - 1, calendar) || current.adjustedEnd || current.earliestStart;
    order.push(current);
    current.successors.forEach(successor => {
      pending.set(successor.id, pending.get(successor.id) - 1);
      if (pending.get(successor.id) === 0) queue.push(successor.id);
    });
  }
  if (order.length !== taskMap.size) warnings.push(issue('CYCLIC_DEPENDENCY', 'rows', 'Dependencies contain a cycle.', 'Dependencies must form a directed acyclic graph.'));
  const projectFinish = order.reduce((latest, task) => {
    const finish = dateMs(task.earliestFinish);
    return !Number.isFinite(finish) || finish <= latest ? latest : finish;
  }, -Infinity);
  [...order].reverse().forEach(task => {
    const successorStarts = task.successors.map(successor => successorConstraint(taskMap.get(successor.id), successor.dependency, task.duration, calendar)).filter(Boolean);
    task.latestStart = successorStarts.length ? successorStarts.sort((left, right) => dateMs(left) - dateMs(right))[0] : addWorkingDays(dateLabel(projectFinish), -(task.duration - 1), calendar);
    task.latestFinish = addWorkingDays(task.latestStart, task.duration - 1, calendar) || task.latestStart;
    task.float = Math.max(0, diffDays(task.earliestStart, task.latestStart) ?? 0);
    task.slack = task.float;
    task.critical = task.float === 0;
    task.baselineVarianceDays = rowVariance(task.baselineEnd, task.actualEnd || task.adjustedEnd || task.end);
    task.startVarianceDays = rowVariance(task.baselineStart || task.start, task.actualStart || task.adjustedStart || task.start);
    task.endVarianceDays = rowVariance(task.baselineEnd || task.end, task.actualEnd || task.adjustedEnd || task.end);
  });
  const tasks = order.map(task => ({
    id: task.id,
    earliestStart: task.earliestStart,
    earliestFinish: task.earliestFinish,
    latestStart: task.latestStart,
    latestFinish: task.latestFinish,
    float: task.float,
    slack: task.slack,
    critical: task.critical,
    baselineVarianceDays: task.baselineVarianceDays,
    startVarianceDays: task.startVarianceDays,
    endVarianceDays: task.endVarianceDays,
    dependencies: task.dependencies,
    adjustedStart: task.adjustedStart,
    adjustedEnd: task.adjustedEnd
  }));
  const criticalIds = tasks.filter(task => task.critical).map(task => task.id);
  const criticalEdges = tasks.flatMap(task => task.dependencies.filter(dependency => criticalIds.includes(task.id) && criticalIds.includes(dependency.id || dependency)).map(dependency => ({ from: dependency.id || dependency, to: task.id })));
  const assumptions = [
    `Schedule calculations use timezone ${calendar.timezone}.`,
    `Working weekdays: ${calendar.workingWeekdays.join(', ')}.`,
    `Non-working day policy: ${calendar.nonWorkingDayPolicy}.`
  ];
  const projectStart = tasks.reduce((earliest, task) => {
    const start = dateMs(task.earliestStart);
    return !Number.isFinite(start) || (Number.isFinite(earliest) && start >= earliest) ? earliest : start;
  }, Infinity);
  const duration = Number.isFinite(projectFinish) && Number.isFinite(projectStart) ? Math.max(0, diffDays(dateLabel(projectStart), dateLabel(projectFinish)) ?? 0) : 0;
  return { calendar, tasks, criticalIds, criticalEdges, duration, assumptions, warnings, rows: normalizedRows.map(row => ({ ...row })) };
}

function rowVariance(source, target) {
  if (!source || !target) return null;
  const diff = diffDays(source, target);
  return diff == null ? null : diff;
}

export function analyzeBurndownSeries(inputRows, options = {}) {
  const rows = normalizeArray(inputRows).map((row, dataIndex) => ({ ...row, dataIndex, time: dateMs(row.date), remaining: Number(row.remaining ?? row.actual ?? row.value), scopeChange: Number(row.scopeChange || 0) })).filter(row => Number.isFinite(row.time)).sort((left, right) => left.time - right.time);
  if (!rows.length) return { samples: [], forecast: { date: null, reason: 'insufficient-data' }, assumptions: ['Forecast requires at least one dated sample.'], warnings: [issue('INSUFFICIENT_DATA', 'rows', 'Burndown forecast requires dated samples.')] };
  const first = rows[0], last = rows.at(-1), initialScope = options.initialScope ?? first.remaining;
  let scope = initialScope;
  rows.forEach(row => { scope += row.scopeChange; row.scope = scope; row.completed = scope - row.remaining; });
  const elapsedDays = (last.time - first.time) / day;
  const completed = last.completed - first.completed;
  const velocity = elapsedDays > 0 ? completed / elapsedDays : 0;
  let forecast = { date: null, velocity, reason: rows.length < 2 ? 'insufficient-data' : 'non-positive-velocity' };
  if (last.remaining === 0) forecast = { date: dateLabel(last.time), velocity, reason: 'complete' };
  else if (velocity > 0) forecast = { date: dateLabel(last.time + last.remaining / velocity * day), time: last.time + last.remaining / velocity * day, velocity, reason: 'estimated' };
  const start = options.start ? dateMs(options.start) : first.time;
  const end = options.end ? dateMs(options.end) : last.time;
  rows.forEach(row => { row.ideal = row.ideal ?? Math.max(0, initialScope * (1 - (row.time - start) / Math.max(day, end - start))); });
  return { samples: rows, initialScope, start, end, forecast, assumptions: [`Forecast velocity uses ${rows.length} burndown samples.`], warnings: [] };
}

export function analyzeCapacity(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const warnings = [];
  const byKey = new Map();
  const defaultCapacity = Number(options.defaultCapacity ?? 1);
  rows.forEach((row, index) => {
    const key = row.resource || row.owner;
    if (!key) { warnings.push(issue('MISSING_RESOURCE', `rows.${index}`, 'Task is missing owner/resource for capacity analysis.', 'Add owner or resource fields.')); return; }
    const start = row.actualStart || row.start, end = row.actualEnd || row.end;
    const duration = diffDays(start, end);
    const load = Number(row.load ?? row.points ?? 1) * Math.max(1, (duration ?? 0) + 1);
    const entry = byKey.get(key) || { id: key, name: key, load: 0, capacity: Number(row.capacity ?? defaultCapacity), taskIds: [] };
    entry.load += load;
    entry.capacity = Number(row.capacity ?? entry.capacity ?? defaultCapacity);
    entry.taskIds.push(row.id);
    byKey.set(key, entry);
  });
  const rowsOut = [...byKey.values()].map(item => ({ ...item, overload: Math.max(0, item.load - item.capacity), available: Math.max(0, item.capacity - item.load), status: item.load > item.capacity ? 'overloaded' : 'balanced' }));
  rowsOut.forEach((row, index) => { if (!(row.capacity > 0)) warnings.push(issue('MISSING_CAPACITY', `capacity.${index}`, 'Capacity must be positive to evaluate overload.')); });
  return { rows: rowsOut, warnings, assumptions: [`Default capacity per resource: ${defaultCapacity}.`] };
}

export function buildCapacityView(inputRows, options = {}) {
  const analysis = analyzeCapacity(inputRows, options);
  return { ...analysis, chartType: options.chartType || 'column', values: analysis.rows.map(row => ({ name: row.name, value: row.load, capacity: row.capacity, overload: row.overload, status: row.status, recordIds: row.taskIds })) };
}

export function buildCumulativeFlowSeries(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const warnings = [];
  const grouped = new Map();
  rows.forEach((row, index) => {
    const date = dateLabel(row.date || row.snapshotDate);
    if (!date) { warnings.push(issue('INVALID_DATE', `rows.${index}`, 'Status history row requires a date.')); return; }
    const target = grouped.get(date) || { date };
    if (row.counts && typeof row.counts === 'object') Object.entries(row.counts).forEach(([status, value]) => { target[status] = Number(target[status] || 0) + Number(value || 0); });
    else if (row.status) target[row.status] = Number(target[row.status] || 0) + Number(row.count || 1);
    grouped.set(date, target);
  });
  const values = [...grouped.values()].sort((left, right) => dateMs(left.date) - dateMs(right.date)).map(row => ({ ...row, total: Object.entries(row).filter(([key]) => key !== 'date').reduce((sum, [, value]) => sum + Number(value || 0), 0) }));
  return { values, chartType: options.chartType || 'area', warnings, assumptions: ['Cumulative flow is generated from explicit status counts or status snapshots.'] };
}

export function buildVelocitySeries(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const sprintField = options.sprintField || 'sprint', pointsField = options.pointsField || 'points', statusField = options.statusField || 'status';
  const grouped = new Map(), warnings = [];
  rows.forEach((row, index) => {
    const sprint = row[sprintField] || 'Unscheduled';
    const target = grouped.get(sprint) || { sprint, completed: 0, scope: 0, count: 0 };
    const points = Number(row[pointsField] ?? 1);
    if (!Number.isFinite(points) || points < 0) { warnings.push(issue('INVALID_POINTS', `rows.${index}.${pointsField}`, 'Velocity points must be a finite non-negative number.')); return; }
    target.scope += points;
    if (statusDone(row[statusField])) target.completed += points;
    target.count += 1;
    grouped.set(sprint, target);
  });
  const values = [...grouped.values()].map(row => ({ name: row.sprint, value: row.completed, scope: row.scope, completionRate: row.scope ? row.completed / row.scope : 0 }));
  return { values, chartType: options.chartType || 'column', warnings, assumptions: [`Velocity uses ${pointsField} grouped by ${sprintField}.`] };
}

export function buildReleaseForecast(inputRows, options = {}) {
  const burndown = analyzeBurndownSeries(inputRows, options);
  const values = burndown.samples.map(sample => ({ date: sample.date, remaining: sample.remaining, scope: sample.scope, forecast: burndown.forecast.date }));
  return { ...burndown, values, chartType: options.chartType || 'burndown', warnings: burndown.warnings, assumptions: [...burndown.assumptions, 'Release forecast is an estimate, not a commitment.'] };
}

export function buildRiskMatrixSeries(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const warnings = [];
  const values = rows.map((row, index) => {
    const probability = Number(row.probability ?? row.likelihood ?? 0);
    const impact = Number(row.impact ?? row.severity ?? 0);
    if (![probability, impact].every(value => Number.isFinite(value) && value >= 0)) { warnings.push(issue('INVALID_RISK_VALUE', `rows.${index}`, 'Risk probability and impact must be finite non-negative numbers.')); return null; }
    const score = probability * impact;
    const quadrant = probability >= (options.probabilityThreshold ?? 3) && impact >= (options.impactThreshold ?? 3) ? 'high-high' : probability >= (options.probabilityThreshold ?? 3) ? 'high-low' : impact >= (options.impactThreshold ?? 3) ? 'low-high' : 'low-low';
    return { name: row.title || row.id || `Risk ${index + 1}`, x: probability, y: impact, value: score, quadrant, recordId: row.id || `risk-${index}` };
  }).filter(Boolean);
  return { values, chartType: options.chartType || 'scatter', warnings, assumptions: ['Risk matrix uses probability on x and impact on y.'] };
}

export function buildIssueAgingSeries(inputRows, options = {}) {
  const rows = normalizeArray(inputRows);
  const now = dateValue(options.today);
  const warnings = [];
  const buckets = options.buckets || [{ label: '0-7', max: 7 }, { label: '8-14', max: 14 }, { label: '15-30', max: 30 }, { label: '31+', max: Infinity }];
  const counts = new Map(buckets.map(bucket => [bucket.label, 0]));
  if (!now) warnings.push(issue('MISSING_REFERENCE_DATE', 'options.today', 'Issue aging requires an explicit valid today reference.', 'Pass today as an ISO date for reproducible results.'));
  const values = now ? rows.map((row, index) => {
    const created = dateValue(row.createdAt || row.created || row.openedAt || row.date);
    if (!created) { warnings.push(issue('INVALID_CREATED_DATE', `rows.${index}`, 'Issue aging requires a valid created/opened date.')); return null; }
    const ageDays = Math.max(0, Math.floor((now.getTime() - created.getTime()) / day));
    const bucket = buckets.find(candidate => ageDays <= candidate.max) || buckets.at(-1);
    counts.set(bucket.label, counts.get(bucket.label) + 1);
    return { ...row, name: row.title || row.id || `Issue ${index + 1}`, ageDays, bucket: bucket.label, recordId: row.id || `issue-${index}` };
  }).filter(Boolean) : [];
  return { values: [...counts.entries()].map(([name, value]) => ({ name, value })), details: values, chartType: options.chartType || 'bar', warnings, assumptions: ['Issue aging uses created/opened date against the provided today reference.'] };
}
