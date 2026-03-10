import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema/index.js';

export * from './schema/index.js';
export { runMigrations } from './migrate.js';

export function createDb(url?: string) {
  const databaseUrl = url ?? process.env.DATABASE_URL ?? './clawlive.db';
  const sqlite = new Database(databaseUrl);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma('journal_mode = WAL');

  return drizzle(sqlite, { schema });
}

export type Database = ReturnType<typeof createDb>;
