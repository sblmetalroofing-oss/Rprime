import { db } from "./db";
import { jobs, documentSettings, tenantMigrations } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const STARTING_NUMBER = 1456;
const DEFAULT_PREFIX = "JOB-";
const MIGRATION_KEY = "standardize_job_numbers_v1";

function isStandardizedFormat(refNum: string | null): boolean {
  if (!refNum) return false;
  if (!refNum.startsWith(DEFAULT_PREFIX)) return false;
  const numPart = refNum.replace(DEFAULT_PREFIX, "");
  const num = parseInt(numPart, 10);
  return !isNaN(num) && num >= STARTING_NUMBER;
}

function extractNumber(refNum: string): number {
  const numPart = refNum.replace(DEFAULT_PREFIX, "");
  return parseInt(numPart, 10) || 0;
}

export async function migrateJobNumbersForOrg(organizationId: string): Promise<{ success: boolean; migratedCount: number; message: string }> {
  console.log(`[Job Migration] Starting job number standardization for org ${organizationId}...`);
  
  try {
    const existingMigration = await db
      .select()
      .from(tenantMigrations)
      .where(and(
        eq(tenantMigrations.organizationId, organizationId),
        eq(tenantMigrations.migrationKey, MIGRATION_KEY)
      ))
      .limit(1);

    if (existingMigration.length > 0) {
      console.log(`[Job Migration] Migration already completed for org ${organizationId} at ${existingMigration[0].completedAt}`);
      return { success: true, migratedCount: 0, message: "Migration already completed for this organization" };
    }

    const orgJobs = await db
      .select({ id: jobs.id, referenceNumber: jobs.referenceNumber, createdAt: jobs.createdAt })
      .from(jobs)
      .where(eq(jobs.organizationId, organizationId))
      .orderBy(asc(jobs.createdAt));

    const jobsToMigrate = orgJobs.filter(j => !isStandardizedFormat(j.referenceNumber));
    const alreadyStandardized = orgJobs.filter(j => isStandardizedFormat(j.referenceNumber));

    if (jobsToMigrate.length === 0) {
      await db.insert(tenantMigrations).values({
        id: randomUUID(),
        organizationId,
        migrationKey: MIGRATION_KEY,
      });
      console.log(`[Job Migration] All ${orgJobs.length} jobs already have standardized reference numbers`);
      return { success: true, migratedCount: 0, message: "All jobs already have standardized reference numbers" };
    }

    const highestExisting = alreadyStandardized.reduce((max, j) => {
      const num = extractNumber(j.referenceNumber!);
      return num > max ? num : max;
    }, 0);

    const settings = await db
      .select({ nextNumber: documentSettings.nextNumber })
      .from(documentSettings)
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, "job")
      ))
      .limit(1);
    
    let currentNumber = Math.max(STARTING_NUMBER, highestExisting + 1, settings[0]?.nextNumber || 1);

    console.log(`[Job Migration] ${jobsToMigrate.length} jobs to migrate, ${alreadyStandardized.length} already done, starting at ${currentNumber}`);

    for (const job of jobsToMigrate) {
      const referenceNumber = `${DEFAULT_PREFIX}${currentNumber}`;

      await db
        .update(jobs)
        .set({ referenceNumber })
        .where(eq(jobs.id, job.id));

      console.log(`[Job Migration] ${job.referenceNumber || '(none)'} -> ${referenceNumber}`);
      currentNumber++;
    }

    const existingSettings = await db
      .select({ id: documentSettings.id })
      .from(documentSettings)
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, "job")
      ))
      .limit(1);

    if (existingSettings.length > 0) {
      await db
        .update(documentSettings)
        .set({ nextNumber: currentNumber, prefix: DEFAULT_PREFIX.replace('-', '') })
        .where(eq(documentSettings.id, existingSettings[0].id));
    } else {
      await db.insert(documentSettings).values({
        id: randomUUID(),
        organizationId,
        type: "job",
        prefix: DEFAULT_PREFIX.replace('-', ''),
        nextNumber: currentNumber,
      });
    }
    console.log(`[Job Migration] Updated job document settings: nextNumber=${currentNumber}`);

    await db.insert(tenantMigrations).values({
      id: randomUUID(),
      organizationId,
      migrationKey: MIGRATION_KEY,
    });

    console.log(`[Job Migration] Successfully standardized ${jobsToMigrate.length} jobs, next number: ${currentNumber}`);
    return { 
      success: true, 
      migratedCount: jobsToMigrate.length, 
      message: `Successfully standardized ${jobsToMigrate.length} jobs to JOB-${STARTING_NUMBER}+ format. New jobs will start at JOB-${currentNumber}.` 
    };

  } catch (error: unknown) {
    console.error("[Job Migration] Error during migration:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, migratedCount: 0, message: `Migration failed: ${errorMessage}` };
  }
}

export async function checkMigrationStatus(organizationId: string): Promise<{ completed: boolean; completedAt?: Date }> {
  const existingMigration = await db
    .select()
    .from(tenantMigrations)
    .where(and(
      eq(tenantMigrations.organizationId, organizationId),
      eq(tenantMigrations.migrationKey, MIGRATION_KEY)
    ))
    .limit(1);

  if (existingMigration.length > 0) {
    return { completed: true, completedAt: existingMigration[0].completedAt };
  }
  return { completed: false };
}
