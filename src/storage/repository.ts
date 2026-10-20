import { db } from './db';
import { Repository, Source, Highlight, Link } from '../types';

// Relations that mean the same thing in both directions: store them once, ordered by id,
// so UNIQUE(from_id, to_id) can't hold A->B and B->A at the same time.
const SYMMETRIC_RELATIONS = new Set(['related', 'contrasts']);

function dedupeLinks(links: Link[]): Link[] {
  const byId = new Map<number, Link>();
  for (const link of links) byId.set(link.id, link);
  return [...byId.values()];
}

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

  async listSources(): Promise<Source[]> {
    return db.sources.orderBy('lastOpenedAt').reverse().toArray();
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

  async addLink(l: Omit<Link, 'id' | 'createdAt'>): Promise<Link> {
    let { fromId, toId } = l;
    if (SYMMETRIC_RELATIONS.has(l.relation) && fromId > toId) {
      [fromId, toId] = [toId, fromId];
    }

    const existing = await db.links.where('fromId').equals(fromId).and((x) => x.toId === toId).first();
    if (existing) return existing;

    const link: Omit<Link, 'id'> = { ...l, fromId, toId, createdAt: new Date().toISOString() };
    const id = await db.links.add(link as Link);
    return { id, ...link };
  },

  async listLinksForHighlight(highlightId: number): Promise<Link[]> {
    const [fromLinks, toLinks] = await Promise.all([
      db.links.where('fromId').equals(highlightId).toArray(),
      db.links.where('toId').equals(highlightId).toArray(),
    ]);
    return dedupeLinks([...fromLinks, ...toLinks]);
  },

  async listLinksForSource(sourceId: number): Promise<Link[]> {
    const ids = (await db.highlights.where('sourceId').equals(sourceId).primaryKeys()) as number[];
    if (ids.length === 0) return [];
    const [fromLinks, toLinks] = await Promise.all([
      db.links.where('fromId').anyOf(ids).toArray(),
      db.links.where('toId').anyOf(ids).toArray(),
    ]);
    return dedupeLinks([...fromLinks, ...toLinks]);
  },

  async updateLink(id: number, patch: Partial<Link>): Promise<void> {
    const current = await db.links.get(id);
    if (!current) return;
    const merged = { ...current, ...patch };
    let { fromId, toId } = merged;
    if (SYMMETRIC_RELATIONS.has(merged.relation) && fromId > toId) {
      [fromId, toId] = [toId, fromId];
    }
    await db.links.update(id, { ...patch, fromId, toId });
  },

  async deleteLink(id: number): Promise<void> {
    await db.links.delete(id);
  },
};

export const repository: Repository = repositoryImpl;