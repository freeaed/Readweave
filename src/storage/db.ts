import Dexie from 'dexie';
import { Source, Highlight, Link } from '../types';

export class Database extends Dexie {
  sources!: Dexie.Table<Source, number>;
  highlights!: Dexie.Table<Highlight, number>;
  links!: Dexie.Table<Link, number>;

  constructor() {
    super('StudyToolDB');
    this.version(1).stores({
      sources: '++id, contentHash, lastOpenedAt',
      highlights: '++id, sourceId',
    });
    this.version(2).stores({
      sources: '++id, contentHash, lastOpenedAt',
      highlights: '++id, sourceId',
      links: '++id, fromId, toId',
    });
  }
}

export const db = new Database();