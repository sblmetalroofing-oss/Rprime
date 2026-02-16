import { useState, useRef, useEffect } from "react";
import { useCapacitorContext } from "@/hooks/use-capacitor";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Save, 
  Loader2,
  DollarSign,
  Calendar,
  User,
  ArrowLeft,
  Upload,
  FileImage,
  FileText,
  MessageSquare,
  Clock,
  Plus,
  Trash2,
  Image as ImageIcon,
  File,
  Send,
  CalendarPlus,
  StickyNote,
  ArrowUpRight,
  ArrowDownRight,
  FileCheck,
  Briefcase,
  ExternalLink
} from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Link } from "wouter";
import { 
  fetchLead, 
  createLead, 
  updateLead, 
  deleteLead,
  fetchCustomers,
  fetchLeadAttachments,
  uploadLeadAttachment,
  deleteLeadAttachment,
  createLeadActivity,
  createQuoteFromLead,
  convertLeadToJob,
  type LeadWithDetails
} from "@/lib/api";
import type { InsertLead, Customer, LeadAttachment, LeadActivity } from "@shared/schema";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { cn } from "@/lib/utils";

const STAGES = [
  { id: "new", label: "New", color: "bg-gray-500", textColor: "text-gray-700 dark:text-gray-300" },
  { id: "contacted", label: "Contacted", color: "bg-blue-500", textColor: "text-blue-700 dark:text-blue-300" },
  { id: "quoted", label: "Quoted", color: "bg-orange-500", textColor: "text-orange-700 dark:text-orange-300" },
  { id: "negotiating", label: "Negotiating", color: "bg-purple-500", textColor: "text-purple-700 dark:text-purple-300" },
  { id: "won", label: "Won", color: "bg-green-500", textColor: "text-green-700 dark:text-green-300" },
  { id: "lost", label: "Lost", color: "bg-red-500", textColor: "text-red-700 dark:text-red-300" },
];

const SOURCES = ["Website", "Phone Call", "Referral", "Walk-in", "Google", "Social Media", "Other"];

const FILE_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "site_photo", label: "Site Photos" },
  { id: "roof_report", label: "Roof Reports" },
  { id: "quote", label: "Quotes" },
  { id: "customer_doc", label: "Customer Docs" },
  { id: "other", label: "Other" },
];

function getActivityIcon(type: string) {
  switch (type) {
    case 'note':
      return <MessageSquare className="h-4 w-4" />;
    case 'stage_change':
      return <ArrowUpRight className="h-4 w-4" />;
    case 'file_upload':
      return <Upload className="h-4 w-4" />;
    default:
      return <StickyNote className="h-4 w-4" />;
  }
}

function getActivityLabel(type: string) {
  switch (type) {
    case 'note':
      return 'Note';
    case 'stage_change':
      return 'Stage Change';
    case 'file_upload':
      return 'File Upload';
    default:
      return 'Activity';
  }
}

function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export default function LeadEditor() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/lead/:id");
  const isNew = params?.id === "new";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isIOS } = useCapacitorContext();

  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [previewFile, setPreviewFile] = useState<LeadAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Array<{ file: File; category: string; preview?: string }>>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState<InsertLead>({
    id: `lead_${Date.now()}`,
    name: "",
    email: "",
    phone: "",
    address: "",
    suburb: "",
    postcode: "",
    state: "Queensland",
    source: "Website",
    stage: "new",
    notes: "",
    estimatedValue: null,
    assignedTo: "",
    nextFollowUp: null,
    customerId: null,
    quoteId: null,
    jobId: null,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => fetchCustomers(),
  });

  const { data: lead, isLoading: loadingLead, error: leadError } = useQuery({
    queryKey: ['lead', params?.id],
    queryFn: () => fetchLead(params!.id!),
    enabled: !isNew && !!params?.id,
  });

  const { data: attachments = [], isLoading: loadingAttachments } = useQuery({
    queryKey: ['leadAttachments', params?.id],
    queryFn: () => fetchLeadAttachments(params!.id!),
    enabled: !isNew && !!params?.id,
  });

  const addActivityMutation = useMutation({
    mutationFn: (content: string) => createLeadActivity(params!.id!, {
      id: `activity_${Date.now()}`,
      type: 'note',
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', params?.id] });
      setNewNote("");
      toast({ title: "Note added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add note", variant: "destructive" });
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: deleteLeadAttachment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leadAttachments', params?.id] });
      toast({ title: "File deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete file", variant: "destructive" });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: () => deleteLead(params!.id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      toast({ title: "Lead deleted" });
      setLocation("/leads");
    },
    onError: () => {
      toast({ title: "Failed to delete lead", variant: "destructive" });
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: () => createQuoteFromLead(params!.id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead', params?.id] });
      toast({ title: "Quote created successfully" });
      if (data?.quote?.id) {
        setLocation(`/quote/${data.quote.id}`);
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to create quote", variant: "destructive" });
    },
  });

  const convertToJobMutation = useMutation({
    mutationFn: () => convertLeadToJob(params!.id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lead', params?.id] });
      const msg = data?.attachmentsCopied 
        ? `Job created with ${data.attachmentsCopied} attachment(s) copied`
        : "Job created successfully";
      toast({ title: msg });
      if (data?.job?.id) {
        setLocation(`/job/${data.job.id}`);
      }
    },
    onError: (error: Error) => {
      toast({ title: error.message || "Failed to convert to job", variant: "destructive" });
    },
  });

  // Sync lead data to form when loaded
  useEffect(() => {
    if (lead && !isNew) {
      setFormData({
        id: lead.id,
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        address: lead.address || "",
        suburb: lead.suburb || "",
        postcode: lead.postcode || "",
        state: lead.state || "Queensland",
        source: lead.source,
        stage: lead.stage,
        notes: lead.notes || "",
        estimatedValue: lead.estimatedValue,
        assignedTo: lead.assignedTo || "",
        nextFollowUp: lead.nextFollowUp,
        customerId: lead.customerId,
        quoteId: lead.quoteId,
        jobId: lead.jobId,
      });
    }
  }, [lead, isNew]);

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Please enter a name", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    try {
      if (isNew) {
        const newLead = await createLead(formData);
        if (stagedFiles.length > 0 && newLead?.id) {
          for (const { file, category } of stagedFiles) {
            try {
              await uploadLeadAttachment(newLead.id, file, category);
            } catch (err) {
              console.error('Failed to upload staged file:', err);
            }
          }
          toast({ title: `Lead created with ${stagedFiles.length} file(s)` });
        } else {
          toast({ title: "Lead created successfully" });
        }
      } else {
        await updateLead(params!.id!, formData);
        toast({ title: "Lead updated successfully" });
      }
      setLocation('/leads');
    } catch (err) {
      console.error('Failed to save lead:', err);
      toast({ title: "Failed to save lead", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (isNew) {
      const newStagedFiles = await Promise.all(
        Array.from(files).map(async (file) => {
          let preview: string | undefined;
          if (file.type.startsWith('image/')) {
            preview = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          }
          return { file, category: 'other', preview };
        })
      );
      setStagedFiles(prev => [...prev, ...newStagedFiles]);
      toast({ title: `${files.length} file(s) added` });
    } else if (params?.id) {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await uploadLeadAttachment(params.id, file, 'other');
        }
        queryClient.invalidateQueries({ queryKey: ['leadAttachments', params.id] });
        toast({ title: "File(s) uploaded successfully" });
      } catch (err) {
        console.error('Failed to upload file:', err);
        toast({ title: "Failed to upload file", variant: "destructive" });
      }
      setUploading(false);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    addActivityMutation.mutate(newNote);
  };

  // Show all attachments without filtering
  const allAttachments = attachments;

  if (loadingLead && !isNew) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (leadError && !isNew) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <p className="text-muted-foreground">Failed to load lead</p>
          <Button variant="outline" onClick={() => setLocation('/leads')}>
            Back to Leads
          </Button>
        </div>
      </Layout>
    );
  }

  const linkedCustomer = customers.find((c: Customer) => c.id === formData.customerId);
  const currentStage = STAGES.find(s => s.id === formData.stage) || STAGES[0];
  const daysSinceCreated = lead?.createdAt ? differenceInDays(new Date(), new Date(lead.createdAt)) : 0;
  const activities = (lead?.activities || []) as LeadActivity[];

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumb className="mb-4 hidden md:block">
          <BreadcrumbList>
            {linkedCustomer ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/customers" data-testid="breadcrumb-customers">Customers</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/customers" data-testid="breadcrumb-customer">{linkedCustomer.name}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            ) : (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link href="/leads" data-testid="breadcrumb-leads">Leads</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="breadcrumb-current">
                {isNew ? "New Lead" : formData.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLocation("/leads")} 
              className="h-11 w-11" 
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{isNew ? "New Lead" : formData.name}</h1>
              <p className="text-muted-foreground">
                {isNew ? "Create a new lead" : "Manage lead details and activities"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={currentStage.color} data-testid="badge-stage">{currentStage.label}</Badge>
            {formData.quoteId && (
              <Link href={`/quote/${formData.quoteId}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1" data-testid="badge-linked-quote">
                  <FileCheck className="h-3 w-3" />
                  Quote
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {formData.jobId && (
              <Link href={`/job/${formData.jobId}`}>
                <Badge variant="outline" className="cursor-pointer hover:bg-accent gap-1" data-testid="badge-linked-job">
                  <Briefcase className="h-3 w-3" />
                  Job
                  <ExternalLink className="h-3 w-3" />
                </Badge>
              </Link>
            )}
            {!isNew && (
              <Button 
                variant="destructive" 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteLeadMutation.isPending}
                data-testid="button-delete-lead"
              >
                {deleteLeadMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} data-testid="button-save-lead">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Lead
            </Button>
          </div>
        </div>

        {isNew ? (
          <NewLeadForm 
            formData={formData} 
            setFormData={setFormData} 
            customers={customers}
            stagedFiles={stagedFiles}
            onFileSelect={() => fileInputRef.current?.click()}
            onRemoveStagedFile={removeStagedFile}
            fileInputRef={fileInputRef}
            handleFileUpload={handleFileUpload}
          />
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6" data-testid="tabs-list">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">Files & Photos</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Summary Card */}
              <Card data-testid="card-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Lead Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Stage</p>
                      <Badge className={currentStage.color}>{currentStage.label}</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Estimated Value</p>
                      <p className="font-semibold flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {formData.estimatedValue ? `$${formData.estimatedValue.toLocaleString()}` : '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Days Since Created</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {daysSinceCreated} days
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Assigned To</p>
                      <p className="font-semibold flex items-center gap-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {formData.assignedTo || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Next Follow-up</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formData.nextFollowUp 
                          ? format(new Date(formData.nextFollowUp), 'MMM d, yyyy')
                          : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card data-testid="card-quick-actions">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setActiveTab("files");
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                      data-testid="button-quick-upload"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setActiveTab("activity")}
                      data-testid="button-quick-note"
                    >
                      <StickyNote className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const followUpInput = document.getElementById('nextFollowUp');
                        if (followUpInput) {
                          followUpInput.focus();
                          (followUpInput as HTMLInputElement).showPicker?.();
                        }
                      }}
                      data-testid="button-quick-followup"
                    >
                      <CalendarPlus className="h-4 w-4 mr-2" />
                      Schedule Follow-up
                    </Button>
                    {!isNew && !formData.quoteId && (
                      <Button 
                        variant="default"
                        onClick={() => createQuoteMutation.mutate()}
                        disabled={createQuoteMutation.isPending}
                        data-testid="button-create-quote"
                      >
                        {createQuoteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                        Create Quote
                      </Button>
                    )}
                    {formData.stage === 'won' && !formData.jobId && (
                      <Button 
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => convertToJobMutation.mutate()}
                        disabled={convertToJobMutation.isPending}
                        data-testid="button-convert-to-job"
                      >
                        {convertToJobMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Briefcase className="h-4 w-4 mr-2" />}
                        Convert to Job
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Existing Content - Contact, Address, Pipeline */}
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Contact name"
                            data-testid="input-lead-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@example.com"
                            data-testid="input-lead-email"
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={formData.phone || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="0400 000 000"
                            data-testid="input-lead-phone"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="source">Source</Label>
                          <Select 
                            value={formData.source} 
                            onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                          >
                            <SelectTrigger data-testid="select-lead-source">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SOURCES.map(source => (
                                <SelectItem key={source} value={source}>{source}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Address</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <AddressAutocomplete
                          value={formData.address || ""}
                          onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                          onPlaceSelect={(components) => {
                            setFormData(prev => ({
                              ...prev,
                              suburb: components.suburb || prev.suburb,
                              state: components.state || prev.state,
                              postcode: components.postcode || prev.postcode,
                            }));
                          }}
                          placeholder="Start typing an address..."
                          className="h-11 min-h-[44px]"
                          data-testid="input-lead-address"
                        />
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="suburb">Suburb</Label>
                          <Input
                            id="suburb"
                            value={formData.suburb || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, suburb: e.target.value }))}
                            placeholder="Suburb"
                            data-testid="input-lead-suburb"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="postcode">Postcode</Label>
                          <Input
                            id="postcode"
                            value={formData.postcode || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                            placeholder="4000"
                            data-testid="input-lead-postcode"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={formData.state || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                            placeholder="QLD"
                            data-testid="input-lead-state"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={formData.notes || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add notes about this lead..."
                        rows={4}
                        data-testid="input-lead-notes"
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pipeline</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Stage</Label>
                        <Select 
                          value={formData.stage} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
                        >
                          <SelectTrigger data-testid="select-lead-stage">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGES.map(stage => (
                              <SelectItem key={stage.id} value={stage.id}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                  {stage.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="estimatedValue">
                          <DollarSign className="h-4 w-4 inline mr-1" />
                          Estimated Value
                        </Label>
                        <Input
                          id="estimatedValue"
                          type="number"
                          value={formData.estimatedValue || ""}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            estimatedValue: e.target.value ? parseFloat(e.target.value) : null 
                          }))}
                          placeholder="0.00"
                          data-testid="input-lead-value"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="assignedTo">
                          <User className="h-4 w-4 inline mr-1" />
                          Assigned To
                        </Label>
                        <Input
                          id="assignedTo"
                          value={formData.assignedTo || ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                          placeholder="Team member name"
                          data-testid="input-lead-assigned"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nextFollowUp">
                          <Calendar className="h-4 w-4 inline mr-1" />
                          Next Follow-up
                        </Label>
                        <Input
                          id="nextFollowUp"
                          type="date"
                          value={formData.nextFollowUp ? format(new Date(formData.nextFollowUp), 'yyyy-MM-dd') : ""}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            nextFollowUp: e.target.value ? new Date(e.target.value) : null 
                          }))}
                          data-testid="input-lead-followup"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {linkedCustomer && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Linked Customer</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          <Link href="/customers" className="text-blue-500 hover:underline">
                            {linkedCustomer.name}
                          </Link>
                          {linkedCustomer.email && (
                            <p className="text-muted-foreground">{linkedCustomer.email}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-6">
              {/* Upload Section */}
              <Card data-testid="card-upload">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Upload Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      data-testid="button-upload-file"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? 'Uploading...' : 'Choose Files'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Staged Files Preview (New Lead Only) */}
              {isNew && stagedFiles.length > 0 && (
                <Card data-testid="card-staged-files">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileImage className="h-5 w-5" />
                      Files to Upload ({stagedFiles.length})
                    </CardTitle>
                    <CardDescription>These files will be uploaded when you save the lead</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {stagedFiles.map((staged, index) => (
                        <div 
                          key={index} 
                          className="group relative aspect-square rounded-lg border bg-muted overflow-hidden"
                          data-testid={`staged-file-${index}`}
                        >
                          {staged.preview ? (
                            <img 
                              src={staged.preview} 
                              alt={staged.file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2">
                              <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                              <span className="text-[10px] text-muted-foreground text-center truncate w-full">
                                {staged.file.name}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8"
                              onClick={() => removeStagedFile(index)}
                              data-testid={`button-remove-staged-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}


              {!isNew && loadingAttachments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isNew && stagedFiles.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Add photos or documents</p>
                    <p className="text-sm text-muted-foreground">Files will be saved with the lead</p>
                  </CardContent>
                </Card>
              ) : !isNew && allAttachments.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <FileImage className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No files uploaded yet</p>
                    <p className="text-sm text-muted-foreground">Upload files to get started</p>
                  </CardContent>
                </Card>
              ) : !isNew && (
                <Card data-testid="card-all-files">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      All Files ({allAttachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {allAttachments.map((attachment: LeadAttachment) => {
                        const isImage = isImageFile(attachment.contentType);
                        const isPdf = attachment.contentType === 'application/pdf' || attachment.fileName.toLowerCase().endsWith('.pdf');
                        return (
                          <div 
                            key={attachment.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => setPreviewFile(attachment)}
                            data-testid={`file-attachment-${attachment.id}`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex-shrink-0 w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden">
                                {isImage ? (
                                  <img
                                    src={attachment.storageKey}
                                    alt={attachment.fileName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : isPdf ? (
                                  <FileText className="h-6 w-6 text-red-500" />
                                ) : (
                                  <File className="h-6 w-6 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{attachment.fileName}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {attachment.createdAt && formatDistanceToNow(new Date(attachment.createdAt), { addSuffix: true })}
                                  </span>
                                  {attachment.uploadedByName && (
                                    <span>by {attachment.uploadedByName}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                                data-testid={`button-delete-${attachment.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* File Preview Modal */}
              {previewFile && (
                <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        {previewFile.fileName}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      {isImageFile(previewFile.contentType) ? (
                        <img
                          src={previewFile.storageKey}
                          alt={previewFile.fileName}
                          className="w-full h-auto max-h-[70vh] object-contain"
                        />
                      ) : previewFile.contentType === 'application/pdf' || previewFile.fileName.toLowerCase().endsWith('.pdf') ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <FileText className="h-16 w-16 text-red-500" />
                          <p className="text-muted-foreground">PDF Preview</p>
                          <Button 
                            onClick={async () => {
                              const url = previewFile.storageKey;
                              if (isIOS) {
                                try {
                                  const response = await fetch(url);
                                  const blob = await response.blob();
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const dataUrl = reader.result as string;
                                    window.open(dataUrl, '_blank');
                                  };
                                  reader.readAsDataURL(blob);
                                } catch (error) {
                                  console.error('Error opening PDF:', error);
                                  toast({ title: 'Error opening PDF', variant: 'destructive' });
                                }
                              } else {
                                window.open(url, '_blank');
                              }
                            }}
                          >
                            Open PDF
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                          <File className="h-16 w-16 text-muted-foreground" />
                          <p className="text-muted-foreground">Preview not available</p>
                          <Button 
                            onClick={async () => {
                              const url = previewFile.storageKey;
                              if (isIOS) {
                                try {
                                  const response = await fetch(url);
                                  const blob = await response.blob();
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    const dataUrl = reader.result as string;
                                    window.open(dataUrl, '_blank');
                                  };
                                  reader.readAsDataURL(blob);
                                } catch (error) {
                                  console.error('Error opening file:', error);
                                  toast({ title: 'Error opening file', variant: 'destructive' });
                                }
                              } else {
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = previewFile.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }
                            }}
                          >
                            {isIOS ? 'Open File' : 'Download File'}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between mt-4">
                      <Button variant="outline" onClick={() => setPreviewFile(null)}>
                        Back
                      </Button>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={async () => {
                            const url = previewFile.storageKey;
                            if (isIOS) {
                              try {
                                const response = await fetch(url);
                                const blob = await response.blob();
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const dataUrl = reader.result as string;
                                  window.open(dataUrl, '_blank');
                                };
                                reader.readAsDataURL(blob);
                              } catch (error) {
                                console.error('Error opening file:', error);
                                toast({ title: 'Error opening file', variant: 'destructive' });
                              }
                            } else {
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = previewFile.fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }
                          }}
                        >
                          <ArrowDownRight className="h-4 w-4 mr-2" />
                          {isIOS ? 'Open' : 'Download'}
                        </Button>
                        <Button 
                          variant="destructive"
                          onClick={() => {
                            deleteAttachmentMutation.mutate(previewFile.id);
                            setPreviewFile(null);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-6">
              {/* Add Note */}
              <Card data-testid="card-add-note">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Add Note</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write a note..."
                      rows={2}
                      className="flex-1"
                      data-testid="input-new-note"
                    />
                    <Button 
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || addActivityMutation.isPending}
                      data-testid="button-add-note"
                    >
                      {addActivityMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Timeline */}
              <Card data-testid="card-activity-timeline">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No activity yet</p>
                      <p className="text-sm text-muted-foreground">Add a note to get started</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="relative space-y-0">
                        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                        {activities.sort((a, b) => 
                          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                        ).map((activity, index) => (
                          <div 
                            key={activity.id} 
                            className="relative pl-10 pb-6"
                            data-testid={`activity-item-${activity.id}`}
                          >
                            <div className="absolute left-0 w-8 h-8 rounded-full bg-background border-2 flex items-center justify-center">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="bg-muted/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px]">
                                  {getActivityLabel(activity.type)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm">{activity.content}</p>
                              {activity.createdBy && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  by {activity.createdBy}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this lead? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteLeadMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-lead"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function NewLeadForm({ 
  formData, 
  setFormData, 
  customers,
  stagedFiles,
  onFileSelect,
  onRemoveStagedFile,
  fileInputRef,
  handleFileUpload
}: { 
  formData: InsertLead; 
  setFormData: React.Dispatch<React.SetStateAction<InsertLead>>;
  customers: Customer[];
  stagedFiles: Array<{ file: File; category: string; preview?: string }>;
  onFileSelect: () => void;
  onRemoveStagedFile: (index: number) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const linkedCustomer = customers.find(c => c.id === formData.customerId);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contact name"
                  data-testid="input-lead-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                  data-testid="input-lead-email"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0400 000 000"
                  data-testid="input-lead-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select 
                  value={formData.source} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
                >
                  <SelectTrigger data-testid="select-lead-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(source => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <AddressAutocomplete
                value={formData.address || ""}
                onChange={(value) => setFormData(prev => ({ ...prev, address: value }))}
                onPlaceSelect={(components) => {
                  setFormData(prev => ({
                    ...prev,
                    suburb: components.suburb || prev.suburb,
                    state: components.state || prev.state,
                    postcode: components.postcode || prev.postcode,
                  }));
                }}
                placeholder="Start typing an address..."
                className="h-11 min-h-[44px]"
                data-testid="input-lead-address"
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="suburb">Suburb</Label>
                <Input
                  id="suburb"
                  value={formData.suburb || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, suburb: e.target.value }))}
                  placeholder="Suburb"
                  data-testid="input-lead-suburb"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={formData.postcode || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, postcode: e.target.value }))}
                  placeholder="4000"
                  data-testid="input-lead-postcode"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="QLD"
                  data-testid="input-lead-state"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Add notes about this lead..."
              rows={4}
              data-testid="input-lead-notes"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select 
                value={formData.stage} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, stage: value }))}
              >
                <SelectTrigger data-testid="select-lead-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map(stage => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                        {stage.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="estimatedValue">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Estimated Value
              </Label>
              <Input
                id="estimatedValue"
                type="number"
                value={formData.estimatedValue || ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  estimatedValue: e.target.value ? parseFloat(e.target.value) : null 
                }))}
                placeholder="0.00"
                data-testid="input-lead-value"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">
                <User className="h-4 w-4 inline mr-1" />
                Assigned To
              </Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                placeholder="Team member name"
                data-testid="input-lead-assigned"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextFollowUp">
                <Calendar className="h-4 w-4 inline mr-1" />
                Next Follow-up
              </Label>
              <Input
                id="nextFollowUp"
                type="date"
                value={formData.nextFollowUp ? format(new Date(formData.nextFollowUp), 'yyyy-MM-dd') : ""}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  nextFollowUp: e.target.value ? new Date(e.target.value) : null 
                }))}
                data-testid="input-lead-followup"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Files & Photos
            </CardTitle>
            <CardDescription>
              Add photos or documents with this lead
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-new-lead-file"
              />
              <Button 
                variant="outline"
                onClick={onFileSelect}
                className="min-h-[44px]"
                data-testid="button-new-lead-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                Add Files
              </Button>
            </div>

            {stagedFiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {stagedFiles.map((staged, index) => (
                  <div 
                    key={index} 
                    className="group relative aspect-square rounded-lg border bg-muted overflow-hidden"
                    data-testid={`new-lead-staged-${index}`}
                  >
                    {staged.preview ? (
                      <img 
                        src={staged.preview} 
                        alt={staged.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <FileText className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-[9px] text-muted-foreground text-center truncate w-full">
                          {staged.file.name}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={() => onRemoveStagedFile(index)}
                        data-testid={`button-remove-new-${index}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                No files added yet
              </div>
            )}

            {stagedFiles.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {stagedFiles.length} file(s) will be uploaded when you save
              </p>
            )}
          </CardContent>
        </Card>

        {linkedCustomer && (
          <Card>
            <CardHeader>
              <CardTitle>Linked Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                <Link href="/customers" className="text-blue-500 hover:underline">
                  {linkedCustomer.name}
                </Link>
                {linkedCustomer.email && (
                  <p className="text-muted-foreground">{linkedCustomer.email}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
