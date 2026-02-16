import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if user exists by email (for testing scenarios where ID may change)
    // Use case-insensitive comparison for email matching
    if (userData.email) {
      const emailLower = userData.email.toLowerCase();
      const [existingByEmail] = await db.select().from(users).where(sql`lower(${users.email}) = ${emailLower}`);
      if (existingByEmail) {
        // Update existing user by email
        const [updated] = await db
          .update(users)
          .set({
            ...userData,
            id: existingByEmail.id, // Keep original ID
            email: emailLower, // Normalize email to lowercase
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }
    }
    
    // Try to insert or update by ID
    // Normalize email to lowercase on insert
    const normalizedData = {
      ...userData,
      email: userData.email?.toLowerCase(),
    };
    const [user] = await db
      .insert(users)
      .values(normalizedData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...normalizedData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
