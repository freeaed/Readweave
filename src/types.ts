/**
 * Data shape definitions for Phase 1.
 */

export type Source = {
  id: number;                 // auto-increment
  type: 'pdf';                // 'code' | 'text' arrive in later phases
  title: string;              // default: file name without extension
  contentHash: string;        // SHA-256 hex of the file bytes (crypto.subtle)
  fileBlob: Blob;             // the PDF itself (the browser cannot remember file paths)
  lastOpenedAt: string;       // ISO 8601
  lastPosition: { page: number } | null;
  createdAt: string;
};

export type Anchor = {
  page: number;               // 1-based
  rects: [number, number, number, number][]; // [x, y, w, h] as FRACTIONS (0..1) of page width/height
  quote: { exact: string; prefix: string; suffix: string };
};

export type Highlight = {
  id: number;
  sourceId: number;
  text: string;               // exact selected text
  note: string | null;
  anchor: Anchor;
  createdAt: string;
};

// Repository Interface
export interface Repository {
  addSource(s: Omit<Source, 'id'>): Promise<Source>;
  findSourceByHash(hash: string): Promise<Source | undefined>;
  getSource(id: number): Promise<Source | undefined>;
  getLastOpenedSource(): Promise<Source | undefined>;
  updateSource(id: number, patch: Partial<Source>): Promise<void>;
  addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight>;
  listHighlights(sourceId: number): Promise<Highlight[]>;
  updateHighlight(id: number, patch: Partial<Highlight>): Promise<void>;
  deleteHighlight(id: number): Promise<void>;
}
