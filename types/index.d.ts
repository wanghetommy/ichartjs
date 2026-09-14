export type Renderer = 'canvas' | 'svg' | 'auto';
export type BusinessFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'object';
export interface BusinessField { type: BusinessFieldType; required?: boolean; editable?: boolean; agentEditable?: boolean; nullable?: boolean; default?: unknown; min?: number; max?: number; values?: string[]; items?: BusinessField; properties?: Record<string, BusinessField>; references?: string; acyclic?: boolean; unique?: boolean; }
export interface BusinessDataSchema { name: string; version: '1.0'; key: string; fields: Record<string, BusinessField>; rules?: Array<Record<string, unknown>>; }
export interface EditOperation { op: string; recordId?: string; taskId?: string; nodeId?: string; edgeId?: string; field?: string; value?: unknown; changes?: Record<string, unknown>; days?: number; dependencyId?: string; position?: { x: number; y: number }; laneId?: string; }
export interface EditCommand { version?: '1.0'; type: 'edit' | 'layout-edit'; reason?: string; operations: EditOperation[]; }
export interface EditPreview { valid: boolean; id: string; command: EditCommand; changes: Array<{ path: string; before: unknown; after: unknown; operation: string }>; patches: Array<{ op: string; path: string; value: unknown }>; affectedRecords: string[]; warnings: Array<Record<string, unknown>>; requiresConfirmation: boolean; before: unknown[]; after: unknown[]; }
export interface Chart { inspectDataSchema(): ReturnType<typeof inspectDataSchema>; validateData(): Record<string, unknown>; validateEdit(command: EditCommand): Record<string, unknown>; previewEdit(command: EditCommand): EditPreview; applyEdit(command: EditCommand, options?: { preview?: EditPreview; confirmed?: boolean; approval?: unknown; previewId?: string; expectedRevision?: number; actor?: string; source?: string; reason?: string }): Record<string, unknown>; getChangeSet(): Record<string, unknown> | null; getState(): Record<string, unknown>; undo(): Record<string, unknown>; redo(): Record<string, unknown>; }
export function createChart(spec: Record<string, unknown>): Chart;
export function getBusinessSchema(name: string): BusinessDataSchema;
export function inspectDataSchema(schema: BusinessDataSchema): Record<string, unknown>;
export function validateData(values: unknown[], schema: BusinessDataSchema, options?: Record<string, unknown>): Record<string, unknown>;
export function previewEdit(command: EditCommand, options: Record<string, unknown>): EditPreview;
export function validateEdit(command: EditCommand, options: Record<string, unknown>): Record<string, unknown>;
export function getEditCapabilities(schema: BusinessDataSchema): Record<string, unknown>;
export function validateRecipe(recipe: Record<string, unknown>, capabilities?: Record<string, unknown>): Record<string, unknown>;
