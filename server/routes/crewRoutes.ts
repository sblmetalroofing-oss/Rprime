import { Router, Request, Response } from "express";
import { getOrganizationId, canUserDelete, AuthenticatedRequest } from "./middleware";
import { storage } from "../storage";
import { insertCrewMemberSchema, organizations, InsertCrewMember } from "@shared/schema";
import { z } from "zod";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { generateInviteToken, sendCrewInviteEmail, getCrewMemberByInviteToken } from "../auth-local";

const router = Router();

router.get("/crew-members", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    res.json(crewMembers);
  } catch (error) {
    console.error("Error fetching crew members:", error);
    res.status(500).json({ error: "Failed to fetch crew members" });
  }
});

router.post("/crew-members", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    const planLimits: Record<string, number> = { free: 3, starter: 5, professional: 15, enterprise: 1000 };
    const plan = org?.subscriptionPlan || 'free';
    const maxCrewMembers = planLimits[plan] || 3;
    
    const activeCrewMembers = await db.select({ count: sql<number>`count(*)` })
      .from(require("@shared/schema").crewMembers)
      .where(eq(require("@shared/schema").crewMembers.organizationId, organizationId));
    
    const currentCrewCount = activeCrewMembers[0]?.count ?? 0;

    if (currentCrewCount >= maxCrewMembers) {
      return res.status(403).json({ error: "Crew member limit reached. Upgrade to add more team members." });
    }

    const validatedData = insertCrewMemberSchema.parse(req.body);
    const crewMemberId = `crew_${Date.now()}`;
    const dataWithId = {
      ...validatedData,
      id: crewMemberId,
      organizationId,
    };
    const crewMember = await storage.createCrewMember(dataWithId as InsertCrewMember);
    
    if (crewMember.email) {
      try {
        const inviteToken = await generateInviteToken(crewMemberId);
        await sendCrewInviteEmail(crewMember.email, crewMember.name, inviteToken);
      } catch (emailError) {
        console.error("Failed to send invite email:", emailError);
      }
    }
    
    res.status(201).json(crewMember);
  } catch (error) {
    console.error("Error creating crew member:", error);
    res.status(400).json({ error: "Failed to create crew member" });
  }
});

router.post("/crew-members/:id/resend-invite", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const crewMember = await storage.getCrewMember(organizationId, id);
    
    if (!crewMember) {
      return res.status(404).json({ error: "Crew member not found" });
    }
    
    if (!crewMember.email) {
      return res.status(400).json({ error: "Crew member has no email address" });
    }
    
    if (crewMember.inviteStatus === 'accepted') {
      return res.status(400).json({ error: "This crew member has already accepted their invitation" });
    }
    
    const inviteToken = await generateInviteToken(id);
    const result = await sendCrewInviteEmail(crewMember.email, crewMember.name, inviteToken);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send invite" });
    }
    
    res.json({ success: true, message: "Invitation sent" });
  } catch (error) {
    console.error("Error resending invite:", error);
    res.status(500).json({ error: "Failed to resend invitation" });
  }
});

router.get("/crew-members/invite/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const crewMember = await getCrewMemberByInviteToken(token);
    
    if (!crewMember) {
      return res.status(404).json({ error: "Invalid or expired invite" });
    }
    
    if (crewMember.inviteStatus === 'accepted') {
      return res.status(400).json({ error: "This invitation has already been used" });
    }
    
    let organization = null;
    if (crewMember.organizationId) {
      const orgs = await db.select().from(organizations).where(eq(organizations.id, crewMember.organizationId)).limit(1);
      organization = orgs[0] || null;
    }
    
    res.json({ 
      email: crewMember.email,
      name: crewMember.name,
      organizationName: organization?.name || 'the team'
    });
  } catch (error) {
    console.error("Error fetching invite info:", error);
    res.status(500).json({ error: "Failed to fetch invite info" });
  }
});

router.put("/crew-members/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertCrewMemberSchema.partial().parse(req.body);
    const crewMember = await storage.updateCrewMember(organizationId, id, validatedData);
    if (!crewMember) {
      return res.status(404).json({ error: "Crew member not found" });
    }
    res.json(crewMember);
  } catch (error) {
    console.error("Error updating crew member:", error);
    res.status(400).json({ error: "Failed to update crew member" });
  }
});

router.delete("/crew-members/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteCrewMember(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting crew member:", error);
    res.status(500).json({ error: "Failed to delete crew member" });
  }
});

router.get("/dashboard-widgets", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = await getOrganizationId(authReq);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
    
    if (!userEmail) {
      return res.json({ widgets: null });
    }
    
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    const crewMember = crewMembers.find(m => m.email?.toLowerCase() === userEmail?.toLowerCase());
    
    if (!crewMember) {
      return res.json({ widgets: null });
    }
    
    res.json({ widgets: crewMember.dashboardWidgets || null });
  } catch (error) {
    console.error("Error fetching dashboard widgets:", error);
    res.status(500).json({ error: "Failed to fetch dashboard widgets" });
  }
});

router.put("/dashboard-widgets", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = await getOrganizationId(authReq);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
    
    if (!userEmail) {
      return res.status(400).json({ error: "User email not found" });
    }
    
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    const crewMember = crewMembers.find(m => m.email?.toLowerCase() === userEmail?.toLowerCase());
    
    if (!crewMember) {
      return res.status(404).json({ error: "Crew member not found" });
    }
    
    const { widgets } = z.object({ widgets: z.any() }).parse(req.body);
    
    const updated = await storage.updateCrewMember(organizationId, crewMember.id, {
      dashboardWidgets: widgets
    } as Partial<InsertCrewMember>);
    
    res.json({ widgets: updated?.dashboardWidgets || null });
  } catch (error) {
    console.error("Error saving dashboard widgets:", error);
    res.status(500).json({ error: "Failed to save dashboard widgets" });
  }
});

export default router;
