import type { BoardCapabilities, ExportDelivery } from './index.d.ts';
export { FreeformBoard, createBoard, validateBoardSpec, validateBoardCommand, planCanvas, boardCapabilities } from './index.d.ts';
export type { BoardRenderer, BoardItemKind, BoardAsset, BoardItem, BoardSpec, BoardHealth, BoardState, BoardExplanation, BoardItemChanges, BoardEditOperation, BoardEditCommand, BoardLayout, BoardEditResult, BoardChange, BoardEvent, BoardCapabilities, ChartSpec, Renderer, Diagnostic, ExportDelivery } from './index.d.ts';
export declare const profile: 'board';
export interface BoardProfileCapabilities { version: '2.0'; profile: 'board'; boardCapabilities: BoardCapabilities; renderers: Array<'svg' | 'canvas'>; exports: Array<'svg' | 'png' | 'jpeg' | 'json'>; export: { delivery: ExportDelivery }; defaults: { navigation: false; editing: false }; }
export declare function getCapabilities(): BoardProfileCapabilities;
