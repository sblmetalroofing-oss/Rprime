import { Router } from "express";
import { getOrganizationId, AuthenticatedRequest } from "./middleware";
import { storage } from "../storage";
import { getVapidPublicKey, isPushEnabled } from "../push-notifications";

const router = Router();

async function resolveAuthenticatedCrewMember(req: AuthenticatedRequest, organizationId: string) {
  const sessionUser = req.session?.user;
  const passportUser = req.user;
  const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
  if (!userEmail) return null;
  const crewMembers = await storage.getAllCrewMembers(organizationId);
  return crewMembers.find(m => m.email?.toLowerCase() === userEmail.toLowerCase()) || null;
}

router.get("/push/vapid-public-key", (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ error: "Push notifications not configured" });
  }
  res.json({ publicKey: key });
});

router.get("/push/status", (req, res) => {
  res.json({ enabled: isPushEnabled() });
});

router.post("/push/subscribe", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { crewMemberId, subscription } = req.body;
    if (!crewMemberId || !subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: "Invalid subscription data" });
    }

    const authCrewMember = await resolveAuthenticatedCrewMember(req as AuthenticatedRequest, organizationId);
    if (!authCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    if (authCrewMember.id !== crewMemberId) {
      return res.status(403).json({ error: "Cannot subscribe for another crew member" });
    }
    
    const sub = await storage.createPushSubscription({
      crewMemberId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    });
    
    res.json({ success: true, subscription: sub });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.post("/push/register-device", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }

    const { token, platform, crewMemberId } = req.body;
    if (!token || !crewMemberId) {
      return res.status(400).json({ error: "Token and crewMemberId are required" });
    }

    const authCrewMember = await resolveAuthenticatedCrewMember(req as AuthenticatedRequest, organizationId);
    if (!authCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    if (authCrewMember.id !== crewMemberId) {
      return res.status(403).json({ error: "Cannot subscribe for another crew member" });
    }

    const endpoint = platform === 'ios' ? `apns://${token}` : `fcm://${token}`;

    const sub = await storage.createPushSubscription({
      crewMemberId,
      endpoint,
      p256dh: 'native-device',
      auth: 'native-device',
    });

    res.json({ success: true, subscription: sub });
  } catch (error) {
    console.error("Error registering native device for push:", error);
    res.status(500).json({ error: "Failed to register device" });
  }
});

router.post("/push/unsubscribe", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint required" });
    }

    const authCrewMember = await resolveAuthenticatedCrewMember(req as AuthenticatedRequest, organizationId);
    if (!authCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }

    const existingSub = await storage.getPushSubscriptionByEndpoint(endpoint);
    if (existingSub && existingSub.crewMemberId !== authCrewMember.id) {
      return res.status(403).json({ error: "Cannot unsubscribe another crew member" });
    }
    
    await storage.deletePushSubscriptionByEndpoint(endpoint);
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;
