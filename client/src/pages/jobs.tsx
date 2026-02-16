import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Plus, 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Edit,
  CheckCircle2,
  Search,
  Filter,
  ExternalLink,
  Clipboard,
  Play,
  Pause,
  XCircle,
  MoreVertical,
  ChevronDown,
  Download,
  Upload,
  FileText,
  Trash2,
  Inbox,
  CircleDollarSign,
  Ruler,
  Package,
  ClipboardCheck,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { fetchJobs, updateJob, fetchCustomers, fetchJobTemplates, JobTemplate, fetchCrewMembers, createJob, deleteJob, fetchJobWithDocuments, fetchAppointments } from "@/lib/api";
import type { Job, InsertJob, Customer, CrewMember } from "@shared/schema";
import { format, isValid, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

function safeFormatDate(dateValue: string | Date | null | undefined, formatStr: string): string {
  if (!dateValue) return '';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
    return isValid(date) ? format(date, formatStr) : '';
  } catch {
    return '';
  }
}

function getJobDisplayNumber(job: Job): string {
  return job.referenceNumber || `#${job.id.slice(-8).toUpperCase()}`;
}

const WORKFLOW_ORDER = [
  'intake', 'quoted', 'deposit_received', 'check_measure', 'make_orders',
  'orders_placed', 'in_progress', 'qc', 'qc_complete', 'closed', 'on_hold', 'cancelled'
];

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
  on_hold: "On Hold",
  cancelled: "Cancelled"
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent"
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
};

export default function Jobs() {
  const [location, setLocation] = useLocation();
  const { isAdmin, canDelete } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [gateWarning, setGateWarning] = useState<{ show: boolean; message: string; pendingJob: Job | null; pendingStatus: string }>({ show: false, message: "", pendingJob: null, pendingStatus: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchJobTemplates().then(setTemplates);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('newJob') === 'true') {
      window.history.replaceState({}, '', '/jobs');
      setLocation("/job/new");
    }
    const statusParam = params.get('status');
    if (statusParam) {
      setStatusFilter(statusParam);
    }
  }, []);

  const handleViewJob = (id: string) => {
    setLocation(`/jobs/${id}`);
  };

  const { data: jobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: fetchJobs
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => fetchCustomers()
  });

  const { data: crewMembers = [] } = useQuery({
    queryKey: ['/api/crew-members'],
    queryFn: fetchCrewMembers
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['/api/appointments'],
    queryFn: fetchAppointments
  });

  const appointmentsByJob = useMemo(() => {
    const map = new Map<string, { date: string; time: string | null }>();
    const today = new Date().toISOString().split('T')[0];
    for (const appt of appointments) {
      if (!appt.jobId || !appt.scheduledDate) continue;
      if (appt.scheduledDate < today) continue;
      const existing = map.get(appt.jobId);
      if (!existing || appt.scheduledDate < existing.date) {
        map.set(appt.jobId, { date: appt.scheduledDate, time: appt.scheduledTime || null });
      }
    }
    return map;
  }, [appointments]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertJob> }) => updateJob(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    }
  });

  const handleEdit = (job: Job) => {
    setLocation(`/job/${job.id}/edit`);
  };

  const handleCreate = () => {
    setLocation("/job/new");
  };

  const checkWorkflowGate = async (job: Job, newStatus: string): Promise<string | null> => {
    const data = await fetchJobWithDocuments(job.id);
    if (!data) return null;
    const { quotes, invoices, purchaseOrders } = data;
    
    if (job.status === 'intake' && newStatus === 'quoted') {
      if (quotes.length === 0) {
        return "No quote has been created for this job yet. Are you sure you want to mark it as Quoted?";
      }
    }
    
    if (job.status === 'quoted' && newStatus === 'deposit_received') {
      const hasAcceptedQuote = quotes.some(q => q.status === 'accepted');
      if (!hasAcceptedQuote) {
        return "No quote has been accepted yet. Are you sure you want to mark it as Approved to Proceed?";
      }
    }
    
    if (job.status === 'deposit_received' && newStatus === 'check_measure') {
      const hasDeposit = invoices.some(i => i.invoiceType === 'deposit' && (i.amountPaid || 0) > 0);
      if (!hasDeposit) {
        return "No deposit payment has been received. For insurance jobs, you may proceed. Continue anyway?";
      }
    }
    
    if (job.status === 'make_orders' && newStatus === 'orders_placed') {
      if (purchaseOrders.length === 0) {
        return "No purchase orders have been created yet. Mark as Orders Placed anyway?";
      }
    }
    
    if (job.status === 'orders_placed' && newStatus === 'in_progress') {
      const hasPendingOrders = purchaseOrders.some(po => po.status !== 'received' && po.status !== 'cancelled');
      if (hasPendingOrders) {
        return "Some purchase orders haven't been received yet. Start work anyway?";
      }
    }
    
    if (job.status === 'qc_complete' && newStatus === 'closed') {
      const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      if (totalPaid < totalInvoiced) {
        return `Outstanding balance of $${(totalInvoiced - totalPaid).toLocaleString('en-AU', { minimumFractionDigits: 2 })} remains unpaid. Close job anyway?`;
      }
    }
    
    return null;
  };

  const handleQuickStatusChange = async (job: Job, newStatus: string) => {
    const warning = await checkWorkflowGate(job, newStatus);
    if (warning) {
      setGateWarning({ show: true, message: warning, pendingJob: job, pendingStatus: newStatus });
    } else {
      updateMutation.mutate({ id: job.id, data: { status: newStatus } });
    }
  };

  const confirmStatusChange = () => {
    if (gateWarning.pendingJob && gateWarning.pendingStatus) {
      updateMutation.mutate({ id: gateWarning.pendingJob.id, data: { status: gateWarning.pendingStatus } });
    }
    setGateWarning({ show: false, message: "", pendingJob: null, pendingStatus: "" });
  };

  const getNextStatusAction = (currentStatus: string) => {
    switch (currentStatus) {
      case 'intake':
        return { label: 'Quote Sent', status: 'quoted', icon: FileText, color: 'text-purple-600' };
      case 'quoted':
        return { label: 'Approved', status: 'deposit_received', icon: CircleDollarSign, color: 'text-blue-600' };
      case 'deposit_received':
        return { label: 'Check Measure', status: 'check_measure', icon: Ruler, color: 'text-cyan-600' };
      case 'check_measure':
        return { label: 'Make Orders', status: 'make_orders', icon: Package, color: 'text-amber-600' };
      case 'make_orders':
        return { label: 'Orders Placed', status: 'orders_placed', icon: Package, color: 'text-indigo-600' };
      case 'orders_placed':
        return { label: 'Start Work', status: 'in_progress', icon: Play, color: 'text-yellow-600' };
      case 'in_progress':
        return { label: 'QC', status: 'qc', icon: ClipboardCheck, color: 'text-teal-600' };
      case 'qc':
        return { label: 'QC Complete', status: 'qc_complete', icon: ClipboardCheck, color: 'text-emerald-600' };
      case 'qc_complete':
        return { label: 'Close Job', status: 'closed', icon: Lock, color: 'text-green-600' };
      case 'closed':
        return null;
      case 'on_hold':
        return { label: 'Resume', status: 'in_progress', icon: Play, color: 'text-yellow-600' };
      case 'cancelled':
        return { label: 'Reopen', status: 'intake', icon: Inbox, color: 'text-slate-600' };
      default:
        return { label: 'Next Step', status: 'intake', icon: ArrowRight, color: 'text-slate-600' };
    }
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const exportToCSV = () => {
    const headers = [
      "Customer", "Site", "Reference", "Status", "Pricing Level", "LEADS", "Category #2",
      "Job Address", "Latitude", "Longitude", "Place Id", "Description",
      "Job Contact", "Job Contact Phone", "Job Contact Mobile",
      "Site Contact", "Site Contact Phone", "Site Contact Mobile",
      "Assigned To", "Start Date Time", "End Date Time",
      "Custom #1", "Custom #2", "Custom #3", "Custom #4"
    ];
    
    const rows = jobs.map(job => {
      const customer = customers.find(c => c.id === job.customerId);
      const assignedToStr = (job.assignedTo || []).map(id => {
        const crew = crewMembers.find(c => c.id === id);
        return crew?.name || id;
      }).join(", ");
      const startDateTime = job.scheduledDate ? 
        `${job.scheduledDate}${job.scheduledTime ? ' ' + job.scheduledTime : ''}` : '';
      
      return [
        customer?.name || "",
        "",
        job.referenceNumber || "",
        job.status || "",
        "",
        "",
        "",
        job.address || "",
        "",
        "",
        "",
        job.description || job.title || "",
        "",
        "",
        "",
        "",
        "",
        "",
        assignedToStr,
        startDateTime,
        "",
        "",
        "",
        "",
        ""
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobs_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${jobs.length} jobs` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Customer", "Site", "Reference", "Status", "Pricing Level", "LEADS", "Category #2",
      "Job Address", "Latitude", "Longitude", "Place Id", "Description",
      "Job Contact", "Job Contact Phone", "Job Contact Mobile",
      "Site Contact", "Site Contact Phone", "Site Contact Mobile",
      "Assigned To", "Start Date Time", "End Date Time",
      "Custom #1", "Custom #2", "Custom #3", "Custom #4"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "job_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template downloaded" });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: "No data rows found in CSV", variant: "destructive" });
        return;
      }

      const headers = parseCSVLine(lines[0]);
      const customerIdx = headers.findIndex(h => h.toLowerCase() === "customer");
      const addressIdx = headers.findIndex(h => h.toLowerCase() === "job address");
      const referenceIdx = headers.findIndex(h => h.toLowerCase() === "reference");
      const statusIdx = headers.findIndex(h => h.toLowerCase() === "status");
      const descriptionIdx = headers.findIndex(h => h.toLowerCase() === "description");
      const assignedToIdx = headers.findIndex(h => h.toLowerCase() === "assigned to");
      const startDateTimeIdx = headers.findIndex(h => h.toLowerCase() === "start date time");

      if (customerIdx === -1 && addressIdx === -1) {
        toast({ 
          title: "Invalid CSV format", 
          description: "Required column 'Customer' or 'Job Address' not found", 
          variant: "destructive" 
        });
        return;
      }

      const seenReferences = new Set<string>();
      const existingRefs = new Set(jobs.map(j => j.referenceNumber?.toLowerCase()).filter(Boolean));
      let created = 0;
      let skippedDuplicates = 0;
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const customerName = customerIdx >= 0 ? values[customerIdx]?.trim() : "";
        const address = addressIdx >= 0 ? values[addressIdx]?.trim() : "";
        
        if (!customerName && !address) continue;

        const reference = referenceIdx >= 0 ? values[referenceIdx]?.trim() : "";
        if (reference) {
          if (seenReferences.has(reference.toLowerCase()) || existingRefs.has(reference.toLowerCase())) {
            skippedDuplicates++;
            continue;
          }
          seenReferences.add(reference.toLowerCase());
        }

        const customer = customerName ? 
          customers.find(c => c.name.toLowerCase() === customerName.toLowerCase()) : null;

        const status = statusIdx >= 0 ? values[statusIdx]?.trim().toLowerCase() : "intake";
        const validStatuses = ["intake", "quoted", "deposit_received", "check_measure", "orders_placed", "in_progress", "qc_complete", "closed", "cancelled", "on_hold"];
        const finalStatus = validStatuses.includes(status) ? status : "intake";

        const description = descriptionIdx >= 0 ? values[descriptionIdx]?.trim() : "";
        const assignedToStr = assignedToIdx >= 0 ? values[assignedToIdx]?.trim() : "";
        const assignedTo = assignedToStr ? assignedToStr.split(",").map(s => s.trim()).filter(Boolean) : [];

        let scheduledDate = "";
        let scheduledTime = "";
        if (startDateTimeIdx >= 0 && values[startDateTimeIdx]?.trim()) {
          const dateTimeStr = values[startDateTimeIdx].trim();
          const parts = dateTimeStr.split(" ");
          scheduledDate = parts[0] || "";
          scheduledTime = parts.slice(1).join(" ") || "";
        }

        const newJob: InsertJob = {
          id: `job_${Date.now()}_${i}`,
          organizationId: "",
          title: description || `Job for ${customerName || address}`,
          description: description || null,
          customerId: customer?.id || null,
          address: address || customer?.address || "",
          referenceNumber: reference || null,
          status: finalStatus,
          priority: "normal",
          assignedTo: assignedTo.length > 0 ? assignedTo : null,
          scheduledDate: scheduledDate || null,
          scheduledTime: scheduledTime || null,
        };

        try {
          await createJob(newJob);
          created++;
        } catch (error) {
          console.error("Error creating job:", error);
        }
      }

      if (created === 0) {
        toast({ title: "No jobs were imported", variant: "destructive" });
        return;
      }

      const duplicateMsg = skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicates skipped)` : "";
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: `Imported ${created} jobs successfully${duplicateMsg}` });
      setImportDialogOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import jobs", variant: "destructive" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    try {
      for (const job of jobs) {
        await deleteJob(job.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setDeleteAllDialogOpen(false);
      toast({ title: `Deleted ${jobs.length} jobs` });
    } catch (error) {
      toast({ title: "Failed to delete jobs", variant: "destructive" });
    }
  };

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const customer = customers.find(c => c.id === job.customerId);
    const matchesSearch = (customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.assignedTo || []).some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
    const closedStatuses = ['closed', 'cancelled'];
    const matchesStatus = statusFilter === "all" 
      ? true 
      : statusFilter === "active" 
        ? !closedStatuses.includes(job.status)
        : job.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [jobs, customers, searchQuery, statusFilter]);

  // Sort jobs by workflow order (intake first, progressing through stages)
  const sortedJobs = useMemo(() => [...filteredJobs].sort((a, b) => {
    const orderA = WORKFLOW_ORDER.indexOf(a.status);
    const orderB = WORKFLOW_ORDER.indexOf(b.status);
    return orderA - orderB;
  }), [filteredJobs]);

  const stats = useMemo(() => ({
    total: jobs.length,
    intake: jobs.filter(j => j.status === 'intake' || j.status === 'quoted' || j.status === 'deposit_received').length,
    inProgress: jobs.filter(j => ['check_measure', 'orders_placed', 'in_progress'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'qc_complete' || j.status === 'closed').length,
  }), [jobs]);

  return (
    <Layout>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary tracking-tight" data-testid="text-jobs-title">
              Jobs
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage all your jobs</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={jobs.length === 0}
                data-testid="button-delete-all"
              >
                <Trash2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete All</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 sm:h-10" data-testid="button-import-export">
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Import/Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} data-testid="button-export">
                  <Download className="h-4 w-4 mr-2" />
                  Export Jobs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Jobs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate} data-testid="button-download-template">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {templates.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-quick-create">
                    <Clipboard className="h-4 w-4 mr-2" aria-hidden="true" />
                    Quick Create
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Create from Template</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {templates.filter(t => t.isActive === 'true').map((template) => (
                    <DropdownMenuItem 
                      key={template.id} 
                      onClick={() => {
                        setLocation(`/job/new?template=${template.id}`);
                      }}
                      data-testid={`template-option-${template.id}`}
                    >
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.category && <span className="text-xs text-muted-foreground">{template.category}</span>}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={handleCreate} className="gap-2 flex-1 sm:flex-none h-11 sm:h-10 active:scale-95 transition-transform" data-testid="button-new-job">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Job
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-full bg-slate-100 dark:bg-slate-800">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                <Inbox className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{stats.intake}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Pre-Work</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-300" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 sm:h-10"
                  data-testid="input-search-jobs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-11 sm:h-10" data-testid="select-filter-status">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="intake">Intake</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="deposit_received">Approved to Proceed</SelectItem>
                  <SelectItem value="check_measure">Check Measure</SelectItem>
                  <SelectItem value="make_orders">Make Orders</SelectItem>
                  <SelectItem value="orders_placed">Orders Placed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="qc">QC</SelectItem>
                  <SelectItem value="qc_complete">QC Complete</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to load jobs</h3>
                <p className="text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "Something went wrong. Please try again."}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4].map((i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-40" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : sortedJobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery || (statusFilter !== "all" && statusFilter !== "active") ? "No jobs match your search" : "No jobs yet. Create your first job!"}
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {sortedJobs.map((job) => {
                  const customer = customers.find(c => c.id === job.customerId);
                  const jobNumber = getJobDisplayNumber(job);
                  const nextAction = getNextStatusAction(job.status);
                  return (
                    <Card 
                      key={job.id}
                      className="cursor-pointer active:scale-[0.98] transition-transform"
                      onClick={() => handleViewJob(job.id)}
                      data-testid={`card-job-${job.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-primary">{jobNumber}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="font-medium truncate">{customer?.name || 'No customer'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{job.address || 'No address'}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-2 text-sm">
                              {(() => {
                                const appt = appointmentsByJob.get(job.id);
                                const displayDate = job.scheduledDate || appt?.date;
                                const displayTime = job.scheduledTime || appt?.time;
                                return (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3 text-muted-foreground" />
                                      {displayDate ? safeFormatDate(displayDate, 'MMM d') : '—'}
                                    </span>
                                    {displayTime && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        {displayTime}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge className={`${statusColors[job.status]} text-white text-xs`}>
                              {statusLabels[job.status]}
                            </Badge>
                            <Badge className={`${priorityColors[job.priority]} text-xs`}>
                              {priorityLabels[job.priority]}
                            </Badge>
                          </div>
                        </div>
                        {nextAction && (
                          <Button 
                            variant="outline"
                            size="sm"
                            className={`w-full mt-3 h-10 ${nextAction.color}`}
                            onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(job, nextAction.status); }}
                            data-testid={`button-action-${job.id}`}
                          >
                            <nextAction.icon className="h-4 w-4 mr-2" />
                            {nextAction.label}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="hidden md:table-cell">Assigned</TableHead>
                    <TableHead className="hidden sm:table-cell">Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedJobs.map((job) => {
                    const customer = customers.find(c => c.id === job.customerId);
                    const jobNumber = getJobDisplayNumber(job);
                    return (
                    <TableRow 
                      key={job.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewJob(job.id)}
                      data-testid={`row-job-${job.id}`}
                    >
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">{jobNumber}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="font-medium truncate">{customer?.name || 'No customer'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[220px]">{job.address || 'No address'}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const appt = appointmentsByJob.get(job.id);
                          const displayDate = job.scheduledDate || appt?.date;
                          const displayTime = job.scheduledTime || appt?.time;
                          return (
                            <>
                              <div className="text-sm">
                                {displayDate ? safeFormatDate(displayDate, 'MMM d, yyyy') : '—'}
                              </div>
                              {displayTime && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {displayTime}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {job.assignedTo && job.assignedTo.length > 0 ? (
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {job.assignedTo.length === 1 
                              ? crewMembers.find(c => c.id === job.assignedTo![0])?.name?.split(' ')[0] || 'Crew'
                              : `${job.assignedTo.length} crew`}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge className={priorityColors[job.priority]}>
                          {priorityLabels[job.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent" data-testid={`button-status-${job.id}`}>
                              <Badge className={`${statusColors[job.status]} text-white cursor-pointer flex items-center gap-1`}>
                                {statusLabels[job.status]}
                                <ChevronDown className="h-3 w-3" />
                              </Badge>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Workflow Status</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'intake')} disabled={job.status === 'intake'}>
                              <Inbox className="h-4 w-4 mr-2 text-slate-600" /> Intake
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'quoted')} disabled={job.status === 'quoted'}>
                              <FileText className="h-4 w-4 mr-2 text-purple-600" /> Quoted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'deposit_received')} disabled={job.status === 'deposit_received'}>
                              <CircleDollarSign className="h-4 w-4 mr-2 text-blue-600" /> Approved to Proceed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'check_measure')} disabled={job.status === 'check_measure'}>
                              <Ruler className="h-4 w-4 mr-2 text-cyan-600" /> Check Measure
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'make_orders')} disabled={job.status === 'make_orders'}>
                              <Package className="h-4 w-4 mr-2 text-amber-600" /> Make Orders
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'orders_placed')} disabled={job.status === 'orders_placed'}>
                              <Package className="h-4 w-4 mr-2 text-indigo-600" /> Orders Placed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'in_progress')} disabled={job.status === 'in_progress'}>
                              <Play className="h-4 w-4 mr-2 text-yellow-600" /> In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'qc')} disabled={job.status === 'qc'}>
                              <ClipboardCheck className="h-4 w-4 mr-2 text-teal-600" /> QC
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'qc_complete')} disabled={job.status === 'qc_complete'}>
                              <ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" /> QC Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'closed')} disabled={job.status === 'closed'}>
                              <Lock className="h-4 w-4 mr-2 text-green-600" /> Closed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'on_hold')} disabled={job.status === 'on_hold'}>
                              <Pause className="h-4 w-4 mr-2 text-orange-600" /> On Hold
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickStatusChange(job, 'cancelled')} disabled={job.status === 'cancelled'}>
                              <XCircle className="h-4 w-4 mr-2 text-gray-600" /> Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {(() => {
                            const nextAction = getNextStatusAction(job.status);
                            if (nextAction) {
                              const Icon = nextAction.icon;
                              return (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className={`h-8 px-2 ${nextAction.color}`}
                                  onClick={() => handleQuickStatusChange(job, nextAction.status)}
                                  data-testid={`button-quick-action-${job.id}`}
                                  title={nextAction.label}
                                >
                                  <Icon className="h-4 w-4 mr-1" />
                                  <span className="hidden sm:inline text-xs">{nextAction.label}</span>
                                </Button>
                              );
                            }
                            return null;
                          })()}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-more-${job.id}`} aria-label={`More options for ${job.title}`}>
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(job)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Job
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleViewJob(job.id)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Jobs</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with job data. Use the template format or download our template.
              </p>
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  disabled={importing}
                  data-testid="input-csv-file"
                />
              </div>
              {importing && (
                <p className="text-sm text-muted-foreground">Importing jobs...</p>
              )}
              <Button variant="outline" onClick={downloadTemplate} className="w-full" data-testid="button-dialog-download-template">
                <FileText className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Jobs</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {jobs.length} jobs? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteAll}
                className="bg-destructive text-destructive-foreground"
              >
                Delete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={gateWarning.show} onOpenChange={(open) => !open && setGateWarning({ show: false, message: "", pendingJob: null, pendingStatus: "" })}>
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
