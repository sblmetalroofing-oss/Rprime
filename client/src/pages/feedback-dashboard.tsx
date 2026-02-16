import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, Bug, Check, Copy, Loader2, RefreshCw, Sparkles, XCircle, Monitor, Smartphone, Globe, Filter, ChevronDown, ChevronRight, User, Layers, MousePointer2, MousePointerClick, Timer, ArrowLeftRight, Flame, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { FeedbackEvent, CrewMember, UserBehaviorEvent } from "@shared/schema";

interface BehaviorStats {
  byType: Record<string, number>;
  byPage: Record<string, number>;
}

interface UXAnalysisResult {
  analysis: string;
  eventCount: number;
  byType: Record<string, number>;
  byPage: Record<string, number>;
}

interface FetchFilters {
  eventType?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  userEmail?: string;
}

interface ErrorGroup {
  groupId: string;
  count: number;
  latestOccurrence: string;
  sampleMessage: string;
  eventType: string;
  severity: string;
  events: FeedbackEvent[];
}

async function fetchFeedbackEvents(filters: FetchFilters): Promise<FeedbackEvent[]> {
  const params = new URLSearchParams();
  if (filters.eventType && filters.eventType !== "all") params.set("eventType", filters.eventType);
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.priority && filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.userEmail) params.set("userEmail", filters.userEmail);
  const response = await fetch(`/api/feedback/events?${params}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch events");
  return response.json();
}

async function fetchErrorGroups(): Promise<ErrorGroup[]> {
  const response = await fetch("/api/feedback/groups", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch error groups");
  return response.json();
}

async function fetchCrewMembers(): Promise<CrewMember[]> {
  const response = await fetch("/api/crew-members", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch crew members");
  return response.json();
}

async function analyzeEvents(): Promise<{ analysis: string; eventCount: number; eventsByType: Record<string, number> }> {
  const response = await fetch("/api/feedback/analyze", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to analyze events");
  return response.json();
}

async function analyzeGroup(groupId: string): Promise<{ analysis: string; eventCount: number }> {
  const response = await fetch("/api/feedback/analyze-group", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groupId }),
  });
  if (!response.ok) throw new Error("Failed to analyze group");
  return response.json();
}

async function updateEvent(id: string, data: { priority?: string; assignedTo?: string | null; resolved?: string; resolutionNotes?: string }): Promise<FeedbackEvent> {
  const response = await fetch(`/api/feedback/events/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update event");
  return response.json();
}

async function fetchBehaviorEvents(): Promise<UserBehaviorEvent[]> {
  const response = await fetch("/api/behavior/events", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch behavior events");
  return response.json();
}

async function fetchBehaviorStats(): Promise<BehaviorStats> {
  const response = await fetch("/api/behavior/stats", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch behavior stats");
  return response.json();
}

async function analyzeUX(): Promise<UXAnalysisResult> {
  const response = await fetch("/api/feedback/analyze-ux", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ daysBack: 7 }),
  });
  if (!response.ok) throw new Error("Failed to analyze UX");
  return response.json();
}

const severityColors: Record<string, string> = {
  critical: "bg-red-500 text-white",
  error: "bg-orange-500 text-white",
  warning: "bg-yellow-500 text-black",
  info: "bg-blue-500 text-white",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-500 text-white",
  medium: "bg-blue-500 text-white",
  high: "bg-orange-500 text-white",
  critical: "bg-red-500 text-white",
};

const severityChartColors: Record<string, string> = {
  critical: "#ef4444",
  error: "#f97316",
  warning: "#eab308",
  info: "#3b82f6",
};

const eventTypeIcons: Record<string, typeof Bug> = {
  error: Bug,
  api_failure: XCircle,
  user_action: Check,
  performance: RefreshCw,
  data_issue: AlertTriangle,
};

function parseUserAgent(userAgent: string): { browser: string; platform: string } {
  let browser = "Unknown";
  let platform = "Unknown";

  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
    browser = "Chrome";
  } else if (userAgent.includes("Firefox")) {
    browser = "Firefox";
  } else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
    browser = "Safari";
  } else if (userAgent.includes("Edg")) {
    browser = "Edge";
  } else if (userAgent.includes("Opera") || userAgent.includes("OPR")) {
    browser = "Opera";
  }

  if (userAgent.includes("Windows")) {
    platform = "Windows";
  } else if (userAgent.includes("Mac OS")) {
    platform = "macOS";
  } else if (userAgent.includes("Linux")) {
    platform = "Linux";
  } else if (userAgent.includes("Android")) {
    platform = "Android";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iPad")) {
    platform = "iOS";
  }

  return { browser, platform };
}

function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export default function FeedbackDashboard() {
  const defaultDates = getDefaultDateRange();
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [userEmailFilter, setUserEmailFilter] = useState("");
  const [startDate, setStartDate] = useState(defaultDates.startDate);
  const [endDate, setEndDate] = useState(defaultDates.endDate);
  const [activeTab, setActiveTab] = useState("events");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [eventToResolve, setEventToResolve] = useState<FeedbackEvent | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [groupAnalysis, setGroupAnalysis] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const filters: FetchFilters = useMemo(() => ({
    eventType: eventTypeFilter,
    severity: severityFilter,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    priority: priorityFilter,
    userEmail: userEmailFilter || undefined,
  }), [eventTypeFilter, severityFilter, startDate, endDate, priorityFilter, userEmailFilter]);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/feedback/events", filters],
    queryFn: () => fetchFeedbackEvents(filters),
  });

  const { data: errorGroups = [], isLoading: isLoadingGroups, refetch: refetchGroups } = useQuery({
    queryKey: ["/api/feedback/groups"],
    queryFn: fetchErrorGroups,
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ["/api/crew-members"],
    queryFn: fetchCrewMembers,
  });

  const { data: behaviorEvents = [], isLoading: isLoadingBehavior, refetch: refetchBehavior } = useQuery({
    queryKey: ["/api/behavior/events"],
    queryFn: fetchBehaviorEvents,
    retry: false,
  });

  const { data: behaviorStats, isLoading: isLoadingBehaviorStats } = useQuery({
    queryKey: ["/api/behavior/stats"],
    queryFn: fetchBehaviorStats,
    retry: false,
  });

  const analyzeUXMutation = useMutation({
    mutationFn: analyzeUX,
    onError: (error) => {
      toast({ title: "UX Analysis failed", description: String(error), variant: "destructive" });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: analyzeEvents,
    onSuccess: () => {
      setActiveTab("analysis");
    },
    onError: (error) => {
      toast({ title: "Analysis failed", description: String(error), variant: "destructive" });
    },
  });

  const analyzeGroupMutation = useMutation({
    mutationFn: analyzeGroup,
    onSuccess: (data, groupId) => {
      setGroupAnalysis(prev => ({ ...prev, [groupId]: data.analysis }));
      toast({ title: "Group analysis complete" });
    },
    onError: (error) => {
      toast({ title: "Analysis failed", description: String(error), variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { priority?: string; assignedTo?: string | null; resolved?: string; resolutionNotes?: string } }) =>
      updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/groups"] });
    },
  });

  const handleResolve = (event: FeedbackEvent) => {
    setEventToResolve(event);
    setResolutionNotes("");
    setResolveDialogOpen(true);
  };

  const confirmResolve = () => {
    if (!eventToResolve) return;
    updateEventMutation.mutate(
      { id: eventToResolve.id, data: { resolved: "true", resolutionNotes } },
      {
        onSuccess: () => {
          toast({ title: "Event resolved" });
          setResolveDialogOpen(false);
          setEventToResolve(null);
        },
      }
    );
  };

  const handlePriorityChange = (eventId: string, priority: string) => {
    updateEventMutation.mutate(
      { id: eventId, data: { priority } },
      { onSuccess: () => toast({ title: "Priority updated" }) }
    );
  };

  const handleAssigneeChange = (eventId: string, assignedTo: string) => {
    updateEventMutation.mutate(
      { id: eventId, data: { assignedTo: assignedTo === "unassigned" ? null : assignedTo } },
      { onSuccess: () => toast({ title: "Assignee updated" }) }
    );
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const copyAnalysis = () => {
    if (analyzeMutation.data?.analysis) {
      navigator.clipboard.writeText(analyzeMutation.data.analysis);
      toast({ title: "Copied to clipboard" });
    }
  };

  const getCrewMemberName = (id: string | null | undefined) => {
    if (!id) return null;
    const member = crewMembers.find(m => m.id === id);
    return member?.name || null;
  };

  const stats = useMemo(() => ({
    total: events.length,
    byType: events.reduce((acc, e) => ({ ...acc, [e.eventType]: (acc[e.eventType] || 0) + 1 }), {} as Record<string, number>),
    bySeverity: events.reduce((acc, e) => ({ ...acc, [e.severity]: (acc[e.severity] || 0) + 1 }), {} as Record<string, number>),
    unresolved: events.filter((e) => e.resolved === "false").length,
  }), [events]);

  const trendData = useMemo(() => {
    const last7Days: Record<string, { date: string; critical: number; error: number; warning: number; info: number }> = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days[dateStr] = { date: dateStr, critical: 0, error: 0, warning: 0, info: 0 };
    }

    events.forEach((event) => {
      const eventDate = new Date(event.createdAt).toISOString().split('T')[0];
      if (last7Days[eventDate]) {
        const severity = event.severity as 'critical' | 'error' | 'warning' | 'info';
        if (severity in last7Days[eventDate]) {
          last7Days[eventDate][severity]++;
        }
      }
    });

    return Object.values(last7Days).map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    }));
  }, [events]);

  const deviceStats = useMemo(() => {
    const browsers: Record<string, number> = {};
    const platforms: Record<string, number> = {};

    events.forEach((event) => {
      const context = event.context as { userAgent?: string } | null;
      if (context?.userAgent) {
        const { browser, platform } = parseUserAgent(context.userAgent);
        browsers[browser] = (browsers[browser] || 0) + 1;
        platforms[platform] = (platforms[platform] || 0) + 1;
      }
    });

    const browserData = Object.entries(browsers)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const platformData = Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return { browserData, platformData };
  }, [events]);

  const pieColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  const frictionPointsData = useMemo(() => {
    const byType: Record<string, UserBehaviorEvent[]> = {
      rage_click: [],
      dead_click: [],
      thrashing: [],
      slow_action: [],
    };
    
    behaviorEvents.forEach((event) => {
      const type = event.eventType;
      if (byType[type]) {
        byType[type].push(event);
      }
    });
    
    return byType;
  }, [behaviorEvents]);

  const pageHeatMapData = useMemo(() => {
    const pageData: Record<string, { 
      url: string; 
      issueCount: number; 
      elements: Record<string, number>;
      byType: Record<string, number>;
    }> = {};
    
    behaviorEvents.forEach((event) => {
      const pageUrl = event.pageUrl || "Unknown Page";
      if (!pageData[pageUrl]) {
        pageData[pageUrl] = { 
          url: pageUrl, 
          issueCount: 0, 
          elements: {},
          byType: {}
        };
      }
      pageData[pageUrl].issueCount++;
      pageData[pageUrl].byType[event.eventType] = (pageData[pageUrl].byType[event.eventType] || 0) + 1;
      
      if (event.elementSelector) {
        pageData[pageUrl].elements[event.elementSelector] = 
          (pageData[pageUrl].elements[event.elementSelector] || 0) + 1;
      }
    });
    
    return Object.values(pageData)
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);
  }, [behaviorEvents]);

  const getHeatColor = (issueCount: number, maxCount: number) => {
    if (maxCount === 0) return "bg-green-100 dark:bg-green-900";
    const intensity = issueCount / maxCount;
    if (intensity > 0.75) return "bg-red-500 text-white";
    if (intensity > 0.5) return "bg-orange-400 text-white";
    if (intensity > 0.25) return "bg-yellow-400 text-black";
    return "bg-green-200 dark:bg-green-800";
  };

  const frictionTypeConfig = {
    rage_click: { 
      label: "Rage Clicks", 
      description: "Elements users click repeatedly in frustration",
      icon: MousePointerClick,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950"
    },
    dead_click: { 
      label: "Dead Clicks", 
      description: "Non-interactive elements users try to click",
      icon: MousePointer2,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950"
    },
    thrashing: { 
      label: "Thrashing", 
      description: "Pages where users navigate back and forth",
      icon: ArrowLeftRight,
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-950"
    },
    slow_action: { 
      label: "Slow Actions", 
      description: "Elements that take too long to respond",
      icon: Timer,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950"
    },
  };

  const clearFilters = () => {
    setEventTypeFilter("all");
    setSeverityFilter("all");
    setPriorityFilter("all");
    setUserEmailFilter("");
    const { startDate: defaultStart, endDate: defaultEnd } = getDefaultDateRange();
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
  };

  const renderEventRow = (event: FeedbackEvent, showControls = true) => {
    const Icon = eventTypeIcons[event.eventType] || Bug;
    const assigneeName = getCrewMemberName(event.assignedTo);
    
    return (
      <div
        key={event.id}
        className={cn(
          "p-3 sm:p-4 hover:bg-muted/50",
          event.resolved === "true" && "opacity-60"
        )}
        data-testid={`event-${event.id}`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                  <Badge className={cn("text-xs", severityColors[event.severity] || "")}>
                    {event.severity}
                  </Badge>
                  <Badge className={cn("text-xs", priorityColors[event.priority] || priorityColors.medium)}>
                    {event.priority || "medium"}
                  </Badge>
                  {event.resolved === "true" && (
                    <Badge variant="secondary" className="text-xs">Resolved</Badge>
                  )}
                  {assigneeName && (
                    <Badge variant="outline" className="text-xs">
                      <User className="h-3 w-3 mr-1" />
                      {assigneeName}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs sm:text-sm font-medium break-words">{event.message}</p>
                {event.stackTrace && (
                  <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto max-h-24">
                    {event.stackTrace.slice(0, 300)}
                    {event.stackTrace.length > 300 && "..."}
                  </pre>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString()}
                  {event.userEmail && ` • ${event.userEmail}`}
                </p>
                {event.resolved === "true" && event.resolutionNotes && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded text-xs">
                    <span className="font-medium text-green-700 dark:text-green-300">Resolution Notes: </span>
                    <span className="text-green-600 dark:text-green-400">{event.resolutionNotes}</span>
                    {event.resolvedAt && (
                      <span className="text-muted-foreground ml-2">
                        • Resolved {new Date(event.resolvedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {showControls && (
              <div className="flex flex-wrap gap-2 items-center">
                <Select 
                  value={event.priority || "medium"} 
                  onValueChange={(val) => handlePriorityChange(event.id, val)}
                >
                  <SelectTrigger className="w-[100px] h-8 text-xs" data-testid={`select-priority-${event.id}`}>
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select 
                  value={event.assignedTo || "unassigned"} 
                  onValueChange={(val) => handleAssigneeChange(event.id, val)}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs" data-testid={`select-assignee-${event.id}`}>
                    <SelectValue placeholder="Assign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {crewMembers.map(member => (
                      <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {event.resolved === "false" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResolve(event)}
                    disabled={updateEventMutation.isPending}
                    data-testid={`button-resolve-${event.id}`}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="container mx-auto py-4 sm:py-6 space-y-4 sm:space-y-6 px-2 sm:px-4" data-testid="feedback-dashboard">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">Feedback & Debugging</h1>
            <p className="text-sm text-muted-foreground">AI-powered analysis of production events</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { refetch(); refetchGroups(); }} data-testid="button-refresh" className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              data-testid="button-analyze"
              data-expected-slow="true"
              className="flex-1 sm:flex-none"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 sm:mr-2" />
              )}
              <span className="sm:inline">Analyze</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Events</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-total-events">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unresolved</CardDescription>
              <CardTitle className="text-2xl text-orange-500" data-testid="text-unresolved">{stats.unresolved}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Errors</CardDescription>
              <CardTitle className="text-2xl text-red-500" data-testid="text-errors">
                {(stats.bySeverity.critical || 0) + (stats.bySeverity.error || 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Error Groups</CardDescription>
              <CardTitle className="text-2xl" data-testid="text-error-groups">{errorGroups.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
            <TabsTrigger value="grouped" data-testid="tab-grouped">
              <Layers className="h-4 w-4 mr-1" />
              Grouped
            </TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">Device Stats</TabsTrigger>
            <TabsTrigger value="ux-insights" data-testid="tab-ux-insights">
              <Eye className="h-4 w-4 mr-1" />
              UX Insights
            </TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">AI Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4">
            <div className="flex flex-wrap gap-2 sm:gap-4 items-end">
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[140px] sm:w-[180px]" data-testid="select-event-type">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="api_failure">API Failure</SelectItem>
                  <SelectItem value="user_action">User Action</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="data_issue">Data Issue</SelectItem>
                </SelectContent>
              </Select>

              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[140px] sm:w-[180px]" data-testid="select-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                data-testid="button-toggle-filters"
                className="h-10"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showAdvancedFilters ? "Hide Filters" : "More Filters"}
              </Button>

              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters" className="h-10">
                Clear
              </Button>
            </div>

            {showAdvancedFilters && (
              <Card className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="input-end-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger id="priority" data-testid="select-priority">
                        <SelectValue placeholder="All Priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userEmail">User Email</Label>
                    <Input
                      id="userEmail"
                      type="email"
                      placeholder="Search by email..."
                      value={userEmailFilter}
                      onChange={(e) => setUserEmailFilter(e.target.value)}
                      data-testid="input-user-email"
                    />
                  </div>
                </div>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events found
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] sm:h-[500px]">
                    <div className="divide-y">
                      {events.map((event) => renderEventRow(event))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grouped" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Error Groups
                </CardTitle>
                <CardDescription>Similar errors grouped together for easier analysis</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingGroups ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : errorGroups.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No error groups found
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y">
                      {errorGroups.map((group) => (
                        <Collapsible key={group.groupId} open={expandedGroups.has(group.groupId)}>
                          <div className="p-4 hover:bg-muted/50" data-testid={`group-${group.groupId}`}>
                            <div className="flex items-start justify-between gap-4">
                              <CollapsibleTrigger 
                                className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                                onClick={() => toggleGroup(group.groupId)}
                              >
                                {expandedGroups.has(group.groupId) ? (
                                  <ChevronDown className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs">{group.eventType}</Badge>
                                    <Badge className={cn("text-xs", severityColors[group.severity] || "")}>
                                      {group.severity}
                                    </Badge>
                                    <Badge variant="secondary" className="text-xs">
                                      {group.count} events
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-sm font-medium break-words">{group.sampleMessage}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Latest: {new Date(group.latestOccurrence).toLocaleString()}
                                  </p>
                                </div>
                              </CollapsibleTrigger>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => analyzeGroupMutation.mutate(group.groupId)}
                                disabled={analyzeGroupMutation.isPending}
                                data-testid={`button-analyze-group-${group.groupId}`}
                                data-expected-slow="true"
                              >
                                {analyzeGroupMutation.isPending && analyzeGroupMutation.variables === group.groupId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Sparkles className="h-4 w-4" />
                                )}
                                <span className="ml-1 hidden sm:inline">Analyze</span>
                              </Button>
                            </div>
                            
                            {groupAnalysis[group.groupId] && (
                              <div className="mt-4 p-3 bg-muted rounded-lg">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-yellow-500" />
                                  AI Analysis
                                </h4>
                                <div className="text-xs whitespace-pre-wrap font-mono">
                                  {groupAnalysis[group.groupId]}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <CollapsibleContent>
                            <div className="border-t bg-muted/30">
                              {group.events.map((event) => renderEventRow(event, true))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Trends - Last 7 Days</CardTitle>
                <CardDescription>Daily error counts by severity</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-[300px] sm:h-[400px]" data-testid="chart-error-trends">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }} 
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend />
                        <Bar dataKey="critical" stackId="a" fill={severityChartColors.critical} name="Critical" />
                        <Bar dataKey="error" stackId="a" fill={severityChartColors.error} name="Error" />
                        <Bar dataKey="warning" stackId="a" fill={severityChartColors.warning} name="Warning" />
                        <Bar dataKey="info" stackId="a" fill={severityChartColors.info} name="Info" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Critical</CardDescription>
                  <CardTitle className="text-2xl text-red-500" data-testid="text-critical-count">
                    {stats.bySeverity.critical || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Error</CardDescription>
                  <CardTitle className="text-2xl text-orange-500" data-testid="text-error-count">
                    {stats.bySeverity.error || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Warning</CardDescription>
                  <CardTitle className="text-2xl text-yellow-500" data-testid="text-warning-count">
                    {stats.bySeverity.warning || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Info</CardDescription>
                  <CardTitle className="text-2xl text-blue-500" data-testid="text-info-count">
                    {stats.bySeverity.info || 0}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Top Browsers
                  </CardTitle>
                  <CardDescription>Issues by browser</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : deviceStats.browserData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No browser data available
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="panel-browser-stats">
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceStats.browserData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {deviceStats.browserData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {deviceStats.browserData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: pieColors[index % pieColors.length] }}
                              />
                              <span>{item.name}</span>
                            </div>
                            <Badge variant="secondary">{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Top Platforms
                  </CardTitle>
                  <CardDescription>Issues by device/OS</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : deviceStats.platformData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No platform data available
                    </div>
                  ) : (
                    <div className="space-y-4" data-testid="panel-platform-stats">
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={deviceStats.platformData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {deviceStats.platformData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {deviceStats.platformData.map((item, index) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: pieColors[index % pieColors.length] }}
                              />
                              <span className="flex items-center gap-1">
                                {item.name === "iOS" || item.name === "Android" ? (
                                  <Smartphone className="h-4 w-4" />
                                ) : (
                                  <Monitor className="h-4 w-4" />
                                )}
                                {item.name}
                              </span>
                            </div>
                            <Badge variant="secondary">{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ux-insights" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  UX Friction Points
                </h2>
                <p className="text-sm text-muted-foreground">
                  Detected usability issues from user behavior patterns
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchBehavior()}
                  data-testid="button-refresh-ux"
                >
                  <RefreshCw className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => analyzeUXMutation.mutate()}
                  disabled={analyzeUXMutation.isPending}
                  data-testid="button-analyze-ux"
                  data-expected-slow="true"
                >
                  {analyzeUXMutation.isPending ? (
                    <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 sm:mr-2" />
                  )}
                  <span>Analyze UX with AI</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(frictionTypeConfig).map(([type, config]) => {
                const count = frictionPointsData[type]?.length || 0;
                const Icon = config.icon;
                return (
                  <Card key={type} className={cn(config.bgColor, "border-0")}>
                    <CardHeader className="pb-2">
                      <CardDescription className="flex items-center gap-1">
                        <Icon className={cn("h-4 w-4", config.color)} />
                        {config.label}
                      </CardDescription>
                      <CardTitle className="text-2xl" data-testid={`text-count-${type}`}>
                        {count}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>

            {analyzeUXMutation.data && (
              <Card className="border-2 border-yellow-200 dark:border-yellow-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                      <CardTitle>AI UX Analysis</CardTitle>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (analyzeUXMutation.data?.analysis) {
                          navigator.clipboard.writeText(analyzeUXMutation.data.analysis);
                          toast({ title: "Copied to clipboard" });
                        }
                      }}
                      data-testid="button-copy-ux-analysis"
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <CardDescription>
                    Analyzed {analyzeUXMutation.data.eventCount} behavior events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg"
                    data-testid="text-ux-ai-analysis"
                  >
                    {analyzeUXMutation.data.analysis}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-red-500" />
                    Page Heat Map
                  </CardTitle>
                  <CardDescription>Pages ranked by issue count</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBehavior ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : pageHeatMapData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No UX issues detected yet.</p>
                      <p className="text-xs mt-2">Behavior tracking will capture user friction points automatically.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2" data-testid="panel-heat-map">
                        {pageHeatMapData.map((page, idx) => {
                          const maxCount = pageHeatMapData[0]?.issueCount || 1;
                          const topElements = Object.entries(page.elements)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 3);
                          
                          return (
                            <div
                              key={page.url}
                              className={cn(
                                "p-3 rounded-lg transition-colors",
                                getHeatColor(page.issueCount, maxCount)
                              )}
                              data-testid={`heat-page-${idx}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate" title={page.url}>
                                    {page.url.replace(/^https?:\/\/[^/]+/, '') || '/'}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(page.byType).map(([type, count]) => (
                                      <Badge key={type} variant="outline" className="text-xs bg-white/50 dark:bg-black/30">
                                        {frictionTypeConfig[type as keyof typeof frictionTypeConfig]?.label || type}: {count}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <Badge className="flex-shrink-0 bg-white/70 dark:bg-black/50 text-foreground">
                                  {page.issueCount}
                                </Badge>
                              </div>
                              {topElements.length > 0 && (
                                <div className="mt-2 pl-2 border-l-2 border-white/30 dark:border-black/30">
                                  <p className="text-xs font-medium mb-1 opacity-80">Top Elements:</p>
                                  {topElements.map(([selector, count]) => (
                                    <p key={selector} className="text-xs opacity-70 truncate" title={selector}>
                                      {selector} ({count})
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Friction Points by Type</CardTitle>
                  <CardDescription>Recent UX issues grouped by category</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingBehavior ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : behaviorEvents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MousePointerClick className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No friction points recorded yet.</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-4" data-testid="panel-friction-points">
                        {Object.entries(frictionTypeConfig).map(([type, config]) => {
                          const events = frictionPointsData[type] || [];
                          const Icon = config.icon;
                          
                          if (events.length === 0) return null;
                          
                          return (
                            <Collapsible key={type} defaultOpen={events.length > 0 && events.length < 10}>
                              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 p-2 rounded-lg">
                                <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                                <Icon className={cn("h-4 w-4", config.color)} />
                                <span className="font-medium text-sm">{config.label}</span>
                                <Badge variant="secondary" className="ml-auto">{events.length}</Badge>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className={cn("mt-2 p-3 rounded-lg", config.bgColor)}>
                                  <p className="text-xs text-muted-foreground mb-2">{config.description}</p>
                                  <div className="space-y-2">
                                    {events.slice(0, 5).map((event) => (
                                      <div
                                        key={event.id}
                                        className="text-xs p-2 bg-background/50 rounded"
                                        data-testid={`behavior-event-${event.id}`}
                                      >
                                        <p className="font-medium truncate" title={event.elementSelector || undefined}>
                                          {event.elementSelector || "Unknown element"}
                                        </p>
                                        <p className="text-muted-foreground truncate" title={event.pageUrl || undefined}>
                                          {event.pageUrl?.replace(/^https?:\/\/[^/]+/, '') || "Unknown page"}
                                        </p>
                                        <p className="text-muted-foreground">
                                          {new Date(event.createdAt).toLocaleString()}
                                        </p>
                                      </div>
                                    ))}
                                    {events.length > 5 && (
                                      <p className="text-xs text-muted-foreground text-center">
                                        +{events.length - 5} more events
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>AI Analysis</CardTitle>
                    <CardDescription>
                      {analyzeMutation.data
                        ? `Analyzed ${analyzeMutation.data.eventCount} events`
                        : "Click 'Analyze with AI' to generate insights"}
                    </CardDescription>
                  </div>
                  {analyzeMutation.data?.analysis && (
                    <Button variant="outline" size="sm" onClick={copyAnalysis} data-testid="button-copy-analysis">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {analyzeMutation.isPending ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Analyzing events...</span>
                  </div>
                ) : analyzeMutation.data?.analysis ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <div
                      className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-lg"
                      data-testid="text-ai-analysis"
                    >
                      {analyzeMutation.data.analysis}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No analysis yet. Click the button above to analyze recent events.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Event</DialogTitle>
            <DialogDescription>
              Add resolution notes to document how this issue was addressed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {eventToResolve && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{eventToResolve.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {eventToResolve.eventType} • {eventToResolve.severity}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">Resolution Notes (optional)</Label>
              <Textarea
                id="resolution-notes"
                placeholder="Describe how this issue was resolved..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
                data-testid="input-resolution-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmResolve} 
              disabled={updateEventMutation.isPending}
              data-testid="button-confirm-resolve"
            >
              {updateEventMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
