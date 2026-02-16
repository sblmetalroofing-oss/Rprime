import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Save, ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchSupplier, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api";
import type { InsertSupplier } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export default function SupplierEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/supplier/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [formData, setFormData] = useState<InsertSupplier>({
    id: `supp_${crypto.randomUUID()}`,
    name: "",
    contactName: null,
    email: null,
    phone: null,
    address: null,
    suburb: null,
    state: null,
    postcode: null,
    accountNumber: null,
    paymentTerms: null,
    notes: null,
    isActive: "true",
  });

  useEffect(() => {
    if (!isNew && params?.id) {
      loadSupplier(params.id);
    }
  }, [isNew, params?.id]);

  const loadSupplier = async (id: string) => {
    setLoading(true);
    try {
      const supplier = await fetchSupplier(id);
      if (supplier) {
        setFormData({
          id: supplier.id,
          name: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          suburb: supplier.suburb,
          state: supplier.state,
          postcode: supplier.postcode,
          accountNumber: supplier.accountNumber,
          paymentTerms: supplier.paymentTerms,
          notes: supplier.notes,
          isActive: supplier.isActive,
        });
      }
    } catch (err) {
      console.error("Failed to load supplier:", err);
      toast({ title: "Failed to load supplier", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast({ title: "Supplier name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const data: InsertSupplier = {
        id: formData.id || `supp_${crypto.randomUUID()}`,
        name: formData.name.trim(),
        contactName: formData.contactName?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        address: formData.address?.trim() || null,
        suburb: formData.suburb?.trim() || null,
        state: formData.state?.trim() || null,
        postcode: formData.postcode?.trim() || null,
        accountNumber: formData.accountNumber?.trim() || null,
        paymentTerms: formData.paymentTerms?.trim() || null,
        notes: formData.notes?.trim() || null,
        isActive: formData.isActive || "true",
      };

      if (isNew) {
        await createSupplier(data);
        toast({ title: "Supplier created successfully" });
      } else {
        await updateSupplier(params!.id, data);
        toast({ title: "Supplier updated successfully" });
      }
      setLocation("/suppliers");
    } catch (err) {
      console.error("Failed to save supplier:", err);
      toast({ title: "Failed to save supplier", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    try {
      await deleteSupplier(params!.id);
      toast({ title: "Supplier deleted" });
      setLocation("/suppliers");
    } catch (err) {
      toast({ title: "Failed to delete supplier", variant: "destructive" });
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
              <Link href="/suppliers" data-testid="breadcrumb-suppliers">Suppliers</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">
              {isNew ? "New Supplier" : formData.name || "Edit Supplier"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/suppliers")} className="h-11 w-11" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-heading font-bold text-primary">
              {isNew ? "New Supplier" : "Edit Supplier"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="outline" size="icon" onClick={() => setShowDeleteDialog(true)} className="h-11 w-11 text-destructive" data-testid="button-delete-supplier">
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="h-11 min-h-[44px]" data-testid="button-save-supplier">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Supplier Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Company Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Company name"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-supplier-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName" className="text-sm font-medium">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName || ""}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Contact person"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-supplier-contact"
              />
            </div>
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
                data-testid="input-supplier-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
              <Input
                id="phone"
                value={formData.phone || ""}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="07 3000 0000"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-supplier-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">Address</Label>
            <AddressAutocomplete
              value={formData.address || ""}
              onChange={(value) => {
                // Only clear components when address is completely cleared
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
              data-testid="input-supplier-address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-sm font-medium">Account Number</Label>
              <Input
                id="accountNumber"
                value={formData.accountNumber || ""}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                placeholder="Your account number with supplier"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-supplier-account"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentTerms" className="text-sm font-medium">Payment Terms</Label>
              <Input
                id="paymentTerms"
                value={formData.paymentTerms || ""}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                placeholder="e.g. 30 days"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-supplier-terms"
              />
            </div>
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
              data-testid="input-supplier-notes"
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier? This action cannot be undone.
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
