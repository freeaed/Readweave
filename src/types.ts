// types.ts

export type Source = {
  id: number;
  type: 'pdf';
  title: string;
  contentHash: string;
  fileBlob: Blob;
  lastOpenedAt: string;
  lastPosition: { page: number } | null;
  createdAt: string;
};

export type Anchor = {
  page: number;
  rects: [number, number, number, number][];
  quote: { exact: string; prefix: string; suffix: string };
};

export type Highlight = {
  id: number;
  sourceId: number;
  text: string;
  note: string | null;
  anchor: Anchor;
  createdAt: string;
};

export type Link = {
  id: number;
  fromId: number;
  toId: number;
  relation: string;
  origin: 'user' | 'ai';
  status: 'suggested' | 'accepted' | 'rejected';
  createdAt: string;
};

export interface Repository {
  addSource(s: Omit<Source, 'id'>): Promise<Source>;
  findSourceByHash(hash: string): Promise<Source | undefined>;
  getSource(id: number): Promise<Source | undefined>;
  getLastOpenedSource(): Promise<Source | undefined>;
  listSources(): Promise<Source[]>;
  updateSource(id: number, patch: Partial<Source>): Promise<void>;
  addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight>;
  listHighlights(sourceId: number): Promise<Highlight[]>;
  updateHighlight(id: number, patch: Partial<Highlight>): Promise<void>;
  deleteHighlight(id: number): Promise<void>;
  addLink(l: Omit<Link, 'id' | 'createdAt'>): Promise<Link>;
  listLinksForHighlight(highlightId: number): Promise<Link[]>;
  listLinksForSource(sourceId: number): Promise<Link[]>;
  updateLink(id: number, patch: Partial<Link>): Promise<void>;
  deleteLink(id: number): Promise<void>;
}