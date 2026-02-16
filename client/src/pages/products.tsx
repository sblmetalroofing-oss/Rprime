import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Search, Package, DollarSign, Percent, Building2, Download, Upload, FileText, Trash2 } from "lucide-react";
import { fetchItems, deleteItem } from "@/lib/api";
import type { Item } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { FeatureGate } from "@/components/feature-gate";
import { ProductImportDialog } from "@/components/product-import-dialog";

export default function Products() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Item | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [markupDialogOpen, setMarkupDialogOpen] = useState(false);
  const [markupPercent, setMarkupPercent] = useState("30");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["items", searchQuery],
    queryFn: () => fetchItems(searchQuery || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      toast({ title: "Product deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete product", variant: "destructive" });
    }
  });

  const confirmDelete = (product: Item) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const calculateMarkup = (cost: number, sell: number) => {
    if (cost === 0) return 0;
    return Math.round(((sell - cost) / cost) * 100);
  };

  // Apply markup to products with $0 sell price
  const applyMarkupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/items/apply-markup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ markupPercent: parseFloat(markupPercent) })
      });
      if (!response.ok) throw new Error('Failed to apply markup');
      return response.json();
    },
    onSuccess: (result: { updated: number; markup: number }) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      toast({ title: `Updated ${result.updated} products with ${result.markup}% markup` });
      setMarkupDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to apply markup", variant: "destructive" });
    }
  });

  // Count products that need markup
  const productsNeedingMarkup = products.filter(p => p.sellPrice === 0 && p.costPrice > 0).length;

  const exportToCSV = () => {
    const headers = [
      "Item Code", "Description", "Unit Of Measure", "Buy Price", "Category",
      "Sales Tax Rate", "Sales Account Code", "Purchase Tax Rate", "Purchase Account Code",
      "50% Mark up", "100% Mark up", "80% Mark up", "90 % Mark up", "95% Mark up",
      "98% Mark up", "200% Mark up", "250% Mark up", "150% Mark up", "70%",
      "60% Mark up", "300 MARK UP", "mark up", "500", "400", "400 mark up",
      "%400", "2", "4", "5", "350%", "Includes Tax", "Archived"
    ];
    
    const rows = products.map(p => {
      const cost = p.costPrice || 0;
      const markup = p.markup || calculateMarkup(cost, p.sellPrice);
      return [
        p.itemCode,
        p.description,
        p.unit || "each",
        cost.toFixed(2),
        p.category || "",
        "", "", "", "",
        "", "", "", "", "", "", "", "", "", "", "", "",
        markup.toString(),
        "", "", "", "", "", "", "", "",
        "No",
        p.isActive === "false" ? "Yes" : "No"
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
    link.download = `products_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${products.length} products` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Item Code", "Description", "Unit Of Measure", "Buy Price", "Category",
      "Sales Tax Rate", "Sales Account Code", "Purchase Tax Rate", "Purchase Account Code",
      "50% Mark up", "100% Mark up", "80% Mark up", "90 % Mark up", "95% Mark up",
      "98% Mark up", "200% Mark up", "250% Mark up", "150% Mark up", "70%",
      "60% Mark up", "300 MARK UP", "mark up", "500", "400", "400 mark up",
      "%400", "2", "4", "5", "350%", "Includes Tax", "Archived"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "product_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Template downloaded" });
  };

  const handleDeleteAll = async () => {
    try {
      for (const product of products) {
        await deleteItem(product.id);
      }
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setDeleteAllDialogOpen(false);
      toast({ title: `Deleted ${products.length} products` });
    } catch (error) {
      toast({ title: "Failed to delete products", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <FeatureGate feature="products">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary" data-testid="text-products-title">
              Product Catalog
            </h1>
            <p className="text-muted-foreground text-sm">Manage your products with supplier codes and pricing</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={products.length === 0}
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
                  Export Products
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Products
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate} data-testid="button-download-template">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
                {productsNeedingMarkup > 0 && (
                  <DropdownMenuItem onClick={() => setMarkupDialogOpen(true)} data-testid="button-apply-markup">
                    <Percent className="h-4 w-4 mr-2" />
                    Apply Markup ({productsNeedingMarkup} products)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setLocation("/product/new")} className="h-11 sm:h-10 flex-1 sm:flex-none" data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        </div>

        <ProductImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11"
            data-testid="input-search-products"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Add your first product to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {products.map((product) => (
              <Card 
                key={product.id} 
                className="hover:shadow-md transition-shadow cursor-pointer" 
                data-testid={`card-product-${product.id}`}
                onClick={() => setLocation(`/product/${product.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate">{product.description}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs font-mono">
                          {product.itemCode}
                        </Badge>
                        {product.supplierItemCode && (
                          <Badge variant="secondary" className="text-xs font-mono">
                            {product.supplierItemCode}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Cost</span>
                      <span className="font-medium text-red-600">{formatCurrency(product.costPrice || 0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Sell</span>
                      <span className="font-medium text-green-600">{formatCurrency(product.sellPrice)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs">Markup</span>
                      <span className="font-medium text-primary">
                        {calculateMarkup(product.costPrice || 0, product.sellPrice)}%
                      </span>
                    </div>
                  </div>
                  
                  {(product.supplierName || product.category) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {product.supplierName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {product.supplierName}
                        </div>
                      )}
                      {product.category && (
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.description}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => productToDelete && deleteMutation.mutate(productToDelete.id)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Products</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {products.length} products? This action cannot be undone.
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

      <AlertDialog open={markupDialogOpen} onOpenChange={setMarkupDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Markup to Products</AlertDialogTitle>
            <AlertDialogDescription>
              This will calculate sell prices for {productsNeedingMarkup} products that have a cost price but no sell price.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="markupInput">Markup Percentage</Label>
            <div className="flex items-center gap-2 mt-2">
              <Input
                id="markupInput"
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                className="w-24"
                min="0"
                max="500"
                data-testid="input-markup-percent"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Example: Cost $100 with {markupPercent}% markup = Sell ${(100 * (1 + parseFloat(markupPercent || "0") / 100)).toFixed(2)}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => applyMarkupMutation.mutate()}
              disabled={applyMarkupMutation.isPending}
            >
              {applyMarkupMutation.isPending ? "Applying..." : "Apply Markup"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </FeatureGate>
    </Layout>
  );
}
