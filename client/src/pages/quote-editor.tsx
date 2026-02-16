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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Save, 
  Plus, 
  Trash2,
  Send,
  Eye,
  DollarSign,
  Loader2,
  Briefcase,
  Phone,
  MessageSquare,
  Bell,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { 
  fetchQuote, 
  createQuote, 
  updateQuote, 
  getNextQuoteNumber,
  fetchCustomers,
  fetchJobs,
  fetchJobWithDocuments,
  createJob,
  fetchLeads,
  updateLead,
  fetchItems,
  fetchDocumentThemes,
  fetchDocumentThemeSettings,
  type QuoteWithItems,
  type DocumentTheme,
  type DocumentThemeSettings
} from "@/lib/api";
import type { InsertQuote, Customer, Job, Lead, Item } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, FileText, Pencil, FolderPlus, ChevronDown, ChevronRight, Download, Upload } from "lucide-react";
import { getFutureDateInput } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { PdfPreviewModal, prepareQuoteData, generatePdfBase64 } from "@/components/pdf-preview";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { DocumentAttachments } from "@/components/document-attachments";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { RoofrPdfUpload, type GeneratedQuoteItem } from "@/components/roofr-pdf-upload";
import { MobileLineItemCard } from "@/components/mobile-line-item-card";
import { usePermissions } from "@/hooks/use-permissions";

const DEFAULT_SECTIONS = ["Materials", "Labour", "Equipment", "Subcontract", "Other"];

type QuoteItemInput = {
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

export default function QuoteEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/quote/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();
  const { canViewFinancials, isAdmin } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [products, setProducts] = useState<Item[]>([]);
  const [nextNumber, setNextNumber] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showLeadLostDialog, setShowLeadLostDialog] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [associatedLead, setAssociatedLead] = useState<Lead | null>(null);
  const [lostReason, setLostReason] = useState("Quote declined by customer");
  const [themes, setThemes] = useState<DocumentTheme[]>([]);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoading, setThemeSettingsLoading] = useState(false);

  const [formData, setFormData] = useState<InsertQuote>({
    id: `quote_${Date.now()}`,
    organizationId: "",
    quoteNumber: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    address: "",
    suburb: "",
    status: "draft",
    validUntil: getFutureDateInput(30),
    subtotal: 0,
    gst: 0,
    total: 0,
    notes: "",
    terms: "Payment due within 14 days of acceptance.",
    customerId: null,
    reportId: null,
    jobId: null,
    discount: 0,
    emailReminders: 'false',
    smsReminders: 'false',
    reference: "",
    themeId: null,
    appliedMarkupPercent: 100,
  });

  const [items, setItems] = useState<QuoteItemInput[]>([]);
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSectionName, setEditingSectionName] = useState<string | null>(null);
  const [editedSectionValue, setEditedSectionValue] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showLoadTemplateDialog, setShowLoadTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; description: string | null; createdAt: string | null }>>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const allSections = [...DEFAULT_SECTIONS, ...customSections];

  const groupItemsBySection = () => {
    const groups: Record<string, { items: QuoteItemInput[]; indices: number[] }> = {};
    items.forEach((item, index) => {
      const section = item.section || "General";
      if (!groups[section]) {
        groups[section] = { items: [], indices: [] };
      }
      groups[section].items.push(item);
      groups[section].indices.push(index);
    });
    
    const orderedSections: string[] = [];
    if (groups["General"]) orderedSections.push("General");
    [...DEFAULT_SECTIONS, ...customSections].forEach(section => {
      if (groups[section] && !orderedSections.includes(section)) {
        orderedSections.push(section);
      }
    });
    Object.keys(groups).forEach(section => {
      if (!orderedSections.includes(section)) {
        orderedSections.push(section);
      }
    });
    
    return { groups, orderedSections };
  };

  const calculateSectionSubtotal = (sectionItems: QuoteItemInput[]) => {
    return sectionItems.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleAddSection = () => {
    if (newSectionName.trim() && !allSections.includes(newSectionName.trim()) && newSectionName.trim() !== "General") {
      setCustomSections(prev => [...prev, newSectionName.trim()]);
      setNewSectionName("");
      setShowAddSectionDialog(false);
      toast({ title: "Section added", description: `"${newSectionName.trim()}" section created` });
    }
  };

  const handleRenameSection = (oldName: string, newName: string) => {
    if (!newName.trim() || newName.trim() === oldName) {
      setEditingSectionName(null);
      return;
    }
    if (newName.trim() === "General" || (allSections.includes(newName.trim()) && newName.trim() !== oldName)) {
      toast({ title: "Invalid name", description: "Section name already exists", variant: "destructive" });
      setEditingSectionName(null);
      return;
    }
    
    setItems(prev => prev.map(item => 
      item.section === oldName ? { ...item, section: newName.trim() } : item
    ));
    
    if (customSections.includes(oldName)) {
      setCustomSections(prev => prev.map(s => s === oldName ? newName.trim() : s));
    } else {
      setCustomSections(prev => [...prev, newName.trim()]);
    }
    
    setEditingSectionName(null);
    toast({ title: "Section renamed", description: `"${oldName}" renamed to "${newName.trim()}"` });
  };

  const handleDeleteSection = (sectionName: string) => {
    setItems(prev => prev.map(item => 
      item.section === sectionName ? { ...item, section: null } : item
    ));
    
    if (customSections.includes(sectionName)) {
      setCustomSections(prev => prev.filter(s => s !== sectionName));
    }
    
    toast({ title: "Section removed", description: `Items moved to General` });
  };

  const toggleSectionCollapse = (section: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || items.length === 0) return;
    setSavingTemplate(true);
    try {
      const res = await fetch("/api/saved-line-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: `${items.length} line items`,
          items: items.map((item, idx) => {
            const qty = typeof item.qty === 'string' ? parseFloat(item.qty) || 0 : item.qty;
            const unitCost = typeof item.unitCost === 'string' ? parseFloat(item.unitCost) || 0 : item.unitCost;
            return {
              description: item.description,
              qty,
              unitCost,
              total: qty * unitCost,
              itemCode: item.itemCode,
              costPrice: item.costPrice,
              productId: item.productId,
              section: item.section,
              sortOrder: idx,
            };
          }),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Template saved", description: `"${templateName}" saved with ${items.length} items` });
      setTemplateName("");
      setShowSaveTemplateDialog(false);
    } catch (err) {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
    setSavingTemplate(false);
  };

  const fetchSavedTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/saved-line-sections");
      if (res.ok) setSavedTemplates(await res.json());
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
    setLoadingTemplates(false);
  };

  const handleLoadTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/saved-line-sections/${templateId}`);
      if (!res.ok) throw new Error("Failed to load");
      const { section, items: templateItems } = await res.json();
      const newItems: QuoteItemInput[] = templateItems.map((ti: any, idx: number) => ({
        id: `item_${Date.now()}_${idx}`,
        description: ti.description,
        qty: ti.qty || 1,
        unitCost: ti.unitCost || 0,
        total: ti.total || 0,
        itemCode: ti.itemCode || null,
        costPrice: ti.costPrice || null,
        productId: ti.productId || null,
        section: ti.section || null,
        sortOrder: items.length + idx,
      }));

      const newSections = newItems
        .map(i => i.section)
        .filter(Boolean) as string[];
      const uniqueNewSections = [...new Set(newSections)].filter(
        s => !DEFAULT_SECTIONS.includes(s) && !customSections.includes(s)
      );
      if (uniqueNewSections.length > 0) {
        setCustomSections(prev => [...prev, ...uniqueNewSections]);
      }

      setItems(prev => [...prev, ...newItems]);
      toast({ title: "Template loaded", description: `Added ${newItems.length} items from "${section.name}"` });
      setShowLoadTemplateDialog(false);
    } catch (err) {
      toast({ title: "Failed to load template", variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/saved-line-sections/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSavedTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [isNew, params?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [customersData, jobsData, productsData, number, themesData] = await Promise.all([
        fetchCustomers(),
        fetchJobs(),
        fetchItems(),
        getNextQuoteNumber(),
        fetchDocumentThemes()
      ]);
      setCustomers(customersData);
      setJobs(jobsData);
      setProducts(productsData.filter(p => p.isActive === 'true'));
      setNextNumber(number);
      setThemes(themesData.filter(t => t.isArchived !== 'true'));
      
      const defaultTheme = themesData.find(t => t.isDefault === 'true' && t.isArchived !== 'true');

      if (!isNew && params?.id) {
        const quote = await fetchQuote(params.id);
        if (quote) {
          setFormData({
            id: quote.id,
            organizationId: quote.organizationId,
            quoteNumber: quote.quoteNumber,
            customerName: quote.customerName,
            customerEmail: quote.customerEmail || "",
            customerPhone: quote.customerPhone || "",
            address: quote.address,
            suburb: quote.suburb || "",
            status: quote.status,
            validUntil: quote.validUntil || "",
            subtotal: quote.subtotal || 0,
            gst: quote.gst || 0,
            total: quote.total || 0,
            notes: quote.notes || "",
            terms: quote.terms || "",
            customerId: quote.customerId || null,
            reportId: quote.reportId || null,
            jobId: quote.jobId || null,
            discount: quote.discount || 0,
            emailReminders: quote.emailReminders || 'false',
            smsReminders: quote.smsReminders || 'false',
            reference: quote.reference || "",
            themeId: quote.themeId || defaultTheme?.id || null,
            appliedMarkupPercent: quote.appliedMarkupPercent || 100,
          });
          setItems(quote.items?.map((i, idx) => ({
            id: i.id,
            description: i.description,
            qty: i.qty,
            unitCost: i.unitCost,
            total: i.total,
            itemCode: i.itemCode || null,
            costPrice: i.costPrice || null,
            productId: i.productId || null,
            sortOrder: i.sortOrder ?? idx,
            section: i.section || null
          })) || []);
          
          // Extract custom sections from loaded items
          const loadedSections = quote.items?.map(i => i.section).filter(Boolean) || [];
          const uniqueLoadedSections = [...new Set(loadedSections)] as string[];
          const customSectionsFromItems = uniqueLoadedSections.filter(s => !DEFAULT_SECTIONS.includes(s));
          if (customSectionsFromItems.length > 0) {
            setCustomSections(customSectionsFromItems);
          }
        }
      } else {
        setFormData(prev => ({ ...prev, quoteNumber: number, themeId: defaultTheme?.id || null }));
        
        const urlParams = new URLSearchParams(window.location.search);
        const jobId = urlParams.get('jobId');
        if (jobId) {
          await loadJobDetails(jobId, customersData);
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
        const quoteSettings = settingsArray.find(s => s.documentType === 'quote');
        setThemeSettings(quoteSettings || null);
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

  const loadJobDetails = async (jobId: string, customersList: Customer[]) => {
    try {
      const jobData = await fetchJobWithDocuments(jobId);
      if (jobData?.job) {
        const job = jobData.job;
        // Skip setting reference if it looks like a phone number
        const builderRef = job.builderReference || "";
        // Matches: 8+ digits, or starts with + followed by digits, or common phone formats
        const digitsOnly = builderRef.replace(/[\s\-\(\)\+]/g, '');
        const isLikelyPhoneNumber = (
          /^\d{7,}$/.test(digitsOnly) || // 7+ digits only
          /^\+?\d[\d\s\-\(\)]{7,}$/.test(builderRef) || // Phone format with optional +
          /^0\d{9}$/.test(digitsOnly) // Australian mobile format
        );
        setFormData(prev => ({
          ...prev,
          jobId: job.id,
          reference: (builderRef && !isLikelyPhoneNumber) ? builderRef : prev.reference || "",
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
      section: null
    }]);
  };

  const addProductToItems = (product: Item) => {
    const markup = formData.appliedMarkupPercent || 100;
    const calculatedUnitCost = (product.costPrice || 0) * (markup / 100);
    setItems(prev => [...prev, {
      id: `item_${Date.now()}`,
      description: product.description,
      qty: 1,
      unitCost: calculatedUnitCost,
      total: calculatedUnitCost,
      itemCode: product.itemCode || null,
      costPrice: product.costPrice || null,
      productId: product.id,
      sortOrder: prev.length,
      section: null
    }]);
    setShowProductPicker(false);
    setProductSearch("");
  };

  const handleAiGeneratedItems = (generatedItems: GeneratedQuoteItem[], extractionId: string) => {
    const markup = formData.appliedMarkupPercent || 100;
    const newItems: QuoteItemInput[] = generatedItems.map((item, idx) => ({
      id: `item_${Date.now()}_${idx}`,
      description: item.description,
      qty: item.qty,
      unitCost: item.costPrice ? (item.costPrice * (markup / 100)) : item.unitCost,
      total: item.costPrice ? (item.qty * item.costPrice * (markup / 100)) : item.total,
      itemCode: item.itemCode,
      costPrice: item.costPrice,
      productId: item.productId,
      sortOrder: items.length + idx,
      section: null
    }));
    
    setItems(prev => [...prev, ...newItems]);
    toast({ 
      title: "AI items added", 
      description: `${newItems.length} line items added from Roofr report` 
    });
  };

  const filteredProducts = products.filter(p => {
    const search = productSearch.toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const code = (p.itemCode || '').toLowerCase();
    const cat = (p.category || '').toLowerCase();
    return desc.includes(search) || code.includes(search) || cat.includes(search);
  });

  const updateItem = (index: number, field: keyof QuoteItemInput, value: string | number) => {
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
    setFormData(prev => ({ 
      ...prev, 
      subtotal, 
      gst, 
      total,
    }));
  }, [items, formData.discount]);

  const handleMarkupChange = (newMarkup: number) => {
    setFormData(prev => ({ ...prev, appliedMarkupPercent: newMarkup }));
    setItems(prev => prev.map(item => {
      if (item.itemCode && item.costPrice !== null) {
        const newUnitCost = (item.costPrice || 0) * (newMarkup / 100);
        const qty = typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0;
        return { ...item, unitCost: newUnitCost, total: qty * newUnitCost };
      }
      return item;
    }));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await updateQuote(formData.id, { status: 'approved' });
      setFormData(prev => ({ ...prev, status: 'approved' }));
      toast({ title: "Quote approved", description: "Quote is now ready to send" });
    } catch (err) {
      toast({ title: "Failed to approve quote", variant: "destructive" });
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
      // Sanitize items to numbers before saving
      const sanitizedItems = items.map(item => ({
        ...item,
        qty: typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0,
        unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(String(item.unitCost)) || 0,
      }));
      const data = { ...formData, discount: clampedDiscount, items: sanitizedItems };
      if (isNew) {
        const newQuote = await createQuote(data);
        toast({ title: "Quote created successfully" });
        setLocation(`/quote/${newQuote.id}`);
      } else {
        await updateQuote(params!.id!, data);
        toast({ title: "Quote saved" });
      }
    } catch (err) {
      console.error('Failed to save quote:', err);
      toast({ title: "Failed to save quote", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleCreateJob = async () => {
    setCreatingJob(true);
    try {
      const jobId = `job_${Date.now()}`;
      const newJob = await createJob({
        id: jobId,
        organizationId: "",
        title: `Job from ${formData.quoteNumber}`,
        description: `Created from quote ${formData.quoteNumber}`,
        address: formData.address,
        suburb: formData.suburb || "",
        status: "intake",
        priority: "normal",
        customerId: formData.customerId,
        notes: "",
        assignedTo: [],
        scheduledDate: "",
        scheduledTime: "",
        estimatedDuration: null,
      });
      
      // Sanitize items to numbers before saving
      const sanitizedItems = items.map(item => ({
        ...item,
        qty: typeof item.qty === 'number' ? item.qty : parseFloat(String(item.qty)) || 0,
        unitCost: typeof item.unitCost === 'number' ? item.unitCost : parseFloat(String(item.unitCost)) || 0,
      }));
      await updateQuote(formData.id, { ...formData, jobId: newJob.id, items: sanitizedItems });
      setFormData(prev => ({ ...prev, jobId: newJob.id }));
      
      toast({ title: "Job created", description: `Job created and linked to this quote` });
      setLocation(`/job/${newJob.id}`);
    } catch (err) {
      console.error('Failed to create job:', err);
      toast({ title: "Failed to create job", variant: "destructive" });
    }
    setCreatingJob(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    setFormData(prev => ({ ...prev, status: newStatus }));
    
    // If status is changed to declined, check for associated leads
    if (newStatus === 'declined' && formData.customerId) {
      try {
        const leads = await fetchLeads();
        const lead = leads.find(l => 
          l.customerId === formData.customerId && 
          l.stage !== 'won' && 
          l.stage !== 'lost'
        );
        if (lead) {
          setAssociatedLead(lead);
          setShowLeadLostDialog(true);
        }
      } catch (err) {
        console.error('Failed to check for associated leads:', err);
      }
    }
  };

  const handleMarkLeadLost = async () => {
    if (!associatedLead) return;
    
    try {
      await updateLead(associatedLead.id, { 
        stage: 'lost', 
        lostReason 
      });
      toast({ title: "Lead marked as lost", description: `${associatedLead.name} has been marked as lost` });
      setShowLeadLostDialog(false);
      setAssociatedLead(null);
    } catch (err) {
      console.error('Failed to mark lead as lost:', err);
      toast({ title: "Failed to mark lead as lost", variant: "destructive" });
    }
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
      <div className="space-y-6">
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
                    <Link href="/quotes" data-testid="breadcrumb-quotes">Quotes</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">
                {isNew ? "New Quote" : `Quote ${formData.quoteNumber}`}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Sticky Summary Header - Tradify Style */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 border-b">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0"
                onClick={() => formData.jobId ? setLocation(`/jobs/${formData.jobId}`) : setLocation('/quotes')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold truncate">
                    {isNew ? "New Quote" : formData.quoteNumber}
                  </h1>
                  <Badge 
                    variant={(formData.status || 'draft') === 'accepted' ? 'default' : (formData.status || 'draft') === 'declined' ? 'destructive' : 'outline'}
                    className="shrink-0"
                    data-testid="badge-status"
                  >
                    {formData.status || 'draft'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {formData.customerName || "No customer"}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold">${(formData.total || 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Quick Action Buttons - Tradify Style */}
          <div className="flex flex-wrap gap-2 pb-2 -mx-1 px-1 mt-3">
              <Button 
                size="sm" 
                className="h-11 min-w-[70px] active:scale-95 transition-transform"
                onClick={handleSave} 
                disabled={saving}
                data-testid="button-save"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1.5">Save</span>
              </Button>
              {formData.status === 'draft' && !isNew && (isAdmin || canViewFinancials) && (
                <Button 
                  size="sm" 
                  className="h-11 min-w-[70px] bg-green-600 hover:bg-green-700 text-white active:scale-95 transition-transform"
                  onClick={handleApprove}
                  disabled={saving}
                  data-testid="button-approve"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span className="ml-1.5">Approve</span>
                </Button>
              )}
              {!isNew && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-11 min-w-[70px] active:scale-95 transition-transform"
                    onClick={() => setShowEmailDialog(true)}
                    disabled={themeSettingsLoading || formData.status === 'draft'}
                    title={formData.status === 'draft' ? "Approve quote before sending" : undefined}
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                    <span className="ml-1.5">Email</span>
                  </Button>
                  {formData.customerPhone && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-11 min-w-[70px] active:scale-95 transition-transform"
                      onClick={() => window.open(`tel:${formData.customerPhone}`, '_self')}
                      data-testid="button-call"
                    >
                      <Phone className="h-4 w-4" />
                      <span className="ml-1.5">Call</span>
                    </Button>
                  )}
                  {formData.customerPhone && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-11 min-w-[70px] active:scale-95 transition-transform"
                      onClick={() => window.open(`sms:${formData.customerPhone}`, '_self')}
                      data-testid="button-sms"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span className="ml-1.5">SMS</span>
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-11 min-w-[70px] active:scale-95 transition-transform"
                    onClick={() => setLocation(`/preview/quote/${formData.id}`)}
                    data-testid="button-preview"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="ml-1.5">Preview</span>
                  </Button>
                </>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Quote Number</Label>
                    <Input value={formData.quoteNumber} disabled data-testid="input-quote-number" />
                  </div>
                  <div>
                    <Label>Document Theme</Label>
                    <Select 
                      value={formData.themeId || ""} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, themeId: value || null }))}
                    >
                      <SelectTrigger data-testid="select-quote-theme">
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valid Until</Label>
                    <Input
                      type="date"
                      value={formData.validUntil || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, validUntil: e.target.value }))}
                      data-testid="input-quote-valid"
                    />
                  </div>
                  <div>
                    <Label>Job (Optional)</Label>
                    <SearchableSelect
                      value={formData.jobId ?? null}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, jobId: value }))}
                      options={jobs.map(j => ({ value: j.id, label: `${formatJobNumber(j)} - ${j.title}`, sublabel: j.address || undefined }))}
                      placeholder="No linked job"
                      searchPlaceholder="Search jobs..."
                      emptyText="No jobs found."
                      data-testid="select-quote-job"
                    />
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
                      data-testid="select-quote-customer"
                    />
                  </div>
                </div>

                <Separator />

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
                    <Label>Reference (Builder's Ref)</Label>
                    <Input
                      value={formData.reference || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="e.g. PO-12345"
                      data-testid="input-quote-reference"
                    />
                    {formData.reference && (() => {
                      const digitsOnly = formData.reference.replace(/[\s\-\(\)\+]/g, '');
                      const isLikelyPhone = /^\d{7,}$/.test(digitsOnly) || /^\+?\d[\d\s\-\(\)]{7,}$/.test(formData.reference) || /^0\d{9}$/.test(digitsOnly);
                      return isLikelyPhone ? (
                        <p className="text-xs text-amber-600 mt-1">This looks like a phone number. Reference should be a PO or job number.</p>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div>
                  <Label>Address *</Label>
                  <AddressAutocomplete
                    value={formData.address}
                    onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                    placeholder="Start typing an address..."
                    data-testid="input-quote-address"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle>Line Items</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">Markup:</Label>
                      <Select 
                        value={String(formData.appliedMarkupPercent || 100)} 
                        onValueChange={(value) => handleMarkupChange(Number(value))}
                      >
                        <SelectTrigger className="w-[90px] h-8" data-testid="select-markup-percent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100%</SelectItem>
                          <SelectItem value="150">150%</SelectItem>
                          <SelectItem value="200">200%</SelectItem>
                          <SelectItem value="250">250%</SelectItem>
                          <SelectItem value="300">300%</SelectItem>
                          <SelectItem value="350">350%</SelectItem>
                          <SelectItem value="400">400%</SelectItem>
                          <SelectItem value="450">450%</SelectItem>
                          <SelectItem value="500">500%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                    <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-add-section">
                          <FolderPlus className="h-4 w-4 mr-1" />
                          Add Section
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Section</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <Input
                            placeholder="Section name (e.g., ROOF, GUTTERS)"
                            value={newSectionName}
                            onChange={(e) => setNewSectionName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                            data-testid="input-new-section-name"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setNewSectionName(""); setShowAddSectionDialog(false); }}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddSection} disabled={!newSectionName.trim()} data-testid="button-confirm-add-section">
                              Add Section
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <RoofrPdfUpload onItemsGenerated={handleAiGeneratedItems} />
                    <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={items.length === 0} data-testid="button-save-template">
                          <Download className="h-4 w-4 mr-1" />
                          Save Template
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Save Line Items as Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <p className="text-sm text-muted-foreground">
                            Save all {items.length} line items as a reusable template you can load into future quotes.
                          </p>
                          <Input
                            placeholder="Template name (e.g., Standard Re-roof)"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                            data-testid="input-template-name"
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { setTemplateName(""); setShowSaveTemplateDialog(false); }}>
                              Cancel
                            </Button>
                            <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || savingTemplate} data-testid="button-confirm-save-template">
                              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                              Save
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Dialog open={showLoadTemplateDialog} onOpenChange={(open) => { setShowLoadTemplateDialog(open); if (open) fetchSavedTemplates(); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-load-template">
                          <Upload className="h-4 w-4 mr-1" />
                          Load Template
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Load Saved Template</DialogTitle>
                        </DialogHeader>
                        <div className="pt-4">
                          {loadingTemplates ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : savedTemplates.length === 0 ? (
                            <p className="text-center py-8 text-muted-foreground">No saved templates yet. Save your current line items as a template first.</p>
                          ) : (
                            <ScrollArea className="max-h-[400px]">
                              <div className="space-y-2">
                                {savedTemplates.map(t => (
                                  <div
                                    key={t.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                                    onClick={() => handleLoadTemplate(t.id)}
                                    data-testid={`template-item-${t.id}`}
                                  >
                                    <div>
                                      <p className="font-medium">{t.name}</p>
                                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                                      onClick={(e) => handleDeleteTemplate(t.id, e)}
                                      data-testid={`button-delete-template-${t.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
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
                  <div className="space-y-4">
                    {(() => {
                      const { groups, orderedSections } = groupItemsBySection();
                      return orderedSections.map((sectionName) => {
                        const sectionData = groups[sectionName];
                        const isCollapsed = collapsedSections.has(sectionName);
                        const subtotal = calculateSectionSubtotal(sectionData.items);
                        
                        return (
                          <div key={sectionName} className="border rounded-lg overflow-hidden" data-testid={`section-${sectionName.replace(/\s+/g, '-').toLowerCase()}`}>
                            <div className="bg-muted/50 px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-6 md:w-6 md:min-h-0 md:min-w-0 flex-shrink-0"
                                  onClick={() => toggleSectionCollapse(sectionName)}
                                  data-testid={`button-toggle-section-${sectionName.replace(/\s+/g, '-').toLowerCase()}`}
                                >
                                  {isCollapsed ? <ChevronRight className="h-5 w-5 md:h-4 md:w-4" /> : <ChevronDown className="h-5 w-5 md:h-4 md:w-4" />}
                                </Button>
                                {editingSectionName === sectionName ? (
                                  <Input
                                    autoFocus
                                    value={editedSectionValue}
                                    onChange={(e) => setEditedSectionValue(e.target.value)}
                                    onBlur={() => handleRenameSection(sectionName, editedSectionValue)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleRenameSection(sectionName, editedSectionValue);
                                      if (e.key === 'Escape') setEditingSectionName(null);
                                    }}
                                    className="h-8 w-48 font-bold uppercase"
                                    data-testid={`input-rename-section-${sectionName.replace(/\s+/g, '-').toLowerCase()}`}
                                  />
                                ) : (
                                  <span
                                    className="font-bold text-xs md:text-sm uppercase cursor-pointer hover:text-primary flex items-center gap-1 truncate"
                                    onClick={() => {
                                      if (sectionName !== "General") {
                                        setEditingSectionName(sectionName);
                                        setEditedSectionValue(sectionName);
                                      }
                                    }}
                                    data-testid={`section-header-${sectionName.replace(/\s+/g, '-').toLowerCase()}`}
                                  >
                                    {sectionName}
                                    {sectionName !== "General" && <Pencil className="h-3 w-3 opacity-50 flex-shrink-0" />}
                                  </span>
                                )}
                                <Badge variant="secondary" className="ml-1 md:ml-2 text-xs flex-shrink-0 hidden sm:inline-flex">
                                  {sectionData.items.length} item{sectionData.items.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 md:gap-3 flex-shrink-0">
                                <span className="font-semibold text-sm">${subtotal.toFixed(2)}</span>
                                {sectionName !== "General" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 min-h-[44px] min-w-[44px] md:h-6 md:w-6 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteSection(sectionName)}
                                    data-testid={`button-delete-section-${sectionName.replace(/\s+/g, '-').toLowerCase()}`}
                                  >
                                    <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            
                            {!isCollapsed && (
                              <>
                                {/* Desktop Table View */}
                                <div className="hidden md:block">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-[40%]">Description</TableHead>
                                        <TableHead className="w-[15%]">Section</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Unit Cost</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {sectionData.items.map((item, itemIdx) => {
                                        const globalIndex = sectionData.indices[itemIdx];
                                        return (
                                          <TableRow key={item.id}>
                                            <TableCell>
                                              <Textarea
                                                value={item.description}
                                                onChange={(e) => updateItem(globalIndex, 'description', e.target.value)}
                                                placeholder="Description"
                                                rows={2}
                                                className="min-h-[60px] resize-none"
                                                data-testid={`input-item-desc-${globalIndex}`}
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Select
                                                value={item.section || "none"}
                                                onValueChange={(value) => updateItem(globalIndex, 'section', value === "none" ? "" : value)}
                                              >
                                                <SelectTrigger className="w-full" data-testid={`select-item-section-${globalIndex}`}>
                                                  <SelectValue placeholder="Select section" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="none">
                                                    <span className="text-muted-foreground">General</span>
                                                  </SelectItem>
                                                  {allSections.map((section) => (
                                                    <SelectItem key={section} value={section}>
                                                      {section}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={item.qty}
                                                onChange={(e) => {
                                                  const val = e.target.value;
                                                  if (val === '' || val === '-' || val === '-.') {
                                                    updateItem(globalIndex, 'qty', val);
                                                    return;
                                                  }
                                                  if (/^-?\d*\.?\d*$/.test(val)) {
                                                    const num = parseFloat(val);
                                                    updateItem(globalIndex, 'qty', isNaN(num) ? val : num);
                                                  }
                                                }}
                                                onBlur={(e) => {
                                                  const num = parseFloat(e.target.value);
                                                  updateItem(globalIndex, 'qty', isNaN(num) ? 0 : num);
                                                }}
                                                className="w-20"
                                                data-testid={`input-item-qty-${globalIndex}`}
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
                                                    updateItem(globalIndex, 'unitCost', val);
                                                    return;
                                                  }
                                                  if (/^-?\d*\.?\d*$/.test(val)) {
                                                    const num = parseFloat(val);
                                                    updateItem(globalIndex, 'unitCost', isNaN(num) ? val : num);
                                                  }
                                                }}
                                                onBlur={(e) => {
                                                  const num = parseFloat(e.target.value);
                                                  updateItem(globalIndex, 'unitCost', isNaN(num) ? 0 : num);
                                                }}
                                                className="w-28"
                                                data-testid={`input-item-cost-${globalIndex}`}
                                              />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                              ${item.total.toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                              <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => removeItem(globalIndex)}
                                                data-testid={`button-remove-item-${globalIndex}`}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                      <TableRow className="bg-muted/30">
                                        <TableCell colSpan={4} className="text-right font-semibold">
                                          Section Subtotal:
                                        </TableCell>
                                        <TableCell className="font-bold">
                                          ${subtotal.toFixed(2)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                      </TableRow>
                                    </TableBody>
                                  </Table>
                                </div>

                                {/* Mobile Card View */}
                                <div className="block md:hidden space-y-3">
                                  {sectionData.items.map((item, itemIdx) => {
                                    const globalIndex = sectionData.indices[itemIdx];
                                    return (
                                      <MobileLineItemCard
                                        key={item.id}
                                        item={item}
                                        index={globalIndex}
                                        sections={allSections}
                                        showSection={true}
                                        onUpdateDescription={(value) => updateItem(globalIndex, 'description', value)}
                                        onUpdateQty={(value) => updateItem(globalIndex, 'qty', value)}
                                        onUpdateUnitCost={(value) => updateItem(globalIndex, 'unitCost', value)}
                                        onUpdateSection={(value) => updateItem(globalIndex, 'section', value || "")}
                                        onBlurQty={() => {
                                          const num = parseFloat(String(item.qty));
                                          updateItem(globalIndex, 'qty', isNaN(num) ? 0 : num);
                                        }}
                                        onBlurUnitCost={() => {
                                          const num = parseFloat(String(item.unitCost));
                                          updateItem(globalIndex, 'unitCost', isNaN(num) ? 0 : num);
                                        }}
                                        onRemove={() => removeItem(globalIndex)}
                                      />
                                    );
                                  })}
                                  <div className="flex justify-end py-2 px-4 bg-muted/30 rounded-lg">
                                    <span className="font-semibold mr-2">Section Subtotal:</span>
                                    <span className="font-bold">${subtotal.toFixed(2)}</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Notes</CardTitle>
                  <Link href="/settings" className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-edit-tcs-quote">
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
                    placeholder="Additional notes for this quote..."
                    data-testid="input-quote-notes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">${formData.subtotal?.toFixed(2)}</span>
                </div>
                
                {/* Discount Field */}
                <div className="space-y-2">
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
                        : `-${((formData.discount || 0) / (formData.subtotal || 1) * 100).toFixed(1)}% off`
                      }
                    </p>
                  )}
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST (10%)</span>
                  <span className="font-medium">${formData.gst?.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-primary">${formData.total?.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Reminders Toggle */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Send Reminders</p>
                    <p className="text-sm text-muted-foreground">Auto-remind before expiry</p>
                  </div>
                  <Switch
                    checked={formData.emailReminders === 'true'}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, emailReminders: checked ? 'true' : 'false' }))}
                    data-testid="switch-reminders"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Attachments */}
            {!isNew && formData.id && (
              <DocumentAttachments 
                documentType="quote" 
                documentId={formData.id}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select 
                  value={formData.status} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger data-testid="select-quote-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                
                {formData.status === 'accepted' && !formData.jobId && (
                  <Button 
                    onClick={handleCreateJob} 
                    disabled={creatingJob || isNew}
                    className="w-full"
                    data-testid="button-create-job-from-quote"
                  >
                    {creatingJob ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Briefcase className="h-4 w-4 mr-2" />
                    )}
                    Create Job from Quote
                  </Button>
                )}
                
                {formData.jobId && (
                  <div className="text-sm text-muted-foreground">
                    <Link href={`/job/${formData.jobId}`} className="text-blue-500 hover:underline">
                      View linked job
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showPreview && (
        <PdfPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          document={prepareQuoteData({ ...formData, items } as QuoteWithItems, linkedJob)}
          theme={themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null}
          themeSettings={themeSettings}
        />
      )}

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="quote"
          documentId={formData.id}
          documentNumber={formData.quoteNumber}
          recipientEmail={formData.customerEmail || ""}
          recipientName={formData.customerName}
          onSuccess={() => {
            toast({ title: "Quote Sent", description: "Quote sent to customer" });
            setFormData(prev => ({ ...prev, status: 'sent' }));
          }}
          getPdfBase64={async () => {
            // Fetch fresh job data just like quote-preview.tsx does to ensure
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
            const documentData = prepareQuoteData({ ...formData, items } as QuoteWithItems, freshJob);
            const selectedTheme = themes.find(t => t.id === formData.themeId) || themes.find(t => t.isDefault === 'true') || null;
            let currentThemeSettings = themeSettings;
            if (selectedTheme?.id) {
              try {
                const settingsArray = await fetchDocumentThemeSettings(selectedTheme.id);
                currentThemeSettings = settingsArray.find(s => s.documentType === 'quote') || null;
              } catch (e) {
                console.error('Failed to fetch theme settings:', e);
              }
            }
            return generatePdfBase64(documentData, selectedTheme, currentThemeSettings);
          }}
        />
      )}

      <AlertDialog open={showLeadLostDialog} onOpenChange={setShowLeadLostDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Lead as Lost?</AlertDialogTitle>
            <AlertDialogDescription>
              This quote is linked to lead "{associatedLead?.name}". Would you like to mark this lead as lost since the quote was declined?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="lost-reason">Reason</Label>
            <Textarea
              id="lost-reason"
              placeholder="Reason for losing this lead..."
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              data-testid="input-lost-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setAssociatedLead(null); setLostReason("Quote declined by customer"); }}>
              Skip
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleMarkLeadLost}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-mark-lost"
            >
              Mark Lead as Lost
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
