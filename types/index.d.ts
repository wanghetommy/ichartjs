export type Renderer = 'canvas' | 'svg' | 'auto';
export type ChartType = 'line' | 'area' | 'bar' | 'column' | 'pie' | 'scatter' | 'funnel' | 'gauge' | 'heatmap' | 'radar' | 'gantt' | 'timeline' | 'milestone' | 'burndown' | 'flow' | 'swimlane';
export interface BinTransform { type: 'bin'; field: string; output?: string; thresholds?: number; step?: number; extent?: [number, number]; }
export interface RadarIndicator { name: string; field: string; min?: number; max?: number; }
export type BusinessFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'object';
export interface BusinessField { type?: BusinessFieldType; anyOf?: BusinessField[]; required?: boolean; editable?: boolean; agentEditable?: boolean; nullable?: boolean; default?: unknown; min?: number; max?: number; values?: string[]; items?: BusinessField; properties?: Record<string, BusinessField>; references?: string; acyclic?: boolean; unique?: boolean; }
export interface BusinessDataSchema { name: string; version: '1.0'; key: string; fields: Record<string, BusinessField>; rules?: Array<Record<string, unknown>>; }

export interface LinkedFilters { owner?: string[]; status?: string[]; priority?: string[]; sprint?: string[]; label?: string[]; }
export interface LinkedState { filters: Required<LinkedFilters>; selection: string[]; selectedCount: number; sourceCount: number; visibleCount: number; sourceRecordIds: string[]; visibleRecordIds: string[]; }

export interface ProjectCalendarConfig { timezone?: 'UTC' | string; workingWeekdays?: number[]; holidays?: string[]; nonWorkingDayPolicy?: 'next-working-day' | 'previous-working-day' | 'allow' | string; }
export interface DependencyRule { id: string; type?: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish'; lag?: number; lead?: number; }
export interface ScheduleTaskResult { id: string; earliestStart: string | null; earliestFinish: string | null; latestStart: string | null; latestFinish: string | null; float: number; slack: number; critical: boolean; baselineVarianceDays: number | null; startVarianceDays: number | null; endVarianceDays: number | null; dependencies: DependencyRule[]; adjustedStart: string | null; adjustedEnd: string | null; }
export interface ScheduleAnalysisResult { calendar: Required<ProjectCalendarConfig>; tasks: ScheduleTaskResult[]; criticalIds: string[]; criticalEdges: Array<{ from: string; to: string }>; duration: number; assumptions: string[]; warnings: Array<Record<string, unknown>>; rows: Array<Record<string, unknown>>; }
export interface BurndownAnalysisResult { samples: Array<Record<string, unknown>>; initialScope?: number; start?: number; end?: number; forecast: { date: string | null; velocity?: number; reason: string; time?: number }; assumptions: string[]; warnings: Array<Record<string, unknown>>; }
export interface CapacityAnalysisResult { rows: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>>; assumptions: string[]; chartType?: string; values?: Array<Record<string, unknown>>; }
export interface ProjectAnalyticsState { linked?: LinkedState; schedule?: ScheduleAnalysisResult; burndown?: BurndownAnalysisResult; assumptions?: string[]; warnings?: Array<Record<string, unknown>>; [key: string]: unknown; }

export interface EditOperation { op: string; recordId?: string; taskId?: string; nodeId?: string; nodeIds?: string[]; edgeId?: string; groupId?: string | null; policy?: 'ungroup' | 'delete-members'; field?: string; value?: unknown; changes?: Record<string, unknown>; days?: number; dependencyId?: string; position?: { x: number; y: number }; size?: { width: number; height: number }; offset?: { x: number; y: number }; delta?: { x: number; y: number }; alignment?: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'; laneId?: string; }
export interface EditCommand { version?: '1.0'; type: 'edit' | 'layout-edit'; reason?: string; operations: EditOperation[]; }
export interface EditPreview { valid: boolean; id: string; command: EditCommand; changes: Array<{ path: string; before: unknown; after: unknown; operation: string }>; patches: Array<{ op: string; path: string; value: unknown }>; affectedRecords: string[]; warnings: Array<Record<string, unknown>>; requiresConfirmation: boolean; before: unknown[]; after: unknown[]; }

export interface Chart {
  inspectDataSchema(): ReturnType<typeof inspectDataSchema>;
  validateData(): Record<string, unknown>;
  validateEdit(command: EditCommand): Record<string, unknown>;
  previewEdit(command: EditCommand): EditPreview;
  applyEdit(command: EditCommand, options?: { preview?: EditPreview; confirmed?: boolean; approval?: unknown; previewId?: string; expectedRevision?: number; actor?: string; source?: string; reason?: string }): Record<string, unknown>;
  getChangeSet(): Record<string, unknown> | null;
  getState(): Record<string, unknown>;
  getProjectAnalytics(): ProjectAnalyticsState | null;
  getLinkedState(): LinkedState | null;
  setLinkedFilters(filters: LinkedFilters): this;
  setLinkedSelection(selection: string[]): this;
  selectNodes(nodeIds: string[], options?: { additive?: boolean }): this;
  selectGroup(groupId: string, options?: { additive?: boolean }): this;
  getSelectedNodeIds(): string[];
  moveSelectedBy(delta: { x: number; y: number }, options?: Record<string, unknown>): Record<string, unknown>;
  alignSelected(alignment: EditOperation['alignment'], options?: Record<string, unknown>): Record<string, unknown>;
  snapSelected(options?: Record<string, unknown>): Record<string, unknown>;
  moveGroupBy(groupId: string, delta: { x: number; y: number }, options?: Record<string, unknown>): Record<string, unknown>;
  resizeGroup(groupId: string, size: { width: number; height: number }, options?: Record<string, unknown>): Record<string, unknown>;
  assignSelectedToGroup(groupId: string | null, options?: Record<string, unknown>): Record<string, unknown>;
  duplicateGroup(groupId: string, options?: Record<string, unknown>): Record<string, unknown>;
  deleteGroup(groupId: string, options?: Record<string, unknown>): Record<string, unknown>;
  undo(): Record<string, unknown>;
  redo(): Record<string, unknown>;
}

export function createChart(spec: Record<string, unknown>): Chart;
export function binData(rows: Array<Record<string, unknown>>, options: Omit<BinTransform, 'type'>): { rows: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>>; assumptions: string[] };
export function applyTransforms(rows: Array<Record<string, unknown>>, transforms: BinTransform | BinTransform[]): { rows: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>>; assumptions: string[] };
export function getBusinessSchema(name: string): BusinessDataSchema;
export function inspectDataSchema(schema: BusinessDataSchema): Record<string, unknown>;
export function validateData(values: unknown[], schema: BusinessDataSchema, options?: Record<string, unknown>): Record<string, unknown>;
export function previewEdit(command: EditCommand, options: Record<string, unknown>): EditPreview;
export function validateEdit(command: EditCommand, options: Record<string, unknown>): Record<string, unknown>;
export function getEditCapabilities(schema: BusinessDataSchema): Record<string, unknown>;
export function validateRecipe(recipe: Record<string, unknown>, capabilities?: Record<string, unknown>): Record<string, unknown>;

export function normalizeProjectCalendar(input?: ProjectCalendarConfig): { calendar: Required<ProjectCalendarConfig>; warnings: Array<Record<string, unknown>> };
export function applyWorkingCalendar(value: string | Date, options?: ProjectCalendarConfig | { calendar?: ProjectCalendarConfig }): { date: string | null; adjusted: boolean; warnings: Array<Record<string, unknown>> };
export function normalizeDependencies(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): { rows: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>> };
export function analyzeSchedule(rows: Array<Record<string, unknown>>, options?: { calendar?: ProjectCalendarConfig }): ScheduleAnalysisResult;
export function analyzeBurndownSeries(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): BurndownAnalysisResult;
export function analyzeCapacity(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildCapacityView(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildCumulativeFlowSeries(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildVelocitySeries(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildReleaseForecast(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildRiskMatrixSeries(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;
export function buildIssueAgingSeries(rows: Array<Record<string, unknown>>, options?: Record<string, unknown>): CapacityAnalysisResult;

export function normalizeLinkedFilters(input?: LinkedFilters): Required<LinkedFilters>;
export function normalizeLinkedSelection(input?: string[]): string[];
export function filterProjectRows(rows: Array<Record<string, unknown>>, linked?: { filters?: LinkedFilters } | LinkedFilters): Array<Record<string, unknown>>;
export function createLinkedProjectState(rows: Array<Record<string, unknown>>, linked?: { filters?: LinkedFilters; selection?: string[] }): LinkedState;
export function linkedRecordId(row: Record<string, unknown>, index?: number): string;
