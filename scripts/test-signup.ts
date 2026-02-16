
import 'dotenv/config';
import { db } from "../server/db";
import { users, organizations } from "../shared/schema";
import { createLocalUser } from "../server/auth-local";
// seedOrganizationData is exported from server/seed-organization.ts
import { seedOrganizationData } from "../server/seed-organization";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function run() {
    console.log("Starting Signup Test...");
    const email = `test_${Date.now()}@example.com`;
    const password = "password123";
    const firstName = "Test";
    const lastName = "User";
    const businessName = "Test Business";

    try {
        console.log(`Creating Local User: ${email}...`);
        const user = await createLocalUser(email, password, firstName, lastName);
        console.log("User Created:", user.id);

        console.log("Creating Organization...");
        const orgId = randomUUID();
        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + 14);

        const [org] = await db.insert(organizations).values({
            id: orgId,
            name: businessName,
            businessName: businessName,
            email: email,
            phone: "0400000000",
            ownerId: user.id,
            subscriptionStatus: "trialing",
            subscriptionPlan: "business",
            trialEndsAt: trialEndsAt,
        }).returning();
        console.log("Organization Created:", org.id);

        console.log("Updating User with Organization ID...");
        await db.update(users).set({ organizationId: org.id }).where(eq(users.id, user.id));

        console.log("Seeding Organization Data...");
        await seedOrganizationData({
            organizationId: org.id,
            companyName: businessName,
            ownerName: `${firstName} ${lastName}`,
            ownerEmail: email,
        });
        console.log("Seed Complete!");
        console.log("SUCCESS: Signup Logic Verified.");
        process.exit(0);
    } catch (error) {
        console.error("FAILURE: Signup Test Failed.");
        console.error(error);
        process.exit(1);
    }
}

run();
