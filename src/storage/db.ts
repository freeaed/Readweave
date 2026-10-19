import Dexie from 'dexie';
import { Source, Highlight } from '../types';

export class Database extends Dexie {
  sources!: Dexie.Table<Source, number>;
  highlights!: Dexie.Table<Highlight, number>;

  constructor() {
    super('StudyToolDB');
    this.version(1).stores({
      sources: '++id, contentHash, lastOpenedAt',
      highlights: '++id, sourceId',
    });
  }
}

export const db = new Database();