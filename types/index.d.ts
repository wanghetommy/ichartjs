export type Renderer = 'canvas' | 'svg' | 'auto';
export type ChartType = 'line' | 'area' | 'bar' | 'column' | 'pie' | 'scatter' | 'funnel' | 'gauge' | 'heatmap' | 'radar' | 'gantt' | 'timeline' | 'milestone' | 'burndown' | 'flow' | 'swimlane' | 'architecture' | 'mindmap';
export type ThemeMode = 'auto' | 'light' | 'dark' | 'contrast';
export type ThemePreset = 'auto' | 'analysis' | 'dashboard' | 'report' | 'presentation' | 'project' | 'diagram';
export type ThemePalette = 'auto' | 'categorical' | 'sequential' | 'diverging' | 'status';
export type PreferenceTriState = 'auto' | boolean;
export type PreferenceDensity = 'compact' | 'comfortable' | 'spacious';
export type PreferenceMotion = 'auto' | 'full' | 'reduced' | 'off';
export type ExportKind = 'json' | 'svg' | 'png' | 'jpeg' | 'jpg' | 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'application/json';
export type ExportAs = 'string' | 'dataurl' | 'blob' | 'object';
export interface ExportError { valid: false; code: string; rasterCode?: string; message?: string; suggestion?: string; [key: string]: unknown }
export interface ThemeConfig { mode?: ThemeMode; preset?: ThemePreset; palette?: ThemePalette; tokens?: Record<string, unknown>; branding?: boolean | { enabled?: boolean; [key: string]: unknown }; [key: string]: unknown; }
export interface ChartPreferences { version: '1.0'; theme: { mode: ThemeMode | null; preset: ThemePreset | null; palette: ThemePalette | null }; typography: { scale: number }; density: PreferenceDensity; components: { legend: PreferenceTriState; labels: PreferenceTriState; grid: PreferenceTriState }; branding: { enabled: PreferenceTriState }; motion: PreferenceMotion; }
export type ChartPreferencesPatch = Partial<Omit<ChartPreferences, 'version'>> & { version?: '1.0'; theme?: Partial<ChartPreferences['theme']>; typography?: Partial<ChartPreferences['typography']>; components?: Partial<ChartPreferences['components']>; branding?: Partial<ChartPreferences['branding']> };
export interface PreferenceCapabilityOption { value: string | number | boolean | null; label: string; }
export interface PreferenceFieldCapability { path: string; group: 'theme' | 'typography' | 'components' | 'behavior'; groupLabel: string; type: 'enum' | 'number' | 'tri-state'; label: string; description: string; default: string | number | boolean | null; options: PreferenceCapabilityOption[]; scopes: Array<'global' | 'chart'>; supported: boolean; applicability: string; menu: { visible: boolean; control: 'select' | 'toggle' }; minimum?: number; maximum?: number; }
export interface PreferenceCapabilities { version: '1.0'; locale: 'en' | 'zh-CN'; chartType: ChartType | null; scopes: Array<'global' | 'chart'>; persistence: Array<'memory' | 'localStorage' | 'adapter'>; precedence: string[]; fields: PreferenceFieldCapability[]; }
export interface PreferencesStoreState { version: '1.0'; global: ChartPreferences; charts: Record<string, ChartPreferencesPatch>; }
export interface PreferencesStore { version: '1.0'; storageKey: string; storage: 'localStorage' | 'memory'; getState(): PreferencesStoreState; getGlobal(): ChartPreferences; getChart(chartId: string): ChartPreferencesPatch; getEffective(chartId?: string | null): ChartPreferences; setGlobal(patch: ChartPreferencesPatch, options?: { source?: string; persist?: boolean }): ChartPreferences; setChart(chartId: string, patch: ChartPreferencesPatch, options?: { source?: string; persist?: boolean }): ChartPreferences; reset(options?: { scope?: 'all' | 'global' | 'chart'; chartId?: string; source?: string; persist?: boolean }): ChartPreferences; subscribe(listener: (event: { type: 'change'; scope: string; chartId: string | null; source: string; persisted: boolean; preferences: ChartPreferences; state: PreferencesStoreState }) => void): () => void; persist(): boolean; }
export interface PreferencesStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void; }
export interface StyleRecommendation { version: '1.0'; preset: Exclude<ThemePreset, 'auto'>; mode: ThemeMode; resolvedMode: Exclude<ThemeMode, 'auto'>; palette: Exclude<ThemePalette, 'auto'>; reasons: string[]; warnings: Diagnostic[]; userOverride: boolean; }
export interface ResolvedTheme extends ThemeConfig { name: string; resolvedMode: Exclude<ThemeMode, 'auto'>; background: string; surface: string; text: string; muted: string; axis: string; grid: string; border: string; focus: string; selection: string; colors: string[]; palettes: Record<string, unknown>; status: Record<string, string>; typography: Record<string, { size: number; weight: number; lineHeight: number; font: string }>; layout: Record<string, unknown>; marks: Record<string, unknown>; reasons: string[]; warnings: Diagnostic[]; }
export interface Diagnostic { code: string; path?: string; message: string; expected?: unknown; suggestion?: string; [key: string]: unknown; }
export interface DataFieldInfo { name: string; type: 'quantitative' | 'temporal' | 'category' | 'unknown'; role: 'identifier' | 'measure' | 'temporal-dimension' | 'dimension'; unit: string | null; cardinality: number; validCount: number; nullCount: number; min?: number; max?: number; temporalMin?: string; temporalMax?: string; }
export interface DataInspection { version: '1.0'; rows: number; fields: DataFieldInfo[]; dimensions: string[]; measures: string[]; temporalFields: string[]; missingValueCount: number; warnings: Diagnostic[]; }
export interface ChartCapability { type: ChartType; family: string; intents: string[]; required: string[]; optional: string[]; dataShapes: string[]; interactions: string[]; features: Record<string, 'supported' | 'not-applicable' | 'degraded'>; renderers: Array<'canvas' | 'svg'>; exports: string[]; limits: Record<string, number>; }
export interface RuntimeCapabilities { version: '2.0'; contractVersion: '1.0'; chartTypes: ChartType[]; charts: Record<ChartType, ChartCapability>; intents: string[]; renderers: Array<'canvas' | 'svg'>; interactions: string[]; exports: Array<'png' | 'svg' | 'json' | 'jpeg'>; styleSystem: { modes: ThemeMode[]; presets: ThemePreset[]; palettes: ThemePalette[]; switchable: boolean; automatic: boolean; [key: string]: unknown }; preferences?: { version: '1.0'; scopes: string[]; persistence: string[]; fields: string[]; agentAdjustable: boolean; interactiveSettingsUI: boolean; precedence: string[]; schema: PreferenceCapabilities }; headless: { preview?: boolean; json: boolean; svg: boolean; png: boolean | string }; export: { types: string[]; mime: Record<string, string>; browser: Record<string, boolean>; headless: Record<string, string | boolean>; methods: string[]; options: Record<string, unknown>; branding: Record<string, unknown> }; branding: { defaultEnabled: boolean; signature: string; options: Record<string, unknown> }; [key: string]: unknown; }
export interface ChartPlan { version: '1.0'; intent: string; primary: ChartType; alternatives: ChartType[]; confidence: number; reasons: string[]; requiredFields: string[]; suggestedEncodings: { dimension: string | null; measure: string | null; secondaryMeasure: string | null }; assumptions: string[]; warnings: Diagnostic[]; unsupportedRequests: string[]; nextActions: string[]; capability: ChartCapability; styleRecommendation: StyleRecommendation; data: DataInspection; }
export interface ChartExplanation { version: '1.0'; type: ChartType; family: string; purpose: string; renderer: Renderer; dataCount: number; encodings: Record<string, string | string[]>; transforms: string[]; interactions: string[]; assumptions: string[]; warnings: Diagnostic[]; style: Partial<StyleRecommendation> & { name?: string }; lineage: { recordIds: string[]; sourcePreserved: boolean }; accessibility: { enabled: boolean; summary: string }; }
export interface ChartInteraction { tooltip?: boolean; hover?: boolean; click?: boolean; crosshair?: boolean; zoom?: boolean; pan?: boolean; brush?: boolean; drag?: boolean; edgeDrag?: boolean; portConnect?: boolean; keyboard?: boolean; [key: string]: boolean | undefined; }
export interface ChartEditing { enabled?: boolean; mode?: 'command' | string; requireConfirmation?: boolean; allowDelete?: boolean; allowStructuralChanges?: boolean; }
export interface ChartSpec { type: ChartType; renderer?: Renderer; container?: string | Element; chartId?: string; width?: number; height?: number; data?: Array<Record<string, unknown>> | { values?: Array<Record<string, unknown>>; [key: string]: unknown }; encoding?: Record<string, unknown>; title?: { text?: string; subtitle?: string }; legend?: { visible?: boolean; position?: string }; grid?: { visible?: boolean; color?: string }; labels?: { enabled?: boolean; format?: string | Record<string, unknown>; color?: string; font?: string }; diagram?: DiagramConfig; interaction?: ChartInteraction; editing?: ChartEditing; accessibility?: { enabled?: boolean; description?: string }; branding?: boolean | { enabled?: boolean }; theme?: ThemeMode | ThemePreset | ThemeConfig | ResolvedTheme; preferences?: ChartPreferencesPatch | PreferencesStore; preferencesStore?: PreferencesStore; [key: string]: unknown; }
export interface BinTransform { type: 'bin'; field: string; output?: string; thresholds?: number; step?: number; extent?: [number, number]; }
export interface RadarIndicator { name: string; field: string; min?: number; max?: number; }
export interface DiagramNode { id: string; label: string; position?: { x: number; y: number }; size?: { width: number; height: number }; ports?: Array<{ id: string; side?: 'left' | 'right' | 'top' | 'bottom'; offset?: number }>; groupId?: string; }
export interface ArchitectureNode extends DiagramNode { layerId?: string; boundaryId?: string; role?: string; description?: string; }
export interface MindmapNode extends DiagramNode { parentId?: string; branch?: string; description?: string; }
export interface DiagramPoint { x: number; y: number; }
export interface DiagramEdge { id?: string; from: string; to: string; fromPort?: string; toPort?: string; label?: string; relation?: string; routing?: 'straight' | 'orthogonal' | 'curved'; curveTension?: number; waypoints?: DiagramPoint[]; }
export interface DiagramConfig { mode?: 'process' | 'architecture' | 'mindmap'; layout?: 'manual' | 'layered' | 'tree' | 'radial'; routing?: 'straight' | 'orthogonal' | 'curved'; curveTension?: number; grid?: number; snap?: boolean; }
export interface ArchitectureLayer { id: string; label?: string; }
export interface ArchitectureBoundary { id: string; label?: string; nodeIds?: string[]; padding?: number; color?: string; }
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
  getSpec(): ChartSpec;
  describe(): Record<string, unknown>;
  explain(): ChartExplanation;
  update(spec: Partial<ChartSpec>): this;
  setData(data: Array<Record<string, unknown>>): this;
  setTheme(theme?: ChartSpec['theme']): this;
  getTheme(): ResolvedTheme;
  getPreferences(): ChartPreferences;
  setPreferences(patch?: ChartPreferencesPatch, options?: { scope?: 'chart' | 'global'; source?: string; persist?: boolean }): this;
  resetPreferences(options?: { scope?: 'all' | 'global' | 'chart'; source?: string; persist?: boolean }): this;
  resize(width?: number, height?: number): this;
  resetZoom(): this;
  zoomTo(view: Record<string, number>): this;
  panBy(delta: { x?: number; y?: number }): this;
  clearSelection(): this;
  toDataURL(type?: 'image/png' | 'image/jpeg' | 'image/svg+xml'): string | ExportError;
  toBlob(type?: 'image/png' | 'image/jpeg' | 'image/svg+xml'): Blob | ExportError;
  export(options?: { type?: ExportKind; as?: ExportAs }): string | { version: string; spec: unknown; state: unknown } | Blob | ExportError;
  exportAsync(options?: { type?: ExportKind; as?: ExportAs }): Promise<string | { version: string; spec: unknown; state: unknown } | Blob | ExportError>;
  download(options?: { type?: ExportKind | 'json' }): { valid: boolean; filename?: string; size?: number; type?: string; code?: string; message?: string } | ExportError | string;
  downloadPNG(): ReturnType<Chart['download']>;
  downloadSVG(): ReturnType<Chart['download']>;
  downloadJSON(): ReturnType<Chart['download']>;
  destroy(): void;
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
  selectEdges(edgeIds: string[], options?: { additive?: boolean }): this;
  selectGroup(groupId: string, options?: { additive?: boolean }): this;
  getSelectedNodeIds(): string[];
  getSelectedEdgeIds(): string[];
  deleteSelectedEdges(options?: Record<string, unknown>): Record<string, unknown>;
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

export function createChart(spec: ChartSpec): Chart;
export const defaultPreferences: ChartPreferences;
export function getPreferenceCapabilities(chartType?: ChartType | string | null, options?: { locale?: 'en' | 'zh-CN' | string }): PreferenceCapabilities;
export function createPreferencesStore(options?: { storage?: 'localStorage' | 'memory' | PreferencesStorage; storageKey?: string; global?: ChartPreferencesPatch; charts?: Record<string, ChartPreferencesPatch> }): PreferencesStore;
export function normalizePreferences(input?: ChartPreferencesPatch, options?: { partial?: boolean }): ChartPreferences;
export function mergePreferences(...values: ChartPreferencesPatch[]): ChartPreferences;
export function validatePreferences(input?: ChartPreferencesPatch, options?: { partial?: boolean }): { valid: boolean; errors: Diagnostic[]; value: ChartPreferences | ChartPreferencesPatch };
export function mergeThemePreference(theme: ChartSpec['theme'], preferenceTheme?: Partial<ChartPreferences['theme']>): ChartSpec['theme'];
export function applyPreferencesToSpec(spec: ChartSpec, preferences?: ChartPreferencesPatch): ChartSpec;
export function mountChartSettings(chart: Chart, options?: { container?: Element; locale?: 'auto' | 'zh-CN' | 'en'; title?: string; placement?: 'auto' | 'right' | 'top' | 'bottom'; preferredPlacements?: Array<'right' | 'top' | 'bottom'> }): { valid: true; element: Element; panel: Element; locale: 'zh-CN' | 'en'; capabilities: PreferenceCapabilities; destroy(): void } | { valid: false; code: string; message: string };
export function normalizeSpec(spec: Partial<ChartSpec>): ChartSpec;
export function validateSpec(spec: Partial<ChartSpec>): { valid: boolean; errors: Diagnostic[]; warnings: Diagnostic[]; normalizations: Diagnostic[]; spec: ChartSpec };
export function normalizeData(input: unknown): { rows: Array<Record<string, unknown>>; fields: DataFieldInfo[]; warnings: Diagnostic[] };
export function inspectData(input: unknown): DataInspection;
export function getCapabilities(): RuntimeCapabilities;
export function getChartCapability(type: ChartType | string): ChartCapability | null;
export function planChart(input: unknown, options?: { intent?: string; renderer?: Renderer; context?: string; theme?: ChartSpec['theme']; preferredColorScheme?: 'light' | 'dark' }): ChartPlan;
export function recommend(input: unknown, options?: { intent?: string; renderer?: Renderer }): { primary: ChartType; alternatives: ChartType[]; reason: string; reasons: string[]; confidence: number; requiredFields: string[]; assumptions: string[]; warnings: Diagnostic[]; nextActions: string[] };
export function explainChart(spec: ChartSpec, model?: Record<string, unknown>): ChartExplanation;
export function planStyle(spec?: Partial<ChartSpec>, options?: { context?: string; theme?: ChartSpec['theme']; preferredColorScheme?: 'light' | 'dark' }): StyleRecommendation;
export function resolveTheme(theme?: ChartSpec['theme'], options?: Partial<ChartSpec> & { context?: string; preferredColorScheme?: 'light' | 'dark' }): ResolvedTheme;
export function contrastRatio(foreground: string, background: string): number | null;
export function validateThemeContrast(theme: ResolvedTheme): Diagnostic[];
export const themeModes: ThemeMode[];
export const themePresets: ThemePreset[];
export const themePalettes: ThemePalette[];
export const styleCapabilities: RuntimeCapabilities['styleSystem'];
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
