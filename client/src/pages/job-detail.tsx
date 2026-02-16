import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MentionTextarea } from "@/components/mention-textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  User, 
  AlertCircle,
  FileText,
  Receipt,
  ShoppingCart,
  ClipboardList,
  Plus,
  ExternalLink,
  DollarSign,
  MessageSquare,
  History,
  Send,
  Trash2,
  Image,
  Paperclip,
  X,
  File,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Edit,
  ChevronDown,
  ChevronRight,
  Check,
  ChevronsUpDown,
  ArrowLeft,
  Phone,
  Navigation,
  Timer,
  Square,
  Mail,
  Camera,
  Inbox,
  CircleDollarSign,
  Ruler,
  Package,
  ClipboardCheck,
  Lock,
  TrendingUp,
  TrendingDown,
  Percent,
  FolderOpen
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { DraggablePhoto } from "@/hooks/use-photo-transfer.tsx";
import { useRecentItems } from "@/hooks/use-recent-items";
import * as api from "@/lib/api";
import type { JobWithDocuments, JobStatusHistory, JobActivity } from "@/lib/api";
import type { Job, Quote, Invoice, PurchaseOrder, CrewMember, Customer, Appointment, InsertAppointment } from "@shared/schema";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { formatDateShort } from "@/lib/date-utils";
import { MultiDatePicker } from "@/components/multi-date-picker";
import { JobActivityTab } from "./job-detail/JobActivityTab";
import { EditJobDialog, type EditJobFormData } from "./job-detail/EditJobDialog";
import { JobFilesTab } from "./job-detail/JobFilesTab";
import { JobOverviewTab } from "./job-detail/JobOverviewTab";

const statusColors: Record<string, string> = {
  intake: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  quoted: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  deposit_received: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  check_measure: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  make_orders: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  orders_placed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  qc: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  qc_complete: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  closed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  on_hold: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300",
};

function ScheduleTab({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: [`/api/jobs/${jobId}/appointments`],
    queryFn: () => api.fetchAppointmentsByJob(jobId)
  });

  const { data: crewMembers = [] } = useQuery<CrewMember[]>({
    queryKey: ['/api/crew-members'],
    queryFn: () => api.fetchCrewMembers()
  });

  const [assignedCrew, setAssignedCrew] = useState<string[]>([]);

  const createBatchMutation = useMutation({
    mutationFn: (appts: Omit<InsertAppointment, 'organizationId'>[]) => api.createBatchAppointments(appts as InsertAppointment[]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/appointments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      setSelectedDates([]);
      setAppointmentTitle("");
      setDescription("");
      setAssignedCrew([]);
      setIsAdding(false);
      toast({ title: `${selectedDates.length} date(s) scheduled` });
    },
    onError: () => {
      toast({ title: "Failed to schedule dates", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAppointment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/appointments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      toast({ title: "Scheduled date removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove date", variant: "destructive" });
    }
  });

  const handleAddDates = () => {
    if (selectedDates.length === 0) {
      toast({ title: "Please select at least one date", variant: "destructive" });
      return;
    }
    const title = appointmentTitle.trim() || jobTitle;
    const appts = selectedDates.map(date => ({
      title: title,
      description: description || `Scheduled work for ${title}`,
      scheduledDate: format(date, 'yyyy-MM-dd'),
      scheduledTime: startTime,
      endTime: endTime,
      jobId: jobId,
      assignedTo: assignedCrew.length > 0 ? assignedCrew : null
    }));
    createBatchMutation.mutate(appts);
  };

  const sortedAppointments = [...appointments].sort((a, b) => 
    new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Scheduled Dates</CardTitle>
          {!isAdding && (
            <Button onClick={() => setIsAdding(true)} size="sm" data-testid="button-add-schedule">
              <Plus className="h-4 w-4 mr-2" />
              Add Dates
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isAdding && (
            <div className="border rounded-lg p-4 mb-4 space-y-4 bg-muted/30">
              <div>
                <Label>Task Title</Label>
                <Input
                  value={appointmentTitle}
                  onChange={(e) => setAppointmentTitle(e.target.value)}
                  placeholder={`e.g., Installation, Crane Hire, Final Inspection (defaults to "${jobTitle}")`}
                  data-testid="input-appointment-title"
                />
              </div>
              <div>
                <Label>Select Work Dates</Label>
                <MultiDatePicker
                  selectedDates={selectedDates}
                  onDatesChange={setSelectedDates}
                  placeholder="Click to select dates"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input 
                    type="time" 
                    value={startTime} 
                    onChange={(e) => setStartTime(e.target.value)}
                    data-testid="input-start-time"
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input 
                    type="time" 
                    value={endTime} 
                    onChange={(e) => setEndTime(e.target.value)}
                    data-testid="input-end-time"
                  />
                </div>
              </div>
              <div>
                <Label>Assign Crew (optional)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {crewMembers.map(member => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => setAssignedCrew(prev => 
                        prev.includes(member.id) 
                          ? prev.filter(id => id !== member.id)
                          : [...prev, member.id]
                      )}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        assignedCrew.includes(member.id)
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                      data-testid={`assign-crew-${member.id}`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: member.color || '#3b82f6' }}
                      />
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Work Description (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work to be done..."
                  data-testid="input-schedule-notes"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setIsAdding(false); setSelectedDates([]); setAppointmentTitle(""); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddDates} 
                  disabled={selectedDates.length === 0 || createBatchMutation.isPending}
                  data-testid="button-save-schedule"
                >
                  {createBatchMutation.isPending ? "Saving..." : `Schedule ${selectedDates.length} Date${selectedDates.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading schedule...</div>
          ) : sortedAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No dates scheduled yet</p>
              {!isAdding && (
                <Button className="mt-4" onClick={() => setIsAdding(true)}>
                  Schedule First Date
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAppointments.map((appt) => {
                const apptDate = parseISO(appt.scheduledDate);
                const isPast = apptDate < new Date(new Date().setHours(0, 0, 0, 0));
                const isToday = format(apptDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const assignedNames = appt.assignedTo?.map(id => crewMembers.find(c => c.id === id)?.name).filter(Boolean);
                
                const handleNavigateToSchedule = () => {
                  const dateParam = format(apptDate, 'yyyy-MM-dd');
                  window.location.href = `/schedule?date=${dateParam}`;
                };

                return (
                  <div
                    key={appt.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50",
                      isPast && "opacity-50 bg-muted/50",
                      isToday && "border-primary bg-primary/5"
                    )}
                    onClick={handleNavigateToSchedule}
                    data-testid={`schedule-item-${appt.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex flex-col items-center justify-center text-center",
                        isToday ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <span className="text-xs font-medium">{format(apptDate, 'EEE')}</span>
                        <span className="text-lg font-bold leading-none">{format(apptDate, 'd')}</span>
                      </div>
                      <div>
                        <div className="font-medium">
                          {format(apptDate, 'MMMM d, yyyy')}
                          {isToday && <Badge className="ml-2 bg-primary">Today</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appt.scheduledTime && appt.endTime 
                            ? `${appt.scheduledTime} - ${appt.endTime}`
                            : appt.scheduledTime || 'All day'}
                          {assignedNames && assignedNames.length > 0 && (
                            <span className="ml-2">• {assignedNames.join(', ')}</span>
                          )}
                        </div>
                        {appt.description && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">Work: </span>{appt.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(appt.id); }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-schedule-${appt.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [data, setData] = useState<JobWithDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['overview', 'reports', 'quotes', 'invoices', 'purchase-orders', 'activity'].includes(tab)) {
        return tab;
      }
    }
    return "overview";
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [statusHistory, setStatusHistory] = useState<JobStatusHistory[]>([]);
  const [activities, setActivities] = useState<JobActivity[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{path: string; name: string; type: string}[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'text' | 'photos' | 'files'>('all');
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const { user: authUser } = useAuth();
  const { canDelete } = usePermissions();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    address: string;
    suburb: string;
    scheduledDate: string;
    scheduledTime: string;
    priority: string;
    assignedTo: string[];
    customerId: string | null;
    notes: string;
  }>({
    title: "",
    description: "",
    address: "",
    suburb: "",
    scheduledDate: "",
    scheduledTime: "",
    priority: "normal",
    assignedTo: [],
    customerId: null,
    notes: ""
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const mobileNoteInputRef = useRef<HTMLTextAreaElement>(null);
  const mobileActivitySectionRef = useRef<HTMLDivElement>(null);
  const [lightboxData, setLightboxData] = useState<{ images: { url: string; name: string }[]; currentIndex: number } | null>(null);
  const [fileViewerUrl, setFileViewerUrl] = useState<string | null>(null);
  const [gateWarning, setGateWarning] = useState<{ show: boolean; message: string; pendingStatus: string }>({ show: false, message: "", pendingStatus: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { addRecentItem } = useRecentItems();
  
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.updateJob(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      loadJobData();
      toast({ title: "Status updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: (data: Partial<Job>) => api.updateJob(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      loadJobData();
      toast({ title: "Job updated successfully" });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    }
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => api.deleteQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      loadJobData();
      toast({ title: "Quote deleted successfully" });
      setQuoteToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete quote", variant: "destructive" });
    }
  });

  const deletePOMutation = useMutation({
    mutationFn: (poId: string) => api.deletePurchaseOrder(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      loadJobData();
      toast({ title: "Purchase order deleted successfully" });
      setPoToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete purchase order", variant: "destructive" });
    }
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => api.deleteInvoice(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      loadJobData();
      toast({ title: "Invoice deleted successfully" });
      setInvoiceToDelete(null);
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    }
  });

  const openEditDialog = () => {
    if (data?.job) {
      setEditFormData({
        title: data.job.title || "",
        description: data.job.description || "",
        address: data.job.address || "",
        suburb: data.job.suburb || "",
        scheduledDate: data.job.scheduledDate || "",
        scheduledTime: data.job.scheduledTime || "",
        priority: data.job.priority || "normal",
        assignedTo: data.job.assignedTo || [],
        customerId: data.job.customerId || null,
        notes: data.job.notes || ""
      });
      setIsEditDialogOpen(true);
    }
  };

  const handleSaveEdit = () => {
    updateJobMutation.mutate(editFormData);
  };

  const checkWorkflowGate = (currentStatus: string, newStatus: string): string | null => {
    if (!data) return null;
    const { quotes, invoices, purchaseOrders } = data;
    
    if (currentStatus === 'intake' && newStatus === 'quoted') {
      if (quotes.length === 0) {
        return "No quote has been created for this job yet. Are you sure you want to mark it as Quoted?";
      }
    }
    
    if (currentStatus === 'quoted' && newStatus === 'deposit_received') {
      const hasAcceptedQuote = quotes.some(q => q.status === 'accepted');
      if (!hasAcceptedQuote) {
        return "No quote has been accepted yet. Are you sure you want to mark it as Approved to Proceed?";
      }
    }
    
    if (currentStatus === 'deposit_received' && newStatus === 'check_measure') {
      const hasDeposit = invoices.some(i => i.invoiceType === 'deposit' && (i.amountPaid || 0) > 0);
      if (!hasDeposit) {
        return "No deposit payment has been received. For insurance jobs, you may proceed. Continue anyway?";
      }
    }
    
    if (currentStatus === 'check_measure' && newStatus === 'make_orders') {
      return null;
    }
    
    if (currentStatus === 'make_orders' && newStatus === 'orders_placed') {
      if (purchaseOrders.length === 0) {
        return "No purchase orders have been created yet. Mark as Orders Placed anyway?";
      }
    }
    
    if (currentStatus === 'orders_placed' && newStatus === 'in_progress') {
      const hasPendingOrders = purchaseOrders.some(po => po.status !== 'received' && po.status !== 'cancelled');
      if (hasPendingOrders) {
        return "Some purchase orders haven't been received yet. Start work anyway?";
      }
    }
    
    if (currentStatus === 'in_progress' && newStatus === 'qc') {
      return null;
    }
    
    if (currentStatus === 'qc' && newStatus === 'qc_complete') {
      return null;
    }
    
    if (currentStatus === 'qc_complete' && newStatus === 'closed') {
      const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      if (totalPaid < totalInvoiced) {
        return `Outstanding balance of $${(totalInvoiced - totalPaid).toLocaleString('en-AU', { minimumFractionDigits: 2 })} remains unpaid. Close job anyway?`;
      }
    }
    
    return null;
  };

  const handleStatusChange = (newStatus: string) => {
    if (!id || !data) return;
    
    const warning = checkWorkflowGate(data.job.status, newStatus);
    if (warning) {
      setGateWarning({ show: true, message: warning, pendingStatus: newStatus });
    } else {
      updateStatusMutation.mutate({ id, status: newStatus });
    }
  };

  const confirmStatusChange = () => {
    if (id && gateWarning.pendingStatus) {
      updateStatusMutation.mutate({ id, status: gateWarning.pendingStatus });
    }
    setGateWarning({ show: false, message: "", pendingStatus: "" });
  };

  const getNextStatusAction = (currentStatus: string) => {
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
        return null;
    }
  };

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setUploadedFiles(prev => [...prev, {
        path: response.objectPath,
        name: response.metadata.name,
        type: response.metadata.contentType
      }]);
    },
    onError: (error) => {
      toast({ 
        title: "Failed to upload file", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      loadJobData();
    }
    api.fetchCrewMembers().then(setCrewMembers);
  }, [id]);

  useEffect(() => {
    if (id && data?.job) {
      api.fetchJobStatusHistory(id).then(setStatusHistory);
      api.fetchJobActivities(id).then(setActivities);
      
      addRecentItem({
        id: data.job.id,
        type: "job",
        title: data.job.referenceNumber || data.job.title || `Job #${id.slice(-8).toUpperCase()}`,
        subtitle: data.job.address || customer?.name,
        href: `/jobs/${id}`,
      });
    }
  }, [id, data?.job]);
  
  useEffect(() => {
    api.fetchAppSetting('job_timer_enabled').then(value => {
      setTimerEnabled(value === 'true');
    });
  }, []);
  
  useEffect(() => {
    if (data?.job) {
      const job = data.job;
      setTimerSeconds(job.timerTotalSeconds || 0);
      if (job.timerStartedAt) {
        setTimerRunning(true);
        const startTime = new Date(job.timerStartedAt).getTime();
        const now = Date.now();
        const elapsedSinceStart = Math.floor((now - startTime) / 1000);
        setTimerSeconds((job.timerTotalSeconds || 0) + elapsedSinceStart);
      }
    }
  }, [data?.job?.id]);
  
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);
  
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handleStartTimer = async () => {
    if (!id) return;
    setTimerRunning(true);
    await api.updateJob(id, { timerStartedAt: new Date() });
  };
  
  const handleStopTimer = async () => {
    if (!id || !data?.job) return;
    setTimerRunning(false);
    const now = Date.now();
    const startTime = data.job.timerStartedAt ? new Date(data.job.timerStartedAt).getTime() : now;
    const elapsed = Math.floor((now - startTime) / 1000);
    const newTotal = (data.job.timerTotalSeconds || 0) + elapsed;
    setTimerSeconds(newTotal);
    await api.updateJob(id, { timerStartedAt: null, timerTotalSeconds: newTotal });
  };
  
  const handleResetTimer = async () => {
    if (!id) return;
    setTimerRunning(false);
    setTimerSeconds(0);
    await api.updateJob(id, { timerStartedAt: null, timerTotalSeconds: 0 });
  };

  const loadJobData = async () => {
    setLoading(true);
    const result = await api.fetchJobWithDocuments(id!);
    setData(result);
    const allCustomers = await api.fetchCustomers();
    setCustomers(allCustomers);
    if (result?.job?.customerId) {
      const foundCustomer = allCustomers.find(c => c.id === result.job.customerId);
      setCustomer(foundCustomer || null);
    }
    setLoading(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const currentUserCrewMember = crewMembers.find(cm => 
    cm.email && authUser?.email && cm.email.toLowerCase() === authUser.email.toLowerCase()
  );

  const handleAddNote = async () => {
    if (!newNote.trim() && uploadedFiles.length === 0) return;
    if (!id) return;
    setAddingNote(true);
    try {
      const attachments = uploadedFiles.map(f => JSON.stringify({ url: f.path, name: f.name, type: f.type }));
      const activity = await api.createJobActivity(id, newNote.trim() || '(Attachments)', 'note', attachments, currentUserCrewMember?.id || undefined);
      setActivities(prev => [activity, ...prev]);
      setNewNote("");
      setUploadedFiles([]);
      toast({ title: "Note saved" });
    } catch (error) {
      console.error('Failed to add note:', error);
      toast({ 
        title: "Failed to save note", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      });
    }
    setAddingNote(false);
  };

  const getCrewMemberByIdOrEmail = (idOrEmail: string | null) => {
    if (!idOrEmail) return null;
    // First try matching by crew member ID
    const byId = crewMembers.find(cm => cm.id === idOrEmail);
    if (byId) return byId;
    // Then try matching by email (for legacy records)
    const byEmail = crewMembers.find(cm => 
      cm.email && idOrEmail.toLowerCase() === cm.email.toLowerCase()
    );
    return byEmail || null;
  };

  const scrollToNotesAndFocus = () => {
    setActiveTab("activity");
    setTimeout(() => {
      if (mobileActivitySectionRef.current) {
        mobileActivitySectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setTimeout(() => {
        if (mobileNoteInputRef.current) {
          mobileNoteInputRef.current.focus();
        }
      }, 300);
    }, 100);
  };

  const openFile = (url: string, type?: string, name?: string) => {
    const isPdf = type === 'application/pdf' || 
                  name?.toLowerCase().endsWith('.pdf') || 
                  url.toLowerCase().includes('.pdf');
    
    if (isMobile && isPdf) {
      window.open(url, '_blank');
    } else {
      setFileViewerUrl(url);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </Layout>
    );
  }

  if (!data || !data.job) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Job not found</p>
          <Button variant="outline" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/jobs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </Layout>
    );
  }

  const { job, reports, quotes, invoices, purchaseOrders } = data;

  const totalQuoted = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  const totalPOCost = purchaseOrders.reduce((sum, po) => sum + (po.total || 0), 0);
  
  const profit = totalQuoted - totalPOCost;
  const margin = totalQuoted > 0 ? (profit / totalQuoted) * 100 : 0;

  const MobileListRow = ({ 
    label, 
    value, 
    showChevron = false, 
    onClick,
    testId 
  }: { 
    label: string; 
    value: string | null | undefined; 
    showChevron?: boolean;
    onClick?: () => void;
    testId?: string;
  }) => (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between py-3 px-4 border-b border-border text-left",
        onClick && "active:bg-muted"
      )}
      disabled={!onClick}
      data-testid={testId}
    >
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value || "—"}</p>
      </div>
      {showChevron && <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
    </button>
  );

  if (isMobile) {
    return (
      <Layout>
        <div className="space-y-4 pb-6">
          {/* Mobile Hero Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                className="h-11 w-11"
                onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/jobs")}
                data-testid="button-back-mobile"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Badge variant="outline" className="font-mono text-xs" data-testid="badge-job-number-mobile">
                {job.referenceNumber || job.id.slice(-8).toUpperCase()}
              </Badge>
              <Badge className={statusColors[job.status] || statusColors.intake} data-testid="badge-status-mobile">
                {job.status.replace('_', ' ')}
              </Badge>
            </div>
            <h1 className="text-xl font-heading font-bold text-primary px-1" data-testid="text-customer-name-mobile">
              {customer?.name || job.title}
            </h1>
            {job.address && (
              <p className="text-sm text-muted-foreground px-1 truncate" data-testid="text-address-mobile">
                {job.address || job.suburb || ''}
              </p>
            )}
          </div>

          {/* Quick Action Row - 4 buttons */}
          <div className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className="flex flex-col items-center gap-1.5 py-3"
                  data-testid="button-navigate-mobile"
                >
                  <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                    <Navigation className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-xs font-medium">Navigate</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem asChild>
                  <a 
                    href={`https://maps.google.com/?q=${encodeURIComponent(job.address || job.suburb || '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Google Maps
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a 
                    href={`https://waze.com/ul?q=${encodeURIComponent(job.address || job.suburb || '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    Waze
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <a 
              href={customer?.email ? `mailto:${customer.email}` : undefined}
              className={cn("flex flex-col items-center gap-1.5 py-3", !customer?.email && "pointer-events-none")}
              data-testid="button-email-mobile"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                customer?.email 
                  ? "bg-teal-100 dark:bg-teal-900" 
                  : "bg-gray-100 dark:bg-gray-800"
              )}>
                <Mail className={cn(
                  "h-6 w-6",
                  customer?.email 
                    ? "text-teal-600 dark:text-teal-400" 
                    : "text-gray-400"
                )} />
              </div>
              <span className="text-xs font-medium">Email</span>
            </a>

            <a 
              href={customer?.phone ? `tel:${customer.phone}` : undefined}
              className={cn("flex flex-col items-center gap-1.5 py-3", !customer?.phone && "pointer-events-none")}
              data-testid="button-call-mobile"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                customer?.phone 
                  ? "bg-teal-100 dark:bg-teal-900" 
                  : "bg-gray-100 dark:bg-gray-800"
              )}>
                <Phone className={cn(
                  "h-6 w-6",
                  customer?.phone 
                    ? "text-teal-600 dark:text-teal-400" 
                    : "text-gray-400"
                )} />
              </div>
              <span className="text-xs font-medium">Call</span>
            </a>

            <a 
              href={customer?.phone ? `sms:${customer.phone}` : undefined}
              className={cn("flex flex-col items-center gap-1.5 py-3", !customer?.phone && "pointer-events-none")}
              data-testid="button-message-mobile"
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                customer?.phone 
                  ? "bg-teal-100 dark:bg-teal-900" 
                  : "bg-gray-100 dark:bg-gray-800"
              )}>
                <MessageSquare className={cn(
                  "h-6 w-6",
                  customer?.phone 
                    ? "text-teal-600 dark:text-teal-400" 
                    : "text-gray-400"
                )} />
              </div>
              <span className="text-xs font-medium">Message</span>
            </a>
          </div>

          {/* Full-Width CTA Buttons */}
          <div className="space-y-2 px-1">
            {timerEnabled && (
              <Button 
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-2"
                onClick={timerRunning ? handleStopTimer : handleStartTimer}
                data-testid="button-timer-mobile"
              >
                {timerRunning ? (
                  <>
                    <Square className="h-5 w-5" />
                    Stop Timer ({formatTime(timerSeconds)})
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Start Timer
                  </>
                )}
              </Button>
            )}
            <Button 
              className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold gap-2"
              onClick={scrollToNotesAndFocus}
              data-testid="button-new-note-mobile"
            >
              <Plus className="h-5 w-5" />
              New Note
            </Button>
          </div>

          {/* Workflow Quick Actions */}
          {(() => {
            const nextAction = getNextStatusAction(job.status);
            return (
              <Card className="rounded-lg overflow-hidden">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    Workflow
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {nextAction && (
                      <Button 
                        className={`h-10 ${nextAction.color} text-white font-medium gap-2`}
                        onClick={() => handleStatusChange(nextAction.status)}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-next-status-mobile"
                      >
                        <nextAction.icon className="h-4 w-4" />
                        {nextAction.label}
                      </Button>
                    )}
                    {job.status !== 'on_hold' && job.status !== 'closed' && job.status !== 'cancelled' && (
                      <Button 
                        variant="outline"
                        className="h-10 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 gap-2"
                        onClick={() => handleStatusChange('on_hold')}
                        disabled={updateStatusMutation.isPending}
                        data-testid="button-hold-mobile"
                      >
                        <Pause className="h-4 w-4" />
                        Hold
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-10 gap-2" data-testid="button-more-status-mobile">
                          <ChevronsUpDown className="h-4 w-4" />
                          More
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleStatusChange('intake')} disabled={job.status === 'intake'}>
                          Intake
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('quoted')} disabled={job.status === 'quoted'}>
                          Quoted
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('deposit_received')} disabled={job.status === 'deposit_received'}>
                          Approved
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('check_measure')} disabled={job.status === 'check_measure'}>
                          Check Measure
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('make_orders')} disabled={job.status === 'make_orders'}>
                          Make Orders
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('orders_placed')} disabled={job.status === 'orders_placed'}>
                          Orders Placed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('in_progress')} disabled={job.status === 'in_progress'}>
                          In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('qc')} disabled={job.status === 'qc'}>
                          QC
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('qc_complete')} disabled={job.status === 'qc_complete'}>
                          QC Complete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusChange('closed')} disabled={job.status === 'closed'}>
                          Closed
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} disabled={job.status === 'cancelled'} className="text-red-600">
                          Cancel Job
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Tappable List Rows */}
          <Card className="rounded-lg overflow-hidden">
            <CardContent className="p-0">
              <MobileListRow 
                label="Customer" 
                value={customer?.name}
                showChevron
                onClick={() => customer && setLocation(`/customer/${customer.id}`)}
                testId="row-customer-mobile"
              />
              <MobileListRow 
                label="Job Status" 
                value={job.status.replace('_', ' ')}
                testId="row-status-mobile"
              />
              {job.builderReference && (
                <MobileListRow 
                  label="Builder Ref" 
                  value={job.builderReference}
                  testId="row-builder-reference-mobile"
                />
              )}
              <MobileListRow 
                label="Description" 
                value={job.description || "Optional"}
                showChevron
                onClick={() => setLocation(`/job/${job.id}/edit`)}
                testId="row-description-mobile"
              />
              <MobileListRow 
                label="Job Site" 
                value={job.address || job.suburb || ''}
                showChevron
                onClick={() => job.address && window.open(`https://maps.google.com/?q=${encodeURIComponent(job.address || job.suburb || '')}`, '_blank')}
                testId="row-address-mobile"
              />
              {customer?.name && (
                <MobileListRow 
                  label="Job Contact" 
                  value={customer.name}
                  testId="row-contact-mobile"
                />
              )}
              {customer?.phone && (
                <MobileListRow 
                  label="Phone" 
                  value={customer.phone}
                  showChevron
                  onClick={() => window.location.href = `tel:${customer.phone}`}
                  testId="row-phone-mobile"
                />
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <div className="grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <DollarSign className="h-3 w-3" />
                  <span>Quoted</span>
                </div>
                <p className="text-lg font-bold">${totalQuoted.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Receipt className="h-3 w-3" />
                  <span>Invoiced</span>
                </div>
                <p className="text-lg font-bold">${totalInvoiced.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
                  <DollarSign className="h-3 w-3" />
                  <span>Paid</span>
                </div>
                <p className="text-lg font-bold text-green-600">${totalPaid.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <ShoppingCart className="h-3 w-3" />
                  <span>Costs</span>
                </div>
                <p className="text-lg font-bold">${totalPOCost.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className={`flex items-center gap-2 text-xs mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>Profit</span>
                </div>
                <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(profit).toLocaleString('en-AU', { minimumFractionDigits: 0 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className={`flex items-center gap-2 text-xs mb-1 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <Percent className="h-3 w-3" />
                  <span>Margin</span>
                </div>
                <p className={`text-lg font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {margin.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Links to Tabs */}
          <Card className="mx-1">
            <CardContent className="p-0">
              <button 
                onClick={() => setActiveTab("schedule")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-schedule-mobile"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("reports")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-reports-mobile"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{reports.length}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("quotes")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-quotes-mobile"
              >
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Quotes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{quotes.length}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("invoices")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-invoices-mobile"
              >
                <div className="flex items-center gap-3">
                  <Receipt className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Invoices</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{invoices.length}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("purchase-orders")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-pos-mobile"
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Purchase Orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{purchaseOrders.length}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("activity")}
                className="w-full flex items-center justify-between py-3 px-4 border-b border-border active:bg-muted"
                data-testid="link-activity-mobile"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Activity & Notes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{activities.length}</Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
              <button 
                onClick={() => setActiveTab("files")}
                className="w-full flex items-center justify-between py-3 px-4 active:bg-muted"
                data-testid="link-files-mobile"
              >
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Files</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            </CardContent>
          </Card>

          {/* Edit Button */}
          <div className="px-1">
            <Button 
              variant="outline" 
              className="w-full h-11"
              onClick={() => setLocation(`/job/${job.id}/edit`)}
              data-testid="button-edit-job-mobile"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Job
            </Button>
          </div>

          {/* Mobile Tab Content - Shows when a tab is selected */}
          {activeTab !== "overview" && (
            <div className="px-1 space-y-4">
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveTab("overview")}
                  className="h-11 px-3"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back
                </Button>
                <h2 className="text-lg font-semibold capitalize">{activeTab.replace('-', ' ')}</h2>
              </div>

              {activeTab === "reports" && (
                <Card>
                  <CardContent className="p-4">
                    {reports.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No reports yet</p>
                    ) : (
                      <div className="space-y-2">
                        {reports.map((report) => (
                          <button
                            key={report.id}
                            onClick={() => setLocation(`/report/${report.id}`)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border active:bg-muted"
                          >
                            <div className="text-left">
                              <p className="font-medium text-sm">Report #{report.id.slice(-8).toUpperCase()}</p>
                              <p className="text-xs text-muted-foreground">{report.status}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-4 h-11"
                      onClick={() => setLocation(`/report/new?jobId=${job.id}&customerId=${job.customerId || ''}`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Report
                    </Button>
                  </CardContent>
                </Card>
              )}

              {activeTab === "schedule" && (
                <ScheduleTab jobId={job.id} jobTitle={job.title} />
              )}

              {activeTab === "quotes" && (
                <Card>
                  <CardContent className="p-4">
                    {quotes.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No quotes yet</p>
                    ) : (
                      <div className="space-y-2">
                        {quotes.map((quote) => (
                          <div
                            key={quote.id}
                            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                            onClick={() => setLocation(`/quote/${quote.id}`)}
                            data-testid={`quote-row-${quote.id}`}
                          >
                            <div className="text-left">
                              <p className="font-medium text-sm">{quote.quoteNumber}</p>
                              <p className="text-xs text-muted-foreground">${quote.total?.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{quote.status}</Badge>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuoteToDelete(quote);
                                  }}
                                  data-testid={`button-delete-quote-${quote.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-4 h-11"
                      onClick={() => setLocation(`/quote/new?jobId=${job.id}`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Quote
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Delete Quote Confirmation Dialog */}
              <AlertDialog open={!!quoteToDelete} onOpenChange={() => setQuoteToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Quote</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete quote {quoteToDelete?.quoteNumber}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => quoteToDelete && deleteQuoteMutation.mutate(quoteToDelete.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={!!poToDelete} onOpenChange={() => setPoToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete purchase order {poToDelete?.poNumber}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => poToDelete && deletePOMutation.mutate(poToDelete.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete Invoice Confirmation Dialog */}
              <AlertDialog open={!!invoiceToDelete} onOpenChange={() => setInvoiceToDelete(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete invoice {invoiceToDelete?.invoiceNumber}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => invoiceToDelete && deleteInvoiceMutation.mutate(invoiceToDelete.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {activeTab === "invoices" && (
                <Card>
                  <CardContent className="p-4">
                    {invoices.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No invoices yet</p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                            onClick={() => setLocation(`/invoice/${invoice.id}`)}
                            data-testid={`invoice-row-${invoice.id}`}
                          >
                            <div className="text-left">
                              <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                              <p className="text-xs text-muted-foreground">${invoice.total?.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{invoice.status}</Badge>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInvoiceToDelete(invoice);
                                  }}
                                  data-testid={`button-delete-invoice-${invoice.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-4 h-11"
                      onClick={() => setLocation(`/invoice/new?jobId=${job.id}`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Invoice
                    </Button>
                  </CardContent>
                </Card>
              )}

              {activeTab === "purchase-orders" && (
                <Card>
                  <CardContent className="p-4">
                    {purchaseOrders.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No purchase orders yet</p>
                    ) : (
                      <div className="space-y-2">
                        {purchaseOrders.map((po) => (
                          <div
                            key={po.id}
                            onClick={() => setLocation(`/purchase-order/${po.id}`)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border active:bg-muted cursor-pointer"
                            data-testid={`po-row-${po.id}`}
                          >
                            <div className="text-left">
                              <p className="font-medium text-sm">{po.poNumber}</p>
                              <p className="text-xs text-muted-foreground">{po.supplier} - ${po.total?.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{po.status}</Badge>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPoToDelete(po);
                                  }}
                                  data-testid={`button-delete-po-${po.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button 
                      className="w-full mt-4 h-11"
                      onClick={() => setLocation(`/purchase-order/new?jobId=${job.id}`)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New PO
                    </Button>
                  </CardContent>
                </Card>
              )}

              {activeTab === "activity" && (
                <Card ref={mobileActivitySectionRef}>
                  <CardContent className="p-4 space-y-4">
                    {/* Hidden file inputs */}
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*"
                      capture="environment"
                      data-testid="input-camera-mobile"
                    />
                    <input
                      type="file"
                      ref={galleryInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="image/*"
                      multiple
                      data-testid="input-gallery-mobile"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                      accept="application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                      multiple
                      data-testid="input-files-mobile"
                    />
                    
                    <div className="space-y-3">
                      <MentionTextarea
                        ref={mobileNoteInputRef}
                        value={newNote}
                        onChange={setNewNote}
                        users={crewMembers.map(m => ({ id: m.id, name: m.name, color: m.color }))}
                        placeholder="Add a note... (type @ to mention someone)"
                        className="min-h-[80px]"
                        data-testid="input-note-mobile"
                      />
                      
                      {/* File previews */}
                      {uploadedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="relative">
                              {file.type.startsWith('image/') ? (
                                <div className="w-16 h-16 rounded-lg border overflow-hidden">
                                  <img 
                                    src={file.path} 
                                    alt={file.name} 
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-lg border flex flex-col items-center justify-center bg-muted p-2">
                                  <File className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                                    {file.name.split('.').pop()?.toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <button
                                onClick={() => removeFile(index)}
                                className="absolute -top-3 -right-3 h-8 w-8 min-h-[44px] min-w-[44px] bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                                data-testid={`button-remove-file-mobile-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Attachment buttons - 44px touch targets */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 gap-2"
                          onClick={() => cameraInputRef.current?.click()}
                          disabled={isUploading}
                          data-testid="button-camera-mobile"
                        >
                          <Camera className="h-5 w-5" />
                          Camera
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 gap-2"
                          onClick={() => galleryInputRef.current?.click()}
                          disabled={isUploading}
                          data-testid="button-gallery-mobile"
                        >
                          <Image className="h-5 w-5" />
                          Gallery
                        </Button>
                        <Button 
                          variant="outline" 
                          className="flex-1 h-11 gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          data-testid="button-files-mobile"
                        >
                          <Paperclip className="h-5 w-5" />
                          Files
                        </Button>
                      </div>
                      
                      {isUploading && (
                        <p className="text-sm text-muted-foreground text-center">Uploading...</p>
                      )}
                      
                      {currentUserCrewMember && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: currentUserCrewMember.color || '#888' }}
                          />
                          <span className="text-sm text-muted-foreground">
                            Posting as <span className="font-medium text-foreground">{currentUserCrewMember.name}</span>
                          </span>
                        </div>
                      )}
                      
                      <Button 
                        className="w-full h-11"
                        onClick={handleAddNote}
                        disabled={addingNote || (!newNote.trim() && uploadedFiles.length === 0)}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {addingNote ? 'Saving...' : 'Save Note'}
                      </Button>
                    </div>
                    
                    {/* Activity feed with attachments */}
                    {activities.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No activity yet</p>
                    ) : (
                      <div className="space-y-3">
                        {activities.slice(0, 20).map((activity) => {
                          const crewMember = getCrewMemberByIdOrEmail(activity.createdBy);
                          const activityWithName = activity as JobActivity & { createdByName?: string };
                          const displayName = crewMember?.name || activityWithName.createdByName || activity.createdBy || 'Team Member';
                          return (
                          <div key={activity.id} className="border rounded-lg p-3">
                            {displayName && (
                              <p className="text-sm font-medium mb-1" style={{ color: crewMember?.color || '#888' }}>
                                {displayName}
                              </p>
                            )}
                            {activity.content && activity.content !== '(Attachments)' && (
                              <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                            )}
                            
                            {/* Photo thumbnails with lightbox */}
                            {activity.attachments && activity.attachments.length > 0 && (() => {
                              const allImages: { url: string; name: string }[] = [];
                              activity.attachments.forEach((attachment) => {
                                let url = attachment;
                                let name = '';
                                let type = '';
                                let isLegacy = false;
                                try {
                                  const parsed = JSON.parse(attachment);
                                  url = parsed.url || attachment;
                                  name = parsed.name || '';
                                  type = parsed.type || '';
                                } catch { 
                                  isLegacy = true;
                                }
                                const isImage = !isLegacy && (type.startsWith('image/') || 
                                               name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                                               url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                                if (isImage) {
                                  allImages.push({ url, name: name || `Photo ${allImages.length + 1}` });
                                }
                              });
                              
                              return (
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {activity.attachments.map((attachment, idx) => {
                                  let url = attachment;
                                  let name = '';
                                  let type = '';
                                  let isLegacy = false;
                                  try {
                                    const parsed = JSON.parse(attachment);
                                    url = parsed.url || attachment;
                                    name = parsed.name || '';
                                    type = parsed.type || '';
                                  } catch { 
                                    isLegacy = true;
                                  }
                                  
                                  const isImage = !isLegacy && (type.startsWith('image/') || 
                                                 name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ||
                                                 url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
                                  const isFile = !isLegacy && !isImage;
                                  
                                  if (isImage) {
                                    const imageIndex = Math.max(0, allImages.findIndex(img => img.url === url));
                                    return (
                                      <button 
                                        key={idx} 
                                        onClick={() => setLightboxData({ images: allImages, currentIndex: imageIndex })}
                                        className="block aspect-square rounded-lg border overflow-hidden bg-muted min-h-[44px]"
                                        data-testid={`photo-thumbnail-${idx}`}
                                      >
                                        <img 
                                          src={url} 
                                          alt={name || `Photo ${idx + 1}`} 
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    );
                                  } else if (isFile) {
                                    return (
                                      <button 
                                        key={idx} 
                                        onClick={() => openFile(url, type, name)}
                                        className="flex flex-col items-center justify-center rounded-lg border bg-muted p-3 min-h-[44px]"
                                      >
                                        <File className="h-6 w-6 text-muted-foreground shrink-0" />
                                        <span className="text-xs text-muted-foreground mt-1 truncate max-w-full px-1 text-center">
                                          {name || 'File'}
                                        </span>
                                      </button>
                                    );
                                  } else {
                                    return (
                                      <button 
                                        key={idx} 
                                        onClick={() => openFile(url)}
                                        className="flex flex-col items-center justify-center aspect-square rounded-lg border bg-muted p-2 min-h-[44px]"
                                        data-testid={`legacy-attachment-${idx}`}
                                      >
                                        <ExternalLink className="h-6 w-6 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground mt-1">View</span>
                                      </button>
                                    );
                                  }
                                })}
                              </div>
                              );
                            })()}
                            
                            <p className="text-xs text-muted-foreground mt-2">
                              {activity.createdAt ? formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }) : ''}
                            </p>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {activeTab === "files" && (
                <Card>
                  <CardContent className="p-4">
                    {(() => {
                      const parseAttachment = (a: string) => {
                        try {
                          const parsed = JSON.parse(a);
                          return { url: parsed.url || a, name: parsed.name || '', type: parsed.type || '', isLegacy: false };
                        } catch { return { url: a, name: '', type: '', isLegacy: true }; }
                      };
                      
                      const allFiles: { url: string; name: string; type: string; source: string; date: string }[] = [];
                      
                      activities.forEach(activity => {
                        if (!activity.attachments || activity.attachments.length === 0) return;
                        
                        activity.attachments.forEach((att) => {
                          const { url, name, type, isLegacy } = parseAttachment(att);
                          if (url) {
                            const isImage = type.startsWith('image/') || 
                                           /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || 
                                           /\.(jpg|jpeg|png|gif|webp)$/i.test(url) ||
                                           (isLegacy && url.includes('/objects/'));
                            allFiles.push({
                              url,
                              name: name || url.split('/').pop() || 'File',
                              type: isImage ? 'image/jpeg' : (type || 'file'),
                              source: 'Activity',
                              date: activity.createdAt ? formatDateShort(activity.createdAt) : ''
                            });
                          }
                        });
                      });
                      
                      if (allFiles.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <FolderOpen className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground text-sm">No files yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Files added through activity notes will appear here
                            </p>
                          </div>
                        );
                      }
                      
                      const imageFiles = allFiles.filter(f => f.type?.startsWith('image/'));
                      const otherFiles = allFiles.filter(f => !f.type?.startsWith('image/'));
                      
                      return (
                        <div className="space-y-4">
                          {imageFiles.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Image className="h-4 w-4" />
                                Photos ({imageFiles.length})
                              </h4>
                              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {imageFiles.map((file, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => setLightboxData({
                                      images: imageFiles.map(f => ({ url: f.url, name: f.name })),
                                      currentIndex: idx
                                    })}
                                    className="aspect-square rounded-lg border overflow-hidden bg-muted"
                                    data-testid={`mobile-files-photo-${idx}`}
                                  >
                                    <img 
                                      src={file.url} 
                                      alt={file.name} 
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {otherFiles.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <File className="h-4 w-4" />
                                Documents ({otherFiles.length})
                              </h4>
                              <div className="space-y-2">
                                {otherFiles.map((file, idx) => (
                                  <a
                                    key={idx}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
                                    data-testid={`mobile-files-document-${idx}`}
                                  >
                                    <File className="h-6 w-6 text-muted-foreground shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">{file.date}</p>
                                    </div>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Edit Job Dialog - shared between mobile and desktop */}
        <EditJobDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          editFormData={editFormData}
          onFormDataChange={setEditFormData}
          onSave={handleSaveEdit}
          isSaving={updateJobMutation.isPending}
          customers={customers}
          crewMembers={crewMembers}
        />

        {/* Mobile Photo Lightbox - Full screen with iOS safe areas */}
        {lightboxData && (
          <div 
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            style={{ 
              height: '100dvh',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-sm shrink-0 min-h-[56px]">
              <button
                onClick={() => setLightboxData(null)}
                className="h-11 w-11 flex items-center justify-center text-white"
                data-testid="button-close-lightbox-mobile"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <span className="flex-1 text-sm font-medium truncate mx-2 text-center text-white">
                {lightboxData.images[lightboxData.currentIndex]?.name || 'Photo'}
              </span>
              <a
                href={lightboxData.images[lightboxData.currentIndex]?.url || ''}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium"
                data-testid="button-open-photo-external-mobile"
              >
                Open
              </a>
            </div>
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
              onClick={() => setLightboxData(null)}
            >
              <img
                src={lightboxData.images[lightboxData.currentIndex]?.url}
                alt={lightboxData.images[lightboxData.currentIndex]?.name || 'Full size'}
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {lightboxData.images.length > 1 && (
              <div className="shrink-0 bg-black/80 backdrop-blur-sm px-2 py-3 overflow-x-auto">
                <div className="flex gap-2 justify-center">
                  {lightboxData.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxData({ ...lightboxData, currentIndex: idx })}
                      className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                        idx === lightboxData.currentIndex 
                          ? 'border-white' 
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      data-testid={`thumbnail-mobile-${idx}`}
                    >
                      <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile File Viewer */}
        <Dialog open={!!fileViewerUrl} onOpenChange={() => setFileViewerUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-background z-[100]">
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <span className="font-medium text-sm">File Viewer</span>
              <div className="flex items-center gap-2">
                <a
                  href={fileViewerUrl || ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-open-external-mobile"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
                <button
                  onClick={() => setFileViewerUrl(null)}
                  className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-close-file-viewer-mobile"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {fileViewerUrl && (
              <iframe
                src={fileViewerUrl}
                className="w-full h-[80vh] border-0"
                title="File Viewer"
              />
            )}
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb className="mb-4 hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/jobs" data-testid="breadcrumb-jobs">Jobs</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">{job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <div className="flex flex-col gap-4">
          <div className="flex-1">
            <h1 className="text-lg sm:text-2xl font-heading font-bold text-primary leading-tight" data-testid="text-job-title">
              {job.title}
              <span className="mx-1 sm:mx-2">·</span>
              <span className="font-mono text-muted-foreground text-sm sm:text-lg">{job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`}</span>
            </h1>
            {customer && (
              <button 
                onClick={() => setLocation(`/customer/${customer.id}`)}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1 mt-1"
                data-testid="link-job-customer"
              >
                <User className="h-3 w-3" />
                {customer.name}
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                      <Badge className={`${statusColors[job.status] || statusColors.intake} cursor-pointer flex items-center gap-1`}>
                        {job.status.replace('_', ' ')}
                        <ChevronDown className="h-3 w-3" />
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Workflow Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleStatusChange('intake')} disabled={job.status === 'intake'}>
                      <Inbox className="h-4 w-4 mr-2 text-slate-600" /> Intake
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('quoted')} disabled={job.status === 'quoted'}>
                      <FileText className="h-4 w-4 mr-2 text-purple-600" /> Quoted
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('deposit_received')} disabled={job.status === 'deposit_received'}>
                      <CircleDollarSign className="h-4 w-4 mr-2 text-blue-600" /> Approved to Proceed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('check_measure')} disabled={job.status === 'check_measure'}>
                      <Ruler className="h-4 w-4 mr-2 text-cyan-600" /> Check Measure
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('make_orders')} disabled={job.status === 'make_orders'}>
                      <Package className="h-4 w-4 mr-2 text-amber-600" /> Make Orders
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('orders_placed')} disabled={job.status === 'orders_placed'}>
                      <Package className="h-4 w-4 mr-2 text-indigo-600" /> Orders Placed
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('in_progress')} disabled={job.status === 'in_progress'}>
                      <Play className="h-4 w-4 mr-2 text-yellow-600" /> In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('qc')} disabled={job.status === 'qc'}>
                      <ClipboardCheck className="h-4 w-4 mr-2 text-teal-600" /> QC
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('qc_complete')} disabled={job.status === 'qc_complete'}>
                      <ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" /> QC Complete
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('closed')} disabled={job.status === 'closed'}>
                      <Lock className="h-4 w-4 mr-2 text-green-600" /> Closed
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleStatusChange('on_hold')} disabled={job.status === 'on_hold'}>
                      <Pause className="h-4 w-4 mr-2 text-orange-600" /> On Hold
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} disabled={job.status === 'cancelled'}>
                      <XCircle className="h-4 w-4 mr-2 text-gray-600" /> Cancelled
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                      <Badge className={`${priorityColors[job.priority] || priorityColors.normal} cursor-pointer flex items-center gap-1`}>
                        {job.priority}
                        <ChevronDown className="h-3 w-3" />
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Change Priority</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => updateJobMutation.mutate({ priority: 'low' })} disabled={job.priority === 'low'}>
                      <Badge className={`${priorityColors.low} mr-2`}>Low</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateJobMutation.mutate({ priority: 'normal' })} disabled={job.priority === 'normal'}>
                      <Badge className={`${priorityColors.normal} mr-2`}>Normal</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateJobMutation.mutate({ priority: 'high' })} disabled={job.priority === 'high'}>
                      <Badge className={`${priorityColors.high} mr-2`}>High</Badge>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => updateJobMutation.mutate({ priority: 'urgent' })} disabled={job.priority === 'urgent'}>
                      <Badge className={`${priorityColors.urgent} mr-2`}>Urgent</Badge>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const nextAction = getNextStatusAction(job.status);
              if (nextAction) {
                const Icon = nextAction.icon;
                return (
                  <Button 
                    className={`${nextAction.color} text-white font-semibold h-11 px-4 sm:px-6 shadow-md hover:shadow-lg transition-all flex-1 sm:flex-none active:scale-95`}
                    onClick={() => handleStatusChange(nextAction.status)}
                    disabled={updateStatusMutation.isPending}
                    data-testid="button-quick-status"
                  >
                    <Icon className="h-5 w-5 mr-2" />
                    {nextAction.label}
                  </Button>
                );
              }
              return null;
            })()}
            <Button variant="outline" className="h-11 active:scale-95 transition-transform" onClick={() => setLocation(`/job/${job.id}/edit`)} data-testid="button-edit-job">
              <Edit className="h-4 w-4 sm:mr-2" aria-hidden="true" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
            {customer?.phone && (
              <a href={`tel:${customer.phone}`}>
                <Button variant="outline" className="h-11 gap-2 active:scale-95 transition-transform" data-testid="button-call-customer">
                  <Phone className="h-5 w-5 text-green-600" />
                  <span className="hidden sm:inline">Call</span>
                </Button>
              </a>
            )}
            {job.address && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 active:scale-95 transition-transform" data-testid="button-navigate">
                    <Navigation className="h-5 w-5 text-blue-600" />
                    <span className="hidden sm:inline">Navigate</span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address || job.suburb || '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <Navigation className="h-4 w-4" />
                      Google Maps
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a 
                      href={`https://waze.com/ul?q=${encodeURIComponent(job.address || job.suburb || '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <Navigation className="h-4 w-4" />
                      Waze
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        {/* Timer section */}
        <div className="flex flex-wrap gap-2">
          {timerEnabled && (
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <div className="flex items-center gap-1 bg-muted px-3 py-2 rounded-md font-mono text-lg h-11">
                <Timer className="h-5 w-5 text-orange-500" />
                <span data-testid="text-timer">{formatTime(timerSeconds)}</span>
              </div>
              {timerRunning ? (
                <Button 
                  variant="outline" 
                  className="h-11 gap-2 active:scale-95 transition-transform border-red-300 text-red-600 hover:bg-red-50"
                  onClick={handleStopTimer}
                  data-testid="button-stop-timer"
                >
                  <Square className="h-5 w-5" />
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="h-11 gap-2 active:scale-95 transition-transform border-green-300 text-green-600 hover:bg-green-50"
                  onClick={handleStartTimer}
                  data-testid="button-start-timer"
                >
                  <Play className="h-5 w-5" />
                  <span className="hidden sm:inline">Start</span>
                </Button>
              )}
              {timerSeconds > 0 && !timerRunning && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-11 text-muted-foreground hover:text-destructive"
                  onClick={handleResetTimer}
                  data-testid="button-reset-timer"
                >
                  Reset
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-6">
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Quoted</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold">${totalQuoted.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <Receipt className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Invoiced</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold">${totalInvoiced.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                <span className="truncate">Paid</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-green-600">${totalPaid.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mb-1">
                <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Costs</span>
              </div>
              <p className="text-lg sm:text-2xl font-bold">${totalPOCost.toLocaleString('en-AU', { minimumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className={`flex items-center gap-2 text-xs sm:text-sm mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="truncate">Profit</span>
              </div>
              <p className={`text-lg sm:text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${Math.abs(profit).toLocaleString('en-AU', { minimumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:pt-4">
              <div className={`flex items-center gap-2 text-xs sm:text-sm mb-1 ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <Percent className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="truncate">Margin</span>
              </div>
              <p className={`text-lg sm:text-2xl font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-8">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="schedule" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-schedule">
                <span className="hidden sm:inline">Schedule</span><span className="sm:hidden">Sched</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-reports">
                <span className="hidden sm:inline">Reports</span><span className="sm:hidden">Rep</span> ({reports.length})
              </TabsTrigger>
              <TabsTrigger value="quotes" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-quotes">
                <span className="hidden sm:inline">Quotes</span><span className="sm:hidden">Quo</span> ({quotes.length})
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-invoices">
                <span className="hidden sm:inline">Invoices</span><span className="sm:hidden">Inv</span> ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="purchase-orders" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-purchase-orders">
                POs ({purchaseOrders.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-activity">Activity</TabsTrigger>
              <TabsTrigger value="files" className="text-xs sm:text-sm px-2 sm:px-4" data-testid="tab-files">Files</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-4">
            <JobOverviewTab
              job={job}
              customer={customer}
              quotes={quotes}
              invoices={invoices}
              purchaseOrders={purchaseOrders}
            />
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <ScheduleTab jobId={job.id} jobTitle={job.title} />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Roof Reports</h3>
              <Button onClick={() => setLocation(`/report/new?jobId=${job.id}`)} data-testid="button-add-report">
                <Plus className="h-4 w-4 mr-2" />
                New Report
              </Button>
            </div>
            {reports.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No reports for this job yet</p>
                  <Button className="mt-4" onClick={() => setLocation(`/report/new?jobId=${job.id}`)}>
                    Create First Report
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Inspector</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: { id: string; date: string; inspector: string; status: string }) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-mono">{report.id}</TableCell>
                        <TableCell>{report.date}</TableCell>
                        <TableCell>{report.inspector}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setLocation(`/report/${report.id}`)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="quotes" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Quotes</h3>
              <Button onClick={() => setLocation(`/quote/new?jobId=${job.id}`)} data-testid="button-add-quote">
                <Plus className="h-4 w-4 mr-2" />
                New Quote
              </Button>
            </div>
            {quotes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No quotes for this job yet</p>
                  <Button className="mt-4" onClick={() => setLocation(`/quote/new?jobId=${job.id}`)}>
                    Create First Quote
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {canDelete && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote: Quote) => (
                      <TableRow 
                        key={quote.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/quote/${quote.id}`)}
                        data-testid={`quote-row-desktop-${quote.id}`}
                      >
                        <TableCell className="font-mono">{quote.quoteNumber}</TableCell>
                        <TableCell>{quote.customerName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{quote.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${quote.total?.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {canDelete && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQuoteToDelete(quote);
                              }}
                              data-testid={`button-delete-quote-desktop-${quote.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Invoices</h3>
              <Button onClick={() => setLocation(`/invoice/new?jobId=${job.id}`)} data-testid="button-add-invoice">
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </div>
            {/* Invoice Chain Summary */}
            {quotes.length > 0 && (
              <Card className="bg-muted/30">
                <CardContent className="py-4">
                  <div className="flex flex-wrap gap-6 items-center justify-between">
                    <div className="flex items-center gap-6 flex-wrap">
                      <div>
                        <span className="text-sm text-muted-foreground">Quoted:</span>
                        <span className="ml-2 font-semibold">
                          ${quotes.reduce((sum, q) => sum + (q.total || 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Invoiced:</span>
                        <span className="ml-2 font-semibold">
                          ${invoices.reduce((sum, inv) => sum + (inv.total || 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Paid:</span>
                        <span className="ml-2 font-semibold text-green-600">
                          ${invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Remaining:</span>
                      <span className="ml-2 font-bold text-primary">
                        ${Math.max(0, quotes.reduce((sum, q) => sum + (q.total || 0), 0) - invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {invoices.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No invoices for this job yet</p>
                  <Button className="mt-4" onClick={() => setLocation(`/invoice/new?jobId=${job.id}`)}>
                    Create First Invoice
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice: Invoice) => (
                      <TableRow 
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/invoice/${invoice.id}`)}
                        data-testid={`invoice-row-${invoice.id}`}
                      >
                        <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                        <TableCell>
                          {invoice.invoiceType === 'deposit' && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">Deposit</Badge>
                          )}
                          {invoice.invoiceType === 'progress' && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">Progress</Badge>
                          )}
                          {invoice.invoiceType === 'final' && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">Final</Badge>
                          )}
                          {(!invoice.invoiceType || invoice.invoiceType === 'standard') && (
                            <Badge variant="outline">Standard</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${invoice.total?.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ${invoice.amountPaid?.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="purchase-orders" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Purchase Orders</h3>
              <Button onClick={() => setLocation(`/purchase-order/new?jobId=${job.id}`)} data-testid="button-add-po">
                <Plus className="h-4 w-4 mr-2" />
                New Purchase Order
              </Button>
            </div>
            {purchaseOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No purchase orders for this job yet</p>
                  <Button className="mt-4" onClick={() => setLocation(`/purchase-order/new?jobId=${job.id}`)}>
                    Create First PO
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {canDelete && <TableHead className="w-[50px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((po: PurchaseOrder) => (
                      <TableRow 
                        key={po.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setLocation(`/purchase-order/${po.id}`)}
                        data-testid={`po-row-${po.id}`}
                      >
                        <TableCell className="font-mono">{po.poNumber}</TableCell>
                        <TableCell>{po.supplier}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${po.total?.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                        </TableCell>
                        {canDelete && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPoToDelete(po);
                              }}
                              data-testid={`button-delete-po-desktop-${po.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <JobActivityTab
              jobId={id!}
              statusHistory={statusHistory}
              activities={activities}
              crewMembers={crewMembers}
              currentUserCrewMember={currentUserCrewMember}
              activityFilter={activityFilter}
              onActivityFilterChange={setActivityFilter}
              newNote={newNote}
              onNewNoteChange={setNewNote}
              uploadedFiles={uploadedFiles}
              onRemoveFile={removeFile}
              onFileSelect={handleFileSelect}
              isUploading={isUploading}
              addingNote={addingNote}
              onAddNote={handleAddNote}
              onOpenLightbox={setLightboxData}
              onOpenFile={openFile}
              getCrewMemberByIdOrEmail={getCrewMemberByIdOrEmail}
            />
          </TabsContent>
          
          <TabsContent value="files" className="space-y-4">
            <JobFilesTab 
              activities={activities}
              onOpenLightbox={setLightboxData}
            />
          </TabsContent>
        </Tabs>

        {/* Tradify-style Photo Gallery */}
        {lightboxData && (
          <div 
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            style={{ 
              height: '100dvh',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)'
            }}
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-sm shrink-0 min-h-[56px]">
              <button
                onClick={() => setLightboxData(null)}
                className="h-11 w-11 flex items-center justify-center text-white"
                data-testid="button-close-lightbox"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <span className="flex-1 text-sm font-medium truncate mx-2 text-center text-white">
                {lightboxData.images[lightboxData.currentIndex]?.name || 'Photo'}
              </span>
              <a
                href={lightboxData.images[lightboxData.currentIndex]?.url || ''}
                target="_blank"
                rel="noopener noreferrer"
                className="h-11 px-4 bg-white text-black rounded-full flex items-center justify-center text-sm font-medium"
                data-testid="button-open-photo-external"
              >
                Open
              </a>
            </div>
            
            {/* Main image */}
            <div 
              className="flex-1 flex items-center justify-center overflow-hidden min-h-0"
              onClick={() => setLightboxData(null)}
            >
              <img
                src={lightboxData.images[lightboxData.currentIndex]?.url}
                alt={lightboxData.images[lightboxData.currentIndex]?.name || 'Full size'}
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {/* Thumbnail strip */}
            {lightboxData.images.length > 1 && (
              <div className="shrink-0 bg-black/80 backdrop-blur-sm px-2 py-3 overflow-x-auto">
                <div className="flex gap-2 justify-center">
                  {lightboxData.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setLightboxData({ ...lightboxData, currentIndex: idx })}
                      className={`w-16 h-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                        idx === lightboxData.currentIndex 
                          ? 'border-white' 
                          : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                      data-testid={`thumbnail-${idx}`}
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* File Viewer */}
        <Dialog open={!!fileViewerUrl} onOpenChange={() => setFileViewerUrl(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-background z-[100]">
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <span className="font-medium text-sm">File Viewer</span>
              <div className="flex items-center gap-2">
                <a
                  href={fileViewerUrl || ''}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-5 w-5" />
                </a>
                <button
                  onClick={() => setFileViewerUrl(null)}
                  className="h-11 w-11 rounded-full bg-muted flex items-center justify-center"
                  data-testid="button-close-file-viewer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {fileViewerUrl && (
              <iframe
                src={fileViewerUrl}
                className="w-full h-[80vh] border-0"
                title="File Viewer"
              />
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={gateWarning.show} onOpenChange={(open) => !open && setGateWarning({ show: false, message: "", pendingStatus: "" })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Workflow Warning</AlertDialogTitle>
              <AlertDialogDescription>{gateWarning.message}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange}>Continue Anyway</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
