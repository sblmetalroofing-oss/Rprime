import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { MobileLayout } from "@/components/mobile-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Building2, User, CreditCard, Download, Upload, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api";
import type { Supplier, InsertSupplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

export default function Suppliers() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<Partial<InsertSupplier>>({});

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", searchQuery],
    queryFn: () => fetchSuppliers(searchQuery || undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertSupplier) => createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      setFormData({});
      toast({ title: "Supplier added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create supplier", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertSupplier> }) => updateSupplier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDialogOpen(false);
      setEditingSupplier(null);
      setFormData({});
      toast({ title: "Supplier updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update supplier", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      toast({ title: "Supplier deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete supplier", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" });
      return;
    }

    if (editingSupplier) {
      updateMutation.mutate({ id: editingSupplier.id, data: formData });
    } else {
      const newSupplier: InsertSupplier = {
        id: crypto.randomUUID(),
        organizationId: "",
        name: formData.name.trim(),
        contactName: formData.contactName?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        address: formData.address?.trim() || null,
        suburb: formData.suburb?.trim() || null,
        postcode: formData.postcode?.trim() || null,
        state: formData.state?.trim() || null,
        accountNumber: formData.accountNumber?.trim() || null,
        paymentTerms: formData.paymentTerms?.trim() || null,
        notes: formData.notes?.trim() || null,
        isActive: 'true',
      };
      createMutation.mutate(newSupplier);
    }
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      suburb: supplier.suburb,
      postcode: supplier.postcode,
      state: supplier.state,
      accountNumber: supplier.accountNumber,
      paymentTerms: supplier.paymentTerms,
      notes: supplier.notes,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    setFormData({});
    setDialogOpen(true);
  };

  const confirmDelete = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      for (const supplier of suppliers) {
        await deleteSupplier(supplier.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setDeleteAllDialogOpen(false);
      toast({ title: "All suppliers deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete all suppliers", variant: "destructive" });
    }
  });

  const exportToCSV = () => {
    const headers = [
      "Supplier Name", "Contact Name", "Phone Number", "Mobile Number", "Fax Number",
      "Email Address", "Physical Address Street", "Physical Address City",
      "Physical Address Region", "Physical Address Postal Code", "Physical Address Country",
      "Postal Address Street", "Postal Address City", "Postal Address Region",
      "Postal Address Postal Code", "Postal Address Country", "Document Theme", "Amounts", "Archived"
    ];
    
    const rows = suppliers.map(s => [
      s.name || "",
      s.contactName || "",
      s.phone || "",
      "",
      "",
      s.email || "",
      s.address || "",
      s.suburb || "",
      s.state || "",
      s.postcode || "",
      "Australia",
      s.address || "",
      s.suburb || "",
      s.state || "",
      s.postcode || "",
      "Australia",
      "",
      "",
      s.isActive === 'false' ? "Yes" : "No"
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `suppliers_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${suppliers.length} suppliers` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Supplier Name", "Contact Name", "Phone Number", "Mobile Number", "Fax Number",
      "Email Address", "Physical Address Street", "Physical Address City",
      "Physical Address Region", "Physical Address Postal Code", "Physical Address Country",
      "Postal Address Street", "Postal Address City", "Postal Address Region",
      "Postal Address Postal Code", "Postal Address Country", "Document Theme", "Amounts", "Archived"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "supplier_import_template.csv";
    link.click();
    URL.revokeObjectURL(url);
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
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes("supplier name"));
      const contactIdx = headers.findIndex(h => h.toLowerCase() === "contact name");
      const phoneIdx = headers.findIndex(h => h.toLowerCase() === "phone number");
      const emailIdx = headers.findIndex(h => h.toLowerCase() === "email address");
      const streetIdx = headers.findIndex(h => h.toLowerCase().includes("physical address street"));
      const cityIdx = headers.findIndex(h => h.toLowerCase().includes("physical address city"));
      const regionIdx = headers.findIndex(h => h.toLowerCase().includes("physical address region"));
      const postcodeIdx = headers.findIndex(h => h.toLowerCase().includes("physical address postal code"));

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const name = values[nameIdx]?.trim();
        if (!name) continue;

        const newSupplier: InsertSupplier = {
          id: crypto.randomUUID(),
          organizationId: "",
          name,
          contactName: values[contactIdx]?.trim() || null,
          phone: values[phoneIdx]?.trim() || null,
          email: values[emailIdx]?.trim() || null,
          address: values[streetIdx]?.trim() || null,
          suburb: values[cityIdx]?.trim() || null,
          state: values[regionIdx]?.trim() || null,
          postcode: values[postcodeIdx]?.trim() || null,
          accountNumber: null,
          paymentTerms: null,
          notes: null,
          isActive: 'true',
        };
        
        await createSupplier(newSupplier);
        imported++;
      }

      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: `Imported ${imported} suppliers successfully` });
      setImportDialogOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import suppliers", variant: "destructive" });
    } finally {
      setImporting(false);
      event.target.value = "";
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

  const Wrapper = isMobile ? MobileLayout : Layout;
  const wrapperProps = isMobile ? { title: "Suppliers" } : {};

  return (
    <Wrapper {...wrapperProps}>
      <div className={`space-y-4 ${isMobile ? 'p-4' : ''}`}>
        {/* Header - hidden on mobile since MobileLayout shows title */}
        {!isMobile && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-primary" data-testid="text-suppliers-title">
                Suppliers
              </h1>
              <p className="text-muted-foreground">Manage your material suppliers</p>
            </div>
            <div className="flex gap-2">
              {canDelete && (
                <Button 
                  variant="outline" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteAllDialogOpen(true)}
                  disabled={suppliers.length === 0}
                  data-testid="button-delete-all-suppliers"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-import-export-suppliers">
                    <Download className="h-4 w-4 mr-2" />
                    Import/Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToCSV} data-testid="button-export-suppliers">
                    <Download className="h-4 w-4 mr-2" />
                    Export Suppliers
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import-suppliers">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Suppliers
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadTemplate}>
                    <FileText className="h-4 w-4 mr-2" />
                    Download Template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setLocation("/supplier/new")} data-testid="button-add-supplier">
                <Plus className="h-4 w-4 mr-2" />
                Add Supplier
              </Button>
            </div>
          </div>
        )}

        {/* Mobile action buttons */}
        {isMobile && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setLocation("/supplier/new")} className="h-11 flex-1" data-testid="button-add-supplier-mobile">
              <Plus className="h-4 w-4 mr-2" />
              Add Supplier
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11" data-testid="button-import-export-suppliers-mobile">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="h-11">
                  <Download className="h-4 w-4 mr-2" />
                  Export Suppliers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} className="h-11">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Suppliers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate} className="h-11">
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteAllDialogOpen(true)}
                  disabled={suppliers.length === 0}
                  className="h-11 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Desktop dialog content - moved outside to be shared */}
        {!isMobile && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><span /></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Supplier company name"
                    data-testid="input-supplier-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Person</Label>
                  <Input
                    id="contactName"
                    value={formData.contactName || ""}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Contact name"
                    data-testid="input-supplier-contact"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      data-testid="input-supplier-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="03 9000 0000"
                      data-testid="input-supplier-phone"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Industrial Drive"
                    data-testid="input-supplier-address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="suburb">Suburb</Label>
                    <Input
                      id="suburb"
                      value={formData.suburb || ""}
                      onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                      placeholder="Suburb"
                      data-testid="input-supplier-suburb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state || ""}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="VIC"
                      data-testid="input-supplier-state"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode || ""}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      placeholder="3000"
                      data-testid="input-supplier-postcode"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={formData.accountNumber || ""}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="ACC-12345"
                      data-testid="input-supplier-account"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms</Label>
                    <Input
                      id="paymentTerms"
                      value={formData.paymentTerms || ""}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      placeholder="Net 30"
                      data-testid="input-supplier-terms"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes || ""}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                    data-testid="input-supplier-notes"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-supplier"
                  >
                    {editingSupplier ? "Save Changes" : "Add Supplier"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Shared dialog for mobile */}
        {isMobile && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name-mobile">Company Name *</Label>
                  <Input
                    id="name-mobile"
                    className="h-11"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Supplier company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName-mobile">Contact Person</Label>
                  <Input
                    id="contactName-mobile"
                    className="h-11"
                    value={formData.contactName || ""}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="Contact name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-mobile">Email</Label>
                  <Input
                    id="email-mobile"
                    type="email"
                    className="h-11"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-mobile">Phone</Label>
                  <Input
                    id="phone-mobile"
                    className="h-11"
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="03 9000 0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address-mobile">Street Address</Label>
                  <Input
                    id="address-mobile"
                    className="h-11"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Industrial Drive"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="suburb-mobile">Suburb</Label>
                    <Input
                      id="suburb-mobile"
                      className="h-11"
                      value={formData.suburb || ""}
                      onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                      placeholder="Suburb"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state-mobile">State</Label>
                    <Input
                      id="state-mobile"
                      className="h-11"
                      value={formData.state || ""}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="VIC"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postcode-mobile">Postcode</Label>
                  <Input
                    id="postcode-mobile"
                    className="h-11"
                    value={formData.postcode || ""}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    placeholder="3000"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1 h-11" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-11"
                    onClick={handleSubmit} 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingSupplier ? "Save" : "Add"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Suppliers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with supplier data. Use the Tradify template format or download our template.
              </p>
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  disabled={importing}
                  data-testid="input-import-suppliers-file"
                />
              </div>
              {importing && (
                <p className="text-sm text-muted-foreground">Importing suppliers...</p>
              )}
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Suppliers</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {suppliers.length} suppliers? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteAllMutation.isPending}
                data-testid="button-confirm-delete-all-suppliers"
              >
                {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-suppliers"
          />
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-5 w-40" />
                    <div className="flex gap-1">
                      <Skeleton className="h-8 w-8" />
                      <Skeleton className="h-8 w-8" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No suppliers found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Add your first supplier to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <Card 
                key={supplier.id} 
                className="hover:shadow-md transition-shadow cursor-pointer" 
                data-testid={`card-supplier-${supplier.id}`}
                onClick={() => setLocation(`/supplier/${supplier.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-semibold">{supplier.name}</CardTitle>
                      {supplier.contactName && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="h-3 w-3" />
                          {supplier.contactName}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setLocation(`/supplier/${supplier.id}`); }}
                        data-testid={`button-edit-supplier-${supplier.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); confirmDelete(supplier); }}
                        data-testid={`button-delete-supplier-${supplier.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{supplier.email}</span>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{supplier.phone}</span>
                    </div>
                  )}
                  {(supplier.address || supplier.suburb) && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5" />
                      <span>
                        {[supplier.address, supplier.suburb, supplier.state, supplier.postcode]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                  {supplier.accountNumber && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Acct: {supplier.accountNumber}</span>
                    </div>
                  )}
                  {supplier.paymentTerms && (
                    <Badge variant="secondary" className="mt-2">
                      {supplier.paymentTerms}
                    </Badge>
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
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{supplierToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => supplierToDelete && deleteMutation.mutate(supplierToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Wrapper>
  );
}
