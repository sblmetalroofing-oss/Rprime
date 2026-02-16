import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { formatJobNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Save, 
  Plus, 
  Trash2,
  Package,
  Loader2,
  Send,
  Eye,
  Phone,
  MessageSquare,
  CheckCircle,
  Truck,
  ArrowLeft
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { 
  fetchPurchaseOrder, 
  createPurchaseOrder, 
  updatePurchaseOrder, 
  getNextPONumber,
  fetchJobs,
  fetchJobWithDocuments,
  fetchSuppliers,
  fetchItems,
  fetchDocumentThemes,
  fetchDocumentThemeSettings,
  type PurchaseOrderWithItems,
  type DocumentTheme,
  type DocumentThemeSettings
} from "@/lib/api";
import type { InsertPurchaseOrder, Job, Supplier, Item } from "@shared/schema";
import { getTodayInput, getFutureDateInput, formatDateShort } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { PdfPreviewModal, preparePurchaseOrderData, generatePdfBase64 } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { DocumentAttachments } from "@/components/document-attachments";
import { MobileLineItemCard } from "@/components/mobile-line-item-card";

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  ordered: "bg-blue-500",
  received: "bg-green-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400"
};

type POItemInput = {
  id: string;
  description: string;
  qty: number | string;
  unitCost: number | string;
  total: number;
  itemCode: string | null;
  productId: string | null;
  sortOrder: number | null;
  section: string | null;
};

export default function POEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/purchase-order/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [nextNumber, setNextNumber] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoading, setThemeSettingsLoading] = useState(false);

  const [formData, setFormData] = useState<InsertPurchaseOrder>({
    id: `po_${Date.now()}`,
    poNumber: "",
    supplier: "",
    supplierContact: "",
    supplierPhone: "",
    supplierEmail: "",
    supplierId: null,
    status: "draft",
    orderDate: getTodayInput(),
    expectedDelivery: getFutureDateInput(7),
    deliveryAddress: "",
    deliveryInstructions: "",
    reference: "",
    description: "",
    discount: 0,
    subtotal: 0,
    gst: 0,
    total: 0,
    taxMode: "exclusive",
    notes: "",
    createdBy: "",
    jobId: null,
    themeId: null,
  });

  const [items, setItems] = useState<POItemInput[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [isNew, params?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [jobsData, suppliersData, productsData, number, themesData] = await Promise.all([
        fetchJobs(),
        fetchSuppliers(),
        fetchItems(),
        getNextPONumber(),
        fetchDocumentThemes()
      ]);
      setJobs(jobsData);
      setSuppliers(suppliersData);
      setProducts(productsData.filter(p => p.isActive === 'true'));
      setNextNumber(number);
      setThemes(themesData.filter(t => t.isArchived !== 'true'));
      
      const defaultTheme = themesData.find(t => t.isDefault === 'true' && t.isArchived !== 'true');

      if (!isNew && params?.id) {
        const po = await fetchPurchaseOrder(params.id);
        if (po) {
          setFormData({
            id: po.id,
            poNumber: po.poNumber,
            supplier: po.supplier,
            supplierContact: po.supplierContact || "",
            supplierPhone: po.supplierPhone || "",
            supplierEmail: po.supplierEmail || "",
            supplierId: po.supplierId || null,
            status: po.status,
            orderDate: po.orderDate || "",
            expectedDelivery: po.expectedDelivery || "",
            deliveryAddress: po.deliveryAddress || "",
            deliveryInstructions: po.deliveryInstructions || "",
            reference: po.reference || "",
            description: po.description || "",
            discount: po.discount || 0,
            subtotal: po.subtotal || 0,
            gst: po.gst || 0,
            total: po.total || 0,
            taxMode: po.taxMode || "exclusive",
            notes: po.notes || "",
            createdBy: po.createdBy || "",
            jobId: po.jobId || null,
            themeId: po.themeId || defaultTheme?.id || null,
          });
          setItems(po.items?.map(i => ({
            id: i.id,
            description: i.description,
            qty: i.qty,
            unitCost: i.unitCost,
            total: i.total,
            itemCode: i.itemCode || null,
            productId: i.productId || null,
            sortOrder: i.sortOrder || null,
            section: i.section || null,
          })) || []);
          
          if (po.supplierId) {
            const supplier = suppliersData.find(s => s.id === po.supplierId);
            setSelectedSupplier(supplier || null);
          }
        }
      } else {
        setFormData(prev => ({ ...prev, poNumber: number, themeId: defaultTheme?.id || null }));
        
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        if (jobId) {
          setFormData(prev => ({ ...prev, jobId }));
          const jobData = await fetchJobWithDocuments(jobId);
          if (jobData?.job?.address) {
            setFormData(prev => ({ ...prev, deliveryAddress: jobData.job.address }));
          }
        } else {
          // Redirect to jobs page if no jobId provided - POs must be created from a job
          setLocation('/jobs');
          return;
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      toast({ title: "Failed to load data", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    const loadThemeSettings = async () => {
      const effectiveThemeId = formData.themeId || themes.find(t => t.isDefault === 'true')?.id;
      if (!effectiveThemeId) {
        setThemeSettings(null);
        setThemeSettingsLoading(false);
        return;
      }
      setThemeSettingsLoading(true);
      try {
        const settingsArray = await fetchDocumentThemeSettings(effectiveThemeId);
        const poSettings = settingsArray.find(s => s.documentType === 'purchase_order');
        setThemeSettings(poSettings || null);
      } catch (error) {
        console.error('Error loading theme settings:', error);
        setThemeSettings(null);
      }
      setThemeSettingsLoading(false);
    };
    if (themes.length > 0) {
      loadThemeSettings();
    }
  }, [formData.themeId, themes]);

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: "",
      qty: 1,
      unitCost: 0,
      total: 0,
      itemCode: null,
      productId: null,
      sortOrder: prev.length,
      section: null,
    }]);
  };

  const addProductToItems = (product: Item) => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: product.description,
      qty: 1,
      unitCost: product.costPrice || 0,
      total: product.costPrice || 0,
      itemCode: product.itemCode || null,
      productId: product.id,
      sortOrder: prev.length,
      section: null,
    }]);
    setShowProductPicker(false);
    setProductSearch("");
  };

  const filteredProducts = products.filter(p => {
    const search = productSearch.toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const code = (p.itemCode || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return desc.includes(search) || code.includes(search) || cat.includes(search);
  });

  const updateItem = (index: number, field: keyof POItemInput, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total when qty or unitCost changes (parse for calculation only)
      if (field === 'qty' || field === 'unitCost') {
        const qty = typeof updated[index].qty === 'number' ? updated[index].qty : parseFloat(String(updated[index].qty)) || 0;
        const unitCost = typeof updated[index].unitCost === 'number' ? updated[index].unitCost : parseFloat(String(updated[index].unitCost)) || 0;
        // Round to 2 decimal places to avoid floating point precision issues
        updated[index].total = Math.round(qty * unitCost * 100) / 100;
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
    const discountAmount = Math.min(formData.discount || 0, subtotal);
    const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
    const gst = Math.round(afterDiscount * 0.1 * 100) / 100;
    const total = Math.round((afterDiscount + gst) * 100) / 100;
    setFormData(prev => ({ ...prev, subtotal, gst, total }));
  }, [items, formData.discount]);

  const handleSupplierChange = (supplierId: string | null) => {
    if (supplierId) {
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier) {
        setSelectedSupplier(supplier);
        setFormData(prev => ({ 
          ...prev, 
          supplierId,
          supplier: supplier.name,
          supplierContact: supplier.contactName || "",
          supplierPhone: supplier.phone || "",
          supplierEmail: supplier.email || ""
        }));
      }
    } else {
      setSelectedSupplier(null);
      setFormData(prev => ({ 
        ...prev, 
        supplierId: null,
        supplier: "", 
        supplierContact: "",
        supplierPhone: "",
        supplierEmail: ""
      }));
    }
  };

  const handleSave = async () => {
    if (!formData.supplier) {
      toast({ title: "Please select a supplier", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      const clampedDiscount = Math.max(0, Math.min(formData.discount || 0, formData.subtotal || 0));
      // Sanitize items to numbers before saving
      const sanitizedItems = items.map(item => ({
        ...item,
        qty: typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0,
        unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(String(item.unitCost)) || 0,
      }));
      const data = { ...formData, discount: clampedDiscount, items: sanitizedItems };
      if (isNew) {
        const newPO = await createPurchaseOrder(data);
        toast({ title: "Purchase order created" });
        setLocation(`/purchase-order/${newPO.id}`);
      } else {
        await updatePurchaseOrder(params!.id!, data);
        toast({ title: "Purchase order saved" });
      }
    } catch (err) {
      console.error('Failed to save purchase order:', err);
      toast({ title: "Failed to save purchase order", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await updatePurchaseOrder(formData.id, { status: 'ordered' });
      setFormData(prev => ({ ...prev, status: 'ordered' }));
      toast({ title: "Purchase order approved and sent to supplier" });
    } catch (err) {
      toast({ title: "Failed to approve", variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const linkedJob = jobs.find(j => j.id === formData.jobId);
  const discountExceedsSubtotal = (formData.discount || 0) > (formData.subtotal || 0);

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumb className="mb-4 hidden md:block">
          <BreadcrumbList>
            {formData.jobId && linkedJob ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/jobs" data-testid="breadcrumb-jobs">Jobs</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href={`/jobs/${formData.jobId}`} data-testid="breadcrumb-job">{linkedJob ? formatJobNumber(linkedJob) : `#${formData.jobId.slice(-8).toUpperCase()}`}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/purchase-orders" data-testid="breadcrumb-pos">Purchase Orders</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">
                {isNew ? "New PO" : `PO ${formData.poNumber}`}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Sticky Summary Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                onClick={() => formData.jobId ? setLocation(`/jobs/${formData.jobId}`) : setLocation('/purchase-orders')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold truncate">
                    {isNew ? "New PO" : formData.poNumber}
                  </h1>
                  <Badge 
                    className={`${statusColors[formData.status || 'draft']} text-white shrink-0`}
                    data-testid="badge-status"
                  >
                    {formData.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {selectedSupplier?.name || "No supplier"}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">${(formData.total || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Quick Actions Row - Tradify Style */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mt-3">
              <Button onClick={handleSave} disabled={saving} className="h-11 shrink-0 active:scale-95 transition-transform" data-testid="button-save">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
              
              {formData.status === 'draft' && !isNew && (
                <Button 
                  onClick={handleApprove} 
                  disabled={saving}
                  variant="secondary"
                  className="h-11 shrink-0 bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform"
                  data-testid="button-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              )}

              <Button 
                variant="outline" 
                onClick={() => setShowEmailDialog(true)} 
                disabled={formData.status === 'draft' || themeSettingsLoading}
                title={formData.status === 'draft' ? "Approve PO before sending" : undefined}
                className="h-11 shrink-0 active:scale-95 transition-transform"
                data-testid="button-email"
              >
                <Send className="h-4 w-4 mr-2" />
                Email
              </Button>
              
              {selectedSupplier?.phone && (
                <>
                  <Button 
                    variant="outline"
                    className="h-11 shrink-0 active:scale-95 transition-transform"
                    onClick={() => window.open(`tel:${selectedSupplier.phone}`, '_self')}
                    data-testid="button-call"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="ml-1.5">Call</span>
                  </Button>
                  <Button 
                    variant="outline"
                    className="h-11 shrink-0 active:scale-95 transition-transform"
                    onClick={() => window.open(`sms:${selectedSupplier.phone}`, '_self')}
                    data-testid="button-sms"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="ml-1.5">SMS</span>
                  </Button>
                </>
              )}

            <Button 
              variant="outline"
              className="h-11 shrink-0 active:scale-95 transition-transform"
              onClick={() => setLocation(`/preview/po/${formData.id}`)}
              data-testid="button-preview"
            >
              <Eye className="h-4 w-4" />
              <span className="ml-1.5">Preview</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            
            {/* Purchase Order Information */}
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Order No</Label>
                    <Input value={formData.poNumber} disabled className="h-11" data-testid="input-po-number" />
                  </div>
                  <div>
                    <Label>Document Theme</Label>
                    <Select 
                      value={formData.themeId || ""} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, themeId: value || null }))}
                    >
                      <SelectTrigger className="h-11" data-testid="select-po-theme">
                        <SelectValue placeholder="Select theme..." />
                      </SelectTrigger>
                      <SelectContent>
                        {themes.map((theme) => (
                          <SelectItem key={theme.id} value={theme.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: theme.themeColor || '#0891b2' }}
                              />
                              <span>{theme.name}</span>
                              {theme.isDefault === 'true' && (
                                <span className="text-xs text-muted-foreground">(Default)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select 
                      value={formData.status} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="h-11" data-testid="select-po-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="ordered">Ordered</SelectItem>
                        <SelectItem value="received">Received</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reference</Label>
                    <Input
                      value={formData.reference || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="PO reference..."
                      className="h-11"
                      data-testid="input-po-reference"
                    />
                  </div>
                </div>

                <div>
                  <Label>Supplier *</Label>
                  <SearchableSelect
                    value={formData.supplierId ?? null}
                    onValueChange={handleSupplierChange}
                    options={suppliers.map(s => ({ 
                      value: s.id, 
                      label: s.name, 
                      sublabel: s.email || s.phone || undefined 
                    }))}
                    placeholder="Select supplier (Required)"
                    searchPlaceholder="Search suppliers..."
                    emptyText="No suppliers found."
                    data-testid="select-po-supplier"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Order Date</Label>
                    <Input
                      type="date"
                      value={formData.orderDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
                      className="h-11"
                      data-testid="input-po-order-date"
                    />
                  </div>
                  <div>
                    <Label>Delivery Date</Label>
                    <Input
                      type="date"
                      value={formData.expectedDelivery || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
                      className="h-11"
                      data-testid="input-po-delivery-date"
                    />
                  </div>
                </div>

                <div>
                  <Label>Linked Job (Optional)</Label>
                  <SearchableSelect
                    value={formData.jobId ?? null}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, jobId: value }))}
                    options={jobs.map(j => ({ value: j.id, label: `${formatJobNumber(j)} - ${j.title}`, sublabel: j.address || undefined }))}
                    placeholder="No linked job"
                    searchPlaceholder="Search jobs..."
                    emptyText="No jobs found."
                    data-testid="select-po-job"
                  />
                </div>

                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Order description..."
                    rows={2}
                    data-testid="input-po-description"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Line Items</CardTitle>
                  <div className="flex gap-2">
                    <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-11" data-testid="button-add-from-catalog">
                          <Package className="h-4 w-4 mr-1" />
                          From Catalog
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Add from Product Catalog</DialogTitle>
                        </DialogHeader>
                        <Input
                          placeholder="Search products..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="mb-3"
                          data-testid="input-product-search"
                        />
                        <ScrollArea className="h-[300px]">
                          {filteredProducts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No products found</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {filteredProducts.map((product) => (
                                <div
                                  key={product.id}
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                                  onClick={() => addProductToItems(product)}
                                  data-testid={`product-item-${product.id}`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      {product.itemCode && (
                                        <Badge variant="outline" className="text-xs shrink-0">
                                          {product.itemCode}
                                        </Badge>
                                      )}
                                      <p className="font-medium truncate">{product.description}</p>
                                    </div>
                                    {product.category && (
                                      <p className="text-xs text-muted-foreground">{product.category}</p>
                                    )}
                                  </div>
                                  <div className="text-right ml-2 shrink-0">
                                    <p className="font-medium">${(product.costPrice || 0).toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">cost</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" className="h-11" onClick={addItem} data-testid="button-add-item">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Line Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No items yet</p>
                    <Button variant="outline" className="mt-4 h-11" onClick={addItem}>
                      Add Line Item
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Desktop Card View */}
                    <div className="hidden md:block space-y-3">
                      {items.map((item, index) => (
                        <div key={item.id} className="p-3 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              {item.itemCode && (
                                <Badge variant="outline" className="text-xs">
                                  {item.itemCode}
                                </Badge>
                              )}
                              <Textarea
                                value={item.description}
                                onChange={(e) => updateItem(index, 'description', e.target.value)}
                                placeholder="Item description"
                                rows={2}
                                className="min-h-[60px] resize-none"
                                data-testid={`input-item-desc-${index}`}
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeItem(index)}
                              className="shrink-0"
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Qty</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.qty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '-.') {
                                    updateItem(index, 'qty', val);
                                    return;
                                  }
                                  if (/^-?\d*\.?\d*$/.test(val)) {
                                    const num = parseFloat(val);
                                    updateItem(index, 'qty', isNaN(num) ? val : num);
                                  }
                                }}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value);
                                  updateItem(index, 'qty', isNaN(num) ? 0 : num);
                                }}
                                className="h-11"
                                data-testid={`input-item-qty-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Unit Cost</Label>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.unitCost}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '' || val === '-' || val === '-.') {
                                    updateItem(index, 'unitCost', val);
                                    return;
                                  }
                                  if (/^-?\d*\.?\d*$/.test(val)) {
                                    const num = parseFloat(val);
                                    updateItem(index, 'unitCost', isNaN(num) ? val : num);
                                  }
                                }}
                                onBlur={(e) => {
                                  const num = parseFloat(e.target.value);
                                  updateItem(index, 'unitCost', isNaN(num) ? 0 : num);
                                }}
                                className="h-11"
                                data-testid={`input-item-cost-${index}`}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Total</Label>
                              <div className="h-11 flex items-center font-medium text-primary">
                                ${item.total.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mobile Card View */}
                    <div className="block md:hidden space-y-3">
                      {items.map((item, index) => (
                        <MobileLineItemCard
                          key={item.id}
                          item={item}
                          index={index}
                          showSection={false}
                          onUpdateDescription={(value) => updateItem(index, 'description', value)}
                          onUpdateQty={(value) => updateItem(index, 'qty', value)}
                          onUpdateUnitCost={(value) => updateItem(index, 'unitCost', value)}
                          onBlurQty={() => {
                            const num = parseFloat(String(item.qty));
                            updateItem(index, 'qty', isNaN(num) ? 0 : num);
                          }}
                          onBlurUnitCost={() => {
                            const num = parseFloat(String(item.unitCost));
                            updateItem(index, 'unitCost', isNaN(num) ? 0 : num);
                          }}
                          onRemove={() => removeItem(index)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Attachments */}
            {!isNew && formData.id && (
              <DocumentAttachments 
                documentType="purchase_order" 
                documentId={formData.id}
              />
            )}
            
            {/* Delivery Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Delivery Address</Label>
                  <Textarea
                    value={formData.deliveryAddress || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                    placeholder="Delivery address..."
                    rows={2}
                    data-testid="input-po-delivery-address"
                  />
                </div>
                <div>
                  <Label>Delivery Instructions</Label>
                  <Textarea
                    value={formData.deliveryInstructions || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryInstructions: e.target.value }))}
                    placeholder="Special delivery instructions..."
                    rows={2}
                    data-testid="input-po-delivery-instructions"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  rows={3}
                  data-testid="input-po-notes"
                />
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Purchase Order Totals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm">Tax</Label>
                  <Select 
                    value={formData.taxMode || "exclusive"} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, taxMode: value }))}
                  >
                    <SelectTrigger className="h-11" data-testid="select-po-tax-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                      <SelectItem value="inclusive">Inclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />

                <div>
                  <Label className="text-sm">Discount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormData(prev => ({ ...prev, discount: Math.max(0, val) }));
                    }}
                    className="h-11"
                    data-testid="input-po-discount"
                  />
                  {discountExceedsSubtotal && (
                    <p className="text-xs text-orange-500 mt-1">
                      Will be capped to ${formData.subtotal?.toFixed(2)} on save
                    </p>
                  )}
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-primary">${formData.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total GST</span>
                  <span className="font-medium text-primary">${formData.gst?.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">${formData.total?.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Audit Information */}
            {!isNew && (
              <Card>
                <CardHeader>
                  <CardTitle>Audit Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {formData.createdBy && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entered By</span>
                      <span>{formData.createdBy}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entered On</span>
                    <span>{formatDateShort(formData.orderDate)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <PdfPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          document={preparePurchaseOrderData({ ...formData, items } as PurchaseOrderWithItems, linkedJob)}
          theme={themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null}
          themeSettings={themeSettings}
        />
      )}

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="purchase_order"
          documentId={formData.id}
          documentNumber={formData.poNumber}
          recipientEmail={formData.supplierEmail || ""}
          recipientName={formData.supplier}
          onSuccess={() => {
            toast({ title: "Purchase Order Sent", description: "PO sent to supplier" });
            setFormData(prev => ({ ...prev, status: 'ordered' }));
          }}
          getPdfBase64={async () => {
            // Fetch fresh job data just like po-preview.tsx does to ensure
            // job number and address are available for PDF generation
            let freshJob = linkedJob;
            if (formData.jobId) {
              try {
                const jobData = await fetchJobWithDocuments(formData.jobId);
                if (jobData?.job) {
                  freshJob = jobData.job;
                }
              } catch (e) {
                console.error('Failed to fetch fresh job data:', e);
              }
            }
            const documentData = preparePurchaseOrderData({ ...formData, items } as PurchaseOrderWithItems, freshJob);
            const selectedTheme = themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null;
            let currentThemeSettings = themeSettings;
            if (selectedTheme?.id) {
              try {
                const settingsArray = await fetchDocumentThemeSettings(selectedTheme.id);
                currentThemeSettings = settingsArray.find(s => s.documentType === 'purchase_order') || null;
              } catch (e) {
                console.error('Failed to fetch theme settings:', e);
              }
            }
            return generatePdfBase64(documentData, selectedTheme, currentThemeSettings);
          }}
        />
      )}
    </Layout>
  );
}
