import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Save, ArrowLeft, Loader2, Trash2, Phone, Mail, Briefcase, FileText, Receipt, Package } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchCustomer, createCustomer, updateCustomer, deleteCustomer, fetchJobs, fetchQuotes, fetchInvoices, fetchPurchaseOrders } from "@/lib/api";
import type { InsertCustomer, Job, Quote, Invoice, PurchaseOrder } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const jobStatusColors: Record<string, string> = {
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
  on_hold: "bg-orange-500",
};

const jobStatusLabels: Record<string, string> = {
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
  cancelled: "Cancelled",
};

const quoteStatusColors: Record<string, string> = {
  draft: "bg-gray-500",
  approved: "bg-green-600",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-orange-500",
};

const quoteStatusLabels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

const invoiceStatusColors: Record<string, string> = {
  draft: "bg-gray-500",
  approved: "bg-emerald-500",
  sent: "bg-blue-500",
  paid: "bg-green-500",
  overdue: "bg-red-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400",
};

const invoiceStatusLabels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partial",
  cancelled: "Cancelled",
};

const poStatusColors: Record<string, string> = {
  draft: "bg-gray-500",
  ordered: "bg-blue-500",
  received: "bg-green-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400",
};

const poStatusLabels: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  received: "Received",
  partial: "Partial",
  cancelled: "Cancelled",
};

export default function CustomerEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/customer/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formData, setFormData] = useState<InsertCustomer>({
    id: `cust_${crypto.randomUUID()}`,
    organizationId: "",
    name: "",
    email: null,
    phone: null,
    address: null,
    suburb: null,
    state: null,
    postcode: null,
    notes: null,
  });

  useEffect(() => {
    if (!isNew && params?.id) {
      loadCustomer(params.id);
    }
  }, [isNew, params?.id]);

  const loadCustomer = async (id: string) => {
    setLoading(true);
    try {
      const customer = await fetchCustomer(id);
      if (customer) {
        setFormData({
          id: customer.id,
          organizationId: "",
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          suburb: customer.suburb,
          state: customer.state,
          postcode: customer.postcode,
          notes: customer.notes,
        });
      }
    } catch (err) {
      console.error("Failed to load customer:", err);
      toast({ title: "Failed to load customer", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data: InsertCustomer = {
        id: formData.id || `cust_${crypto.randomUUID()}`,
        organizationId: "",
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        address: formData.address?.trim() || null,
        suburb: formData.suburb?.trim() || null,
        state: formData.state?.trim() || null,
        postcode: formData.postcode?.trim() || null,
        notes: formData.notes?.trim() || null,
      };

      if (isNew) {
        await createCustomer(data);
        toast({ title: "Customer created successfully" });
      } else {
        await updateCustomer(params!.id, data);
        toast({ title: "Customer updated successfully" });
      }
      setLocation("/customers");
    } catch (err) {
      console.error("Failed to save customer:", err);
      toast({ title: "Failed to save customer", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(params!.id);
      toast({ title: "Customer deleted" });
      setLocation("/customers");
    } catch (err) {
      toast({ title: "Failed to delete customer", variant: "destructive" });
    }
  };

  const { data: allJobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: fetchJobs,
    enabled: !isNew && !loading,
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: fetchQuotes,
    enabled: !isNew && !loading,
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: fetchInvoices,
    enabled: !isNew && !loading,
  });

  const { data: allPurchaseOrders = [] } = useQuery({
    queryKey: ["/api/purchase-orders"],
    queryFn: fetchPurchaseOrders,
    enabled: !isNew && !loading,
  });

  const customerJobs = useMemo(
    () => allJobs.filter((j) => j.customerId === params?.id),
    [allJobs, params?.id]
  );

  const customerQuotes = useMemo(
    () => allQuotes.filter((q) => q.customerId === params?.id),
    [allQuotes, params?.id]
  );

  const customerInvoices = useMemo(
    () => allInvoices.filter((i) => i.customerId === params?.id),
    [allInvoices, params?.id]
  );

  const customerPOs = useMemo(() => {
    const jobIds = new Set(customerJobs.map((j) => j.id));
    return allPurchaseOrders.filter((po) => po.jobId && jobIds.has(po.jobId));
  }, [allPurchaseOrders, customerJobs]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const detailsForm = (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Customer Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Name *</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Customer name"
              className="h-11 min-h-[44px] text-base"
              data-testid="input-customer-name"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-customer-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="0400 000 000"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-customer-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">Address</Label>
            <AddressAutocomplete
              value={formData.address || ""}
              onChange={(value) => {
                if (!value.trim()) {
                  setFormData({ ...formData, address: value, suburb: null, state: null, postcode: null });
                } else {
                  setFormData({ ...formData, address: value });
                }
              }}
              onPlaceSelect={(components) => {
                setFormData(prev => ({
                  ...prev,
                  suburb: components.suburb || null,
                  state: components.state || null,
                  postcode: components.postcode || null,
                }));
              }}
              placeholder="Start typing an address..."
              className="h-11 min-h-[44px] text-base"
              data-testid="input-customer-address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={4}
              className="text-base min-h-[100px]"
              data-testid="input-customer-notes"
            />
          </div>
        </CardContent>
      </Card>
    </>
  );

  const jobsTab = (
    <div className="space-y-3" data-testid="tab-content-jobs">
      {customerJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No jobs found for this customer</p>
          </CardContent>
        </Card>
      ) : (
        customerJobs.map((job) => (
          <Card
            key={job.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation(`/jobs/${job.id}`)}
            data-testid={`card-job-${job.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" data-testid={`text-job-title-${job.id}`}>
                    {job.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1" data-testid={`text-job-address-${job.id}`}>
                    {job.address}
                  </p>
                  {job.referenceNumber && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ref: {job.referenceNumber}
                    </p>
                  )}
                </div>
                <Badge className={`${jobStatusColors[job.status] || "bg-gray-500"} text-white text-xs shrink-0`} data-testid={`badge-job-status-${job.id}`}>
                  {jobStatusLabels[job.status] || job.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const quotesTab = (
    <div className="space-y-3" data-testid="tab-content-quotes">
      {customerQuotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No quotes found for this customer</p>
          </CardContent>
        </Card>
      ) : (
        customerQuotes.map((quote) => (
          <Card
            key={quote.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation(`/quote/${quote.id}`)}
            data-testid={`card-quote-${quote.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-quote-number-${quote.id}`}>
                    {quote.quoteNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {quote.address}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={`${quoteStatusColors[quote.status] || "bg-gray-500"} text-white text-xs`} data-testid={`badge-quote-status-${quote.id}`}>
                    {quoteStatusLabels[quote.status] || quote.status}
                  </Badge>
                  <span className="text-sm font-semibold" data-testid={`text-quote-total-${quote.id}`}>
                    ${quote.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const invoicesTab = (
    <div className="space-y-3" data-testid="tab-content-invoices">
      {customerInvoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No invoices found for this customer</p>
          </CardContent>
        </Card>
      ) : (
        customerInvoices.map((invoice) => (
          <Card
            key={invoice.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation(`/invoice/${invoice.id}`)}
            data-testid={`card-invoice-${invoice.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                    {invoice.invoiceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {invoice.dueDate}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={`${invoiceStatusColors[invoice.status] || "bg-gray-500"} text-white text-xs`} data-testid={`badge-invoice-status-${invoice.id}`}>
                    {invoiceStatusLabels[invoice.status] || invoice.status}
                  </Badge>
                  <span className="text-sm font-semibold" data-testid={`text-invoice-total-${invoice.id}`}>
                    ${invoice.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  const posTab = (
    <div className="space-y-3" data-testid="tab-content-purchase-orders">
      {customerPOs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">No purchase orders found for this customer</p>
          </CardContent>
        </Card>
      ) : (
        customerPOs.map((po) => (
          <Card
            key={po.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation(`/purchase-order/${po.id}`)}
            data-testid={`card-po-${po.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-po-number-${po.id}`}>
                    {po.poNumber}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" data-testid={`text-po-supplier-${po.id}`}>
                    {po.supplier}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={`${poStatusColors[po.status] || "bg-gray-500"} text-white text-xs`} data-testid={`badge-po-status-${po.id}`}>
                    {poStatusLabels[po.status] || po.status}
                  </Badge>
                  <span className="text-sm font-semibold" data-testid={`text-po-total-${po.id}`}>
                    ${po.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <Layout>
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/customers" data-testid="breadcrumb-customers">Customers</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">
              {isNew ? "New Customer" : formData.name || "Edit Customer"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/customers")} className="h-11 w-11" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-primary" data-testid="text-page-title">
              {isNew ? "New Customer" : formData.name || "Edit Customer"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && formData.phone && (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                asChild
                data-testid="button-call-customer"
              >
                <a href={`tel:${formData.phone}`}>
                  <Phone className="h-5 w-5" />
                </a>
              </Button>
            )}
            {!isNew && formData.email && (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                asChild
                data-testid="button-email-customer"
              >
                <a href={`mailto:${formData.email}`}>
                  <Mail className="h-5 w-5" />
                </a>
              </Button>
            )}
            {!isNew && (
              <Button variant="outline" size="icon" onClick={() => setShowDeleteDialog(true)} className="h-11 w-11 text-destructive" data-testid="button-delete-customer">
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="h-11 min-h-[44px]" data-testid="button-save-customer">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      {isNew ? (
        detailsForm
      ) : (
        <Tabs defaultValue="details" data-testid="customer-tabs">
          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <TabsList className="w-full md:w-auto min-w-max" data-testid="customer-tabs-list">
              <TabsTrigger value="details" className="min-h-[44px] px-4" data-testid="tab-trigger-details">
                Details
              </TabsTrigger>
              <TabsTrigger value="jobs" className="min-h-[44px] px-4" data-testid="tab-trigger-jobs">
                Jobs {customerJobs.length > 0 && `(${customerJobs.length})`}
              </TabsTrigger>
              <TabsTrigger value="quotes" className="min-h-[44px] px-4" data-testid="tab-trigger-quotes">
                Quotes {customerQuotes.length > 0 && `(${customerQuotes.length})`}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="min-h-[44px] px-4" data-testid="tab-trigger-invoices">
                Invoices {customerInvoices.length > 0 && `(${customerInvoices.length})`}
              </TabsTrigger>
              <TabsTrigger value="purchase-orders" className="min-h-[44px] px-4" data-testid="tab-trigger-purchase-orders">
                POs {customerPOs.length > 0 && `(${customerPOs.length})`}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="details" data-testid="tab-content-details">
            {detailsForm}
          </TabsContent>
          <TabsContent value="jobs">
            {jobsTab}
          </TabsContent>
          <TabsContent value="quotes">
            {quotesTab}
          </TabsContent>
          <TabsContent value="invoices">
            {invoicesTab}
          </TabsContent>
          <TabsContent value="purchase-orders">
            {posTab}
          </TabsContent>
        </Tabs>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
