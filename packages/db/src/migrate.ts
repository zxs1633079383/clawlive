import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';

const databaseUrl = process.env.DATABASE_URL ?? './clawlive.db';

export function runMigrations(): void {
  const sqlite = new Database(databaseUrl);
  const db = drizzle(sqlite);

  migrate(db, { migrationsFolder: './drizzle' });

  sqlite.close();
}

// Run directly if executed as a script
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runMigrations();
  console.log('Migrations complete.');
}
