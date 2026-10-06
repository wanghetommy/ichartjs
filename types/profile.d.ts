import type { ChartSpec, ChartType, DataInspection, Diagnostic, ExportAs, ExportKind, Renderer, RuntimeCapabilities } from './index.d.ts';

export declare const profile: string;
export declare const chartTypes: readonly ChartType[];
export interface ProfileLineage { recordIds: string[]; sourcePreserved: boolean; }
export interface ProfileState { version: string; profile: string; type: ChartType; renderer: Renderer; warnings: Diagnostic[]; normalizations: unknown[]; health: { status: string; renderable: boolean; issues: string[] }; lineage: ProfileLineage; [key: string]: unknown; }
export interface ProfileExplanation { version: string; profile: string; type: ChartType; renderer: Renderer; requiredFields: string[]; assumptions: string[]; warnings: Diagnostic[]; health: ProfileState['health']; lineage: ProfileLineage; [key: string]: unknown; }
export declare class ProfileChart {
  readonly profile: string;
  readonly spec: ChartSpec;
  readonly model: unknown;
  constructor(spec?: ChartSpec);
  render(): this;
  resize(width: number, height?: number): this;
  update(patch?: Partial<ChartSpec>): this;
  setTheme(theme: ChartSpec['theme']): this;
  getSpec(): ChartSpec;
  getData(): unknown;
  getState(): ProfileState;
  explain(): ProfileExplanation;
  export(options?: { type?: ExportKind; as?: ExportAs }): string | Record<string, unknown>;
  destroy(): void;
}
export declare function createChart(spec?: ChartSpec): ProfileChart;
export declare function getCapabilities(): RuntimeCapabilities & { profile: string; chartTypes: readonly ChartType[] };
export declare function validateSpec(spec?: ChartSpec): { valid: boolean; spec: ChartSpec; warnings: Diagnostic[]; errors: Diagnostic[]; normalizations: unknown[] };
export declare function normalizeSpec(spec?: ChartSpec): ChartSpec;
export declare function normalizeData(input: unknown): unknown;
export declare function inspectData(input: unknown): DataInspection;
export declare function binData(input: unknown, options?: Record<string, unknown>): unknown;
export declare function applyTransforms(input: unknown, transforms?: unknown): unknown;
