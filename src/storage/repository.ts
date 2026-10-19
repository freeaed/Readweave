import { db } from './db';
import { Repository, Source, Highlight } from '../types';

export const repository: Repository = {
  async addSource(s: Omit<Source, 'id'>): Promise<Source> {
    // Ensure createdAt is set if not provided by caller logic
    const sourceWithDate: Partial<Source> = {
      ...s,
      createdAt: new Date().toISOString(),
    };
    return db.sources.add(sourceWithDate).then(id => {
      return { id, ...sourceWithDate } as Source;
    });
  },
  
  async findSourceByHash(hash: string): Promise<Source | undefined> {
    return db.sources.get(hash); // Note: Dexie get needs primary key. We must query by index.
  },

  // FIX: Dexie does not support index lookup for non-primary keys easily in methods like .get(). 
  // I will implement a general query helper needed here instead of relying on .get()
  async findSourceByHashFixed(hash: string): Promise<Source | undefined> {
    return db.sources.where('contentHash').equals(hash).first();
  },
  
  async getSource(id: number): Promise<Source | undefined> {
    return db.sources.get(id);
  },
  
  async getLastOpenedSource(): Promise<Source | undefined> {
    return db.sources.orderBy('lastOpenedAt').reverse().first();
  },

  async updateSource(id: number, patch: Partial<Source>): Promise<void> {
    return db.sources.update(id, patch);
  },

  async addHighlight(h: Omit<Highlight, 'id'>): Promise<Highlight> {
    const highlightWithDate: Partial<Highlight> = {
      ...h,
      createdAt: new Date().toISOString(),
    };
    return db.highlights.add(highlightWithDate).then(id => {
      return { id, ...highlightWithDate } as Highlight;
    });
  },

  async listHighlights(sourceId: number): Promise<Highlight[]> {
    return db.highlights.where('sourceId').equals(sourceId).toArray();
  },

  async updateHighlight(id: number, patch: Partial<Highlight>): Promise<void> {
    return db.highlights.update(id, patch);
  },

  async deleteHighlight(id: number): Promise<void> {
    return db.highlights.delete(id);
  },
};

// Re-assigning the methods to match the Repository interface exactly, 
// using the corrected hash search method internally.
export const repository: Repository = {
  addSource: repository.addSource,
  findSourceByHash: repository.findSourceByHashFixed, // Using fixed method
  getSource: repository.getSource,
  getLastOpenedSource: repository.getLastOpenedSource,
  updateSource: repository.updateSource,
  addHighlight: repository.addHighlight,
  listHighlights: repository.listHighlights,
  updateHighlight: repository.updateHighlight,
  deleteHighlight: repository.deleteHighlight,
};
