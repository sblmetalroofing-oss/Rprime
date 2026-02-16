import { useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  ChevronRight,
  DollarSign,
  AlertTriangle,
  ClipboardList,
  Receipt,
  Package,
  Briefcase,
  FileText,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Play,
  Activity,
  Image,
  MessageSquare,
  Settings2,
  RotateCcw,
  ClipboardCheck,
  Ruler,
  CircleDollarSign,
  Lock,
  Inbox,
  ArrowRight,
  History,
  Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "wouter";
import * as api from "@/lib/api";
import type { Appointment, InsertJob } from "@shared/schema";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isToday, isTomorrow, differenceInDays, parseISO, addDays, formatDistanceToNow, isValid } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { DashboardWidget } from "@/lib/api";
import { useRecentItems } from "@/hooks/use-recent-items";

// Default widget configuration
const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'workflow_pipeline', name: 'Workflow Pipeline', visible: true, order: 0 },
  { id: 'financial_snapshot', name: 'Financial Snapshot', visible: true, order: 1 },
  { id: 'todays_schedule', name: "Today's Schedule", visible: true, order: 2 },
  { id: 'needs_attention', name: 'Needs Attention', visible: true, order: 3 },
  { id: 'recently_viewed', name: 'Recently Viewed', visible: true, order: 4 },
  { id: 'recent_activity', name: 'Recent Activity', visible: true, order: 5 },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { isAdmin, canViewFinancials } = usePermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { recentItems } = useRecentItems();
  
  // Fetch user's widget preferences
  const { data: savedWidgets } = useQuery({
    queryKey: ['/api/dashboard-widgets'],
    queryFn: api.fetchDashboardWidgets
  });
  
  // Use saved widgets merged with defaults (ensures new widgets appear even if not in saved config)
  const widgets = useMemo(() => {
    if (savedWidgets && Array.isArray(savedWidgets) && savedWidgets.length > 0) {
      const savedIds = new Set(savedWidgets.map(w => w.id));
      const newWidgets = DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id));
      if (newWidgets.length > 0) {
        const orders = savedWidgets.map(w => w.order ?? 0);
        const maxOrder = orders.length > 0 ? Math.max(...orders) : -1;
        const newWidgetsWithOrder = newWidgets.map((w, i) => ({ ...w, order: maxOrder + 1 + i }));
        return [...savedWidgets, ...newWidgetsWithOrder].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
      return savedWidgets.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return DEFAULT_WIDGETS;
  }, [savedWidgets]);
  
  // Mutation to save widget preferences
  const saveWidgetsMutation = useMutation({
    mutationFn: api.saveDashboardWidgets,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard-widgets'] });
      toast({ title: "Dashboard layout saved" });
    },
    onError: () => {
      toast({ title: "Failed to save layout", variant: "destructive" });
    }
  });
  
  const toggleWidgetVisibility = (widgetId: string) => {
    const newWidgets = widgets.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    saveWidgetsMutation.mutate(newWidgets);
  };
  
  const moveWidget = (widgetId: string, direction: 'up' | 'down') => {
    const currentIndex = widgets.findIndex(w => w.id === widgetId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;
    
    const newWidgets = [...widgets];
    [newWidgets[currentIndex], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[currentIndex]];
    
    // Update order values
    const reorderedWidgets = newWidgets.map((w, index) => ({ ...w, order: index }));
    saveWidgetsMutation.mutate(reorderedWidgets);
  };
  
  const resetToDefaults = () => {
    saveWidgetsMutation.mutate(DEFAULT_WIDGETS);
  };
  
  // Get ordered list of visible widgets
  const getVisibleWidgets = useMemo(() => {
    return widgets.filter(w => w.visible).sort((a, b) => a.order - b.order);
  }, [widgets]);
  
  const { data: crewMembers } = useQuery({
    queryKey: ['/api/crew-members'],
    queryFn: api.fetchCrewMembers
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: string }) => 
      api.updateJob(jobId, { status } as Partial<InsertJob>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  });
  
  const hasNoCrewMembers = !crewMembers || crewMembers.length === 0;
  const showFinancials = isAdmin || canViewFinancials || hasNoCrewMembers;

  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: api.fetchJobs
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: api.fetchQuotes
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['/api/invoices'],
    queryFn: api.fetchInvoices
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['/api/purchase-orders'],
    queryFn: api.fetchPurchaseOrders
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['/api/reports'],
    queryFn: api.fetchReports
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => api.fetchCustomers()
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ['/api/activities/recent'],
    queryFn: api.fetchRecentActivities
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: api.fetchAppointments
  });

  const financialStats = useMemo(() => {
    const totalQuoted = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
    const totalOutstanding = invoices
      .filter(i => ['sent', 'overdue', 'partial'].includes(i.status))
      .reduce((sum, i) => sum + ((i.total || 0) - (i.amountPaid || 0)), 0);
    const totalCosts = purchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
    const profit = totalPaid - totalCosts;
    const profitMargin = totalPaid > 0 ? (profit / totalPaid) * 100 : 0;

    return {
      totalQuoted,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      totalCosts,
      profit,
      profitMargin
    };
  }, [quotes, invoices, purchaseOrders]);

  const todaysJobs = useMemo(() => {
    const today = new Date();
    return jobs.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDate = parseISO(job.scheduledDate);
      return isToday(jobDate);
    }).sort((a, b) => {
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      return 0;
    });
  }, [jobs]);

  const tomorrowsJobs = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledDate) return false;
      const jobDate = parseISO(job.scheduledDate);
      return isTomorrow(jobDate);
    }).length;
  }, [jobs]);

  // Combined today's schedule: jobs + appointments
  type ScheduleItem = 
    | { type: 'job'; time: string | null; data: typeof jobs[0] }
    | { type: 'appointment'; time: string | null; data: Appointment };

  const todaysSchedule = useMemo(() => {
    const items: ScheduleItem[] = [];
    
    // Add today's jobs
    todaysJobs.forEach(job => {
      items.push({ type: 'job', time: job.scheduledTime || null, data: job });
    });
    
    // Add today's appointments
    appointments.forEach(appt => {
      if (!appt.scheduledDate) return;
      try {
        const apptDate = parseISO(appt.scheduledDate);
        if (isToday(apptDate)) {
          items.push({ type: 'appointment', time: appt.scheduledTime || null, data: appt });
        }
      } catch {
        // Skip invalid dates
      }
    });
    
    // Sort by time (null/no time goes first as "All Day")
    return items.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return -1;
      if (!b.time) return 1;
      return a.time.localeCompare(b.time);
    });
  }, [todaysJobs, appointments]);

  const actionItems = useMemo(() => {
    const items: { type: string; title: string; subtitle: string; priority: 'high' | 'medium' | 'low'; link: string; icon: LucideIcon }[] = [];

    invoices.filter(i => i.status === 'overdue').forEach(inv => {
      items.push({
        type: 'overdue_invoice',
        title: `Invoice #${inv.invoiceNumber} overdue`,
        subtitle: inv.customerName || 'Unknown customer',
        priority: 'high',
        link: '/invoices',
        icon: AlertCircle
      });
    });

    const jobIdsWithAppointments = new Set(appointments.filter(a => a.jobId).map(a => a.jobId));
    jobs.filter(j => {
      if (j.scheduledDate) return false;
      if (jobIdsWithAppointments.has(j.id)) return false;
      const status = (j.status || '').toLowerCase().trim();
      const excludedStatuses = ['closed', 'qc_complete', 'cancelled', 'canceled', 'archived'];
      return !excludedStatuses.includes(status);
    }).slice(0, 3).forEach(job => {
      const jobNum = job.referenceNumber ? `${job.referenceNumber} · ` : '';
      items.push({
        type: 'unscheduled_job',
        title: `${jobNum}${job.title || 'Untitled job'}`,
        subtitle: 'No scheduled date',
        priority: 'medium',
        link: `/jobs/${job.id}`,
        icon: CalendarClock
      });
    });

    reports.filter(r => r.status === 'draft').slice(0, 3).forEach(report => {
      items.push({
        type: 'draft_report',
        title: report.customerName || 'Draft report',
        subtitle: 'Needs completion',
        priority: 'low',
        link: `/report/${report.id}`,
        icon: FileText
      });
    });

    return items.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }).slice(0, 6);
  }, [invoices, jobs, reports, appointments]);

  const getNextStatusAction = (currentStatus: string): { label: string; status: string; icon: LucideIcon; color: string } | null => {
    switch (currentStatus) {
      case 'intake':
        return { label: 'Quote Sent', status: 'quoted', icon: FileText, color: 'bg-purple-500 hover:bg-purple-600' };
      case 'quoted':
        return { label: 'Approved', status: 'deposit_received', icon: CircleDollarSign, color: 'bg-blue-500 hover:bg-blue-600' };
      case 'deposit_received':
        return { label: 'Check Measure', status: 'check_measure', icon: Ruler, color: 'bg-cyan-500 hover:bg-cyan-600' };
      case 'check_measure':
        return { label: 'Make Orders', status: 'make_orders', icon: Package, color: 'bg-amber-500 hover:bg-amber-600' };
      case 'make_orders':
        return { label: 'Orders Placed', status: 'orders_placed', icon: Package, color: 'bg-indigo-500 hover:bg-indigo-600' };
      case 'orders_placed':
        return { label: 'Start Work', status: 'in_progress', icon: Play, color: 'bg-yellow-500 hover:bg-yellow-600' };
      case 'in_progress':
        return { label: 'QC', status: 'qc', icon: ClipboardCheck, color: 'bg-teal-500 hover:bg-teal-600' };
      case 'qc':
        return { label: 'QC Complete', status: 'qc_complete', icon: ClipboardCheck, color: 'bg-emerald-500 hover:bg-emerald-600' };
      case 'qc_complete':
        return { label: 'Close Job', status: 'closed', icon: Lock, color: 'bg-green-500 hover:bg-green-600' };
      case 'closed':
        return null;
      case 'on_hold':
        return { label: 'Resume', status: 'in_progress', icon: Play, color: 'bg-yellow-500 hover:bg-yellow-600' };
      case 'cancelled':
        return { label: 'Reopen', status: 'intake', icon: Inbox, color: 'bg-slate-500 hover:bg-slate-600' };
      default:
        return { label: 'Next Step', status: 'intake', icon: ArrowRight, color: 'bg-slate-500 hover:bg-slate-600' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'intake': return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300';
      case 'quoted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'deposit_received': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'check_measure': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'make_orders': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'orders_placed': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'in_progress': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'qc': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
      case 'qc_complete': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'closed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {user?.firstName ? `Welcome back, ${user.firstName}.` : 'Welcome back.'} Here's your business at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-customize-dashboard">
                <Settings2 className="h-4 w-4 mr-2" />
                Customize
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Customize Dashboard</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Toggle widgets on/off and reorder them to customize your dashboard view.
                </p>
                <div className="space-y-2">
                  {widgets.map((widget, index) => (
                    <div 
                      key={widget.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveWidget(widget.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                            data-testid={`move-up-${widget.id}`}
                          >
                            <ChevronRight className="h-3 w-3 -rotate-90" />
                          </button>
                          <button
                            onClick={() => moveWidget(widget.id, 'down')}
                            disabled={index === widgets.length - 1}
                            className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
                            data-testid={`move-down-${widget.id}`}
                          >
                            <ChevronRight className="h-3 w-3 rotate-90" />
                          </button>
                        </div>
                        <span className="font-medium text-sm">{widget.name}</span>
                      </div>
                      <Switch
                        checked={widget.visible}
                        onCheckedChange={() => toggleWidgetVisibility(widget.id)}
                        data-testid={`toggle-${widget.id}`}
                      />
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={resetToDefaults}
                  className="w-full mt-4"
                  data-testid="button-reset-widgets"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/jobs">
            <Button data-testid="button-view-jobs">
              <Briefcase className="mr-2 h-4 w-4" />
              View Jobs
            </Button>
          </Link>
        </div>
      </div>

      {/* Full-width widgets (Pipeline + Financials) */}
      <div className="space-y-6">
        {getVisibleWidgets.filter(w => ['workflow_pipeline', 'financial_snapshot'].includes(w.id)).map(widget => {
          const renderWidget = renderWidgetContent(widget);
          return renderWidget;
        })}
      </div>

      {/* Two-column grid for remaining widgets on large screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 mt-6">
        {getVisibleWidgets.filter(w => !['workflow_pipeline', 'financial_snapshot'].includes(w.id)).map(widget => {
          const renderWidget = renderWidgetContent(widget);
          return renderWidget;
        })}
      </div>
    </Layout>
  );

  function renderWidgetContent(widget: DashboardWidget) {
        // Workflow Pipeline Widget
        if (widget.id === 'workflow_pipeline') {
          const workflowStages = [
            { key: 'intake', label: 'Intake', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', borderColor: 'border-slate-300 dark:border-slate-600' },
            { key: 'quoted', label: 'Quoted', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300', borderColor: 'border-purple-300 dark:border-purple-700' },
            { key: 'deposit_received', label: 'Approved to Proceed', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', borderColor: 'border-blue-300 dark:border-blue-700' },
            { key: 'check_measure', label: 'Check Measure', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300', borderColor: 'border-cyan-300 dark:border-cyan-700' },
            { key: 'make_orders', label: 'Make Orders', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', borderColor: 'border-amber-300 dark:border-amber-700' },
            { key: 'orders_placed', label: 'Orders Placed', color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300', borderColor: 'border-indigo-300 dark:border-indigo-700' },
            { key: 'in_progress', label: 'In Progress', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', borderColor: 'border-orange-300 dark:border-orange-700' },
            { key: 'qc', label: 'QC', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300', borderColor: 'border-teal-300 dark:border-teal-700' },
            { key: 'qc_complete', label: 'QC Complete', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', borderColor: 'border-emerald-300 dark:border-emerald-700' },
            { key: 'closed', label: 'Closed', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', borderColor: 'border-green-300 dark:border-green-700' },
          ];
          
          const stageCounts = workflowStages.map(stage => ({
            ...stage,
            count: jobs.filter(j => j.status === stage.key).length
          }));
          
          const activeJobs = jobs.filter(j => j.status !== 'closed').length;
          
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Workflow Pipeline
                  </CardTitle>
                  <span className="text-sm text-muted-foreground">{activeJobs} active jobs</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 xl:gap-2 overflow-x-auto pb-2">
                  {stageCounts.map((stage, index) => (
                    <div key={stage.key} className="flex items-center flex-1">
                      <Link href={`/jobs?status=${stage.key}`} className="flex-1">
                        <div 
                          className={`flex flex-col items-center justify-center min-w-[80px] sm:min-w-[100px] xl:min-w-0 p-2 sm:p-3 xl:p-4 rounded-lg border-2 ${stage.color} ${stage.borderColor} cursor-pointer hover:opacity-80 hover:scale-[1.02] transition-all group`}
                          data-testid={`pipeline-${stage.key}`}
                        >
                          <span className="text-lg sm:text-2xl xl:text-3xl font-bold group-hover:scale-105 transition-transform">{stage.count}</span>
                          <span className="text-[10px] sm:text-xs xl:text-sm text-center whitespace-nowrap">{stage.label}</span>
                        </div>
                      </Link>
                      {index < stageCounts.length - 1 && (
                        <ChevronRight className="h-4 w-4 xl:h-5 xl:w-5 text-muted-foreground mx-0.5 xl:mx-1 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // Financial Snapshot Widget
        if (widget.id === 'financial_snapshot') {
          if (!showFinancials) return null;
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Financial Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4 xl:gap-4">
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-purple-50 dark:bg-purple-950/20 hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Quoted</p>
                    <p className="text-sm sm:text-lg xl:text-2xl font-bold text-purple-600 group-hover:scale-105 transition-transform" data-testid="stat-quoted">
                      ${financialStats.totalQuoted.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Invoiced</p>
                    <p className="text-sm sm:text-lg xl:text-2xl font-bold text-blue-600 group-hover:scale-105 transition-transform" data-testid="stat-invoiced">
                      ${financialStats.totalInvoiced.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Paid</p>
                    <p className="text-sm sm:text-lg xl:text-2xl font-bold text-green-600 group-hover:scale-105 transition-transform" data-testid="stat-paid">
                      ${financialStats.totalPaid.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Outstanding</p>
                    <p className="text-sm sm:text-lg xl:text-2xl font-bold text-amber-600 group-hover:scale-105 transition-transform" data-testid="stat-outstanding">
                      ${financialStats.totalOutstanding.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Costs</p>
                    <p className="text-sm sm:text-lg xl:text-2xl font-bold text-red-600 group-hover:scale-105 transition-transform" data-testid="stat-costs">
                      ${financialStats.totalCosts.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Profit</p>
                    <p className={`text-sm sm:text-lg xl:text-2xl font-bold group-hover:scale-105 transition-transform ${financialStats.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} data-testid="stat-profit">
                      ${financialStats.profit.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-2 sm:p-3 xl:p-4 rounded-lg bg-slate-50 dark:bg-slate-950/20 hover:bg-slate-100 dark:hover:bg-slate-950/30 col-span-2 sm:col-span-1 transition-colors cursor-default group">
                    <p className="text-[10px] sm:text-xs xl:text-sm text-muted-foreground mb-1">Margin</p>
                    <p className={`text-sm sm:text-lg xl:text-2xl font-bold group-hover:scale-105 transition-transform ${financialStats.profitMargin >= 20 ? 'text-emerald-600' : financialStats.profitMargin >= 10 ? 'text-amber-600' : 'text-red-600'}`} data-testid="stat-margin">
                      {financialStats.profitMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        
        // Today's Schedule Widget
        if (widget.id === 'todays_schedule') {
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-blue-600" />
                    Today's Schedule
                  </CardTitle>
                  <Link href="/schedule">
                    <Button variant="ghost" size="sm" className="text-xs">
                      View Calendar
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {todaysSchedule.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nothing scheduled for today</p>
                    {tomorrowsJobs > 0 && (
                      <p className="text-xs mt-1">{tomorrowsJobs} job{tomorrowsJobs > 1 ? 's' : ''} scheduled for tomorrow</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todaysSchedule.slice(0, 6).map((item, idx) => {
                      if (item.type === 'job') {
                        const job = item.data;
                        const customer = customers.find(c => c.id === job.customerId);
                        const jobNumber = job.referenceNumber || `JOB-${job.id.slice(-4).toUpperCase()}`;
                        return (
                          <div 
                            key={`job-${job.id}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                            onClick={() => setLocation(`/jobs/${job.id}`)}
                            data-testid={`job-today-${job.id}`}
                          >
                            <div className="flex-shrink-0 w-14 text-center">
                              <span className="text-sm font-mono font-medium">
                                {item.time || 'All Day'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary text-sm">{jobNumber}</span>
                                <span className="text-muted-foreground text-xs">·</span>
                                <span className="font-medium text-sm truncate">{customer?.name || 'No customer'}</span>
                              </div>
                              {job.address && (
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {job.address}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const nextAction = getNextStatusAction(job.status);
                                if (nextAction) {
                                  const Icon = nextAction.icon;
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`h-8 px-3 text-xs ${nextAction.color} text-white border-0 active:scale-95 transition-transform`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateStatusMutation.mutate({ jobId: job.id, status: nextAction.status });
                                      }}
                                      data-testid={`button-next-${job.id}`}
                                    >
                                      <Icon className="h-3 w-3 mr-1" />
                                      {nextAction.label}
                                    </Button>
                                  );
                                }
                                return (
                                  <Badge className={`text-[10px] ${getStatusColor(job.status)}`}>
                                    {job.status?.replace('_', ' ')}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      } else {
                        const appt = item.data;
                        const linkedJob = appt.jobId ? jobs.find(j => j.id === appt.jobId) : null;
                        const linkedCustomer = linkedJob ? customers.find(c => c.id === linkedJob.customerId) : null;
                        const jobNumber = linkedJob ? (linkedJob.referenceNumber || `JOB-${linkedJob.id.slice(-4).toUpperCase()}`) : null;
                        const displayName = linkedJob 
                          ? (linkedCustomer?.name || linkedJob.title || 'No Customer')
                          : appt.title;
                        const address = linkedJob?.address || appt.location;
                        
                        return (
                          <div 
                            key={`appt-${appt.id}`}
                            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors border-l-4"
                            style={{ borderLeftColor: '#3b82f6' }}
                            onClick={() => linkedJob ? setLocation(`/jobs/${linkedJob.id}`) : setLocation('/schedule')}
                            data-testid={`appt-today-${appt.id}`}
                          >
                            <div className="flex-shrink-0 w-14 text-center">
                              <span className="text-sm font-mono font-medium">
                                {item.time || 'All Day'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {jobNumber && (
                                  <>
                                    <span className="font-semibold text-primary text-sm">{jobNumber}</span>
                                    <span className="text-muted-foreground text-xs">·</span>
                                  </>
                                )}
                                <span className="font-medium text-sm truncate">{displayName}</span>
                              </div>
                              {address && (
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {address}
                                </p>
                              )}
                              {appt.description && !address && (
                                <p className="text-xs text-muted-foreground truncate italic mt-0.5">
                                  {appt.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }
                    })}
                    {todaysSchedule.length > 6 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        +{todaysSchedule.length - 6} more today
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        }

        // Needs Attention Widget
        if (widget.id === 'needs_attention') {
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Needs Attention
                  {actionItems.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {actionItems.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {actionItems.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All caught up!</p>
                    <p className="text-xs mt-1">No urgent items need your attention</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {actionItems.map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setLocation(item.link)}
                        data-testid={`action-item-${idx}`}
                      >
                        <div className={`p-2 rounded-full flex-shrink-0 ${
                          item.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30' : 
                          item.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30' : 
                          'bg-gray-100 dark:bg-gray-900/30'
                        }`}>
                          <item.icon className={`h-4 w-4 ${
                            item.priority === 'high' ? 'text-red-600 dark:text-red-400' : 
                            item.priority === 'medium' ? 'text-amber-600 dark:text-amber-400' : 
                            'text-gray-600 dark:text-gray-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        }

        // Recently Viewed Widget
        if (widget.id === 'recently_viewed') {
          if (recentItems.length === 0) return null;
          
          const typeIcons: Record<string, { icon: LucideIcon; color: string }> = {
            job: { icon: Briefcase, color: "text-blue-600 dark:text-blue-400" },
            customer: { icon: Users, color: "text-green-600 dark:text-green-400" },
            quote: { icon: ClipboardList, color: "text-purple-600 dark:text-purple-400" },
            invoice: { icon: Receipt, color: "text-emerald-600 dark:text-emerald-400" },
            report: { icon: FileText, color: "text-amber-600 dark:text-amber-400" },
          };
          
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-600" />
                  Recently Viewed
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {recentItems.slice(0, 5).map((item) => {
                    const typeInfo = typeIcons[item.type] || { icon: FileText, color: "text-slate-600" };
                    const Icon = typeInfo.icon;
                    return (
                      <Link key={`${item.type}-${item.id}`} href={item.href}>
                        <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors" data-testid={`recent-item-${item.type}-${item.id}`}>
                          <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        }

        // Recent Activity Widget
        if (widget.id === 'recent_activity') {
          return (
            <Card key={widget.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivities.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Job updates, quotes, invoices and more will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentActivities.map((activity) => {
                      const hasAttachments = activity.attachments && activity.attachments.length > 0;
                      const isJobPhoto = hasAttachments && (activity.type === 'job_photo' || activity.type === 'job_note');
                      
                      const getThumbnailUrl = () => {
                        if (!hasAttachments) return null;
                        const first = activity.attachments![0];
                        if (typeof first === 'string') {
                          try {
                            const parsed = JSON.parse(first);
                            if (parsed.url) {
                              return parsed.url;
                            }
                            if (first.startsWith('/') || first.startsWith('http')) {
                              return first;
                            }
                            return null;
                          } catch {
                            if (first.startsWith('/') || first.startsWith('http')) {
                              return first;
                            }
                            return null;
                          }
                        }
                        if (first && typeof first === 'object' && 'url' in first) {
                          return (first as { url: string }).url;
                        }
                        return null;
                      };
                      const thumbnail = getThumbnailUrl();
                      
                      const getActivityIcon = () => {
                        switch (activity.type) {
                          case 'job_photo':
                            return <Image className="h-4 w-4 text-blue-600" />;
                          case 'job_note':
                            return <MessageSquare className="h-4 w-4 text-gray-600" />;
                          case 'quote_created':
                            return <FileText className="h-4 w-4 text-blue-600" />;
                          case 'quote_sent':
                            return <FileText className="h-4 w-4 text-amber-600" />;
                          case 'quote_accepted':
                            return <FileText className="h-4 w-4 text-green-600" />;
                          case 'quote_declined':
                            return <FileText className="h-4 w-4 text-red-600" />;
                          case 'invoice_created':
                            return <Receipt className="h-4 w-4 text-blue-600" />;
                          case 'invoice_sent':
                            return <Receipt className="h-4 w-4 text-amber-600" />;
                          case 'invoice_paid':
                            return <Receipt className="h-4 w-4 text-green-600" />;
                          case 'po_created':
                            return <Package className="h-4 w-4 text-purple-600" />;
                          case 'po_sent':
                            return <Package className="h-4 w-4 text-amber-600" />;
                          default:
                            return <Activity className="h-4 w-4 text-gray-600" />;
                        }
                      };
                      
                      const getActivityLink = () => {
                        if (activity.jobId) {
                          return `/jobs/${activity.jobId}?tab=activity`;
                        }
                        if (activity.documentId) {
                          if (activity.type.startsWith('quote_')) {
                            return `/quote/${activity.documentId}`;
                          }
                          if (activity.type.startsWith('invoice_')) {
                            return `/invoice/${activity.documentId}`;
                          }
                          if (activity.type.startsWith('po_')) {
                            return `/purchase-order/${activity.documentId}`;
                          }
                        }
                        return '/dashboard';
                      };
                      
                      if (isJobPhoto && thumbnail) {
                        return (
                          <div
                            key={activity.id}
                            className="flex gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => setLocation(getActivityLink())}
                            data-testid={`activity-${activity.id}`}
                          >
                            <div className="w-20 h-14 rounded overflow-hidden flex-shrink-0 bg-muted">
                              <img 
                                src={thumbnail} 
                                alt="" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {getActivityIcon()}
                                <span className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  {activity.address || 'Unknown address'}
                                </span>
                              </div>
                              <p className="text-sm font-medium truncate" title={activity.content}>
                                {activity.content || 'Photo uploaded'}
                              </p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
                                <span></span>
                                <span className="flex-shrink-0 ml-1">
                                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-muted-foreground flex-shrink-0 text-right">
                              {activity.createdByName && (
                                <div className="font-medium">{activity.createdByName}</div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <div
                          key={activity.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer"
                          onClick={() => setLocation(getActivityLink())}
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="p-2 rounded-full bg-muted flex-shrink-0">
                            {getActivityIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" title={activity.content}>
                              {activity.content}
                            </p>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              {activity.address ? (
                                <span className="truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3 flex-shrink-0" />
                                  {activity.address}
                                </span>
                              ) : activity.createdByName ? (
                                <span className="truncate">{activity.createdByName}</span>
                              ) : (
                                <span></span>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex-shrink-0 text-right">
                            {activity.createdByName && activity.address && (
                              <div className="font-medium">{activity.createdByName}</div>
                            )}
                            <div>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        }

        // Default return for unknown widget IDs
        return null;
  }
}
