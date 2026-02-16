import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  CalendarDays, 
  ClipboardList, 
  FileText, 
  MessageCircle, 
  MoreHorizontal,
  LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJobs } from "@/lib/api";
import { usePlanLimits } from "@/hooks/use-plan-limits";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function MobileNav() {
  const [location] = useLocation();
  const { features } = usePlanLimits();

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: fetchJobs,
  });

  const activeJobsCount = jobs.filter(j => 
    j.status !== "completed" && j.status !== "cancelled"
  ).length;

  const { data: unreadData = { count: 0 } } = useQuery({
    queryKey: ["/api/chat/unread-count"],
    queryFn: async () => {
      const lastVisit = localStorage.getItem('last_chat_visit') || '0';
      const res = await fetch(`/api/chat/unread-count?lastVisit=${lastVisit}`);
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
    enabled: features.chat,
  });

  const unreadChatCount = unreadData.count;

  const navItems: NavItem[] = [
    { 
      href: "/", 
      label: "Dashboard", 
      icon: <LayoutDashboard className="h-5 w-5" /> 
    },
    { 
      href: "/jobs", 
      label: "Jobs", 
      icon: <ClipboardList className="h-5 w-5" />,
      badge: activeJobsCount > 0 ? activeJobsCount : undefined
    },
    { 
      href: "/mobile/sales", 
      label: "Sales", 
      icon: <FileText className="h-5 w-5" /> 
    },
    ...(features.scheduling ? [{ 
      href: "/schedule", 
      label: "Schedule", 
      icon: <CalendarDays className="h-5 w-5" /> 
    }] : []),
    ...(features.chat ? [{ 
      href: "/chat", 
      label: "Chat", 
      icon: <MessageCircle className="h-5 w-5" />,
      badge: unreadChatCount > 0 ? unreadChatCount : undefined
    }] : []),
    { 
      href: "/mobile/more", 
      label: "More", 
      icon: <MoreHorizontal className="h-5 w-5" /> 
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-0">
        {navItems.map((item) => (
          <Link 
            key={item.href} 
            href={item.href}
            onClick={() => {
              if (item.href === '/chat') {
                localStorage.setItem('last_chat_visit', Date.now().toString());
              }
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 min-h-[48px] min-w-0 transition-colors active:scale-95 active:opacity-80",
              isActive(item.href) 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <div className="relative">
              {item.icon}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium truncate max-w-full">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
