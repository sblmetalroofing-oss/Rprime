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

// Lazy initialization for Vercel serverless - don't create pool until first use
let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

function getPool(): Pool {
    if (!pool) {
        pool = new Pool({
            connectionString: databaseUrl,
            // Server less-optimized settings
            max: 1, // Vercel serverless functions should use minimal connections
            idleTimeoutMillis: 0, // Disable idle timeout (let serverless handle it)
            connectionTimeoutMillis: 5000, // 5 second timeout for acquiring connections
            allowExitOnIdle: true, // Allow the pool to close when idle (important for serverless)
        });
    }
    return pool;
}

// Export db with lazy initialization
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
    get(target, prop) {
        if (!dbInstance) {
            dbInstance = drizzle(getPool(), { schema });
        }
        return (dbInstance as any)[prop];
    }
});

// Export function to close database connections (useful for graceful shutdown)
export async function closeDatabase(): Promise<void> {
    if (pool) {
        await pool.end();
        pool = null;
        dbInstance = null;
    }
}

// Handle process termination gracefully (only if not on Vercel serverless)
if (!process.env.VERCEL) {
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
}

