import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchItems } from "@/lib/api";
import { Plus, Trash2, Edit, Sparkles, ChevronDown, ChevronUp, GripVertical, Package, Upload, FileText, Loader2, Brain, CheckCircle, ArrowRight } from "lucide-react";
import { SearchableSelect } from "@/components/searchable-select";
import type { QuoteTemplate, QuoteTemplateMapping, Item, MlImportSession, MlPricingPattern } from "@shared/schema";

const MEASUREMENT_TYPES = [
  { value: 'roof_area', label: 'Total Roof Area', unit: 'm²' },
  { value: 'pitched_area', label: 'Pitched Roof Area', unit: 'm²' },
  { value: 'flat_area', label: 'Flat Roof Area', unit: 'm²' },
  { value: 'ridges', label: 'Ridges', unit: 'm' },
  { value: 'eaves', label: 'Eaves', unit: 'm' },
  { value: 'valleys', label: 'Valleys', unit: 'm' },
  { value: 'hips', label: 'Hips', unit: 'm' },
  { value: 'rakes', label: 'Rakes', unit: 'm' },
  { value: 'wall_flashing', label: 'Wall Flashing', unit: 'm' },
  { value: 'step_flashing', label: 'Step Flashing', unit: 'm' },
  { value: 'parapet_wall', label: 'Parapet Wall', unit: 'm' },
  { value: 'fixed_job', label: 'Fixed Job Cost', unit: 'job' },
];

const CALCULATION_TYPES = [
  { value: 'per_unit', label: 'Per Unit (1:1 with measurement)' },
  { value: 'per_coverage', label: 'Per Coverage (e.g., 1 bundle per 3m²)' },
  { value: 'fixed', label: 'Fixed Quantity' },
  { value: 'formula', label: 'Custom Formula (use math expression)' },
];

export function QuoteTemplateSettings() {
  const { toast } = useToast();
  const { canDelete } = usePermissions();
  const queryClient = useQueryClient();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<QuoteTemplateMapping | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<QuoteTemplate | null>(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [showPricingPatterns, setShowPricingPatterns] = useState(false);
  const [clearPatternsDialogOpen, setClearPatternsDialogOpen] = useState(false);
  const [editingPatternProductId, setEditingPatternProductId] = useState<string | null>(null);
  
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    wastePercent: '10',
    laborMarkupPercent: '0',
    isDefault: false,
    isActive: true,
  });
  
  const [mappingForm, setMappingForm] = useState({
    measurementType: '',
    productId: '',
    productDescription: '',
    calculationType: 'per_unit',
    coveragePerUnit: '1',
    applyWaste: true,
    laborMinutesPerUnit: '0',
    laborRate: '75',
    customFormula: '',
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/quote-templates"],
    queryFn: async () => {
      const res = await fetch("/api/quote-templates");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json() as Promise<QuoteTemplate[]>;
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["items"],
    queryFn: () => fetchItems(),
  });

  const { data: mappings = [], refetch: refetchMappings } = useQuery({
    queryKey: ["/api/quote-templates", expandedTemplateId, "mappings"],
    queryFn: async () => {
      if (!expandedTemplateId) return [];
      const res = await fetch(`/api/quote-templates/${expandedTemplateId}/mappings`);
      if (!res.ok) throw new Error("Failed to fetch mappings");
      return res.json() as Promise<QuoteTemplateMapping[]>;
    },
    enabled: !!expandedTemplateId,
  });

  // ML Import Sessions - for tracking PDF quote imports
  const { data: importSessions = [] } = useQuery({
    queryKey: ["/api/ml/import-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/ml/import-sessions");
      if (!res.ok) return [];
      const sessions = await res.json() as MlImportSession[];
      // Filter to only show PDF imports
      return sessions.filter((s: MlImportSession) => s.source === 'pdf_quote');
    },
  });

  // ML Pricing Patterns count
  const { data: pricingPatterns = [] } = useQuery({
    queryKey: ["/api/ml/pricing-patterns"],
    queryFn: async () => {
      const res = await fetch("/api/ml/pricing-patterns");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [generatingTemplate, setGeneratingTemplate] = useState(false);

  const generateTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ml/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateName: "AI Generated Template" }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to generate template");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates"] });
      toast({ 
        title: "Template Generated!",
        description: `Created "${data.template.name}" with ${data.mappingsCreated} product mappings from ${data.patternsAnalyzed} pricing patterns`
      });
      // Auto-expand the new template so user can review
      setExpandedTemplateId(data.template.id);
    },
    onError: (error: Error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleGenerateTemplate = async () => {
    setGeneratingTemplate(true);
    try {
      await generateTemplateMutation.mutateAsync();
    } finally {
      setGeneratingTemplate(false);
    }
  };

  const importPdfMutation = useMutation({
    mutationFn: async ({ pdfBase64, filename }: { pdfBase64: string; filename: string }) => {
      const res = await fetch("/api/ml/import-pdf-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64, filename }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process PDF");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ml/pricing-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/import-sessions"] });
    },
    onError: (error: Error) => {
      toast({ title: "PDF processing failed", description: error.message, variant: "destructive" });
    },
  });

  const linkPatternToProductMutation = useMutation({
    mutationFn: async ({ patternId, product }: { patternId: string; product: Item | null }) => {
      if (!product) {
        // Clear the product link
        const res = await fetch(`/api/ml/pricing-patterns/${patternId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: null, itemCode: null, costPrice: null, markupPercentage: null, unit: null }),
        });
        if (!res.ok) throw new Error("Failed to clear product link");
        return res.json();
      }
      // Calculate markup percentage from product prices
      const markupPercentage = product.costPrice > 0 
        ? ((product.sellPrice - product.costPrice) / product.costPrice) * 100 
        : 0;
      const res = await fetch(`/api/ml/pricing-patterns/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          itemCode: product.itemCode,
          costPrice: product.costPrice,
          markupPercentage,
          unit: product.unit,
          avgUnitPrice: product.sellPrice, // Update the sell price from product
        }),
      });
      if (!res.ok) throw new Error("Failed to link product");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ml/pricing-patterns"] });
      setEditingPatternProductId(null);
      toast({ title: "Product linked" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to link product", description: error.message, variant: "destructive" });
    },
  });

  const clearPatternsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ml/pricing-patterns", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear patterns");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ml/pricing-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ml/import-sessions"] });
      setClearPatternsDialogOpen(false);
      setShowPricingPatterns(false);
      toast({ title: "Patterns cleared", description: "All pricing patterns have been removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to clear patterns", description: error.message, variant: "destructive" });
    },
  });

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setImportingPdf(true);
    setPdfProgress({ current: 0, total: files.length });
    
    let successCount = 0;
    let totalPatterns = 0;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setPdfProgress({ current: i + 1, total: files.length });
        
        try {
          // Convert file to base64 using chunked approach (handles large files)
          const pdfBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Remove data URL prefix (e.g., "data:application/pdf;base64,")
              const base64 = result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = () => reject(new Error('Failed to read PDF file'));
            reader.readAsDataURL(file);
          });
          
          const result = await importPdfMutation.mutateAsync({ pdfBase64, filename: file.name });
          if (result.success) {
            successCount++;
            totalPatterns += result.patternsCreated || 0;
          }
        } catch (err) {
          console.error(`Failed to process ${file.name}:`, err);
        }
      }
      
      if (successCount > 0) {
        toast({ 
          title: "PDF quotes imported", 
          description: `Processed ${successCount} of ${files.length} PDFs. Learned ${totalPatterns} pricing patterns.` 
        });
      }
    } finally {
      setImportingPdf(false);
      setPdfProgress({ current: 0, total: 0 });
      event.target.value = '';
    }
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<QuoteTemplate>) => {
      const res = await fetch("/api/quote-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates"] });
      setDialogOpen(false);
      resetTemplateForm();
      toast({ title: "Template created" });
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuoteTemplate> }) => {
      const res = await fetch(`/api/quote-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update template");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates"] });
      setDialogOpen(false);
      setEditingTemplate(null);
      resetTemplateForm();
      toast({ title: "Template updated" });
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quote-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quote-templates"] });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      toast({ title: "Template deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const createMappingMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: Partial<QuoteTemplateMapping> }) => {
      const res = await fetch(`/api/quote-templates/${templateId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create mapping");
      return res.json();
    },
    onSuccess: () => {
      refetchMappings();
      setMappingDialogOpen(false);
      resetMappingForm();
      toast({ title: "Mapping added" });
    },
    onError: () => {
      toast({ title: "Failed to add mapping", variant: "destructive" });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<QuoteTemplateMapping> }) => {
      const res = await fetch(`/api/quote-template-mappings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update mapping");
      return res.json();
    },
    onSuccess: () => {
      refetchMappings();
      setMappingDialogOpen(false);
      setEditingMapping(null);
      resetMappingForm();
      toast({ title: "Mapping updated" });
    },
    onError: () => {
      toast({ title: "Failed to update mapping", variant: "destructive" });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quote-template-mappings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete mapping");
    },
    onSuccess: () => {
      refetchMappings();
      toast({ title: "Mapping removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove mapping", variant: "destructive" });
    },
  });

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      wastePercent: '10',
      laborMarkupPercent: '0',
      isDefault: false,
      isActive: true,
    });
  };

  const resetMappingForm = () => {
    setMappingForm({
      measurementType: '',
      productId: '',
      productDescription: '',
      calculationType: 'per_unit',
      coveragePerUnit: '1',
      applyWaste: true,
      laborMinutesPerUnit: '0',
      laborRate: '75',
      customFormula: '',
    });
  };

  const handleEditTemplate = (template: QuoteTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      wastePercent: String(template.wastePercent ?? 10),
      laborMarkupPercent: String(template.laborMarkupPercent ?? 0),
      isDefault: template.isDefault === 'true',
      isActive: template.isActive === 'true',
    });
    setDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    const data = {
      name: templateForm.name,
      description: templateForm.description || null,
      wastePercent: parseFloat(templateForm.wastePercent) || 10,
      laborMarkupPercent: parseFloat(templateForm.laborMarkupPercent) || 0,
      isDefault: templateForm.isDefault ? 'true' : 'false',
      isActive: templateForm.isActive ? 'true' : 'false',
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleEditMapping = (mapping: QuoteTemplateMapping) => {
    setEditingMapping(mapping);
    setMappingForm({
      measurementType: mapping.measurementType,
      productId: mapping.productId || '',
      productDescription: mapping.productDescription || '',
      calculationType: mapping.calculationType,
      coveragePerUnit: String(mapping.coveragePerUnit ?? 1),
      applyWaste: mapping.applyWaste === 'true',
      laborMinutesPerUnit: String(mapping.laborMinutesPerUnit ?? 0),
      laborRate: String(mapping.laborRate ?? 75),
      customFormula: mapping.customFormula || '',
    });
    setMappingDialogOpen(true);
  };

  const handleSaveMapping = () => {
    if (!expandedTemplateId) return;
    
    const data = {
      measurementType: mappingForm.measurementType,
      productId: mappingForm.productId || null,
      productDescription: mappingForm.productDescription || null,
      calculationType: mappingForm.calculationType,
      coveragePerUnit: parseFloat(mappingForm.coveragePerUnit) || 1,
      applyWaste: mappingForm.applyWaste ? 'true' : 'false',
      laborMinutesPerUnit: parseFloat(mappingForm.laborMinutesPerUnit) || 0,
      laborRate: parseFloat(mappingForm.laborRate) || 75,
      customFormula: mappingForm.customFormula || null,
    };

    if (editingMapping) {
      updateMappingMutation.mutate({ id: editingMapping.id, data });
    } else {
      createMappingMutation.mutate({ templateId: expandedTemplateId, data });
    }
  };

  const getProductName = (productId: string | null) => {
    if (!productId) return null;
    const product = products.find(p => p.id === productId);
    return product ? `${product.itemCode} - ${product.description}` : null;
  };

  const getMeasurementLabel = (type: string) => {
    return MEASUREMENT_TYPES.find(m => m.value === type)?.label || type;
  };

  if (templatesLoading) {
    return (
      <Card id="quote-templates" className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Quote Templates
          </CardTitle>
          <CardDescription>Loading templates...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="quote-templates" className="lg:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Quote Templates
            </CardTitle>
            <CardDescription>
              Configure how Roofr PDF measurements map to your products for auto-quoting
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingTemplate(null);
              resetTemplateForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-quote-template">
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Quote Template'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="qt-name">Template Name *</Label>
                  <Input
                    id="qt-name"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Standard Re-Roof"
                    data-testid="input-quote-template-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qt-desc">Description</Label>
                  <Textarea
                    id="qt-desc"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What this template is used for"
                    data-testid="input-quote-template-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="qt-waste">Waste % (default)</Label>
                    <Input
                      id="qt-waste"
                      type="number"
                      value={templateForm.wastePercent}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, wastePercent: e.target.value }))}
                      data-testid="input-quote-template-waste"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qt-labor-markup">Labor Markup %</Label>
                    <Input
                      id="qt-labor-markup"
                      type="number"
                      value={templateForm.laborMarkupPercent}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, laborMarkupPercent: e.target.value }))}
                      data-testid="input-quote-template-labor-markup"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="qt-default"
                      checked={templateForm.isDefault}
                      onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, isDefault: checked }))}
                      data-testid="switch-quote-template-default"
                    />
                    <Label htmlFor="qt-default">Set as default</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="qt-active"
                      checked={templateForm.isActive}
                      onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, isActive: checked }))}
                      data-testid="switch-quote-template-active"
                    />
                    <Label htmlFor="qt-active">Active</Label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveTemplate}
                    disabled={!templateForm.name || createTemplateMutation.isPending || updateTemplateMutation.isPending}
                    data-testid="button-save-quote-template"
                  >
                    {editingTemplate ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* ML Training Data Section */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-lg border border-purple-200 dark:border-purple-900">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-purple-900 dark:text-purple-100">Smart Pricing from Your History</h4>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Upload your past PDF quotes to teach the AI your pricing patterns. The system learns from your quotes to suggest smarter prices.
              </p>
              
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handlePdfUpload}
                    className="hidden"
                    data-testid="input-pdf-quote-upload"
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
                    {importingPdf ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {pdfProgress.total > 0 ? `${pdfProgress.current}/${pdfProgress.total}` : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Import PDF Quotes
                      </>
                    )}
                  </span>
                </label>
                
                {pricingPatterns.length > 0 && (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 hover:text-purple-900"
                      onClick={() => setShowPricingPatterns(!showPricingPatterns)}
                      data-testid="button-toggle-pricing-patterns"
                    >
                      {showPricingPatterns ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <CheckCircle className="h-4 w-4" />
                      <span>{pricingPatterns.length} pricing patterns learned</span>
                    </Button>
                    <Button
                      onClick={handleGenerateTemplate}
                      disabled={generatingTemplate}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-generate-template"
                    >
                      {generatingTemplate ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Template
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
              
              {importSessions.length > 0 && (
                <div className="mt-3 text-xs text-purple-600 dark:text-purple-400">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3 w-3" />
                    Last PDF: {importSessions[0].filename} ({importSessions[0].uniquePatterns} patterns)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expandable Pricing Patterns Table */}
        {showPricingPatterns && pricingPatterns.length > 0 && (
          <div className="border rounded-lg p-4 bg-purple-50 dark:bg-purple-950/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                Learned Pricing Patterns
              </h4>
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">Edit markup % to adjust profit margins</p>
                {canDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearPatternsDialogOpen(true)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    data-testid="button-clear-patterns"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Item Code</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Sell Price</TableHead>
                    <TableHead className="text-right">Markup %</TableHead>
                    <TableHead className="text-right">Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingPatterns.map((pattern: MlPricingPattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={pattern.itemDescription}>
                        {pattern.itemDescription}
                      </TableCell>
                      <TableCell className="text-right">
                        {editingPatternProductId === pattern.id ? (
                          <div className="min-w-[200px]">
                            <SearchableSelect
                              value={pattern.productId || null}
                              onValueChange={(productId) => {
                                const product = products.find((p: Item) => p.id === productId) || null;
                                linkPatternToProductMutation.mutate({ patternId: pattern.id, product });
                              }}
                              options={products.map((p: Item) => ({
                                value: p.id,
                                label: p.itemCode,
                                sublabel: p.description,
                              }))}
                              placeholder="Search products..."
                              searchPlaceholder="Search by code or description..."
                              emptyText="No products found"
                              data-testid={`select-pattern-product-${pattern.id}`}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingPatternProductId(pattern.id)}
                            className="text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                            data-testid={`button-edit-pattern-product-${pattern.id}`}
                          >
                            {pattern.itemCode || 'Link product...'}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {pattern.costPrice ? `$${pattern.costPrice.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${pattern.avgUnitPrice?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={pattern.markupPercentage ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {pattern.markupPercentage ? `${pattern.markupPercentage.toFixed(1)}%` : '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {pattern.unit || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No quote templates yet</p>
            <p className="text-sm">Create a template to map roof measurements to your products</p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg">
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                  onClick={() => setExpandedTemplateId(expandedTemplateId === template.id ? null : template.id)}
                  data-testid={`quote-template-row-${template.id}`}
                >
                  <div className="flex items-center gap-3">
                    {expandedTemplateId === template.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {template.name}
                        {template.isDefault === 'true' && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                        {template.isActive !== 'true' && (
                          <Badge variant="outline" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleEditTemplate(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {canDelete && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          setTemplateToDelete(template);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-template-${template.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {expandedTemplateId === template.id && (
                  <div className="border-t p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-muted-foreground">
                        Waste: {template.wastePercent ?? 10}% | Labor Markup: {template.laborMarkupPercent ?? 0}%
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => {
                          resetMappingForm();
                          setEditingMapping(null);
                          setMappingDialogOpen(true);
                        }}
                        data-testid="button-add-mapping"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Mapping
                      </Button>
                    </div>
                    
                    {mappings.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No product mappings yet. Add mappings to define how measurements convert to quote line items.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Measurement</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Calculation</TableHead>
                            <TableHead>Labor</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mappings.map((mapping) => (
                            <TableRow key={mapping.id}>
                              <TableCell className="font-medium">
                                {getMeasurementLabel(mapping.measurementType)}
                              </TableCell>
                              <TableCell>
                                {getProductName(mapping.productId) || mapping.productDescription || (
                                  <span className="text-muted-foreground">No product linked</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {mapping.calculationType === 'per_coverage' 
                                  ? `1 per ${mapping.coveragePerUnit}m` 
                                  : mapping.calculationType === 'fixed'
                                  ? 'Fixed qty'
                                  : mapping.calculationType === 'formula'
                                  ? `Formula: ${mapping.customFormula || 'N/A'}`
                                  : '1:1'}
                                {mapping.applyWaste === 'true' && ' +waste'}
                              </TableCell>
                              <TableCell className="text-sm">
                                {(mapping.laborMinutesPerUnit ?? 0) > 0 
                                  ? `${mapping.laborMinutesPerUnit} min @ $${mapping.laborRate}/hr`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleEditMapping(mapping)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  {canDelete && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      onClick={() => deleteMappingMutation.mutate(mapping.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={mappingDialogOpen} onOpenChange={(open) => {
          setMappingDialogOpen(open);
          if (!open) {
            setEditingMapping(null);
            resetMappingForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingMapping ? 'Edit Mapping' : 'Add Product Mapping'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Measurement Type *</Label>
                  <Select
                    value={mappingForm.measurementType}
                    onValueChange={(value) => setMappingForm(prev => ({ ...prev, measurementType: value }))}
                  >
                    <SelectTrigger data-testid="select-measurement-type">
                      <SelectValue placeholder="Select measurement" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEASUREMENT_TYPES.map(mt => (
                        <SelectItem key={mt.value} value={mt.value}>
                          {mt.label} ({mt.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Product</Label>
                  <SearchableSelect
                    value={mappingForm.productId || null}
                    onValueChange={(value) => setMappingForm(prev => ({ ...prev, productId: value || "" }))}
                    options={products.map(p => ({
                      value: p.id,
                      label: `${p.itemCode} - ${p.description}`,
                      sublabel: p.category || undefined
                    }))}
                    placeholder="None (use description)"
                    searchPlaceholder="Search products..."
                    emptyText="No products found"
                    data-testid="select-mapping-product"
                  />
                </div>
              </div>

              {!mappingForm.productId && (
                <div className="space-y-2">
                  <Label>Custom Description</Label>
                  <Input
                    value={mappingForm.productDescription}
                    onChange={(e) => setMappingForm(prev => ({ ...prev, productDescription: e.target.value }))}
                    placeholder="Description for quote line item"
                    data-testid="input-mapping-description"
                  />
                </div>
              )}

              <div className="rounded-lg border p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Calculation Type</Label>
                    <Select
                      value={mappingForm.calculationType}
                      onValueChange={(value) => setMappingForm(prev => ({ ...prev, calculationType: value }))}
                    >
                      <SelectTrigger data-testid="select-calculation-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALCULATION_TYPES.map(ct => (
                          <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {mappingForm.calculationType === 'per_coverage' && (
                    <div className="space-y-2">
                      <Label>Coverage per Unit (m or m²)</Label>
                      <Input
                        type="number"
                        value={mappingForm.coveragePerUnit}
                        onChange={(e) => setMappingForm(prev => ({ ...prev, coveragePerUnit: e.target.value }))}
                        placeholder="e.g., 3 for 1 bundle per 3m²"
                        data-testid="input-coverage-per-unit"
                      />
                    </div>
                  )}

                </div>

                {mappingForm.calculationType === 'formula' && (
                  <div className="space-y-2">
                    <Label>Formula Expression</Label>
                    <Input
                      value={mappingForm.customFormula}
                      onChange={(e) => setMappingForm(prev => ({ ...prev, customFormula: e.target.value }))}
                      placeholder="e.g., measurement * 1.1"
                      data-testid="input-custom-formula"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use "measurement" as the variable. Supports +, -, *, / and parentheses.
                      Examples: measurement * 1.5, measurement / 0.762, (measurement + 5) * 2
                    </p>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="apply-waste"
                    checked={mappingForm.applyWaste}
                    onCheckedChange={(checked) => setMappingForm(prev => ({ ...prev, applyWaste: checked }))}
                    data-testid="switch-apply-waste"
                  />
                  <Label htmlFor="apply-waste">Apply waste percentage</Label>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <Label className="text-sm font-medium mb-3 block">Labor Component (optional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Minutes per unit</Label>
                    <Input
                      type="number"
                      value={mappingForm.laborMinutesPerUnit}
                      onChange={(e) => setMappingForm(prev => ({ ...prev, laborMinutesPerUnit: e.target.value }))}
                      placeholder="0"
                      data-testid="input-labor-minutes"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Hourly rate ($)</Label>
                    <Input
                      type="number"
                      value={mappingForm.laborRate}
                      onChange={(e) => setMappingForm(prev => ({ ...prev, laborRate: e.target.value }))}
                      placeholder="75"
                      data-testid="input-labor-rate"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveMapping}
                  disabled={!mappingForm.measurementType || createMappingMutation.isPending || updateMappingMutation.isPending}
                  data-testid="button-save-mapping"
                >
                  {editingMapping ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Template?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{templateToDelete?.name}" and all its product mappings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => templateToDelete && deleteTemplateMutation.mutate(templateToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={clearPatternsDialogOpen} onOpenChange={setClearPatternsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear All Pricing Patterns?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {pricingPatterns.length} learned pricing patterns. You'll need to re-import PDF quotes to rebuild them. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearPatternsMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-clear-patterns"
              >
                Clear All Patterns
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
