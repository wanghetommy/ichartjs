/**
 * Agent edit command normalization, validation, and capability discovery.
 * Commands are JSON-safe, stable-ID based, and do not mutate input data.
 */
import { copyJSON, issue } from './schema.mjs';

export const commandVersion = '1.0';
export const operationTypes = ['updateField', 'updateRecord', 'updateTask', 'shiftTask', 'updateProgress', 'addDependency', 'removeDependency', 'updateMilestone', 'moveNode', 'moveNodes', 'moveNodeToLane', 'resizeNode', 'alignNodes', 'snapNodes', 'updateEdge'];

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
    if (operationTypes.includes(operation.op) && !['moveNodes', 'alignNodes', 'snapNodes'].includes(operation.op) && (typeof operation.recordId !== 'string' && typeof operation.taskId !== 'string' && typeof operation.nodeId !== 'string' && typeof operation.edgeId !== 'string')) errors.push(issue('OPERATION_TARGET', path, 'Operation requires a stable recordId, taskId, nodeId, or edgeId.'));
    if (['updateField', 'updateRecord', 'updateTask'].includes(operation.op) && !operation.changes && operation.op !== 'updateField') errors.push(issue('OPERATION_CHANGES', `${path}.changes`, 'Operation requires changes.'));
    if (operation.op === 'updateField' && typeof operation.field !== 'string') errors.push(issue('OPERATION_FIELD', `${path}.field`, 'updateField requires a field name.'));
    if (operation.op === 'shiftTask' && (typeof operation.days !== 'number' || !Number.isFinite(operation.days))) errors.push(issue('OPERATION_DAYS', `${path}.days`, 'shiftTask requires finite numeric days.'));
    if (['addDependency', 'removeDependency'].includes(operation.op) && typeof operation.dependencyId !== 'string') errors.push(issue('OPERATION_DEPENDENCY', `${path}.dependencyId`, 'Dependency operations require dependencyId.'));
    if (operation.op === 'moveNode' && (!operation.position || typeof operation.position.x !== 'number' || typeof operation.position.y !== 'number')) errors.push(issue('OPERATION_POSITION', `${path}.position`, 'moveNode requires numeric x and y.'));
    if (operation.op === 'moveNodes' && (!Array.isArray(operation.nodeIds) || !operation.nodeIds.length || typeof operation.delta?.x !== 'number' || typeof operation.delta?.y !== 'number')) errors.push(issue('OPERATION_MOVE_NODES', path, 'moveNodes requires nodeIds and numeric delta.'));
    if (['alignNodes', 'snapNodes'].includes(operation.op) && (!Array.isArray(operation.nodeIds) || !operation.nodeIds.length)) errors.push(issue('OPERATION_NODE_IDS', path, `${operation.op} requires nodeIds.`));
    if (operation.op === 'alignNodes' && !['left', 'center', 'right', 'top', 'middle', 'bottom'].includes(operation.alignment)) errors.push(issue('OPERATION_ALIGNMENT', `${path}.alignment`, 'Use left, center, right, top, middle, or bottom.'));
    if (operation.op === 'resizeNode' && (!operation.size || typeof operation.size.width !== 'number' || typeof operation.size.height !== 'number' || operation.size.width <= 0 || operation.size.height <= 0)) errors.push(issue('OPERATION_SIZE', `${path}.size`, 'resizeNode requires positive numeric width and height.'));
    if (operation.op === 'moveNodeToLane' && typeof operation.laneId !== 'string') errors.push(issue('OPERATION_LANE', `${path}.laneId`, 'moveNodeToLane requires laneId.'));
    if (operation.op === 'updateEdge' && (!operation.changes || typeof operation.changes !== 'object')) errors.push(issue('OPERATION_CHANGES', `${path}.changes`, 'updateEdge requires changes.'));
  });
  return { valid: errors.length === 0, errors, command: value };
}

export function commandCapabilities(schema) {
  const fields = schema?.fields || {};
  const can = name => fields[name]?.editable !== false && fields[name]?.agentEditable !== false;
  return { updateField: Object.keys(fields).filter(can), updateRecord: true, updateTask: schema?.name === 'project-task', shiftTask: schema?.name === 'project-task' && can('start') && can('end'), updateProgress: schema?.name === 'project-task' && can('progress'), addDependency: schema?.name === 'project-task' && can('dependencies'), removeDependency: schema?.name === 'project-task' && can('dependencies'), updateMilestone: schema?.name === 'milestone', moveNode: schema?.name === 'flow-node' && can('position'), moveNodes: schema?.name === 'flow-node' && can('position'), alignNodes: schema?.name === 'flow-node' && can('position'), snapNodes: schema?.name === 'flow-node' && can('position'), moveNodeToLane: schema?.name === 'flow-node' && can('laneId'), updateEdge: schema?.name === 'flow-edge' };
}
