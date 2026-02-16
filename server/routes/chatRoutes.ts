import { Router, Request, Response } from "express";
import { getOrganizationId, canUserDelete, AuthenticatedRequest } from "./middleware";
import { storage } from "../storage";
import { insertChatChannelSchema, insertChatMessageSchema, insertDirectMessageSchema } from "@shared/schema";
import { getChatWebSocket } from "../websocket";
import { sendPushToAll } from "../push-notifications";

const router = Router();

async function getSessionCrewMember(req: Request, organizationId: string) {
  const authReq = req as AuthenticatedRequest;
  const sessionUser = authReq.session?.user;
  const passportUser = authReq.user;
  const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
  if (!userEmail) return null;
  const crewMembersList = await storage.getAllCrewMembers(organizationId);
  return crewMembersList.find(m => 
    m.email && m.email.toLowerCase() === userEmail.toLowerCase()
  ) || null;
}

router.get("/chat/unread-count", async (req, res) => {
  try {
    const lastVisit = req.query.lastVisit as string;
    if (!lastVisit) return res.json({ count: 0 });

    const organizationId = await getOrganizationId(req);
    if (!organizationId) return res.json({ count: 0 });

    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) return res.json({ count: 0 });

    const channelUnread = await storage.getTotalUnreadChannelMessages(organizationId, matchingCrewMember.id, new Date(parseInt(lastVisit, 10)));
    const dmUnread = await storage.getUnreadDMCount(organizationId, matchingCrewMember.id);

    res.json({ count: channelUnread + dmUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

router.get("/chat/channels", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const channels = await storage.getAllChatChannels(organizationId);
    
    if (channels.length === 0) {
      const defaultChannel = await storage.createChatChannel({
        name: "general",
        description: "General team chat",
        type: "general",
        icon: "💬",
        organizationId
      });
      return res.json([defaultChannel]);
    }
    
    res.json(channels);
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

router.get("/chat/channels/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const channel = await storage.getChatChannel(organizationId, req.params.id);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(channel);
  } catch (error) {
    console.error("Error fetching channel:", error);
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

router.post("/chat/channels", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertChatChannelSchema.parse(req.body);
    const channel = await storage.createChatChannel({ ...validatedData, organizationId });
    res.status(201).json(channel);
  } catch (error) {
    console.error("Error creating channel:", error);
    res.status(400).json({ error: "Failed to create channel" });
  }
});

router.put("/chat/channels/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertChatChannelSchema.partial().parse(req.body);
    const channel = await storage.updateChatChannel(organizationId, req.params.id, validatedData);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    res.json(channel);
  } catch (error) {
    console.error("Error updating channel:", error);
    res.status(400).json({ error: "Failed to update channel" });
  }
});

router.delete("/chat/channels/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const hasDeletePermission = await canUserDelete(req as AuthenticatedRequest);
    if (!hasDeletePermission) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    await storage.deleteChatChannel(organizationId, req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting channel:", error);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

router.get("/chat/channels/:channelId/messages", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { channelId } = req.params;
    
    const channel = await storage.getChatChannel(organizationId, channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const { limit, before } = req.query;
    const messages = await storage.getChatMessages(
      channelId,
      limit ? parseInt(limit as string, 10) : 50,
      before as string | undefined
    );
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/chat/channels/:channelId/messages", async (req, res) => {
  try {
    const { channelId } = req.params;
    
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "You must be logged in to send messages" });
    }
    
    const channel = await storage.getChatChannel(organizationId, channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const authReq = req as AuthenticatedRequest;
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
    const matchingCrewMember = crewMembers.find(m => 
      m.email && userEmail && 
      m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member. Please contact an admin." });
    }
    
    const senderData = {
      ...req.body,
      senderId: matchingCrewMember.id,
      senderName: matchingCrewMember.name,
      senderColor: matchingCrewMember.color || '#6366f1'
    };
    
    const validatedData = insertChatMessageSchema.parse({ ...senderData, channelId });
    const message = await storage.createChatMessage(validatedData);
    
    const wss = getChatWebSocket();
    if (wss) {
      wss.broadcastNewMessage(channelId, message);
    }
    
    sendPushToAll(
      message.senderId,
      `#${channel?.name || 'chat'}`,
      `${message.senderName}: ${message.content.substring(0, 100)}`,
      { url: '/chat', channelId }
    );
    
    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(400).json({ error: "Failed to create message" });
  }
});

router.put("/chat/messages/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    
    const existingMessage = await storage.getChatMessage(req.params.id);
    if (!existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    const channel = await storage.getChatChannel(organizationId, existingMessage.channelId);
    if (!channel) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    if (existingMessage.senderId !== matchingCrewMember.id) {
      return res.status(403).json({ error: "You can only edit your own messages" });
    }
    
    const validatedData = insertChatMessageSchema.partial().parse(req.body);
    const message = await storage.updateChatMessage(req.params.id, {
      ...validatedData,
      isEdited: true
    });
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(400).json({ error: "Failed to update message" });
  }
});

router.delete("/chat/messages/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    
    const existingMessage = await storage.getChatMessage(req.params.id);
    if (!existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    const channel = await storage.getChatChannel(organizationId, existingMessage.channelId);
    if (!channel) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    if (existingMessage.senderId !== matchingCrewMember.id) {
      return res.status(403).json({ error: "You can only delete your own messages" });
    }
    
    await storage.deleteChatMessage(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

router.put("/chat/messages/:id/pin", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const existingMessage = await storage.getChatMessage(req.params.id);
    if (!existingMessage) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    const channel = await storage.getChatChannel(organizationId, existingMessage.channelId);
    if (!channel) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    const { isPinned } = req.body;
    const message = await storage.pinChatMessage(req.params.id, isPinned);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(message);
  } catch (error) {
    console.error("Error pinning message:", error);
    res.status(500).json({ error: "Failed to pin message" });
  }
});

router.get("/chat/dm/conversations", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    const conversations = await storage.getDirectMessageConversations(organizationId, matchingCrewMember.id);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching DM conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/chat/dm/:userId1/:userId2", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    const { userId1, userId2 } = req.params;
    if (matchingCrewMember.id !== userId1 && matchingCrewMember.id !== userId2) {
      return res.status(403).json({ error: "You can only access your own messages" });
    }
    const { limit, before } = req.query;
    const messages = await storage.getDirectMessages(
      organizationId,
      userId1,
      userId2,
      limit ? parseInt(limit as string) : 50,
      before as string | undefined
    );
    res.json(messages);
  } catch (error) {
    console.error("Error fetching DMs:", error);
    res.status(500).json({ error: "Failed to fetch direct messages" });
  }
});

router.post("/chat/dm", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "You must be logged in to send messages" });
    }
    
    const authReq = req as AuthenticatedRequest;
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
    const matchingCrewMember = crewMembers.find(m => 
      m.email && userEmail && 
      m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member. Please contact an admin." });
    }
    
    const senderData = {
      ...req.body,
      organizationId,
      senderId: matchingCrewMember.id,
      senderName: matchingCrewMember.name,
      senderColor: matchingCrewMember.color || '#6366f1'
    };
    
    const validatedData = insertDirectMessageSchema.parse(senderData);
    const message = await storage.createDirectMessage(validatedData);
    
    const wss = getChatWebSocket();
    if (wss) {
      wss.sendDirectMessage(message.recipientId, message);
    }
    
    res.status(201).json(message);
  } catch (error) {
    console.error("Error creating DM:", error);
    res.status(400).json({ error: "Failed to create direct message" });
  }
});

router.put("/chat/dm/read", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { senderId, recipientId } = req.body;
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    if (matchingCrewMember.id !== recipientId) {
      return res.status(403).json({ error: "You can only mark messages as read for yourself" });
    }
    await storage.markDirectMessagesRead(organizationId, senderId, recipientId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking DMs read:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
});

router.get("/chat/dm/unread/:recipientId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    if (matchingCrewMember.id !== req.params.recipientId) {
      return res.status(403).json({ error: "You can only access your own messages" });
    }
    const count = await storage.getUnreadDMCount(organizationId, req.params.recipientId);
    res.json({ count });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

router.get("/chat/dm/unread/:senderId/:recipientId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember) {
      return res.status(403).json({ error: "Your account is not linked to a crew member" });
    }
    const { senderId, recipientId } = req.params;
    if (matchingCrewMember.id !== senderId && matchingCrewMember.id !== recipientId) {
      return res.status(403).json({ error: "You can only access your own messages" });
    }
    const count = await storage.getUnreadDMCountBySender(organizationId, senderId, recipientId);
    res.json({ count });
  } catch (error) {
    console.error("Error getting unread count by sender:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

router.get("/chat/channels/:channelId/unread/:crewMemberId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { channelId, crewMemberId } = req.params;
    
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember || matchingCrewMember.id !== crewMemberId) {
      return res.status(403).json({ error: "You can only check your own unread counts" });
    }
    
    const channel = await storage.getChatChannel(organizationId, channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const count = await storage.getUnreadMessageCount(channelId, crewMemberId);
    res.json({ count });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

router.post("/chat/channels/:channelId/read/:crewMemberId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { channelId, crewMemberId } = req.params;
    
    const matchingCrewMember = await getSessionCrewMember(req, organizationId);
    if (!matchingCrewMember || matchingCrewMember.id !== crewMemberId) {
      return res.status(403).json({ error: "You can only update your own read status" });
    }
    
    const channel = await storage.getChatChannel(organizationId, channelId);
    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }
    
    const status = await storage.updateChannelReadStatus(channelId, crewMemberId);
    res.json(status);
  } catch (error) {
    console.error("Error updating read status:", error);
    res.status(500).json({ error: "Failed to update read status" });
  }
});

export default router;
