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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  Plus, 
  Trash2,
  Send,
  Eye,
  DollarSign,
  Loader2,
  Phone,
  MessageSquare,
  CreditCard,
  Wallet,
  Landmark,
  FileText,
  RefreshCw,
  ArrowLeft,
  Cloud,
  ExternalLink,
  CheckCircle2,
  CheckCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { 
  fetchInvoice, 
  createInvoice, 
  updateInvoice, 
  getNextInvoiceNumber,
  fetchCustomers,
  fetchJobs,
  fetchQuotes,
  fetchJobWithDocuments,
  fetchItems,
  fetchInvoicePayments,
  createInvoicePayment,
  deleteInvoicePayment,
  fetchDocumentSettings,
  fetchDocumentThemes,
  fetchDocumentThemeSettings,
  type InvoiceWithItems,
  type InvoicePayment,
  type DocumentTheme,
  type DocumentSettings,
  type DocumentThemeSettings
} from "@/lib/api";
import type { InsertInvoice, Customer, Job, Quote, Item } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package } from "lucide-react";
import { getTodayInput, getFutureDateInput, formatDateShort } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { PdfPreviewModal, prepareInvoiceData, generatePdfBase64 } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { DocumentAttachments } from "@/components/document-attachments";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { MobileLineItemCard } from "@/components/mobile-line-item-card";
import { usePermissions } from "@/hooks/use-permissions";

type InvoiceItemInput = {
  id: string;
  description: string;
  qty: number | string;
  unitCost: number | string;
  total: number;
  itemCode: string | null;
  costPrice: number | null;
  productId: string | null;
  sortOrder: number | null;
  section: string | null;
};

export default function InvoiceEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/invoice/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();
  const { canViewFinancials, isAdmin } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [nextNumber, setNextNumber] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(getTodayInput());
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [invoiceSettings, setInvoiceSettings] = useState<DocumentSettings | null>(null);
  const [xeroStatus, setXeroStatus] = useState<{ connected: boolean; tenantName?: string } | null>(null);
  const [syncingToXero, setSyncingToXero] = useState(false);
  const [xeroSyncInfo, setXeroSyncInfo] = useState<{ synced: boolean; xeroId: string | null; lastSyncAt: string | null; status: string } | null>(null);
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoading, setThemeSettingsLoading] = useState(false);

  const [formData, setFormData] = useState<InsertInvoice>({
    id: `invoice_${Date.now()}`,
    organizationId: "",
    invoiceNumber: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    address: "",
    suburb: "",
    status: "draft",
    issueDate: getTodayInput(),
    dueDate: getFutureDateInput(14),
    subtotal: 0,
    gst: 0,
    total: 0,
    amountPaid: 0,
    notes: "",
    terms: "Payment due within 14 days.",
    customerId: null,
    quoteId: null,
    jobId: null,
    discount: 0,
    emailReminders: 'false',
    creditCardEnabled: 'false',
    surchargePassthrough: 'false',
    invoiceType: null,
    depositPercent: null,
    reference: "",
    themeId: null,
  });
  
  const [linkedQuoteTotal, setLinkedQuoteTotal] = useState<number>(0);
  const [linkedQuoteSubtotal, setLinkedQuoteSubtotal] = useState<number>(0);
  const [previousInvoicesTotal, setPreviousInvoicesTotal] = useState<number>(0);
  const [jobQuotes, setJobQuotes] = useState<Quote[]>([]);
  const [jobInvoices, setJobInvoices] = useState<{ id: string; quoteId: string | null; status: string; total: number }[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const [items, setItems] = useState<InvoiceItemInput[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [isNew, params?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [customersData, jobsData, quotesData, productsData, number, themesData] = await Promise.all([
        fetchCustomers(),
        fetchJobs(),
        fetchQuotes(),
        fetchItems(),
        getNextInvoiceNumber(),
        fetchDocumentThemes()
      ]);
      setCustomers(customersData);
      setJobs(jobsData);
      setQuotes(quotesData);
      setProducts(productsData.filter(p => p.isActive === 'true'));
      setNextNumber(number);
      setThemes(themesData.filter(t => t.isArchived !== 'true'));
      
      const defaultTheme = themesData.find(t => t.isDefault === 'true' && t.isArchived !== 'true');
      
      // Fetch invoice settings for bank details
      const settings = await fetchDocumentSettings('invoice');
      setInvoiceSettings(settings);

      if (!isNew && params?.id) {
        const invoice = await fetchInvoice(params.id);
        if (invoice) {
          setFormData({
            id: invoice.id,
            organizationId: invoice.organizationId || "",
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail || "",
            customerPhone: invoice.customerPhone || "",
            address: invoice.address,
            suburb: invoice.suburb || "",
            status: invoice.status,
            issueDate: invoice.issueDate || "",
            dueDate: invoice.dueDate || "",
            subtotal: invoice.subtotal || 0,
            gst: invoice.gst || 0,
            total: invoice.total || 0,
            amountPaid: invoice.amountPaid || 0,
            notes: invoice.notes || "",
            terms: invoice.terms || "",
            customerId: invoice.customerId || null,
            quoteId: invoice.quoteId || null,
            jobId: invoice.jobId || null,
            discount: invoice.discount || 0,
            emailReminders: invoice.emailReminders || 'false',
            creditCardEnabled: invoice.creditCardEnabled || 'false',
            surchargePassthrough: invoice.surchargePassthrough || 'false',
            invoiceType: invoice.invoiceType === 'standard' ? null : (invoice.invoiceType || null),
            depositPercent: invoice.depositPercent || null,
            reference: invoice.reference || "",
            themeId: invoice.themeId || defaultTheme?.id || null,
          });
          
          // If there's a linked job, fetch quote totals for context
          if (invoice.jobId) {
            const jobData = await fetchJobWithDocuments(invoice.jobId);
            if (jobData?.quotes && jobData.quotes.length > 0) {
              setJobQuotes(jobData.quotes);
              // Only set quote data if invoice is actually linked to a quote
              if (invoice.quoteId) {
                const savedQuote = jobData.quotes.find(q => q.id === invoice.quoteId);
                if (savedQuote) {
                  setSelectedQuoteId(savedQuote.id);
                  setLinkedQuoteTotal(savedQuote.total || 0);
                  setLinkedQuoteSubtotal(savedQuote.subtotal || 0);
                }
              } else {
                // Standalone invoice - no quote linked
                setSelectedQuoteId(null);
                setLinkedQuoteTotal(0);
                setLinkedQuoteSubtotal(0);
              }
            }
            if (jobData?.invoices) {
              setJobInvoices(jobData.invoices);
              // For multi-quote jobs, only count invoices linked to the same quote
              const relevantQuoteId = invoice.quoteId;
              const otherInvoicesPaid = Math.round(jobData.invoices
                .filter(inv => inv.id !== invoice.id && 
                  (inv.status === 'paid' || inv.status === 'sent') &&
                  (relevantQuoteId ? inv.quoteId === relevantQuoteId : true))
                .reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100;
              setPreviousInvoicesTotal(otherInvoicesPaid);
            }
          }
          setItems(invoice.items?.map(i => ({
            id: i.id,
            description: i.description,
            qty: i.qty,
            unitCost: i.unitCost,
            total: i.total,
            itemCode: i.itemCode || null,
            costPrice: i.costPrice || null,
            productId: i.productId || null,
            sortOrder: i.sortOrder || null,
            section: i.section || null,
          })) || []);
          
          // Fetch payments for existing invoice
          const invoicePayments = await fetchInvoicePayments(invoice.id);
          setPayments(invoicePayments);
        }
      } else {
        setFormData(prev => ({ ...prev, invoiceNumber: number, themeId: defaultTheme?.id || null }));
        
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        const invoiceType = urlParams.get('type');
        if (jobId) {
          await loadJobDetails(jobId, customersData, invoiceType);
        } else {
          // Redirect to jobs page if no jobId provided - invoices must be created from a job
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
        const invoiceSettings = settingsArray.find(s => s.documentType === 'invoice');
        setThemeSettings(invoiceSettings || null);
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

  const loadJobDetails = async (jobId: string, customersList: Customer[], invoiceType?: string | null) => {
    try {
      const jobData = await fetchJobWithDocuments(jobId);
      if (jobData?.job) {
        const job = jobData.job;
        setFormData(prev => ({
          ...prev,
          jobId: job.id,
          reference: job.builderReference || prev.reference || "",
        }));
        
        if (job.customerId) {
          const customer = customersList.find(c => c.id === job.customerId);
          if (customer) {
            setFormData(prev => ({
              ...prev,
              customerId: customer.id,
              customerName: customer.name,
              customerEmail: customer.email || "",
              customerPhone: customer.phone || "",
              address: customer.address || "",
              suburb: customer.suburb || "",
            }));
          }
        }
        
        // Track quote totals for context
        if (jobData.quotes && jobData.quotes.length > 0) {
          // Store all job quotes for selection - user will pick which to link (or standalone)
          setJobQuotes(jobData.quotes);
          if (jobData.invoices) {
            setJobInvoices(jobData.invoices);
          }
          
          // Don't auto-select a quote - let user choose (default to standalone)
          setSelectedQuoteId(null);
          setFormData(prev => ({ ...prev, quoteId: null }));
          setLinkedQuoteTotal(0);
          setLinkedQuoteSubtotal(0);
          setPreviousInvoicesTotal(0);
          
          // Pre-fill line items based on invoice type (only if type was passed in URL - legacy support)
          if (invoiceType) {
            // Auto-select accepted quote for legacy type URLs
            const acceptedQuote = jobData.quotes.find(q => q.status === 'accepted');
            const defaultQuote = acceptedQuote || jobData.quotes[0];
            setSelectedQuoteId(defaultQuote.id);
            setFormData(prev => ({ ...prev, quoteId: defaultQuote.id }));
            
            const quoteTotal = defaultQuote?.total || 0;
            const quoteSubtotal = defaultQuote?.subtotal || 0;
            setLinkedQuoteTotal(quoteTotal);
            setLinkedQuoteSubtotal(quoteSubtotal);
            
            // Track previous invoices for this quote
            const previousPaid = Math.round((jobData.invoices
              ?.filter(inv => (inv.status === 'sent' || inv.status === 'paid') &&
                (jobData.quotes.length > 1 ? inv.quoteId === defaultQuote.id : true))
              .reduce((sum, inv) => sum + (inv.total || 0), 0) || 0) * 100) / 100;
            setPreviousInvoicesTotal(previousPaid);
            const defaultDepositPercent = 50;
            
            if (invoiceType === 'deposit') {
              // Use quote subtotal (before GST) to calculate deposit, then add GST
              const depositSubtotal = Math.round(quoteSubtotal * (defaultDepositPercent / 100) * 100) / 100;
              const depositGst = Math.round(depositSubtotal * 0.1 * 100) / 100;
              setItems([{
                id: `item_${Date.now()}`,
                description: `Deposit (${defaultDepositPercent}% of quoted amount)`,
                qty: 1,
                unitCost: depositSubtotal,
                total: depositSubtotal,
                itemCode: null,
                costPrice: null,
                productId: null,
                sortOrder: 0,
                section: null,
              }]);
              setFormData(prev => ({
                ...prev,
                subtotal: depositSubtotal,
                gst: depositGst,
                total: depositSubtotal + depositGst,
                notes: `Deposit for Job ${job.referenceNumber || job.id.slice(-8).toUpperCase()}`,
                invoiceType: 'deposit',
                depositPercent: defaultDepositPercent,
              }));
            } else if (invoiceType === 'progress') {
              setItems([{
                id: `item_${Date.now()}`,
                description: 'Progress payment - works completed to date',
                qty: 1,
                unitCost: 0,
                total: 0,
                itemCode: null,
                costPrice: null,
                productId: null,
                sortOrder: 0,
                section: null,
              }]);
              setFormData(prev => ({
                ...prev,
                notes: `Progress invoice for Job ${job.referenceNumber || job.id.slice(-8).toUpperCase()}`,
                invoiceType: 'progress',
              }));
            } else if (invoiceType === 'final') {
              // Calculate remaining balance - remaining is GST-inclusive (quoteTotal and previousPaid both include GST)
              const remainingTotal = Math.max(0, quoteTotal - previousPaid);
              // Back-calculate subtotal from GST-inclusive total (total / 1.1)
              const remainingSubtotal = Math.round((remainingTotal / 1.1) * 100) / 100;
              const remainingGst = Math.round(remainingSubtotal * 0.1 * 100) / 100;
              setItems([{
                id: `item_${Date.now()}`,
                description: 'Final payment - remaining balance',
                qty: 1,
                unitCost: remainingSubtotal,
                total: remainingSubtotal,
                itemCode: null,
                costPrice: null,
                productId: null,
                sortOrder: 0,
                section: null,
              }]);
              setFormData(prev => ({
                ...prev,
                subtotal: remainingSubtotal,
                gst: remainingGst,
                total: remainingSubtotal + remainingGst,
                notes: `Final invoice for Job ${job.referenceNumber || job.id.slice(-8).toUpperCase()}`,
                invoiceType: 'final',
              }));
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load job details:', err);
    }
  };

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
        address: customer.address || prev.address || "",
        suburb: customer.suburb || prev.suburb || "",
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
      sortOrder: prev.length,
      section: null,
    }]);
  };

  const addProductToItems = (product: Item) => {
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: product.description,
      qty: 1,
      unitCost: product.sellPrice || 0,
      total: product.sellPrice || 0,
      itemCode: product.itemCode || null,
      costPrice: product.costPrice || null,
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

  const updateItem = (index: number, field: keyof InvoiceItemInput, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      if (field === 'qty' || field === 'unitCost') {
        const qty = parseFloat(String(updated[index].qty)) || 0;
        const unitCost = parseFloat(String(updated[index].unitCost)) || 0;
        // Round to 2 decimal places to avoid floating point precision issues
        updated[index].total = Math.round(qty * unitCost * 100) / 100;
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  // Use the higher of formData.amountPaid (from Xero sync) or payments sum for balance calculation
  const effectiveAmountPaid = Math.max(formData.amountPaid || 0, totalPaid);
  const balanceDue = (formData.total || 0) - effectiveAmountPaid;

  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount);
    
    if (!paymentAmount || isNaN(amount) || amount <= 0) {
      toast({ title: "Please enter a valid positive amount", variant: "destructive" });
      return;
    }
    
    // Round to 2 decimal places to avoid floating-point precision issues
    const roundedAmount = Math.round(amount * 100) / 100;
    const roundedBalance = Math.round(balanceDue * 100) / 100;
    
    if (roundedAmount > roundedBalance) {
      toast({ title: `Amount cannot exceed balance due ($${roundedBalance.toFixed(2)})`, variant: "destructive" });
      return;
    }
    
    if (isNew) {
      toast({ title: "Please save invoice first", variant: "destructive" });
      return;
    }

    setSavingPayment(true);
    try {
      const payment = await createInvoicePayment(formData.id, {
        amount,
        paymentMethod,
        paymentDate,
        reference: paymentReference || undefined,
        notes: paymentNotes || undefined,
        createdBy: undefined
      });

      if (payment) {
        // Re-fetch payments from server for accurate totals
        const updatedPayments = await fetchInvoicePayments(formData.id);
        setPayments(updatedPayments);
        
        // Re-fetch invoice to get accurate amountPaid and status
        const invoice = await fetchInvoice(formData.id);
        if (invoice) {
          setFormData(prev => ({ ...prev, amountPaid: invoice.amountPaid || 0, status: invoice.status || prev.status }));
        }
        
        setShowAddPayment(false);
        setPaymentAmount("");
        setPaymentReference("");
        setPaymentNotes("");
        setPaymentMethod("bank_transfer");
        toast({ title: "Payment added successfully" });
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({ title: "Failed to add payment", variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (confirm("Delete this payment?")) {
      const success = await deleteInvoicePayment(paymentId);
      if (success) {
        // Re-fetch payments and invoice for accurate totals
        const updatedPayments = await fetchInvoicePayments(formData.id);
        setPayments(updatedPayments);
        
        const invoice = await fetchInvoice(formData.id);
        if (invoice) {
          setFormData(prev => ({ ...prev, amountPaid: invoice.amountPaid || 0, status: invoice.status || prev.status }));
        }
        toast({ title: "Payment deleted" });
      }
    }
  };

  useEffect(() => {
    // Round all currency values to 2 decimal places to avoid floating point issues
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
    const discountAmount = Math.min(formData.discount || 0, subtotal);
    const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;
    const gst = Math.round(afterDiscount * 0.1 * 100) / 100;
    const total = Math.round((afterDiscount + gst) * 100) / 100;
    setFormData(prev => ({ 
      ...prev, 
      subtotal, 
      gst, 
      total,
    }));
  }, [items, formData.discount]);

  // Fetch Xero connection status and sync info
  useEffect(() => {
    const fetchXeroStatus = async () => {
      try {
        const res = await fetch("/api/xero/status");
        if (res.ok) {
          const data = await res.json();
          setXeroStatus(data);
        }
      } catch (error) {
        console.error("Failed to fetch Xero status:", error);
      }
    };
    fetchXeroStatus();
  }, []);

  // Fetch Xero sync info for this invoice
  useEffect(() => {
    const fetchXeroSyncInfo = async () => {
      if (!formData.id || isNew || !xeroStatus?.connected) return;
      try {
        const res = await fetch(`/api/xero/invoice-sync-status/${formData.id}`);
        if (res.ok) {
          const data = await res.json();
          setXeroSyncInfo(data);
        }
      } catch (error) {
        console.error("Failed to fetch Xero sync info:", error);
      }
    };
    fetchXeroSyncInfo();
  }, [formData.id, isNew, xeroStatus?.connected]);

  const handleSyncToXero = async () => {
    if (!formData.id || isNew) return;
    
    setSyncingToXero(true);
    try {
      // If already synced, first pull status from Xero to check for payments
      if (xeroSyncInfo?.synced) {
        const pullRes = await fetch(`/api/xero/pull/invoice/${formData.id}`, {
          method: "POST",
        });
        const pullData = await pullRes.json();
        
        if (pullRes.ok && pullData.updated) {
          // Invoice was updated from Xero (new payment recorded)
          toast({
            title: "Updated from Xero",
            description: pullData.xeroStatus === 'PAID' 
              ? `Invoice marked as paid` 
              : `Payment of $${pullData.xeroAmountPaid?.toLocaleString()} synced`,
          });
          // Refresh the invoice data
          const refreshedInvoice = await fetch(`/api/invoices/${formData.id}`).then(r => r.json());
          if (refreshedInvoice) {
            setFormData(prev => ({
              ...prev,
              status: refreshedInvoice.status,
              amountPaid: refreshedInvoice.amountPaid,
            }));
          }
          // Continue to push any local changes
        }
      }
      
      // Push to Xero
      const res = await fetch(`/api/xero/sync/invoice/${formData.id}`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        toast({
          title: "Synced to Xero",
          description: `Invoice successfully synced to Xero.`,
        });
        setXeroSyncInfo({
          synced: true,
          xeroId: data.xeroInvoiceId || null,
          lastSyncAt: new Date().toISOString(),
          status: 'success'
        });
      } else {
        toast({
          title: res.status === 401 ? "Xero Connection Expired" : "Sync Failed",
          description: data.error || "Failed to sync invoice to Xero",
          variant: "destructive",
        });
        if (res.status === 401) {
          setXeroStatus({ connected: false, tenantName: undefined });
        }
      }
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync invoice to Xero",
        variant: "destructive",
      });
    } finally {
      setSyncingToXero(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await updateInvoice(formData.id, { status: 'approved' });
      setFormData(prev => ({ ...prev, status: 'approved' }));
      toast({ title: "Invoice approved", description: "Invoice is now ready to send" });
    } catch (err) {
      toast({ title: "Failed to approve invoice", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!formData.customerName || !formData.address) {
      toast({ title: "Please fill in customer name and address", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      const clampedDiscount = Math.max(0, Math.min(formData.discount || 0, formData.subtotal || 0));
      const sanitizedItems = items.map(item => ({
        ...item,
        qty: typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0,
        unitCost: Math.round((typeof item.unitCost === 'number' ? item.unitCost : parseFloat(String(item.unitCost)) || 0) * 100) / 100,
        total: Math.round((typeof item.total === 'number' ? item.total : parseFloat(String(item.total)) || 0) * 100) / 100,
      }));
      const data = { 
        ...formData, 
        discount: Math.round(clampedDiscount * 100) / 100,
        subtotal: Math.round((formData.subtotal || 0) * 100) / 100,
        gst: Math.round((formData.gst || 0) * 100) / 100,
        total: Math.round((formData.total || 0) * 100) / 100,
        amountPaid: Math.round((formData.amountPaid || 0) * 100) / 100,
        items: sanitizedItems,
      };
      if (isNew) {
        const newInvoice = await createInvoice(data);
        toast({ title: "Invoice created successfully" });
        // Navigate to the newly created invoice
        setLocation(`/invoice/${newInvoice.id}`);
      } else {
        await updateInvoice(params!.id!, data);
        toast({ title: "Invoice saved" });
        // Stay on page - don't navigate away
      }
    } catch (err: any) {
      console.error('Failed to save invoice:', err);
      toast({ title: "Failed to save invoice", description: err?.message || "Unknown error", variant: "destructive" });
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

  // Find the linked job for breadcrumb
  const linkedJob = jobs.find(j => j.id === formData.jobId);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        {/* Breadcrumb Navigation */}
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
                    <Link href="/invoices" data-testid="breadcrumb-invoices">Invoices</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">
                {isNew ? "New Invoice" : `Invoice ${formData.invoiceNumber}`}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Sticky Summary Header - Tradify Style */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                onClick={() => formData.jobId ? setLocation(`/jobs/${formData.jobId}`) : setLocation('/invoices')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold truncate">
                    {isNew ? "New Invoice" : formData.invoiceNumber}
                  </h1>
                  <Badge 
                    variant={formData.status === 'paid' ? 'default' : formData.status === 'approved' ? 'default' : formData.status === 'sent' ? 'secondary' : formData.status === 'overdue' ? 'destructive' : 'outline'}
                    className={`shrink-0 ${formData.status === 'approved' ? 'bg-green-600 text-white' : ''}`}
                    data-testid="badge-status"
                  >
                    {formData.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {formData.customerName || "No customer"}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">${(formData.total || 0).toFixed(2)}</p>
              {balanceDue > 0 && (
                <p className="text-sm text-red-600">Due: ${balanceDue.toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons - Tradify Style */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Button 
            onClick={handleSave} 
            disabled={saving} 
            className="h-11 shrink-0 active:scale-95 transition-transform"
            data-testid="button-save"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          {formData.status === 'draft' && !isNew && (isAdmin || canViewFinancials) && (
            <Button 
              onClick={handleApprove} 
              disabled={saving} 
              className="h-11 shrink-0 bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform"
              data-testid="button-approve"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {!isNew && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setShowEmailDialog(true)} 
                disabled={themeSettingsLoading || formData.status === 'draft'}
                className="h-11 shrink-0 active:scale-95 transition-transform"
                data-testid="button-email"
                title={formData.status === 'draft' ? "Approve invoice before sending" : undefined}
              >
                <Send className="h-4 w-4 mr-2" />
                Email
              </Button>
              {formData.customerPhone && (
                <>
                  <Button 
                    variant="outline" 
                    className="h-11 shrink-0 active:scale-95 transition-transform"
                    onClick={() => window.open(`tel:${formData.customerPhone}`, '_self')}
                    data-testid="button-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-11 shrink-0 active:scale-95 transition-transform"
                    onClick={() => window.open(`sms:${formData.customerPhone}`, '_self')}
                    data-testid="button-sms"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    SMS
                  </Button>
                </>
              )}
              <Button 
                variant="outline" 
                onClick={() => setLocation(`/preview/invoice/${formData.id}`)} 
                className="h-11 shrink-0 active:scale-95 transition-transform"
                data-testid="button-preview"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              {xeroStatus?.connected && (
                <div className="flex items-center gap-2">
                  {xeroSyncInfo?.synced ? (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-green-600 text-sm cursor-default">
                              <Cloud className="h-4 w-4" />
                              <CheckCircle2 className="h-3 w-3" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            Synced to Xero{xeroSyncInfo.lastSyncAt ? ` on ${formatDateShort(xeroSyncInfo.lastSyncAt)}` : ''}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {xeroSyncInfo?.xeroId && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => window.open(`https://go.xero.com/app/invoicing/view/${xeroSyncInfo.xeroId}`, '_blank')}
                          className="h-11 px-3"
                          data-testid="button-view-in-xero"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View in Xero
                        </Button>
                      )}
                    </>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={handleSyncToXero}
                            disabled={syncingToXero}
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                            data-testid="button-sync-xero"
                          >
                            {syncingToXero ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Push to Xero
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
          <div className="lg:col-span-3 space-y-4 lg:space-y-6">
            {/* Invoice Type Card - Only show when linked to a job with quotes */}
            {(linkedQuoteTotal > 0 || formData.jobId) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice Type
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quote Selector - show if job has any quotes to allow linking */}
                  {jobQuotes.length > 0 && (
                    <div>
                      <Label>Link to Quote</Label>
                      <Select
                        value={selectedQuoteId || 'none'}
                        onValueChange={(value) => {
                          const quoteId = value === 'none' ? null : value;
                          if (!quoteId) {
                            // Switching to standalone - reset all quote-related state
                            setSelectedQuoteId(null);
                            setFormData(prev => ({ 
                              ...prev, 
                              quoteId: null,
                              invoiceType: null,
                              depositPercent: null,
                            }));
                            setLinkedQuoteTotal(0);
                            setLinkedQuoteSubtotal(0);
                            setPreviousInvoicesTotal(0);
                            // Clear any quote-derived line items
                            setItems([]);
                            return;
                          }
                          const quote = jobQuotes.find(q => q.id === quoteId);
                          if (quote) {
                            setSelectedQuoteId(quoteId);
                            setFormData(prev => ({ ...prev, quoteId }));
                            setLinkedQuoteTotal(quote.total || 0);
                            setLinkedQuoteSubtotal(quote.subtotal || 0);
                            
                            // Recalculate previous invoices for this specific quote
                            const newPreviousInvoices = Math.round(jobInvoices
                              .filter(inv => inv.id !== formData.id && 
                                (inv.status === 'paid' || inv.status === 'sent') &&
                                inv.quoteId === quoteId)
                              .reduce((sum, inv) => sum + (inv.total || 0), 0) * 100) / 100;
                            setPreviousInvoicesTotal(newPreviousInvoices);
                            
                            // Recalculate if deposit/final type
                            if (formData.invoiceType === 'deposit') {
                              const percent = formData.depositPercent || 50;
                              // Use quote subtotal (before GST) to calculate deposit, then add GST
                              const depositSubtotal = Math.round((quote.subtotal || 0) * (percent / 100) * 100) / 100;
                              const depositGst = Math.round(depositSubtotal * 0.1 * 100) / 100;
                              setItems([{
                                id: `item_${Date.now()}`,
                                description: `Deposit (${percent}% of $${(quote.total || 0).toLocaleString()})`,
                                qty: 1,
                                unitCost: depositSubtotal,
                                total: depositSubtotal,
                                itemCode: null,
                                costPrice: null,
                                productId: null,
                                sortOrder: 0,
                                section: null,
                              }]);
                              setFormData(prev => ({
                                ...prev,
                                subtotal: depositSubtotal,
                                gst: depositGst,
                                total: depositSubtotal + depositGst,
                              }));
                            } else if (formData.invoiceType === 'final') {
                              // Remaining is GST-inclusive, back-calculate subtotal
                              const remainingTotal = Math.max(0, (quote.total || 0) - newPreviousInvoices);
                              const remainingSubtotal = Math.round((remainingTotal / 1.1) * 100) / 100;
                              const remainingGst = Math.round(remainingSubtotal * 0.1 * 100) / 100;
                              setItems([{
                                id: `item_${Date.now()}`,
                                description: 'Final payment - remaining balance',
                                qty: 1,
                                unitCost: remainingSubtotal,
                                total: remainingSubtotal,
                                itemCode: null,
                                costPrice: null,
                                productId: null,
                                sortOrder: 0,
                                section: null,
                              }]);
                              setFormData(prev => ({
                                ...prev,
                                subtotal: remainingSubtotal,
                                gst: remainingGst,
                                total: remainingSubtotal + remainingGst,
                              }));
                            }
                          }
                        }}
                        data-testid="select-quote"
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select a quote" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No quote (standalone invoice)</SelectItem>
                          {jobQuotes.map(q => (
                            <SelectItem key={q.id} value={q.id}>
                              {q.quoteNumber} - ${(q.total || 0).toLocaleString()} 
                              {q.status === 'accepted' && ' ✓'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Invoice Type controls - only show when quote is selected */}
                  {selectedQuoteId && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={formData.invoiceType || ''}
                        onValueChange={(value) => {
                          setFormData(prev => ({ ...prev, invoiceType: value }));
                          // Auto-calculate amounts based on type
                          if (value === 'deposit' && linkedQuoteSubtotal > 0) {
                            const percent = formData.depositPercent || 50;
                            // Use quote subtotal (before GST) to calculate deposit, then add GST
                            const depositSubtotal = Math.round(linkedQuoteSubtotal * (percent / 100) * 100) / 100;
                            const depositGst = Math.round(depositSubtotal * 0.1 * 100) / 100;
                            setItems([{
                              id: `item_${Date.now()}`,
                              description: `Deposit (${percent}% of $${linkedQuoteTotal.toLocaleString()})`,
                              qty: 1,
                              unitCost: depositSubtotal,
                              total: depositSubtotal,
                              itemCode: null,
                              costPrice: null,
                              productId: null,
                              sortOrder: 0,
                              section: null,
                            }]);
                            setFormData(prev => ({
                              ...prev,
                              invoiceType: value,
                              depositPercent: percent,
                              subtotal: depositSubtotal,
                              gst: depositGst,
                              total: depositSubtotal + depositGst,
                            }));
                          } else if (value === 'final' && linkedQuoteTotal > 0) {
                            // Remaining is GST-inclusive, back-calculate subtotal
                            const remainingTotal = Math.max(0, linkedQuoteTotal - previousInvoicesTotal);
                            const remainingSubtotal = Math.round((remainingTotal / 1.1) * 100) / 100;
                            const remainingGst = Math.round(remainingSubtotal * 0.1 * 100) / 100;
                            setItems([{
                              id: `item_${Date.now()}`,
                              description: 'Final payment - remaining balance',
                              qty: 1,
                              unitCost: remainingSubtotal,
                              total: remainingSubtotal,
                              itemCode: null,
                              costPrice: null,
                              productId: null,
                              sortOrder: 0,
                              section: null,
                            }]);
                            setFormData(prev => ({
                              ...prev,
                              invoiceType: value,
                              subtotal: remainingSubtotal,
                              gst: remainingGst,
                              total: remainingSubtotal + remainingGst,
                            }));
                          }
                        }}
                        data-testid="select-invoice-type"
                      >
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select invoice type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deposit">Deposit Invoice</SelectItem>
                          <SelectItem value="progress">Progress Invoice</SelectItem>
                          <SelectItem value="final">Final Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.invoiceType === 'deposit' && (
                      <div>
                        <Label>Deposit %</Label>
                        <Select
                          value={String(formData.depositPercent || 50)}
                          onValueChange={(value) => {
                            const percent = parseInt(value);
                            // Use quote subtotal (before GST) to calculate deposit, then add GST
                            const depositSubtotal = Math.round(linkedQuoteSubtotal * (percent / 100) * 100) / 100;
                            const depositGst = Math.round(depositSubtotal * 0.1 * 100) / 100;
                            setItems([{
                              id: `item_${Date.now()}`,
                              description: `Deposit (${percent}% of $${linkedQuoteTotal.toLocaleString()})`,
                              qty: 1,
                              unitCost: depositSubtotal,
                              total: depositSubtotal,
                              itemCode: null,
                              costPrice: null,
                              productId: null,
                              sortOrder: 0,
                              section: null,
                            }]);
                            setFormData(prev => ({
                              ...prev,
                              depositPercent: percent,
                              subtotal: depositSubtotal,
                              gst: depositGst,
                              total: depositSubtotal + depositGst,
                            }));
                          }}
                          data-testid="select-deposit-percent"
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10%</SelectItem>
                            <SelectItem value="20">20%</SelectItem>
                            <SelectItem value="25">25%</SelectItem>
                            <SelectItem value="30">30%</SelectItem>
                            <SelectItem value="40">40%</SelectItem>
                            <SelectItem value="50">50%</SelectItem>
                            <SelectItem value="60">60%</SelectItem>
                            <SelectItem value="70">70%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  )}
                  
                  {/* Invoice Chain Summary */}
                  {linkedQuoteTotal > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Quote Total:</span>
                        <span className="font-medium">${linkedQuoteTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {previousInvoicesTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Previously Invoiced:</span>
                          <span className="font-medium text-amber-600">-${previousInvoicesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {(formData.total || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">This Invoice:</span>
                          <span className="font-medium text-blue-600">-${(formData.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Remaining to Invoice:</span>
                        <span className={(previousInvoicesTotal + (formData.total || 0)) >= linkedQuoteTotal ? 'text-green-600' : ''}>
                          ${Math.max(0, Math.round((linkedQuoteTotal - previousInvoicesTotal - (formData.total || 0)) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Invoice Number</Label>
                    <Input value={formData.invoiceNumber} disabled data-testid="input-invoice-number" />
                  </div>
                  <div>
                    <Label>Document Theme</Label>
                    <Select 
                      value={formData.themeId || ""} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, themeId: value || null }))}
                    >
                      <SelectTrigger data-testid="select-invoice-theme">
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

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Issue Date</Label>
                    <Input
                      type="date"
                      value={formData.issueDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                      data-testid="input-invoice-issue"
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={formData.dueDate || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                      data-testid="input-invoice-due"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Job (Optional)</Label>
                    <SearchableSelect
                      value={formData.jobId ?? null}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, jobId: value }))}
                      options={jobs.map(j => ({ value: j.id, label: `${formatJobNumber(j)} - ${j.title}`, sublabel: j.address || undefined }))}
                      placeholder="No linked job"
                      searchPlaceholder="Search jobs..."
                      emptyText="No jobs found."
                      data-testid="select-invoice-job"
                    />
                  </div>
                </div>

                <div>
                  <Label>Customer</Label>
                  <SearchableSelect
                    value={formData.customerId ?? null}
                    onValueChange={(value) => value ? handleCustomerChange(value) : handleCustomerChange("none")}
                    options={customers.map(c => ({ value: c.id, label: c.name, sublabel: c.email || undefined }))}
                    placeholder="Select customer"
                    searchPlaceholder="Search customers..."
                    emptyText="No customers found."
                    data-testid="select-invoice-customer"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.customerPhone || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                      data-testid="input-invoice-phone"
                    />
                  </div>
                  <div>
                    <Label>Reference (Builder's Ref)</Label>
                    <Input
                      value={formData.reference || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="e.g. PO-12345"
                      data-testid="input-invoice-reference"
                    />
                  </div>
                </div>

                <div>
                  <Label>Address *</Label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                    placeholder="Start typing an address..."
                    data-testid="input-invoice-address"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Line Items</CardTitle>
                  <div className="flex gap-2">
                    <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-add-from-catalog">
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
                                    <p className="font-medium">${(product.sellPrice || 0).toFixed(2)}</p>
                                    {product.costPrice && product.costPrice > 0 && (
                                      <p className="text-xs text-green-600">
                                        +${((product.sellPrice || 0) - product.costPrice).toFixed(2)} profit
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                    <Button variant="outline" size="sm" onClick={addItem} data-testid="button-add-item">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Item
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No line items yet</p>
                    <Button variant="outline" className="mt-4" onClick={addItem}>
                      Add First Item
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block">
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
                                  className="w-20"
                                  data-testid={`input-item-qty-${index}`}
                                />
                              </TableCell>
                              <TableCell>
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
                                  className="w-28"
                                  data-testid={`input-item-cost-${index}`}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                ${item.total.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => removeItem(index)}
                                  data-testid={`button-remove-item-${index}`}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Notes</CardTitle>
                  <Link href="/settings" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-edit-tcs-invoice">
                    <FileText className="h-3 w-3" />
                    Edit T&Cs in Doc Theme
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={formData.notes || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes for this invoice..."
                    data-testid="input-invoice-notes"
                  />
                </div>
                
                {/* Bank Details Display */}
                {invoiceSettings && (invoiceSettings.bankName || invoiceSettings.bsb || invoiceSettings.accountNumber || invoiceSettings.accountName) && (
                  <>
                    <Separator />
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Bank Details</Label>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                        {invoiceSettings.bankName && (
                          <>
                            <span className="text-muted-foreground">Bank:</span>
                            <span data-testid="text-bank-name">{invoiceSettings.bankName}</span>
                          </>
                        )}
                        {invoiceSettings.accountName && (
                          <>
                            <span className="text-muted-foreground">Account Name:</span>
                            <span data-testid="text-account-name">{invoiceSettings.accountName}</span>
                          </>
                        )}
                        {invoiceSettings.bsb && (
                          <>
                            <span className="text-muted-foreground">BSB:</span>
                            <span data-testid="text-bsb">{invoiceSettings.bsb}</span>
                          </>
                        )}
                        {invoiceSettings.accountNumber && (
                          <>
                            <span className="text-muted-foreground">Account:</span>
                            <span data-testid="text-account-number">{invoiceSettings.accountNumber}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Configure in Settings → Invoice Settings
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 lg:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${(formData.subtotal || 0).toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <Label className="text-muted-foreground">Discount</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      value={formData.discount || 0}
                      onChange={(e) => {
                        const value = Math.max(0, parseFloat(e.target.value) || 0);
                        setFormData(prev => ({ ...prev, discount: value }));
                      }}
                      className="w-24 h-9 text-right"
                      placeholder="0.00"
                      data-testid="input-discount"
                    />
                  </div>
                </div>
                {(formData.discount || 0) > 0 && (formData.subtotal || 0) > 0 && (
                  <p className={`text-xs text-right ${(formData.discount || 0) > (formData.subtotal || 0) ? 'text-orange-500' : 'text-muted-foreground'}`}>
                    {(formData.discount || 0) > (formData.subtotal || 0) 
                      ? `Will be capped to $${(formData.subtotal || 0).toFixed(2)} on save`
                      : `${((formData.discount || 0) / (formData.subtotal || 1) * 100).toFixed(1)}% off`
                    }
                  </p>
                )}
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span className="font-medium">${(formData.gst || 0).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">${(formData.total || 0).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600 font-medium">${(formData.amountPaid || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Balance Due</span>
                  <span className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${balanceDue.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
            
            {/* Attachments */}
            {!isNew && formData.id && (
              <DocumentAttachments 
                documentType="invoice" 
                documentId={formData.id}
              />
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>Payment & Reminders</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Reminders</Label>
                    <p className="text-xs text-muted-foreground">Send payment reminders</p>
                  </div>
                  <Switch
                    checked={formData.emailReminders === 'true'}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, emailReminders: checked ? 'true' : 'false' }))
                    }
                    data-testid="switch-email-reminders"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Accept Credit Cards</Label>
                    <p className="text-xs text-muted-foreground">Allow online payments</p>
                  </div>
                  <Switch
                    checked={formData.creditCardEnabled === 'true'}
                    onCheckedChange={(checked) => 
                      setFormData(prev => ({ ...prev, creditCardEnabled: checked ? 'true' : 'false' }))
                    }
                    data-testid="switch-credit-card"
                  />
                </div>
                {formData.creditCardEnabled === 'true' && (
                  <div className="flex items-center justify-between pl-4">
                    <div>
                      <Label className="text-sm">Pass Surcharge to Customer</Label>
                      <p className="text-xs text-muted-foreground">Add card fee to invoice</p>
                    </div>
                    <Switch
                      checked={formData.surchargePassthrough === 'true'}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, surchargePassthrough: checked ? 'true' : 'false' }))
                      }
                      data-testid="switch-surcharge"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payments Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Payments</CardTitle>
                  {!isNew && (
                    <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-11" data-testid="button-add-payment">
                          <Wallet className="h-4 w-4 mr-1" />
                          Add Payment
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Record Payment</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div>
                              <Label>Amount</Label>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={paymentAmount}
                                  onChange={(e) => setPaymentAmount(e.target.value)}
                                  className="pl-8 h-11"
                                  data-testid="input-payment-amount"
                                />
                              </div>
                            </div>
                            <div>
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="h-11"
                                data-testid="input-payment-date"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Payment Method</Label>
                            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="h-11" data-testid="select-payment-method">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="credit_card">Credit Card</SelectItem>
                                <SelectItem value="eftpos">EFTPOS</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Reference (optional)</Label>
                            <Input
                              placeholder="Payment reference..."
                              value={paymentReference}
                              onChange={(e) => setPaymentReference(e.target.value)}
                              className="h-11"
                              data-testid="input-payment-reference"
                            />
                          </div>
                          <div>
                            <Label>Notes (optional)</Label>
                            <Textarea
                              placeholder="Payment notes..."
                              value={paymentNotes}
                              onChange={(e) => setPaymentNotes(e.target.value)}
                              rows={2}
                              data-testid="input-payment-notes"
                            />
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              className="flex-1 h-11"
                              onClick={() => setShowAddPayment(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              className="flex-1 h-11"
                              onClick={handleAddPayment}
                              disabled={savingPayment}
                              data-testid="button-save-payment"
                            >
                              {savingPayment ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save Payment"
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isNew ? (
                  <p className="text-sm text-muted-foreground">Save the invoice to record payments</p>
                ) : payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded</p>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                        <div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-green-600">
                              ${payment.amount.toFixed(2)}
                            </span>
                            <Badge variant="outline" className="text-xs capitalize">
                              {payment.paymentMethod.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateShort(payment.paymentDate)}
                            {payment.reference && ` • Ref: ${payment.reference}`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayment(payment.id)}
                          data-testid={`button-delete-payment-${payment.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between text-sm font-medium">
                      <span>Total Paid:</span>
                      <span className="text-green-600">${totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-medium">
                      <span>Balance Due:</span>
                      <span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>
                        ${balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger data-testid="select-invoice-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial Payment</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showPreview && (
        <PdfPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          document={prepareInvoiceData({ ...formData, items } as InvoiceWithItems, linkedJob)}
          theme={themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null}
          themeSettings={themeSettings}
        />
      )}

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="invoice"
          documentId={formData.id}
          documentNumber={formData.invoiceNumber}
          recipientEmail={formData.customerEmail || ""}
          recipientName={formData.customerName}
          onSuccess={() => {
            toast({ title: "Invoice Sent", description: "Invoice sent to customer" });
            setFormData(prev => ({ ...prev, status: 'sent' }));
          }}
          getPdfBase64={async () => {
            // Fetch fresh job data just like invoice-preview.tsx does to ensure
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
            const documentData = prepareInvoiceData({ ...formData, items } as InvoiceWithItems, freshJob);
            const selectedTheme = themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null;
            let currentThemeSettings = themeSettings;
            if (selectedTheme?.id) {
              try {
                const settingsArray = await fetchDocumentThemeSettings(selectedTheme.id);
                currentThemeSettings = settingsArray.find(s => s.documentType === 'invoice') || null;
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
