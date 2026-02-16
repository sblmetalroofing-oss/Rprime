import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import type { ChatMessage, DirectMessage } from "@shared/schema";
import { storage } from "./storage";
import crypto from "crypto";

const NOTIFICATION_TOKEN_SECRET = process.env.SESSION_SECRET;
const NOTIFICATION_TOKEN_EXPIRY_MS = 5 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!NOTIFICATION_TOKEN_SECRET) {
  if (IS_PRODUCTION) {
    console.error('[NotificationWS] CRITICAL: SESSION_SECRET not set in production - notification system disabled');
  } else {
    console.warn('[NotificationWS] SESSION_SECRET not set - notification tokens disabled in development');
  }
}

export interface ChatToken {
  crewMemberId: string;
  organizationId: string;
  exp: number;
}

export interface NotificationToken {
  userId: string;
  organizationId: string | null;
  exp: number;
}

const CHAT_TOKEN_EXPIRY_MS = 5 * 60 * 1000;

export function generateChatToken(crewMemberId: string, organizationId: string): string | null {
  if (!NOTIFICATION_TOKEN_SECRET) {
    console.error('[ChatWS] Cannot generate token: SESSION_SECRET not set');
    return null;
  }
  
  const payload: ChatToken = {
    crewMemberId,
    organizationId,
    exp: Date.now() + CHAT_TOKEN_EXPIRY_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', NOTIFICATION_TOKEN_SECRET).update(payloadStr).digest('hex');
  return Buffer.from(JSON.stringify({ payload: payloadStr, signature })).toString('base64');
}

export function verifyChatToken(token: string): ChatToken | null {
  if (!NOTIFICATION_TOKEN_SECRET) {
    return null;
  }
  
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const expectedSignature = crypto.createHmac('sha256', NOTIFICATION_TOKEN_SECRET).update(decoded.payload).digest('hex');
    
    if (decoded.signature !== expectedSignature) {
      return null;
    }
    
    const payload: ChatToken = JSON.parse(decoded.payload);
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

export function generateNotificationToken(userId: string, organizationId: string | null): string | null {
  if (!NOTIFICATION_TOKEN_SECRET) {
    console.error('[NotificationWS] Cannot generate token: SESSION_SECRET not set');
    return null;
  }
  
  const payload: NotificationToken = {
    userId,
    organizationId,
    exp: Date.now() + NOTIFICATION_TOKEN_EXPIRY_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', NOTIFICATION_TOKEN_SECRET).update(payloadStr).digest('hex');
  return Buffer.from(JSON.stringify({ payload: payloadStr, signature })).toString('base64');
}

export function verifyNotificationToken(token: string): NotificationToken | null {
  if (!NOTIFICATION_TOKEN_SECRET) {
    return null;
  }
  
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const expectedSignature = crypto.createHmac('sha256', NOTIFICATION_TOKEN_SECRET).update(decoded.payload).digest('hex');
    
    if (decoded.signature !== expectedSignature) {
      return null;
    }
    
    const payload: NotificationToken = JSON.parse(decoded.payload);
    
    if (payload.exp < Date.now()) {
      return null;
    }
    
    return payload;
  } catch {
    return null;
  }
}

interface WebSocketClient extends WebSocket {
  crewMemberId?: string;
  organizationId?: string;
  isAuthorized?: boolean;
  isAlive?: boolean;
}

interface NotificationWebSocketClient extends WebSocket {
  userId?: string;
  organizationId?: string;
  isAuthorized?: boolean;
  isAlive?: boolean;
}

interface AuthPayload {
  crewMemberId?: string;
  token?: string;
}

interface TypingPayload {
  channelId: string;
  crewMemberId: string;
  name: string;
  isTyping: boolean;
}

interface ChannelPayload {
  channelId: string;
}

type WSPayload = AuthPayload | TypingPayload | ChannelPayload | Record<string, unknown>;

interface WSMessage {
  type: string;
  payload: WSPayload;
}

export interface SystemNotification {
  id: string;
  type: 'critical_error' | 'error' | 'rage_click' | 'behavior_issue';
  title: string;
  message: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  organizationId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

class ChatWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, Set<WebSocketClient>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws/chat" });
    this.setupHeartbeat();
    this.setupConnectionHandler();
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as WebSocketClient;
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  }

  private setupConnectionHandler() {
    this.wss.on("connection", (ws: WebSocketClient) => {
      ws.isAlive = true;

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("WebSocket message parse error:", error);
        }
      });

      ws.on("close", () => {
        this.removeClient(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        this.removeClient(ws);
      });
    });
  }

  private handleMessage(ws: WebSocketClient, message: WSMessage) {
    switch (message.type) {
      case "auth":
        this.handleAuth(ws, message.payload as { token: string; crewMemberId?: string });
        break;
      case "typing":
        if (!ws.isAuthorized) return;
        this.broadcastTyping(message.payload as TypingPayload);
        break;
      case "join_channel":
        if (!ws.isAuthorized) return;
        this.joinChannel(ws, (message.payload as ChannelPayload).channelId);
        break;
      case "leave_channel":
        if (!ws.isAuthorized) return;
        this.leaveChannel(ws, (message.payload as ChannelPayload).channelId);
        break;
    }
  }

  private async handleAuth(ws: WebSocketClient, payload: { token: string; crewMemberId?: string }) {
    if (!payload.token) {
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Missing token" } }));
      ws.close();
      return;
    }

    const tokenData = verifyChatToken(payload.token);
    if (!tokenData) {
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Invalid or expired token" } }));
      ws.close();
      return;
    }

    try {
      const crewMember = await storage.getCrewMember(tokenData.organizationId, tokenData.crewMemberId);
      if (!crewMember || crewMember.isActive !== 'true') {
        ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Crew member not found or inactive" } }));
        ws.close();
        return;
      }

      ws.crewMemberId = tokenData.crewMemberId;
      ws.organizationId = tokenData.organizationId;
      ws.isAuthorized = true;

      if (!this.clients.has("all")) {
        this.clients.set("all", new Set());
      }
      this.clients.get("all")!.add(ws);
      
      ws.send(JSON.stringify({ type: "auth_success", payload: { crewMemberId: tokenData.crewMemberId } }));
    } catch (error) {
      console.error("[ChatWS] Auth validation error:", error);
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Validation failed" } }));
      ws.close();
    }
  }

  private joinChannel(ws: WebSocketClient, channelId: string) {
    const key = `channel:${channelId}`;
    if (!this.clients.has(key)) {
      this.clients.set(key, new Set());
    }
    this.clients.get(key)!.add(ws);
  }

  private leaveChannel(ws: WebSocketClient, channelId: string) {
    const key = `channel:${channelId}`;
    this.clients.get(key)?.delete(ws);
  }

  private removeClient(ws: WebSocketClient) {
    this.clients.forEach((clientSet) => {
      clientSet.delete(ws);
    });
  }

  broadcastToChannel(channelId: string, message: WSMessage) {
    const key = `channel:${channelId}`;
    const channelClients = this.clients.get(key);
    
    if (channelClients) {
      const data = JSON.stringify(message);
      channelClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }

  broadcastNewMessage(channelId: string, chatMessage: ChatMessage) {
    this.broadcastToChannel(channelId, {
      type: "new_message",
      payload: chatMessage,
    });
  }

  broadcastTyping(payload: { channelId: string; crewMemberId: string; name: string; isTyping: boolean }) {
    this.broadcastToChannel(payload.channelId, {
      type: "typing",
      payload,
    });
  }

  sendDirectMessage(recipientId: string, dm: DirectMessage) {
    const allClients = this.clients.get("all");
    if (allClients) {
      const data = JSON.stringify({ type: "new_dm", payload: dm });
      allClients.forEach((client) => {
        if (client.crewMemberId === recipientId && client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }

  broadcastToAll(message: WSMessage) {
    const allClients = this.clients.get("all");
    if (allClients) {
      const data = JSON.stringify(message);
      allClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  }
}

class NotificationWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<NotificationWebSocketClient> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws/notifications" });
    this.setupHeartbeat();
    this.setupConnectionHandler();
  }

  private setupHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as NotificationWebSocketClient;
        if (client.isAlive === false) {
          this.clients.delete(client);
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);
  }

  private setupConnectionHandler() {
    this.wss.on("connection", (ws: NotificationWebSocketClient) => {
      ws.isAlive = true;

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("message", (data) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("Notification WebSocket message parse error:", error);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("Notification WebSocket error:", error);
        this.clients.delete(ws);
      });
    });
  }

  private handleMessage(ws: NotificationWebSocketClient, message: WSMessage) {
    switch (message.type) {
      case "auth":
        this.handleAuth(ws, message.payload as { token: string });
        break;
    }
  }

  private async handleAuth(ws: NotificationWebSocketClient, payload: { token: string }) {
    if (!payload.token) {
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Missing token" } }));
      ws.close();
      return;
    }

    const tokenData = verifyNotificationToken(payload.token);
    
    if (!tokenData) {
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Invalid or expired token" } }));
      ws.close();
      return;
    }

    try {
      const user = await storage.getUser(tokenData.userId);
      
      if (!user || !user.isSuperAdmin) {
        ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Not authorized" } }));
        ws.close();
        return;
      }
      
      if (user.organizationId !== tokenData.organizationId) {
        ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Organization mismatch" } }));
        ws.close();
        return;
      }

      ws.userId = tokenData.userId;
      ws.organizationId = user.organizationId || undefined;
      ws.isAuthorized = true;
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "auth_success", payload: { userId: tokenData.userId } }));
    } catch (error) {
      console.error("[NotificationWS] Auth validation error:", error);
      ws.send(JSON.stringify({ type: "auth_error", payload: { error: "Validation failed" } }));
      ws.close();
    }
  }

  broadcastNotification(notification: SystemNotification) {
    if (!notification.organizationId) {
      console.warn('[NotificationWS] Dropping notification without organizationId');
      return;
    }
    
    const data = JSON.stringify({ type: "notification", payload: notification });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.isAuthorized) {
        if (client.organizationId === notification.organizationId) {
          client.send(data);
        }
      }
    });
  }

  getConnectedClientCount(): number {
    return this.clients.size;
  }
}

let chatWss: ChatWebSocketServer | null = null;
let notificationWss: NotificationWebSocketServer | null = null;

export function setupChatWebSocket(server: Server): ChatWebSocketServer {
  chatWss = new ChatWebSocketServer(server);
  console.log("WebSocket server initialized on /ws/chat");
  
  notificationWss = new NotificationWebSocketServer(server);
  console.log("Notification WebSocket server initialized on /ws/notifications");
  
  return chatWss;
}

export function getChatWebSocket(): ChatWebSocketServer | null {
  return chatWss;
}

export function getNotificationWebSocket(): NotificationWebSocketServer | null {
  return notificationWss;
}

export function emitNotification(notification: SystemNotification) {
  if (notificationWss) {
    notificationWss.broadcastNotification(notification);
  }
}
