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
  Check,
  Eye,
  DollarSign,
  Briefcase,
  Download,
  Upload,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  fetchQuotes, 
  createQuote, 
  updateQuote, 
  deleteQuote, 
  getNextQuoteNumber,
  fetchCustomers,
  fetchJobs,
  fetchDocumentThemes,
  type QuoteWithItems,
  type DocumentTheme
} from "@/lib/api";
import type { Quote, InsertQuote, QuoteItem, Customer, Job } from "@shared/schema";
import { addDays } from "date-fns";
import { formatDateShort, getFutureDateInput, formatDateInput, getTodayInput } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PdfPreviewModal, prepareQuoteData } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  approved: "bg-green-600",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-orange-500"
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired"
};

type QuoteItemInput = {
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

function QuoteForm({ 
  quote, 
  customers,
  jobs,
  onSave, 
  onClose, 
  isLoading,
  nextNumber,
  initialJobId
}: { 
  quote?: QuoteWithItems; 
  customers: Customer[];
  jobs: Job[];
  onSave: (data: InsertQuote & { items: QuoteItemInput[] }) => void; 
  onClose: () => void;
  isLoading: boolean;
  nextNumber: string;
  initialJobId?: string | null;
}) {
  const [formData, setFormData] = useState<InsertQuote>({
    id: quote?.id || `quote_${Date.now()}`,
    organizationId: quote?.organizationId || "",
    quoteNumber: quote?.quoteNumber || nextNumber,
    customerName: quote?.customerName || "",
    customerEmail: quote?.customerEmail || "",
    customerPhone: quote?.customerPhone || "",
    address: quote?.address || "",
    suburb: quote?.suburb || "",
    status: quote?.status || "draft",
    validUntil: quote?.validUntil || getFutureDateInput(30),
    subtotal: quote?.subtotal || 0,
    gst: quote?.gst || 0,
    total: quote?.total || 0,
    notes: quote?.notes || "",
    terms: quote?.terms || "Payment due within 14 days of acceptance.",
    customerId: quote?.customerId || null,
    reportId: quote?.reportId || null,
    jobId: quote?.jobId || initialJobId || null,
  });

  const [items, setItems] = useState<QuoteItemInput[]>(
    quote?.items?.map(i => ({
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

  const updateItem = (index: number, field: keyof QuoteItemInput, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'unitCost') {
        updated[index].total = updated[index].qty * updated[index].unitCost;
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const gst = subtotal * 0.1;
    const total = subtotal + gst;
    setFormData(prev => ({ ...prev, subtotal, gst, total }));
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Quote Number</Label>
          <Input value={formData.quoteNumber} disabled data-testid="input-quote-number" className="h-11" />
        </div>
        <div>
          <Label>Valid Until</Label>
          <Input
            type="date"
            value={formData.validUntil || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
            data-testid="input-quote-valid"
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
            <SelectTrigger data-testid="select-quote-job">
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
            <SelectTrigger data-testid="select-quote-customer">
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
            data-testid="input-quote-customer-name"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={formData.customerEmail || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            data-testid="input-quote-email"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <Input
            value={formData.customerPhone || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
            data-testid="input-quote-phone"
          />
        </div>
        <div>
          <Label>Suburb</Label>
          <Input
            value={formData.suburb || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, suburb: e.target.value }))}
            data-testid="input-quote-suburb"
          />
        </div>
      </div>

      <div>
        <Label>Address *</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          data-testid="input-quote-address"
        />
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">Line Items</Label>
          <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
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
                      data-testid={`input-item-qty-${index}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitCost}
                      onChange={(e) => updateItem(index, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-28"
                      data-testid={`input-item-cost-${index}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">${item.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(index)}
                      data-testid={`button-remove-item-${index}`}
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
          </div>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea
          value={formData.notes || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
          data-testid="input-quote-notes"
        />
      </div>

      <div>
        <Label>Terms & Conditions</Label>
        <Textarea
          value={formData.terms || ""}
          onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
          data-testid="input-quote-terms"
        />
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-quote">Cancel</Button>
        <Button 
          onClick={() => onSave({ ...formData, items })} 
          disabled={isLoading || !formData.customerName || !formData.address}
          data-testid="button-save-quote"
        >
          {isLoading ? "Saving..." : quote ? "Update Quote" : "Create Quote"}
        </Button>
      </div>
    </div>
  );
}

export default function Quotes() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isAdmin, canDelete } = usePermissions();
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [nextNumber, setNextNumber] = useState("");
  const [preselectedJobId, setPreselectedJobId] = useState<string | null>(() => {
    const params = new URLSearchParams(search);
    return params.get('jobId');
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewDocument, setPreviewDocument] = useState<QuoteWithItems | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [emailDialogQuote, setEmailDialogQuote] = useState<QuoteWithItems | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const params = new URLSearchParams(search);
    return params.get('status') || "all";
  });

  useEffect(() => {
    fetchDocumentThemes().then(t => setThemes(t.filter(th => th.isArchived !== 'true')));
  }, []);

  // Handle query params from job detail page
  useEffect(() => {
    const params = new URLSearchParams(search);
    const newQuote = params.get('newQuote');
    const jobId = params.get('jobId');
    
    if (newQuote === 'true') {
      if (jobId) setPreselectedJobId(jobId);
      handleCreate(jobId);
      // Clear the query params after processing
      setLocation('/quotes', { replace: true });
    }
  }, [search]);

  const { data: quotes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/quotes'],
    queryFn: fetchQuotes
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => fetchCustomers()
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: fetchJobs
  });

  const createMutation = useMutation({
    mutationFn: createQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({ title: "Quote created successfully" });
      setIsDialogOpen(false);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "Failed to create quote", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertQuote> & { items?: Omit<QuoteItem, 'quoteId'>[] } }) => updateQuote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({ title: "Quote updated successfully" });
      setIsDialogOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast({ title: "Failed to update quote", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteQuote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({ title: "Quote deleted successfully" });
      setIsDialogOpen(false);
      setSelectedQuote(null);
    },
    onError: () => {
      toast({ title: "Failed to delete quote", variant: "destructive" });
    }
  });

  const handleCreate = async (jobId?: string | null) => {
    if (jobId) {
      setLocation(`/quote/new?jobId=${jobId}`);
    } else {
      setLocation('/quote/new');
    }
  };

  const handleEdit = (quote: Quote) => {
    setLocation(`/quote/${quote.id}`);
  };

  const handleSave = (data: InsertQuote & { items: QuoteItemInput[] }) => {
    if (selectedQuote) {
      updateMutation.mutate({ id: selectedQuote.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePreview = (quote: QuoteWithItems) => {
    setPreviewDocument(quote);
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
      "Quote No", "Customer Name", "Postal Address", "Reference", "Quote Date", "Expiry Date",
      "Description", "Total Cost", "Total Gross Profit", "Discount", "Subtotal", "Tax", "Total",
      "Entered By", "Entered On", "Section", "Line Number", "Line Item Code", "Line Description",
      "Line Quantity", "Line Unit Price", "Line Unit Sell Price", "Line Discount Percentage",
      "Line Tax Rate", "Line Tax Rate Percentage", "Line Gross Profit", "Line Amount", "Status"
    ];
    
    const rows: string[][] = [];
    
    for (const quote of quotes) {
      const quoteData = quote as QuoteWithItems;
      const items = quoteData.items || [];
      
      if (items.length === 0) {
        rows.push([
          quote.quoteNumber,
          quote.customerName,
          quote.address || "",
          quote.reference || "",
          formatDateInput(quote.createdAt) || "",
          quote.validUntil || "",
          quote.description || "",
          (quote.totalCost || 0).toFixed(2),
          (quote.grossProfit || 0).toFixed(2),
          (quote.discount || 0).toFixed(2),
          quote.subtotal.toFixed(2),
          quote.gst.toFixed(2),
          quote.total.toFixed(2),
          "",
          formatDateInput(quote.createdAt) || "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          quote.status
        ]);
      } else {
        items.forEach((item, index) => {
          rows.push([
            quote.quoteNumber,
            index === 0 ? quote.customerName : "",
            index === 0 ? quote.address || "" : "",
            index === 0 ? quote.reference || "" : "",
            index === 0 ? (formatDateInput(quote.createdAt) || "") : "",
            index === 0 ? quote.validUntil || "" : "",
            index === 0 ? quote.description || "" : "",
            index === 0 ? (quote.totalCost || 0).toFixed(2) : "",
            index === 0 ? (quote.grossProfit || 0).toFixed(2) : "",
            index === 0 ? (quote.discount || 0).toFixed(2) : "",
            index === 0 ? quote.subtotal.toFixed(2) : "",
            index === 0 ? quote.gst.toFixed(2) : "",
            index === 0 ? quote.total.toFixed(2) : "",
            "",
            index === 0 ? (formatDateInput(quote.createdAt) || "") : "",
            "",
            (item.sortOrder || index + 1).toString(),
            item.itemCode || "",
            item.description,
            item.qty.toString(),
            item.unitCost.toFixed(2),
            item.unitCost.toFixed(2),
            "",
            "",
            "",
            "",
            item.total.toFixed(2),
            index === 0 ? quote.status : ""
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
    link.download = `quotes_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${quotes.length} quotes` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Quote No", "Customer Name", "Postal Address", "Reference", "Quote Date", "Expiry Date",
      "Description", "Total Cost", "Total Gross Profit", "Discount", "Subtotal", "Tax", "Total",
      "Entered By", "Entered On", "Section", "Line Number", "Line Item Code", "Line Description",
      "Line Quantity", "Line Unit Price", "Line Unit Sell Price", "Line Discount Percentage",
      "Line Tax Rate", "Line Tax Rate Percentage", "Line Gross Profit", "Line Amount", "Status"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "quote_import_template.csv";
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
      const quoteNoIdx = headers.findIndex(h => h.toLowerCase() === "quote no" || h.toLowerCase() === "quote number");
      const customerNameIdx = headers.findIndex(h => h.toLowerCase() === "customer name" || h.toLowerCase() === "customer");
      const addressIdx = headers.findIndex(h => h.toLowerCase() === "postal address");
      const referenceIdx = headers.findIndex(h => h.toLowerCase() === "reference");
      const expiryDateIdx = headers.findIndex(h => h.toLowerCase() === "expiry date");
      const descriptionIdx = headers.findIndex(h => h.toLowerCase() === "description");
      const statusIdx = headers.findIndex(h => h.toLowerCase() === "status" || h.toLowerCase() === "quote status");
      const discountIdx = headers.findIndex(h => h.toLowerCase() === "discount");
      const taxIdx = headers.findIndex(h => h.toLowerCase() === "tax");
      const totalIdx = headers.findIndex(h => h.toLowerCase() === "total");
      const lineNumberIdx = headers.findIndex(h => h.toLowerCase() === "line number");
      const lineItemCodeIdx = headers.findIndex(h => h.toLowerCase() === "line item code");
      const lineDescIdx = headers.findIndex(h => h.toLowerCase() === "line description");
      const lineQtyIdx = headers.findIndex(h => h.toLowerCase() === "line quantity");
      const lineUnitPriceIdx = headers.findIndex(h => h.toLowerCase() === "line unit price");
      const lineAmountIdx = headers.findIndex(h => h.toLowerCase() === "line amount");
      
      const validStatuses = ['draft', 'sent', 'accepted', 'declined', 'expired'];

      if (quoteNoIdx === -1) {
        toast({ 
          title: "Invalid CSV format", 
          description: "Required column 'Quote No' not found", 
          variant: "destructive" 
        });
        return;
      }

      const quoteGroups = new Map<string, { headerRow: string[]; lineItems: string[][] }>();
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const quoteNo = values[quoteNoIdx]?.trim();
        
        if (!quoteNo) continue;
        
        if (!quoteGroups.has(quoteNo)) {
          quoteGroups.set(quoteNo, { headerRow: values, lineItems: [values] });
        } else {
          quoteGroups.get(quoteNo)!.lineItems.push(values);
        }
      }

      if (quoteGroups.size === 0) {
        toast({ title: "No valid quotes found in CSV", variant: "destructive" });
        return;
      }

      const existingQuoteNumbers = new Set(quotes.map(q => q.quoteNumber.toLowerCase()));
      let createdCount = 0;

      for (const [quoteNo, group] of quoteGroups) {
        const headerRow = group.headerRow;
        const customerName = customerNameIdx >= 0 ? headerRow[customerNameIdx]?.trim() : "";
        
        if (!customerName) continue;

        const customer = customers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
        
        let finalQuoteNumber = quoteNo;
        let suffix = 1;
        while (existingQuoteNumbers.has(finalQuoteNumber.toLowerCase())) {
          finalQuoteNumber = `${quoteNo}-${suffix}`;
          suffix++;
        }
        existingQuoteNumbers.add(finalQuoteNumber.toLowerCase());

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

        const calculatedSubtotal = items.reduce((sum, item) => sum + item.total, 0);
        
        const csvDiscount = discountIdx >= 0 ? parseFloat(headerRow[discountIdx]?.replace(/[^0-9.-]/g, '') || "") : NaN;
        const csvTax = taxIdx >= 0 ? parseFloat(headerRow[taxIdx]?.replace(/[^0-9.-]/g, '') || "") : NaN;
        const csvTotal = totalIdx >= 0 ? parseFloat(headerRow[totalIdx]?.replace(/[^0-9.-]/g, '') || "") : NaN;
        
        const discount = !isNaN(csvDiscount) ? csvDiscount : 0;
        const subtotal = calculatedSubtotal;
        const gst = !isNaN(csvTax) ? csvTax : calculatedSubtotal * 0.1;
        const total = !isNaN(csvTotal) ? csvTotal : subtotal + gst;
        
        const csvStatus = statusIdx >= 0 ? headerRow[statusIdx]?.trim().toLowerCase() || "" : "";
        const status = validStatuses.includes(csvStatus) ? csvStatus : "draft";

        const quoteData = {
          id: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          organizationId: "",
          quoteNumber: finalQuoteNumber,
          customerName,
          customerId: customer?.id || null,
          customerEmail: customer?.email || "",
          customerPhone: customer?.phone || "",
          address: addressIdx >= 0 ? headerRow[addressIdx]?.trim() || customer?.address || "" : customer?.address || "",
          suburb: customer?.suburb || "",
          reference: referenceIdx >= 0 ? headerRow[referenceIdx]?.trim() || "" : "",
          description: descriptionIdx >= 0 ? headerRow[descriptionIdx]?.trim() || "" : "",
          validUntil: expiryDateIdx >= 0 ? headerRow[expiryDateIdx]?.trim() || "" : "",
          status,
          discount,
          subtotal,
          gst,
          total,
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
          await createQuote(quoteData);
          createdCount++;
        } catch (error) {
          console.error(`Failed to create quote ${finalQuoteNumber}:`, error);
        }
      }

      if (createdCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
        toast({ title: `Imported ${createdCount} quotes successfully` });
        setImportDialogOpen(false);
      } else {
        toast({ title: "No quotes were imported", variant: "destructive" });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import quotes", variant: "destructive" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    try {
      for (const quote of quotes) {
        await deleteQuote(quote.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      setDeleteAllDialogOpen(false);
      toast({ title: `Deleted ${quotes.length} quotes` });
    } catch (error) {
      toast({ title: "Failed to delete quotes", variant: "destructive" });
    }
  };

  const filteredQuotes = useMemo(() => {
    if (statusFilter === "all") return quotes;
    return quotes.filter(q => q.status === statusFilter);
  }, [quotes, statusFilter]);

  const stats = useMemo(() => ({
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalValue: quotes.reduce((sum, q) => sum + q.total, 0),
  }), [quotes]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight" data-testid="text-quotes-title">
              Quotes
            </h1>
            <p className="text-muted-foreground mt-1">Create and manage customer quotes</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={quotes.length === 0}
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
                  Export Quotes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Quotes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate} data-testid="button-download-template">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => handleCreate()} className="gap-2 h-11 sm:h-10 active:scale-95 transition-transform" data-testid="button-new-quote">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Quote
            </Button>
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
              <div className="p-2 md:p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <Send className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.sent}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.accepted}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Accepted</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-primary/10">
                <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold truncate">${stats.totalValue.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Total Value</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            {isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                <h3 className="text-lg font-semibold mb-2">Failed to load quotes</h3>
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
                      <Skeleton className="h-8 w-28" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-20" />
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
                        <TableHead>Quote #</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Valid Until</TableHead>
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
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
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
            ) : quotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No quotes yet. Create your first quote to get started.
              </div>
            ) : (
              <>
                {statusFilter !== "all" && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">
                      Showing {filteredQuotes.length} of {quotes.length} quotes
                      {statusFilter !== "all" && ` (${statusLabels[statusFilter] || statusFilter})`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")} className="text-xs h-7">
                      Clear filter
                    </Button>
                  </div>
                )}
                {/* Mobile card layout - Tradify style */}
                <div className="md:hidden space-y-3">
                  {filteredQuotes.map((quote) => {
                    const linkedJob = jobs.find((j: Job) => j.id === quote.jobId);
                    const createdDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
                    const daysAgo = Math.floor((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                    const ageText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                    return (
                      <div 
                        key={quote.id} 
                        className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50 active:bg-muted active:scale-[0.99] transition-all"
                        onClick={() => setLocation(`/quote/${quote.id}`)}
                        data-testid={`card-quote-${quote.id}-mobile`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-primary">{quote.quoteNumber}</span>
                            <span className="text-xs text-muted-foreground">{ageText}</span>
                          </div>
                          <Badge className={`${statusColors[quote.status]} text-white`}>
                            {statusLabels[quote.status]}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{quote.customerName}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold">${quote.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          {quote.validUntil && (
                            <div className="text-xs text-muted-foreground">
                              Valid until {formatDateShort(quote.validUntil)}
                            </div>
                          )}
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
                              setEmailDialogQuote(quote as QuoteWithItems);
                              setIsEmailDialogOpen(true);
                            }}
                            data-testid={`button-send-quote-${quote.id}-mobile`}
                            aria-label={`Send quote ${quote.quoteNumber}`}
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
                        <TableHead>Quote #</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((quote) => {
                        const linkedJob = jobs.find((j: Job) => j.id === quote.jobId);
                        return (
                          <TableRow 
                            key={quote.id} 
                            data-testid={`row-quote-${quote.id}`}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setLocation(`/quote/${quote.id}`)}
                          >
                            <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
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
                            <TableCell>{quote.customerName}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{quote.address}</TableCell>
                            <TableCell>${quote.total.toFixed(2)}</TableCell>
                            <TableCell>{formatDateShort(quote.validUntil)}</TableCell>
                            <TableCell>
                              <Badge className={`${statusColors[quote.status]} text-white`}>
                                {statusLabels[quote.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEmailDialogQuote(quote as QuoteWithItems);
                                  setIsEmailDialogOpen(true);
                                }}
                                data-testid={`button-send-quote-${quote.id}`}
                                aria-label={`Send quote ${quote.quoteNumber}`}
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
              <DialogTitle>{selectedQuote ? "Edit Quote" : "New Quote"}</DialogTitle>
            </DialogHeader>
            <QuoteForm 
              quote={selectedQuote || undefined}
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
            document={prepareQuoteData(previewDocument, jobs.find(j => j.id === previewDocument.jobId))}
            theme={themes.find(t => t.id === previewDocument.themeId) || themes.find(t => t.isDefault === 'true') || null}
          />
        )}

        {emailDialogQuote && (
          <SendEmailDialog
            open={isEmailDialogOpen}
            onOpenChange={setIsEmailDialogOpen}
            documentType="quote"
            documentId={emailDialogQuote.id}
            documentNumber={emailDialogQuote.quoteNumber}
            recipientEmail={emailDialogQuote.customerEmail || ""}
            recipientName={emailDialogQuote.customerName || ""}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
            }}
          />
        )}

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Quotes</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with quote data. Use the template format or download our template.
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
                <p className="text-sm text-muted-foreground">Importing quotes...</p>
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
              <AlertDialogTitle>Delete All Quotes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {quotes.length} quotes? This action cannot be undone.
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
