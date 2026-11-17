import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertDatabaseUrl, databaseFilePath } from "../env";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const migrationsFolder = join(process.cwd(), "lib/db/migrations");

/**
 * Open (and, when migrations exist, migrate) a SQLite database.
 * Exported separately from `getDatabase` so tests can use a throwaway database.
 */
export function createDatabase(url: string): Db {
  const file = databaseFilePath(url);
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  if (existsSync(join(migrationsFolder, "meta", "_journal.json"))) {
    migrate(db, { migrationsFolder });
  }
  return db;
}

const globalForDb = globalThis as unknown as { __mockableDb?: Db };

/** Process-wide database connection used by route handlers and server pages. */
export function getDatabase(): Db {
  if (!globalForDb.__mockableDb) {
    globalForDb.__mockableDb = createDatabase(assertDatabaseUrl());
  }
  return globalForDb.__mockableDb;
}
