import { Pool, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __etharaPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __etharaSchemaReady: Promise<void> | undefined;
}

export const pool =
  globalThis.__etharaPool ??
  new Pool(
    process.env.DATABASE_URL
      ? {
          connectionString: process.env.DATABASE_URL,
          ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
        }
      : undefined
  );

if (!globalThis.__etharaPool) {
  globalThis.__etharaPool = pool;
}

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Configure a PostgreSQL database for Railway or local development.');
  }

  return pool.query<T>(text, values);
}
