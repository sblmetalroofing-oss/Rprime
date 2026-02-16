import { Router } from "express";
import { storage } from "../storage";
import { getOrganizationId, AuthenticatedRequest } from "./middleware";
import { db } from "../db";
import { crewMembers } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

async function getCrewMemberForUser(req: AuthenticatedRequest, organizationId: string) {
  const userId = req.session?.user?.id;
  const email = req.session?.user?.email;

  if (userId) {
    const [member] = await db.select().from(crewMembers).where(
      and(
        eq(crewMembers.organizationId, organizationId),
        eq(crewMembers.userId, userId)
      )
    ).limit(1);
    if (member) return member;
  }

  if (email) {
    const [member] = await db.select().from(crewMembers).where(
      and(
        eq(crewMembers.organizationId, organizationId),
        sql`lower(${crewMembers.email}) = lower(${email})`
      )
    ).limit(1);
    if (member) return member;
  }

  return null;
}

router.get("/notifications", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const crewMember = await getCrewMemberForUser(req as AuthenticatedRequest, organizationId);
    if (!crewMember) {
      return res.json([]);
    }

    const notifs = await storage.getNotificationsForCrewMember(organizationId, crewMember.id);
    res.json(notifs);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const crewMember = await getCrewMemberForUser(req as AuthenticatedRequest, organizationId);
    if (!crewMember) {
      return res.json({ count: 0 });
    }

    const count = await storage.getUnreadNotificationCount(organizationId, crewMember.id);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

router.put("/notifications/:id/read", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await storage.markNotificationRead(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.put("/notifications/read-all", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const crewMember = await getCrewMemberForUser(req as AuthenticatedRequest, organizationId);
    if (!crewMember) {
      return res.json({ success: true });
    }

    await storage.markAllNotificationsRead(organizationId, crewMember.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    res.status(500).json({ error: "Failed to mark all read" });
  }
});

router.delete("/notifications/clear", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const crewMember = await getCrewMemberForUser(req as AuthenticatedRequest, organizationId);
    if (!crewMember) {
      return res.json({ success: true });
    }

    await storage.clearNotifications(organizationId, crewMember.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

export default router;
