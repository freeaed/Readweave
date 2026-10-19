import { db } from './db';
import { Repository, Source, Highlight } from '../types';

const repositoryImpl = {
  async addSource(s: Omit<Source, 'id'>): Promise<Source> {
    const sourceWithDate: Omit<Source, 'id'> = {
      ...s,
      createdAt: new Date().toISOString(),
    };
    const id = await db.sources.add(sourceWithDate as Source);
    return { id, ...sourceWithDate };
  },

  async findSourceByHash(hash: string): Promise<Source | undefined> {
    return db.sources.where('contentHash').equals(hash).first();
  },

  async getSource(id: number): Promise<Source | undefined> {
    return db.sources.get(id);
  },

  async getLastOpenedSource(): Promise<Source | undefined> {
    return db.sources.orderBy('lastOpenedAt').reverse().first();
  },

  async updateSource(id: number, patch: Partial<Source>): Promise<void> {
    await db.sources.update(id, patch);
  },

  async addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight> {
    const highlightWithDate: Omit<Highlight, 'id'> = {
      ...h,
      createdAt: new Date().toISOString(),
    };
    const id = await db.highlights.add(highlightWithDate as Highlight);
    return { id, ...highlightWithDate };
  },

  async listHighlights(sourceId: number): Promise<Highlight[]> {
    return db.highlights.where('sourceId').equals(sourceId).toArray();
  },

  async updateHighlight(id: number, patch: Partial<Highlight>): Promise<void> {
    await db.highlights.update(id, patch);
  },

  async deleteHighlight(id: number): Promise<void> {
    await db.highlights.delete(id);
  },
};

export const repository: Repository = repositoryImpl;