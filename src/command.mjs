/**
 * Agent edit command normalization, validation, and capability discovery.
 * Commands are JSON-safe, stable-ID based, and do not mutate input data.
 */
import { copyJSON, issue } from './schema.mjs';
import { commandTypes } from './contract-registry.mjs';

export const commandVersion = '1.0';
export const operationTypes = [...commandTypes];

export function normalizeCommand(input) {
  const command = copyJSON(input);
  if (!command.version) command.version = commandVersion;
  if (!command.type) command.type = 'edit';
  if (!Array.isArray(command.operations)) command.operations = [];
  return command;
}

export function validateCommand(command) {
  const errors = [];
  let value;
  try { value = normalizeCommand(command); } catch (error) { return { valid: false, errors: [issue('INVALID_COMMAND', 'command', error.message)], command: null }; }
  if (value.version !== commandVersion) errors.push(issue('COMMAND_VERSION', 'command.version', `Unsupported command version: ${value.version}.`, 'Use command version 1.0.'));
  if (value.type !== 'edit' && value.type !== 'layout-edit') errors.push(issue('COMMAND_TYPE', 'command.type', 'Command type must be edit or layout-edit.'));
  if (!Array.isArray(value.operations) || !value.operations.length) errors.push(issue('EMPTY_COMMAND', 'command.operations', 'At least one operation is required.'));
  value.operations.forEach((operation, index) => {
    const path = `command.operations.${index}`;
    if (!operation || typeof operation.op !== 'string' || !operationTypes.includes(operation.op)) errors.push(issue('OPERATION_TYPE', `${path}.op`, 'Unsupported edit operation.'));
    if (operationTypes.includes(operation.op) && !['moveNodes', 'alignNodes', 'snapNodes', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'toggleGroupCollapse', 'duplicateSelection', 'pasteSelection', 'addEdge'].includes(operation.op) && (typeof operation.recordId !== 'string' && typeof operation.taskId !== 'string' && typeof operation.nodeId !== 'string' && typeof operation.edgeId !== 'string')) errors.push(issue('OPERATION_TARGET', path, 'Operation requires a stable recordId, taskId, nodeId, or edgeId.'));
    if (['updateField', 'updateRecord', 'updateTask'].includes(operation.op) && !operation.changes && operation.op !== 'updateField') errors.push(issue('OPERATION_CHANGES', `${path}.changes`, 'Operation requires changes.'));
    if (operation.op === 'updateField' && typeof operation.field !== 'string') errors.push(issue('OPERATION_FIELD', `${path}.field`, 'updateField requires a field name.'));
    if (operation.op === 'shiftTask' && (typeof operation.days !== 'number' || !Number.isFinite(operation.days))) errors.push(issue('OPERATION_DAYS', `${path}.days`, 'shiftTask requires finite numeric days.'));
    if (['addDependency', 'removeDependency'].includes(operation.op) && typeof operation.dependencyId !== 'string') errors.push(issue('OPERATION_DEPENDENCY', `${path}.dependencyId`, 'Dependency operations require dependencyId.'));
    if (operation.op === 'moveNode' && (!operation.position || typeof operation.position.x !== 'number' || typeof operation.position.y !== 'number')) errors.push(issue('OPERATION_POSITION', `${path}.position`, 'moveNode requires numeric x and y.'));
    if (operation.op === 'moveNodes' && (!Array.isArray(operation.nodeIds) || !operation.nodeIds.length || typeof operation.delta?.x !== 'number' || typeof operation.delta?.y !== 'number')) errors.push(issue('OPERATION_MOVE_NODES', path, 'moveNodes requires nodeIds and numeric delta.'));
    if (operation.op === 'moveGroup' && (typeof operation.groupId !== 'string' || typeof operation.delta?.x !== 'number' || typeof operation.delta?.y !== 'number')) errors.push(issue('OPERATION_MOVE_GROUP', path, 'moveGroup requires groupId and numeric delta.'));
    if (operation.op === 'resizeGroup' && (typeof operation.groupId !== 'string' || typeof operation.size?.width !== 'number' || typeof operation.size?.height !== 'number' || operation.size.width <= 0 || operation.size.height <= 0)) errors.push(issue('OPERATION_RESIZE_GROUP', path, 'resizeGroup requires groupId and a positive numeric size.'));
    if (operation.op === 'assignNodesToGroup' && ((!Array.isArray(operation.nodeIds) || !operation.nodeIds.length) || operation.groupId !== null && typeof operation.groupId !== 'string')) errors.push(issue('OPERATION_GROUP_MEMBERS', path, 'assignNodesToGroup requires nodeIds and a groupId or null.'));
    if (operation.op === 'duplicateGroup' && (typeof operation.groupId !== 'string' || operation.offset !== undefined && (typeof operation.offset?.x !== 'number' || typeof operation.offset?.y !== 'number'))) errors.push(issue('OPERATION_DUPLICATE_GROUP', path, 'duplicateGroup requires groupId and an optional numeric offset.'));
    if (operation.op === 'deleteGroup' && (typeof operation.groupId !== 'string' || operation.policy !== undefined && !['ungroup', 'delete-members'].includes(operation.policy))) errors.push(issue('OPERATION_DELETE_GROUP', path, 'deleteGroup requires groupId and policy ungroup or delete-members.'));
    if (['alignNodes', 'snapNodes'].includes(operation.op) && (!Array.isArray(operation.nodeIds) || !operation.nodeIds.length)) errors.push(issue('OPERATION_NODE_IDS', path, `${operation.op} requires nodeIds.`));
    if (operation.op === 'alignNodes' && !['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(operation.alignment)) errors.push(issue('OPERATION_ALIGNMENT', `${path}.alignment`, 'Use left, center, right, top, middle, or bottom.'));
    if (operation.op === 'resizeNode' && (!operation.size || typeof operation.size.width !== 'number' || typeof operation.size.height !== 'number' || operation.size.width <= 0 || operation.size.height <= 0)) errors.push(issue('OPERATION_SIZE', `${path}.size`, 'resizeNode requires positive numeric width and height.'));
    if (operation.op === 'moveNodeToLane' && typeof operation.laneId !== 'string') errors.push(issue('OPERATION_LANE', `${path}.laneId`, 'moveNodeToLane requires laneId.'));
    if (operation.op === 'updateEdge' && (!operation.changes || typeof operation.changes !== 'object')) errors.push(issue('OPERATION_CHANGES', `${path}.changes`, 'updateEdge requires changes.'));
    if (operation.op === 'toggleGroupCollapse' && typeof operation.groupId !== 'string') errors.push(issue('OPERATION_GROUP', `${path}.groupId`, 'toggleGroupCollapse requires groupId.'));
    if (operation.op === 'addEdge') {
      if (typeof operation.from !== 'string' || typeof operation.to !== 'string') errors.push(issue('OPERATION_EDGE_ENDPOINT', path, 'addEdge requires from and to node IDs.'));
      if (operation.id !== undefined && typeof operation.id !== 'string') errors.push(issue('OPERATION_EDGE_ID', `${path}.id`, 'Edge id must be a string when provided.'));
      if (operation.fromPort !== undefined && typeof operation.fromPort !== 'string') errors.push(issue('OPERATION_EDGE_PORT', `${path}.fromPort`, 'fromPort must be a string.'));
      if (operation.toPort !== undefined && typeof operation.toPort !== 'string') errors.push(issue('OPERATION_EDGE_PORT', `${path}.toPort`, 'toPort must be a string.'));
    }
    if (operation.op === 'duplicateSelection' && (!Array.isArray(operation.nodeIds) || !operation.nodeIds.length)) errors.push(issue('OPERATION_NODE_IDS', path, 'duplicateSelection requires nodeIds.'));
    if (operation.op === 'pasteSelection') {
      if (!Array.isArray(operation.nodes) || !operation.nodes.length) errors.push(issue('OPERATION_CLIPBOARD', `${path}.nodes`, 'pasteSelection requires copied nodes.'));
      if (operation.edges !== undefined && !Array.isArray(operation.edges)) errors.push(issue('OPERATION_CLIPBOARD', `${path}.edges`, 'pasteSelection edges must be an array when provided.'));
      if (operation.offset !== undefined && (typeof operation.offset?.x !== 'number' || typeof operation.offset?.y !== 'number')) errors.push(issue('OPERATION_POSITION', `${path}.offset`, 'pasteSelection offset requires numeric x and y.'));
    }
  });
  return { valid: errors.length === 0, errors, command: value };
}

export function commandCapabilities(schema) {
  const fields = schema?.fields || {};
  const can = name => fields[name]?.editable !== false && fields[name]?.agentEditable !== false;
  const flowNode = ['flow-node', 'architecture-node', 'mindmap-node'].includes(schema?.name);
  const flowEdge = ['flow-edge', 'architecture-edge', 'mindmap-edge'].includes(schema?.name);
  return {
    updateField: Object.keys(fields).filter(can),
    updateRecord: true,
    updateTask: schema?.name === 'project-task',
    shiftTask: schema?.name === 'project-task' && can('start') && can('end'),
    updateProgress: schema?.name === 'project-task' && can('progress'),
    addDependency: schema?.name === 'project-task' && can('dependencies'),
    removeDependency: schema?.name === 'project-task' && can('dependencies'),
    updateMilestone: schema?.name === 'milestone',
    moveNode: flowNode && can('position'),
    moveNodes: flowNode && can('position'),
    alignNodes: flowNode && can('position'),
    snapNodes: flowNode && can('position'),
    moveGroup: flowNode && can('position'),
    resizeGroup: flowNode && can('position') && can('size'),
    assignNodesToGroup: flowNode,
    duplicateGroup: flowNode,
    deleteGroup: flowNode,
    moveNodeToLane: flowNode && can('laneId'),
    resizeNode: flowNode && can('size'),
    toggleGroupCollapse: flowNode,
    duplicateSelection: flowNode,
    pasteSelection: flowNode,
    updateEdge: flowEdge,
    removeEdge: flowEdge,
    addEdge: flowEdge
  };
}
