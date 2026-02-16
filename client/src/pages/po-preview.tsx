import { useState, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import { DocumentPreviewLayout, type DocumentData } from "@/components/document-preview-layout";
import { SendEmailDialog } from "@/components/send-email-dialog";
import { fetchPurchaseOrder, fetchPurchaseOrderPublic, fetchJobWithDocuments, fetchDocumentTheme, fetchDocumentThemeSettings, fetchDefaultDocumentTheme, type DocumentTheme, type DocumentThemeSettings, type PurchaseOrderWithItems } from "@/lib/api";
import type { PurchaseOrderItem } from "@shared/schema";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateDocumentPdf } from "@/lib/pdfmake-generator";

interface POPreviewProps {
  publicData?: PurchaseOrderWithItems;
}

export default function POPreview({ publicData }: POPreviewProps = {}) {
  const [, previewParams] = useRoute("/preview/po/:id");
  const [, viewParams] = useRoute("/view/po/:id");
  const params = previewParams || viewParams;
  const isPublicView = !!viewParams || !!publicData;
  const { toast } = useToast();

  const [loading, setLoading] = useState(!publicData);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [theme, setTheme] = useState<DocumentTheme | null>(null);
  const [themeSettings, setThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const [themeSettingsLoaded, setThemeSettingsLoaded] = useState(false);

  useEffect(() => {
    if (publicData) {
      processPOData(publicData);
    } else if (params?.id) {
      loadPO(params.id);
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
          const docTypeSettings = settingsArray.find(s => s.documentType === 'purchase_order');
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
  
  const processPOData = (po: PurchaseOrderWithItems) => {
    setDocumentData({
      type: 'purchase_order',
      id: po.id,
      number: po.poNumber,
      date: po.orderDate || '',
      dueDate: po.expectedDelivery || undefined,
      customerName: '',
      address: '',
      supplier: po.supplier || undefined,
      supplierContact: po.supplierContact || undefined,
      supplierPhone: po.supplierPhone || undefined,
      supplierEmail: po.supplierEmail || undefined,
      deliveryAddress: po.deliveryAddress || undefined,
      deliveryInstructions: po.deliveryInstructions || undefined,
      description: po.description || undefined,
      jobId: po.jobId || undefined,
      reference: po.reference || undefined,
      items: (po.items || []).map((item: PurchaseOrderItem) => ({
        description: item.description,
        quantity: item.qty,
        unitPrice: item.unitCost,
        total: item.total,
        section: item.section || undefined
      })),
      subtotal: po.subtotal || 0,
      discount: po.discount || 0,
      gst: po.gst || 0,
      total: po.total || 0,
      notes: po.notes || undefined,
      status: po.status,
      themeId: po.themeId || null
    });
    setLoading(false);
  };

  const loadPO = async (id: string) => {
    setLoading(true);
    try {
      const po = isPublicView ? await fetchPurchaseOrderPublic(id) : await fetchPurchaseOrder(id);
      if (!po) {
        toast({ title: "Purchase order not found", variant: "destructive" });
        return;
      }

      let job = null;
      if (po.jobId) {
        const jobData = await fetchJobWithDocuments(po.jobId);
        job = jobData?.job;
      }

      const jobNum = job?.referenceNumber || undefined;

      setDocumentData({
        type: 'purchase_order',
        id: po.id,
        number: po.poNumber,
        date: po.orderDate || '',
        dueDate: po.expectedDelivery || undefined,
        customerName: '',
        address: '',
        supplier: po.supplier || undefined,
        supplierContact: po.supplierContact || undefined,
        supplierPhone: po.supplierPhone || undefined,
        supplierEmail: po.supplierEmail || undefined,
        deliveryAddress: po.deliveryAddress || undefined,
        deliveryInstructions: po.deliveryInstructions || undefined,
        description: po.description || undefined,
        jobId: po.jobId || undefined,
        jobTitle: job?.title,
        jobAddress: job?.address || undefined,
        jobNumber: jobNum,
        reference: po.reference || undefined,
        items: (po.items || []).map((item: PurchaseOrderItem) => ({
          description: item.description,
          quantity: item.qty,
          unitPrice: item.unitCost,
          total: item.total,
          section: item.section || undefined
        })),
        subtotal: po.subtotal || 0,
        discount: po.discount || 0,
        gst: po.gst || 0,
        total: po.total || 0,
        notes: po.notes || undefined,
        status: po.status,
        themeId: po.themeId || null
      });
    } catch (err) {
      console.error('Failed to load purchase order:', err);
      toast({ title: "Failed to load purchase order", variant: "destructive" });
    }
    setLoading(false);
  };

  const backUrl = documentData?.jobId ? `/jobs/${documentData.jobId}` : '/purchase-orders';
  const editUrl = documentData?.id ? `/purchase-order/${documentData.id}` : '/purchase-orders';

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
        <p className="text-muted-foreground">Purchase order not found</p>
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

      {showEmailDialog && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          documentType="purchase_order"
          documentId={documentData.id}
          documentNumber={documentData.number}
          recipientEmail={documentData.supplierEmail || ""}
          recipientName={documentData.supplier || ""}
          onSuccess={() => {
            toast({ title: "Purchase order sent successfully" });
          }}
          getPdfBase64={getPdfBase64}
        />
      )}
    </>
  );
}
