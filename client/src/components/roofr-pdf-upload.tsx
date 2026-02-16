import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Sparkles, Loader2, Check, AlertCircle, ChevronRight, Ruler } from "lucide-react";
import type { QuoteTemplate, RoofReportExtraction } from "@shared/schema";

const MEASUREMENT_LABELS: Record<string, { label: string; unit: string }> = {
  totalRoofArea: { label: 'Total Roof Area', unit: 'm²' },
  pitchedRoofArea: { label: 'Pitched Area', unit: 'm²' },
  flatRoofArea: { label: 'Flat Area', unit: 'm²' },
  predominantPitch: { label: 'Predominant Pitch', unit: '°' },
  facetCount: { label: 'Facet Count', unit: '' },
  eaves: { label: 'Eaves', unit: 'm' },
  ridges: { label: 'Ridges', unit: 'm' },
  valleys: { label: 'Valleys', unit: 'm' },
  hips: { label: 'Hips', unit: 'm' },
  rakes: { label: 'Rakes', unit: 'm' },
  wallFlashing: { label: 'Wall Flashing', unit: 'm' },
  stepFlashing: { label: 'Step Flashing', unit: 'm' },
  parapetWall: { label: 'Parapet Wall', unit: 'm' },
  transitions: { label: 'Transitions', unit: 'm' },
};

export interface GeneratedQuoteItem {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  itemCode: string | null;
  costPrice: number | null;
  productId: string | null;
  sortOrder: number;
  measurementType?: string;
  measurementValue?: number;
  laborCost?: number | null;
}

interface RoofrPdfUploadProps {
  onItemsGenerated: (items: GeneratedQuoteItem[], extractionId: string) => void;
}

export function RoofrPdfUpload({ onItemsGenerated }: RoofrPdfUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<RoofReportExtraction | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["/api/quote-templates/active"],
    queryFn: async () => {
      const res = await fetch("/api/quote-templates/active");
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json() as Promise<QuoteTemplate[]>;
    },
  });

  const { data: defaultTemplate } = useQuery({
    queryKey: ["/api/quote-templates/default"],
    queryFn: async () => {
      const res = await fetch("/api/quote-templates/default");
      if (!res.ok) return null;
      return res.json() as Promise<QuoteTemplate | null>;
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('pdf')) {
      toast({ title: "Please upload a PDF file", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // Step 1: Request a presigned URL for the upload
      const requestRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || 'application/pdf',
        }),
      });

      if (!requestRes.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL, objectPath } = await requestRes.json();

      // Step 2: Upload file directly to presigned URL
      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'application/pdf',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      setUploadedFile({ name: file.name, url: objectPath });
      toast({ title: "PDF uploaded", description: "Now extracting measurements..." });
      
      // Auto-extract after upload
      await extractMeasurements(objectPath, file.name);
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: "Failed to upload file", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const extractMeasurements = async (pdfUrl: string, filename: string) => {
    setExtracting(true);
    try {
      const res = await fetch('/api/ai/extract-roofr-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl, filename }),
      });

      if (!res.ok) {
        throw new Error('Failed to extract measurements');
      }

      const data = await res.json();
      setExtraction(data.extraction);
      
      // Auto-select default template if available
      if (defaultTemplate?.id) {
        setSelectedTemplateId(defaultTemplate.id);
      } else if (templates.length > 0) {
        setSelectedTemplateId(templates[0].id);
      }
      
      toast({ 
        title: "Measurements extracted", 
        description: `Found ${countMeasurements(data.extraction)} measurements` 
      });
    } catch (error) {
      console.error('Extraction error:', error);
      toast({ title: "Failed to extract measurements", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  const countMeasurements = (ext: RoofReportExtraction) => {
    let count = 0;
    if (ext.totalRoofArea) count++;
    if (ext.pitchedRoofArea) count++;
    if (ext.flatRoofArea) count++;
    if (ext.eaves) count++;
    if (ext.ridges) count++;
    if (ext.valleys) count++;
    if (ext.hips) count++;
    if (ext.rakes) count++;
    if (ext.wallFlashing) count++;
    if (ext.stepFlashing) count++;
    if (ext.parapetWall) count++;
    return count;
  };

  const handleGenerateQuote = async () => {
    if (!extraction || !selectedTemplateId) {
      toast({ title: "Please select a template", variant: "destructive" });
      return;
    }
    
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-quote-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          extractionId: extraction.id, 
          templateId: selectedTemplateId 
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate items');
      }

      const data = await res.json();
      
      if (data.items.length === 0) {
        toast({ 
          title: "No items generated", 
          description: "The template mappings didn't match any extracted measurements",
          variant: "destructive" 
        });
        return;
      }

      onItemsGenerated(data.items, extraction.id);
      
      // Show historical context info if available
      let historicalInfo = '';
      if (data.historicalContext) {
        const parts = [];
        if (data.historicalContext.quotesAnalyzed > 0) {
          parts.push(`${data.historicalContext.quotesAnalyzed} RPrime quotes`);
        }
        if (data.historicalContext.importedPatterns > 0) {
          parts.push(`${data.historicalContext.importedPatterns} Tradify patterns`);
        }
        if (parts.length > 0) {
          historicalInfo = ` (pricing informed by ${parts.join(' + ')})`;
        }
      }
      toast({ 
        title: "Quote items generated", 
        description: `Added ${data.items.length} items totaling $${data.summary.subtotal.toFixed(2)}${historicalInfo}` 
      });
      setDialogOpen(false);
      resetState();
    } catch (error) {
      console.error('Generation error:', error);
      toast({ title: "Failed to generate quote items", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const resetState = () => {
    setExtraction(null);
    setUploadedFile(null);
    setSelectedTemplateId("");
  };

  const formatValue = (key: string, value: number | null) => {
    if (value === null || value === undefined) return '-';
    const meta = MEASUREMENT_LABELS[key];
    return `${value.toFixed(1)} ${meta?.unit || ''}`;
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open) resetState();
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-roofr-upload">
          <Sparkles className="h-4 w-4" />
          AI Auto-Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Auto-Quote from Roofr Report
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Step 1: Upload PDF */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={uploadedFile ? "default" : "outline"}>1</Badge>
              <span className="font-medium">Upload Roofr PDF</span>
              {uploadedFile && <Check className="h-4 w-4 text-green-500" />}
            </div>
            
            {!uploadedFile ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {uploading ? (
                    <>
                      <Loader2 className="h-10 w-10 mb-3 text-muted-foreground animate-spin" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 mb-3 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Click to upload Roofr PDF report</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  data-testid="input-roofr-pdf"
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5" />
                <span className="flex-1">{uploadedFile.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setUploadedFile(null);
                    setExtraction(null);
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Extraction Results */}
          {(extracting || extraction) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={extraction ? "default" : "outline"}>2</Badge>
                <span className="font-medium">Extracted Measurements</span>
                {extracting && <Loader2 className="h-4 w-4 animate-spin" />}
                {extraction && <Check className="h-4 w-4 text-green-500" />}
              </div>
              
              {extracting ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p className="text-muted-foreground">Analyzing PDF with AI...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : extraction ? (
                <Card>
                  <CardContent className="py-4">
                    {extraction.propertyAddress && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {extraction.propertyAddress}
                      </p>
                    )}
                    <ScrollArea className="h-[180px]">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(MEASUREMENT_LABELS).map(([key, { label }]) => {
                          const value = extraction[key as keyof RoofReportExtraction] as number | null;
                          if (value === null || value === undefined) return null;
                          return (
                            <div key={key} className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-sm text-muted-foreground">{label}</span>
                              <span className="text-sm font-medium">{formatValue(key, value)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {/* Step 3: Select Template */}
          {extraction && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant={selectedTemplateId ? "default" : "outline"}>3</Badge>
                <span className="font-medium">Select Quote Template</span>
              </div>
              
              {templates.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium">No templates found</p>
                        <p className="text-sm text-muted-foreground">
                          Create a quote template in Settings to use AI auto-quoting
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger data-testid="select-quote-template">
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          {t.name}
                          {t.isDefault === 'true' && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateQuote}
              disabled={!extraction || !selectedTemplateId || generating}
              data-testid="button-generate-quote-items"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Ruler className="h-4 w-4 mr-2" />
                  Generate Quote Items
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
