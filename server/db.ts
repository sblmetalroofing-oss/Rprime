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

// Create PostgreSQL connection pool
const pool = new Pool({
    connectionString: databaseUrl,
    // Connection pool settings for better performance
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring a client
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
