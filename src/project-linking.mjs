/**
 * Framework-neutral linked filters and selection helpers for project views.
 * Keeps linked state deterministic and based on stable record identifiers.
 */
import { copyJSON } from './schema.mjs';

function normalizeList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item)).filter(Boolean))];
}

function rowLabels(row) {
  const labels = row?.labels;
  return Array.isArray(labels) ? labels.map(item => String(item)).filter(Boolean) : typeof labels === 'string' ? [labels] : [];
}

function recordId(row, index) {
  return row?.id || row?.recordId || row?.date || `record-${index}`;
}

export function normalizeLinkedFilters(input = {}) {
  return copyJSON({
    owner: normalizeList(input.owner || input.owners),
    status: normalizeList(input.status || input.statuses),
    priority: normalizeList(input.priority || input.priorities),
    sprint: normalizeList(input.sprint || input.sprints),
    label: normalizeList(input.label || input.labels)
  });
}

export function normalizeLinkedSelection(input = []) {
  return normalizeList(input);
}

export function matchesLinkedFilters(row, filters = {}) {
  const normalized = normalizeLinkedFilters(filters);
  const labels = rowLabels(row);
  if (normalized.owner.length && !normalized.owner.includes(String(row?.owner || row?.resource || ''))) return false;
  if (normalized.status.length && !normalized.status.includes(String(row?.status || ''))) return false;
  if (normalized.priority.length && !normalized.priority.includes(String(row?.priority || ''))) return false;
  if (normalized.sprint.length && !normalized.sprint.includes(String(row?.sprint || ''))) return false;
  if (normalized.label.length && !normalized.label.some(label => labels.includes(label))) return false;
  return true;
}

export function filterProjectRows(inputRows, linked = {}) {
  const rows = Array.isArray(inputRows) ? inputRows.map(row => copyJSON(row)) : [];
  const filters = normalizeLinkedFilters(linked.filters || linked);
  return rows.filter(row => matchesLinkedFilters(row, filters));
}

export function createLinkedProjectState(inputRows, linked = {}) {
  const rows = Array.isArray(inputRows) ? inputRows : [];
  const filters = normalizeLinkedFilters(linked.filters || linked);
  const selection = normalizeLinkedSelection(linked.selection || linked.selectedRecordIds || []);
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const visibleRows = indexedRows.filter(({ row }) => matchesLinkedFilters(row, filters));
  const sourceRecordIds = indexedRows.map(({ row, index }) => recordId(row, index));
  const visibleRecordIds = visibleRows.map(({ row, index }) => recordId(row, index));
  return {
    filters,
    selection,
    selectedCount: selection.length,
    sourceCount: rows.length,
    visibleCount: visibleRows.length,
    sourceRecordIds,
    visibleRecordIds
  };
}

export function linkedRecordId(row, index) {
  return recordId(row, index);
}
