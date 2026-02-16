import { useState, useEffect, useRef } from "react";
import { Layout } from "@/components/layout";
import { MobileLayout } from "@/components/mobile-layout";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams, Link } from "wouter";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { ArrowLeft, Save, Upload, Trash2, X } from "lucide-react";
import type { DocumentTheme, InsertDocumentTheme, DocumentThemeSettings } from "@shared/schema";

function getThemeIdFromPath(): string | null {
  const path = window.location.pathname;
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment || lastSegment === 'new' || lastSegment === 'default' || lastSegment === 'theme-editor') {
    return null;
  }
  return lastSegment;
}

type DocumentSettingsMap = {
  quote: Partial<DocumentThemeSettings>;
  invoice: Partial<DocumentThemeSettings>;
  purchase_order: Partial<DocumentThemeSettings>;
};

const defaultSettings = (docType: string): Partial<DocumentThemeSettings> => ({
  documentType: docType,
  documentTitle: docType === 'quote' ? 'QUOTE' : docType === 'invoice' ? 'TAX INVOICE' : 'PURCHASE ORDER',
  draftTitle: docType === 'quote' ? 'DRAFT QUOTE' : docType === 'invoice' ? 'DRAFT INVOICE' : 'DRAFT PURCHASE ORDER',
  defaultTerms: '',
  showJobNumber: 'true',
  showJobAddress: 'true',
  showReference: 'true',
  showDescription: 'true',
  showQuantity: 'true',
  showUnitPrice: 'true',
  showDiscount: 'true',
  showAmount: 'true',
  showNotes: 'true',
  descriptionPosition: 'below'
});

export default function ThemeEditor() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const loadedThemeIdRef = useRef<string | null>(null);
  
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("theme");
  const [theme, setTheme] = useState<Partial<InsertDocumentTheme> & { id?: string }>({
    name: "",
    themeColor: "#0891b2",
    companyName: "",
    abn: "",
    licenseNumber: "",
    email1: "",
    email2: "",
    phone: "",
    website: "",
    address: "",
    logoUrl: "",
    logoPosition: "left",
    termsUrl: "",
    customLink1Label: "",
    customLink1Url: "",
    customLink2Label: "",
    customLink2Url: "",
    bankName: "",
    bankBsb: "",
    bankAccountNumber: "",
    bankAccountName: "",
    payId: "",
    isDefault: "false",
    isArchived: "false"
  });
  
  const [documentSettings, setDocumentSettings] = useState<DocumentSettingsMap>({
    quote: defaultSettings('quote'),
    invoice: defaultSettings('invoice'),
    purchase_order: defaultSettings('purchase_order')
  });

  useEffect(() => {
    loadingRef.current = false;
    if (isNew) {
      setLoading(false);
      return;
    }
    if (params.id) {
      if (params.id === "default") {
        loadDefaultTheme();
      } else {
        loadTheme(params.id);
      }
    } else {
      setLoading(false);
    }
  }, [params.id, isNew]);

  const loadDefaultTheme = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      const response = await fetch("/api/document-themes/default");
      if (response.ok) {
        const data = await response.json();
        if (data && data.id) {
          loadingRef.current = false;
          setLocation(`/theme-editor/${data.id}`, { replace: true });
          return;
        } else {
          loadingRef.current = false;
          toast({ title: "No Default Theme", description: "Create a new theme to get started" });
          setLocation("/theme-editor/new", { replace: true });
          return;
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Could not load default theme" });
        setLocation("/document-themes");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load default theme" });
      setLocation("/document-themes");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const loadTheme = async (id: string) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      const [themeRes, settingsRes] = await Promise.all([
        fetch(`/api/document-themes/${id}`),
        fetch(`/api/document-themes/${id}/settings`)
      ]);
      
      if (themeRes.ok) {
        const data = await themeRes.json();
        if (data && data.id) {
          setTheme(data);
          setThemeId(data.id);
          loadedThemeIdRef.current = data.id;
        } else {
          toast({ variant: "destructive", title: "Error", description: "Theme not found" });
          setLocation("/document-themes");
          return;
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "Theme not found" });
        setLocation("/document-themes");
        return;
      }
      
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        const newSettings: DocumentSettingsMap = {
          quote: defaultSettings('quote'),
          invoice: defaultSettings('invoice'),
          purchase_order: defaultSettings('purchase_order')
        };
        for (const s of settings) {
          const docType = s.documentType as keyof DocumentSettingsMap;
          if (docType === 'quote' || docType === 'invoice' || docType === 'purchase_order') {
            newSettings[docType] = s;
          }
        }
        setDocumentSettings(newSettings);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load theme" });
      setLocation("/document-themes");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!theme.name) {
      toast({ variant: "destructive", title: "Required", description: "Theme name is required" });
      return;
    }

    const urlId = getThemeIdFromPath();
    const effectiveId = loadedThemeIdRef.current || themeId || theme.id || params.id || urlId;
    
    if (!isNew && !effectiveId) {
      toast({ variant: "destructive", title: "Error", description: "Theme is still loading - please wait and try again" });
      return;
    }

    try {
      setSaving(true);
      const url = isNew ? "/api/document-themes" : `/api/document-themes/${effectiveId}`;
      const method = isNew ? "POST" : "PUT";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme)
      });

      if (response.ok) {
        const savedTheme = await response.json();
        const themeIdToUse = savedTheme.id || effectiveId;
        
        const settingsArray = [
          { ...documentSettings.quote, themeId: themeIdToUse, documentType: 'quote' },
          { ...documentSettings.invoice, themeId: themeIdToUse, documentType: 'invoice' },
          { ...documentSettings.purchase_order, themeId: themeIdToUse, documentType: 'purchase_order' }
        ];
        
        await fetch(`/api/document-themes/${themeIdToUse}/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsArray)
        });
        
        toast({ title: "Saved", description: `Theme ${isNew ? 'created' : 'updated'} successfully` });
        setLocation("/document-themes");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save theme" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    const id = loadedThemeIdRef.current || themeId || theme.id || params.id || getThemeIdFromPath();
    if (isNew || !id) return;
    try {
      const response = await fetch(`/api/document-themes/${id}/set-default`, { method: "POST" });
      if (response.ok) {
        setTheme(prev => ({ ...prev, isDefault: 'true' }));
        toast({ title: "Default Set", description: "This theme is now the default" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to set default" });
    }
  };

  const handleArchive = async (archive: boolean) => {
    const id = loadedThemeIdRef.current || themeId || theme.id || params.id || getThemeIdFromPath();
    if (isNew || !id) return;
    try {
      const response = await fetch(`/api/document-themes/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: archive })
      });
      if (response.ok) {
        setTheme(prev => ({ ...prev, isArchived: archive ? 'true' : 'false' }));
        toast({ title: archive ? "Archived" : "Restored", description: `Theme ${archive ? 'archived' : 'restored'}` });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update archive status" });
    }
  };

  const handleDelete = async () => {
    const id = loadedThemeIdRef.current || themeId || theme.id || params.id || getThemeIdFromPath();
    if (isNew || !id) return;
    if (!confirm("Are you sure you want to delete this theme?")) return;
    try {
      const response = await fetch(`/api/document-themes/${id}`, { method: "DELETE" });
      if (response.ok) {
        toast({ title: "Deleted", description: "Theme deleted successfully" });
        setLocation("/document-themes");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete theme" });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max file size is 10MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setTheme(prev => ({ ...prev, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const updateDocSetting = (docType: 'quote' | 'invoice' | 'purchase_order', field: string, value: string) => {
    setDocumentSettings(prev => ({
      ...prev,
      [docType]: { ...prev[docType], [field]: value }
    }));
  };

  const DocumentTypeSettingsTab = ({ docType, label }: { docType: 'quote' | 'invoice' | 'purchase_order'; label: string }) => {
    const settings = documentSettings[docType];
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="font-medium text-muted-foreground">Document Titles</h3>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Document Title</Label>
              <Input
                value={settings.documentTitle || ""}
                onChange={(e) => updateDocSetting(docType, 'documentTitle', e.target.value)}
                placeholder={docType === 'quote' ? 'QUOTE' : docType === 'invoice' ? 'TAX INVOICE' : 'PURCHASE ORDER'}
                className="h-11"
                data-testid={`input-${docType}-title`}
              />
              <p className="text-sm text-muted-foreground">This appears as the main title on your {label.toLowerCase()}</p>
            </div>
            <div className="grid gap-2">
              <Label>Draft Title</Label>
              <Input
                value={settings.draftTitle || ""}
                onChange={(e) => updateDocSetting(docType, 'draftTitle', e.target.value)}
                placeholder={docType === 'quote' ? 'DRAFT QUOTE' : docType === 'invoice' ? 'DRAFT INVOICE' : 'DRAFT PURCHASE ORDER'}
                className="h-11"
                data-testid={`input-${docType}-draft-title`}
              />
              <p className="text-sm text-muted-foreground">Used when the document is in draft status</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-medium text-muted-foreground">Default Terms</h3>
          <Textarea
            value={settings.defaultTerms || ""}
            onChange={(e) => updateDocSetting(docType, 'defaultTerms', e.target.value)}
            placeholder="Enter default terms and conditions..."
            className="min-h-[120px]"
            data-testid={`textarea-${docType}-terms`}
          />
          <p className="text-sm text-muted-foreground">These terms will be pre-filled when creating new {label.toLowerCase()}</p>
        </div>

        <Separator />

        <div className="space-y-4">
          <h3 className="font-medium text-muted-foreground">Field Visibility</h3>
          <p className="text-sm text-muted-foreground">Choose which fields to display on your {label.toLowerCase()}</p>
          
          <div className="space-y-3">
            {[
              { key: 'showJobNumber', label: 'Show Job Number' },
              { key: 'showJobAddress', label: 'Show Job Address' },
              { key: 'showReference', label: 'Show Reference' },
              { key: 'showDescription', label: 'Show Description' },
              { key: 'showQuantity', label: 'Show Quantity' },
              { key: 'showUnitPrice', label: 'Show Unit Price' },
              { key: 'showDiscount', label: 'Show Discount' },
              { key: 'showAmount', label: 'Show Amount' },
              { key: 'showNotes', label: 'Show Notes' }
            ].map(({ key, label: fieldLabel }) => (
              <div key={key} className="flex items-center justify-between py-2">
                <Label>{fieldLabel}</Label>
                <Switch
                  checked={settings[key as keyof typeof settings] === 'true'}
                  onCheckedChange={(checked) => updateDocSetting(docType, key, checked ? 'true' : 'false')}
                  data-testid={`switch-${docType}-${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const themeTabContent = (
    <>
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Theme Name *</Label>
          <Input
            id="name"
            value={theme.name || ""}
            onChange={(e) => setTheme(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Standard Theme"
            className="h-11"
            data-testid="input-theme-name"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <Label htmlFor="themeColor">Theme Colour</Label>
          <input
            type="color"
            id="themeColor"
            value={theme.themeColor || "#0891b2"}
            onChange={(e) => setTheme(prev => ({ ...prev, themeColor: e.target.value }))}
            className="w-10 h-10 rounded-full border cursor-pointer"
            data-testid="input-theme-color"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-medium text-muted-foreground">Contact Details</h3>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={theme.companyName || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="Your Company Pty Ltd"
              className="h-11"
              data-testid="input-company-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="abn">ABN</Label>
            <Input
              id="abn"
              value={theme.abn || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, abn: e.target.value }))}
              placeholder="12 345 678 901"
              className="h-11"
              data-testid="input-abn"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="licenseNumber">License Number (QBCC/Builder)</Label>
            <Input
              id="licenseNumber"
              value={theme.licenseNumber || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, licenseNumber: e.target.value }))}
              placeholder="152 85249"
              className="h-11"
              data-testid="input-license"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email1">Email 1</Label>
            <Input
              id="email1"
              type="email"
              value={theme.email1 || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, email1: e.target.value }))}
              placeholder="accounts@company.com"
              className="h-11"
              data-testid="input-email1"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email2">Email 2</Label>
            <Input
              id="email2"
              type="email"
              value={theme.email2 || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, email2: e.target.value }))}
              placeholder="admin@company.com"
              className="h-11"
              data-testid="input-email2"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={theme.phone || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="0435 222 683"
              className="h-11"
              data-testid="input-phone"
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-medium text-muted-foreground">Logo Settings</h3>
        {theme.logoUrl ? (
          <div className="border rounded-lg p-4 space-y-4">
            <img src={theme.logoUrl} alt="Logo preview" className="max-h-24 object-contain" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-11 flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
              <Button variant="outline" onClick={() => setTheme(prev => ({ ...prev, logoUrl: "" }))} className="h-11 flex-1 text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Logo
              </Button>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              This logo will be used on your quotes and invoices.<br />
              Recommended size: 2040 x 360 pixels. Max: 10MB.<br />
              Acceptable file types are .jpg, .png
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="h-11">
              <Upload className="h-4 w-4 mr-2" />
              Upload Logo
            </Button>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleLogoUpload} />
        <div className="flex items-center justify-between py-2">
          <Label>Logo Position</Label>
          <Select value={theme.logoPosition || "left"} onValueChange={(v) => setTheme(prev => ({ ...prev, logoPosition: v }))}>
            <SelectTrigger className="w-32 h-11" data-testid="select-logo-position">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-medium text-muted-foreground">Footer Links</h3>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="termsUrl">Terms & Conditions URL</Label>
            <Input
              id="termsUrl"
              value={theme.termsUrl || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, termsUrl: e.target.value }))}
              placeholder="https://yourwebsite.com/terms"
              className="h-11"
              data-testid="input-terms-url"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label>Custom Link 1 Label</Label>
              <Input
                value={theme.customLink1Label || ""}
                onChange={(e) => setTheme(prev => ({ ...prev, customLink1Label: e.target.value }))}
                placeholder="Colour Confirmation"
                className="h-11"
              />
            </div>
            <div className="grid gap-2">
              <Label>Custom Link 1 URL</Label>
              <Input
                value={theme.customLink1Url || ""}
                onChange={(e) => setTheme(prev => ({ ...prev, customLink1Url: e.target.value }))}
                placeholder="https://..."
                className="h-11"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="font-medium text-muted-foreground">Payment Details</h3>
        <p className="text-sm text-muted-foreground">Bank details shown on invoices for direct deposit payments</p>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              value={theme.bankName || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="Commonwealth Bank"
              className="h-11"
              data-testid="input-bank-name"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="bankBsb">BSB</Label>
              <Input
                id="bankBsb"
                value={theme.bankBsb || ""}
                onChange={(e) => setTheme(prev => ({ ...prev, bankBsb: e.target.value }))}
                placeholder="084 034"
                className="h-11"
                data-testid="input-bank-bsb"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bankAccountNumber">Account Number</Label>
              <Input
                id="bankAccountNumber"
                value={theme.bankAccountNumber || ""}
                onChange={(e) => setTheme(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                placeholder="262209365"
                className="h-11"
                data-testid="input-bank-account"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bankAccountName">Account Name</Label>
            <Input
              id="bankAccountName"
              value={theme.bankAccountName || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, bankAccountName: e.target.value }))}
              placeholder="Your Company Pty Ltd"
              className="h-11"
              data-testid="input-bank-account-name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payId">PayID (Optional)</Label>
            <Input
              id="payId"
              value={theme.payId || ""}
              onChange={(e) => setTheme(prev => ({ ...prev, payId: e.target.value }))}
              placeholder="ABN or phone number"
              className="h-11"
              data-testid="input-pay-id"
            />
          </div>
        </div>
      </div>

      {!isNew && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="font-medium text-muted-foreground">More Options</h3>
            {theme.isDefault !== 'true' && (
              <Button variant="outline" onClick={handleSetDefault} className="w-full h-11" data-testid="button-set-default">
                Set as Default Theme
              </Button>
            )}
            {theme.isDefault !== 'true' && (
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Archive this item</p>
                  <p className="text-sm text-muted-foreground">
                    {theme.isDefault === 'true' ? "The default document theme can't be archived" : "Hide this theme from the list"}
                  </p>
                </div>
                <Switch
                  checked={theme.isArchived === 'true'}
                  onCheckedChange={(checked) => handleArchive(checked)}
                  disabled={theme.isDefault === 'true'}
                  data-testid="switch-archive"
                />
              </div>
            )}
            {theme.isDefault !== 'true' && (
              <Button variant="destructive" onClick={handleDelete} className="w-full h-11" data-testid="button-delete">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Theme
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );

  const content = (
    <div className="space-y-6">
      <Breadcrumb className="mb-4 hidden md:block">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/settings" data-testid="breadcrumb-settings">Settings</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/document-themes" data-testid="breadcrumb-themes">Document Themes</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage data-testid="breadcrumb-current">
              {isNew ? "New Theme" : "Edit Theme"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center justify-between sticky top-0 bg-background z-10 py-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/document-themes")} className="h-11 w-11" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">{isNew ? "New Theme" : "Edit Document Theme"}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="h-11" data-testid="button-save">
          {saving ? "Saving..." : loading ? "Loading..." : "Save"}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="theme" data-testid="tab-theme">Theme</TabsTrigger>
            <TabsTrigger value="quotes" data-testid="tab-quotes">Quotes</TabsTrigger>
            <TabsTrigger value="invoices" data-testid="tab-invoices">Invoices</TabsTrigger>
            <TabsTrigger value="purchase_orders" data-testid="tab-purchase-orders">Purchase Orders</TabsTrigger>
          </TabsList>
          <TabsContent value="theme" className="space-y-6 mt-6">
            {themeTabContent}
          </TabsContent>
          <TabsContent value="quotes" className="mt-6">
            <DocumentTypeSettingsTab docType="quote" label="Quotes" />
          </TabsContent>
          <TabsContent value="invoices" className="mt-6">
            <DocumentTypeSettingsTab docType="invoice" label="Invoices" />
          </TabsContent>
          <TabsContent value="purchase_orders" className="mt-6">
            <DocumentTypeSettingsTab docType="purchase_order" label="Purchase Orders" />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <MobileLayout title={isNew ? "New Theme" : "Edit Theme"} backHref="/document-themes">
        <div className="p-4 pb-24">
          {content}
        </div>
      </MobileLayout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-2xl mx-auto py-6 px-4">
        {content}
      </div>
    </Layout>
  );
}
