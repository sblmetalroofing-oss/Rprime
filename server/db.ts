import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

// Get database URL from environment variable
const databaseUrl = process.env.DATABASE_URL_OVERRIDE || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not set. Please configure your database connection string."
    );
}

// Create PostgreSQL connection pool optimized for Vercel serverless
const pool = new Pool({
    connectionString: databaseUrl,
    // Serverless-optimized settings
    max: 1, // Vercel serverless functions should use minimal connections
    idleTimeoutMillis: 0, // Disable idle timeout (let serverless handle it)
    connectionTimeoutMillis: 5000, // 5 second timeout for acquiring connections
    allowExitOnIdle: true, // Allow the pool to close when idle (important for serverless)
});

// Initialize Drizzle ORM with the pool and schema
export const db = drizzle(pool, { schema });

// Export function to close database connections (useful for graceful shutdown)
export async function closeDatabase(): Promise<void> {
    await pool.end();
}

// Handle process termination gracefully
process.on("SIGTERM", async () => {
    console.log("SIGTERM received, closing database connections...");
    await closeDatabase();
    process.exit(0);
});

process.on("SIGINT", async () => {
    console.log("SIGINT received, closing database connections...");
    await closeDatabase();
    process.exit(0);
});
