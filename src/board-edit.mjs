import { boardEditableFields, cloneBoard, validateBoardSpec } from './board-contract.mjs';

export const boardOperations = ['addItem', 'updateItem', 'removeItem', 'addAsset', 'updateAsset', 'removeAsset'];
const itemFields = [...boardEditableFields.common, ...Object.values(boardEditableFields.itemTypes).flat()];
const assetFields = boardEditableFields.asset;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const issue = (code, path, message) => ({ code, path, message });
const failure = (code, message, path = 'editing') => ({ valid: false, errors: [issue(code, path, message)], warnings: [] });

export function validateBoardCommand(input) {
  const errors = [], warnings = [];
  let command;
  try { command = cloneBoard(input); } catch { return failure('INVALID_BOARD_COMMAND', 'Use a JSON command.', 'command'); }
  if (!object(command) || command.type !== 'board-edit' || !Array.isArray(command.operations) || !command.operations.length || command.operations.length > 200) return failure('INVALID_BOARD_COMMAND', 'Use type: board-edit with 1 to 200 operations.', 'command');
  if (Object.keys(command).some(field => !['type', 'operations'].includes(field))) errors.push(issue('INVALID_BOARD_COMMAND', 'command', 'Use only type and operations in a Board command.'));
  command.operations.forEach((operation, index) => {
    const path = `operations[${index}]`;
    const fail = message => errors.push(issue('INVALID_BOARD_COMMAND', path, message));
    if (!object(operation) || !boardOperations.includes(operation.op)) { fail('Use a registered Board operation.'); return; }
    const asset = operation.op.endsWith('Asset'), key = asset ? 'asset' : 'item', id = `${key}Id`;
    const allowed = operation.op.startsWith('add') ? ['op', key] : operation.op.startsWith('update') ? ['op', id, 'changes'] : ['op', id, 'policy'];
    if (Object.keys(operation).some(field => !allowed.includes(field))) fail('Unknown operation field; use the Board command contract.');
    if (operation.op.startsWith('add')) {
      if (!object(operation[key]) || typeof operation[key].id !== 'string' || !operation[key].id) fail(`Provide ${key} with a stable string id.`);
    } else {
      if (typeof operation[id] !== 'string' || !operation[id]) fail(`Provide ${id}.`);
      if (operation.op.startsWith('update')) {
        if (!object(operation.changes) || !Object.keys(operation.changes).length || Object.keys(operation.changes).some(field => !(asset ? assetFields : itemFields).includes(field))) fail('Provide nonempty changes containing editable fields; id, kind, type and locked cannot be changed.');
      } else if (operation.policy !== undefined && !['reject', 'cascade'].includes(operation.policy)) fail('Removal policy must be reject or cascade.');
    }
  });
  return { valid: !errors.length, errors, warnings, command };
}

function prepare(board, input) {
  const validation = validateBoardCommand(input);
  if (!validation.valid) return validation;
  if (board.spec.editing.enabled !== true) return failure('EDITING_DISABLED', 'Enable editing.enabled explicitly.');
  const { command } = validation, next = board.getSpec();
  const affectedItems = new Set(), affectedAssets = new Set();
  for (const [index, operation] of command.operations.entries()) {
    const path = `operations[${index}]`, asset = operation.op.endsWith('Asset'), key = asset ? 'asset' : 'item', collection = asset ? 'assets' : 'items', id = operation[`${key}Id`] || operation[key]?.id;
    const target = next[collection].find(entry => entry.id === id);
    if (!operation.op.startsWith('update') && next.editing.allowStructuralChanges !== true) return failure('STRUCTURAL_EDIT_DISABLED', 'Enable editing.allowStructuralChanges explicitly.', path);
    if (operation.op.startsWith('add')) {
      if (target) return failure('DUPLICATE_ID', `The ${key} ID already exists: ${id}.`, path);
      next[collection].push(operation[key]);
    } else {
      if (!target) return failure('MISSING_BOARD_TARGET', `The ${key} does not exist: ${id}.`, path);
      const locked = asset ? next.items.some(item => item.assetId === id && item.locked) : target.locked;
      if (locked) return failure('BOARD_ITEM_LOCKED', 'Locked items and their image assets cannot be edited by Agent commands.', path);
      if (operation.op.startsWith('update')) {
        if (!asset) {
          const fields = [...boardEditableFields.common, ...(boardEditableFields.itemTypes[target.kind] || [])];
          const unsupported = Object.keys(operation.changes).find(field => !fields.includes(field));
          if (unsupported) return failure('UNSUPPORTED_BOARD_FIELD', `${target.kind} items do not use ${unsupported}.`, `${path}.changes.${unsupported}`);
        }
        Object.assign(target, operation.changes);
      }
      else {
        const related = next.items.filter(item => asset ? item.assetId === id : item.kind === 'connector' && (item.from === id || item.to === id));
        const removed = new Set([...(asset ? [] : [id]), ...related.map(item => item.id)]);
        if (asset) next.items.filter(item => item.kind === 'connector' && (removed.has(item.from) || removed.has(item.to))).forEach(item => removed.add(item.id));
        if (related.length && operation.policy !== 'cascade') return failure('BOARD_TARGET_REFERENCED', 'Remove references explicitly or confirm policy: cascade.', path);
        if (next.items.some(item => removed.has(item.id) && item.locked)) return failure('BOARD_ITEM_LOCKED', 'Cascade would delete a locked item.', path);
        removed.forEach(itemId => affectedItems.add(itemId));
        next.items = next.items.filter(item => !removed.has(item.id));
        if (asset) next.assets = next.assets.filter(entry => entry.id !== id);
      }
    }
    (asset ? affectedAssets : affectedItems).add(id);
  }
  const result = validateBoardSpec(next);
  if (!result.valid) return result;
  try {
    const scene = board._build(result.spec);
    return { valid: true, errors: [], warnings: result.warnings, command, spec: result.spec, layout: board._layout(result.spec, scene), affectedItems: [...affectedItems], affectedAssets: [...affectedAssets] };
  } catch (error) { return failure('BOARD_RENDER_FAILED', error.message, 'items'); }
}

let boardSequence = 0;
export class BoardEditController {
  constructor(board) { this.board = board; this.id = ++boardSequence; this.sequence = 0; this.pending = new Map(); this.busy = false; }
  invalidate() { this.pending.clear(); }
  preview(command) {
    if (this.board._destroyed) return failure('BOARD_DESTROYED', 'The Board has been destroyed.');
    const result = prepare(this.board, command);
    result.revision = this.board._revision;
    if (result.valid) {
      result.id = `board-${this.id}-preview-${++this.sequence}`;
      this.pending.set(result.id, { result: cloneBoard(result), signature: JSON.stringify(this.board.spec) });
      if (this.pending.size > 50) this.pending.delete(this.pending.keys().next().value);
    }
    return result;
  }
  apply(input, options = {}) {
    if (this.busy) return failure('EDIT_IN_PROGRESS', 'A Board transaction is already running.');
    if (this.board._destroyed) return failure('BOARD_DESTROYED', 'The Board has been destroyed.');
    if (!object(options) || ['actor', 'source'].some(field => options[field] !== undefined && (typeof options[field] !== 'string' || !options[field]))) return failure('INVALID_EDIT_OPTIONS', 'Use an options object and nonempty string actor/source values.');
    const checked = validateBoardCommand(input);
    if (!checked.valid) return checked;
    const issued = this.pending.get(options.preview?.id);
    if (!issued) return failure('STALE_PREVIEW', 'Preview this command on the current Board before committing.');
    if (issued.result.revision !== this.board._revision || issued.signature !== JSON.stringify(this.board.spec) || options.expectedRevision !== undefined && options.expectedRevision !== this.board._revision) return failure('STALE_PREVIEW', 'The Board changed; request a new preview.');
    if (JSON.stringify(checked.command) !== JSON.stringify(issued.result.command)) return failure('PREVIEW_COMMAND_MISMATCH', 'Confirm exactly the command that was previewed.');
    if (options.confirmed !== true) return failure('CONFIRMATION_REQUIRED', 'Host confirmation is required for every Board Agent transaction.');
    this.busy = true;
    try {
      const result = cloneBoard(issued.result);
      const state = this.board._commit(result.spec, { source: options.source || 'agent', actor: options.actor || 'host', command: result.command, affectedItems: result.affectedItems, affectedAssets: result.affectedAssets });
      return { ...result, revision: state.revision, state };
    } catch (error) { return failure('BOARD_RENDER_FAILED', error.message, 'items'); }
    finally { this.busy = false; }
  }
}
