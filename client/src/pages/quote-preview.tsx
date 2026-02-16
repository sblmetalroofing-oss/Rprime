import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { DocumentPreviewLayout, type DocumentData } from "@/components/document-preview-layout";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { fetchQuote, fetchQuotePublic, fetchJobWithDocuments, fetchDocumentTheme, fetchDocumentThemeSettings, fetchDefaultDocumentTheme, acceptQuotePublic, declineQuotePublic, type DocumentTheme, type DocumentThemeSettings, type QuoteWithItems } from "@/lib/api";
import type { QuoteItem } from "@shared/schema";
import { Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDocumentPdf } from "@/lib/pdfmake-generator";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface QuotePreviewProps {
  publicData?: QuoteWithItems;
  publicToken?: string;
  acceptDeclineEnabled?: boolean;
}

export default function QuotePreview({ publicData, publicToken, acceptDeclineEnabled }: QuotePreviewProps = {}) {
  const [, previewParams] = useRoute("/preview/quote/:id");
  const [, viewParams] = useRoute("/view/quote/:id");
  const params = previewParams || viewParams;
  const isPublicView = !!viewParams || !!publicData;
  const { toast } = useToast();

  const [loading, setLoading] = useState(!publicData);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [quoteRaw, setQuoteRaw] = useState<QuoteWithItems | null>(null);
  const [theme, setTheme] = useState<DocumentTheme | null>(null);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoaded, setThemeSettingsLoaded] = useState(false);
  
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<'pending' | 'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (publicData) {
      if (publicData.acceptedAt) {
        setQuoteStatus('accepted');
      } else if (publicData.declinedAt) {
        setQuoteStatus('declined');
      } else {
        setQuoteStatus('pending');
      }
      processQuoteData(publicData);
    } else if (params?.id) {
      loadQuote(params.id);
    }
  }, [params?.id, publicData]);

  useEffect(() => {
    if (!documentData) return;
    
    setThemeSettingsLoaded(false);
    
    const loadTheme = async () => {
      try {
        let loadedTheme: DocumentTheme | null = null;
        
        if (documentData.themeId) {
          const specificTheme = await fetchDocumentTheme(documentData.themeId);
          if (specificTheme) {
            loadedTheme = specificTheme;
          }
        }
        
        if (!loadedTheme) {
          loadedTheme = await fetchDefaultDocumentTheme();
        }
        
        setTheme(loadedTheme);
        
        if (loadedTheme?.id) {
          const settingsArray = await fetchDocumentThemeSettings(loadedTheme.id);
          const docTypeSettings = settingsArray.find(s => s.documentType === 'quote');
          setThemeSettings(docTypeSettings || null);
        }
        
        setThemeSettingsLoaded(true);
      } catch (error) {
        console.error('Error loading theme:', error);
        setThemeSettingsLoaded(true);
      }
    };
    loadTheme();
  }, [documentData?.themeId]);
  
  const processQuoteData = (quote: QuoteWithItems) => {
    setQuoteRaw(quote);
    const fullAddress = [quote.address, quote.suburb].filter(Boolean).join(', ');
    setDocumentData({
      type: 'quote',
      id: quote.id,
      number: quote.quoteNumber,
      date: quote.createdAt ? new Date(quote.createdAt).toISOString().split('T')[0] : (quote.updatedAt ? new Date(quote.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
      dueDate: quote.validUntil || undefined,
      customerName: quote.customerName || '',
      customerEmail: quote.customerEmail || undefined,
      customerPhone: quote.customerPhone || undefined,
      address: quote.address || '',
      suburb: quote.suburb || undefined,
      jobId: quote.jobId || undefined,
      reference: quote.reference || undefined,
      siteAddress: fullAddress || undefined,
      items: (quote.items || []).map((item: QuoteItem) => ({
        description: item.description,
        quantity: item.qty,
        unitPrice: item.unitCost,
        total: item.total,
        section: item.section || undefined
      })),
      subtotal: quote.subtotal || 0,
      discount: quote.discount || 0,
      gst: quote.gst || 0,
      total: quote.total || 0,
      notes: quote.notes || undefined,
      terms: quote.terms || undefined,
      status: quote.status,
      themeId: quote.themeId || null
    });
    setLoading(false);
  };

  const loadQuote = async (id: string) => {
    setLoading(true);
    try {
      const quote = isPublicView ? await fetchQuotePublic(id) : await fetchQuote(id);
      if (!quote) {
        toast({ title: "Quote not found", variant: "destructive" });
        return;
      }
      setQuoteRaw(quote);

      let job = null;
      if (quote.jobId) {
        const jobData = await fetchJobWithDocuments(quote.jobId);
        job = jobData?.job;
      }

      const jobNum = job?.referenceNumber || undefined;
      const fullAddress = [job?.address, job?.suburb].filter(Boolean).join(', ');

      setDocumentData({
        type: 'quote',
        id: quote.id,
        number: quote.quoteNumber,
        date: quote.createdAt ? new Date(quote.createdAt).toISOString().split('T')[0] : (quote.updatedAt ? new Date(quote.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        dueDate: quote.validUntil || undefined,
        customerName: quote.customerName || '',
        customerEmail: quote.customerEmail || undefined,
        customerPhone: quote.customerPhone || undefined,
        address: quote.address || '',
        suburb: quote.suburb || undefined,
        jobId: quote.jobId || undefined,
        jobTitle: job?.title,
        jobAddress: fullAddress || undefined,
        jobNumber: jobNum,
        reference: quote.reference || undefined,
        siteAddress: fullAddress || undefined,
        items: (quote.items || []).map((item: QuoteItem) => ({
          description: item.description,
          quantity: item.qty,
          unitPrice: item.unitCost,
          total: item.total,
          section: item.section || undefined
        })),
        subtotal: quote.subtotal || 0,
        discount: quote.discount || 0,
        gst: quote.gst || 0,
        total: quote.total || 0,
        notes: quote.notes || undefined,
        terms: quote.terms || undefined,
        status: quote.status,
        themeId: quote.themeId || null
      });
    } catch (err) {
      console.error('Failed to load quote:', err);
      toast({ title: "Failed to load quote", variant: "destructive" });
    }
    setLoading(false);
  };

  const backUrl = documentData?.jobId ? `/jobs/${documentData.jobId}` : '/quotes';
  const editUrl = documentData?.id ? `/quote/${documentData.id}` : '/quotes';
  
  const handleAccept = async () => {
    if (!publicToken) return;
    setAcceptLoading(true);
    try {
      await acceptQuotePublic(publicToken, quoteRaw?.customerName || undefined);
      setQuoteStatus('accepted');
      toast({ title: "Quote accepted", description: "Thank you for accepting this quote." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to accept quote';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setAcceptLoading(false);
    }
  };
  
  const handleDecline = async () => {
    if (!publicToken) return;
    setDeclineLoading(true);
    try {
      await declineQuotePublic(publicToken, declineReason || undefined);
      setQuoteStatus('declined');
      setShowDeclineDialog(false);
      toast({ title: "Quote declined", description: "The quote has been declined." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to decline quote';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setDeclineLoading(false);
    }
  };
  
  const canAcceptDecline = isPublicView && publicToken && quoteStatus === 'pending' && acceptDeclineEnabled;

  const getPdfBase64 = useCallback(async (): Promise<string> => {
    if (!documentData) throw new Error('No document data');
    if (theme === null) throw new Error('Theme is still loading');
    if (!themeSettingsLoaded) throw new Error('Theme settings are still loading');

    return generateDocumentPdf({
      document: documentData,
      theme,
      themeSettings
    });
  }, [documentData, theme, themeSettings, themeSettingsLoaded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-muted-foreground">Quote not found</p>
      </div>
    );
  }

  return (
    <>
      <DocumentPreviewLayout
        document={documentData}
        backUrl={backUrl}
        editUrl={editUrl}
        onEmail={() => setShowEmailDialog(true)}
        isPublicView={isPublicView}
        theme={theme}
        themeSettings={themeSettings}
      />
      
      {isPublicView && quoteStatus && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {quoteStatus === 'accepted' && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">This quote has been accepted</span>
              </div>
            )}
            {quoteStatus === 'declined' && (
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-5 w-5" />
                <span className="font-medium">This quote has been declined</span>
              </div>
            )}
            {canAcceptDecline && (
              <>
                <div className="text-sm text-gray-600">
                  Review this quote and choose to accept or decline
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowDeclineDialog(true)}
                    disabled={declineLoading}
                    data-testid="button-decline-quote"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                  <Button 
                    onClick={handleAccept}
                    disabled={acceptLoading}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-accept-quote"
                  >
                    {acceptLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Accept Quote
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="quote"
          documentId={documentData.id}
          documentNumber={documentData.number}
          recipientEmail={documentData.customerEmail || ""}
          recipientName={documentData.customerName}
          onSuccess={() => {
            toast({ title: "Quote sent successfully" });
          }}
          getPdfBase64={getPdfBase64}
        />
      )}
      
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quote</DialogTitle>
            <DialogDescription>
              Let us know why you're declining this quote (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="decline-reason">Reason for declining</Label>
            <Textarea
              id="decline-reason"
              placeholder="Please provide a reason (optional)"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              className="mt-2"
              data-testid="input-decline-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDecline}
              disabled={declineLoading}
              data-testid="button-confirm-decline"
            >
              {declineLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Decline Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
