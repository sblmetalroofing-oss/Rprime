import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { 
  ArrowLeft, 
  Save, 
  ChevronsUpDown,
  Check,
  Loader2,
  Briefcase,
  Trash2,
  Plus
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  fetchJob,
  createJob, 
  updateJob,
  deleteJob,
  fetchCustomers,
  createCustomer,
  fetchCrewMembers,
  fetchJobTemplates,
  type JobTemplate
} from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { InsertJob, InsertCustomer, Customer, CrewMember } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { cn, formatJobNumber } from "@/lib/utils";

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

export default function JobEditor() {
  const [, setLocation] = useLocation();
  const [matchNew] = useRoute("/job/new");
  const [matchEdit, editParams] = useRoute("/job/:id/edit");
  const isNew = matchNew;
  const jobId = editParams?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState<Partial<InsertCustomer>>({
    name: "",
    email: "",
    phone: "",
  });
  
  const templateId = new URLSearchParams(window.location.search).get('template');

  const [formData, setFormData] = useState<InsertJob>({
    id: `job_${Date.now()}`,
    title: "Job",
    description: "",
    address: "",
    suburb: "",
    scheduledDate: "",
    scheduledTime: "",
    estimatedDuration: null,
    status: "intake",
    priority: "normal",
    assignedTo: [],
    notes: "",
    customerId: null,
  });

  useEffect(() => {
    loadInitialData();
  }, [isNew, jobId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [customersData, crewData, templates] = await Promise.all([
        fetchCustomers(),
        fetchCrewMembers(),
        isNew && templateId ? fetchJobTemplates() : Promise.resolve([])
      ]);
      setCustomers(customersData);
      setCrewMembers(crewData);

      if (isNew && templateId && templates.length > 0) {
        const template = templates.find((t: JobTemplate) => t.id === templateId);
        if (template) {
          setFormData(prev => ({
            ...prev,
            title: template.defaultTitle || "Job",
            description: template.defaultDescription || "",
            estimatedDuration: template.estimatedDuration,
            priority: template.priority || "normal",
          }));
        }
      }

      if (!isNew && jobId) {
        const job = await fetchJob(jobId);
        if (job) {
          setFormData({
            id: job.id,
            title: job.title,
            description: job.description || "",
            address: job.address,
            suburb: job.suburb || "",
            scheduledDate: job.scheduledDate || "",
            scheduledTime: job.scheduledTime || "",
            estimatedDuration: job.estimatedDuration,
            status: job.status,
            priority: job.priority,
            assignedTo: job.assignedTo || [],
            notes: job.notes || "",
            customerId: job.customerId,
            builderReference: job.builderReference || "",
          });
        } else {
          toast({ title: "Job not found", variant: "destructive" });
          setLocation("/jobs");
          return;
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (customerId: string | null) => {
    // Only set the customer ID - don't auto-fill address
    // Builders/customers can have many different site addresses
    setFormData(prev => ({ ...prev, customerId: customerId || null }));
  };

  const handleSave = async () => {
    if (!formData.address) {
      toast({ title: "Address is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      const autoTitle = selectedCustomer?.name || formData.address.split(',')[0] || "Job";
      const dataToSave = { 
        ...formData, 
        title: autoTitle,
        scheduledDate: formData.scheduledDate || null,
        scheduledTime: formData.scheduledTime || null,
      };

      if (isNew) {
        const created = await createJob(dataToSave);
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        toast({ title: "Job created successfully" });
        setLocation(`/jobs/${created.id}`);
      } else {
        await updateJob(formData.id, dataToSave);
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        toast({ title: "Job updated successfully" });
        setLocation(`/jobs/${formData.id}`);
      }
    } catch (error) {
      console.error("Error saving job:", error);
      toast({ title: "Failed to save job", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isNew) {
      setLocation("/jobs");
    } else {
      setLocation(`/jobs/${jobId}`);
    }
  };

  const handleDelete = async () => {
    if (!jobId) return;
    
    setDeleting(true);
    try {
      await deleteJob(jobId);
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job deleted successfully" });
      setLocation("/jobs");
    } catch (error) {
      console.error("Error deleting job:", error);
      toast({ title: "Failed to delete job", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerData.name?.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }

    setSavingCustomer(true);
    try {
      const customerData: InsertCustomer = {
        id: `cust_${Date.now()}`,
        name: newCustomerData.name.trim(),
        email: newCustomerData.email?.trim() || null,
        phone: newCustomerData.phone?.trim() || null,
        address: null,
        suburb: null,
        postcode: null,
        state: null,
        notes: null,
      };
      
      const created = await createCustomer(customerData);
      if (created) {
        setCustomers(prev => [...prev, created]);
        setFormData(prev => ({
          ...prev,
          customerId: created.id,
        }));
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast({ title: "Customer created successfully" });
        setNewCustomerOpen(false);
        setNewCustomerData({ name: "", email: "", phone: "" });
      }
    } catch (error) {
      console.error("Error creating customer:", error);
      toast({ title: "Failed to create customer", variant: "destructive" });
    } finally {
      setSavingCustomer(false);
    }
  };

  const activeCrewMembers = crewMembers.filter(m => m.isActive === 'true');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumb className="mb-4 hidden md:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/jobs" data-testid="breadcrumb-jobs">Jobs</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">
                {isNew ? "New Job" : "Edit Job"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-11 w-11 shrink-0" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{isNew ? "New Job" : "Edit Job"}</h1>
              {!isNew && formData.id && (
                <p className="text-sm text-muted-foreground">#{formData.id.slice(-8).toUpperCase()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isNew && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleting} className="h-11 flex-1 sm:flex-none" data-testid="button-delete-job">
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="mx-4 max-w-[calc(100vw-2rem)]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this job?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete this job and all its associated data including quotes, invoices, reports, and purchase orders. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="h-11">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Job
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSave} disabled={saving || !formData.address} className="h-11 flex-1 sm:flex-none" data-testid="button-save-job">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Saving..." : "Save Job"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Briefcase className="h-5 w-5" />
                  Job Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-5">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Customer</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <SearchableSelect
                        value={formData.customerId ?? null}
                        onValueChange={handleCustomerChange}
                        options={customers.map(c => ({ 
                          value: c.id, 
                          label: c.name, 
                          sublabel: c.address || c.email || undefined 
                        }))}
                        placeholder="Select customer"
                        searchPlaceholder="Search customers..."
                        emptyText="No customers found."
                        data-testid="select-job-customer"
                      />
                    </div>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setNewCustomerOpen(true)}
                      className="h-11 w-full sm:w-auto"
                      data-testid="button-new-customer"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Customer
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Address *</Label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                    placeholder="Start typing an address..."
                    data-testid="input-job-address"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Description</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Job details..."
                    className="min-h-[100px]"
                    data-testid="input-job-description"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Builder Reference</Label>
                  <Input
                    value={formData.builderReference || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, builderReference: e.target.value }))}
                    placeholder="Customer/builder PO or project reference"
                    className="h-11"
                    data-testid="input-job-builder-reference"
                  />
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">Optional - flows through to linked quotes and invoices</p>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Notes</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    rows={3}
                    className="min-h-[80px]"
                    data-testid="input-job-notes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Status & Priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="h-11" data-testid="select-job-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="py-3">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium mb-2 block">Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                    <SelectTrigger className="h-11" data-testid="select-job-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="py-3">{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* New Customer Dialog */}
      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Name *</Label>
              <Input
                value={newCustomerData.name || ""}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
                className="h-11"
                data-testid="input-new-customer-name"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Email</Label>
              <Input
                type="email"
                value={newCustomerData.email || ""}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email address"
                className="h-11"
                data-testid="input-new-customer-email"
              />
            </div>
            <div>
              <Label className="text-sm font-medium mb-2 block">Phone</Label>
              <Input
                value={newCustomerData.phone || ""}
                onChange={(e) => setNewCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Phone number"
                className="h-11"
                inputMode="tel"
                data-testid="input-new-customer-phone"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setNewCustomerOpen(false)} className="h-11 w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleCreateCustomer} disabled={savingCustomer} className="h-11 w-full sm:w-auto" data-testid="button-save-new-customer">
              {savingCustomer ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {savingCustomer ? "Creating..." : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
