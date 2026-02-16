import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, User, Briefcase, FileText, Receipt, ChevronRight, Download, Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, fetchJobs, fetchQuotes, fetchInvoices } from "@/lib/api";
import type { Customer, InsertCustomer, Job, Quote, Invoice } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export default function Customers() {
  const { toast } = useToast();
  const { isAdmin, canDelete } = usePermissions();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<InsertCustomer>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", searchQuery],
    queryFn: () => fetchCustomers(searchQuery || undefined),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
    queryFn: fetchJobs,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["/api/quotes"],
    queryFn: fetchQuotes,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["/api/invoices"],
    queryFn: fetchInvoices,
  });

  const customerJobs = selectedCustomer 
    ? jobs.filter(j => j.customerId === selectedCustomer.id) 
    : [];
  const customerQuotes = selectedCustomer 
    ? quotes.filter(q => q.customerId === selectedCustomer.id) 
    : [];
  const customerInvoices = selectedCustomer 
    ? invoices.filter(i => i.customerId === selectedCustomer.id) 
    : [];

  const createMutation = useMutation({
    mutationFn: (data: InsertCustomer) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      setFormData({});
      toast({ title: "Customer added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create customer", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertCustomer> }) => updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      setEditingCustomer(null);
      setFormData({});
      toast({ title: "Customer updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update customer", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      toast({ title: "Customer deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete customer", variant: "destructive" });
    }
  });

  const handleSubmit = () => {
    if (!formData.name?.trim()) {
      toast({ title: "Customer name is required", variant: "destructive" });
      return;
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data: formData });
    } else {
      const newCustomer: InsertCustomer = {
        id: crypto.randomUUID(),
        organizationId: "",
        name: formData.name.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        address: formData.address?.trim() || null,
        suburb: formData.suburb?.trim() || null,
        postcode: formData.postcode?.trim() || null,
        state: formData.state?.trim() || null,
        notes: formData.notes?.trim() || null,
      };
      createMutation.mutate(newCustomer);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      suburb: customer.suburb,
      postcode: customer.postcode,
      state: customer.state,
      notes: customer.notes,
    });
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingCustomer(null);
    setFormData({});
    setDialogOpen(true);
  };

  const confirmDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setDeleteDialogOpen(true);
  };

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      for (const customer of customers) {
        await deleteCustomer(customer.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setDeleteAllDialogOpen(false);
      toast({ title: "All customers deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete all customers", variant: "destructive" });
    }
  });

  const exportToCSV = () => {
    const headers = [
      "Customer Name", "Contact Name", "Phone Number", "Mobile Number", "Fax Number",
      "Email Address", "Physical Address Street", "Physical Address City", 
      "Physical Address Region", "Physical Address Postal Code", "Physical Address Country",
      "Physical Address Longitude", "Physical Address Latitude", "Physical Address Place Id",
      "Postal Address Street", "Postal Address City", "Postal Address Region",
      "Postal Address Postal Code", "Postal Address Country", "Postal Address Longitude",
      "Postal Address Latitude", "Postal Address Place Id", "Custom 1", "Custom 2",
      "Custom 3", "Custom 4", "Custom 5", "Custom 6"
    ];
    
    const rows = customers.map(c => [
      c.name || "",
      "",
      c.phone || "",
      "",
      "",
      c.email || "",
      c.address || "",
      c.suburb || "",
      c.state || "",
      c.postcode || "",
      "Australia",
      "", "", "",
      c.address || "",
      c.suburb || "",
      c.state || "",
      c.postcode || "",
      "Australia",
      "", "", "",
      c.notes || "",
      "", "", "", "", ""
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${customers.length} customers` });
  };

  const downloadTemplate = () => {
    const headers = [
      "Customer Name", "Contact Name", "Phone Number", "Mobile Number", "Fax Number",
      "Email Address", "Physical Address Street", "Physical Address City", 
      "Physical Address Region", "Physical Address Postal Code", "Physical Address Country",
      "Physical Address Longitude", "Physical Address Latitude", "Physical Address Place Id",
      "Postal Address Street", "Postal Address City", "Postal Address Region",
      "Postal Address Postal Code", "Postal Address Country", "Postal Address Longitude",
      "Postal Address Latitude", "Postal Address Place Id", "Custom 1", "Custom 2",
      "Custom 3", "Custom 4", "Custom 5", "Custom 6"
    ];
    
    const csvContent = headers.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "customer_import_template.csv";
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
      const nameIdx = headers.findIndex(h => h.toLowerCase().includes("customer name"));
      const phoneIdx = headers.findIndex(h => h.toLowerCase() === "phone number");
      const emailIdx = headers.findIndex(h => h.toLowerCase() === "email address");
      const streetIdx = headers.findIndex(h => h.toLowerCase().includes("physical address street"));
      const cityIdx = headers.findIndex(h => h.toLowerCase().includes("physical address city"));
      const regionIdx = headers.findIndex(h => h.toLowerCase().includes("physical address region"));
      const postcodeIdx = headers.findIndex(h => h.toLowerCase().includes("physical address postal code"));
      const notesIdx = headers.findIndex(h => h.toLowerCase() === "custom 1");

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const name = values[nameIdx]?.trim();
        if (!name) continue;

        const newCustomer: InsertCustomer = {
          id: crypto.randomUUID(),
          organizationId: "",
          name,
          phone: values[phoneIdx]?.trim() || null,
          email: values[emailIdx]?.trim() || null,
          address: values[streetIdx]?.trim() || null,
          suburb: values[cityIdx]?.trim() || null,
          state: values[regionIdx]?.trim() || null,
          postcode: values[postcodeIdx]?.trim() || null,
          notes: values[notesIdx]?.trim() || null,
        };
        
        await createCustomer(newCustomer);
        imported++;
      }

      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: `Imported ${imported} customers successfully` });
      setImportDialogOpen(false);
    } catch (error) {
      console.error("Import error:", error);
      toast({ title: "Failed to import customers", variant: "destructive" });
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary" data-testid="text-customers-title">
              Customers
            </h1>
            <p className="text-muted-foreground text-sm">Manage your customer contacts</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canDelete && (
              <Button 
                variant="outline" 
                className="text-destructive hover:text-destructive h-11 sm:h-10"
                onClick={() => setDeleteAllDialogOpen(true)}
                disabled={customers.length === 0}
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
                  Export Customers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setImportDialogOpen(true)} data-testid="button-import">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Customers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={downloadTemplate}>
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setLocation("/customer/new")} className="h-11 sm:h-10 flex-1 sm:flex-none" data-testid="button-add-customer">
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Customers</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with customer data. Use the Tradify template format or download our template.
              </p>
              <div className="space-y-2">
                <Label htmlFor="csv-file">Select CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleImport}
                  disabled={importing}
                  data-testid="input-import-file"
                />
              </div>
              {importing && (
                <p className="text-sm text-muted-foreground">Importing customers...</p>
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

        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 sm:h-10"
            data-testid="input-search-customers"
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
                  <div className="flex items-start gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded-full mt-0.5" />
                    <Skeleton className="h-4 w-56" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No customers found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Add your first customer to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
            {customers.map((customer) => {
              const jobCount = jobs.filter(j => j.customerId === customer.id).length;
              const quoteCount = quotes.filter(q => q.customerId === customer.id).length;
              const invoiceCount = invoices.filter(i => i.customerId === customer.id).length;
              return (
                <Card 
                  key={customer.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  data-testid={`card-customer-${customer.id}`}
                  onClick={() => setLocation(`/customer/${customer.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold">{customer.name}</CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setLocation(`/customer/${customer.id}`); }}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); confirmDelete(customer); }}
                          data-testid={`button-delete-customer-${customer.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {(customer.address || customer.suburb) && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">
                          {[customer.address, customer.suburb, customer.state, customer.postcode]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {(jobCount > 0 || quoteCount > 0 || invoiceCount > 0) && (
                      <div className="flex gap-2 pt-2 border-t mt-2">
                        {jobCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {jobCount} job{jobCount !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {quoteCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="h-3 w-3 mr-1" />
                            {quoteCount}
                          </Badge>
                        )}
                        {invoiceCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Receipt className="h-3 w-3 mr-1" />
                            {invoiceCount}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Customer</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {customerToDelete?.name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => customerToDelete && deleteMutation.mutate(customerToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-customer"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete All Customers</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all {customers.length} customers? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteAllMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteAllMutation.isPending}
                data-testid="button-confirm-delete-all"
              >
                {deleteAllMutation.isPending ? "Deleting..." : "Delete All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-xl">{selectedCustomer?.name}</SheetTitle>
            </SheetHeader>
            {selectedCustomer && (
              <div className="space-y-6 mt-6">
                <div className="space-y-2 text-sm">
                  {selectedCustomer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">
                        {selectedCustomer.email}
                      </a>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${selectedCustomer.phone}`} className="text-primary hover:underline">
                        {selectedCustomer.phone}
                      </a>
                    </div>
                  )}
                  {(selectedCustomer.address || selectedCustomer.suburb) && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>
                        {[selectedCustomer.address, selectedCustomer.suburb, selectedCustomer.state, selectedCustomer.postcode]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Jobs ({customerJobs.length})
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setLocation(`/jobs?customerId=${selectedCustomer.id}`);
                      }}
                      data-testid="button-new-job-for-customer"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Job
                    </Button>
                  </div>
                  {customerJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No jobs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customerJobs.slice(0, 5).map((job) => (
                        <div
                          key={job.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setLocation(`/jobs/${job.id}`);
                          }}
                          data-testid={`link-job-${job.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{job.title}</p>
                            <p className="text-xs text-muted-foreground">{job.address}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{job.status}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                      {customerJobs.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                          +{customerJobs.length - 5} more jobs
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Quotes ({customerQuotes.length})
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setLocation(`/quote/new?customerId=${selectedCustomer.id}`);
                      }}
                      data-testid="button-new-quote-for-customer"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Quote
                    </Button>
                  </div>
                  {customerQuotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No quotes yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customerQuotes.slice(0, 5).map((quote) => (
                        <div
                          key={quote.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setLocation(`/quote/${quote.id}`);
                          }}
                          data-testid={`link-quote-${quote.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{quote.quoteNumber}</p>
                            <p className="text-xs text-muted-foreground">{quote.address}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">${quote.total?.toFixed(2)}</span>
                            <Badge variant="outline" className="text-xs">{quote.status}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Invoices ({customerInvoices.length})
                    </h3>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setLocation(`/invoice/new?customerId=${selectedCustomer.id}`);
                      }}
                      data-testid="button-new-invoice-for-customer"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Invoice
                    </Button>
                  </div>
                  {customerInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoices yet</p>
                  ) : (
                    <div className="space-y-2">
                      {customerInvoices.slice(0, 5).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setLocation(`/invoice/${invoice.id}`);
                          }}
                          data-testid={`link-invoice-${invoice.id}`}
                        >
                          <div>
                            <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">{invoice.address}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">${invoice.total?.toFixed(2)}</span>
                            <Badge variant="outline" className="text-xs">{invoice.status}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </Layout>
  );
}
