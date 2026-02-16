import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "@/hooks/use-toast";

interface SystemNotification {
  id: string;
  type: 'critical_error' | 'error' | 'rage_click' | 'behavior_issue';
  title: string;
  message: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
  createdAt: string;
  read?: boolean;
}

interface NotificationWSPayload extends SystemNotification {}

interface AuthErrorWSPayload {
  error?: string;
}

interface WSMessage {
  type: string;
  payload: NotificationWSPayload | AuthErrorWSPayload;
}

const MAX_NOTIFICATIONS = 50;
const STORAGE_KEY = 'realtime_notifications';
const MAX_RECONNECT_ATTEMPTS = 5;

function loadStoredNotifications(): SystemNotification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.debug('[Notifications] Failed to load stored notifications');
  }
  return [];
}

function saveNotifications(notifications: SystemNotification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch (e) {
    console.debug('[Notifications] Failed to save notifications');
  }
}

export function useRealtimeNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { isSuperAdmin } = usePermissions();
  
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => loadStoredNotifications());
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notification: SystemNotification) => {
    setNotifications(prev => {
      const updated = [{ ...notification, read: false }, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });
    
    if (notification.severity === 'critical' || notification.severity === 'error') {
      toast({
        title: notification.title,
        description: notification.message,
        variant: notification.severity === 'critical' ? 'destructive' : 'default',
      });
    }
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!isSuperAdmin || !isAuthenticated || !user?.id) {
      return;
    }

    let mounted = true;

    const connect = async () => {
      if (!mounted || isConnectingRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      
      isConnectingRef.current = true;

      try {
        const tokenResponse = await fetch('/api/notifications/token', { credentials: 'include' });
        if (!tokenResponse.ok) {
          console.debug('[Notifications] Failed to get notification token');
          isConnectingRef.current = false;
          return;
        }
        
        if (!mounted) {
          isConnectingRef.current = false;
          return;
        }

        const { token } = await tokenResponse.json();
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/notifications`);

        ws.onopen = () => {
          if (!mounted) {
            ws.close();
            return;
          }
          setIsConnected(true);
          reconnectAttemptsRef.current = 0;
          ws.send(JSON.stringify({ type: "auth", payload: { token } }));
        };

        ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            if (message.type === "notification") {
              addNotification(message.payload as SystemNotification);
            } else if (message.type === "auth_error") {
              console.debug('[Notifications] Auth rejected:', (message.payload as AuthErrorWSPayload)?.error);
              ws.close();
            }
          } catch (error) {
            console.error("[Notifications] WebSocket message parse error:", error);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          isConnectingRef.current = false;
          wsRef.current = null;
          
          if (mounted && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            reconnectAttemptsRef.current++;
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          isConnectingRef.current = false;
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("[Notifications] Failed to connect:", error);
        isConnectingRef.current = false;
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, [isSuperAdmin, isAuthenticated, user?.id, addNotification]);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}

export type { SystemNotification };
