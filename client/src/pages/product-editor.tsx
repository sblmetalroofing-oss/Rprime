import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Save, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchItem, createItem, updateItem, deleteItem, fetchSuppliers } from "@/lib/api";
import type { InsertItem, Supplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const UNITS = ["each", "m", "m²", "m³", "kg", "L", "hour", "day", "pack", "roll", "sheet", "box"];
const CATEGORIES = ["Roofing", "Gutters", "Fascia", "Downpipes", "Flashings", "Insulation", "Fasteners", "Sealants", "Labor", "Other"];

export default function ProductEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/product/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetchSuppliers(),
  });

  const [formData, setFormData] = useState<Partial<InsertItem>>({
    itemCode: "",
    supplierItemCode: "",
    description: "",
    category: "",
    unit: "each",
    costPrice: 0,
    sellPrice: 0,
    markup: 0,
    supplierId: null,
    supplierName: "",
    notes: "",
    isActive: "true",
  });

  useEffect(() => {
    if (!isNew && params?.id) {
      loadProduct(params.id);
    }
  }, [isNew, params?.id]);

  const loadProduct = async (id: string) => {
    setLoading(true);
    try {
      const product = await fetchItem(id);
      if (product) {
        setFormData({
          itemCode: product.itemCode,
          supplierItemCode: product.supplierItemCode || "",
          description: product.description,
          category: product.category || "",
          unit: product.unit || "each",
          costPrice: product.costPrice || 0,
          sellPrice: product.sellPrice,
          markup: product.markup || 0,
          supplierId: product.supplierId,
          supplierName: product.supplierName || "",
          notes: product.notes || "",
          isActive: product.isActive || "true",
        });
      }
    } catch (err) {
      console.error("Failed to load product:", err);
      toast({ title: "Failed to load product", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCostChange = (cost: number) => {
    const sell = formData.sellPrice || 0;
    const markup = cost > 0 ? Math.round(((sell - cost) / cost) * 100) : 0;
    setFormData(prev => ({ ...prev, costPrice: cost, markup }));
  };

  const handleSellChange = (sell: number) => {
    const cost = formData.costPrice || 0;
    const markup = cost > 0 ? Math.round(((sell - cost) / cost) * 100) : 0;
    setFormData(prev => ({ ...prev, sellPrice: sell, markup }));
  };

  const handleMarkupChange = (markup: number) => {
    const cost = formData.costPrice || 0;
    const sell = cost * (1 + markup / 100);
    setFormData(prev => ({ ...prev, markup, sellPrice: Math.round(sell * 100) / 100 }));
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setFormData(prev => ({
      ...prev,
      supplierId: supplierId || null,
      supplierName: supplier?.name || "",
    }));
  };

  const handleSave = async () => {
    if (!formData.itemCode?.trim()) {
      toast({ title: "Item code is required", variant: "destructive" });
      return;
    }
    if (!formData.description?.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data: InsertItem = {
        itemCode: formData.itemCode.trim(),
        supplierItemCode: formData.supplierItemCode?.trim() || null,
        description: formData.description.trim(),
        category: formData.category?.trim() || null,
        unit: formData.unit || "each",
        costPrice: formData.costPrice || 0,
        sellPrice: formData.sellPrice || 0,
        markup: formData.markup || 0,
        supplierId: formData.supplierId || null,
        supplierName: formData.supplierName?.trim() || null,
        notes: formData.notes?.trim() || null,
        isActive: formData.isActive || "true",
      };

      if (isNew) {
        await createItem(data);
        toast({ title: "Product created successfully" });
      } else {
        await updateItem(params!.id, data);
        toast({ title: "Product updated successfully" });
      }
      setLocation("/products");
    } catch (err) {
      console.error("Failed to save product:", err);
      toast({ title: "Failed to save product", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteItem(params!.id);
      toast({ title: "Product deleted" });
      setLocation("/products");
    } catch (err) {
      toast({ title: "Failed to delete product", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/products" data-testid="breadcrumb-products">Products</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">
              {isNew ? "New Product" : formData.itemCode || "Edit Product"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/products")} className="h-11 w-11" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-primary">
              {isNew ? "New Product" : "Edit Product"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="icon" onClick={() => setShowDeleteDialog(true)} className="h-11 w-11 text-destructive" data-testid="button-delete-product">
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="h-11 min-h-[44px]" data-testid="button-save-product">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Product Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="itemCode" className="text-sm font-medium">Item Code *</Label>
                <Input
                  id="itemCode"
                  value={formData.itemCode || ""}
                  onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                  placeholder="e.g. ROOF-001"
                  className="h-11 min-h-[44px] text-base font-mono"
                  data-testid="input-item-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierItemCode" className="text-sm font-medium">Supplier Item Code</Label>
                <Input
                  id="supplierItemCode"
                  value={formData.supplierItemCode || ""}
                  onChange={(e) => setFormData({ ...formData, supplierItemCode: e.target.value })}
                  placeholder="Supplier's code"
                  className="h-11 min-h-[44px] text-base font-mono"
                  data-testid="input-supplier-item-code"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select 
                  value={formData.category || ""} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit" className="text-sm font-medium">Unit</Label>
                <Select 
                  value={formData.unit || "each"} 
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice" className="text-sm font-medium">Cost Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.costPrice || ""}
                    onChange={(e) => handleCostChange(parseFloat(e.target.value) || 0)}
                    className="h-11 min-h-[44px] text-base pl-7"
                    data-testid="input-cost-price"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sellPrice" className="text-sm font-medium">Sell Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="sellPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.sellPrice || ""}
                    onChange={(e) => handleSellChange(parseFloat(e.target.value) || 0)}
                    className="h-11 min-h-[44px] text-base pl-7"
                    data-testid="input-sell-price"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="markup" className="text-sm font-medium">Markup %</Label>
                <div className="relative">
                  <Input
                    id="markup"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.markup || ""}
                    onChange={(e) => handleMarkupChange(parseFloat(e.target.value) || 0)}
                    className="h-11 min-h-[44px] text-base pr-7"
                    data-testid="input-markup"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier" className="text-sm font-medium">Supplier</Label>
              <Select 
                value={formData.supplierId || "none"} 
                onValueChange={(value) => handleSupplierChange(value === "none" ? "" : value)}
              >
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-supplier">
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
                className="text-base"
                data-testid="input-notes"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
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
