import { useState, useEffect } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  FileText, 
  Trash2,
  Eye,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Briefcase,
  Send,
  Download,
  Upload
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  fetchPurchaseOrders, 
  createPurchaseOrder, 
  updatePurchaseOrder, 
  deletePurchaseOrder, 
  getNextPONumber,
  fetchJobs,
  fetchSuppliers,
  fetchDocumentThemes,
  type PurchaseOrderWithItems,
  type DocumentTheme
} from "@/lib/api";
import type { PurchaseOrder, InsertPurchaseOrder, PurchaseOrderItem, Job } from "@shared/schema";
import { addDays } from "date-fns";
import { formatDateShort, getTodayInput, formatDateInput, getFutureDateInput } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PdfPreviewModal, preparePurchaseOrderData } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { FeatureGate } from "@/components/feature-gate";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  ordered: "bg-blue-500",
  received: "bg-green-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400"
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  ordered: "Ordered",
  received: "Received",
  partial: "Partial",
  cancelled: "Cancelled"
};

type POItemInput = {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  itemCode: string | null;
  productId: string | null;
  sortOrder: number | null;
  section: string | null;
};

function POForm({ 
  po, 
  jobs,
  onSave, 
  onClose, 
  isLoading,
  nextNumber,
  initialJobId
}: { 
  po?: PurchaseOrderWithItems; 
  jobs: Job[];
  onSave: (data: InsertPurchaseOrder & { items: POItemInput[] }) => void; 
  onClose: () => void;
  isLoading: boolean;
  nextNumber: string;
  initialJobId?: string | null;
}) {
  const [formData, setFormData] = useState<InsertPurchaseOrder>({
    id: po?.id || `po_${Date.now()}`,
    organizationId: po?.organizationId || "",
    poNumber: po?.poNumber || nextNumber,
    supplier: po?.supplier || "",
    supplierContact: po?.supplierContact || "",
    supplierEmail: po?.supplierEmail || "",
    supplierPhone: po?.supplierPhone || "",
    status: po?.status || "draft",
    orderDate: po?.orderDate || getTodayInput(),
    expectedDelivery: po?.expectedDelivery || getFutureDateInput(7),
    subtotal: po?.subtotal || 0,
    gst: po?.gst || 0,
    total: po?.total || 0,
    notes: po?.notes || "",
    jobId: po?.jobId || initialJobId || null,
  });

  const [items, setItems] = useState<POItemInput[]>(
    po?.items?.map(i => ({
      id: i.id,
      description: i.description,
      qty: i.qty,
      unitCost: i.unitCost,
      total: i.total,
      itemCode: i.itemCode ?? null,
      productId: i.productId ?? null,
      sortOrder: i.sortOrder ?? null,
      section: i.section ?? null
    })) || []
  );

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: "",
      qty: 1,
      unitCost: 0,
      total: 0,
      itemCode: null,
      productId: null,
      sortOrder: null,
      section: null
    }]);
  };

  const updateItem = (index: number, field: keyof POItemInput, value: string | number) => {
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
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>PO Number</Label>
          <Input value={formData.poNumber} disabled data-testid="input-po-number" />
        </div>
        <div>
          <Label>Order Date</Label>
          <Input
            type="date"
            value={formData.orderDate || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
            data-testid="input-po-order-date"
          />
        </div>
        <div>
          <Label>Expected Delivery</Label>
          <Input
            type="date"
            value={formData.expectedDelivery || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
            data-testid="input-po-delivery"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Supplier *</Label>
          <Input
            value={formData.supplier}
            onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
            placeholder="Supplier name"
            data-testid="input-po-supplier"
          />
        </div>
        <div>
          <Label>Supplier Email</Label>
          <Input
            type="email"
            value={formData.supplierEmail || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, supplierEmail: e.target.value }))}
            placeholder="supplier@email.com"
            data-testid="input-po-supplier-email"
          />
        </div>
        <div>
          <Label>Supplier Phone</Label>
          <Input
            value={formData.supplierPhone || ""}
            onChange={(e) => setFormData(prev => ({ ...prev, supplierPhone: e.target.value }))}
            placeholder="Phone number"
            data-testid="input-po-supplier-phone"
          />
        </div>
      </div>

      <div>
        <Label>Linked Job (optional)</Label>
        <Select value={formData.jobId ?? "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, jobId: v === "none" ? null : v }))}>
          <SelectTrigger data-testid="select-po-job">
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
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
          <SelectTrigger data-testid="select-po-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="partial">Partial Delivery</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <Label className="text-base font-semibold">Items</Label>
          <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-po-item">
            <Plus className="h-4 w-4 mr-1" />
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
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      placeholder="Material description"
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
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
          data-testid="input-po-notes"
        />
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-po">Cancel</Button>
        <Button 
          onClick={() => onSave({ ...formData, items })} 
          disabled={isLoading || !formData.supplier}
          data-testid="button-save-po"
        >
          {isLoading ? "Saving..." : po ? "Update PO" : "Create PO"}
        </Button>
      </div>
    </div>
  );
}

export default function PurchaseOrders() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { isAdmin, canDelete } = usePermissions();
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [emailDialogPO, setEmailDialogPO] = useState<PurchaseOrderWithItems | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [nextNumber, setNextNumber] = useState("");
  const [preselectedJobId, setPreselectedJobId] = useState<string | null>(() => {
    const params = new URLSearchParams(search);
    return params.get('jobId');
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewDocument, setPreviewDocument] = useState<PurchaseOrderWithItems | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
    const newPO = params.get('newPO');
    const jobId = params.get('jobId');
    
    if (newPO === 'true') {
      if (jobId) setPreselectedJobId(jobId);
      handleCreate(jobId);
      // Clear the query params after processing
      setLocation('/purchase-orders', { replace: true });
    }
  }, [search]);

  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['/api/purchase-orders'],
    queryFn: fetchPurchaseOrders
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: fetchJobs
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => fetchSuppliers()
  });

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: "Purchase order created successfully" });
      setIsDialogOpen(false);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "Failed to create purchase order", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertPurchaseOrder> & { items?: Omit<PurchaseOrderItem, 'purchaseOrderId'>[] } }) => updatePurchaseOrder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: "Purchase order updated successfully" });
      setIsDialogOpen(false);
      setSelectedPO(null);
    },
    onError: () => {
      toast({ title: "Failed to update purchase order", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deletePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      toast({ title: "Purchase order deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete purchase order", variant: "destructive" });
    }
  });

  const handleCreate = async (jobId?: string | null) => {
    if (jobId) {
      setLocation(`/purchase-order/new?jobId=${jobId}`);
    } else {
      setLocation('/purchase-order/new');
    }
  };

  const handleEdit = (po: PurchaseOrder) => {
    setLocation(`/purchase-order/${po.id}`);
  };

  const handleSave = (data: InsertPurchaseOrder & { items: POItemInput[] }) => {
    if (selectedPO) {
      updateMutation.mutate({ id: selectedPO.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePreview = (po: PurchaseOrderWithItems) => {
    setPreviewDocument(po);
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
      "Order No", "Supplier", "Order Date", "Delivery Date", "Delivery Address", "Delivery Instructions",
      "Reference", "Description", "PO Status", "Discount", "Tax", "Subtotal", "Total",
      "Line Number", "Line Item Code", "Line Description", "Line Quantity", "Line Unit Price",
      "Line Discount Percentage", "Line Tax Rate", "Line Tax Rate Percentage", "Line Amount"
    ];
    
    const rows: string[][] = [];
    
    for (const po of purchaseOrders) {
      const poData = po as PurchaseOrderWithItems;
      const items = poData.items || [];
      
      if (items.length === 0) {
        rows.push([
          po.poNumber,
          po.supplier,
          po.orderDate || "",
          po.expectedDelivery || "",
          po.deliveryAddress || "",
          po.deliveryInstructions || "",
          po.reference || "",
          po.description || "",
          po.status || "draft",
          (po.discount || 0).toFixed(2),
          po.gst.toFixed(2),
          po.subtotal.toFixed(2),
          po.total.toFixed(2),
          "", "", "", "", "", "", "", "", ""
        ]);
      } else {
        items.forEach((item, index) => {
          rows.push([
            po.poNumber,
            index === 0 ? po.supplier : "",
            index === 0 ? po.orderDate || "" : "",
            index === 0 ? po.expectedDelivery || "" : "",
            index === 0 ? po.deliveryAddress || "" : "",
            index === 0 ? po.deliveryInstructions || "" : "",
            index === 0 ? po.reference || "" : "",
            index === 0 ? po.description || "" : "",
            index === 0 ? po.status || "draft" : "",
            index === 0 ? (po.discount || 0).toFixed(2) : "",
            index === 0 ? po.gst.toFixed(2) : "",
            index === 0 ? po.subtotal.toFixed(2) : "",
            index === 0 ? po.total.toFixed(2) : "",
            (item.sortOrder || index + 1).toString(),
            item.itemCode || "",
            item.description,
            item.qty.toString(),
            item.unitCost.toFixed(2),
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
    link.download = `purchase_orders_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${purchaseOrders.length} purchase orders` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Order No", "Supplier", "Order Date", "Delivery Date", "Delivery Address", "Delivery Instructions",
      "Reference", "Description", "PO Status", "Discount", "Tax", "Subtotal", "Total",
      "Line Number", "Line Item Code", "Line Description", "Line Quantity", "Line Unit Price",
      "Line Discount Percentage", "Line Tax Rate", "Line Tax Rate Percentage", "Line Amount"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "purchase_order_import_template.csv";
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
      const orderNoIdx = headers.findIndex(h => h.toLowerCase() === "order no");
      const supplierIdx = headers.findIndex(h => h.toLowerCase() === "supplier");
      const orderDateIdx = headers.findIndex(h => h.toLowerCase() === "order date");
      const deliveryDateIdx = headers.findIndex(h => h.toLowerCase() === "delivery date");
      const deliveryAddressIdx = headers.findIndex(h => h.toLowerCase() === "delivery address");
      const deliveryInstructionsIdx = headers.findIndex(h => h.toLowerCase() === "delivery instructions");
      const referenceIdx = headers.findIndex(h => h.toLowerCase() === "reference");
      const descriptionIdx = headers.findIndex(h => h.toLowerCase() === "description");
      const poStatusIdx = headers.findIndex(h => h.toLowerCase() === "po status");
      const discountIdx = headers.findIndex(h => h.toLowerCase() === "discount");
      const taxIdx = headers.findIndex(h => h.toLowerCase() === "tax");
      const subtotalIdx = headers.findIndex(h => h.toLowerCase() === "subtotal");
      const totalIdx = headers.findIndex(h => h.toLowerCase() === "total");
      const lineNumberIdx = headers.findIndex(h => h.toLowerCase() === "line number");
      const lineItemCodeIdx = headers.findIndex(h => h.toLowerCase() === "line item code");
      const lineDescIdx = headers.findIndex(h => h.toLowerCase() === "line description");
      const lineQtyIdx = headers.findIndex(h => h.toLowerCase() === "line quantity");
      const lineUnitPriceIdx = headers.findIndex(h => h.toLowerCase() === "line unit price");
      const lineAmountIdx = headers.findIndex(h => h.toLowerCase() === "line amount");

      if (orderNoIdx === -1) {
        toast({ 
          title: "Invalid CSV format", 
          description: "Required column 'Order No' not found", 
          variant: "destructive" 
        });
        return;
      }

      const poGroups = new Map<string, { headerRow: string[]; lineItems: string[][] }>();
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const orderNo = values[orderNoIdx]?.trim();
        
        if (!orderNo) continue;
        
        if (!poGroups.has(orderNo)) {
          poGroups.set(orderNo, { headerRow: values, lineItems: [values] });
        } else {
          poGroups.get(orderNo)!.lineItems.push(values);
        }
      }

      if (poGroups.size === 0) {
        toast({ title: "No valid purchase orders found in CSV", variant: "destructive" });
        return;
      }

      const existingPONumbers = new Set(purchaseOrders.map(p => p.poNumber.toLowerCase()));
      let createdCount = 0;

      for (const [orderNo, group] of poGroups) {
        const headerRow = group.headerRow;
        const supplierName = supplierIdx >= 0 ? headerRow[supplierIdx]?.trim() : "";
        
        if (!supplierName) continue;

        const matchedSupplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        
        let finalOrderNo = orderNo;
        let suffix = 1;
        while (existingPONumbers.has(finalOrderNo.toLowerCase())) {
          finalOrderNo = `${orderNo}-${suffix}`;
          suffix++;
        }
        existingPONumbers.add(finalOrderNo.toLowerCase());

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

        const parseNumber = (value: string | undefined): number | null => {
          if (!value || !value.trim()) return null;
          const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
          return isNaN(num) ? null : num;
        };

        const csvDiscount = discountIdx >= 0 ? parseNumber(headerRow[discountIdx]) : null;
        const csvTax = taxIdx >= 0 ? parseNumber(headerRow[taxIdx]) : null;
        const csvSubtotal = subtotalIdx >= 0 ? parseNumber(headerRow[subtotalIdx]) : null;
        const csvTotal = totalIdx >= 0 ? parseNumber(headerRow[totalIdx]) : null;

        const discount = csvDiscount ?? 0;
        const subtotal = csvSubtotal ?? calculatedSubtotal;
        const gst = csvTax ?? (subtotal * 0.1);
        const total = csvTotal ?? (subtotal + gst);

        const validStatuses = ["draft", "ordered", "received", "partial", "cancelled"];
        const csvStatus = poStatusIdx >= 0 ? headerRow[poStatusIdx]?.trim().toLowerCase() : "";
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

        const poData = {
          id: `po_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          organizationId: "",
          poNumber: finalOrderNo,
          supplier: supplierName,
          supplierId: matchedSupplier?.id || null,
          supplierEmail: matchedSupplier?.email || "",
          supplierPhone: matchedSupplier?.phone || "",
          orderDate: orderDateIdx >= 0 ? parseDateStr(headerRow[orderDateIdx]?.trim() || "") : getTodayInput(),
          expectedDelivery: deliveryDateIdx >= 0 ? parseDateStr(headerRow[deliveryDateIdx]?.trim() || "") : getFutureDateInput(7),
          deliveryAddress: deliveryAddressIdx >= 0 ? headerRow[deliveryAddressIdx]?.trim() || "" : "",
          deliveryInstructions: deliveryInstructionsIdx >= 0 ? headerRow[deliveryInstructionsIdx]?.trim() || "" : "",
          reference: referenceIdx >= 0 ? headerRow[referenceIdx]?.trim() || "" : "",
          description: descriptionIdx >= 0 ? headerRow[descriptionIdx]?.trim() || "" : "",
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
            productId: null,
            section: null,
          })),
        };

        try {
          await createPurchaseOrder(poData);
          createdCount++;
        } catch (error) {
          console.error(`Failed to create PO ${finalOrderNo}:`, error);
        }
      }

      if (createdCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
        toast({ title: `Imported ${createdCount} purchase orders successfully` });
        setImportDialogOpen(false);
      } else {
        toast({ title: "No purchase orders were imported", variant: "destructive" });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import purchase orders", variant: "destructive" });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleDeleteAll = async () => {
    try {
      for (const po of purchaseOrders) {
        await deletePurchaseOrder(po.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      setDeleteAllDialogOpen(false);
      toast({ title: `Deleted ${purchaseOrders.length} purchase orders` });
    } catch (error) {
      toast({ title: "Failed to delete purchase orders", variant: "destructive" });
    }
  };

  const filteredPOs = statusFilter === "all" ? purchaseOrders : purchaseOrders.filter(p => p.status === statusFilter);

  const stats = {
    draft: purchaseOrders.filter(p => p.status === 'draft').length,
    ordered: purchaseOrders.filter(p => p.status === 'ordered').length,
    received: purchaseOrders.filter(p => p.status === 'received').length,
    totalValue: purchaseOrders.reduce((sum, p) => sum + p.total, 0),
  };

  return (
    <Layout>
      <FeatureGate feature="purchaseOrders">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-primary tracking-tight" data-testid="text-po-title">
              Purchase Orders
            </h1>
            <p className="text-muted-foreground mt-1">Track materials and supplier orders</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={purchaseOrders.length === 0}
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
                  Export Purchase Orders
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Purchase Orders
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
              <div className="p-2 md:p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <Truck className="h-4 w-4 md:h-5 md:w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.ordered}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Ordered</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-green-600 dark:text-green-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{stats.received}</p>
                <p className="text-xs md:text-sm text-muted-foreground truncate">Received</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-full bg-primary/10">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
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
            <CardTitle>All Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading purchase orders...</div>
            ) : purchaseOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Purchase Orders Yet</h3>
                <p className="text-muted-foreground mb-4">Create purchase orders from within a Job to track materials.</p>
                <Button onClick={() => setLocation('/jobs')} data-testid="button-go-to-jobs">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Go to Jobs
                </Button>
              </div>
            ) : (
              <>
                {statusFilter !== "all" && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-sm text-muted-foreground">
                      Showing {filteredPOs.length} of {purchaseOrders.length} purchase orders
                      {statusFilter !== "all" && ` (${statusLabels[statusFilter] || statusFilter})`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")} className="text-xs h-7">
                      Clear filter
                    </Button>
                  </div>
                )}
                {/* Mobile card layout */}
                <div className="md:hidden space-y-3">
                  {filteredPOs.map((po) => {
                    const linkedJob = jobs.find(j => j.id === po.jobId);
                    return (
                      <div 
                        key={po.id}
                        className="p-4 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setLocation(`/purchase-order/${po.id}`)}
                        data-testid={`card-po-${po.id}-mobile`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary">{po.poNumber}</span>
                          <Badge className={`${statusColors[po.status]} text-white`}>
                            {statusLabels[po.status]}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{po.supplier}</div>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold">${po.total.toFixed(2)}</div>
                          {po.expectedDelivery && (
                            <div className="text-xs text-muted-foreground">
                              Expected {formatDateShort(po.expectedDelivery)}
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
                            <Briefcase className="h-3 w-3 mr-1" />
                            {linkedJob.title}
                          </Button>
                        )}
                        <div className="flex gap-2 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              setEmailDialogPO(po as PurchaseOrderWithItems);
                              setIsEmailDialogOpen(true);
                            }}
                            data-testid={`button-send-po-${po.id}-mobile`}
                            aria-label={`Send PO ${po.poNumber}`}
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
                        <TableHead>PO #</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPOs.map((po) => {
                        const linkedJob = jobs.find(j => j.id === po.jobId);
                        return (
                          <TableRow 
                            key={po.id} 
                            data-testid={`row-po-${po.id}`}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => setLocation(`/purchase-order/${po.id}`)}
                          >
                            <TableCell className="font-medium">{po.poNumber}</TableCell>
                            <TableCell>
                              {linkedJob ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-primary"
                                  onClick={(e) => { e.stopPropagation(); setLocation(`/jobs/${linkedJob.id}`); }}
                                  data-testid={`link-job-${linkedJob.id}`}
                                >
                                  <Briefcase className="h-3 w-3 mr-1" />
                                  {linkedJob.title}
                                </Button>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>{po.supplier}</TableCell>
                            <TableCell>{formatDateShort(po.orderDate)}</TableCell>
                            <TableCell>{formatDateShort(po.expectedDelivery)}</TableCell>
                            <TableCell>${po.total.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge className={`${statusColors[po.status]} text-white`}>
                                {statusLabels[po.status]}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setEmailDialogPO(po as PurchaseOrderWithItems);
                                  setIsEmailDialogOpen(true);
                                }}
                                data-testid={`button-send-po-${po.id}`}
                                aria-label={`Send PO ${po.poNumber}`}
                              >
                                <Send className="h-4 w-4 mr-1" aria-hidden="true" />
                                Send
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
              <DialogTitle>{selectedPO ? "Edit Purchase Order" : "New Purchase Order"}</DialogTitle>
            </DialogHeader>
            <POForm 
              po={selectedPO || undefined}
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
            document={preparePurchaseOrderData(previewDocument, jobs.find(j => j.id === previewDocument.jobId))}
            theme={themes.find(t => t.id === previewDocument.themeId) || themes.find(t => t.isDefault === 'true') || null}
          />
        )}

        {emailDialogPO && (
          <SendEmailDialog
            open={isEmailDialogOpen}
            onOpenChange={setIsEmailDialogOpen}
            documentType="purchase_order"
            documentId={emailDialogPO.id}
            documentNumber={emailDialogPO.poNumber}
            recipientEmail={emailDialogPO.supplierEmail || ""}
            recipientName={emailDialogPO.supplier}
            onSuccess={() => {
              toast({ title: "Purchase order sent", description: `${emailDialogPO.poNumber} has been sent to ${emailDialogPO.supplier}` });
            }}
          />
        )}

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Purchase Orders</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with purchase order data. Use the template format or download our template.
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
                <p className="text-sm text-muted-foreground">Importing purchase orders...</p>
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
              <AlertDialogTitle>Delete All Purchase Orders</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {purchaseOrders.length} purchase orders? This action cannot be undone.
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
      </FeatureGate>
    </Layout>
  );
}
