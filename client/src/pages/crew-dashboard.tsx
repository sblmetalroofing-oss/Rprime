import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  MapPin, 
  Clock, 
  Play, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw,
  Wifi,
  WifiOff,
  ClipboardList,
  Shield,
  Wrench,
  Check,
  X,
  ExternalLink,
  HardHat,
  Calendar,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateWithDay, getTodayInput } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import * as api from "@/lib/api";
import type { Job, CrewChecklist, ChecklistItem } from "@shared/schema";

const statusColors: Record<string, string> = {
  intake: "bg-slate-500",
  quoted: "bg-purple-500",
  deposit_received: "bg-blue-500",
  check_measure: "bg-cyan-500",
  make_orders: "bg-amber-500",
  orders_placed: "bg-indigo-500",
  in_progress: "bg-yellow-500",
  qc: "bg-teal-500",
  qc_complete: "bg-emerald-500",
  closed: "bg-green-500",
  cancelled: "bg-gray-500",
  on_hold: "bg-orange-500"
};

const statusLabels: Record<string, string> = {
  intake: "Intake",
  quoted: "Quoted",
  deposit_received: "Approved to Proceed",
  check_measure: "Check Measure",
  make_orders: "Make Orders",
  orders_placed: "Orders Placed",
  in_progress: "In Progress",
  qc: "QC",
  qc_complete: "QC Complete",
  closed: "Closed",
  cancelled: "Cancelled",
  on_hold: "On Hold"
};

function JobCard({ 
  job, 
  onTap, 
  onStatusChange,
  isUpdating
}: { 
  job: Job & { checklistProgress?: { completed: number; total: number } };
  onTap: () => void;
  onStatusChange: (status: string) => void;
  isUpdating: boolean;
}) {
  const openInMaps = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = encodeURIComponent(`${job.address}${job.suburb ? `, ${job.suburb}` : ''}`);
    window.open(`https://maps.google.com/?q=${address}`, '_blank');
  };

  const getNextAction = () => {
    switch (job.status) {
      case 'intake':
      case 'quoted':
      case 'deposit_received':
      case 'check_measure':
      case 'make_orders':
      case 'orders_placed':
        return { label: 'Start Job', status: 'in_progress', icon: Play, color: 'bg-yellow-500 hover:bg-yellow-600' };
      case 'in_progress':
        return { label: 'QC', status: 'qc', icon: CheckCircle2, color: 'bg-teal-500 hover:bg-teal-600' };
      case 'qc':
        return { label: 'QC Complete', status: 'qc_complete', icon: CheckCircle2, color: 'bg-emerald-500 hover:bg-emerald-600' };
      case 'qc_complete':
        return { label: 'Close Job', status: 'closed', icon: CheckCircle2, color: 'bg-green-500 hover:bg-green-600' };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const progress = job.checklistProgress;

  return (
    <Card 
      className="w-full cursor-pointer active:scale-[0.98] transition-transform touch-manipulation"
      onClick={onTap}
      data-testid={`card-job-${job.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {job.scheduledTime && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{job.scheduledTime}</span>
                </div>
              )}
              <Badge className={cn("text-white text-xs", statusColors[job.status])}>
                {statusLabels[job.status]}
              </Badge>
            </div>
            <h3 className="font-semibold text-base truncate" data-testid={`text-job-title-${job.id}`}>
              {job.title}
            </h3>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>

        <button
          onClick={openInMaps}
          className="flex items-start gap-2 text-sm text-muted-foreground hover:text-primary mb-3 w-full text-left"
          data-testid={`button-maps-${job.id}`}
        >
          <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-2">
            {job.address}{job.suburb ? `, ${job.suburb}` : ''}
          </span>
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        </button>

        {progress && progress.total > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" />
                Checklists
              </span>
              <span>{progress.completed} of {progress.total} complete</span>
            </div>
            <Progress value={(progress.completed / progress.total) * 100} className="h-2" />
          </div>
        )}

        {nextAction && (
          <Button
            className={cn("w-full h-12 text-base font-semibold text-white", nextAction.color)}
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange(nextAction.status);
            }}
            disabled={isUpdating}
            data-testid={`button-status-${job.id}`}
          >
            <nextAction.icon className="h-5 w-5 mr-2" />
            {nextAction.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistRunner({ 
  checklist, 
  onClose, 
  onItemCheck, 
  onComplete,
  userName
}: { 
  checklist: api.CrewChecklistWithItems;
  onClose: () => void;
  onItemCheck: (itemId: string, notes?: string) => void;
  onComplete: () => void;
  userName: string;
}) {
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const completedCount = checklist.items.filter(item => item.isChecked === 'true').length;
  const totalCount = checklist.items.length;
  const allComplete = completedCount === totalCount && totalCount > 0;
  const isAlreadyComplete = checklist.isCompleted === 'true';

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'safety':
        return <Shield className="h-5 w-5 text-orange-500" />;
      case 'work':
        return <Wrench className="h-5 w-5 text-blue-500" />;
      default:
        return <ClipboardList className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 mb-2">
          {getTypeIcon(checklist.type)}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{checklist.name}</h3>
            <p className="text-sm text-muted-foreground capitalize">{checklist.type} Checklist</p>
          </div>
          {isAlreadyComplete && (
            <Badge className="bg-green-500 text-white">Completed</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Progress value={(completedCount / totalCount) * 100} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {completedCount} / {totalCount}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {checklist.items.map((item, index) => {
          const isChecked = item.isChecked === 'true';
          const isExpanded = expandedItem === item.id;

          return (
            <Card 
              key={item.id} 
              className={cn(
                "transition-all",
                isChecked && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              )}
            >
              <CardContent className="p-4">
                <div 
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => !isChecked && !isAlreadyComplete && setExpandedItem(isExpanded ? null : item.id)}
                >
                  <div 
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 mt-0.5",
                      isChecked 
                        ? "bg-green-500 border-green-500 text-white" 
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isChecked ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">{index + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium",
                      isChecked && "line-through text-muted-foreground"
                    )}>
                      {item.description}
                    </p>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Note: {item.notes}
                      </p>
                    )}
                    {isChecked && item.checkedBy && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ✓ Checked by {item.checkedBy}
                      </p>
                    )}
                  </div>
                </div>

                {isExpanded && !isChecked && !isAlreadyComplete && (
                  <div className="mt-4 pl-11 space-y-3">
                    <Textarea
                      placeholder="Add notes (optional)"
                      value={itemNotes[item.id] || ''}
                      onChange={(e) => setItemNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="min-h-[80px]"
                    />
                    <Button
                      className="w-full h-12 bg-green-500 hover:bg-green-600 text-white text-base font-semibold"
                      onClick={() => {
                        onItemCheck(item.id, itemNotes[item.id]);
                        setExpandedItem(null);
                      }}
                      data-testid={`button-check-item-${item.id}`}
                    >
                      <Check className="h-5 w-5 mr-2" />
                      Mark Complete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="p-4 border-t bg-background">
        {!isAlreadyComplete && allComplete && (
          <Button
            className="w-full h-14 bg-green-500 hover:bg-green-600 text-white text-lg font-bold"
            onClick={onComplete}
            data-testid="button-complete-checklist"
          >
            <CheckCircle2 className="h-6 w-6 mr-2" />
            Complete Checklist
          </Button>
        )}
        {!isAlreadyComplete && !allComplete && (
          <p className="text-center text-muted-foreground text-sm">
            Complete all items to finish this checklist
          </p>
        )}
        {isAlreadyComplete && (
          <p className="text-center text-green-600 dark:text-green-400 font-medium">
            ✓ Checklist completed by {checklist.completedBy}
          </p>
        )}
      </div>
    </div>
  );
}

function JobDetailSheet({ 
  job, 
  isOpen, 
  onClose 
}: { 
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedChecklist, setSelectedChecklist] = useState<api.CrewChecklistWithItems | null>(null);

  const { data: customer } = useQuery({
    queryKey: ['customer', job?.customerId],
    queryFn: () => job?.customerId ? api.fetchCustomer(job.customerId) : Promise.resolve(null),
    enabled: !!job?.customerId && isOpen
  });

  const { data: checklists = [], isLoading: checklistsLoading } = useQuery({
    queryKey: ['jobChecklists', job?.id],
    queryFn: () => job ? api.getJobChecklists(job.id) : Promise.resolve([]),
    enabled: !!job && isOpen
  });

  const { data: checklistDetails } = useQuery({
    queryKey: ['checklist', selectedChecklist?.id],
    queryFn: () => selectedChecklist ? api.getChecklist(selectedChecklist.id) : Promise.resolve(null),
    enabled: !!selectedChecklist
  });

  const checkItemMutation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: string; notes?: string }) => 
      api.checkChecklistItem(itemId, user?.firstName || 'Crew', notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', selectedChecklist?.id] });
      queryClient.invalidateQueries({ queryKey: ['jobChecklists', job?.id] });
      toast({ title: "Item marked complete" });
    },
    onError: () => {
      toast({ title: "Failed to update item", variant: "destructive" });
    }
  });

  const completeChecklistMutation = useMutation({
    mutationFn: () => api.completeChecklist(selectedChecklist!.id, user?.firstName || 'Crew'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', selectedChecklist?.id] });
      queryClient.invalidateQueries({ queryKey: ['jobChecklists', job?.id] });
      queryClient.invalidateQueries({ queryKey: ['crewSchedule'] });
      toast({ title: "Checklist completed!" });
      setSelectedChecklist(null);
    },
    onError: () => {
      toast({ title: "Failed to complete checklist", variant: "destructive" });
    }
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'safety':
        return <Shield className="h-5 w-5 text-orange-500" />;
      case 'work':
        return <Wrench className="h-5 w-5 text-blue-500" />;
      default:
        return <ClipboardList className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!job) return null;

  return (
    <>
      <Sheet open={isOpen && !selectedChecklist} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-left">{job.title}</SheetTitle>
              <button
                onClick={() => {
                  onClose();
                  setLocation(`/jobs/${job.id}`);
                }}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium px-3 py-2 min-h-[44px] flex items-center gap-1"
                data-testid="button-view-job"
              >
                View Job
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{job.address}{job.suburb ? `, ${job.suburb}` : ''}</span>
            </div>
            {customer && (
              <button
                onClick={() => {
                  onClose();
                  setLocation(`/customer/${customer.id}`);
                }}
                className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700 font-medium min-h-[44px]"
                data-testid="button-view-customer"
              >
                <User className="h-4 w-4" />
                <span>{customer.name}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </SheetHeader>

          <div className="p-4 space-y-4 overflow-auto h-[calc(100%-80px)]">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Checklists
              </h4>
              {checklistsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : checklists.length === 0 ? (
                <Card className="p-6 text-center text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No checklists assigned to this job</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {checklists.map((checklist) => {
                    const isComplete = checklist.isCompleted === 'true';
                    return (
                      <Card 
                        key={checklist.id}
                        className={cn(
                          "cursor-pointer active:scale-[0.98] transition-transform",
                          isComplete && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
                        )}
                        onClick={() => setSelectedChecklist(checklist as api.CrewChecklistWithItems)}
                        data-testid={`card-checklist-${checklist.id}`}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          {getTypeIcon(checklist.type)}
                          <div className="flex-1">
                            <p className="font-medium">{checklist.name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{checklist.type}</p>
                          </div>
                          {isComplete ? (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {job.description && (
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-muted-foreground">{job.description}</p>
              </div>
            )}

            {job.notes && (
              <div>
                <h4 className="font-semibold mb-2">Notes</h4>
                <p className="text-muted-foreground">{job.notes}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!selectedChecklist} onOpenChange={() => setSelectedChecklist(null)}>
        <DialogContent className="max-w-lg h-[90vh] p-0 flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedChecklist?.name || 'Checklist'}</DialogTitle>
          </DialogHeader>
          {checklistDetails && (
            <ChecklistRunner
              checklist={checklistDetails}
              onClose={() => setSelectedChecklist(null)}
              onItemCheck={(itemId, notes) => checkItemMutation.mutate({ itemId, notes })}
              onComplete={() => completeChecklistMutation.mutate()}
              userName={user?.firstName || 'Crew'}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function CrewDashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = getTodayInput();
  const displayDate = formatDateWithDay(new Date());

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['crewSchedule', today],
    queryFn: () => api.getCrewSchedule(today),
    refetchOnWindowFocus: true
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateJob(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['crewSchedule', today] });
      const previousJobs = queryClient.getQueryData(['crewSchedule', today]);
      queryClient.setQueryData(['crewSchedule', today], (old: Job[] | undefined) => 
        old?.map(job => job.id === id ? { ...job, status } : job) || []
      );
      return { previousJobs };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['crewSchedule', today], context?.previousJobs);
      toast({ title: "Failed to update status", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['crewSchedule', today] });
    },
    onSuccess: () => {
      toast({ title: "Job status updated" });
    }
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  useState(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  const activeJobs = jobs.filter(job => job.status !== 'closed' && job.status !== 'qc_complete' && job.status !== 'cancelled');
  const completedJobs = jobs.filter(job => job.status === 'closed' || job.status === 'qc_complete');

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-10 bg-background border-b pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between pb-4 px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <HardHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold" data-testid="text-crew-title">Crew Dashboard</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {displayDate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full",
              isOnline ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
            )}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Today's Jobs ({activeJobs.length})
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : activeJobs.length === 0 ? (
            <Card className="p-8 text-center mt-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <h3 className="font-semibold text-lg mb-1">All done!</h3>
              <p className="text-muted-foreground">No more jobs scheduled for today</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onTap={() => setSelectedJob(job)}
                  onStatusChange={(status) => updateStatusMutation.mutate({ id: job.id, status })}
                  isUpdating={updateStatusMutation.isPending && updateStatusMutation.variables?.id === job.id}
                />
              ))}
            </div>
          )}
        </section>

        {completedJobs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Completed Today ({completedJobs.length})
            </h2>
            <div className="space-y-3">
              {completedJobs.map((job) => (
                <Card key={job.id} className="opacity-60">
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{job.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{job.address}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      <JobDetailSheet 
        job={selectedJob}
        isOpen={!!selectedJob}
        onClose={() => setSelectedJob(null)}
      />
    </div>
  );
}
