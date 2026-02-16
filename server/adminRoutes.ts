import { Router, Response, NextFunction } from "express";
import { db } from "./db";
import { organizations, users, jobs, appointments, User } from "@shared/schema";
import { eq, inArray, and, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { storage } from "./storage";
import { AuthenticatedRequest } from "./routes/middleware";

const router = Router();

interface AdminRequest extends AuthenticatedRequest {
  adminUser?: User;
}

interface BehaviorEvent {
  id: string;
  eventType: string;
  pageUrl: string | null;
  elementSelector: string | null;
  organizationId: string | null;
  createdAt: Date;
  userId: string | null;
  context: unknown;
  metadata: unknown;
  sessionId: string | null;
}

async function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const userId = req.session?.user?.id || req.user?.id || req.user?.claims?.sub;
  
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
  
  if (!currentUser?.isSuperAdmin) {
    return res.status(403).json({ error: "Super admin access required" });
  }
  
  req.adminUser = currentUser;
  next();
}

router.get("/api/admin/organizations", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const orgs = await db.select().from(organizations);
    
    const ownerIds = orgs.map(o => o.ownerId).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 
      ? await db.select().from(users).where(inArray(users.id, ownerIds))
      : [];
    
    const ownerMap = new Map(owners.map(o => [o.id, o]));
    
    const result = orgs.map(org => {
      const owner = org.ownerId ? ownerMap.get(org.ownerId) : null;
      return {
        id: org.id,
        name: org.name,
        email: org.email,
        subscriptionStatus: org.subscriptionStatus,
        subscriptionPlan: org.subscriptionPlan,
        billingOverride: org.billingOverride,
        planOverride: org.planOverride,
        trialEndsAt: org.trialEndsAt,
        createdAt: org.createdAt,
        status: org.status || 'active',
        suspendedAt: org.suspendedAt,
        suspendedReason: org.suspendedReason,
        deletedAt: org.deletedAt,
        owner: owner ? {
          name: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email,
          email: owner.email
        } : null
      };
    });
    
    res.json({ organizations: result });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.patch("/api/admin/organizations/:id/override", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { billingOverride, planOverride, reason } = req.body;
    
    if (billingOverride !== undefined && billingOverride !== null && !['none', 'free'].includes(billingOverride)) {
      return res.status(400).json({ error: "billingOverride must be 'none', 'free', or null" });
    }
    
    if (planOverride !== undefined && planOverride !== null && !['starter', 'professional', 'business'].includes(planOverride)) {
      return res.status(400).json({ error: "planOverride must be 'starter', 'professional', 'business', or null" });
    }
    
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const adminUser = req.adminUser!;
    
    // Build update object - only update fields that are explicitly provided
    const updateData: Partial<typeof organizations.$inferInsert> = {
      overrideReason: reason !== undefined ? reason : existing.overrideReason,
      overrideSetAt: new Date(),
      overrideSetBy: adminUser.id,
      updatedAt: new Date()
    };
    
    // Handle billingOverride - null clears the override, 'none' keeps no override, 'free' grants free access
    if (billingOverride !== undefined) {
      updateData.billingOverride = billingOverride;
    }
    
    // Handle planOverride - null clears the override
    if (planOverride !== undefined) {
      updateData.planOverride = planOverride;
    }
    
    const [updated] = await db.update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error updating organization override:", error);
    res.status(500).json({ error: "Failed to update organization override" });
  }
});

router.patch("/api/admin/organizations/:id/suspend", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    if (existing.status === 'deleted') {
      return res.status(400).json({ error: "Cannot suspend a deleted organization" });
    }
    
    const adminUser = req.adminUser!;
    
    const [updated] = await db.update(organizations)
      .set({
        status: 'suspended',
        suspendedAt: new Date(),
        suspendedBy: adminUser.id,
        suspendedReason: reason || null,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error suspending organization:", error);
    res.status(500).json({ error: "Failed to suspend organization" });
  }
});

router.patch("/api/admin/organizations/:id/unsuspend", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    if (existing.status !== 'suspended') {
      return res.status(400).json({ error: "Organization is not suspended" });
    }
    
    const [updated] = await db.update(organizations)
      .set({
        status: 'active',
        suspendedAt: null,
        suspendedBy: null,
        suspendedReason: null,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error unsuspending organization:", error);
    res.status(500).json({ error: "Failed to unsuspend organization" });
  }
});

router.patch("/api/admin/organizations/:id/delete", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    if (existing.status === 'deleted') {
      return res.status(400).json({ error: "Organization is already deleted" });
    }
    
    const adminUser = req.adminUser!;
    
    const [updated] = await db.update(organizations)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        deletedBy: adminUser.id,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

router.patch("/api/admin/organizations/:id/restore", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id));
    if (!existing) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    if (existing.status !== 'deleted') {
      return res.status(400).json({ error: "Organization is not deleted" });
    }
    
    const [updated] = await db.update(organizations)
      .set({
        status: 'active',
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning();
    
    res.json({ organization: updated });
  } catch (error) {
    console.error("Error restoring organization:", error);
    res.status(500).json({ error: "Failed to restore organization" });
  }
});

router.get("/api/admin/prod-orgs", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    if (!process.env.PRODUCTION_DATABASE_URL) {
      return res.status(400).json({ error: "PRODUCTION_DATABASE_URL secret is not configured" });
    }
    
    const { listProductionOrganizations } = await import("./sync-prod-to-dev");
    const orgs = await listProductionOrganizations();
    res.json({ organizations: orgs });
  } catch (error: unknown) {
    console.error("Error listing production organizations:", error);
    const message = error instanceof Error ? error.message : "Failed to list production organizations";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/sync-org", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }
    
    if (!process.env.PRODUCTION_DATABASE_URL) {
      return res.status(400).json({ error: "PRODUCTION_DATABASE_URL secret is not configured" });
    }
    
    const adminUser = req.adminUser!;
    const { syncOrganizationToDev } = await import("./sync-prod-to-dev");
    const result = await syncOrganizationToDev(adminUser.id, organizationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: unknown) {
    console.error("Error syncing organization:", error);
    const message = error instanceof Error ? error.message : "Failed to sync organization";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/unsync-org", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }
    
    const adminUser = req.adminUser!;
    const { unsyncOrganization } = await import("./sync-prod-to-dev");
    const result = await unsyncOrganization(adminUser.id, organizationId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: unknown) {
    console.error("Error unsyncing organization:", error);
    const message = error instanceof Error ? error.message : "Failed to unsync organization";
    res.status(500).json({ error: message });
  }
});

router.get("/api/admin/settings-migrations", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { getPendingMigrations, getAllMigrations } = await import("./settings-migration-tracker");
    const status = req.query.status as string | undefined;
    
    if (status === 'pending') {
      const migrations = await getPendingMigrations();
      res.json({ migrations });
    } else {
      const migrations = await getAllMigrations();
      res.json({ migrations });
    }
  } catch (error: unknown) {
    console.error("Error fetching settings migrations:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch settings migrations";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/settings-migrations/:id/apply", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminUser = req.adminUser!;
    const { markMigrationApplied } = await import("./settings-migration-tracker");
    
    await markMigrationApplied(id, adminUser.id);
    res.json({ success: true, message: "Migration marked as applied" });
  } catch (error: unknown) {
    console.error("Error applying migration:", error);
    const message = error instanceof Error ? error.message : "Failed to apply migration";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/settings-migrations/:id/skip", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { markMigrationSkipped } = await import("./settings-migration-tracker");
    
    await markMigrationSkipped(id);
    res.json({ success: true, message: "Migration marked as skipped" });
  } catch (error: unknown) {
    console.error("Error skipping migration:", error);
    const message = error instanceof Error ? error.message : "Failed to skip migration";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/settings-migrations/clear-pending", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { clearMigrations } = await import("./settings-migration-tracker");
    await clearMigrations();
    res.json({ success: true, message: "All pending migrations cleared" });
  } catch (error: unknown) {
    console.error("Error clearing migrations:", error);
    const message = error instanceof Error ? error.message : "Failed to clear migrations";
    res.status(500).json({ error: message });
  }
});

router.post("/api/admin/migrate-jobs-to-appointments", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { organizationId } = req.body;
    
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }
    
    console.log(`[Migration] Starting job to appointment migration for org ${organizationId}...`);
    
    const orgJobs = await db.select().from(jobs).where(
      and(
        eq(jobs.organizationId, organizationId),
        isNotNull(jobs.scheduledDate)
      )
    );
    
    console.log(`[Migration] Found ${orgJobs.length} jobs with scheduledDate`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    for (const job of orgJobs) {
      if (!job.scheduledDate) continue;
      
      // Check if job already has ANY appointment (not just matching date)
      const existingAppointments = await db.select().from(appointments).where(
        eq(appointments.jobId, job.id)
      );
      
      if (existingAppointments.length > 0) {
        skippedCount++;
        continue;
      }
      
      let endTime: string | null = null;
      if (job.scheduledTime && job.estimatedDuration) {
        // Validate time format (HH:mm or H:mm)
        const timeMatch = job.scheduledTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
            const startMinutes = hours * 60 + minutes;
            const durationMinutes = Math.round(job.estimatedDuration * 60);
            const endMinutes = startMinutes + durationMinutes;
            // Cap at 23:59 if overflow
            const clampedEndMinutes = Math.min(endMinutes, 23 * 60 + 59);
            const endHours = Math.floor(clampedEndMinutes / 60);
            const endMins = Math.floor(clampedEndMinutes % 60);
            endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
          }
        }
      }
      
      await db.insert(appointments).values({
        id: randomUUID(),
        organizationId: organizationId,
        title: job.title,
        description: job.description || null,
        location: job.address,
        scheduledDate: job.scheduledDate,
        scheduledTime: job.scheduledTime || null,
        endTime: endTime,
        assignedTo: job.assignedTo || [],
        jobId: job.id,
        createdBy: null,
      });
      
      migratedCount++;
    }
    
    console.log(`[Migration] Completed: ${migratedCount} jobs migrated, ${skippedCount} skipped (already had appointments)`);
    
    res.json({
      success: true,
      message: `Migrated ${migratedCount} jobs to appointments, ${skippedCount} already had appointments`,
      details: { migratedCount, skippedCount, totalJobs: orgJobs.length }
    });
  } catch (error: unknown) {
    console.error("[Migration] Error migrating jobs:", error);
    const message = error instanceof Error ? error.message : "Failed to migrate jobs";
    res.status(500).json({ error: message });
  }
});

router.get("/api/admin/migration-status", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { organizationId } = req.query;
    
    if (!organizationId || typeof organizationId !== 'string') {
      return res.status(400).json({ error: "organizationId query param is required" });
    }
    
    const orgJobs = await db.select().from(jobs).where(
      and(
        eq(jobs.organizationId, organizationId),
        isNotNull(jobs.scheduledDate)
      )
    );
    
    let needsMigration = 0;
    let alreadyMigrated = 0;
    
    for (const job of orgJobs) {
      if (!job.scheduledDate) continue;
      
      const existingAppointments = await db.select().from(appointments).where(
        eq(appointments.jobId, job.id)
      );
      
      if (existingAppointments.length > 0) {
        alreadyMigrated++;
      } else {
        needsMigration++;
      }
    }
    
    res.json({
      organizationId,
      totalJobsWithScheduledDate: orgJobs.length,
      needsMigration,
      alreadyMigrated
    });
  } catch (error: unknown) {
    console.error("Error checking migration status:", error);
    const message = error instanceof Error ? error.message : "Failed to check migration status";
    res.status(500).json({ error: message });
  }
});

// AI-powered error group analysis
router.post("/api/feedback/analyze-group", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { groupId, organizationId } = req.body;
    
    if (!groupId) {
      return res.status(400).json({ error: "groupId is required" });
    }
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }
    
    const events = await storage.getFeedbackEventsByGroupId(organizationId, groupId);
    
    if (events.length === 0) {
      return res.status(404).json({ error: "No events found for this group" });
    }
    
    // Prepare event data for analysis
    const eventData = events.map(event => ({
      id: event.id,
      eventType: event.eventType,
      severity: event.severity,
      message: event.message,
      stackTrace: event.stackTrace?.slice(0, 1000),
      context: event.context,
      metadata: event.metadata,
      userEmail: event.userEmail,
      createdAt: event.createdAt,
    }));
    
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a senior software engineer analyzing a group of related production errors/issues from a web application.

Your analysis must include:
1. **Root Cause Analysis**: Identify the underlying cause of these errors
2. **Suggested Fix**: Provide specific, actionable code fixes or configuration changes
3. **Severity Assessment**: Rate as Critical/High/Medium/Low with justification
4. **Priority Recommendation**: Recommend priority level (P0-P3) based on user impact and frequency

Format your response as structured markdown. Be concise but thorough.
Consider patterns like: affected users, timing, related components, and error frequency.`
        },
        {
          role: "user",
          content: `Analyze this group of ${events.length} related events:\n\n${JSON.stringify(eventData, null, 2)}`
        }
      ],
      max_completion_tokens: 2000,
      temperature: 0.3,
    });
    
    const analysis = completion.choices[0]?.message?.content || "Failed to generate analysis";
    
    // Store the analysis in all events in the group
    for (const event of events) {
      await storage.updateFeedbackEventAnalysis(event.id, analysis);
    }
    
    res.json({
      groupId,
      eventCount: events.length,
      analysis,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error analyzing feedback group:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze feedback group";
    res.status(500).json({ error: message });
  }
});

// AI-powered UX behavior analysis
router.post("/api/feedback/analyze-ux", requireSuperAdmin, async (req: AdminRequest, res: Response) => {
  try {
    const { organizationId, daysBack = 7 } = req.body;
    
    // Fetch recent behavior events
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    // Get all organizations if no specific one is provided
    let behaviorEvents: BehaviorEvent[] = [];
    
    if (organizationId) {
      behaviorEvents = await storage.getBehaviorEvents(organizationId, { startDate });
    } else {
      // Fetch from all organizations (super admin view)
      const orgs = await db.select().from(organizations);
      for (const org of orgs) {
        const orgEvents = await storage.getBehaviorEvents(org.id, { startDate });
        behaviorEvents.push(...orgEvents);
      }
    }
    
    if (behaviorEvents.length === 0) {
      return res.json({ 
        analysis: "## No UX Issues Found\n\nNo behavior events (rage clicks, dead clicks, etc.) recorded in the selected time period. This could mean users are having a smooth experience, or behavior tracking may not be fully implemented.",
        eventCount: 0,
        byType: {},
        byPage: {}
      });
    }
    
    // Group events by type and page
    const byType: Record<string, BehaviorEvent[]> = {};
    const byPage: Record<string, BehaviorEvent[]> = {};
    const byElement: Record<string, BehaviorEvent[]> = {};
    
    for (const event of behaviorEvents) {
      // Group by type
      if (!byType[event.eventType]) {
        byType[event.eventType] = [];
      }
      byType[event.eventType].push(event);
      
      // Group by page
      if (event.pageUrl) {
        if (!byPage[event.pageUrl]) {
          byPage[event.pageUrl] = [];
        }
        byPage[event.pageUrl].push(event);
      }
      
      // Group by element
      if (event.elementSelector) {
        if (!byElement[event.elementSelector]) {
          byElement[event.elementSelector] = [];
        }
        byElement[event.elementSelector].push(event);
      }
    }
    
    // Prepare summary for AI
    const summary = {
      totalEvents: behaviorEvents.length,
      byType: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, { count: v.length, samples: v.slice(0, 3) }])
      ),
      byPage: Object.fromEntries(
        Object.entries(byPage)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 10)
          .map(([k, v]) => [k, { count: v.length, eventTypes: [...new Set(v.map(e => e.eventType))] }])
      ),
      byElement: Object.fromEntries(
        Object.entries(byElement)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 15)
          .map(([k, v]) => [k, { count: v.length, eventTypes: [...new Set(v.map(e => e.eventType))] }])
      ),
    };
    
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a UX analyst reviewing user behavior data from a web application. You are analyzing events like:
- rage_click: User clicked repeatedly on an element (frustration indicator)
- dead_click: User clicked on a non-interactive element (confusing UI)
- abandonment: User left a form or flow incomplete
- thrashing: User scrolled up/down rapidly (confusion/searching)
- slow_action: Action took too long to complete
- scroll_confusion: User seems lost while scrolling

Your analysis must include:
1. **Identified Friction Points**: List the most problematic areas of the UI
2. **User Experience Issues**: Describe what problems users are likely facing
3. **Recommended Improvements**: Provide specific, actionable UX improvements
4. **Priority Ranking**: Rank issues by impact and frequency

Format your response as structured markdown. Focus on actionable insights that developers can implement.`
        },
        {
          role: "user",
          content: `Analyze this UX behavior data from the last ${daysBack} days:\n\n${JSON.stringify(summary, null, 2)}`
        }
      ],
      max_completion_tokens: 2000,
      temperature: 0.3,
    });
    
    let analysis = completion.choices[0]?.message?.content;
    
    // Generate detailed fallback if AI returned empty
    if (!analysis || analysis.trim() === '') {
      const typeStats = Object.entries(byType)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([type, events]) => `- **${type}**: ${events.length} occurrences`)
        .join('\n');
      
      const pageStats = Object.entries(byPage)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([page, events]) => {
          try {
            const url = new URL(page);
            return `- **${url.pathname}**: ${events.length} issues`;
          } catch {
            return `- **${page}**: ${events.length} issues`;
          }
        })
        .join('\n');
      
      const elementStats = Object.entries(byElement)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5)
        .map(([selector, events]) => {
          const shortSelector = selector.length > 60 ? selector.substring(0, 57) + '...' : selector;
          return `- \`${shortSelector}\`: ${events.length} events`;
        })
        .join('\n');
      
      analysis = `## UX Behavior Summary

**${behaviorEvents.length} behavior events** recorded in the last ${daysBack} days.

### Issues by Type
${typeStats || 'No issues by type'}

### Most Affected Pages
${pageStats || 'No page data'}

### Top Problematic Elements
${elementStats || 'No element data'}

---
*AI analysis unavailable - showing raw statistics. Check API configuration if this persists.*`;
    }
    
    res.json({
      analysis,
      eventCount: behaviorEvents.length,
      daysBack,
      byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
      byPage: Object.fromEntries(
        Object.entries(byPage)
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, 10)
          .map(([k, v]) => [k, v.length])
      ),
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Error analyzing UX behavior:", error);
    const message = error instanceof Error ? error.message : "Failed to analyze UX behavior";
    res.status(500).json({ error: message });
  }
});

export default router;
