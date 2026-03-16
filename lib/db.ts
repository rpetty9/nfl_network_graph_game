import { Pool } from "pg";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

const databaseUrl = process.env.DATABASE_URL;
const useSsl = process.env.DB_SSL === "require" || process.env.NODE_ENV === "production";
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";

export const pool =
  globalForDb.pool ??
  new Pool(
    databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl: useSsl ? { rejectUnauthorized } : undefined,
        }
      : {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
          ssl: useSsl ? { rejectUnauthorized } : undefined,
        },
  );

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}
