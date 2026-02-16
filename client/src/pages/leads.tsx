import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  DollarSign,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  Paperclip,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  fetchLeads, 
  createLead, 
  fetchLeadAttachmentCount
} from "@/lib/api";
import type { Lead, InsertLead } from "@shared/schema";
import { startOfWeek, isAfter } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { FeatureGate } from "@/components/feature-gate";

const STAGES = [
  { id: "new", label: "New", color: "bg-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800" },
  { id: "contacted", label: "Contacted", color: "bg-blue-500", bgColor: "bg-blue-50 dark:bg-blue-900/20" },
  { id: "quoted", label: "Quoted", color: "bg-orange-500", bgColor: "bg-orange-50 dark:bg-orange-900/20" },
  { id: "negotiating", label: "Negotiating", color: "bg-purple-500", bgColor: "bg-purple-50 dark:bg-purple-900/20" },
  { id: "won", label: "Won", color: "bg-green-500", bgColor: "bg-green-50 dark:bg-green-900/20" },
  { id: "lost", label: "Lost", color: "bg-red-500", bgColor: "bg-red-50 dark:bg-red-900/20" },
];

const SOURCES = ["Website", "Phone Call", "Referral", "Walk-in", "Other"];

function LeadCard({ lead }: { lead: Lead }) {
  const [, navigate] = useLocation();
  const stage = STAGES.find(s => s.id === lead.stage) || STAGES[0];
  const daysSinceCreated = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  
  const { data: fileCount = 0 } = useQuery({
    queryKey: ["lead-attachment-count", lead.id],
    queryFn: () => fetchLeadAttachmentCount(lead.id),
    staleTime: 60000,
  });
  
  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all border-l-4 active:scale-[0.98]",
        stage.color.replace("bg-", "border-")
      )}
      onClick={() => navigate(`/lead/${lead.id}`)}
      data-testid={`card-lead-${lead.id}`}
    >
      <CardContent className="p-3 space-y-1.5 overflow-hidden">
        <div className="flex items-center justify-between min-w-0">
          <div className="font-medium text-sm truncate flex-1 min-w-0" data-testid={`text-lead-name-${lead.id}`}>
            {lead.name}
          </div>
          {fileCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-2 shrink-0" title={`${fileCount} file${fileCount !== 1 ? 's' : ''}`}>
              <Paperclip className="h-3 w-3" />
              <span>{fileCount}</span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground min-w-0">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-primary hover:underline min-w-0" onClick={(e) => e.stopPropagation()} data-testid={`link-call-lead-${lead.id}`}>
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </a>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.address && (
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{lead.address}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {lead.source}
          </Badge>
          {lead.estimatedValue && (
            <span className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400 shrink-0">
              <DollarSign className="h-3 w-3" />
              {lead.estimatedValue.toLocaleString()}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {daysSinceCreated === 0 ? "Today" : `${daysSinceCreated}d ago`}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadForm({ 
  lead, 
  onSave, 
  onClose, 
  isLoading 
}: { 
  lead?: Lead;
  onSave: (data: InsertLead) => void; 
  onClose: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<InsertLead>>({
    id: lead?.id || `lead_${Date.now()}`,
    name: lead?.name || "",
    email: lead?.email || "",
    phone: lead?.phone || "",
    address: lead?.address || "",
    suburb: lead?.suburb || "",
    source: lead?.source || "Website",
    stage: lead?.stage || "new",
    notes: lead?.notes || "",
    estimatedValue: lead?.estimatedValue || null,
  });

  const handleSubmit = () => {
    if (!formData.name?.trim()) return;
    onSave(formData as InsertLead);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name || ""}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Lead name"
          data-testid="input-lead-name"
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
            data-testid="input-lead-email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone || ""}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="0400 000 000"
            data-testid="input-lead-phone"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <AddressAutocomplete
          value={formData.address || ""}
          onChange={(value) => setFormData({ ...formData, address: value })}
          placeholder="Start typing an address..."
          data-testid="input-lead-address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select 
            value={formData.source || "Website"} 
            onValueChange={(value) => setFormData({ ...formData, source: value })}
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
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated Value ($)</Label>
          <Input
            id="estimatedValue"
            type="number"
            value={formData.estimatedValue || ""}
            onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="0"
            data-testid="input-lead-value"
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
          data-testid="input-lead-notes"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isLoading} data-testid="button-cancel-lead">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !formData.name?.trim()} data-testid="button-save-lead">
          {isLoading ? "Saving..." : lead ? "Update Lead" : "Add Lead"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export default function Leads() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: fetchLeads,
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLead) => createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDialogOpen(false);
      toast({ title: "Lead added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create lead", variant: "destructive" });
    }
  });

  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter(lead => 
      lead.name.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.source?.toLowerCase().includes(query)
    );
  }, [leads, searchQuery]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    STAGES.forEach(stage => { grouped[stage.id] = []; });
    filteredLeads.forEach(lead => {
      const stage = lead.stage || "new";
      if (grouped[stage]) {
        grouped[stage].push(lead);
      } else {
        grouped["new"].push(lead);
      }
    });
    return grouped;
  }, [filteredLeads]);

  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const newThisWeek = leads.filter(l => isAfter(new Date(l.createdAt), weekStart)).length;
    const wonCount = leads.filter(l => l.stage === "won").length;
    const closedCount = leads.filter(l => l.stage === "won" || l.stage === "lost").length;
    const conversionRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    
    return {
      total: leads.length,
      newThisWeek,
      conversionRate
    };
  }, [leads]);

  return (
    <Layout>
      <FeatureGate feature="leads">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary" data-testid="text-leads-title">
              Leads Pipeline
            </h1>
            <p className="text-muted-foreground">Manage your sales pipeline</p>
          </div>
          <Button asChild className="h-11 md:h-10 min-w-[120px]" data-testid="button-add-lead">
            <Link href="/lead/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Link>
          </Button>
        </div>

        {/* Mobile: Horizontal scroll stats */}
        <div className="md:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
          <Card className="flex-shrink-0 w-[140px] snap-start">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground/50" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="text-lg font-bold" data-testid="stat-total-leads-mobile">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-shrink-0 w-[140px] snap-start">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                <div>
                  <p className="text-[10px] text-muted-foreground">This Week</p>
                  <p className="text-lg font-bold" data-testid="stat-new-leads-mobile">{stats.newThisWeek}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-shrink-0 w-[140px] snap-start">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground/50" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Conversion</p>
                  <p className="text-lg font-bold" data-testid="stat-conversion-rate-mobile">{stats.conversionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Desktop: Grid stats */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                  <p className="text-2xl font-bold" data-testid="stat-total-leads">{stats.total}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">New This Week</p>
                  <p className="text-2xl font-bold" data-testid="stat-new-leads">{stats.newThisWeek}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                  <p className="text-2xl font-bold" data-testid="stat-conversion-rate">{stats.conversionRate}%</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search bar - mobile optimized */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 md:h-10"
              data-testid="input-search-leads"
            />
          </div>
        </div>

        {isLoading ? (
          <>
            {/* Mobile horizontal scroll skeleton */}
            <div className="md:hidden flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
              {STAGES.map(stage => (
                <div key={stage.id} className="flex-shrink-0 w-[280px] snap-center space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
            {/* Desktop grid skeleton */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {STAGES.map(stage => (
                <div key={stage.id} className="space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Mobile: Horizontal scrolling stages */}
            <div className="md:hidden flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4 scrollbar-hide">
              {STAGES.map(stage => (
                <div 
                  key={stage.id} 
                  className={cn("flex-shrink-0 w-[280px] snap-center rounded-lg p-3", stage.bgColor)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                      <h3 className="font-medium text-sm">{stage.label}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {leadsByStage[stage.id]?.length || 0}
                    </Badge>
                  </div>
                  <ScrollArea className="h-[calc(100dvh-380px)] min-h-[250px]">
                    <div className="space-y-3 pr-2">
                      {leadsByStage[stage.id]?.map(lead => (
                        <LeadCard 
                          key={lead.id} 
                          lead={lead}
                        />
                      ))}
                      {leadsByStage[stage.id]?.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
            
            {/* Desktop: Grid layout */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-4">
              {STAGES.map(stage => (
                <div key={stage.id} className={cn("rounded-lg p-3", stage.bgColor)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                      <h3 className="font-medium text-sm">{stage.label}</h3>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {leadsByStage[stage.id]?.length || 0}
                    </Badge>
                  </div>
                  <ScrollArea className="h-[calc(100dvh-420px)] min-h-[300px]">
                    <div className="space-y-3 pr-2">
                      {leadsByStage[stage.id]?.map(lead => (
                        <LeadCard 
                          key={lead.id} 
                          lead={lead}
                        />
                      ))}
                      {leadsByStage[stage.id]?.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <LeadForm
            onSave={(data) => createMutation.mutate(data)}
            onClose={() => setDialogOpen(false)}
            isLoading={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      </FeatureGate>
    </Layout>
  );
}
