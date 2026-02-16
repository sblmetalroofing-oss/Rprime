import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { MobileLayout } from "@/components/mobile-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { usePlanLimits } from "@/hooks/use-plan-limits";
import { usePermissions } from "@/hooks/use-permissions";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { 
  User, 
  Mail, 
  Save,
  Palette,
  Shield,
  Bell,
  FileText,
  ClipboardList,
  Link2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Sparkles,
  Receipt,
  XCircle
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import logoUrl from "@assets/sbl-logo.png";
import * as api from "@/lib/api";
import { useTheme, ACCENT_COLORS } from "@/components/theme-provider";
import type { Item, InsertItem, CrewMember, InsertCrewMember } from "@shared/schema";
import type { DocumentSettings } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus, FileUp, Download, Briefcase, Users, ChevronRight, Palette as PaletteIcon, Timer, ShoppingCart, Clock, Cloud, Globe } from "lucide-react";
import { QuoteTemplateSettings } from "@/components/quote-template-settings";
import { formatDateShort } from "@/lib/date-utils";
import { JobTemplatesSection } from "./settings/JobTemplatesSection";
import { CrewSection } from "./settings/CrewSection";

export default function Settings() {
  const { user, isLoading, isAuthenticated, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const { accentColor, setAccentColor } = useTheme();
  const planLimits = usePlanLimits();
  const { canManageBilling } = usePermissions();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [activeSection, setActiveSection] = useState('appearance');
  const [orgTimezone, setOrgTimezone] = useState('Australia/Brisbane');

  const { data: timezoneData } = useQuery({
    queryKey: ["/api/organization/timezone"],
    queryFn: async () => {
      const res = await fetch("/api/organization/timezone");
      if (!res.ok) return { timezone: 'Australia/Brisbane' };
      return res.json();
    },
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (timezoneData?.timezone) {
      setOrgTimezone(timezoneData.timezone);
    }
  }, [timezoneData]);

  const handleTimezoneChange = async (newTimezone: string) => {
    setOrgTimezone(newTimezone);
    try {
      const res = await fetch("/api/organization/timezone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTimezone }),
      });
      if (res.ok) {
        toast({ title: "Timezone Updated", description: `Timezone set to ${newTimezone}` });
      } else {
        toast({ title: "Error", description: "Failed to update timezone", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update timezone", variant: "destructive" });
    }
  };

  const { data: billingData } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: canManageBilling,
  });

  const { data: xeroStatus, refetch: refetchXeroStatus } = useQuery({
    queryKey: ["/api/xero/status"],
    queryFn: async () => {
      const res = await fetch("/api/xero/status");
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const { data: xeroSyncHistory = [] } = useQuery({
    queryKey: ["/api/xero/sync-history"],
    queryFn: async () => {
      const res = await fetch("/api/xero/sync-history");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!xeroStatus?.connected
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const xeroResult = params.get('xero');
    if (xeroResult === 'connected') {
      toast({ title: "Xero Connected", description: "Your Xero account has been successfully connected." });
      refetchXeroStatus();
      window.history.replaceState({}, '', '/settings');
    } else if (xeroResult === 'error') {
      toast({ title: "Xero Connection Failed", description: "Failed to connect to Xero. Please try again.", variant: "destructive" });
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleXeroConnect = async () => {
    try {
      const res = await fetch("/api/xero/auth");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Error", description: "Failed to start Xero authentication", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to connect to Xero", variant: "destructive" });
    }
  };

  const handleXeroDisconnect = async () => {
    try {
      const res = await fetch("/api/xero/disconnect", { method: "POST" });
      if (res.ok) {
        toast({ title: "Xero Disconnected", description: "Your Xero account has been disconnected." });
        refetchXeroStatus();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to disconnect Xero", variant: "destructive" });
    }
  };
  
  const [notifications, setNotifications] = useState({
    emailReports: true,
    pushNotifications: false,
    weeklyDigest: true
  });

  const [customLogo, setCustomLogo] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState({
    myob: { connected: false },
    quickbooks: { connected: false }
  });

  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvPreview, setCsvPreview] = useState<InsertItem[]>([]);
  const [importing, setImporting] = useState(false);

  const [jobTimerEnabled, setJobTimerEnabled] = useState(false);
  const [jobTimerLoading, setJobTimerLoading] = useState(true);

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

  const [quoteSettings, setQuoteSettings] = useState<Partial<DocumentSettings>>({
    type: 'quote',
    prefix: 'Q',
    nextNumber: 1,
    defaultExpiryDays: 30,
    defaultTerms: '',
    reminderMessage: '',
    emailRemindersDefault: 'false',
    smsRemindersDefault: 'false',
    customerCanAccept: 'true',
    customerCanDecline: 'true'
  });

  const [invoiceSettings, setInvoiceSettings] = useState<Partial<DocumentSettings>>({
    type: 'invoice',
    prefix: 'INV',
    nextNumber: 1,
    defaultDueDays: 14,
    defaultTerms: '',
    reminderMessage: '',
    emailRemindersDefault: 'false',
    smsRemindersDefault: 'false',
    autoMarkPaid: 'false'
  });

  const [poSettings, setPoSettings] = useState<Partial<DocumentSettings>>({
    type: 'po',
    prefix: 'PO',
    nextNumber: 1,
    defaultDueDays: 7,
    defaultTerms: '',
  });

  const [jobNumberSettings, setJobNumberSettings] = useState<Partial<DocumentSettings>>({
    type: 'job',
    prefix: 'JOB',
    nextNumber: 1,
  });

  const [jobMigrationStatus, setJobMigrationStatus] = useState<{ completed: boolean; completedAt?: string } | null>(null);
  const [jobMigrationRunning, setJobMigrationRunning] = useState(false);

  const [documentSettingsLoading, setDocumentSettingsLoading] = useState(false);
  const [documentSettingsSaving, setDocumentSettingsSaving] = useState(false);

  useEffect(() => {
    const savedReportSettings = localStorage.getItem('sbl_report_settings');
    if (savedReportSettings) {
      try {
        setReportSettings(prev => ({ ...prev, ...JSON.parse(savedReportSettings) }));
      } catch {
        localStorage.removeItem('sbl_report_settings');
      }
    }

    const savedLogo = localStorage.getItem('sbl_custom_logo');
    if (savedLogo) {
      setCustomLogo(savedLogo);
    }
    
    const savedNotifications = localStorage.getItem('sbl_notifications');
    if (savedNotifications) {
      try {
        setNotifications(prev => ({ ...prev, ...JSON.parse(savedNotifications) }));
      } catch {
        localStorage.removeItem('sbl_notifications');
      }
    }
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "File too large",
          description: "Logo must be under 2MB"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const logoData = event.target?.result as string;
        setCustomLogo(logoData);
        localStorage.setItem('sbl_custom_logo', logoData);
        toast({
          title: "Logo Saved",
          description: "Your company logo has been saved."
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveReportSettings = () => {
    localStorage.setItem('sbl_report_settings', JSON.stringify(reportSettings));
    toast({
      title: "Report Settings Saved",
      description: "Your report customization preferences have been saved."
    });
  };

  const loadDocumentSettings = async () => {
    setDocumentSettingsLoading(true);
    try {
      const [quoteData, invoiceData, poData, jobData] = await Promise.all([
        api.fetchDocumentSettings('quote'),
        api.fetchDocumentSettings('invoice'),
        api.fetchDocumentSettings('po'),
        api.fetchDocumentSettings('job')
      ]);
      if (quoteData) setQuoteSettings(prev => ({ ...prev, ...quoteData }));
      if (invoiceData) setInvoiceSettings(prev => ({ ...prev, ...invoiceData }));
      if (poData) setPoSettings(prev => ({ ...prev, ...poData }));
      if (jobData) setJobNumberSettings(prev => ({ ...prev, ...jobData }));
    } catch (e) {
      console.error('Failed to load document settings:', e);
    }
    setDocumentSettingsLoading(false);
  };

  useEffect(() => {
    loadDocumentSettings();
  }, []);

  const handleSaveQuoteSettings = async () => {
    setDocumentSettingsSaving(true);
    const result = await api.updateDocumentSettings('quote', quoteSettings);
    setDocumentSettingsSaving(false);
    if (result) {
      toast({ title: "Quote Settings Saved" });
    } else {
      toast({ title: "Failed to save quote settings", variant: "destructive" });
    }
  };

  const handleSaveInvoiceSettings = async () => {
    setDocumentSettingsSaving(true);
    const result = await api.updateDocumentSettings('invoice', invoiceSettings);
    setDocumentSettingsSaving(false);
    if (result) {
      toast({ title: "Invoice Settings Saved" });
    } else {
      toast({ title: "Failed to save invoice settings", variant: "destructive" });
    }
  };

  const handleSavePoSettings = async () => {
    setDocumentSettingsSaving(true);
    const result = await api.updateDocumentSettings('po', poSettings);
    setDocumentSettingsSaving(false);
    if (result) {
      toast({ title: "Purchase Order Settings Saved" });
    } else {
      toast({ title: "Failed to save PO settings", variant: "destructive" });
    }
  };

  const handleSaveJobNumberSettings = async () => {
    setDocumentSettingsSaving(true);
    const result = await api.updateDocumentSettings('job', jobNumberSettings);
    setDocumentSettingsSaving(false);
    if (result) {
      toast({ title: "Job Numbering Settings Saved" });
    } else {
      toast({ title: "Failed to save job settings", variant: "destructive" });
    }
  };

  const loadJobMigrationStatus = async () => {
    try {
      const res = await fetch('/api/migrations/job-numbers/status');
      if (res.ok) {
        const data = await res.json();
        setJobMigrationStatus(data);
      }
    } catch (e) {
      console.error('Failed to load migration status:', e);
    }
  };

  useEffect(() => {
    loadJobMigrationStatus();
  }, []);

  const handleRunJobMigration = async () => {
    setJobMigrationRunning(true);
    try {
      const res = await fetch('/api/migrations/job-numbers/run', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        toast({ title: "Migration Complete", description: result.message });
        loadJobMigrationStatus();
        loadDocumentSettings();
      } else {
        toast({ title: "Migration Failed", description: result.message, variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Migration Failed", description: "An error occurred during migration", variant: "destructive" });
    }
    setJobMigrationRunning(false);
  };

  const loadItems = async () => {
    setItemsLoading(true);
    const fetchedItems = await api.fetchItems();
    setItems(fetchedItems);
    setItemsLoading(false);
  };

  useEffect(() => {
    loadItems();
    loadJobSettings();
  }, []);
  
  const loadJobSettings = async () => {
    setJobTimerLoading(true);
    const value = await api.fetchAppSetting('job_timer_enabled');
    setJobTimerEnabled(value === 'true');
    setJobTimerLoading(false);
  };
  
  const handleToggleJobTimer = async (enabled: boolean) => {
    setJobTimerEnabled(enabled);
    await api.updateAppSetting('job_timer_enabled', enabled ? 'true' : 'false');
    toast({ title: enabled ? "Job timer enabled" : "Job timer disabled" });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast({
          variant: "destructive",
          title: "Invalid CSV",
          description: "CSV must have a header row and at least one data row"
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
      const itemCodeIndex = headers.findIndex(h => h === 'itemcode' || h === 'item_code' || h === 'code' || h === 'sku');
      const descriptionIndex = headers.findIndex(h => h === 'description' || h === 'desc' || h === 'name' || h === 'item');
      const categoryIndex = headers.findIndex(h => h === 'category' || h === 'cat' || h === 'type');
      const unitIndex = headers.findIndex(h => h === 'unit' || h === 'uom');
      const unitCostIndex = headers.findIndex(h => h === 'unitcost' || h === 'unit_cost' || h === 'cost' || h === 'buyprice' || h === 'buy_price');
      const sellPriceIndex = headers.findIndex(h => h === 'sellprice' || h === 'sell_price' || h === 'price' || h === 'retail');
      const supplierIndex = headers.findIndex(h => h === 'supplier' || h === 'vendor');

      if (itemCodeIndex === -1 || descriptionIndex === -1) {
        toast({
          variant: "destructive",
          title: "Missing Required Columns",
          description: "CSV must have 'itemcode' (or 'code'/'sku') and 'description' (or 'name') columns"
        });
        return;
      }

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
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
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const parseNumber = (val: string | undefined): number => {
        if (!val) return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };

      const parsedItems: InsertItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const itemCode = values[itemCodeIndex]?.trim();
        const description = values[descriptionIndex]?.trim();
        
        if (!itemCode || !description) continue;

        parsedItems.push({
          itemCode,
          description,
          category: categoryIndex >= 0 ? values[categoryIndex]?.trim() || null : null,
          unit: unitIndex >= 0 ? values[unitIndex]?.trim() || 'each' : 'each',
          costPrice: parseNumber(unitCostIndex >= 0 ? values[unitCostIndex] : undefined),
          sellPrice: parseNumber(sellPriceIndex >= 0 ? values[sellPriceIndex] : undefined),
          supplierName: supplierIndex >= 0 ? values[supplierIndex]?.trim() || null : null,
        });
      }

      if (parsedItems.length === 0) {
        toast({
          variant: "destructive",
          title: "No Valid Items",
          description: "No valid items found in CSV file"
        });
        return;
      }

      setCsvPreview(parsedItems);
      toast({
        title: "CSV Parsed",
        description: `Found ${parsedItems.length} items ready to import`
      });
    };
    reader.readAsText(file);
  };

  const handleImportItems = async () => {
    if (csvPreview.length === 0) return;
    
    setImporting(true);
    const result = await api.createItemsBulk(csvPreview);
    setImporting(false);

    if (result) {
      toast({
        title: "Import Successful",
        description: `Successfully imported ${result.created} items`
      });
      setCsvPreview([]);
      setCsvImportOpen(false);
      loadItems();
    } else {
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Failed to import items. Please try again."
      });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    const success = await api.deleteItem(id);
    if (success) {
      setItems(items.filter(item => item.id !== id));
      toast({
        title: "Item Deleted",
        description: "Item has been removed from the catalog"
      });
    }
  };

  const downloadCsvTemplate = () => {
    const template = "itemcode,description,category,unit,unitcost,sellprice,supplier\nROOF-001,Ridge Cap Metal,Roofing Materials,each,15.50,25.00,ABC Supplies\nROOF-002,Tile Cement (20kg),Adhesives,bag,22.00,35.00,XYZ Materials";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const allNavItems = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'account', label: 'Account', icon: User },
    { id: 'timezone', label: 'Timezone', icon: Globe },
    { id: 'billing', label: 'Billing', icon: CreditCard, requiresBilling: true },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'quotes', label: 'Quotes', icon: FileText },
    { id: 'quote-templates', label: 'AI Quote Templates', icon: Sparkles },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { id: 'job-numbering', label: 'Job Numbering', icon: Briefcase },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'job-timer', label: 'Job Timer', icon: Timer },
    { id: 'templates', label: 'Templates', icon: ClipboardList },
    { id: 'crew', label: 'Crew', icon: Users },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
  ];
  
  const baseNavItems = allNavItems.filter(item => !item.requiresBilling || canManageBilling);
  
  const navItems = user?.isSuperAdmin 
    ? [...baseNavItems, { id: 'super-admin', label: 'Super Admin', icon: Shield }]
    : baseNavItems;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  };

  useEffect(() => {
    const sectionIds = navItems.map(item => item.id);
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setActiveSection(id);
              }
            });
          },
          { threshold: 0.3, rootMargin: '-20% 0px -70% 0px' }
        );
        observer.observe(element);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  const SettingsNav = () => {
    if (isMobile) {
      return (
        <div className="overflow-x-auto pb-2 -mx-4 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex gap-2 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  data-testid={`nav-${item.id}`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <nav className="w-52 shrink-0 self-start">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors text-left ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                data-testid={`nav-${item.id}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    );
  };

  const content = (
    <div className={isMobile ? "space-y-4" : "flex gap-8 h-[calc(100dvh-6rem)]"}>
      {isMobile && <SettingsNav />}
      
      {!isMobile && <SettingsNav />}
      
      <div className={isMobile ? "space-y-4" : "flex-1 space-y-8 min-w-0 overflow-y-auto pr-2"}>
        {!isMobile && (
          <div>
            <h1 className="text-3xl font-heading font-bold text-primary">Settings</h1>
            <p className="text-muted-foreground mt-1">Manage your account and company settings</p>
          </div>
        )}

        {/* Appearance Section */}
        <Card id="appearance">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Accent Color */}
          <div>
            <p className="font-medium mb-3">Accent Color</p>
            <div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={`h-11 w-11 rounded-full border-2 transition-all flex items-center justify-center ${
                    accentColor === color.value 
                      ? 'border-foreground scale-110' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.color }}
                  data-testid={`accent-color-setting-${color.value}`}
                  title={color.label}
                >
                  {accentColor === color.value && (
                    <CheckCircle2 className="h-5 w-5 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

        <div className={isMobile ? "space-y-4" : "grid gap-6 lg:grid-cols-2"}>
          <Card id="account">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Account Details
              </CardTitle>
              <CardDescription>Your personal account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-16 w-16 bg-muted rounded-full" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                </div>
              ) : isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-4">
                    {user.profileImageUrl ? (
                      <img 
                        src={user.profileImageUrl} 
                        alt={user.firstName || 'User'} 
                        className="h-16 w-16 rounded-full object-cover border-2 border-primary/20"
                        data-testid="img-profile"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                        {(user.firstName?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-lg" data-testid="text-fullname">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground" data-testid="text-email">
                        {user.email || 'No email provided'}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">User ID</p>
                      <p className="font-mono text-xs truncate" data-testid="text-userid">{user.id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Member Since</p>
                      <p data-testid="text-member-since">
                        {user.createdAt ? formatDateShort(user.createdAt) : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      data-testid="button-settings-logout"
                      onClick={() => logout()}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Sign in to view your account details</p>
                  <a href="/api/login">
                    <Button data-testid="button-settings-login">Sign In</Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card id="timezone">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Timezone
              </CardTitle>
              <CardDescription>Set your organization's timezone for scheduling and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="timezone-select">Organization Timezone</Label>
                <Select value={orgTimezone} onValueChange={handleTimezoneChange}>
                  <SelectTrigger id="timezone-select" className="mt-1" data-testid="select-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Australia/Brisbane">Australia/Brisbane (AEST - No DST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Adelaide">Australia/Adelaide (ACST/ACDT)</SelectItem>
                    <SelectItem value="Australia/Perth">Australia/Perth (AWST)</SelectItem>
                    <SelectItem value="Australia/Darwin">Australia/Darwin (ACST)</SelectItem>
                    <SelectItem value="Australia/Hobart">Australia/Hobart (AEST/AEDT)</SelectItem>
                    <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  This timezone is used for appointment reminders and scheduling.
                </p>
              </div>
            </CardContent>
          </Card>

          {canManageBilling && (
            <Card id="billing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Billing & Subscription
                </CardTitle>
                <CardDescription>Manage your subscription and billing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {billingData?.organization ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Current Plan</p>
                        <p className="text-2xl font-bold capitalize">
                          {(() => {
                            const org = billingData.organization;
                            if (org.planOverride) return org.planOverride;
                            if (org.billingOverride === 'free') return 'business';
                            return org.subscriptionPlan || 'Starter';
                          })()}
                        </p>
                      </div>
                      {(() => {
                        const org = billingData.organization;
                        const hasOverride = org.planOverride || org.billingOverride === 'free';
                        const status = billingData.subscription?.status || org.subscriptionStatus || "trialing";
                        const trialDaysLeft = org.trialEndsAt
                          ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                          : 0;
                        
                        const getStatusBadge = () => {
                          switch (status) {
                            case "active":
                              return <Badge className="bg-green-500">Active</Badge>;
                            case "trialing":
                              return <Badge className="bg-blue-500">Trial - {trialDaysLeft} days left</Badge>;
                            case "past_due":
                              return <Badge variant="destructive">Past Due</Badge>;
                            case "canceled":
                              return <Badge variant="secondary">Canceled</Badge>;
                            default:
                              return <Badge variant="outline">{status}</Badge>;
                          }
                        };
                        
                        return (
                          <div className="flex flex-col items-end gap-1">
                            {hasOverride && <Badge className="bg-amber-500">Admin Override</Badge>}
                            {getStatusBadge()}
                          </div>
                        );
                      })()}
                    </div>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <Button 
                        onClick={() => setLocation("/billing")}
                        data-testid="button-manage-billing"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        View plans, update payment methods, and download invoices
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-4">No active subscription</p>
                    <Button onClick={() => setLocation("/billing")} data-testid="button-setup-billing">
                      Set Up Billing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card id="reports" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Report Defaults
              </CardTitle>
              <CardDescription>Set default values for inspection reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Logo, company details, terms, and footer are now managed in{' '}
                  <Link href="/document-themes" className="text-primary hover:underline">Document Themes</Link>.
                  Select a theme when creating or editing a report.
                </p>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-medium mb-3 block">Report Sections</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose which sections to include in your PDF reports</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-summary" 
                      checked={reportSettings.showExecutiveSummary}
                      onCheckedChange={(checked) => setReportSettings({...reportSettings, showExecutiveSummary: !!checked})}
                      data-testid="checkbox-show-summary"
                    />
                    <Label htmlFor="show-summary" className="font-normal cursor-pointer">Executive Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-findings" 
                      checked={reportSettings.showFindings}
                      onCheckedChange={(checked) => setReportSettings({...reportSettings, showFindings: !!checked})}
                      data-testid="checkbox-show-findings"
                    />
                    <Label htmlFor="show-findings" className="font-normal cursor-pointer">Findings & Recommendations</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-photos" 
                      checked={reportSettings.showPhotos}
                      onCheckedChange={(checked) => setReportSettings({...reportSettings, showPhotos: !!checked})}
                      data-testid="checkbox-show-photos"
                    />
                    <Label htmlFor="show-photos" className="font-normal cursor-pointer">Photos</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-measurements" 
                      checked={reportSettings.showMeasurements}
                      onCheckedChange={(checked) => setReportSettings({...reportSettings, showMeasurements: !!checked})}
                      data-testid="checkbox-show-measurements"
                    />
                    <Label htmlFor="show-measurements" className="font-normal cursor-pointer">Measurements</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="show-estimate" 
                      checked={reportSettings.showEstimate}
                      onCheckedChange={(checked) => setReportSettings({...reportSettings, showEstimate: !!checked})}
                      data-testid="checkbox-show-estimate"
                    />
                    <Label htmlFor="show-estimate" className="font-normal cursor-pointer">Cost Estimate</Label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="summary-template">Executive Summary Template</Label>
                <Textarea 
                  id="summary-template"
                  value={reportSettings.executiveSummaryTemplate}
                  onChange={(e) => setReportSettings({...reportSettings, executiveSummaryTemplate: e.target.value})}
                  placeholder="Enter your executive summary template..."
                  className="min-h-[80px]"
                  data-testid="textarea-summary-template"
                />
                <p className="text-xs text-muted-foreground">Use {'{condition}'} and {'{findings_count}'} as placeholders</p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveReportSettings} data-testid="button-save-report-settings">
                  <Save className="mr-2 h-4 w-4" />
                  Save Report Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quote Settings */}
          <Card id="quotes" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Quote Settings
              </CardTitle>
              <CardDescription>Configure default settings for quotes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="quote-prefix">Quote Prefix</Label>
                  <Input 
                    id="quote-prefix"
                    value={quoteSettings.prefix || ''}
                    onChange={(e) => setQuoteSettings({...quoteSettings, prefix: e.target.value})}
                    placeholder="Q"
                    data-testid="input-quote-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-next-number">Next Quote Number</Label>
                  <Input 
                    id="quote-next-number"
                    type="number"
                    value={quoteSettings.nextNumber || 1}
                    onChange={(e) => setQuoteSettings({...quoteSettings, nextNumber: parseInt(e.target.value) || 1})}
                    data-testid="input-quote-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-expiry">Default Expiry (days)</Label>
                  <Input 
                    id="quote-expiry"
                    type="number"
                    value={quoteSettings.defaultExpiryDays || 30}
                    onChange={(e) => setQuoteSettings({...quoteSettings, defaultExpiryDays: parseInt(e.target.value) || 30})}
                    data-testid="input-quote-expiry"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Customer Actions</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Customer Can Accept</p>
                      <p className="text-sm text-muted-foreground">Allow customers to accept quotes online</p>
                    </div>
                    <Switch 
                      checked={quoteSettings.customerCanAccept === 'true'}
                      onCheckedChange={(checked) => setQuoteSettings({...quoteSettings, customerCanAccept: checked ? 'true' : 'false'})}
                      data-testid="switch-quote-can-accept"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Customer Can Decline</p>
                      <p className="text-sm text-muted-foreground">Allow customers to decline quotes online</p>
                    </div>
                    <Switch 
                      checked={quoteSettings.customerCanDecline === 'true'}
                      onCheckedChange={(checked) => setQuoteSettings({...quoteSettings, customerCanDecline: checked ? 'true' : 'false'})}
                      data-testid="switch-quote-can-decline"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Reminders</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Reminders</p>
                      <p className="text-sm text-muted-foreground">Send email reminders for expiring quotes</p>
                    </div>
                    <Switch 
                      checked={quoteSettings.emailRemindersDefault === 'true'}
                      onCheckedChange={(checked) => setQuoteSettings({...quoteSettings, emailRemindersDefault: checked ? 'true' : 'false'})}
                      data-testid="switch-quote-email-reminders"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS Reminders</p>
                      <p className="text-sm text-muted-foreground">Send SMS reminders for expiring quotes</p>
                    </div>
                    <Switch 
                      checked={quoteSettings.smsRemindersDefault === 'true'}
                      onCheckedChange={(checked) => setQuoteSettings({...quoteSettings, smsRemindersDefault: checked ? 'true' : 'false'})}
                      data-testid="switch-quote-sms-reminders"
                    />
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="quote-reminder-message">Reminder Message</Label>
                  <Textarea 
                    id="quote-reminder-message"
                    value={quoteSettings.reminderMessage || ''}
                    onChange={(e) => setQuoteSettings({...quoteSettings, reminderMessage: e.target.value})}
                    placeholder="Enter the reminder message to send to customers..."
                    className="min-h-[60px]"
                    data-testid="textarea-quote-reminder-message"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quote-terms">Default Terms & Conditions</Label>
                <Textarea 
                  id="quote-terms"
                  value={quoteSettings.defaultTerms || ''}
                  onChange={(e) => setQuoteSettings({...quoteSettings, defaultTerms: e.target.value})}
                  placeholder="Enter default terms and conditions for quotes..."
                  className="min-h-[80px]"
                  data-testid="textarea-quote-terms"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveQuoteSettings} disabled={documentSettingsSaving} data-testid="button-save-quote-settings">
                  <Save className="mr-2 h-4 w-4" />
                  Save Quote Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Quote Templates */}
          <QuoteTemplateSettings />

          {/* Invoice Settings */}
          <Card id="invoices" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Invoice Settings
              </CardTitle>
              <CardDescription>Configure default settings for invoices and payments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                  <Input 
                    id="invoice-prefix"
                    value={invoiceSettings.prefix || ''}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, prefix: e.target.value})}
                    placeholder="INV"
                    data-testid="input-invoice-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-next-number">Next Invoice Number</Label>
                  <Input 
                    id="invoice-next-number"
                    type="number"
                    value={invoiceSettings.nextNumber || 1}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, nextNumber: parseInt(e.target.value) || 1})}
                    data-testid="input-invoice-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice-due-days">Default Due (days)</Label>
                  <Input 
                    id="invoice-due-days"
                    type="number"
                    value={invoiceSettings.defaultDueDays || 14}
                    onChange={(e) => setInvoiceSettings({...invoiceSettings, defaultDueDays: parseInt(e.target.value) || 14})}
                    data-testid="input-invoice-due-days"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Bank Details</p>
                <p className="text-sm text-muted-foreground">
                  Bank details are now managed in Document Themes for multi-tenant support.
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setLocation('/document-themes')}
                  className="mt-2"
                  data-testid="link-document-themes"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Go to Document Themes
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Reminders & Automation</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Email Reminders</p>
                      <p className="text-sm text-muted-foreground">Send email reminders for overdue invoices</p>
                    </div>
                    <Switch 
                      checked={invoiceSettings.emailRemindersDefault === 'true'}
                      onCheckedChange={(checked) => setInvoiceSettings({...invoiceSettings, emailRemindersDefault: checked ? 'true' : 'false'})}
                      data-testid="switch-invoice-email-reminders"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">SMS Reminders</p>
                      <p className="text-sm text-muted-foreground">Send SMS reminders for overdue invoices</p>
                    </div>
                    <Switch 
                      checked={invoiceSettings.smsRemindersDefault === 'true'}
                      onCheckedChange={(checked) => setInvoiceSettings({...invoiceSettings, smsRemindersDefault: checked ? 'true' : 'false'})}
                      data-testid="switch-invoice-sms-reminders"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Auto-Mark Paid</p>
                      <p className="text-sm text-muted-foreground">Automatically mark invoices paid when payment recorded</p>
                    </div>
                    <Switch 
                      checked={invoiceSettings.autoMarkPaid === 'true'}
                      onCheckedChange={(checked) => setInvoiceSettings({...invoiceSettings, autoMarkPaid: checked ? 'true' : 'false'})}
                      data-testid="switch-invoice-auto-mark-paid"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="invoice-reminder-message">Reminder Message</Label>
                    <Textarea 
                      id="invoice-reminder-message"
                      value={invoiceSettings.reminderMessage || ''}
                      onChange={(e) => setInvoiceSettings({...invoiceSettings, reminderMessage: e.target.value})}
                      placeholder="Enter the reminder message to send for overdue invoices..."
                      className="min-h-[60px]"
                      data-testid="textarea-invoice-reminder-message"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-terms">Default Terms & Conditions</Label>
                <Textarea 
                  id="invoice-terms"
                  value={invoiceSettings.defaultTerms || ''}
                  onChange={(e) => setInvoiceSettings({...invoiceSettings, defaultTerms: e.target.value})}
                  placeholder="Enter default payment terms..."
                  className="min-h-[80px]"
                  data-testid="textarea-invoice-terms"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveInvoiceSettings} disabled={documentSettingsSaving} data-testid="button-save-invoice-settings">
                  <Save className="mr-2 h-4 w-4" />
                  Save Invoice Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Order Settings */}
          <Card id="purchase-orders" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Purchase Order Settings
              </CardTitle>
              <CardDescription>Configure default settings for purchase orders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="po-prefix">PO Prefix</Label>
                  <Input 
                    id="po-prefix"
                    value={poSettings.prefix || ''}
                    onChange={(e) => setPoSettings({...poSettings, prefix: e.target.value})}
                    placeholder="PO"
                    data-testid="input-po-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="po-next-number">Next PO Number</Label>
                  <Input 
                    id="po-next-number"
                    type="number"
                    value={poSettings.nextNumber || 1}
                    onChange={(e) => setPoSettings({...poSettings, nextNumber: parseInt(e.target.value) || 1})}
                    data-testid="input-po-next-number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="po-delivery-days">Default Delivery (days)</Label>
                  <Input 
                    id="po-delivery-days"
                    type="number"
                    value={poSettings.defaultDueDays || 7}
                    onChange={(e) => setPoSettings({...poSettings, defaultDueDays: parseInt(e.target.value) || 7})}
                    data-testid="input-po-delivery-days"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="po-terms">Default Terms & Notes</Label>
                <Textarea 
                  id="po-terms"
                  value={poSettings.defaultTerms || ''}
                  onChange={(e) => setPoSettings({...poSettings, defaultTerms: e.target.value})}
                  placeholder="Enter default PO terms or delivery instructions..."
                  className="min-h-[80px]"
                  data-testid="textarea-po-terms"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSavePoSettings} disabled={documentSettingsSaving} data-testid="button-save-po-settings">
                  <Save className="mr-2 h-4 w-4" />
                  Save PO Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="notifications">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Configure how you receive updates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Report Summaries</p>
                  <p className="text-sm text-muted-foreground">Receive completed reports via email</p>
                </div>
                <Switch 
                  checked={notifications.emailReports}
                  onCheckedChange={(checked) => {
                    const updated = {...notifications, emailReports: checked};
                    setNotifications(updated);
                    localStorage.setItem('sbl_notifications', JSON.stringify(updated));
                  }}
                  data-testid="switch-email-reports"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified of new assignments</p>
                </div>
                <Switch 
                  checked={notifications.pushNotifications}
                  onCheckedChange={(checked) => {
                    const updated = {...notifications, pushNotifications: checked};
                    setNotifications(updated);
                    localStorage.setItem('sbl_notifications', JSON.stringify(updated));
                  }}
                  data-testid="switch-push-notifications"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Weekly Digest</p>
                  <p className="text-sm text-muted-foreground">Summary of weekly activity</p>
                </div>
                <Switch 
                  checked={notifications.weeklyDigest}
                  onCheckedChange={(checked) => {
                    const updated = {...notifications, weeklyDigest: checked};
                    setNotifications(updated);
                    localStorage.setItem('sbl_notifications', JSON.stringify(updated));
                  }}
                  data-testid="switch-weekly-digest"
                />
              </div>
            </CardContent>
          </Card>


          {/* Quick Links to Management Pages */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setLocation("/products")}
            data-testid="card-products-link"
          >
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Products & Materials</p>
                  <p className="text-sm text-muted-foreground">Manage items for quotes and invoices</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>

          {/* Job Numbering Settings */}
          <Card id="job-numbering">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                Job Numbering
              </CardTitle>
              <CardDescription>Configure prefix and numbering for jobs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="job-prefix">Job Prefix</Label>
                  <Input 
                    id="job-prefix"
                    value={jobNumberSettings.prefix || ''}
                    onChange={(e) => setJobNumberSettings({...jobNumberSettings, prefix: e.target.value})}
                    placeholder="JOB"
                    data-testid="input-job-prefix"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-next-number">Next Job Number</Label>
                  <Input 
                    id="job-next-number"
                    type="number"
                    value={jobNumberSettings.nextNumber || 1}
                    onChange={(e) => setJobNumberSettings({...jobNumberSettings, nextNumber: parseInt(e.target.value) || 1})}
                    data-testid="input-job-next-number"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Preview: {jobNumberSettings.prefix || 'JOB'}-{String(jobNumberSettings.nextNumber || 1).padStart(4, '0')}
              </p>
              <div className="flex justify-end">
                <Button onClick={handleSaveJobNumberSettings} disabled={documentSettingsSaving} data-testid="button-save-job-settings">
                  <Save className="mr-2 h-4 w-4" />
                  Save Job Settings
                </Button>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">Standardize Existing Job Numbers</h4>
                  <p className="text-sm text-muted-foreground">
                    Convert all existing jobs to the JOB-1456+ format for a consistent, professional appearance.
                  </p>
                </div>
                {jobMigrationStatus?.completed ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Migration completed {jobMigrationStatus.completedAt ? formatDateShort(jobMigrationStatus.completedAt) : ''}</span>
                  </div>
                ) : (
                  <Button 
                    onClick={handleRunJobMigration} 
                    disabled={jobMigrationRunning}
                    variant="outline"
                    data-testid="button-run-job-migration"
                  >
                    {jobMigrationRunning ? "Running..." : "Standardize Job Numbers"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Job Settings */}
          <Card id="job-timer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5" />
                Job Timer
              </CardTitle>
              <CardDescription>Configure job tracking features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Job Timer</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow tracking time spent on jobs. Useful for hourly billing.
                  </p>
                </div>
                <Switch
                  checked={jobTimerEnabled}
                  onCheckedChange={handleToggleJobTimer}
                  disabled={jobTimerLoading}
                  data-testid="switch-job-timer"
                />
              </div>
            </CardContent>
          </Card>

          {/* Job Templates */}
          <JobTemplatesSection />

          {/* Crew Members */}
          <CrewSection />

          <Card id="integrations" className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Integrations
              </CardTitle>
              <CardDescription>Connect to third-party accounting and business software</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center">
                          <span className="font-bold text-[#13B5EA]">X</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">Xero</h4>
                          <p className="text-xs text-muted-foreground">Accounting</p>
                        </div>
                      </div>
                      {xeroStatus?.connected ? (
                        <div className="flex flex-col items-end">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          {xeroStatus?.tenantName && <p className="text-xs text-green-600">{xeroStatus.tenantName}</p>}
                        </div>
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Sync invoices and payments with Xero accounting software.
                    </p>
                    <Button 
                      variant={xeroStatus?.connected ? "outline" : "default"}
                      size="sm" 
                      className="w-full"
                      onClick={() => xeroStatus?.connected ? handleXeroDisconnect() : handleXeroConnect()}
                      data-testid="button-connect-xero"
                    >
                      {xeroStatus?.connected ? (
                        <>Disconnect</>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Connect Xero
                        </>
                      )}
                    </Button>
                    
                    {/* Dev-only test webhook */}
                    {import.meta.env.DEV && (
                      <div className="mt-3 pt-3 border-t border-dashed">
                        <p className="text-xs text-muted-foreground mb-2">Test Webhook (Dev Only)</p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Invoice # (e.g. INV00021)"
                            className="text-xs h-8"
                            id="test-webhook-invoice"
                            data-testid="input-test-webhook-invoice"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs whitespace-nowrap"
                            data-testid="button-test-xero-webhook"
                            onClick={async () => {
                              const input = document.getElementById('test-webhook-invoice') as HTMLInputElement;
                              const invoiceNumber = input?.value?.trim();
                              if (!invoiceNumber) {
                                toast({ title: "Enter an invoice number", variant: "destructive" });
                                return;
                              }
                              try {
                                const res = await fetch('/api/xero/test-webhook', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ invoiceNumber }),
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  toast({ title: "Test Webhook Success", description: data.message });
                                } else {
                                  toast({ title: "Test Failed", description: data.error, variant: "destructive" });
                                }
                              } catch (err: unknown) {
                                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                                toast({ title: "Error", description: errorMessage, variant: "destructive" });
                              }
                            }}
                          >
                            Simulate Payment
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Xero Sync History */}
                {xeroStatus?.connected && xeroSyncHistory.length > 0 && (
                  <Card className="col-span-full border-2">
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Cloud className="h-4 w-4 text-[#13B5EA]" />
                        Recent Xero Sync Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Invoice</TableHead>
                              <TableHead className="text-xs">Action</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs">Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {xeroSyncHistory.slice(0, 10).map((sync: { id: string; invoiceNumber?: string; invoiceId?: string; action?: string; status?: string; syncedAt?: string }) => (
                              <TableRow key={sync.id}>
                                <TableCell className="text-xs py-2">
                                  {sync.invoiceNumber || (sync.invoiceId ? `Invoice #${sync.invoiceId.slice(0, 8)}` : 'Invoice')}
                                </TableCell>
                                <TableCell className="text-xs py-2 capitalize">
                                  {sync.action || '-'}
                                </TableCell>
                                <TableCell className="text-xs py-2">
                                  <Badge variant={sync.status === 'success' ? 'default' : sync.status === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                                    {sync.status || 'pending'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs py-2 text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {sync.syncedAt ? formatDateShort(sync.syncedAt) : '-'}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-[#6D2077]/10 flex items-center justify-center">
                          <span className="font-bold text-[#6D2077]">M</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">MYOB</h4>
                          <p className="text-xs text-muted-foreground">Accounting</p>
                        </div>
                      </div>
                      {integrations.myob.connected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect to MYOB for invoice and expense tracking.
                    </p>
                    <Button 
                      variant={integrations.myob.connected ? "outline" : "default"}
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: "MYOB Integration",
                          description: "MYOB integration requires API setup. Contact support for configuration."
                        });
                      }}
                      data-testid="button-connect-myob"
                    >
                      {integrations.myob.connected ? (
                        <>Disconnect</>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Connect MYOB
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-lg bg-[#2CA01C]/10 flex items-center justify-center">
                          <span className="font-bold text-[#2CA01C]">Q</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">QuickBooks</h4>
                          <p className="text-xs text-muted-foreground">Accounting</p>
                        </div>
                      </div>
                      {integrations.quickbooks.connected ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Sync with QuickBooks for complete financial management.
                    </p>
                    <Button 
                      variant={integrations.quickbooks.connected ? "outline" : "default"}
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        toast({
                          title: "QuickBooks Integration",
                          description: "QuickBooks integration requires API setup. Contact support for configuration."
                        });
                      }}
                      data-testid="button-connect-quickbooks"
                    >
                      {integrations.quickbooks.connected ? (
                        <>Disconnect</>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Connect QuickBooks
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Third-party integrations require API credentials and may need additional setup. 
                  Once connected, invoices and payments can be automatically synced with your accounting software.
                  Contact support for help setting up integrations.
                </p>
              </div>
            </CardContent>
          </Card>

          {user?.isSuperAdmin && (
            <Card id="super-admin" className="lg:col-span-2 border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  Super Admin
                </CardTitle>
                <CardDescription>Platform administration and organization management</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    As a super admin, you have access to platform-wide controls including organization management, 
                    billing overrides, and plan assignments.
                  </p>
                  <Button 
                    onClick={() => setLocation('/admin/organizations')}
                    className="w-full sm:w-auto"
                    data-testid="button-super-admin-organizations"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Organizations
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        <MobileLayout title="Settings">
          <div className="p-4 pb-24">
            {content}
          </div>
        </MobileLayout>
        <UpgradePrompt 
          open={showUpgradePrompt} 
          onClose={() => setShowUpgradePrompt(false)} 
          reason="crew_limit"
          currentPlan={planLimits.plan || "starter"}
        />
      </>
    );
  }

  return (
    <>
      <Layout>
        {content}
      </Layout>
      <UpgradePrompt 
        open={showUpgradePrompt} 
        onClose={() => setShowUpgradePrompt(false)} 
        reason="crew_limit"
        currentPlan={planLimits.plan || "starter"}
      />
    </>
  );
}
