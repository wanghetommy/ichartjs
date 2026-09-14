/**
 * Bounded undo/redo history for committed local chart edits.
 * Stores immutable before/after snapshots supplied by the edit controller.
 */
import { copyJSON } from './schema.mjs';

export class EditHistory {
  constructor(limit = 100) { this.limit = limit; this.undoStack = []; this.redoStack = []; }
  push(entry) { this.undoStack.push(copyJSON(entry)); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack = []; }
  undo() { const entry = this.undoStack.pop(); if (!entry) return null; this.redoStack.push(copyJSON(entry)); return copyJSON(entry); }
  redo() { const entry = this.redoStack.pop(); if (!entry) return null; this.undoStack.push(copyJSON(entry)); return copyJSON(entry); }
  clear() { this.undoStack = []; this.redoStack = []; }
  state() { return { undo: this.undoStack.length, redo: this.redoStack.length }; }
}
