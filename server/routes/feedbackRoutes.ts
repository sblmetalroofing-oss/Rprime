import { Router } from "express";
import { getOrganizationId, canUserDelete, type PassportUser } from "./middleware";
import { storage } from "../storage";
import { insertUserBehaviorEventSchema, type FeedbackEvent } from "@shared/schema";
import { z } from "zod";
import { emitNotification, type SystemNotification } from "../websocket";
import { generateErrorGroupId } from "../error-grouping";
import OpenAI from "openai";

interface FeedbackEventUpdate {
  priority?: string;
  assignedTo?: string | null;
  resolved?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

const router = Router();

const feedbackRateLimits = new Map<string, { count: number; resetAt: number }>();
const FEEDBACK_RATE_LIMIT = 100;
const FEEDBACK_RATE_WINDOW_MS = 60 * 1000;

function checkFeedbackRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = feedbackRateLimits.get(ip);
  
  if (!entry || now > entry.resetAt) {
    feedbackRateLimits.set(ip, { count: 1, resetAt: now + FEEDBACK_RATE_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= FEEDBACK_RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of feedbackRateLimits.entries()) {
    if (now > entry.resetAt) {
      feedbackRateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000);

router.post("/behavior/events", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { events } = req.body;
    
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: "events array is required" });
    }
    
    const passportUser = req.user as PassportUser | undefined;
    const userId = req.session?.user?.id || passportUser?.claims?.sub || passportUser?.id;
    
    const createdEvents = [];
    for (const event of events) {
      const { sessionId, eventType, pageUrl, elementSelector, context, metadata } = event;
      
      if (!eventType) continue;
      
      const eventData = insertUserBehaviorEventSchema.parse({
        organizationId,
        userId: userId || null,
        sessionId: sessionId || null,
        eventType,
        pageUrl: pageUrl || null,
        elementSelector: elementSelector || null,
        context: context || null,
        metadata: metadata || null,
      });
      
      const created = await storage.createBehaviorEvent(eventData);
      createdEvents.push(created);
      
      if (eventType === 'rage_click') {
        const notification: SystemNotification = {
          id: created.id,
          type: 'rage_click',
          title: 'Rage Click Detected',
          message: `User frustrated on ${pageUrl || 'unknown page'}${elementSelector ? ` at ${elementSelector}` : ''}`,
          severity: 'warning',
          organizationId,
          metadata: { eventType, pageUrl, elementSelector, context },
          createdAt: new Date().toISOString(),
        };
        emitNotification(notification);
      }
    }
    
    res.json({ success: true, count: createdEvents.length });
  } catch (error) {
    console.error("Error logging behavior events:", error);
    res.status(500).json({ error: "Failed to log behavior events" });
  }
});

router.get("/behavior/events", async (req, res) => {
  try {
    const passportUser = req.user as PassportUser | undefined;
    const userId = req.session?.user?.id || passportUser?.claims?.sub || passportUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const currentUser = await storage.getUser(userId);
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Forbidden - super admin access required" });
    }
    
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const { eventType, startDate, endDate } = req.query;
    const filters: { eventType?: string; startDate?: Date; endDate?: Date } = {};
    
    if (eventType && typeof eventType === 'string') {
      filters.eventType = eventType;
    }
    if (startDate && typeof startDate === 'string') {
      filters.startDate = new Date(startDate);
    }
    if (endDate && typeof endDate === 'string') {
      filters.endDate = new Date(endDate);
    }
    
    const events = await storage.getBehaviorEvents(organizationId, filters);
    res.json(events);
  } catch (error) {
    console.error("Error fetching behavior events:", error);
    res.status(500).json({ error: "Failed to fetch behavior events" });
  }
});

router.get("/behavior/stats", async (req, res) => {
  try {
    const passportUser = req.user as PassportUser | undefined;
    const userId = req.session?.user?.id || passportUser?.claims?.sub || passportUser?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const currentUser = await storage.getUser(userId);
    if (!currentUser?.isSuperAdmin) {
      return res.status(403).json({ error: "Forbidden - super admin access required" });
    }
    
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const stats = await storage.getBehaviorStats(organizationId);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching behavior stats:", error);
    res.status(500).json({ error: "Failed to fetch behavior stats" });
  }
});

router.post("/feedback/log", async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    if (!checkFeedbackRateLimit(clientIp)) {
      return res.status(429).json({ error: "Rate limit exceeded. Max 100 requests per minute." });
    }
    
    const feedbackLogSchema = z.object({
      eventType: z.string().min(1),
      severity: z.string().optional(),
      message: z.string().min(1).max(10000),
      context: z.any().optional(),
      stackTrace: z.string().optional().nullable(),
      metadata: z.any().optional().nullable(),
      userEmail: z.string().optional().nullable(),
    });
    const { eventType, severity, message, context, stackTrace, metadata, userEmail } = feedbackLogSchema.parse(req.body);
    
    let organizationId = null;
    let userId: string | null | undefined = null;
    try {
      organizationId = await getOrganizationId(req);
      const passportUser = req.user as PassportUser | undefined;
      userId = req.session?.user?.id || passportUser?.claims?.sub || passportUser?.id;
    } catch (e) {
    }
    
    const groupId = generateErrorGroupId(message, stackTrace);
    
    const event = await storage.createFeedbackEvent({
      organizationId,
      userId,
      eventType,
      severity: severity || 'info',
      message,
      context: context || null,
      stackTrace: stackTrace || null,
      metadata: metadata || null,
      userEmail: userEmail || req.session?.user?.email || null,
      resolved: 'false',
      aiAnalysis: null,
      groupId,
    });
    
    if (severity === 'critical' || severity === 'error') {
      const notification: SystemNotification = {
        id: event.id,
        type: severity === 'critical' ? 'critical_error' : 'error',
        title: severity === 'critical' ? 'Critical Error' : 'Error Logged',
        message: message.length > 100 ? message.substring(0, 100) + '...' : message,
        severity: severity,
        organizationId: organizationId || undefined,
        metadata: { eventType, context, userEmail: userEmail || req.session?.user?.email },
        createdAt: new Date().toISOString(),
      };
      emitNotification(notification);
    }
    
    res.json({ success: true, id: event.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error logging feedback event:", error);
    res.status(500).json({ error: "Failed to log feedback event" });
  }
});

router.get("/feedback/groups", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const { eventType, severity, resolved } = req.query;
    const groups = await storage.getGroupedFeedbackEvents(organizationId, {
      eventType: eventType as string,
      severity: severity as string,
      resolved: resolved as string,
    });
    res.json(groups);
  } catch (error) {
    console.error("Error fetching grouped feedback events:", error);
    res.status(500).json({ error: "Failed to fetch grouped feedback events" });
  }
});

router.get("/feedback/events", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const { eventType, severity, limit, startDate, endDate, priority, userEmail } = req.query;
    const events = await storage.getFeedbackEvents(organizationId, {
      eventType: eventType as string,
      severity: severity as string,
      limit: limit ? parseInt(limit as string) : 200,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      priority: priority as string,
      userEmail: userEmail as string,
    });
    res.json(events);
  } catch (error) {
    console.error("Error fetching feedback events:", error);
    res.status(500).json({ error: "Failed to fetch feedback events" });
  }
});

router.post("/feedback/events/:id/resolve", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const existingEvent = await storage.getFeedbackEventById(req.params.id);
    if (!existingEvent) return res.status(404).json({ error: "Event not found" });
    if (existingEvent.organizationId !== organizationId) {
      return res.status(403).json({ error: "Forbidden - event belongs to different organization" });
    }
    
    const event = await storage.resolveFeedbackEvent(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error) {
    console.error("Error resolving feedback event:", error);
    res.status(500).json({ error: "Failed to resolve feedback event" });
  }
});

router.post("/feedback/analyze", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const events = await storage.getUnresolvedFeedbackEvents(organizationId, 7);
    
    if (events.length === 0) {
      return res.json({ 
        analysis: "## No Issues Found\n\nNo unresolved feedback events in the last 7 days. Your app is running smoothly! 🎉",
        eventCount: 0
      });
    }
    
    const eventsByType: Record<string, any[]> = {};
    for (const event of events) {
      if (!eventsByType[event.eventType]) {
        eventsByType[event.eventType] = [];
      }
      eventsByType[event.eventType].push({
        severity: event.severity,
        message: event.message,
        stackTrace: event.stackTrace?.slice(0, 500),
        context: event.context,
        metadata: event.metadata,
        createdAt: event.createdAt,
      });
    }
    
    const summary = Object.entries(eventsByType).map(([type, items]) => {
      return `\n### ${type.toUpperCase()} (${items.length} events)\n${JSON.stringify(items.slice(0, 10), null, 2)}`;
    }).join('\n');
    
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a senior software engineer analyzing production errors and issues from a web application. 
Your job is to:
1. Identify patterns in the errors/issues
2. Prioritize them by severity (critical/high/medium/low)
3. Generate actionable bug reports with suggested fixes
4. Note any interesting patterns (device-specific, time-based, etc.)

Format your response as markdown that developers can copy directly to create tasks.
Be concise but thorough. Focus on actionable insights.`
        },
        {
          role: "user",
          content: `Analyze these production events from the last 7 days and generate a bug report:\n\nTotal Events: ${events.length}\n${summary}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });
    
    const analysis = completion.choices[0]?.message?.content || "Failed to generate analysis";
    
    res.json({
      analysis,
      eventCount: events.length,
      eventsByType: Object.fromEntries(
        Object.entries(eventsByType).map(([k, v]) => [k, v.length])
      ),
    });
  } catch (error) {
    console.error("Error analyzing feedback events:", error);
    res.status(500).json({ error: "Failed to analyze feedback events" });
  }
});

router.patch("/feedback/events/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const existingEvent = await storage.getFeedbackEventById(req.params.id);
    if (!existingEvent) return res.status(404).json({ error: "Event not found" });
    if (existingEvent.organizationId !== organizationId) {
      return res.status(403).json({ error: "Forbidden - event belongs to different organization" });
    }
    
    const patchSchema = z.object({
      priority: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
      resolved: z.string().optional(),
      resolutionNotes: z.string().optional(),
      resolvedBy: z.string().optional(),
    });
    const { priority, assignedTo, resolved, resolutionNotes, resolvedBy } = patchSchema.parse(req.body);
    
    const updateData: FeedbackEventUpdate = {};
    if (priority !== undefined) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (resolved !== undefined) {
      updateData.resolved = resolved;
      if (resolved === 'true') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = resolvedBy || req.session?.user?.id || null;
      }
    }
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes;
    
    const event = await storage.updateFeedbackEvent(req.params.id, updateData);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating feedback event:", error);
    res.status(500).json({ error: "Failed to update feedback event" });
  }
});

router.post("/feedback/analyze-group", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const { groupId } = z.object({ groupId: z.string().min(1) }).parse(req.body);
    
    const events = await storage.getFeedbackEventsByGroupId(organizationId, groupId);
    
    if (events.length === 0) {
      return res.json({ 
        analysis: "No events found for this group.",
        eventCount: 0
      });
    }
    
    const sampleEvents = events.slice(0, 10).map(event => ({
      severity: event.severity,
      message: event.message,
      stackTrace: event.stackTrace?.slice(0, 500),
      context: event.context,
      metadata: event.metadata,
      createdAt: event.createdAt,
      userEmail: event.userEmail,
    }));
    
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a senior software engineer analyzing a group of similar production errors. 
Your job is to:
1. Identify the root cause of this error group
2. Analyze patterns (user types, timing, devices, etc.)
3. Provide a step-by-step fix recommendation
4. Estimate severity and business impact

Format your response as markdown that developers can use to fix the issue.
Be concise but thorough. Focus on actionable insights.`
        },
        {
          role: "user",
          content: `Analyze this group of ${events.length} similar errors:\n\n${JSON.stringify(sampleEvents, null, 2)}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });
    
    const analysis = completion.choices[0]?.message?.content || "Failed to generate analysis";
    
    res.json({
      analysis,
      eventCount: events.length,
      groupId,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error analyzing error group:", error);
    res.status(500).json({ error: "Failed to analyze error group" });
  }
});

router.delete("/feedback/cleanup", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Forbidden - admin access required" });
    }
    
    const daysOld = parseInt(req.query.daysOld as string) || 90;
    if (daysOld < 30) {
      return res.status(400).json({ error: "Cannot delete events less than 30 days old" });
    }
    
    const deletedCount = await storage.deleteOldFeedbackEvents(organizationId, daysOld);
    console.log(`[Feedback Cleanup] User from org ${organizationId} deleted ${deletedCount} events older than ${daysOld} days`);
    res.json({ success: true, deletedCount, message: `Deleted ${deletedCount} feedback events older than ${daysOld} days` });
  } catch (error) {
    console.error("Error cleaning up feedback events:", error);
    res.status(500).json({ error: "Failed to cleanup feedback events" });
  }
});

router.post("/feedback/analyze-ux", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const { daysBack = 7 } = z.object({ daysBack: z.number().int().min(1).max(90).optional().default(7) }).parse(req.body);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const behaviorEvents = await storage.getBehaviorEvents(organizationId, { startDate });
    
    const allEvents = await storage.getUnresolvedFeedbackEvents(organizationId, daysBack);
    const behaviorFeedback = allEvents.filter(e => 
      e.eventType?.startsWith('behavior_') || 
      e.eventType === 'rage_click' || 
      e.eventType === 'dead_click' ||
      e.eventType === 'slow_action' ||
      e.eventType === 'scroll_confusion' ||
      e.eventType === 'thrashing' ||
      e.eventType === 'abandonment'
    );
    
    const totalEvents = behaviorEvents.length + behaviorFeedback.length;
    
    if (totalEvents === 0) {
      return res.json({ 
        analysis: "## No UX Issues Detected\n\nNo behavior events recorded in the last " + daysBack + " days. Your users are having a smooth experience! 🎉",
        eventCount: 0,
        byType: {},
        byPage: {}
      });
    }
    
    const byType: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    const topElements: Record<string, { count: number; types: string[] }> = {};
    
    for (const event of behaviorEvents) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      if (event.pageUrl) {
        try {
          const pagePath = new URL(event.pageUrl).pathname;
          byPage[pagePath] = (byPage[pagePath] || 0) + 1;
        } catch {}
      }
      if (event.elementSelector) {
        if (!topElements[event.elementSelector]) {
          topElements[event.elementSelector] = { count: 0, types: [] };
        }
        topElements[event.elementSelector].count++;
        if (!topElements[event.elementSelector].types.includes(event.eventType)) {
          topElements[event.elementSelector].types.push(event.eventType);
        }
      }
    }
    
    for (const event of behaviorFeedback) {
      const eventType = event.eventType || 'unknown';
      byType[eventType] = (byType[eventType] || 0) + 1;
      const ctx = event.context as Record<string, any> | null;
      if (ctx?.pageUrl) {
        try {
          const pagePath = new URL(ctx.pageUrl).pathname;
          byPage[pagePath] = (byPage[pagePath] || 0) + 1;
        } catch {}
      }
      const selector = ctx?.elementSelector || event.message?.split(': ')[1];
      if (selector) {
        if (!topElements[selector]) {
          topElements[selector] = { count: 0, types: [] };
        }
        topElements[selector].count++;
        if (!topElements[selector].types.includes(eventType)) {
          topElements[selector].types.push(eventType);
        }
      }
    }
    
    const summary = {
      totalEvents,
      byType,
      byPage,
      topProblematicElements: Object.entries(topElements)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([selector, data]) => ({
          element: selector,
          issues: data.count,
          types: data.types
        })),
      sampleEvents: [...behaviorEvents.slice(0, 15), ...behaviorFeedback.slice(0, 15)].map(e => {
        const ctx = e.context as Record<string, unknown> | null;
        const behaviorEvent = e as { pageUrl?: string; elementSelector?: string };
        return {
          type: e.eventType,
          page: behaviorEvent.pageUrl || ctx?.pageUrl,
          element: behaviorEvent.elementSelector || ctx?.elementSelector,
          context: ctx,
          timestamp: e.createdAt
        };
      })
    };
    
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    
    if (!apiKey) {
      console.error("AI UX Analysis: Missing AI_INTEGRATIONS_OPENAI_API_KEY");
      return res.status(503).json({ 
        error: "AI analysis unavailable", 
        details: "OpenAI API key not configured. Please ensure AI Integrations are enabled for this deployment.",
        eventCount: totalEvents,
        byType,
        byPage
      });
    }
    
    const openai = new OpenAI({
      apiKey,
      baseURL,
    });
    
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a UX analyst reviewing user behavior data from RPrime, a job management application for tradespeople. Analyze the behavioral patterns to identify friction points and usability issues.

Behavior types:
- rage_click: User clicked same element 3+ times rapidly (frustration)
- dead_click: User clicked on non-interactive element (confusing UI)
- slow_action: Button/interaction took >3 seconds (performance issue)
- scroll_confusion: User scrolled up/down repeatedly (can't find content)
- thrashing: Mouse moved erratically (confusion/frustration)
- abandonment: User left page quickly after arriving

CRITICAL: For each issue, you MUST include:
1. **Page path** - The exact URL path (e.g., /jobs, /quotes/new, /feedback)
2. **Component file** - Map the page to its likely source file using this structure:
   - /jobs → client/src/pages/jobs.tsx
   - /jobs/:id → client/src/pages/job-details.tsx
   - /quotes → client/src/pages/quotes.tsx
   - /invoices → client/src/pages/invoices.tsx
   - /schedule → client/src/pages/schedule.tsx
   - /customers → client/src/pages/customers.tsx
   - /reports → client/src/pages/reports.tsx
   - /feedback → client/src/pages/feedback-dashboard.tsx
   - /settings → client/src/pages/settings.tsx
   - /products → client/src/pages/products.tsx
   - /leads → client/src/pages/leads.tsx
   - Other pages → client/src/pages/[page-name].tsx
3. **Element selector** - The CSS selector or element description
4. **Issue count** - How many times this occurred

Format each finding as:
## Issue: [Brief description]
- **Page:** /path → \`client/src/pages/file.tsx\`
- **Element:** [selector or description]
- **Occurrences:** [count]
- **Problem:** [Why this is an issue]
- **Fix:** [Specific actionable recommendation]

Prioritize by severity and frequency. Be concise but specific enough that a developer can immediately locate and fix the issue.`
          },
          {
            role: "user",
            content: `Analyze this UX data from the last ${daysBack} days:\n\n${JSON.stringify(summary, null, 2)}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });
    } catch (apiError: unknown) {
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error("OpenAI API error:", errorMessage);
      return res.status(503).json({ 
        error: "AI analysis failed", 
        details: errorMessage || "Failed to call OpenAI API. Check API key configuration.",
        eventCount: totalEvents,
        byType,
        byPage
      });
    }
    
    const aiContent = completion.choices[0]?.message?.content;
    
    let analysis: string;
    if (!aiContent) {
      console.warn("OpenAI returned empty content for UX analysis");
      const topPages = Object.entries(byPage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => `- ${path}: ${count} issues`)
        .join('\n');
      const topTypes = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `- ${type}: ${count}`)
        .join('\n');
      const topElementsList = Object.entries(topElements)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([selector, data]) => `- ${selector}: ${data.count} issues (${data.types.join(', ')})`)
        .join('\n');
      
      analysis = `## UX Analysis Summary

### Total Events: ${totalEvents}

### Issues by Type
${topTypes}

### Most Problematic Pages
${topPages}

### Problematic Elements
${topElementsList}

*Note: AI analysis was unavailable. This is a raw data summary.*`;
    } else {
      analysis = aiContent;
    }
    
    res.json({
      analysis,
      eventCount: totalEvents,
      byType,
      byPage,
    });
  } catch (error) {
    console.error("Error analyzing UX events:", error);
    res.status(500).json({ error: "Failed to analyze UX events" });
  }
});

export default router;
