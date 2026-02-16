import { useEffect, useRef, useCallback, useState } from "react";
import type { ChatMessage, DirectMessage } from "@shared/schema";

interface TypingPayload {
  channelId: string;
  crewMemberId: string;
  name: string;
  isTyping: boolean;
}

interface WSMessage {
  type: string;
  payload: ChatMessage | DirectMessage | TypingPayload;
}

interface UseChatWebSocketOptions {
  crewMemberId: string | null;
  onNewMessage?: (message: ChatMessage) => void;
  onNewDM?: (dm: DirectMessage) => void;
  onTyping?: (data: { channelId: string; crewMemberId: string; name: string; isTyping: boolean }) => void;
}

async function fetchChatToken(): Promise<{ token: string; crewMemberId: string } | null> {
  try {
    const res = await fetch("/api/chat/token", { credentials: "include" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function useChatWebSocket({ 
  crewMemberId, 
  onNewMessage, 
  onNewDM,
  onTyping 
}: UseChatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const joinedChannelsRef = useRef<Set<string>>(new Set());
  
  const onNewMessageRef = useRef(onNewMessage);
  const onNewDMRef = useRef(onNewDM);
  const onTypingRef = useRef(onTyping);
  
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);
  
  useEffect(() => {
    onNewDMRef.current = onNewDM;
  }, [onNewDM]);
  
  useEffect(() => {
    onTypingRef.current = onTyping;
  }, [onTyping]);

  const connect = useCallback(async () => {
    if (!crewMemberId) return;

    const tokenData = await fetchChatToken();
    if (!tokenData) {
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: "auth", payload: { token: tokenData.token } }));
      
      joinedChannelsRef.current.forEach(channelId => {
        ws.send(JSON.stringify({ type: "join_channel", payload: { channelId } }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case "new_message":
            onNewMessageRef.current?.(message.payload as ChatMessage);
            break;
          case "new_dm":
            onNewDMRef.current?.(message.payload as DirectMessage);
            break;
          case "typing":
            onTypingRef.current?.(message.payload as TypingPayload);
            break;
          case "auth_error":
            console.error("Chat WebSocket auth failed:", (message.payload as unknown as Record<string, string>).error);
            break;
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
  }, [crewMemberId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const joinChannel = useCallback((channelId: string) => {
    joinedChannelsRef.current.add(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "join_channel", payload: { channelId } }));
    }
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    joinedChannelsRef.current.delete(channelId);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave_channel", payload: { channelId } }));
    }
  }, []);

  const sendTyping = useCallback((channelId: string, name: string, isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && crewMemberId) {
      wsRef.current.send(JSON.stringify({ 
        type: "typing", 
        payload: { channelId, crewMemberId, name, isTyping } 
      }));
    }
  }, [crewMemberId]);

  return {
    isConnected,
    joinChannel,
    leaveChannel,
    sendTyping
  };
}
