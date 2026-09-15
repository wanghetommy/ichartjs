/**
 * Business and diagram edit preview/commit primitives.
 * Validates schemas and commands before producing deterministic patches.
 */
import { copyJSON, getBusinessSchema, issue, validateDataSchema } from './schema.mjs';
import { validateData } from './validation.mjs';
import { commandCapabilities, normalizeCommand, validateCommand } from './command.mjs';
import { validateDiagram } from './diagram.mjs';

const day = 86400000;
const plusDays = (value, days) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const equality = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const recordId = operation => operation.recordId ?? operation.taskId ?? operation.nodeId ?? operation.edgeId;
const diagramOperationTypes = new Set(['moveNode', 'moveNodes', 'moveNodeToLane', 'resizeNode', 'alignNodes', 'snapNodes', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'updateEdge', 'toggleGroupCollapse', 'addEdge', 'duplicateSelection', 'pasteSelection']);
const structureOperationTypes = new Set(['assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'toggleGroupCollapse', 'addEdge', 'duplicateSelection', 'pasteSelection']);

export function businessModelForType(type) {
  return { gantt: 'project-task', timeline: 'timeline-event', milestone: 'milestone', burndown: 'burndown-sample', flow: 'flow-node', swimlane: 'flow-node' }[type] || type;
}

function jsonValue(value) { return value === undefined ? null : copyJSON(value); }
function change(before, after, path, operation) { return { path, before: jsonValue(before), after: jsonValue(after), operation: operation.op }; }
function nextId(rows, prefix) { let index = rows.length + 1; while (rows.some(row => row?.id === `${prefix}-${index}`)) index += 1; return `${prefix}-${index}`; }
function uniqueId(existing, preferred) { let index = 1, value = preferred; while (existing.has(value)) value = `${preferred}-${index++}`; existing.add(value); return value; }
function duplicateEdge(edges, edge) { return edges.some(item => item.from === edge.from && item.to === edge.to && (item.fromPort || null) === (edge.fromPort || null) && (item.toPort || null) === (edge.toPort || null)); }

function previewDiagramEdit(command, options = {}) {
  const nodeSchemaResult = validateDataSchema(options.nodeSchema || options.schema || getBusinessSchema('flow-node'));
  const edgeSchemaResult = validateDataSchema(options.edgeSchema || getBusinessSchema('flow-edge'));
  const errors = [...nodeSchemaResult.errors, ...edgeSchemaResult.errors], warnings = [], changes = [], patches = [], affected = new Set();
  const beforeNodes = copyJSON(options.nodes || options.values || []), beforeEdges = copyJSON(options.edges || []), beforeGroups = copyJSON(options.groups || []), lanes = copyJSON(options.lanes || []);
  if (!nodeSchemaResult.valid || !edgeSchemaResult.valid) return result({ valid: false, errors, command, changes, patches, affectedRecords: [], warnings, requiresConfirmation: false });
  const nodes = copyJSON(beforeNodes), edges = copyJSON(beforeEdges), groups = copyJSON(beforeGroups), nodeIds = new Set(nodes.map(row => row.id)), edgeIds = new Set(edges.map(row => row.id).filter(Boolean));
  const nodeIndex = () => new Map(nodes.map((row, rowIndex) => [row.id, { row, rowIndex }]));
  const edgeIndex = () => new Map(edges.map((row, rowIndex) => [row.id || `edge-${rowIndex}`, { row, rowIndex }]));
  const groupIndex = () => new Map(groups.map((row, rowIndex) => [row.id, { row, rowIndex }]));
  const editable = (schema, field) => schema?.fields?.[field]?.editable !== false && schema?.fields?.[field]?.agentEditable !== false;
  const setField = (collection, hit, field, value, operation, opIndex, schemaName) => {
    const schema = schemaName === 'edges' ? edgeSchemaResult.schema : nodeSchemaResult.schema;
    if (!editable(schema, field)) { errors.push(issue('READ_ONLY_FIELD', `command.operations.${opIndex}.changes.${field}`, `Field ${field} is not editable by an Agent.`)); return; }
    const before = hit.row[field];
    hit.row[field] = copyJSON(value);
    changes.push(change(before, hit.row[field], `${schemaName}.${hit.rowIndex}.${field}`, operation));
    patches.push({ op: 'replace', path: `/${schemaName}/${hit.rowIndex}/${field}`, value: copyJSON(value) });
    if (hit.row.id) affected.add(hit.row.id);
  };
  const ensureStructureAllowed = (operation, opIndex) => {
    if (!structureOperationTypes.has(operation.op)) return true;
    if (options.allowStructuralChanges === true) return true;
    errors.push(issue('STRUCTURAL_EDIT_DISABLED', `command.operations.${opIndex}`, 'Structural diagram edits require editing.allowStructuralChanges.'));
    return false;
  };

  command.operations.forEach((operation, opIndex) => {
    if (!diagramOperationTypes.has(operation.op)) return;
    if (!ensureStructureAllowed(operation, opIndex)) return;
    if (['moveNodes', 'alignNodes', 'snapNodes'].includes(operation.op)) {
      const index = nodeIndex(), hits = operation.nodeIds.map(id => index.get(id));
      if (hits.some(hit => !hit)) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}.nodeIds`, 'One or more diagram nodes were not found.')); return; }
      const positions = hits.map(hit => ({ hit, position: { ...(hit.row.position || { x: 0, y: 0 }) } }));
      if (operation.op === 'moveNodes') positions.forEach(item => { item.position.x += operation.delta.x; item.position.y += operation.delta.y; });
      if (operation.op === 'alignNodes') {
        const sizes = positions.map(item => ({ width: Number(item.hit.row.size?.width) || 112, height: Number(item.hit.row.size?.height) || 36 }));
        const bounds = positions.map((item, index) => ({ left: item.position.x, top: item.position.y, right: item.position.x + sizes[index].width, bottom: item.position.y + sizes[index].height, center: item.position.x + sizes[index].width / 2, middle: item.position.y + sizes[index].height / 2 }));
        const target = operation.alignment === 'left' ? Math.min(...bounds.map(item => item.left))
          : operation.alignment === 'right' ? Math.max(...bounds.map(item => item.right))
            : operation.alignment === 'top' ? Math.min(...bounds.map(item => item.top))
              : operation.alignment === 'bottom' ? Math.max(...bounds.map(item => item.bottom))
                : operation.alignment === 'center' ? bounds.reduce((sum, item) => sum + item.center, 0) / bounds.length
                  : bounds.reduce((sum, item) => sum + item.middle, 0) / bounds.length;
        positions.forEach((item, index) => {
          if (operation.alignment === 'left') item.position.x = target;
          else if (operation.alignment === 'right') item.position.x = target - sizes[index].width;
          else if (operation.alignment === 'top') item.position.y = target;
          else if (operation.alignment === 'bottom') item.position.y = target - sizes[index].height;
          else if (operation.alignment === 'center') item.position.x = target - sizes[index].width / 2;
          else item.position.y = target - sizes[index].height / 2;
        });
      }
      if (operation.op === 'snapNodes') positions.forEach(item => { const grid = Number(options.grid) || 8; item.position.x = Math.round(item.position.x / grid) * grid; item.position.y = Math.round(item.position.y / grid) * grid; });
      positions.forEach(item => setField(nodes, item.hit, 'position', item.position, operation, opIndex, 'nodes'));
      return;
    }

    if (['moveNode', 'resizeNode', 'moveNodeToLane'].includes(operation.op)) {
      const hit = nodeIndex().get(recordId(operation));
      if (!hit) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}`, `Record ${recordId(operation)} was not found.`)); return; }
      if (operation.op === 'moveNode') setField(nodes, hit, 'position', operation.position, operation, opIndex, 'nodes');
      if (operation.op === 'resizeNode') setField(nodes, hit, 'size', operation.size, operation, opIndex, 'nodes');
      if (operation.op === 'moveNodeToLane') setField(nodes, hit, 'laneId', operation.laneId, operation, opIndex, 'nodes');
      return;
    }

    if (operation.op === 'moveGroup') {
      if (!groupIndex().has(operation.groupId)) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const hits = nodes.filter(node => node.groupId === operation.groupId).map(node => nodeIndex().get(node.id));
      if (!hits.length) { errors.push(issue('EMPTY_GROUP', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} has no member nodes.`)); return; }
      hits.forEach(hit => setField(nodes, hit, 'position', { x: Number(hit.row.position?.x || 0) + operation.delta.x, y: Number(hit.row.position?.y || 0) + operation.delta.y }, operation, opIndex, 'nodes'));
      return;
    }

    if (operation.op === 'resizeGroup') {
      if (!groupIndex().has(operation.groupId)) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const hits = nodes.filter(node => node.groupId === operation.groupId).map(node => nodeIndex().get(node.id));
      if (!hits.length) { errors.push(issue('EMPTY_GROUP', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} has no member nodes.`)); return; }
      const boxes = hits.map(hit => ({ x: Number(hit.row.position?.x || 0), y: Number(hit.row.position?.y || 0), width: Number(hit.row.size?.width || 112), height: Number(hit.row.size?.height || 36) }));
      const left = Math.min(...boxes.map(box => box.x)), top = Math.min(...boxes.map(box => box.y)), right = Math.max(...boxes.map(box => box.x + box.width)), bottom = Math.max(...boxes.map(box => box.y + box.height));
      const scaleX = operation.size.width / Math.max(1, right - left), scaleY = operation.size.height / Math.max(1, bottom - top);
      hits.forEach((hit, index) => {
        setField(nodes, hit, 'position', { x: left + (boxes[index].x - left) * scaleX, y: top + (boxes[index].y - top) * scaleY }, operation, opIndex, 'nodes');
        setField(nodes, hit, 'size', { width: boxes[index].width * scaleX, height: boxes[index].height * scaleY }, operation, opIndex, 'nodes');
      });
      return;
    }

    if (operation.op === 'assignNodesToGroup') {
      if (operation.groupId !== null && !groupIndex().has(operation.groupId)) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const index = nodeIndex(), hits = [...new Set(operation.nodeIds)].map(id => index.get(id));
      if (hits.some(hit => !hit)) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}.nodeIds`, 'One or more diagram nodes were not found.')); return; }
      hits.forEach(hit => {
        const before = hit.row.groupId;
        if (operation.groupId === null) delete hit.row.groupId;
        else hit.row.groupId = operation.groupId;
        affected.add(hit.row.id);
        changes.push(change(before, hit.row.groupId, `nodes.${hit.rowIndex}.groupId`, operation));
        patches.push(operation.groupId === null ? { op: 'remove', path: `/nodes/${hit.rowIndex}/groupId` } : { op: before === undefined ? 'add' : 'replace', path: `/nodes/${hit.rowIndex}/groupId`, value: operation.groupId });
      });
      return;
    }

    if (operation.op === 'duplicateGroup') {
      const hit = groupIndex().get(operation.groupId);
      if (!hit) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const members = nodes.filter(node => node.groupId === operation.groupId);
      if (!members.length) { errors.push(issue('EMPTY_GROUP', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} has no member nodes.`)); return; }
      const groupId = uniqueId(new Set(groups.map(group => group.id)), `${operation.groupId}-copy`);
      const group = { ...copyJSON(hit.row), id: groupId, label: `${hit.row.label || hit.row.id} copy`, collapsed: false };
      groups.push(group);
      affected.add(group.id);
      changes.push(change(undefined, group, `groups.${groups.length - 1}`, operation));
      patches.push({ op: 'add', path: `/groups/${groups.length - 1}`, value: copyJSON(group) });
      const mapping = new Map(), existingNodeIds = new Set(nodes.map(node => node.id)), offset = operation.offset || { x: (Number(options.grid) || 8) * 2, y: (Number(options.grid) || 8) * 2 };
      members.forEach(node => {
        const id = uniqueId(existingNodeIds, `${node.id}-copy`);
        mapping.set(node.id, id);
        const copy = { ...copyJSON(node), id, groupId, position: { x: Number(node.position?.x || 0) + Number(offset.x || 0), y: Number(node.position?.y || 0) + Number(offset.y || 0) } };
        nodes.push(copy);
        affected.add(copy.id);
        changes.push(change(undefined, copy, `nodes.${nodes.length - 1}`, operation));
        patches.push({ op: 'add', path: `/nodes/${nodes.length - 1}`, value: copyJSON(copy) });
      });
      edges.filter(edge => mapping.has(edge.from) && mapping.has(edge.to)).forEach(edge => {
        const copy = { ...copyJSON(edge), id: uniqueId(edgeIds, `${edge.id || 'edge'}-copy`), from: mapping.get(edge.from), to: mapping.get(edge.to) };
        edges.push(copy);
        affected.add(copy.id);
        changes.push(change(undefined, copy, `edges.${edges.length - 1}`, operation));
        patches.push({ op: 'add', path: `/edges/${edges.length - 1}`, value: copyJSON(copy) });
      });
      return;
    }

    if (operation.op === 'deleteGroup') {
      const hit = groupIndex().get(operation.groupId);
      if (!hit) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const memberIds = new Set(nodes.filter(node => node.groupId === operation.groupId).map(node => node.id));
      if ((operation.policy || 'ungroup') === 'delete-members') {
        for (let index = edges.length - 1; index >= 0; index -= 1) if (memberIds.has(edges[index].from) || memberIds.has(edges[index].to)) { const removed = edges.splice(index, 1)[0]; affected.add(removed.id || `edge-${index}`); changes.push(change(removed, undefined, `edges.${index}`, operation)); patches.push({ op: 'remove', path: `/edges/${index}` }); }
        for (let index = nodes.length - 1; index >= 0; index -= 1) if (memberIds.has(nodes[index].id)) { const removed = nodes.splice(index, 1)[0]; affected.add(removed.id); changes.push(change(removed, undefined, `nodes.${index}`, operation)); patches.push({ op: 'remove', path: `/nodes/${index}` }); }
      } else nodes.forEach((node, index) => { if (node.groupId === operation.groupId) { delete node.groupId; affected.add(node.id); changes.push(change(operation.groupId, undefined, `nodes.${index}.groupId`, operation)); patches.push({ op: 'remove', path: `/nodes/${index}/groupId` }); } });
      const removed = groups.splice(hit.rowIndex, 1)[0];
      affected.add(removed.id);
      changes.push(change(removed, undefined, `groups.${hit.rowIndex}`, operation));
      patches.push({ op: 'remove', path: `/groups/${hit.rowIndex}` });
      return;
    }

    if (operation.op === 'updateEdge') {
      const hit = edgeIndex().get(recordId(operation));
      if (!hit) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}`, `Record ${recordId(operation)} was not found.`)); return; }
      Object.entries(operation.changes || {}).forEach(([field, value]) => setField(edges, hit, field, value, operation, opIndex, 'edges'));
      return;
    }

    if (operation.op === 'addEdge') {
      const edge = {
        id: operation.id || nextId(edges, 'edge'),
        from: operation.from,
        to: operation.to,
        ...(operation.fromPort ? { fromPort: operation.fromPort } : {}),
        ...(operation.toPort ? { toPort: operation.toPort } : {}),
        ...(operation.label ? { label: operation.label } : {}),
        ...(operation.status ? { status: operation.status } : {}),
        ...(operation.routing ? { routing: operation.routing } : {})
      };
      if (duplicateEdge(edges, edge)) { errors.push(issue('DUPLICATE_EDGE', `command.operations.${opIndex}`, 'An equivalent edge already exists.')); return; }
      edges.push(edge);
      edgeIds.add(edge.id);
      affected.add(edge.id);
      changes.push(change(undefined, edge, `edges.${edges.length - 1}`, operation));
      patches.push({ op: 'add', path: `/edges/${edges.length - 1}`, value: copyJSON(edge) });
      return;
    }

    if (operation.op === 'toggleGroupCollapse') {
      const hit = groupIndex().get(operation.groupId);
      if (!hit) { errors.push(issue('GROUP_NOT_FOUND', `command.operations.${opIndex}.groupId`, `Group ${operation.groupId} was not found.`)); return; }
      const next = operation.collapsed ?? !hit.row.collapsed;
      const before = Boolean(hit.row.collapsed);
      hit.row.collapsed = next;
      affected.add(hit.row.id);
      changes.push(change(before, next, `groups.${hit.rowIndex}.collapsed`, operation));
      patches.push({ op: before === undefined ? 'add' : 'replace', path: `/groups/${hit.rowIndex}/collapsed`, value: next });
      return;
    }

    const paste = (payloadNodes = [], payloadEdges = [], offset = { x: (Number(options.grid) || 8) * 2, y: (Number(options.grid) || 8) * 2 }, operationRef = operation) => {
      const mapping = new Map(), existing = new Set(nodes.map(node => node.id));
      payloadNodes.forEach(node => {
        const baseId = node.id || nextId(nodes, 'node');
        const id = uniqueId(existing, `${baseId}-copy`);
        mapping.set(node.id, id);
        const copy = {
          ...copyJSON(node),
          id,
          position: {
            x: Number(node.position?.x || 0) + Number(offset.x || 0),
            y: Number(node.position?.y || 0) + Number(offset.y || 0)
          }
        };
        nodes.push(copy);
        affected.add(copy.id);
        changes.push(change(undefined, copy, `nodes.${nodes.length - 1}`, operationRef));
        patches.push({ op: 'add', path: `/nodes/${nodes.length - 1}`, value: copyJSON(copy) });
      });
      payloadEdges.filter(edge => mapping.has(edge.from) && mapping.has(edge.to)).forEach(edge => {
        const id = uniqueId(edgeIds, `${edge.id || 'edge'}-copy`);
        const copy = {
          ...copyJSON(edge),
          id,
          from: mapping.get(edge.from),
          to: mapping.get(edge.to)
        };
        if (duplicateEdge(edges, copy)) return;
        edges.push(copy);
        affected.add(copy.id);
        changes.push(change(undefined, copy, `edges.${edges.length - 1}`, operationRef));
        patches.push({ op: 'add', path: `/edges/${edges.length - 1}`, value: copyJSON(copy) });
      });
    };

    if (operation.op === 'duplicateSelection') {
      const index = nodeIndex(), selected = [...new Set(operation.nodeIds)].map(id => index.get(id)?.row).filter(Boolean);
      if (!selected.length) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}.nodeIds`, 'One or more diagram nodes were not found.')); return; }
      const selectedIds = new Set(selected.map(node => node.id));
      paste(selected, edges.filter(edge => selectedIds.has(edge.from) && selectedIds.has(edge.to)), operation.offset || { x: (Number(options.grid) || 8) * 2, y: (Number(options.grid) || 8) * 2 });
      return;
    }

    if (operation.op === 'pasteSelection') {
      paste(operation.nodes || [], operation.edges || [], operation.offset || { x: (Number(options.grid) || 8) * 2, y: (Number(options.grid) || 8) * 2 });
    }
  });

  const nodeValidation = validateData(nodes, nodeSchemaResult.schema, { ...options.validationOptions, references: { ...options.validationOptions?.references, swimlane: lanes.map(lane => lane.id) } });
  const edgeValidation = validateData(edges, edgeSchemaResult.schema, { ...options.validationOptions, references: { ...options.validationOptions?.references, 'flow-node': nodeValidation.rows.map(node => node.id) } });
  errors.push(...nodeValidation.errors, ...edgeValidation.errors);
  warnings.push(...nodeValidation.warnings, ...edgeValidation.warnings);
  const diagramSpec = { type: 'flow', nodes: nodeValidation.rows, edges: edgeValidation.rows, groups, lanes, ...(options.diagram ? { diagram: options.diagram } : {}) };
  const diagramValidation = validateDiagram(diagramSpec);
  errors.push(...diagramValidation.errors.map(error => issue(error.code, error.path, error.message, error.suggestion)));

  const targets = {};
  if (!equality(beforeNodes, nodeValidation.rows)) targets.nodes = nodeValidation.rows;
  if (!equality(beforeEdges, edgeValidation.rows)) targets.edges = edgeValidation.rows;
  if (!equality(beforeGroups, groups)) targets.groups = groups;
  if (errors.length) return result({ valid: false, errors, command, changes: [], patches: [], affectedRecords: [...affected], warnings, requiresConfirmation: false, before: { nodes: beforeNodes, edges: beforeEdges, groups: beforeGroups }, after: { nodes: beforeNodes, edges: beforeEdges, groups: beforeGroups }, targets: {} });
  const requiresConfirmation = options.requireConfirmation !== false || command.operations.some(operation => structureOperationTypes.has(operation.op) || operation.op === 'updateEdge');
  return result({
    valid: true,
    errors: [],
    command,
    changes,
    patches,
    affectedRecords: [...affected],
    warnings,
    requiresConfirmation,
    before: { nodes: beforeNodes, edges: beforeEdges, groups: beforeGroups },
    after: { nodes: nodeValidation.rows, edges: edgeValidation.rows, groups },
    targets,
    rows: targets.nodes || nodeValidation.rows,
    normalized: targets.nodes || nodeValidation.rows,
    capabilities: { ...commandCapabilities(nodeSchemaResult.schema), ...commandCapabilities(edgeSchemaResult.schema) }
  });
}

function previewBusinessEdit(command, options = {}) {
  const commandResult = validateCommand(command), schemaResult = validateDataSchema(options.schema), errors = [...commandResult.errors, ...schemaResult.errors], warnings = [], changes = [], patches = [], affected = new Set();
  if (!commandResult.valid || !schemaResult.valid) return result({ valid: false, errors, command, changes, patches, affectedRecords: [], warnings, requiresConfirmation: false });
  if (command.type === 'layout-edit' && !['flow-node', 'flow-edge'].includes(schemaResult.schema.name)) errors.push(issue('COMMAND_MODEL', 'command.type', 'layout-edit only supports diagram models.'));
  const inputRows = copyJSON(options.values || []), validation = validateData(inputRows, schemaResult.schema, options.validationOptions), rows = validation.rows;
  errors.push(...validation.errors); warnings.push(...validation.warnings);
  const key = schemaResult.schema.key, index = new Map(rows.map((row, rowIndex) => [row[key], { row, rowIndex }])), editable = name => schemaResult.schema.fields[name]?.editable !== false && schemaResult.schema.fields[name]?.agentEditable !== false;
  const target = operation => index.get(recordId(operation));
  const requireTarget = (operation, opIndex) => { const hit = target(operation); if (!hit) errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}`, `Record ${recordId(operation)} was not found.`)); return hit; };
  const setField = (hit, field, value, operation, opIndex) => {
    if (!Object.hasOwn(schemaResult.schema.fields, field)) { errors.push(issue('UNKNOWN_FIELD', `command.operations.${opIndex}.changes.${field}`, 'Field is not declared in the schema.')); return; }
    if (!editable(field)) { errors.push(issue('READ_ONLY_FIELD', `command.operations.${opIndex}.changes.${field}`, `Field ${field} is not editable by an Agent.`)); return; }
    const before = hit.row[field]; hit.row[field] = copyJSON(value); changes.push(change(before, hit.row[field], `values.${hit.rowIndex}.${field}`, operation)); patches.push({ op: 'replace', path: `/values/${hit.rowIndex}/${field}`, value: copyJSON(value) }); affected.add(hit.row[key]);
  };
  command.operations.forEach((operation, opIndex) => {
    if (['moveNodes', 'alignNodes', 'snapNodes'].includes(operation.op)) {
      const hits = operation.nodeIds.map(id => index.get(id));
      if (hits.some(hit => !hit)) { errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}.nodeIds`, 'One or more diagram nodes were not found.')); return; }
      const positions = hits.map(hit => ({ hit, position: { ...(hit.row.position || { x: 0, y: 0 }) } }));
      if (operation.op === 'moveNodes') positions.forEach(item => { item.position.x += operation.delta.x; item.position.y += operation.delta.y; });
      if (operation.op === 'alignNodes') {
        const sizes = positions.map(item => ({ width: Number(item.hit.row.size?.width) || 112, height: Number(item.hit.row.size?.height) || 36 })), bounds = positions.map((item, index) => ({ left: item.position.x, top: item.position.y, right: item.position.x + sizes[index].width, bottom: item.position.y + sizes[index].height, center: item.position.x + sizes[index].width / 2, middle: item.position.y + sizes[index].height / 2 }));
        const target = operation.alignment === 'left' ? Math.min(...bounds.map(item => item.left)) : operation.alignment === 'right' ? Math.max(...bounds.map(item => item.right)) : operation.alignment === 'top' ? Math.min(...bounds.map(item => item.top)) : operation.alignment === 'bottom' ? Math.max(...bounds.map(item => item.bottom)) : operation.alignment === 'center' ? bounds.reduce((sum, item) => sum + item.center, 0) / bounds.length : bounds.reduce((sum, item) => sum + item.middle, 0) / bounds.length;
        positions.forEach((item, index) => { if (operation.alignment === 'left') item.position.x = target; else if (operation.alignment === 'right') item.position.x = target - sizes[index].width; else if (operation.alignment === 'top') item.position.y = target; else if (operation.alignment === 'bottom') item.position.y = target - sizes[index].height; else if (operation.alignment === 'center') item.position.x = target - sizes[index].width / 2; else item.position.y = target - sizes[index].height / 2; });
      }
      if (operation.op === 'snapNodes') positions.forEach(item => { const grid = Number(options.grid) || 8; item.position.x = Math.round(item.position.x / grid) * grid; item.position.y = Math.round(item.position.y / grid) * grid; });
      positions.forEach(item => setField(item.hit, 'position', item.position, operation, opIndex));
      return;
    }
    const hit = requireTarget(operation, opIndex); if (!hit) return;
    if (operation.op === 'updateField') setField(hit, operation.field, operation.value, operation, opIndex);
    if (['updateRecord', 'updateTask', 'updateMilestone'].includes(operation.op)) Object.entries(operation.changes || {}).forEach(([field, value]) => setField(hit, field, value, operation, opIndex));
    if (operation.op === 'updateProgress') { setField(hit, 'progress', operation.progress, operation, opIndex); if (operation.status !== undefined) setField(hit, 'status', operation.status, operation, opIndex); }
    if (operation.op === 'shiftTask') {
      if (!equality(hit.row.status, 'done') || operation.allowCompleted) { setField(hit, 'start', plusDays(hit.row.start, operation.days), operation, opIndex); setField(hit, 'end', plusDays(hit.row.end, operation.days), operation, opIndex); }
      else warnings.push(issue('COMPLETED_TASK', `command.operations.${opIndex}`, 'Completed task schedule change requires explicit allowCompleted.'));
      if (operation.shiftDependents) rows.filter(row => (row.dependencies || []).includes(hit.row[key])).forEach(row => { const dependent = index.get(row[key]); if (dependent) { const days = operation.days; setField(dependent, 'start', plusDays(dependent.row.start, days), operation, opIndex); setField(dependent, 'end', plusDays(dependent.row.end, days), operation, opIndex); } });
    }
    if (['addDependency', 'removeDependency'].includes(operation.op)) {
      const current = Array.isArray(hit.row.dependencies) ? [...hit.row.dependencies] : [], next = operation.op === 'addDependency' ? [...new Set([...current, operation.dependencyId])] : current.filter(id => id !== operation.dependencyId); setField(hit, 'dependencies', next, operation, opIndex);
    }
    if (operation.op === 'moveNode') setField(hit, 'position', operation.position, operation, opIndex);
    if (operation.op === 'resizeNode') setField(hit, 'size', operation.size, operation, opIndex);
    if (operation.op === 'moveNodeToLane') setField(hit, 'laneId', operation.laneId, operation, opIndex);
    if (operation.op === 'updateEdge') Object.entries(operation.changes || {}).forEach(([field, value]) => setField(hit, field, value, operation, opIndex));
  });
  const finalValidation = validateData(rows, schemaResult.schema, options.validationOptions); errors.push(...finalValidation.errors); warnings.push(...finalValidation.warnings);
  if (errors.length) return result({ valid: false, errors, command, changes: [], patches: [], affectedRecords: [...affected], warnings, requiresConfirmation: false, before: inputRows, after: inputRows });
  const requiresConfirmation = options.requireConfirmation !== false || command.operations.some(operation => ['addRecord', 'removeRecord', 'addDependency', 'removeDependency', 'updateEdge'].includes(operation.op));
  return result({ valid: true, errors: [], command, changes, patches, affectedRecords: [...affected], warnings, requiresConfirmation, before: inputRows, after: rows, normalized: finalValidation.rows, capabilities: commandCapabilities(schemaResult.schema), rows: finalValidation.rows, targets: { values: finalValidation.rows } });
}

export function previewEdit(input, options = {}) {
  let command;
  try { command = normalizeCommand(input); } catch (error) { return { valid: false, errors: [issue('INVALID_COMMAND', 'command', error.message)], changes: [], patches: [], affectedRecords: [], warnings: [], requiresConfirmation: false }; }
  const commandResult = validateCommand(command);
  if (!commandResult.valid) return result({ valid: false, errors: commandResult.errors, command, changes: [], patches: [], affectedRecords: [], warnings: [], requiresConfirmation: false });
  if (command.operations.some(operation => diagramOperationTypes.has(operation.op))) return previewDiagramEdit(command, options);
  return previewBusinessEdit(command, options);
}

function result(value) { return { ...value, id: value.id || `preview-${JSON.stringify(value.command || {}).length}-${(value.changes || []).length}`, revision: value.revision ?? null, assumptions: ['Only declared editable fields may change.', 'Preview operates on a copied local dataset.', 'External persistence and authorization remain the host application responsibility.'] }; }

export function validateEdit(input, options = {}) { const preview = previewEdit(input, options); return { valid: preview.valid, errors: preview.errors, warnings: preview.warnings, affectedRecords: preview.affectedRecords, requiresConfirmation: preview.requiresConfirmation }; }

export function getEditCapabilities(schema) { return commandCapabilities(validateDataSchema(schema).schema || {}); }

export function commitPreview(preview, options = {}) {
  if (!preview?.valid) return { valid: false, errors: [issue('INVALID_PREVIEW', 'preview', 'Only a valid preview can be committed.')], warnings: [] };
  if (preview.requiresConfirmation && options.confirmed !== true && !options.approval) return { valid: false, errors: [issue('CONFIRMATION_REQUIRED', 'approval', 'This edit requires explicit host confirmation.')], warnings: preview.warnings || [] };
  if (options.previewId !== undefined && options.previewId !== preview.id) return { valid: false, errors: [issue('PREVIEW_MISMATCH', 'previewId', 'Approval does not match this preview.')], warnings: [] };
  if (options.expectedRevision !== undefined && options.expectedRevision !== preview.revision) return { valid: false, errors: [issue('STALE_PREVIEW', 'expectedRevision', 'The preview was created from a stale data revision.')], warnings: [] };
  return { valid: true, rows: copyJSON(preview.normalized || preview.after), targets: copyJSON(preview.targets || { values: preview.normalized || preview.after }), changes: copyJSON(preview.changes), patches: copyJSON(preview.patches), affectedRecords: copyJSON(preview.affectedRecords), warnings: copyJSON(preview.warnings || []), command: copyJSON(preview.command), audit: { actor: options.actor || 'host', timestamp: options.timestamp || new Date().toISOString(), reason: preview.command?.reason || options.reason || 'business edit', source: options.source || 'agent', previewId: preview.id } };
}
