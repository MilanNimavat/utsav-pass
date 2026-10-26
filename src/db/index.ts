// Unified Database Layer for Sharad Utsav 2026
import { PrismaAdapter } from './prisma-adapter';
import { SqliteAdapter } from './sqlite-adapter';
import type { DatabaseAdapter } from './types';

let globalDb: DatabaseAdapter | null = null;

export function getDb(): DatabaseAdapter {
  if (globalDb) return globalDb;

  const databaseUrl = process.env.DATABASE_URL;

  // Use PostgreSQL via Prisma if DATABASE_URL points to postgres/postgresql
  if (
    databaseUrl &&
    (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))
  ) {
    globalDb = new PrismaAdapter();
    return globalDb;
  }

  // Otherwise, use zero-config local SQLite
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const sqlitePath = isTest ? ':memory:' : process.env.SQLITE_DB_PATH || 'utsav.db';

  globalDb = new SqliteAdapter(sqlitePath);
  return globalDb;
}

export async function ensureCatalogSeeded(): Promise<void> {
  const db = getDb();
  await db.ensureCatalogSeeded();
}

export * from './types';
