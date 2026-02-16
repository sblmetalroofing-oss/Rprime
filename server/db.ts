import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { logger } from "./logger";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  const errorMsg = "DATABASE_URL must be set. Did you forget to provision a database?";
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Configure connection pool with optimal settings
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for acquiring connection
  // Enable SSL for production databases (most cloud providers require this)
  ssl: process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : undefined,
};

export const pool = new Pool(poolConfig);

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', err);
});

// Log successful connection in development
pool.on('connect', () => {
  logger.debug('New database connection established');
});

export const db = drizzle(pool, { schema });

// Graceful shutdown helper
export async function closeDatabase(): Promise<void> {
  logger.info('Closing database connections...');
  await pool.end();
  logger.info('Database connections closed');
}

