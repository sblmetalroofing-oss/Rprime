import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  FileText, 
  Trash2,
  Send,
  CreditCard,
  Eye,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Download,
  Upload,
  CloudOff,
  Cloud,
  Search,
  X,
  ArrowUpDown,
  Calendar,
  Filter,
  RefreshCw
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  fetchInvoices, 
  createInvoice, 
  updateInvoice, 
  deleteInvoice, 
  getNextInvoiceNumber,
  fetchCustomers,
  fetchJobs,
  fetchDocumentThemes,
  type InvoiceWithItems,
  type DocumentTheme
} from "@/lib/api";
import type { Invoice, InsertInvoice, InvoiceItem, Customer, Job } from "@shared/schema";
import { addDays } from "date-fns";
import { formatDateShort, getTodayInput, formatDateInput } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PdfPreviewModal, prepareInvoiceData } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  approved: "bg-emerald-500",
  sent: "bg-blue-500",
  paid: "bg-green-500",
  overdue: "bg-red-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400"
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partial",
  cancelled: "Cancelled"
};

type InvoiceItemInput = {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  itemCode: string | null;
  costPrice: number | null;
  productId: string | null;
  sortOrder: number | null;
  section: string | null;
};

function InvoiceForm({ 
  invoice, 
  customers,
  jobs,
  onSave, 
  onClose, 
  isLoading,
  nextNumber,
  initialJobId
}: { 
  invoice?: InvoiceWithItems; 
  customers: Customer[];
  jobs: Job[];
  onSave: (data: InsertInvoice & { items: InvoiceItemInput[] }) => void; 
  onClose: () => void;
  isLoading: boolean;
  nextNumber: string;
  initialJobId?: string | null;
}) {
  const [formData, setFormData] = useState<InsertInvoice>({
    id: invoice?.id || `inv_${Date.now()}`,
    organizationId: invoice?.organizationId || "",
    invoiceNumber: invoice?.invoiceNumber || nextNumber,
    customerName: invoice?.customerName || "",
    customerEmail: invoice?.customerEmail || "",
    customerPhone: invoice?.customerPhone || "",
    address: invoice?.address || "",
    suburb: invoice?.suburb || "",
    status: invoice?.status || "draft",
    issueDate: invoice?.issueDate || getTodayInput(),
    dueDate: invoice?.dueDate || formatDateInput(addDays(new Date(), 14)),
    subtotal: invoice?.subtotal || 0,
    gst: invoice?.gst || 0,
    total: invoice?.total || 0,
    amountPaid: invoice?.amountPaid || 0,
    notes: invoice?.notes || "",
    terms: invoice?.terms || "Payment due within 14 days.",
    customerId: invoice?.customerId || null,
    quoteId: invoice?.quoteId || null,
    jobId: invoice?.jobId || initialJobId || null,
  });

  const [items, setItems] = useState<InvoiceItemInput[]>(
    invoice?.items?.map(i => ({
      id: i.id,
      description: i.description,
      qty: i.qty,
      unitCost: i.unitCost,
      total: i.total,
      itemCode: i.itemCode ?? null,
      costPrice: i.costPrice ?? null,
      productId: i.productId ?? null,
      sortOrder: i.sortOrder ?? null,
      section: i.section ?? null
    })) || []
  );

  const handleCustomerChange = (customerId: string) => {
    if (customerId === "none") {
      setFormData(prev => ({ ...prev, customerId: null }));
      return;
    }
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customerId,
        customerName: customer.name,
        customerEmail: customer.email || "",
        customerPhone: customer.phone || "",
        address: customer.address || "",
        suburb: customer.suburb || "",
      }));
    }
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: "",
      qty: 1,
      unitCost: 0,
      total: 0,
      itemCode: null,
      costPrice: null,
      productId: null,
      sortOrder: null,
      section: null
    }]);
  };

  const updateItem = (index: number, field: keyof InvoiceItemInput, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'unitCost') {
        // Round to 2 decimal places to avoid floating point precision issues
        updated[index].total = Math.round(updated[index].qty * updated[index].unitCost * 100) / 100;
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    // Round all currency values to 2 decimal places to avoid floating point issues
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    const gst = Math.round(subtotal * 0.1 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;
    setFormData(prev => ({ ...prev, subtotal, gst, total }));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label>Invoice Number</Label>
          <Input value={formData.invoiceNumber} disabled data-testid="input-invoice-number" className="h-11" />
        </div>
        <div>
          <Label>Issue Date</Label>
          <Input
            type="date"
            value={formData.issueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
            data-testid="input-invoice-issue"
            className="h-11"
          />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            data-testid="input-invoice-due"
            className="h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Job (Optional)</Label>
          <Select 
            value={formData.jobId ?? "none"} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, jobId: value === "none" ? null : value }))}
          >
            <SelectTrigger data-testid="select-invoice-job">
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No linked job</SelectItem>
              {jobs.map(j => (
                <SelectItem key={j.id} value={j.id}>{j.title} - {j.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Customer</Label>
          <Select value={formData.customerId ?? "none"} onValueChange={handleCustomerChange}>
            <SelectTrigger data-testid="select-invoice-customer">
              <SelectValue placeholder="Select customer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Select customer</SelectItem>
              {customers.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Customer Name *</Label>
          <Input
            value={formData.customerName}
            onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
            data-testid="input-invoice-customer-name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.customerEmail || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            data-testid="input-invoice-email"
          />
        </div>
      </div>

      <div>
        <Label>Address *</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          data-testid="input-invoice-address"
        />
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">Line Items</Label>
          <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-invoice-item">
            <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
            Add Item
          </Button>
        </div>
        
        {items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Textarea
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Description"
                      rows={2}
                      className="min-h-[60px] resize-none"
                      data-testid={`input-item-desc-${index}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell className="font-medium">${item.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(index)}
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>${(formData.subtotal || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (10%):</span>
              <span>${(formData.gst || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total:</span>
              <span>${(formData.total || 0).toFixed(2)}</span>
            </div>
            {(formData.amountPaid || 0) > 0 && (
              <>
                <div className="flex justify-between text-green-600">
                  <span>Paid:</span>
                  <span>${(formData.amountPaid || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Balance Due:</span>
                  <span>${((formData.total || 0) - (formData.amountPaid || 0)).toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
            <SelectTrigger data-testid="select-invoice-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount Paid</Label>
          <Input
            type="number"
            step="0.01"
            value={formData.amountPaid}
            onChange={(e) => setFormData(prev => ({ ...prev, amountPaid: parseFloat(e.target.value) || 0 }))}
            data-testid="input-invoice-paid"
          />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
          data-testid="input-invoice-notes"
        />
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-invoice">Cancel</Button>
        <Button 
          onClick={() => onSave({ ...formData, items })} 
          disabled={isLoading || !formData.customerName || !formData.address}
          data-testid="button-save-invoice"
        >
          {isLoading ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    </div>
  );
}

export default function Invoices() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isAdmin, canDelete } = usePermissions();
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [nextNumber, setNextNumber] = useState("");
  const [preselectedJobId, setPreselectedJobId] = useState<string | null>(() => {
    const params = new URLSearchParams(search);
    return params.get('jobId');
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewDocument, setPreviewDocument] = useState<InvoiceWithItems | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailDialogInvoice, setEmailDialogInvoice] = useState<InvoiceWithItems | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(search);
    return params.get('status') || "all";
  });
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [dateFilterType, setDateFilterType] = useState<"issue" | "due">("issue");
  const [sortBy, setSortBy] = useState<string>("newest");

  useEffect(() => {
    fetchDocumentThemes().then(t => setThemes(t.filter(th => th.isArchived !== 'true')));
  }, []);

  // Handle query params from job detail page
  useEffect(() => {
    const params = new URLSearchParams(search);
    const newInvoice = params.get('newInvoice');
    const jobId = params.get('jobId');
    
    if (newInvoice === 'true') {
      if (jobId) setPreselectedJobId(jobId);
      handleCreate(jobId);
      // Clear the query params after processing
      setLocation('/invoices', { replace: true });
    }
  }, [search]);

  const { data: invoices = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/invoices'],
    queryFn: fetchInvoices
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => fetchCustomers()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: fetchJobs
  });

  // Fetch Xero connection status and invoice sync statuses
  const { data: xeroStatus } = useQuery({
    queryKey: ['/api/xero/status'],
    queryFn: async () => {
      const res = await fetch('/api/xero/status');
      if (!res.ok) return { connected: false };
      return res.json();
    }
  });

  const { data: xeroSyncMap = {} } = useQuery({
    queryKey: ['/api/xero/invoice-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/xero/invoice-sync-status');
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!xeroStatus?.connected
  });

  const createMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice created successfully" });
      setIsDialogOpen(false);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "Failed to create invoice", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertInvoice> & { items?: Omit<InvoiceItem, 'invoiceId'>[] } }) => updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice updated successfully" });
      setIsDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: () => {
      toast({ title: "Failed to update invoice", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: "Invoice deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete invoice", variant: "destructive" });
    }
  });

  const handleCreate = async (jobId?: string | null) => {
    if (jobId) {
      setLocation(`/invoice/new?jobId=${jobId}`);
    } else {
      setLocation('/invoice/new');
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setLocation(`/invoice/${invoice.id}`);
  };

  const handleSave = (data: InsertInvoice & { items: InvoiceItemInput[] }) => {
    if (selectedInvoice) {
      updateMutation.mutate({ id: selectedInvoice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePreview = (invoice: InvoiceWithItems) => {
    setPreviewDocument(invoice);
    setIsPreviewOpen(true);
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
      "Invoice Number", "Customer", "Postal Address", "Reference", "Invoice Date", "Due Date",
      "Description", "Invoice Status", "Discount", "Subtotal", "Tax", "Total", "Paid", "Due",
      "Entered By", "Entered On", "Line Number", "Line Item Code", "Line Description",
      "Line Quantity", "Line Unit Price", "Line Discount Percentage",
      "Line Tax Rate", "Line Tax Rate Percentage", "Line Account Code", "Line Amount"
    ];
    
    const rows: string[][] = [];
    
    for (const invoice of invoices) {
      const invoiceData = invoice as InvoiceWithItems;
      const items = invoiceData.items || [];
      const due = invoice.total - invoice.amountPaid;
      
      if (items.length === 0) {
        rows.push([
          invoice.invoiceNumber,
          invoice.customerName,
          invoice.address || "",
          invoice.reference || "",
          invoice.issueDate || "",
          invoice.dueDate || "",
          invoice.description || "",
          invoice.status || "draft",
          (invoice.discount || 0).toFixed(2),
          invoice.subtotal.toFixed(2),
          invoice.gst.toFixed(2),
          invoice.total.toFixed(2),
          invoice.amountPaid.toFixed(2),
          due.toFixed(2),
          "",
          formatDateInput(invoice.createdAt) || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]);
      } else {
        items.forEach((item, index) => {
          rows.push([
            invoice.invoiceNumber,
            index === 0 ? invoice.customerName : "",
            index === 0 ? invoice.address || "" : "",
            index === 0 ? invoice.reference || "" : "",
            index === 0 ? invoice.issueDate || "" : "",
            index === 0 ? invoice.dueDate || "" : "",
            index === 0 ? invoice.description || "" : "",
            index === 0 ? invoice.status || "draft" : "",
            index === 0 ? (invoice.discount || 0).toFixed(2) : "",
            index === 0 ? invoice.subtotal.toFixed(2) : "",
            index === 0 ? invoice.gst.toFixed(2) : "",
            index === 0 ? invoice.total.toFixed(2) : "",
            index === 0 ? invoice.amountPaid.toFixed(2) : "",
            index === 0 ? due.toFixed(2) : "",
            "",
            index === 0 ? (formatDateInput(invoice.createdAt) || "") : "",
            (item.sortOrder || index + 1).toString(),
            item.itemCode || "",
            item.description,
            item.qty.toString(),
            item.unitCost.toFixed(2),
            "",
            "",
            "",
            "",
            item.total.toFixed(2)
          ]);
        });
      }
    }
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${invoices.length} invoices` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Invoice Number", "Customer", "Postal Address", "Reference", "Invoice Date", "Due Date",
      "Description", "Invoice Status", "Discount", "Subtotal", "Tax", "Total", "Paid", "Due",
      "Entered By", "Entered On", "Line Number", "Line Item Code", "Line Description",
      "Line Quantity", "Line Unit Price", "Line Discount Percentage",
      "Line Tax Rate", "Line Tax Rate Percentage", "Line Account Code", "Line Amount"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "invoice_import_template.csv";
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
      const invoiceNoIdx = headers.findIndex(h => h.toLowerCase() === "invoice number");
      const customerNameIdx = headers.findIndex(h => h.toLowerCase() === "customer");
      const addressIdx = headers.findIndex(h => h.toLowerCase() === "postal address");
      const referenceIdx = headers.findIndex(h => h.toLowerCase() === "reference");
      const invoiceDateIdx = headers.findIndex(h => h.toLowerCase() === "invoice date");
      const dueDateIdx = headers.findIndex(h => h.toLowerCase() === "due date");
      const descriptionIdx = headers.findIndex(h => h.toLowerCase() === "description");
      const invoiceStatusIdx = headers.findIndex(h => h.toLowerCase() === "invoice status");
      const discountIdx = headers.findIndex(h => h.toLowerCase() === "discount");
      const subtotalIdx = headers.findIndex(h => h.toLowerCase() === "subtotal");
      const taxIdx = headers.findIndex(h => h.toLowerCase() === "tax");
      const totalIdx = headers.findIndex(h => h.toLowerCase() === "total");
      const paidIdx = headers.findIndex(h => h.toLowerCase() === "paid");
      const lineNumberIdx = headers.findIndex(h => h.toLowerCase() === "line number");
      const lineItemCodeIdx = headers.findIndex(h => h.toLowerCase() === "line item code");
      const lineDescIdx = headers.findIndex(h => h.toLowerCase() === "line description");
      const lineQtyIdx = headers.findIndex(h => h.toLowerCase() === "line quantity");
      const lineUnitPriceIdx = headers.findIndex(h => h.toLowerCase() === "line unit price");
      const lineAmountIdx = headers.findIndex(h => h.toLowerCase() === "line amount");

      if (invoiceNoIdx === -1) {
        toast({ 
          title: "Invalid CSV format", 
          description: "Required column 'Invoice Number' not found", 
          variant: "destructive" 
        });
        return;
      }

      const invoiceGroups = new Map<string, { headerRow: string[]; lineItems: string[][] }>();
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const invoiceNo = values[invoiceNoIdx]?.trim();
        
        if (!invoiceNo) continue;
        
        if (!invoiceGroups.has(invoiceNo)) {
          invoiceGroups.set(invoiceNo, { headerRow: values, lineItems: [values] });
        } else {
          invoiceGroups.get(invoiceNo)!.lineItems.push(values);
        }
      }

      if (invoiceGroups.size === 0) {
        toast({ title: "No valid invoices found in CSV", variant: "destructive" });
        return;
      }

      const existingInvoiceNumbers = new Set(invoices.map(i => i.invoiceNumber.toLowerCase()));
      let createdCount = 0;

      for (const [invoiceNo, group] of invoiceGroups) {
        const headerRow = group.headerRow;
        const customerName = customerNameIdx >= 0 ? headerRow[customerNameIdx]?.trim() : "";
        
        if (!customerName) continue;

        const customer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        
        let finalInvoiceNumber = invoiceNo;
        let suffix = 1;
        while (existingInvoiceNumbers.has(finalInvoiceNumber.toLowerCase())) {
          finalInvoiceNumber = `${invoiceNo}-${suffix}`;
          suffix++;
        }
        existingInvoiceNumbers.add(finalInvoiceNumber.toLowerCase());

        const items = group.lineItems
          .filter(row => {
            const desc = lineDescIdx >= 0 ? row[lineDescIdx]?.trim() : "";
            return desc;
          })
          .map((row, idx) => ({
            description: lineDescIdx >= 0 ? row[lineDescIdx]?.trim() || "" : "",
            qty: lineQtyIdx >= 0 ? parseFloat(row[lineQtyIdx]?.replace(/[^0-9.-]/g, '') || "1") || 1 : 1,
            unitCost: lineUnitPriceIdx >= 0 ? parseFloat(row[lineUnitPriceIdx]?.replace(/[^0-9.-]/g, '') || "0") || 0 : 0,
            total: lineAmountIdx >= 0 ? parseFloat(row[lineAmountIdx]?.replace(/[^0-9.-]/g, '') || "0") || 0 : 0,
            itemCode: lineItemCodeIdx >= 0 ? row[lineItemCodeIdx]?.trim() || "" : "",
            sortOrder: lineNumberIdx >= 0 ? parseFloat(row[lineNumberIdx]?.replace(/[^0-9.-]/g, '') || String(idx + 1)) || (idx + 1) : (idx + 1),
          }))
          .map(item => ({
            ...item,
            total: item.total || item.qty * item.unitCost
          }));

        if (items.length === 0) continue;

        const parseFloat2 = (val: string | undefined): number | null => {
          if (!val) return null;
          const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
          return isNaN(parsed) ? null : parsed;
        };

        const calcSubtotal = items.reduce((sum, item) => sum + item.total, 0);
        const csvDiscount = discountIdx >= 0 ? parseFloat2(headerRow[discountIdx]?.trim()) : null;
        const csvSubtotal = subtotalIdx >= 0 ? parseFloat2(headerRow[subtotalIdx]?.trim()) : null;
        const csvTax = taxIdx >= 0 ? parseFloat2(headerRow[taxIdx]?.trim()) : null;
        const csvTotal = totalIdx >= 0 ? parseFloat2(headerRow[totalIdx]?.trim()) : null;
        const csvPaid = paidIdx >= 0 ? parseFloat2(headerRow[paidIdx]?.trim()) : null;

        const discount = csvDiscount ?? 0;
        const subtotal = csvSubtotal ?? calcSubtotal;
        const gst = csvTax ?? subtotal * 0.1;
        const total = csvTotal ?? (subtotal + gst);
        const amountPaid = csvPaid ?? 0;

        const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'partial', 'cancelled'];
        const csvStatus = invoiceStatusIdx >= 0 ? headerRow[invoiceStatusIdx]?.trim().toLowerCase() : "";
        const status = validStatuses.includes(csvStatus) ? csvStatus : "draft";

        const parseDateStr = (dateStr: string): string => {
          if (!dateStr) return getTodayInput();
          try {
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              return formatDateInput(parsed);
            }
          } catch {}
          return getTodayInput();
        };

        const invoiceData = {
          id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          organizationId: "",
          invoiceNumber: finalInvoiceNumber,
          customerName,
          customerId: customer?.id || null,
          customerEmail: customer?.email || "",
          customerPhone: customer?.phone || "",
          address: addressIdx >= 0 ? headerRow[addressIdx]?.trim() || customer?.address || "" : customer?.address || "",
          suburb: customer?.suburb || "",
          reference: referenceIdx >= 0 ? headerRow[referenceIdx]?.trim() || "" : "",
          description: descriptionIdx >= 0 ? headerRow[descriptionIdx]?.trim() || "" : "",
          issueDate: invoiceDateIdx >= 0 ? parseDateStr(headerRow[invoiceDateIdx]?.trim() || "") : getTodayInput(),
          dueDate: dueDateIdx >= 0 ? parseDateStr(headerRow[dueDateIdx]?.trim() || "") : formatDateInput(addDays(new Date(), 14)),
          status,
          discount,
          subtotal,
          gst,
          total,
          amountPaid,
          items: items.map(item => ({
            description: item.description,
            qty: item.qty,
            unitCost: item.unitCost,
            total: item.total,
            itemCode: item.itemCode,
            sortOrder: item.sortOrder,
            costPrice: 0,
            productId: null,
            section: null,
          })),
        };

        try {
          await createInvoice(invoiceData);
          createdCount++;
        } catch (error) {
          console.error(`Failed to create invoice ${finalInvoiceNumber}:`, error);
        }
      }

      if (createdCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        toast({ title: `Imported ${createdCount} invoices successfully` });
        setImportDialogOpen(false);
      } else {
        toast({ title: "No invoices were imported", variant: "destructive" });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import invoices", variant: "destructive" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    try {
      for (const invoice of invoices) {
        await deleteInvoice(invoice.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setDeleteAllDialogOpen(false);
      toast({ title: `Deleted ${invoices.length} invoices` });
    } catch (error) {
      toast({ title: "Failed to delete invoices", variant: "destructive" });
    }
  };

  const stats = useMemo(() => ({
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    partial: invoices.filter(i => i.status === 'partial').length,
    cancelled: invoices.filter(i => i.status === 'cancelled').length,
    totalOutstanding: invoices
      .filter(i => ['sent', 'partial', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + (i.total - i.amountPaid), 0),
    totalPaid: invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0),
  }), [invoices]);

  // Filter and sort invoices
  const filteredInvoices = useMemo(() => invoices.filter(invoice => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.customerName.toLowerCase().includes(query) ||
        (invoice.address && invoice.address.toLowerCase().includes(query)) ||
        (invoice.customerEmail && invoice.customerEmail.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all" && invoice.status !== statusFilter) {
      return false;
    }

    // Date filter
    if (dateFilter !== "all") {
      const targetDate = dateFilterType === "issue" 
        ? (invoice.issueDate ? new Date(invoice.issueDate) : null)
        : (invoice.dueDate ? new Date(invoice.dueDate) : null);
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      const last30Days = new Date(now);
      last30Days.setDate(now.getDate() - 30);

      if (!targetDate) return false;

      switch (dateFilter) {
        case "this_week":
          if (targetDate < startOfWeek) return false;
          break;
        case "this_month":
          if (targetDate < startOfMonth) return false;
          break;
        case "last_30_days":
          if (targetDate < last30Days) return false;
          break;
        case "this_quarter":
          if (targetDate < startOfQuarter) return false;
          break;
      }
    }

    return true;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime();
      case "oldest":
        return new Date(a.issueDate || 0).getTime() - new Date(b.issueDate || 0).getTime();
      case "amount_high":
        return b.total - a.total;
      case "amount_low":
        return a.total - b.total;
      case "due_date":
        return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
      case "customer":
        return a.customerName.localeCompare(b.customerName);
      default:
        return 0;
    }
  }), [invoices, searchQuery, statusFilter, dateFilter, dateFilterType, sortBy]);

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFilter("all");
    setDateFilterType("issue");
    setSortBy("newest");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight" data-testid="text-invoices-title">
              Invoices
            </h1>
            <p className="text-muted-foreground mt-1">Manage invoices and track payments</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={invoices.length === 0}
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
                  Export Invoices
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Invoices
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate} data-testid="button-download-template">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.draft}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Drafts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-red-100 dark:bg-red-900">
                <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-red-600 dark:text-red-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Overdue</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-orange-100 dark:bg-orange-900">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">${stats.totalOutstanding.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Outstanding</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">${stats.totalPaid.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Paid</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice #, customer, address, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                  data-testid="input-search-invoices"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Filter Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Status Filter Badges */}
                <div className="flex flex-wrap gap-2 flex-1">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    className="min-h-[44px] md:min-h-0"
                    data-testid="filter-status-all"
                  >
                    All ({invoices.length})
                  </Button>
                  <Button
                    variant={statusFilter === "draft" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("draft")}
                    className={`min-h-[44px] md:min-h-0 ${statusFilter !== "draft" ? "border-gray-400 text-gray-600 hover:bg-gray-100" : ""}`}
                    data-testid="filter-status-draft"
                  >
                    Draft ({stats.draft})
                  </Button>
                  <Button
                    variant={statusFilter === "sent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("sent")}
                    className={`min-h-[44px] md:min-h-0 ${statusFilter !== "sent" ? "border-blue-400 text-blue-600 hover:bg-blue-50" : ""}`}
                    data-testid="filter-status-sent"
                  >
                    Sent ({stats.sent})
                  </Button>
                  <Button
                    variant={statusFilter === "paid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("paid")}
                    className={`min-h-[44px] md:min-h-0 ${statusFilter !== "paid" ? "border-green-400 text-green-600 hover:bg-green-50" : ""}`}
                    data-testid="filter-status-paid"
                  >
                    Paid ({stats.paid})
                  </Button>
                  <Button
                    variant={statusFilter === "overdue" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("overdue")}
                    className={`min-h-[44px] md:min-h-0 ${statusFilter !== "overdue" ? "border-red-400 text-red-600 hover:bg-red-50" : ""}`}
                    data-testid="filter-status-overdue"
                  >
                    Overdue ({stats.overdue})
                  </Button>
                  <Button
                    variant={statusFilter === "partial" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("partial")}
                    className={`min-h-[44px] md:min-h-0 ${statusFilter !== "partial" ? "border-orange-400 text-orange-600 hover:bg-orange-50" : ""}`}
                    data-testid="filter-status-partial"
                  >
                    Partial ({stats.partial})
                  </Button>
                </div>

                {/* Date Filter */}
                <div className="flex gap-1">
                  <Select value={dateFilterType} onValueChange={(v) => setDateFilterType(v as "issue" | "due")}>
                    <SelectTrigger className="w-[100px]" data-testid="select-date-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="issue">Issued</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-date-filter">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="this_week">This week</SelectItem>
                      <SelectItem value="this_month">This month</SelectItem>
                      <SelectItem value="last_30_days">Last 30 days</SelectItem>
                      <SelectItem value="this_quarter">This quarter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[160px]" data-testid="select-sort">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="amount_high">Amount (high)</SelectItem>
                    <SelectItem value="amount_low">Amount (low)</SelectItem>
                    <SelectItem value="due_date">Due date</SelectItem>
                    <SelectItem value="customer">Customer A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count and clear filters */}
              {(hasActiveFilters || filteredInvoices.length !== invoices.length) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Showing {filteredInvoices.length} of {invoices.length} invoices
                  </span>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-filters"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to load invoices</h3>
                <p className="text-muted-foreground mb-4">
                  {error instanceof Error ? error.message : "Something went wrong. Please try again."}
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : isLoading ? (
              <>
                <div className="md:hidden space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-40" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-6 w-32" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 flex-1" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[1, 2, 3, 4].map((i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                          <TableCell><div className="flex gap-1"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></div></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Invoices Yet</h3>
                <p className="text-muted-foreground mb-4">Create invoices from within a Job to track payments.</p>
                <Button onClick={() => setLocation('/jobs')} data-testid="button-go-to-jobs">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Go to Jobs
                </Button>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Matching Invoices</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your search or filters.</p>
                <Button onClick={clearAllFilters} variant="outline" data-testid="button-clear-filters-empty">
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                {/* Mobile card layout - Tradify style */}
                <div className="md:hidden space-y-3">
                  {filteredInvoices.map((invoice) => {
                    const linkedJob = jobs.find((j: Job) => j.id === invoice.jobId);
                    const rawBalance = invoice.total - invoice.amountPaid;
                    // Treat tiny floating point remainders as zero (paid)
                    const balance = Math.abs(rawBalance) < 0.01 ? 0 : rawBalance;
                    const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
                    const daysAgo = Math.floor((new Date().getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
                    const ageText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : new Date();
                    const isOverdue = dueDate < new Date() && balance > 0;
                    return (
                      <div 
                        key={invoice.id} 
                        className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 active:bg-muted active:scale-[0.99] transition-all"
                        onClick={() => setLocation(`/invoice/${invoice.id}`)}
                        data-testid={`card-invoice-${invoice.id}-mobile`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">{invoice.invoiceNumber}</span>
                            <span className="text-xs text-muted-foreground">{ageText}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`${statusColors[invoice.status]} text-white`}>
                              {statusLabels[invoice.status]}
                            </Badge>
                            {xeroStatus?.connected && xeroSyncMap[invoice.id]?.synced && (
                              <Cloud className="h-4 w-4 text-blue-600" />
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-medium">{invoice.customerName}</div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-2xl font-bold">${invoice.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            {invoice.amountPaid > 0 && (
                              <div className="text-sm text-green-600">Paid: ${invoice.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                            )}
                          </div>
                          <div className={`text-lg font-semibold ${balance > 0 ? (isOverdue ? "text-red-600" : "text-orange-600") : "text-green-600"}`}>
                            {balance > 0 ? `$${balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} due` : 'Paid'}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className={isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                            {isOverdue ? 'Overdue:' : 'Due:'}
                          </span>
                          <span>{formatDateShort(invoice.dueDate)}</span>
                        </div>
                        {linkedJob && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-primary"
                            onClick={(e) => { e.stopPropagation(); setLocation(`/jobs/${linkedJob.id}`); }}
                            data-testid={`link-job-${linkedJob.id}`}
                          >
                            <Briefcase className="h-3 w-3 mr-1" aria-hidden="true" />
                            {linkedJob.title}
                          </Button>
                        )}
                        <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 min-h-[44px]"
                            onClick={() => {
                              setEmailDialogInvoice(invoice as InvoiceWithItems);
                              setIsEmailDialogOpen(true);
                            }}
                            data-testid={`button-send-invoice-${invoice.id}-mobile`}
                            aria-label={`Send invoice ${invoice.invoiceNumber}`}
                          >
                            <Send className="h-4 w-4 mr-1" aria-hidden="true" />
                            Send
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop table layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => {
                        const linkedJob = jobs.find((j: Job) => j.id === invoice.jobId);
                        return (
                          <TableRow 
                            key={invoice.id} 
                            data-testid={`row-invoice-${invoice.id}`}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setLocation(`/invoice/${invoice.id}`)}
                          >
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              {linkedJob ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-primary"
                                  onClick={(e) => { e.stopPropagation(); setLocation(`/jobs/${linkedJob.id}`); }}
                                  data-testid={`link-job-${linkedJob.id}`}
                                >
                                  <Briefcase className="h-3 w-3 mr-1" aria-hidden="true" />
                                  {linkedJob.title}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>{invoice.customerName}</TableCell>
                            <TableCell>{formatDateShort(invoice.issueDate)}</TableCell>
                            <TableCell>{formatDateShort(invoice.dueDate)}</TableCell>
                            <TableCell>${invoice.total.toFixed(2)}</TableCell>
                            <TableCell className={Math.abs(invoice.total - invoice.amountPaid) < 0.01 ? "text-green-600" : "text-orange-600 font-medium"}>
                              ${Math.max(0, Math.round((invoice.total - invoice.amountPaid) * 100) / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge className={`${statusColors[invoice.status]} text-white`}>
                                  {statusLabels[invoice.status]}
                                </Badge>
                                {xeroStatus?.connected && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className={`p-1 rounded ${xeroSyncMap[invoice.id]?.synced ? 'text-blue-600' : 'text-gray-400'}`}>
                                          {xeroSyncMap[invoice.id]?.synced ? (
                                            <Cloud className="h-4 w-4" />
                                          ) : (
                                            <CloudOff className="h-4 w-4" />
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {xeroSyncMap[invoice.id]?.synced 
                                          ? `Synced to Xero${xeroSyncMap[invoice.id]?.lastSyncAt ? ` on ${formatDateShort(xeroSyncMap[invoice.id].lastSyncAt)}` : ''}`
                                          : 'Not synced to Xero'}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmailDialogInvoice(invoice as InvoiceWithItems);
                                  setIsEmailDialogOpen(true);
                                }}
                                data-testid={`button-send-invoice-${invoice.id}`}
                                aria-label={`Send invoice ${invoice.invoiceNumber}`}
                              >
                                <Send className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedInvoice ? "Edit Invoice" : "New Invoice"}</DialogTitle>
            </DialogHeader>
            <InvoiceForm 
              invoice={selectedInvoice || undefined}
              customers={customers}
              jobs={jobs}
              onSave={handleSave}
              onClose={() => setIsDialogOpen(false)}
              isLoading={createMutation.isPending || updateMutation.isPending}
              nextNumber={nextNumber}
              initialJobId={preselectedJobId}
            />
          </DialogContent>
        </Dialog>

        {previewDocument && (
          <PdfPreviewModal
            open={isPreviewOpen}
            onClose={() => {
              setIsPreviewOpen(false);
              setPreviewDocument(null);
            }}
            document={prepareInvoiceData(previewDocument, jobs.find(j => j.id === previewDocument.jobId))}
            theme={themes.find(t => t.id === previewDocument.themeId) || themes.find(t => t.isDefault === 'true') || null}
          />
        )}

        {emailDialogInvoice && (
          <SendEmailDialog
            open={isEmailDialogOpen}
            onOpenChange={setIsEmailDialogOpen}
            documentType="invoice"
            documentId={emailDialogInvoice.id}
            documentNumber={emailDialogInvoice.invoiceNumber}
            recipientEmail={emailDialogInvoice.customerEmail || ""}
            recipientName={emailDialogInvoice.customerName || ""}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
            }}
          />
        )}

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Invoices</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with invoice data. Use the template format or download our template.
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
                <p className="text-sm text-muted-foreground">Importing invoices...</p>
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
              <AlertDialogTitle>Delete All Invoices</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {invoices.length} invoices? This action cannot be undone.
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
      </div>
    </Layout>
  );
}
