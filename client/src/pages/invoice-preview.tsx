import { useState, useEffect, useCallback } from "react";
import { useRoute, useSearch } from "wouter";
import { DocumentPreviewLayout, type DocumentData } from "@/components/document-preview-layout";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { fetchInvoice, fetchInvoicePublic, fetchJobWithDocuments, fetchDocumentTheme, fetchDocumentThemeSettings, fetchDefaultDocumentTheme, createInvoiceCheckout, type DocumentTheme, type DocumentThemeSettings, type InvoiceWithItems } from "@/lib/api";
import type { InvoiceItem } from "@shared/schema";
import { Loader2, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDocumentPdf } from "@/lib/pdfmake-generator";
import { Button } from "@/components/ui/button";

interface InvoicePreviewProps {
  publicData?: InvoiceWithItems;
  publicToken?: string;
  creditCardEnabled?: boolean;
}

export default function InvoicePreview({ publicData, publicToken, creditCardEnabled }: InvoicePreviewProps = {}) {
  const [, previewParams] = useRoute("/preview/invoice/:id");
  const [, viewParams] = useRoute("/view/invoice/:id");
  const params = previewParams || viewParams;
  const isPublicView = !!viewParams || !!publicData;
  const { toast } = useToast();
  const searchString = useSearch();

  const [loading, setLoading] = useState(!publicData);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [theme, setTheme] = useState<DocumentTheme | null>(null);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoaded, setThemeSettingsLoaded] = useState(false);
  const [invoiceRaw, setInvoiceRaw] = useState<InvoiceWithItems | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'cancelled' | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const paymentResult = params.get('payment');
    if (paymentResult === 'success') {
      setPaymentStatus('success');
    } else if (paymentResult === 'cancelled') {
      setPaymentStatus('cancelled');
    }
  }, [searchString]);

  useEffect(() => {
    if (publicData) {
      processInvoiceData(publicData);
    } else if (params?.id) {
      loadInvoice(params.id);
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
          const docTypeSettings = settingsArray.find(s => s.documentType === 'invoice');
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
  
  const processInvoiceData = (invoice: InvoiceWithItems) => {
    setInvoiceRaw(invoice);
    const fullAddress = [invoice.address, invoice.suburb].filter(Boolean).join(', ');
    setDocumentData({
      type: 'invoice',
      id: invoice.id,
      number: invoice.invoiceNumber,
      date: invoice.issueDate || '',
      dueDate: invoice.dueDate || undefined,
      customerName: invoice.customerName || '',
      customerEmail: invoice.customerEmail || undefined,
      customerPhone: invoice.customerPhone || undefined,
      address: invoice.address || '',
      suburb: invoice.suburb || undefined,
      jobId: invoice.jobId || undefined,
      reference: invoice.reference || undefined,
      siteAddress: fullAddress || undefined,
      items: (invoice.items || []).map((item: InvoiceItem) => ({
        description: item.description,
        quantity: item.qty,
        unitPrice: item.unitCost,
        total: item.total,
        section: item.section || undefined
      })),
      subtotal: invoice.subtotal || 0,
      discount: invoice.discount || 0,
      gst: invoice.gst || 0,
      total: invoice.total || 0,
      notes: invoice.notes || undefined,
      terms: invoice.terms || undefined,
      status: invoice.status,
      amountPaid: invoice.amountPaid || 0,
      themeId: invoice.themeId || null
    });
    setLoading(false);
  };

  const loadInvoice = async (id: string) => {
    setLoading(true);
    try {
      const invoice = isPublicView ? await fetchInvoicePublic(id) : await fetchInvoice(id);
      if (!invoice) {
        toast({ title: "Invoice not found", variant: "destructive" });
        return;
      }

      let job = null;
      if (invoice.jobId) {
        const jobData = await fetchJobWithDocuments(invoice.jobId);
        job = jobData?.job;
      }

      const jobNum = job?.referenceNumber || undefined;
      const fullAddress = [job?.address, job?.suburb].filter(Boolean).join(', ');

      setDocumentData({
        type: 'invoice',
        id: invoice.id,
        number: invoice.invoiceNumber,
        date: invoice.issueDate || '',
        dueDate: invoice.dueDate || undefined,
        customerName: invoice.customerName || '',
        customerEmail: invoice.customerEmail || undefined,
        customerPhone: invoice.customerPhone || undefined,
        address: invoice.address || '',
        suburb: invoice.suburb || undefined,
        jobId: invoice.jobId || undefined,
        jobTitle: job?.title,
        jobAddress: fullAddress || undefined,
        jobNumber: jobNum,
        reference: invoice.reference || undefined,
        siteAddress: fullAddress || undefined,
        items: (invoice.items || []).map((item: InvoiceItem) => ({
          description: item.description,
          quantity: item.qty,
          unitPrice: item.unitCost,
          total: item.total,
          section: item.section || undefined
        })),
        subtotal: invoice.subtotal || 0,
        discount: invoice.discount || 0,
        gst: invoice.gst || 0,
        total: invoice.total || 0,
        notes: invoice.notes || undefined,
        terms: invoice.terms || undefined,
        status: invoice.status,
        amountPaid: invoice.amountPaid || 0,
        themeId: invoice.themeId || null
      });
    } catch (err) {
      console.error('Failed to load invoice:', err);
      toast({ title: "Failed to load invoice", variant: "destructive" });
    }
    setLoading(false);
  };

  const backUrl = documentData?.jobId ? `/jobs/${documentData.jobId}` : '/invoices';
  const editUrl = documentData?.id ? `/invoice/${documentData.id}` : '/invoices';
  
  const handlePayment = async () => {
    if (!publicToken) return;
    setPaymentLoading(true);
    try {
      const result = await createInvoiceCheckout(publicToken);
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to initiate payment';
      toast({ title: "Error", description: message, variant: "destructive" });
      setPaymentLoading(false);
    }
  };
  
  const amountDue = (invoiceRaw?.total || 0) - (invoiceRaw?.amountPaid || 0);
  const canPay = isPublicView && publicToken && creditCardEnabled && invoiceRaw?.creditCardEnabled && invoiceRaw?.status !== 'paid' && amountDue > 0 && paymentStatus !== 'success';

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
        <p className="text-muted-foreground">Invoice not found</p>
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
      
      {isPublicView && (paymentStatus || canPay || invoiceRaw?.status === 'paid') && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            {(paymentStatus === 'success' || invoiceRaw?.status === 'paid') && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Payment received - Thank you!</span>
              </div>
            )}
            {paymentStatus === 'cancelled' && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Payment was cancelled</span>
              </div>
            )}
            {canPay && (
              <>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Amount Due: </span>
                  <span className="text-lg font-bold text-gray-900">${amountDue.toFixed(2)}</span>
                </div>
                <Button 
                  onClick={handlePayment}
                  disabled={paymentLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-pay-invoice"
                >
                  {paymentLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Pay Now
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="invoice"
          documentId={documentData.id}
          documentNumber={documentData.number}
          recipientEmail={documentData.customerEmail || ""}
          recipientName={documentData.customerName}
          onSuccess={() => {
            toast({ title: "Invoice sent successfully" });
          }}
          getPdfBase64={getPdfBase64}
        />
      )}
    </>
  );
}
