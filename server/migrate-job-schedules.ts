import { db } from "./db";
import { jobs, appointments } from "@shared/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { nanoid } from "nanoid";

function calculateEndTime(startTime: string, durationHours: number): string {
  const [hourStr, minStr] = startTime.split(':');
  const startHour = parseInt(hourStr, 10);
  const startMinute = parseInt(minStr || '0', 10);
  const totalMinutes = startHour * 60 + startMinute + (durationHours * 60);
  const endHour = Math.floor(totalMinutes / 60) % 24;
  const endMinute = Math.floor(totalMinutes % 60);
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

export async function checkScheduleMigrationStatus(organizationId: string) {
  const allJobsWithSchedule = await db.select({ id: jobs.id })
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      isNotNull(jobs.scheduledDate)
    ));

  if (allJobsWithSchedule.length === 0) {
    return { needsMigration: false, jobsToMigrate: 0, message: "No scheduled jobs found" };
  }

  const jobIds = allJobsWithSchedule.map(j => j.id);
  
  const existingAppointments = await db.select({ jobId: appointments.jobId })
    .from(appointments)
    .where(and(
      eq(appointments.organizationId, organizationId),
      isNotNull(appointments.jobId)
    ));

  const jobsWithAppointments = new Set(existingAppointments.map(a => a.jobId));
  const jobsWithoutAppointments = jobIds.filter(id => !jobsWithAppointments.has(id));

  return {
    needsMigration: jobsWithoutAppointments.length > 0,
    jobsToMigrate: jobsWithoutAppointments.length,
    totalScheduledJobs: allJobsWithSchedule.length,
    jobsWithAppointments: jobsWithAppointments.size,
    message: jobsWithoutAppointments.length > 0 
      ? `${jobsWithoutAppointments.length} jobs need migration to the new appointment system`
      : "All scheduled jobs have appointments"
  };
}

export async function migrateJobSchedulesToAppointments(organizationId: string) {
  const jobsWithSchedule = await db.select()
    .from(jobs)
    .where(and(
      eq(jobs.organizationId, organizationId),
      isNotNull(jobs.scheduledDate)
    ));

  if (jobsWithSchedule.length === 0) {
    return { success: true, migrated: 0, message: "No scheduled jobs found" };
  }

  const existingAppointments = await db.select({ jobId: appointments.jobId })
    .from(appointments)
    .where(and(
      eq(appointments.organizationId, organizationId),
      isNotNull(appointments.jobId)
    ));

  const jobsWithAppointments = new Set(existingAppointments.map(a => a.jobId));
  const jobsToMigrate = jobsWithSchedule.filter(job => !jobsWithAppointments.has(job.id));

  if (jobsToMigrate.length === 0) {
    return { success: true, migrated: 0, message: "All scheduled jobs already have appointments" };
  }

  try {
    await db.transaction(async (tx) => {
      for (const job of jobsToMigrate) {
        let endTime: string | null = null;
        if (job.scheduledTime && job.estimatedDuration) {
          endTime = calculateEndTime(job.scheduledTime, job.estimatedDuration);
        }

        await tx.insert(appointments).values({
          id: `appt_${nanoid()}`,
          organizationId,
          title: job.title,
          description: job.description || null,
          location: job.address,
          scheduledDate: job.scheduledDate!,
          scheduledTime: job.scheduledTime || null,
          endTime,
          assignedTo: job.assignedTo || [],
          jobId: job.id,
          createdBy: null,
        });
      }
    });

    return {
      success: true,
      migrated: jobsToMigrate.length,
      total: jobsToMigrate.length,
      message: `Successfully migrated ${jobsToMigrate.length} scheduled jobs to appointments`
    };
  } catch (error) {
    console.error("Error running schedule migration (transaction rolled back):", error);
    return {
      success: false,
      migrated: 0,
      total: jobsToMigrate.length,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: `Migration failed - all changes rolled back. Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
