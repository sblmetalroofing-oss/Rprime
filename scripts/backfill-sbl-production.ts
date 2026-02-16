import { db } from "../server/db";
import { 
  organizations, 
  customers, 
  suppliers, 
  jobs, 
  jobTemplates,
  quotes, 
  invoices, 
  purchaseOrders,
  reports, 
  crewMembers, 
  leads,
  chatChannels, 
  directMessages,
  documentSettings,
  appSettings,
  documentThemes,
  users,
  items
} from "../shared/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const SBL_ORG_NAME = "SBL Roofing Pty Ltd";
const DRY_RUN = process.argv.includes("--dry-run");

async function backfillSBLProduction() {
  console.log("=".repeat(60));
  console.log("SBL Roofing Production Data Backfill");
  if (DRY_RUN) {
    console.log("*** DRY RUN MODE - No changes will be made ***");
  }
  console.log("=".repeat(60));
  console.log("");

  try {
    let sblOrgId: string;
    const existingOrgs = await db.select().from(organizations).where(eq(organizations.name, SBL_ORG_NAME));
    
    if (existingOrgs.length > 0) {
      sblOrgId = existingOrgs[0].id;
      console.log(`Found existing SBL Roofing organization: ${sblOrgId}`);
    } else if (DRY_RUN) {
      console.log(`WARNING: SBL Roofing organization does not exist.`);
      console.log(`In a real run, a new organization would be created.`);
      console.log(`Cannot complete dry-run without existing organization.`);
      console.log("");
      console.log("Backfill dry-run completed (partial - no org found).");
      return;
    } else {
      const newId = randomUUID();
      const [newOrg] = await db.insert(organizations).values({
        id: newId,
        name: SBL_ORG_NAME,
        subscriptionPlan: "business",
        subscriptionStatus: "active",
        trialEndsAt: null
      }).returning();
      sblOrgId = newOrg.id;
      console.log(`Created new SBL Roofing organization: ${sblOrgId}`);
    }

    const tables = [
      { name: "customers", table: customers, field: customers.organizationId },
      { name: "suppliers", table: suppliers, field: suppliers.organizationId },
      { name: "jobs", table: jobs, field: jobs.organizationId },
      { name: "jobTemplates", table: jobTemplates, field: jobTemplates.organizationId },
      { name: "quotes", table: quotes, field: quotes.organizationId },
      { name: "invoices", table: invoices, field: invoices.organizationId },
      { name: "purchaseOrders", table: purchaseOrders, field: purchaseOrders.organizationId },
      { name: "reports", table: reports, field: reports.organizationId },
      { name: "crewMembers", table: crewMembers, field: crewMembers.organizationId },
      { name: "leads", table: leads, field: leads.organizationId },
      { name: "chatChannels", table: chatChannels, field: chatChannels.organizationId },
      { name: "directMessages", table: directMessages, field: directMessages.organizationId },
      { name: "documentSettings", table: documentSettings, field: documentSettings.organizationId },
      { name: "appSettings", table: appSettings, field: appSettings.organizationId },
      { name: "documentThemes", table: documentThemes, field: documentThemes.organizationId },
      { name: "users", table: users, field: users.organizationId },
      { name: "items", table: items, field: items.organizationId },
    ];

    console.log("");
    console.log("Checking for records with NULL organizationId...");
    console.log("");
    
    const pendingUpdates: { name: string; count: number; table: any; field: any }[] = [];
    
    for (const { name, table, field } of tables) {
      const nullCount = await db.select({ count: sql<number>`count(*)` })
        .from(table)
        .where(isNull(field));
      
      const count = Number(nullCount[0]?.count || 0);
      
      if (count > 0) {
        console.log(`  ${name}: ${count} records need update`);
        pendingUpdates.push({ name, count, table, field });
      } else {
        console.log(`  ${name}: No NULL records (already backfilled)`);
      }
    }
    
    if (pendingUpdates.length === 0) {
      console.log("");
      console.log("No updates needed - all data is already backfilled!");
    } else if (DRY_RUN) {
      console.log("");
      console.log("DRY RUN - Would update the following:");
      let totalWouldUpdate = 0;
      for (const { name, count } of pendingUpdates) {
        console.log(`  - ${name}: ${count} records`);
        totalWouldUpdate += count;
      }
      console.log("");
      console.log(`Total: ${totalWouldUpdate} records would be updated`);
      console.log("Run without --dry-run to apply changes.");
    } else {
      console.log("");
      console.log(`Starting transaction to update ${pendingUpdates.length} tables...`);
      console.log("");
      
      let totalUpdated = 0;
      
      await db.transaction(async (tx) => {
        for (const { name, count, table, field } of pendingUpdates) {
          await tx.update(table)
            .set({ organizationId: sblOrgId } as any)
            .where(isNull(field));
          
          console.log(`  ✓ Updated ${count} ${name} records`);
          totalUpdated += count;
        }
      });
      
      console.log("");
      console.log("=".repeat(60));
      console.log(`Transaction committed! Updated ${totalUpdated} total records.`);
      console.log("=".repeat(60));
    }
    
    console.log("");
    console.log("Verification - Record counts for SBL Roofing:");
    for (const { name, table, field } of tables) {
      const sblCount = await db.select({ count: sql<number>`count(*)` })
        .from(table)
        .where(eq(field, sblOrgId));
      console.log(`  ${name}: ${sblCount[0]?.count || 0} records`);
    }

    console.log("");
    console.log("Backfill script completed successfully!");
    
  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  }
}

backfillSBLProduction()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
