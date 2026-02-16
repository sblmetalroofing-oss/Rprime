import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { useLocation, useRoute } from "wouter";
import { MOCK_REPORTS, Report, Finding, Urgency } from "@/lib/store";

// Extended types for report editor with additional fields
interface ExtendedFinding extends Finding {
  photoUrls?: string[];
}

// Local EstimateItem for extended report (matches store.ts)
interface EstimateItemLocal {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  markup: number;
}

interface ExtendedReport extends Omit<Report, 'findings'> {
  findings: ExtendedFinding[];
  estimateItems?: EstimateItemLocal[];
  roofPitch?: string | null;
  storeys?: string | null;
  accessMethod?: string | null;
  weather?: string;
  themeId?: string | null;
}

interface LocalStorageReport extends ExtendedReport {
  themeId?: string;
}

// Type guard for checking if error has message property
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

// Type guard for QuotaExceededError
function isQuotaExceededError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'Unknown error';
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Save, 
  Camera, 
  Plus, 
  Trash2, 
  FileOutput,
  FileText, 
  CheckCircle, 
  Calculator,
  DollarSign,
  FileSpreadsheet,
  Zap,
  ChevronDown,
  Sparkles,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn, formatJobNumber } from "@/lib/utils";
import { getTodayInput, formatDateLong, formatTime24, formatDateTime } from "@/lib/date-utils";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logoUrl from "@assets/sbl-logo.png";
import { PhotoAnnotator } from "@/components/photo-annotator";
import { SignaturePad } from "@/components/signature-pad";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { CloudSun, Pen, Edit2, Mail, ImageIcon, Search, UserCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Customer } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PhotoDropZone, PhotoTransferData } from "@/hooks/use-photo-transfer.tsx";

// Mock data for dropdowns
const ROOF_TYPES = ["Colorbond", "Concrete Tile", "Terracotta Tile", "Slate", "Decromastic", "Trimdek", "Klip-Lok"];
const ROOF_PITCH = ["Flat (0-5°)", "Low (5-15°)", "Standard (15-25°)", "Steep (25-35°)", "Very Steep (>35°)"];
const FINDING_CATEGORIES = ["General Condition", "Leaks", "Rust/Corrosion", "Broken Tiles", "Ridge Capping", "Gutters", "Downpipes", "Flashing", "Penetrations", "Skylights", "Safety"];

const FINDING_TEMPLATES = [
  { category: "Broken Tiles", severity: "high", description: "Cracked/broken roof tiles observed", recommendation: "Replace damaged tiles to prevent water ingress" },
  { category: "Ridge Capping", severity: "medium", description: "Ridge capping mortar deteriorated and crumbling", recommendation: "Re-point ridge capping with flexible pointing compound" },
  { category: "Rust/Corrosion", severity: "medium", description: "Rust spots visible on metal roofing/flashing", recommendation: "Treat rust with rust converter and apply protective coating" },
  { category: "Gutters", severity: "medium", description: "Gutters blocked with debris and leaf matter", recommendation: "Clean gutters and install gutter guards" },
  { category: "Gutters", severity: "high", description: "Gutters rusted through with holes visible", recommendation: "Replace damaged gutter sections" },
  { category: "Flashing", severity: "high", description: "Flashing lifted/damaged around penetrations", recommendation: "Reseal or replace flashing with new lead/Colorbond" },
  { category: "Leaks", severity: "critical", description: "Active water leak observed during inspection", recommendation: "Urgent repair required - locate source and seal" },
  { category: "Downpipes", severity: "low", description: "Downpipe disconnected from stormwater drain", recommendation: "Reconnect downpipe to drainage system" },
  { category: "Penetrations", severity: "medium", description: "Deteriorated sealant around roof penetration", recommendation: "Reseal penetration with appropriate sealant" },
  { category: "Skylights", severity: "medium", description: "Skylight seal deteriorated, potential leak point", recommendation: "Reseal skylight perimeter with silicone" },
  { category: "General Condition", severity: "low", description: "Minor wear consistent with age of roof", recommendation: "Monitor condition, no immediate action required" },
  { category: "Safety", severity: "high", description: "No anchor points present for safe roof access", recommendation: "Install roof anchor points before future maintenance" },
];

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1632759929286-90c74945d817?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1596265371388-43edb10653d6?q=80&w=400&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1520114878144-6123749968dd?q=80&w=400&auto=format&fit=crop"
];

function SortableFindingCard({ 
  finding, 
  index, 
  updateFinding, 
  removeFinding, 
  addPhotoToFinding, 
  removePhotoFromFinding,
  onAnnotatePhoto,
  onAnalyzePhoto,
  analyzingPhotoIndex
}: { 
  finding: Finding & { photoUrls?: string[] }; 
  index: number;
  updateFinding: (id: string, field: keyof Finding, value: string) => void;
  removeFinding: (id: string) => void;
  addPhotoToFinding: (id: string, url: string) => void;
  removePhotoFromFinding: (id: string, index: number) => void;
  onAnnotatePhoto: (findingId: string, photoIndex: number, url: string) => void;
  onAnalyzePhoto: (findingId: string, photoIndex: number, url: string) => void;
  analyzingPhotoIndex: { findingId: string; photoIndex: number } | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: finding.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1
  };

  const [isUploading, setIsUploading] = useState(false);
  
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    const processFile = async (file: File): Promise<void> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const img = new Image();
          img.onload = async () => {
            const maxSize = 1200;
            let w = img.width, h = img.height;
            if (w > maxSize || h > maxSize) {
              if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
              else { w = Math.round(w * maxSize / h); h = maxSize; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.85);
            
            // Upload to cloud storage instead of storing base64
            const uploadedUrl = await api.uploadPhoto(compressed);
            if (uploadedUrl) {
              addPhotoToFinding(finding.id, uploadedUrl);
            } else {
              // Fallback to base64 if upload fails
              addPhotoToFinding(finding.id, compressed);
            }
            resolve();
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    };
    
    // Process files sequentially to avoid overwhelming the server
    for (const file of Array.from(files)) {
      await processFile(file);
    }
    
    setIsUploading(false);
    e.target.value = '';
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className="border-l-4 border-l-primary overflow-hidden card-hover"
    >
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
            <Badge variant="outline" className="bg-background">#{index + 1}</Badge>
            <Select 
              value={finding.category}
              onValueChange={(val) => updateFinding(finding.id, 'category', val)}
            >
              <SelectTrigger className="h-8 w-full sm:w-[180px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINDING_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={finding.severity}
              onValueChange={(val) => updateFinding(finding.id, 'severity', val)}
            >
              <SelectTrigger className={cn("h-8 w-[110px]", 
                finding.severity === 'critical' ? 'bg-destructive text-white border-destructive' :
                finding.severity === 'high' ? 'bg-orange-500 text-white border-orange-500' : 
                'bg-background'
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => removeFinding(finding.id)}>
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Description of Defect</Label>
            <Textarea 
              placeholder="Describe the issue found..." 
              value={finding.description}
              onChange={(e) => updateFinding(finding.id, 'description', e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label>Recommended Action</Label>
            <Textarea 
              placeholder="What needs to be done?" 
              value={finding.recommendation}
              onChange={(e) => updateFinding(finding.id, 'recommendation', e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <PhotoDropZone
          onPhotoReceived={(data: PhotoTransferData) => addPhotoToFinding(finding.id, data.url)}
          className="space-y-2 rounded-lg p-2 -m-2"
          activeClassName="ring-2 ring-primary ring-offset-2 bg-primary/10"
        >
          <Label>Photos ({(finding.photoUrls?.length || 0)}) <span className="text-xs text-muted-foreground font-normal ml-1">Drop photos here</span></Label>
          <div className="grid grid-cols-2 gap-2">
            {(finding.photoUrls || []).map((url: string, photoIndex: number) => {
              const isAnalyzing = analyzingPhotoIndex?.findingId === finding.id && analyzingPhotoIndex?.photoIndex === photoIndex;
              return (
                <div key={photoIndex} className="relative aspect-video bg-muted rounded-md overflow-hidden">
                  <img src={url} alt={`Photo ${photoIndex + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 right-1">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white border-0"
                      onClick={() => onAnalyzePhoto(finding.id, photoIndex, url)}
                      disabled={isAnalyzing}
                      data-testid={`button-analyze-photo-${finding.id}-${photoIndex}`}
                    >
                      {isAnalyzing ? (
                        <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analyzing...</>
                      ) : (
                        <><Sparkles className="h-3 w-3 mr-1" /> Analyze with AI</>
                      )}
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 flex items-center justify-center gap-2 p-1.5">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onAnnotatePhoto(finding.id, photoIndex, url)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" /> Annotate
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => removePhotoFromFinding(finding.id, photoIndex)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
            {isUploading ? (
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed border-primary/50 col-span-2">
                <div className="text-center p-2">
                  <Loader2 className="h-6 w-6 mx-auto text-primary mb-1 animate-spin" />
                  <p className="text-xs text-primary">Uploading...</p>
                </div>
              </div>
            ) : (
              <>
                <div 
                  className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed border-muted-foreground/30 transition-colors cursor-pointer relative"
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoCapture}
                    data-testid={`input-camera-photo-${finding.id}`}
                  />
                  <div className="text-center p-2">
                    <Camera className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Camera</p>
                  </div>
                </div>
                <div 
                  className="aspect-video bg-muted rounded-md flex items-center justify-center border-2 border-dashed border-muted-foreground/30 transition-colors cursor-pointer relative"
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handlePhotoCapture}
                    data-testid={`input-library-photo-${finding.id}`}
                  />
                  <div className="text-center p-2">
                    <ImageIcon className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">Library</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </PhotoDropZone>
      </CardContent>
    </Card>
  );
}

type EstimateItem = EstimateItemLocal;

export default function ReportEditor() {
  const [location, setLocation] = useLocation();
  const [, editParams] = useRoute("/report/:id");
  const [, viewParams] = useRoute("/view/report/:id");
  const params = editParams || viewParams;
  const isNew = params?.id === "new";
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState("details");
  
  const [annotatingPhoto, setAnnotatingPhoto] = useState<{ findingId: string; photoIndex: number; url: string } | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [showAddCustomerDialog, setShowAddCustomerDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', suburb: '' });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  
  const [analyzingPhotoIndex, setAnalyzingPhotoIndex] = useState<{ findingId: string; photoIndex: number } | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<api.PhotoAnalysisResult | null>(null);
  const [aiAnalysisDialogOpen, setAiAnalysisDialogOpen] = useState(false);
  const [currentAnalysisFindingId, setCurrentAnalysisFindingId] = useState<string | null>(null);
  
  // AI Report Analysis state
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [reportAnalysisResult, setReportAnalysisResult] = useState<api.ReportAnalysisResult | null>(null);
  const [reportAnalysisDialogOpen, setReportAnalysisDialogOpen] = useState(false);
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState<string | null>(null);
  const [aiSummaryDialogOpen, setAiSummaryDialogOpen] = useState(false);
  
  const { data: customers = [] } = useQuery({
    queryKey: ["customers", customerSearch],
    queryFn: () => api.fetchCustomers(customerSearch || undefined),
    enabled: customerPopoverOpen,
  });

  const { data: themes = [] } = useQuery<api.DocumentTheme[]>({
    queryKey: ["document-themes"],
    queryFn: () => api.fetchDocumentThemes(),
  });

  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const activeTheme = themes.find(t => t.id === selectedThemeId) || themes.find(t => t.isDefault === 'true') || null;

  const selectCustomer = (customer: Customer) => {
    setReport(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      address: customer.address || prev.address || '',
      suburb: customer.suburb || prev.suburb || '',
      contactPhone: customer.phone || prev.contactPhone || '',
    }));
    setCustomerPopoverOpen(false);
    setCustomerSearch("");
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Customer name is required" });
      return;
    }
    setIsCreatingCustomer(true);
    try {
      const customerData = {
        id: crypto.randomUUID(),
        organizationId: "",
        name: newCustomer.name,
        phone: newCustomer.phone || null,
        email: newCustomer.email || null,
        address: newCustomer.address || null,
        suburb: newCustomer.suburb || null,
      };
      const created = await api.createCustomer(customerData);
      if (created) {
        selectCustomer(created);
        setShowAddCustomerDialog(false);
        setNewCustomer({ name: '', phone: '', email: '', address: '', suburb: '' });
        toast({ title: "Success", description: `Customer "${created.name}" created and linked` });
      } else {
        throw new Error("Failed to create customer");
      }
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Error", description: getErrorMessage(error) });
    } finally {
      setIsCreatingCustomer(false);
    }
  };
  
  const [reportSettings, setReportSettings] = useState({
    showExecutiveSummary: true,
    showFindings: true,
    showMeasurements: true,
    showEstimate: true,
    showPhotos: true,
    termsAndConditions: "This report is based on a visual inspection only. Areas not accessible or visible at the time of inspection are excluded. This estimate is valid for 30 days from the date of issue. Payment terms: 50% deposit, balance on completion.",
    executiveSummaryTemplate: "Based on the visual inspection carried out today, the roof is in {condition} condition overall. {findings_count} items have been identified requiring attention.",
    footerText: "Generated by SBL Roofing App",
    quoteValidityDays: 30
  });
  
  // Form State
  const [report, setReport] = useState<Partial<ExtendedReport>>({
    id: isNew ? `JOB-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}` : '',
    status: 'draft',
    date: getTodayInput(),
    findings: [],
    roofType: '',
    totalEstimates: 0,
    measurements: {},
    estimateItems: [
      { id: '1', description: 'Replace broken tiles', qty: 10, unitCost: 15, markup: 20 },
      { id: '2', description: 'Re-point ridge capping', qty: 15, unitCost: 45, markup: 20 },
      { id: '3', description: 'Labour (Hours)', qty: 4, unitCost: 85, markup: 0 },
    ]
  });

  // Load report settings from localStorage
  useEffect(() => {
    const savedReportSettings = localStorage.getItem('sbl_report_settings');
    if (savedReportSettings) {
      try {
        const settings = JSON.parse(savedReportSettings);
        setReportSettings(prev => ({ ...prev, ...settings }));
      } catch {
        localStorage.removeItem('sbl_report_settings');
      }
    }
  }, []);

  // Load existing data if not new, and load default inspector from settings
  // Also load job/customer details if jobId is provided
  useEffect(() => {
    if (!isNew && params?.id) {
      loadReport(params.id);
    } else if (isNew) {
      // Check for jobId in URL query params and load job/customer details
      const urlParams = new URLSearchParams(window.location.search);
      const jobId = urlParams.get('jobId');
      if (jobId) {
        loadJobDetails(jobId);
      } else {
        // Redirect to jobs page if no jobId provided - reports must be created from a job
        setLocation('/jobs');
        return;
      }
    }
  }, [isNew, params?.id, setLocation]);

  // Load job and customer details when creating a report from a job
  const loadJobDetails = async (jobId: string) => {
    try {
      const jobData = await api.fetchJobWithDocuments(jobId);
      if (jobData?.job) {
        const job = jobData.job;
        
        // Fetch customer details if job has a customer
        if (job.customerId) {
          const customers = await api.fetchCustomers();
          const customer = customers.find(c => c.id === job.customerId);
          if (customer) {
            setReport(prev => ({
              ...prev,
              jobId: job.id,
              customerId: customer.id,
              customerName: customer.name,
              address: job.address || customer.address || '',
              suburb: job.suburb || customer.suburb || '',
              contactPhone: customer.phone || '',
            }));
            return;
          }
        }
        // If no customer, just set job address
        setReport(prev => ({
          ...prev,
          jobId: job.id,
          address: job.address || '',
          suburb: job.suburb || '',
        }));
      }
    } catch (err) {
      console.error('Failed to load job details:', err);
    }
  };

  const loadReport = async (id: string) => {
    const dbReport = await api.fetchReport(id) as (Report & { themeId?: string }) | null;
    
    if (dbReport) {
      setReportExistsInDb(true);
      setReport(prev => ({
        ...prev,
        ...dbReport,
        findings: dbReport.findings || [],
        estimateItems: dbReport.estimateItems || prev.estimateItems || []
      }));
      if (dbReport.themeId) {
        setSelectedThemeId(dbReport.themeId);
      }
    } else {
      setReportExistsInDb(false);
      const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || '[]');
      const existing = savedReports.find((r: LocalStorageReport) => r.id === id) || MOCK_REPORTS.find(r => r.id === id);
      
      if (existing) {
        setReport(prev => ({
          ...prev,
          ...existing,
          estimateItems: existing.estimateItems || prev.estimateItems || []
        }));
        if (existing.themeId) {
          setSelectedThemeId(existing.themeId);
        }
      }
    }
  };

  const [reportExistsInDb, setReportExistsInDb] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save when report changes (debounced)
  useEffect(() => {
    if (!report.id || isNew) return;
    
    setHasUnsavedChanges(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [report.customerName, report.address, report.suburb, report.date, report.roofType, report.roofPitch, report.storeys, report.accessMethod, report.findings, report.estimateItems, report.measurements, report.contactPhone, report.customerId, selectedThemeId]);

  const autoSave = async () => {
    if (!report.id) return;
    
    setIsSaving(true);
    try {
      const reportToSave = { 
        ...report, 
        id: report.id,
        customerId: report.customerId || null,
        customerName: report.customerName || '',
        contactPhone: report.contactPhone || null,
        address: report.address || '',
        suburb: report.suburb || '',
        date: report.date || getTodayInput(),
        inspector: '',
        roofType: report.roofType || '',
        roofPitch: report.roofPitch || null,
        storeys: report.storeys || null,
        accessMethod: report.accessMethod || null,
        status: report.status || 'draft',
        totalEstimates: grandTotal,
        findings: report.findings || [],
        themeId: selectedThemeId || activeTheme?.id || null,
      };

      const saved = reportExistsInDb 
        ? await api.updateReport(reportToSave.id, reportToSave)
        : await api.createReport(reportToSave);
      
      if (saved) {
        setReportExistsInDb(true);
        
        // Also save all findings (including photo URLs) during auto-save
        for (const finding of (report.findings || [])) {
          try {
            const updated = await api.updateFinding(finding.id, finding);
            if (!updated) {
              // Finding doesn't exist yet, create it
              await api.createFinding(saved.id, finding);
            }
          } catch (err) {
            // Try creating if update failed
            try {
              await api.createFinding(saved.id, finding);
            } catch (createErr) {
              console.error('Auto-save finding error:', createErr);
            }
          }
        }
        
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } else {
        const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || '[]');
        const index = savedReports.findIndex((r: LocalStorageReport) => r.id === reportToSave.id);
        if (index >= 0) {
          savedReports[index] = reportToSave;
        } else {
          savedReports.push(reportToSave);
        }
        localStorage.setItem('sbl_reports', JSON.stringify(savedReports));
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      }
    } catch (e) {
      console.error('Auto-save error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const reportToSave = { 
        ...report, 
        id: report.id || `JOB-${Date.now()}`,
        customerId: report.customerId || null,
        customerName: report.customerName || '',
        contactPhone: report.contactPhone || null,
        address: report.address || '',
        suburb: report.suburb || '',
        date: report.date || getTodayInput(),
        inspector: '',
        roofType: report.roofType || '',
        roofPitch: report.roofPitch || null,
        storeys: report.storeys || null,
        accessMethod: report.accessMethod || null,
        totalEstimates: report.totalEstimates || 0,
        themeId: selectedThemeId || activeTheme?.id || null,
        findings: report.findings || [],
        status: report.status || 'draft' as const,
      };
      
      let saved;
      if (isNew || !reportExistsInDb) {
        saved = await api.createReport(reportToSave as Omit<Report, 'createdAt' | 'updatedAt'>);
        if (saved) setReportExistsInDb(true);
      } else {
        saved = await api.updateReport(reportToSave.id!, reportToSave);
      }

      if (saved) {
        // Save all findings (create new ones or update existing ones)
        const savedFindings = [];
        for (const finding of (report.findings || [])) {
          try {
            // Try to update first, if it fails (finding doesn't exist), create it
            const updated = await api.updateFinding(finding.id, finding);
            if (updated) {
              savedFindings.push(updated);
            } else {
              // Finding doesn't exist, create it
              const created = await api.createFinding(saved.id, finding);
              if (created) savedFindings.push(created);
            }
          } catch (err) {
            console.error('Error saving finding:', err);
            // Try creating if update failed
            try {
              const created = await api.createFinding(saved.id, finding);
              if (created) savedFindings.push(created);
            } catch (createErr) {
              console.error('Error creating finding:', createErr);
            }
          }
        }
        
        toast({
          title: "Success",
          description: "Report saved to database!",
        });
        const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || '[]');
        const index = savedReports.findIndex((r: LocalStorageReport) => r.id === saved.id);
        if (index >= 0) {
          savedReports[index] = { ...saved, findings: report.findings, estimateItems: report.estimateItems };
        } else {
          savedReports.push({ ...saved, findings: report.findings, estimateItems: report.estimateItems });
        }
        localStorage.setItem('sbl_reports', JSON.stringify(savedReports));
        if (isNew) setLocation(`/report/${saved.id}`);
      } else {
        const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || JSON.stringify(MOCK_REPORTS));
        const index = savedReports.findIndex((r: LocalStorageReport) => r.id === reportToSave.id);
        
        if (index >= 0) {
          savedReports[index] = reportToSave;
        } else {
          savedReports.push(reportToSave);
        }
        
        localStorage.setItem('sbl_reports', JSON.stringify(savedReports));
        toast({
          title: "Saved Offline",
          description: "Report saved locally (offline mode).",
        });
        if (isNew) setLocation(`/report/${reportToSave.id}`);
      }
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        toast({
          variant: "destructive",
          title: "Storage Limit",
          description: "Storage limit reached (photos are large). Try removing some photos.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error saving report: " + getErrorMessage(e),
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const finalReport = { ...report, status: 'submitted' as const };
      
      const saved = await api.updateReport(finalReport.id!, finalReport);
      
      if (saved) {
        toast({
          title: "Success",
          description: "Report submitted successfully!",
        });
        setLocation("/");
      } else {
        const savedReports = JSON.parse(localStorage.getItem('sbl_reports') || JSON.stringify(MOCK_REPORTS));
        const index = savedReports.findIndex((r: LocalStorageReport) => r.id === finalReport.id);
        
        if (index >= 0) {
          savedReports[index] = finalReport;
        } else {
          savedReports.push(finalReport);
        }
        
        localStorage.setItem('sbl_reports', JSON.stringify(savedReports));
        toast({
          title: "Saved Offline",
          description: "Report submitted locally (offline mode).",
        });
        setLocation("/");
      }
    } catch (e: unknown) {
      if (isQuotaExceededError(e)) {
        toast({
          variant: "destructive",
          title: "Storage Limit",
          description: "Storage limit reached. Try removing some photos before submitting.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error submitting report: " + getErrorMessage(e),
        });
      }
    }
  };

  const addFinding = () => {
    const newFinding: Finding & { photoUrls?: string[] } = {
      id: Math.random().toString(36).substr(2, 9),
      category: 'General Condition',
      severity: 'low',
      description: '',
      recommendation: '',
      photoUrl: undefined,
      photoUrls: []
    };
    setReport(prev => ({ ...prev, findings: [...(prev.findings || []), newFinding] }));
  };

  const addFindingFromTemplate = (template: typeof FINDING_TEMPLATES[0]) => {
    const newFinding: Finding & { photoUrls?: string[] } = {
      id: Math.random().toString(36).substr(2, 9),
      category: template.category,
      severity: template.severity as 'low' | 'medium' | 'high' | 'critical',
      description: template.description,
      recommendation: template.recommendation,
      photoUrl: undefined,
      photoUrls: []
    };
    setReport(prev => ({ ...prev, findings: [...(prev.findings || []), newFinding] }));
    toast({ title: "Template Added", description: `Added "${template.category}" finding` });
  };

  const exportEstimateToCSV = () => {
    const headers = ["Description", "Quantity", "Unit Cost", "Markup %", "Total"];
    const rows = report.estimateItems?.map(item => [
      item.description,
      item.qty.toString(),
      item.unitCost.toFixed(2),
      item.markup.toString(),
      calculateRowTotal(item).toFixed(2)
    ]) || [];
    
    rows.push(["", "", "", "Subtotal", totalEstimate.toFixed(2)]);
    rows.push(["", "", "", "GST (10%)", totalGST.toFixed(2)]);
    rows.push(["", "", "", "TOTAL", grandTotal.toFixed(2)]);
    
    const csvContent = [
      `Estimate for: ${report.customerName || 'Customer'}`,
      `Job: ${report.id}`,
      `Date: ${report.date}`,
      "",
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estimate-${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Estimate downloaded as CSV" });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleAnnotatePhoto = (findingId: string, photoIndex: number, url: string) => {
    setAnnotatingPhoto({ findingId, photoIndex, url });
  };

  const handleSaveAnnotatedPhoto = (annotatedUrl: string) => {
    if (!annotatingPhoto) return;
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.map(f => {
        if (f.id === annotatingPhoto.findingId) {
          const currentPhotos = [...(f.photoUrls || [])];
          currentPhotos[annotatingPhoto.photoIndex] = annotatedUrl;
          return { ...f, photoUrls: currentPhotos };
        }
        return f;
      })
    }));
    setAnnotatingPhoto(null);
    toast({ title: "Photo Annotated", description: "Annotations saved to photo" });
  };

  const handleAnalyzePhoto = async (findingId: string, photoIndex: number, photoUrl: string) => {
    setAnalyzingPhotoIndex({ findingId, photoIndex });
    setCurrentAnalysisFindingId(findingId);
    try {
      const finding = report.findings?.find(f => f.id === findingId);
      const context = finding?.description?.trim() 
        ? `Inspector notes: ${finding.description}${finding.recommendation ? `. Recommended action: ${finding.recommendation}` : ''}`
        : undefined;
      
      // Send ALL photos from this finding for better context analysis
      const allPhotoUrls = finding?.photoUrls || [photoUrl];
      const result = await api.analyzePhoto(allPhotoUrls, context);
      setAiAnalysisResult(result);
      setAiAnalysisDialogOpen(true);
      const photoCount = allPhotoUrls.length;
      toast({ 
        title: "Analysis Complete", 
        description: photoCount > 1 
          ? `AI analyzed ${photoCount} photos together for better context` 
          : "AI has analyzed the photo" 
      });
    } catch (error: unknown) {
      toast({ 
        variant: "destructive", 
        title: "Analysis Failed", 
        description: getErrorMessage(error) || "Failed to analyze photo with AI" 
      });
    } finally {
      setAnalyzingPhotoIndex(null);
    }
  };

  const handleApplyAiSuggestions = () => {
    if (!aiAnalysisResult || !currentAnalysisFindingId) return;
    
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.map(f => {
        if (f.id === currentAnalysisFindingId) {
          return {
            ...f,
            category: aiAnalysisResult.category,
            severity: aiAnalysisResult.severity as 'low' | 'medium' | 'high' | 'critical',
            description: aiAnalysisResult.description,
            recommendation: aiAnalysisResult.recommendation
          };
        }
        return f;
      })
    }));
    
    setAiAnalysisDialogOpen(false);
    setAiAnalysisResult(null);
    setCurrentAnalysisFindingId(null);
    toast({ title: "Suggestions Applied", description: "Finding has been updated with AI suggestions" });
  };

  const handleDismissAiSuggestions = () => {
    setAiAnalysisDialogOpen(false);
    setAiAnalysisResult(null);
    setCurrentAnalysisFindingId(null);
  };

  const handleAnalyzeReport = async () => {
    if (!report.findings || report.findings.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "No Findings", 
        description: "Add some findings first before getting AI suggestions" 
      });
      return;
    }
    
    setIsAnalyzingReport(true);
    try {
      const input: api.ReportAnalysisInput = {
        findings: report.findings.map(f => ({
          category: f.category || '',
          severity: f.severity || '',
          description: f.description || '',
          recommendation: f.recommendation || ''
        })),
        estimateItems: report.estimateItems?.map(e => ({
          description: e.description || '',
          qty: e.qty || 0,
          unitCost: e.unitCost || 0
        })),
        roofType: report.roofType || undefined,
        roofPitch: undefined,
        reportStatus: report.status || 'draft'
      };
      
      const result = await api.analyzeReport(input);
      setReportAnalysisResult(result);
      setReportAnalysisDialogOpen(true);
      toast({ title: "Analysis Complete", description: "AI has reviewed your report" });
    } catch (error: unknown) {
      toast({ 
        variant: "destructive", 
        title: "Analysis Failed", 
        description: getErrorMessage(error) || "Failed to analyze report with AI" 
      });
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!report.findings || report.findings.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "No Findings", 
        description: "Add some findings first before generating a summary" 
      });
      return;
    }
    
    setIsGeneratingSummary(true);
    try {
      const input: api.ReportSummaryInput = {
        findings: report.findings.map(f => ({
          category: f.category || '',
          severity: f.severity || '',
          description: f.description || '',
          recommendation: f.recommendation || ''
        })),
        estimateItems: report.estimateItems?.map(e => ({
          description: e.description || '',
          qty: e.qty || 0,
          unitCost: e.unitCost || 0
        })),
        roofType: report.roofType || undefined,
        roofPitch: report.roofPitch || undefined,
        storeys: report.storeys || undefined,
        accessMethod: report.accessMethod || undefined,
        customerName: report.customerName || undefined,
        address: report.address || undefined,
        date: report.date || undefined,
        inspector: report.inspector || undefined
      };
      
      const result = await api.summarizeReport(input);
      setAiSummaryResult(result.summary);
      setAiSummaryDialogOpen(true);
      toast({ title: "Summary Generated", description: "AI has written your executive summary" });
    } catch (error: unknown) {
      toast({ 
        variant: "destructive", 
        title: "Summary Failed", 
        description: getErrorMessage(error) || "Failed to generate summary with AI" 
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const sendEmail = () => {
    setIsEmailDialogOpen(true);
  };

  const fetchWeather = async () => {
    setIsLoadingWeather(true);
    try {
      if (!navigator.geolocation) {
        toast({ variant: "destructive", title: "Error", description: "Geolocation not supported" });
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m`
            );
            const data = await response.json();
            
            const weatherCodes: Record<number, string> = {
              0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
              45: "Foggy", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
              55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
              71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 80: "Slight rain showers",
              81: "Moderate rain showers", 82: "Violent rain showers", 95: "Thunderstorm"
            };
            
            const temp = data.current?.temperature_2m;
            const code = data.current?.weather_code;
            const wind = data.current?.wind_speed_10m;
            const condition = weatherCodes[code] || "Unknown";
            
            const weatherString = `${condition}, ${temp}°C, Wind ${wind} km/h`;
            setReport(prev => ({ ...prev, weather: weatherString }));
            toast({ title: "Weather Updated", description: weatherString });
          } catch {
            toast({ variant: "destructive", title: "Error", description: "Failed to fetch weather data" });
          }
          setIsLoadingWeather(false);
        },
        () => {
          toast({ variant: "destructive", title: "Error", description: "Location access denied" });
          setIsLoadingWeather(false);
        }
      );
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Weather fetch failed" });
      setIsLoadingWeather(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReport(prev => {
        const oldIndex = prev.findings?.findIndex(f => f.id === active.id) ?? -1;
        const newIndex = prev.findings?.findIndex(f => f.id === over.id) ?? -1;
        if (oldIndex >= 0 && newIndex >= 0) {
          return { ...prev, findings: arrayMove(prev.findings || [], oldIndex, newIndex) };
        }
        return prev;
      });
    }
  };

  const addPhotoToFinding = (findingId: string, photoUrl: string) => {
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.map(f => {
        if (f.id === findingId) {
          const currentPhotos = f.photoUrls || [];
          return { ...f, photoUrls: [...currentPhotos, photoUrl], photoUrl: photoUrl };
        }
        return f;
      })
    }));
  };

  const removePhotoFromFinding = (findingId: string, photoIndex: number) => {
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.map(f => {
        if (f.id === findingId) {
          const currentPhotos = [...(f.photoUrls || [])];
          currentPhotos.splice(photoIndex, 1);
          return { ...f, photoUrls: currentPhotos, photoUrl: currentPhotos[0] || undefined };
        }
        return f;
      })
    }));
  };

  const updateFinding = (id: string, field: keyof Finding, value: string) => {
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.map(f => f.id === id ? { ...f, [field]: value } : f)
    }));
  };

  const removeFinding = (id: string) => {
    setReport(prev => ({
      ...prev,
      findings: prev.findings?.filter(f => f.id !== id)
    }));
  };

  const updateMeasurement = (key: string, value: string) => {
    setReport(prev => ({
      ...prev,
      measurements: { ...prev.measurements, [key]: value }
    }));
  };

  // Estimate Calculations
  const calculateRowTotal = (item: EstimateItem) => {
    const cost = item.qty * item.unitCost;
    return cost * (1 + item.markup / 100);
  };

  const updateEstimateItem = (id: string, field: keyof EstimateItem, value: string | number) => {
    setReport(prev => ({
      ...prev,
      estimateItems: prev.estimateItems?.map(item => 
        item.id === id ? { ...item, [field]: typeof value === 'string' ? parseFloat(value) || 0 : value } : item
      )
    }));
  };

  const totalEstimate = report.estimateItems?.reduce((sum, item) => sum + calculateRowTotal(item), 0) || 0;
  const totalGST = totalEstimate * 0.1;
  const grandTotal = totalEstimate + totalGST;

  const handleAutoCalculate = () => {
    const newItems: EstimateItem[] = [];
    
    // Generate items from findings
    report.findings?.forEach((f, i) => {
      let item: EstimateItem = {
        id: `auto-${i}-${Date.now()}`,
        description: `Rectify: ${f.category} - ${f.description || 'Issue'}`,
        qty: 1,
        unitCost: 0,
        markup: 20
      };

      // Simple heuristic for pricing
      switch (f.category) {
        case 'Broken Tiles':
          item.description = "Supply and install replacement roof tiles";
          item.qty = 10; // Default assumption
          item.unitCost = 15;
          break;
        case 'Ridge Capping':
          item.description = "Re-bed and point ridge capping";
          item.qty = 10; // Linear meters assumption
          item.unitCost = 45;
          break;
        case 'Gutters':
          item.description = "Clean and seal gutters / replace section";
          item.qty = 1;
          item.unitCost = 150;
          break;
        case 'Leaks':
          item.description = "Leak investigation and repair (allowance)";
          item.qty = 1;
          item.unitCost = 350;
          break;
        case 'Rust/Corrosion':
          item.description = "Treat rust and seal / sheet replacement";
          item.qty = 1;
          item.unitCost = 200;
          break;
        default:
          item.unitCost = 100; // Generic minor repair
      }
      
      // Adjust for severity
      if (f.severity === 'high') item.unitCost *= 1.5;
      if (f.severity === 'critical') item.unitCost *= 2.0;

      newItems.push(item);
    });

    // Add Labour if not present
    newItems.push({
      id: `labour-${Date.now()}`,
      description: "Estimated Labour Component",
      qty: 8, // 1 day default
      unitCost: 85,
      markup: 0
    });

    setReport(prev => ({
      ...prev,
      estimateItems: newItems
    }));

    toast({
      title: "Estimate Generated",
      description: `Added ${newItems.length} line items based on findings.`,
    });
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pdfWidth - (margin * 2);
      const usableHeight = pdfHeight - (margin * 2);
      
      let currentY = margin;

      const addSectionToPDF = async (elementId: string): Promise<number> => {
        const element = document.getElementById(elementId);
        if (!element) return 0;

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const widthRatio = usableWidth / imgWidth;
        const scaledHeight = imgHeight * widthRatio;

        if (currentY + scaledHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, 'JPEG', margin, currentY, usableWidth, scaledHeight);
        currentY += scaledHeight;
        
        return scaledHeight;
      };

      await addSectionToPDF('pdf-header');
      await addSectionToPDF('pdf-client-info');
      await addSectionToPDF('pdf-summary');
      
      // Handle findings section - either with findings or "no findings" message
      const findingsHeader = document.getElementById('pdf-findings-header');
      const findingElements = Array.from(document.querySelectorAll('[id^="pdf-finding-"]'));
      const noFindingsBlock = document.getElementById('pdf-no-findings');
      
      if (findingsHeader && findingElements.length > 0) {
        // Calculate header height
        const headerCanvas = await html2canvas(findingsHeader, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        const headerWidthRatio = usableWidth / headerCanvas.width;
        const headerScaledHeight = headerCanvas.height * headerWidthRatio;
        
        // Calculate first finding height to ensure they stay together
        const firstFindingCanvas = await html2canvas(findingElements[0] as HTMLElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false
        });
        const firstFindingWidthRatio = usableWidth / firstFindingCanvas.width;
        const firstFindingScaledHeight = firstFindingCanvas.height * firstFindingWidthRatio;
        
        // Check if header + first finding will fit together
        const remainingSpace = pdfHeight - margin - currentY;
        if (headerScaledHeight + firstFindingScaledHeight > remainingSpace) {
          pdf.addPage();
          currentY = margin;
        }
        
        // Add header
        const headerImgData = headerCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(headerImgData, 'JPEG', margin, currentY, usableWidth, headerScaledHeight);
        currentY += headerScaledHeight;
        
        // Add first finding (already calculated)
        const firstFindingImgData = firstFindingCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(firstFindingImgData, 'JPEG', margin, currentY, usableWidth, firstFindingScaledHeight);
        currentY += firstFindingScaledHeight;
        
        // Add remaining findings
        for (let i = 1; i < findingElements.length; i++) {
          const canvas = await html2canvas(findingElements[i] as HTMLElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const widthRatio = usableWidth / imgWidth;
          const scaledHeight = imgHeight * widthRatio;

          // Check if finding fits on current page
          const remainingSpace = pdfHeight - margin - currentY;
          if (scaledHeight > remainingSpace || remainingSpace < 25) {
            pdf.addPage();
            currentY = margin;
          }

          pdf.addImage(imgData, 'JPEG', margin, currentY, usableWidth, scaledHeight);
          currentY += scaledHeight;
        }
      } else if (noFindingsBlock) {
        // Add no-findings message
        await addSectionToPDF('pdf-no-findings');
      }

      if (grandTotal > 0) {
        await addSectionToPDF('pdf-estimate');
      }

      await addSectionToPDF('pdf-footer');
      
      const fileName = `${report.id || 'report'}_${getTodayInput()}.pdf`;
      
      pdf.save(fileName);

      toast({
        title: "Success",
        description: `PDF "${fileName}" downloaded!`,
      });
    } catch (error: unknown) {
      console.error('PDF generation error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: getErrorMessage(error) || "Failed to generate PDF. Please try again.",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Layout>
      {/* Breadcrumb Navigation */}
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          {report.jobId ? (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/jobs" data-testid="breadcrumb-jobs">Jobs</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/jobs/${report.jobId}`} data-testid="breadcrumb-job">#{report.jobId.slice(-8).toUpperCase()}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          ) : (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/reports" data-testid="breadcrumb-reports">Reports</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">
              {isNew ? "New Inspection" : report.id}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      {/* Header Toolbar - Mobile Optimized */}
      <div className="flex flex-col gap-3 mb-6 sticky top-0 bg-background/95 backdrop-blur-xl z-20 py-3 md:py-6 border-b transition-all duration-300 w-full max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => report.jobId ? setLocation(`/jobs/${report.jobId}`) : setLocation("/reports")} 
              className="h-11 w-11 shrink-0" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-3xl font-heading font-extrabold text-primary tracking-tight truncate">
                  {isNew ? "New Inspection" : report.id}
                </h1>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 px-2 py-0.5 text-xs font-bold tracking-widest uppercase shrink-0">{report.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground font-medium opacity-70 truncate">
              {report.customerName || "Untitled Job"} • {report.date}
            </p>
            </div>
          </div>
          
          {!isNew && (
            <div className="hidden lg:flex items-center text-xs text-muted-foreground shrink-0">
              {isSaving ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="animate-pulse">●</span> Saving...
                </span>
              ) : lastSaved ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" /> Saved {formatTime24(lastSaved)}
                </span>
              ) : hasUnsavedChanges ? (
                <span className="text-amber-600">Unsaved changes</span>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-2">
            <Select value={selectedThemeId || ''} onValueChange={setSelectedThemeId}>
              <SelectTrigger className="w-full sm:w-[180px] h-11">
                <SelectValue placeholder="Select Theme" />
              </SelectTrigger>
              <SelectContent>
                {themes.filter(t => t.isArchived !== 'true').map(theme => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name} {theme.isDefault === 'true' && '(Default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleSave} disabled={isSaving} className="h-11 min-h-[44px] border-primary/10 bg-primary/[0.02] hover:bg-primary/5 rounded-xl font-bold text-sm">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleAnalyzeReport}
              disabled={isAnalyzingReport}
              className="h-11 min-h-[44px] border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-sm"
              data-testid="button-ai-suggestions"
            >
              {isAnalyzingReport ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> AI Tips</>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="h-11 min-h-[44px] border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-sm"
              data-testid="button-ai-summary"
            >
              {isGeneratingSummary ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><FileText className="mr-2 h-4 w-4" /> AI Summary</>
              )}
            </Button>
            <Button className="h-11 min-h-[44px] shadow-xl shadow-primary/20 rounded-xl font-bold bg-primary text-sm" onClick={handleSubmit}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Submit
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
        <TabsList className="bg-card border w-full justify-start h-auto p-1 overflow-x-auto flex-nowrap scrollbar-hide">
          <TabsTrigger value="details" className="min-w-[60px] sm:min-w-[90px] h-10 min-h-[40px] text-xs md:text-sm px-2 sm:px-3">Site Info</TabsTrigger>
          <TabsTrigger value="findings" className="min-w-[60px] sm:min-w-[90px] h-10 min-h-[40px] text-xs md:text-sm px-2 sm:px-3">Findings ({report.findings?.length || 0})</TabsTrigger>
          <TabsTrigger value="measurements" className="min-w-[70px] sm:min-w-[100px] h-10 min-h-[40px] text-xs md:text-sm px-2 sm:px-3">Measurements</TabsTrigger>
          <TabsTrigger value="estimate" className="min-w-[60px] sm:min-w-[80px] h-10 min-h-[40px] text-xs md:text-sm px-2 sm:px-3">Estimate</TabsTrigger>
          <TabsTrigger value="preview" className="min-w-[60px] sm:min-w-[90px] h-10 min-h-[40px] text-xs md:text-sm px-2 sm:px-3">Preview PDF</TabsTrigger>
        </TabsList>

        {/* --- TAB: SITE DETAILS --- */}
        <TabsContent value="details" className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl">Customer & Site Information</CardTitle>
              <CardDescription className="text-sm">Enter the client's contact details and site location.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 md:gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Customer Name</Label>
                <div className="flex gap-2">
                  <Input 
                    value={report.customerName || ''} 
                    onChange={(e) => setReport({...report, customerName: e.target.value})}
                    placeholder="e.g. Alice Johnson"
                    className="flex-1 h-11 min-h-[44px] text-base"
                    data-testid="input-customer-name"
                  />
                  <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        title="Select from CRM"
                        className="h-11 min-h-[44px] w-11 min-w-[44px] p-0"
                        data-testid="button-customer-lookup"
                      >
                        <UserCircle className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="end">
                      <Command>
                        <CommandInput 
                          placeholder="Search customers..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                          className="h-11"
                        />
                        <div className="border-b px-2 py-2">
                          <Button 
                            size="sm"
                            variant="outline"
                            className="w-full h-10 justify-start text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => {
                              setCustomerPopoverOpen(false);
                              setShowAddCustomerDialog(true);
                            }}
                            data-testid="button-add-customer"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Customer
                          </Button>
                        </div>
                        <CommandList className="max-h-[250px]">
                          <CommandEmpty>
                            <p className="py-4 text-center text-sm text-muted-foreground">No customers found</p>
                          </CommandEmpty>
                          <CommandGroup heading="Customers">
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.name}
                                onSelect={() => selectCustomer(customer)}
                                className="py-3"
                                data-testid={`select-customer-${customer.id}`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{customer.name}</span>
                                  {customer.address && (
                                    <span className="text-xs text-muted-foreground truncate">{customer.address}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Contact Phone</Label>
                <Input 
                  value={report.contactPhone || ''} 
                  onChange={(e) => setReport({...report, contactPhone: e.target.value})}
                  placeholder="0400 000 000"
                  className="h-11 min-h-[44px] text-base"
                  data-testid="input-contact-phone"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Site Address</Label>
                <AddressAutocomplete
                  value={report.address || ''}
                  onChange={(value) => setReport({...report, address: value})}
                  onPlaceSelect={(components) => {
                    setReport(prev => ({
                      ...prev,
                      suburb: components.suburb || prev.suburb,
                    }));
                  }}
                  placeholder="Start typing an address..."
                  className="h-11 min-h-[44px] text-base"
                  data-testid="input-site-address"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Inspection Date</Label>
                <Input type="date" value={report.date} onChange={(e) => setReport({...report, date: e.target.value})} className="h-11 min-h-[44px] text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Weather Conditions</Label>
                <div className="flex gap-2">
                  <Input 
                    value={report.weather || ''} 
                    onChange={(e) => setReport({...report, weather: e.target.value})}
                    placeholder="e.g. Clear sky, 22°C" 
                    className="flex-1 h-11 min-h-[44px] text-base"
                  />
                  <Button 
                    variant="outline" 
                    onClick={fetchWeather}
                    disabled={isLoadingWeather}
                    title="Auto-fetch weather"
                    className="h-11 min-h-[44px] w-11 min-w-[44px] p-0"
                    data-testid="button-fetch-weather"
                  >
                    <CloudSun className={cn("h-5 w-5", isLoadingWeather && "animate-spin")} />
                  </Button>
                </div>
              </div>
              {/* Save as Customer prompt - shows when manual entry without linked customer */}
              {report.customerName && !report.customerId && (
                <div className="md:col-span-2 bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Save to CRM?</p>
                    <p className="text-xs text-muted-foreground">Save these details as a customer for future jobs</p>
                  </div>
                  <Button 
                    size="sm"
                    className="h-10 min-h-[40px] shrink-0"
                    onClick={() => {
                      setNewCustomer({
                        name: report.customerName || '',
                        phone: report.contactPhone || '',
                        email: '',
                        address: report.address || '',
                        suburb: report.suburb || ''
                      });
                      setShowAddCustomerDialog(true);
                    }}
                    data-testid="button-save-as-customer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Save as Customer
                  </Button>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">Client Signature</Label>
                <div className="flex items-center gap-4">
                  {clientSignature ? (
                    <div className="flex items-center gap-4">
                      <div className="border rounded-lg p-2 bg-white">
                        <img src={clientSignature} alt="Client signature" className="h-16 w-auto" />
                      </div>
                      <Button variant="outline" className="h-11 min-h-[44px] px-4" onClick={() => setShowSignaturePad(true)}>
                        <Edit2 className="h-4 w-4 mr-2" /> Re-sign
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="h-11 min-h-[44px] px-4" onClick={() => setShowSignaturePad(true)} data-testid="button-signature">
                      <Pen className="h-4 w-4 mr-2" /> Capture Signature
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-lg md:text-xl">Roof Specifications</CardTitle>
              <CardDescription className="text-sm">Physical characteristics of the roof structure.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 md:gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Roof Material Type</Label>
                <Select 
                  value={report.roofType} 
                  onValueChange={(val) => setReport({...report, roofType: val})}
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-base">
                    <SelectValue placeholder="Select Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOF_TYPES.map(t => <SelectItem key={t} value={t} className="h-11 min-h-[44px]">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Pitch</Label>
                <Select 
                  value={report.roofPitch || ''} 
                  onValueChange={(val) => setReport({...report, roofPitch: val})}
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-base">
                    <SelectValue placeholder="Select Pitch" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOF_PITCH.map(p => <SelectItem key={p} value={p} className="h-11 min-h-[44px]">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Storeys</Label>
                <Select 
                  value={report.storeys || ''} 
                  onValueChange={(val) => setReport({...report, storeys: val})}
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-base">
                    <SelectValue placeholder="Select Height" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1" className="h-11 min-h-[44px]">Single Storey</SelectItem>
                    <SelectItem value="2" className="h-11 min-h-[44px]">Double Storey</SelectItem>
                    <SelectItem value="3+" className="h-11 min-h-[44px]">3+ Storeys</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Access Method</Label>
                <Select 
                  value={report.accessMethod || ''} 
                  onValueChange={(val) => setReport({...report, accessMethod: val})}
                >
                  <SelectTrigger className="h-11 min-h-[44px] text-base">
                    <SelectValue placeholder="Access Used" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ladder">Extension Ladder</SelectItem>
                    <SelectItem value="internal">Internal Manhole</SelectItem>
                    <SelectItem value="scaffold">Scaffold</SelectItem>
                    <SelectItem value="harness">Safety Harness Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB: FINDINGS --- */}
        <TabsContent value="findings" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-heading font-bold">Inspection Findings</h2>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-quick-templates">
                    <Zap className="mr-2 h-4 w-4" />
                    Quick Templates
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-y-auto">
                  <DropdownMenuLabel>Common Issues</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {FINDING_TEMPLATES.map((template, i) => (
                    <DropdownMenuItem
                      key={i}
                      onClick={() => addFindingFromTemplate(template)}
                      className="flex flex-col items-start py-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant={template.severity === 'critical' ? 'destructive' : template.severity === 'high' ? 'default' : 'secondary'} className="text-[10px]">
                          {template.severity}
                        </Badge>
                        <span className="font-medium">{template.category}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 line-clamp-1">{template.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={addFinding} data-testid="button-add-finding">
                <Plus className="mr-2 h-4 w-4" />
                Add Finding
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {report.findings?.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
                <p className="text-muted-foreground mb-4">No findings recorded yet.</p>
                <Button variant="outline" onClick={addFinding}>Start Adding Issues</Button>
              </div>
            )}
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={report.findings?.map(f => f.id) || []} strategy={verticalListSortingStrategy}>
                {report.findings?.map((finding, index) => (
                  <SortableFindingCard
                    key={finding.id}
                    finding={finding as Finding & { photoUrls?: string[] }}
                    index={index}
                    updateFinding={updateFinding}
                    removeFinding={removeFinding}
                    addPhotoToFinding={addPhotoToFinding}
                    removePhotoFromFinding={removePhotoFromFinding}
                    onAnnotatePhoto={handleAnnotatePhoto}
                    onAnalyzePhoto={handleAnalyzePhoto}
                    analyzingPhotoIndex={analyzingPhotoIndex}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {(report.findings?.length || 0) > 0 && (
            <div className="flex justify-center pt-4">
              <Button onClick={addFinding} variant="outline" size="lg">
                <Plus className="mr-2 h-4 w-4" />
                Add Finding
              </Button>
            </div>
          )}
        </TabsContent>

        {/* --- TAB: MEASUREMENTS --- */}
        <TabsContent value="measurements" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card>
            <CardHeader>
              <CardTitle>Measurements</CardTitle>
              <CardDescription>Enter key dimensions for estimation.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                 {[
                   { id: 'area', label: 'Roof Area (m²)' },
                   { id: 'ridge', label: 'Ridge Length (Lm)' },
                   { id: 'hips', label: 'Hips (Lm)' },
                   { id: 'valleys', label: 'Valleys (Lm)' },
                   { id: 'gutters', label: 'Gutters (Lm)' },
                   { id: 'downpipes', label: 'Downpipes (Count)' }
                 ].map(m => (
                   <div className="space-y-2" key={m.id}>
                      <Label>{m.label}</Label>
                      <Input 
                        type="number" 
                        placeholder="0" 
                        value={report.measurements?.[m.id] || ''}
                        onChange={(e) => updateMeasurement(m.id, e.target.value)}
                      />
                   </div>
                 ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB: ESTIMATE --- */}
        <TabsContent value="estimate" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle>Cost Estimate</CardTitle>
                  <CardDescription>Materials and Labour estimation.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportEstimateToCSV} data-testid="button-export-csv">
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleAutoCalculate}>
                    <Calculator className="mr-2 h-4 w-4" />
                    Auto-Calculate
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Description</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[120px]">Unit Cost ($)</TableHead>
                    <TableHead className="w-[100px]">Markup (%)</TableHead>
                    <TableHead className="text-right">Total (Ex GST)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.estimateItems?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input 
                          value={item.description} 
                          className="h-8" 
                          // In real app, bind this
                          readOnly
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e) => updateEstimateItem(item.id, 'qty', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          value={item.unitCost}
                          onChange={(e) => updateEstimateItem(item.id, 'unitCost', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input 
                          type="number" 
                          value={item.markup}
                          onChange={(e) => updateEstimateItem(item.id, 'markup', e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${calculateRowTotal(item).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex flex-col items-end gap-2 bg-muted/20 p-6">
              <div className="flex justify-between w-[250px] text-sm">
                <span>Subtotal (Ex GST):</span>
                <span>${totalEstimate.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-[250px] text-sm">
                <span>GST (10%):</span>
                <span>${totalGST.toFixed(2)}</span>
              </div>
              <div className="flex justify-between w-[250px] font-bold text-lg border-t pt-2 mt-2">
                <span>Grand Total:</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --- TAB: PREVIEW --- */}
        <TabsContent value="preview" className="animate-in fade-in slide-in-from-bottom-2">
          <Card id="pdf-preview-content" className="overflow-hidden shadow-2xl max-w-[210mm] mx-auto" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
             {/* Print Header */}
             <div id="pdf-header" className="px-6 py-4 border-b-2" style={{ borderColor: activeTheme?.themeColor || '#1e293b', backgroundColor: '#f8fafc' }}>
                <div className="flex items-start justify-between">
                   <div className="flex items-center gap-4">
                      <img 
                        src={activeTheme?.logoUrl || localStorage.getItem('sbl_custom_logo') || logoUrl} 
                        alt="Company Logo" 
                        className="h-16 w-auto max-w-[120px] object-contain"
                      />
                      <div>
                        <h1 className="text-xl font-heading font-bold" style={{ color: '#0f172a' }}>
                          {activeTheme?.companyName || 'ROOF REPORT'}
                        </h1>
                        {activeTheme?.companyName && (
                          <p className="text-xs font-semibold uppercase tracking-wider mt-0.5" style={{ color: activeTheme?.themeColor || '#475569' }}>Roof Inspection Report</p>
                        )}
                        {activeTheme?.phone && <p className="text-[11px] mt-1" style={{ color: '#64748b' }}>{activeTheme.phone}</p>}
                        {activeTheme?.email1 && <p className="text-[11px]" style={{ color: '#64748b' }}>{activeTheme.email1}</p>}
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: '#0f172a' }}>{report.jobId ? formatJobNumber({ id: report.jobId, referenceNumber: null }) : report.id}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{formatDateLong(new Date())}</p>
                   </div>
                </div>
             </div>

             {/* Client Info */}
             <div id="pdf-client-info" className="px-6 py-4 grid grid-cols-2 gap-4" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#94a3b8' }}>Customer Details</h3>
                  <p className="font-bold text-sm" style={{ color: '#ffffff' }}>{report.customerName || "Customer Name"}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#cbd5e1' }}>{report.address}{report.suburb ? `, ${report.suburb}` : ''}</p>
                  {report.contactPhone && <p className="text-xs mt-0.5" style={{ color: '#cbd5e1' }}>{report.contactPhone}</p>}
                </div>
                <div>
                  <h3 className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: '#94a3b8' }}>Site Details</h3>
                  <p className="text-xs" style={{ color: '#cbd5e1' }}>Roof: {report.roofType || 'Not specified'}</p>
                  {report.roofPitch && <p className="text-xs mt-0.5" style={{ color: '#cbd5e1' }}>Pitch: {report.roofPitch}</p>}
                  {report.storeys && <p className="text-xs mt-0.5" style={{ color: '#cbd5e1' }}>Storeys: {report.storeys}</p>}
                  <p className="text-xs mt-0.5" style={{ color: '#cbd5e1' }}>Weather: {report.weather || 'Not recorded'}</p>
                </div>
             </div>

             {/* Summary Section */}
             <div id="pdf-summary" className="px-6 py-3" style={{ backgroundColor: '#ffffff' }}>
                {reportSettings.showExecutiveSummary && (
                  <>
                    <h2 className="text-base font-bold pb-1 mb-1.5" style={{ color: '#1e293b', borderBottom: `2px solid ${activeTheme?.themeColor || '#1e293b'}` }}>Executive Summary</h2>
                    <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
                       {reportSettings.executiveSummaryTemplate
                         .replace('{condition}', 'fair')
                         .replace('{findings_count}', String(report.findings?.length || 0))}
                       {(report.findings?.length || 0) > 0 && ' Immediate action is recommended for the issues identified below to prevent water ingress.'}
                    </p>
                  </>
                )}
             </div>
             
             {/* Findings Header - Separate element for better page flow */}
             {reportSettings.showFindings && report.findings && report.findings.length > 0 && (
                <div id="pdf-findings-header" className="px-6 pt-3 pb-1" style={{ backgroundColor: '#ffffff' }}>
                   <h2 className="text-base font-bold pb-1" style={{ color: '#1e293b', borderBottom: `2px solid ${activeTheme?.themeColor || '#1e293b'}` }}>Findings & Recommendations</h2>
                </div>
             )}
             
             {/* Individual Findings - Compact styling for better page flow */}
             {reportSettings.showFindings && report.findings?.map((f, i) => {
                const photos = f.photoUrls || (f.photoUrl ? [f.photoUrl] : []);
                return (
                <div 
                   key={i} 
                   id={`pdf-finding-${i}`} 
                   className="px-6 py-3" 
                   style={{ 
                     backgroundColor: '#ffffff', 
                     borderBottom: '1px solid #e2e8f0',
                     borderLeft: `4px solid ${f.severity === 'critical' ? '#dc2626' : f.severity === 'high' ? '#ea580c' : f.severity === 'medium' ? '#d97706' : '#16a34a'}`
                   }}
                >
                   <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{ color: '#0f172a' }}>#{i + 1} {f.category}</span>
                      <span 
                         className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase"
                         style={{ 
                            backgroundColor: f.severity === 'critical' ? '#fee2e2' : f.severity === 'high' ? '#ffedd5' : '#f1f5f9',
                            color: f.severity === 'critical' ? '#b91c1c' : f.severity === 'high' ? '#c2410c' : '#334155'
                         }}
                      >
                         {f.severity}
                      </span>
                   </div>
                   
                   {reportSettings.showPhotos && photos.length > 0 && (
                      <div className={`grid gap-2 mb-2 ${photos.length === 1 ? 'grid-cols-2' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                         {photos.map((url: string, photoIdx: number) => (
                            <img 
                               key={photoIdx} 
                               src={url} 
                               className="w-full rounded border" 
                               style={{ borderColor: '#e2e8f0', maxHeight: '140px', objectFit: 'cover' }} 
                            />
                         ))}
                      </div>
                   )}
                   
                   <p className="text-xs mb-1" style={{ color: '#475569' }}><span className="font-bold">Issue:</span> {f.description || "No description provided."}</p>
                   <p className="text-xs" style={{ color: '#1e293b' }}><span className="font-bold">Recommendation:</span> {f.recommendation || "No recommendation provided."}</p>
                </div>
                );
             })}
             
             {reportSettings.showFindings && (!report.findings || report.findings.length === 0) && (
                <div id="pdf-no-findings" className="px-5 py-2" style={{ backgroundColor: '#ffffff' }}>
                   <h2 className="text-base font-bold pb-1 mb-1" style={{ color: '#1e293b', borderBottom: `2px solid ${activeTheme?.themeColor || '#1e293b'}` }}>Findings & Recommendations</h2>
                   <p className="text-xs italic" style={{ color: '#64748b' }}>No specific findings recorded.</p>
                </div>
             )}
                
             {reportSettings.showEstimate && grandTotal > 0 && (
                <div id="pdf-estimate" className="mx-6 my-3 border-t pt-3" style={{ borderColor: '#1e293b', backgroundColor: '#ffffff' }}>
                   <div className="flex justify-between items-center">
                      <h2 className="text-base font-bold" style={{ color: '#1e293b' }}>Estimated Cost of Works</h2>
                      <div className="text-lg font-bold" style={{ color: '#0f172a' }}>${grandTotal.toFixed(2)} <span className="text-xs font-normal" style={{ color: '#64748b' }}>(Inc GST)</span></div>
                   </div>
                   <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>
                      This is an estimate only and subject to formal quotation. Valid for {reportSettings.quoteValidityDays} days.
                   </p>
                   {reportSettings.termsAndConditions && (
                      <p className="text-[10px] mt-0.5" style={{ color: '#64748b' }}>
                         {reportSettings.termsAndConditions}
                      </p>
                   )}
                </div>
             )}

             {/* Footer */}
             <div id="pdf-footer" className="px-6 py-3 mt-1 border-t text-center text-xs" style={{ borderColor: '#e2e8f0', color: '#94a3b8', backgroundColor: '#ffffff' }}>
                {reportSettings.footerText} • {formatDateTime(new Date())}
             </div>
          </Card>
          <div className="max-w-[210mm] mx-auto mt-4 flex justify-end gap-2 print:hidden">
             <Button variant="outline" onClick={sendEmail} data-testid="button-email-report">
                <Mail className="mr-2 h-4 w-4" />
                Email Report
             </Button>
             <Button variant="default" onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                <FileOutput className="mr-2 h-4 w-4" />
                {isGeneratingPDF ? "Generating PDF..." : "Download Report"}
             </Button>
          </div>
        </TabsContent>

      </Tabs>

      {/* Photo Annotator Modal */}
      {annotatingPhoto && (
        <PhotoAnnotator
          imageUrl={annotatingPhoto.url}
          open={!!annotatingPhoto}
          onClose={() => setAnnotatingPhoto(null)}
          onSave={handleSaveAnnotatedPhoto}
        />
      )}

      {/* Signature Pad Modal */}
      <SignaturePad
        open={showSignaturePad}
        onClose={() => setShowSignaturePad(false)}
        onSave={(sig) => setClientSignature(sig)}
        existingSignature={clientSignature || undefined}
      />

      {/* Email Dialog */}
      {report.id && (
        <SendEmailDialog
          open={isEmailDialogOpen}
          onOpenChange={setIsEmailDialogOpen}
          documentType="report"
          documentId={report.id}
          documentNumber={report.id}
          recipientEmail={""}
          recipientName={report.customerName || ""}
          onSuccess={() => {
            toast({ title: "Report Sent", description: "Inspection report sent to customer" });
          }}
        />
      )}

      {/* AI Photo Analysis Dialog */}
      <Dialog open={aiAnalysisDialogOpen} onOpenChange={setAiAnalysisDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Photo Analysis
            </DialogTitle>
            <DialogDescription>
              Review the AI's suggested details for this finding.
            </DialogDescription>
          </DialogHeader>
          
          {aiAnalysisResult && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Suggested Category</Label>
                <p className="font-medium">{aiAnalysisResult.category}</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Suggested Severity</Label>
                <div>
                  <Badge 
                    variant={
                      aiAnalysisResult.severity === 'critical' ? 'destructive' : 
                      aiAnalysisResult.severity === 'high' ? 'default' : 
                      'secondary'
                    }
                    className={cn(
                      aiAnalysisResult.severity === 'high' && 'bg-orange-500 text-white',
                      aiAnalysisResult.severity === 'critical' && 'bg-red-600 text-white'
                    )}
                    data-testid="badge-ai-severity"
                  >
                    {aiAnalysisResult.severity.charAt(0).toUpperCase() + aiAnalysisResult.severity.slice(1)}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Suggested Description</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{aiAnalysisResult.description}</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Suggested Recommendation</Label>
                <p className="text-sm bg-muted/50 p-3 rounded-md">{aiAnalysisResult.recommendation}</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={handleDismissAiSuggestions}
              data-testid="button-dismiss-ai-suggestions"
            >
              Dismiss
            </Button>
            <Button 
              onClick={handleApplyAiSuggestions}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-apply-ai-suggestions"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Apply Suggestions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Report Analysis Dialog */}
      <Dialog open={reportAnalysisDialogOpen} onOpenChange={setReportAnalysisDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Report Suggestions
            </DialogTitle>
            <DialogDescription>
              AI-powered recommendations to improve your report quality.
            </DialogDescription>
          </DialogHeader>
          
          {reportAnalysisResult && (
            <div className="space-y-4 py-4">
              {/* Overall Score */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Report Quality Score</Label>
                  <p className="text-sm text-muted-foreground mt-1">{reportAnalysisResult.summary}</p>
                </div>
                <div className={cn(
                  "text-3xl font-bold w-14 h-14 rounded-full flex items-center justify-center",
                  reportAnalysisResult.overallScore >= 8 ? "bg-green-100 text-green-700" :
                  reportAnalysisResult.overallScore >= 6 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {reportAnalysisResult.overallScore}
                </div>
              </div>
              
              {/* Quick Wins */}
              {reportAnalysisResult.quickWins && reportAnalysisResult.quickWins.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-2">
                    <Zap className="h-3 w-3 text-amber-500" />
                    Quick Wins
                  </Label>
                  <ul className="space-y-1">
                    {reportAnalysisResult.quickWins.map((win, i) => (
                      <li key={i} className="text-sm flex items-start gap-2 bg-amber-50 p-2 rounded-md border border-amber-100">
                        <CheckCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{win}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Detailed Suggestions */}
              {reportAnalysisResult.suggestions && reportAnalysisResult.suggestions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Detailed Suggestions</Label>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {reportAnalysisResult.suggestions.map((suggestion, i) => (
                      <div key={i} className={cn(
                        "p-3 rounded-md border text-sm",
                        suggestion.priority === 'high' ? "bg-red-50 border-red-200" :
                        suggestion.priority === 'medium' ? "bg-amber-50 border-amber-200" :
                        "bg-slate-50 border-slate-200"
                      )}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{suggestion.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">{suggestion.type}</Badge>
                            <Badge 
                              variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs capitalize",
                                suggestion.priority === 'medium' && "bg-amber-500"
                              )}
                            >
                              {suggestion.priority}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-muted-foreground">{suggestion.description}</p>
                        {suggestion.findingIndex !== null && (
                          <p className="text-xs text-purple-600 mt-1">→ Relates to Finding #{suggestion.findingIndex + 1}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              onClick={() => setReportAnalysisDialogOpen(false)}
              className="h-11 min-h-[44px]"
              data-testid="button-close-report-analysis"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Summary Dialog */}
      <Dialog open={aiSummaryDialogOpen} onOpenChange={setAiSummaryDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              AI Executive Summary
            </DialogTitle>
            <DialogDescription>
              Review and use this AI-generated summary for your report.
            </DialogDescription>
          </DialogHeader>
          
          {aiSummaryResult && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
                {aiSummaryResult}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setAiSummaryDialogOpen(false)}
              data-testid="button-dismiss-ai-summary"
            >
              Close
            </Button>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(aiSummaryResult || '');
                toast({ title: "Copied", description: "Summary copied to clipboard" });
              }}
              variant="outline"
              data-testid="button-copy-ai-summary"
            >
              Copy to Clipboard
            </Button>
            <Button 
              onClick={() => {
                setReportSettings(prev => ({
                  ...prev,
                  showExecutiveSummary: true,
                  executiveSummaryTemplate: aiSummaryResult || prev.executiveSummaryTemplate
                }));
                setAiSummaryDialogOpen(false);
                toast({ title: "Applied", description: "Summary applied to your report's executive summary" });
              }}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-apply-ai-summary"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Use as Executive Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomerDialog} onOpenChange={setShowAddCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Create a new customer and link them to this report.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Customer Name *</Label>
              <Input 
                value={newCustomer.name}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. John Smith"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-new-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone</Label>
              <Input 
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0400 000 000"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-new-customer-phone"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input 
                value={newCustomer.email}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@example.com"
                type="email"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-new-customer-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Address</Label>
              <Input 
                value={newCustomer.address}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main Street"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-new-customer-address"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Suburb</Label>
              <Input 
                value={newCustomer.suburb}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, suburb: e.target.value }))}
                placeholder="Suburb"
                className="h-11 min-h-[44px] text-base"
                data-testid="input-new-customer-suburb"
              />
            </div>
          </div>
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddCustomerDialog(false);
                setNewCustomer({ name: '', phone: '', email: '', address: '', suburb: '' });
              }}
              className="h-11 min-h-[44px]"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCustomer}
              disabled={isCreatingCustomer || !newCustomer.name.trim()}
              className="h-11 min-h-[44px]"
              data-testid="button-save-customer"
            >
              {isCreatingCustomer ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create & Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
