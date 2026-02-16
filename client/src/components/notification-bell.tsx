import { Bell, Check, CheckCheck, Trash2, Calendar, CalendarClock, Clock, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCrewNotifications, type CrewNotification } from "@/hooks/use-crew-notifications";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useNativePushRegistration } from "@/hooks/use-capacitor";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

function getNotificationIcon(type: string) {
  switch (type) {
    case 'appointment_created':
      return <Calendar className="h-4 w-4 text-blue-500" />;
    case 'appointment_updated':
      return <CalendarClock className="h-4 w-4 text-orange-500" />;
    case 'appointment_reminder':
      return <Clock className="h-4 w-4 text-green-500" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'appointment_created':
      return 'border-l-blue-500';
    case 'appointment_updated':
      return 'border-l-orange-500';
    case 'appointment_reminder':
      return 'border-l-green-500';
    default:
      return 'border-l-gray-500';
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useCrewNotifications();
  const { crewMember } = usePermissions();
  const [, setLocation] = useLocation();

  useNativePushRegistration(crewMember?.id || null);

  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushNotifications({ crewMemberId: crewMember?.id ?? null });

  const recentNotifications = notifications.slice(0, 10);

  const handleNotificationClick = (notification: CrewNotification) => {
    markAsRead(notification.id);
    setLocation('/schedule');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span 
              className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
              data-testid="notification-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" data-testid="notification-dropdown">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  markAllAsRead();
                }}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
                data-testid="button-clear-notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {pushSupported && !pushSubscribed && (
          <div className="px-3 py-2 border-b bg-muted/30" data-testid="push-notification-prompt">
            <div className="flex items-start gap-2">
              <BellRing className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Enable push notifications to get alerts even when the app is closed
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 px-3 text-xs mt-1.5"
                  disabled={pushLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    pushSubscribe();
                  }}
                  data-testid="button-enable-push"
                >
                  {pushLoading ? "Enabling..." : "Enable"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {pushSupported && pushSubscribed && (
          <div className="px-3 py-2 border-b flex items-center justify-between" data-testid="push-notification-status">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5 text-green-500" />
              Push notifications enabled
            </span>
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline"
              disabled={pushLoading}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                pushUnsubscribe();
              }}
              data-testid="button-disable-push"
            >
              Disable
            </button>
          </div>
        )}
        
        {recentNotifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No notifications
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {recentNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer border-l-2",
                  getTypeColor(notification.type),
                  notification.read === 'false' && "bg-muted/50"
                )}
                onClick={() => handleNotificationClick(notification)}
                data-testid={`notification-item-${notification.id}`}
              >
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm truncate",
                      notification.read === 'false' && "font-medium"
                    )}>
                      {notification.title}
                    </p>
                    {notification.read === 'false' && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
        
        {notifications.length > 10 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="justify-center text-sm text-muted-foreground"
              onClick={() => setLocation('/schedule')}
              data-testid="link-view-all-notifications"
            >
              View schedule
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
