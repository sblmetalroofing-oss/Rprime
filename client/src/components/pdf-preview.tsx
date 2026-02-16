import { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import type { DocumentTheme, DocumentThemeSettings } from "@/lib/api";
import { DocumentTemplate, type DocumentData } from "./document-preview-layout";

interface PdfPreviewProps {
  open: boolean;
  onClose: () => void;
  document: DocumentData;
  theme?: DocumentTheme | null;
  themeSettings?: DocumentThemeSettings | null;
}

interface QuoteLineItem {
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  section?: string | null;
}

interface QuoteInput {
  id: string;
  quoteNumber: string;
  quoteDate?: string | null;
  validUntil?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  address?: string | null;
  suburb?: string | null;
  reference?: string | null;
  items?: QuoteLineItem[];
  subtotal?: number;
  gst?: number;
  total?: number;
  notes?: string | null;
  terms?: string | null;
}

interface JobInput {
  title?: string | null;
  address?: string | null;
  suburb?: string | null;
  referenceNumber?: string | null;
}

interface InvoiceLineItem {
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  section?: string | null;
}

interface InvoiceInput {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  address?: string | null;
  suburb?: string | null;
  reference?: string | null;
  items?: InvoiceLineItem[];
  subtotal?: number;
  gst?: number;
  total?: number;
  notes?: string | null;
  terms?: string | null;
  status?: string | null;
  amountPaid?: number;
}

interface PurchaseOrderLineItem {
  description: string;
  qty: number;
  unitCost: number;
  total: number;
  section?: string | null;
}

interface PurchaseOrderInput {
  id: string;
  poNumber: string;
  orderDate?: string | null;
  expectedDelivery?: string | null;
  supplier?: string | null;
  supplierContact?: string | null;
  supplierPhone?: string | null;
  supplierEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryInstructions?: string | null;
  description?: string | null;
  reference?: string | null;
  items?: PurchaseOrderLineItem[];
  subtotal?: number;
  discount?: number;
  gst?: number;
  total?: number;
  notes?: string | null;
  status?: string | null;
}

export async function generatePdfBase64(documentData: DocumentData, theme?: DocumentTheme | null, themeSettings?: DocumentThemeSettings | null): Promise<string> {
  return new Promise((resolve, reject) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const templateDiv = document.createElement('div');
    container.appendChild(templateDiv);

    const root = createRoot(templateDiv);
    const templateRef = { current: null as HTMLDivElement | null };

    const TemplateWrapper = () => {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        templateRef.current = ref.current;
      }, []);
      return <DocumentTemplate document={documentData} templateRef={ref} theme={theme} themeSettings={themeSettings} />;
    };

    root.render(<TemplateWrapper />);

    setTimeout(async () => {
      try {
        if (!templateRef.current) {
          throw new Error('Template ref not available');
        }

        const element = templateRef.current;
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight
        });

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        
        const widthRatio = pdfWidth / canvasWidth;
        const pageHeightInCanvas = Math.floor(pdfHeight / widthRatio);
        const totalPages = Math.ceil(canvasHeight / pageHeightInCanvas);
        
        for (let page = 0; page < totalPages; page++) {
          const sourceY = page * pageHeightInCanvas;
          const sourceHeight = Math.min(pageHeightInCanvas, canvasHeight - sourceY);
          
          if (sourceHeight <= 0) continue;
          
          if (page > 0) {
            pdf.addPage();
          }
          
          const destHeight = Math.min(sourceHeight * widthRatio, pdfHeight);
          
          const pageCanvas = window.document.createElement('canvas');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0, sourceY, canvasWidth, sourceHeight,
              0, 0, canvasWidth, sourceHeight
            );
          }
          
          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, destHeight);
        }

        const pdfOutput = pdf.output('datauristring');
        const base64 = pdfOutput.split(',')[1];

        root.unmount();
        document.body.removeChild(container);

        resolve(base64);
      } catch (error) {
        root.unmount();
        document.body.removeChild(container);
        reject(error);
      }
    }, 200);
  });
}

export function PdfPreviewModal({ open, onClose, document, theme, themeSettings }: PdfPreviewProps) {
  const templateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoom, setZoom] = useState(0.6);

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const resetZoom = () => setZoom(0.6);

  const handleDownload = async () => {
    if (!templateRef.current) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    let iosWindow: Window | null = null;
    if (isIOS) {
      iosWindow = window.open('about:blank', '_blank');
      if (iosWindow) {
        iosWindow.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui"><p>Generating PDF...</p></body></html>');
      }
    }
    
    setIsGenerating(true);
    const savedZoom = zoom;
    setZoom(1);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const element = templateRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      const widthRatio = pdfWidth / canvasWidth;
      const pageHeightInCanvas = Math.floor(pdfHeight / widthRatio);
      const totalPages = Math.ceil(canvasHeight / pageHeightInCanvas);
      
      for (let page = 0; page < totalPages; page++) {
        const sourceY = page * pageHeightInCanvas;
        const sourceHeight = Math.min(pageHeightInCanvas, canvasHeight - sourceY);
        
        if (sourceHeight <= 0) continue;
        
        if (page > 0) {
          pdf.addPage();
        }
        
        const destHeight = Math.min(sourceHeight * widthRatio, pdfHeight);
        
        const pageCanvas = window.document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0, sourceY, canvasWidth, sourceHeight,
            0, 0, canvasWidth, sourceHeight
          );
        }
        
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(pageImgData, 'JPEG', 0, 0, pdfWidth, destHeight);
      }
      
      const typePrefix = document.type === 'quote' ? 'Quote' : document.type === 'invoice' ? 'Invoice' : 'PO';
      const filename = `${typePrefix}_${document.number}.pdf`;
      
      // Detect iOS (Safari ignores download attribute and has blob URL issues)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      if (isIOS) {
        const dataUrl = pdf.output('dataurlstring');
        if (iosWindow) {
          iosWindow.location.href = dataUrl;
        } else {
          const pdfBlob = pdf.output('blob');
          const pdfFile = new Blob([pdfBlob], { type: 'application/pdf' });
          if (navigator.share && typeof File !== 'undefined') {
            try {
              const file = new File([pdfFile], filename, { type: 'application/pdf' });
              await navigator.share({ files: [file], title: filename });
              return;
            } catch (shareErr) {
              if ((shareErr as Error)?.name === 'AbortError') return;
            }
          }
          window.location.href = dataUrl;
        }
      } else {
        // Standard download for other platforms using blob
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (error) {
      console.error('Error generating PDF:', error instanceof Error ? error.message : String(error));
      if (iosWindow) iosWindow.close();
    } finally {
      setZoom(savedZoom);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span>PDF Preview</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-md p-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={zoomOut}
                  disabled={zoom <= 0.3}
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm w-14 text-center font-medium">{Math.round(zoom * 100)}%</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={zoomIn}
                  disabled={zoom >= 1.5}
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetZoom}
                  data-testid="button-zoom-reset"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleDownload} disabled={isGenerating} className="gap-2" data-testid="button-download-pdf">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-800 p-4 rounded">
          <div className="flex justify-center min-h-full">
            <div 
              className="shadow-lg transition-transform duration-200 origin-top"
              style={{ transform: `scale(${zoom})` }}
            >
              <DocumentTemplate document={document} templateRef={templateRef} theme={theme} themeSettings={themeSettings} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function prepareQuoteData(quote: QuoteInput, job?: JobInput): DocumentData {
  const jobNum = job?.referenceNumber ?? undefined;
  const fullAddress = [job?.address, job?.suburb].filter(Boolean).join(', ');
  return {
    type: 'quote',
    id: quote.id,
    number: quote.quoteNumber,
    date: quote.quoteDate ?? '',
    dueDate: quote.validUntil ?? undefined,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail ?? undefined,
    customerPhone: quote.customerPhone ?? undefined,
    address: quote.address || '',
    suburb: quote.suburb ?? undefined,
    jobTitle: job?.title ?? undefined,
    jobAddress: fullAddress || undefined,
    jobNumber: jobNum,
    reference: quote.reference ?? undefined,
    siteAddress: fullAddress || undefined,
    items: (quote.items || []).map((item: QuoteLineItem) => ({
      description: item.description,
      quantity: item.qty,
      unitPrice: item.unitCost,
      total: item.total,
      section: item.section || undefined
    })),
    subtotal: quote.subtotal || 0,
    gst: quote.gst || 0,
    total: quote.total || 0,
    notes: quote.notes ?? undefined,
    terms: quote.terms ?? undefined
  };
}

export function prepareInvoiceData(invoice: InvoiceInput, job?: JobInput): DocumentData {
  const jobNum = job?.referenceNumber ?? undefined;
  const fullAddress = [job?.address, job?.suburb].filter(Boolean).join(', ');
  return {
    type: 'invoice',
    id: invoice.id,
    number: invoice.invoiceNumber,
    date: invoice.issueDate,
    dueDate: invoice.dueDate ?? undefined,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail ?? undefined,
    customerPhone: invoice.customerPhone ?? undefined,
    address: invoice.address || '',
    suburb: invoice.suburb ?? undefined,
    jobTitle: job?.title ?? undefined,
    jobAddress: fullAddress || undefined,
    jobNumber: jobNum,
    reference: invoice.reference ?? undefined,
    siteAddress: fullAddress || undefined,
    items: (invoice.items || []).map((item: InvoiceLineItem) => ({
      description: item.description,
      quantity: item.qty,
      unitPrice: item.unitCost,
      total: item.total,
      section: item.section || undefined
    })),
    subtotal: invoice.subtotal || 0,
    gst: invoice.gst || 0,
    total: invoice.total || 0,
    notes: invoice.notes ?? undefined,
    terms: invoice.terms ?? undefined,
    status: invoice.status ?? undefined,
    amountPaid: invoice.amountPaid || 0
  };
}

export function preparePurchaseOrderData(po: PurchaseOrderInput, job?: JobInput): DocumentData {
  const jobNum = job?.referenceNumber ?? undefined;
  return {
    type: 'purchase_order',
    id: po.id,
    number: po.poNumber,
    date: po.orderDate ?? '',
    dueDate: po.expectedDelivery ?? undefined,
    customerName: '',
    supplier: po.supplier ?? undefined,
    supplierContact: po.supplierContact ?? undefined,
    supplierPhone: po.supplierPhone ?? undefined,
    supplierEmail: po.supplierEmail ?? undefined,
    address: '',
    deliveryAddress: po.deliveryAddress ?? undefined,
    deliveryInstructions: po.deliveryInstructions ?? undefined,
    description: po.description ?? undefined,
    jobTitle: job?.title ?? undefined,
    jobAddress: job?.address ?? undefined,
    jobNumber: jobNum,
    reference: po.reference ?? undefined,
    items: (po.items || []).map((item: PurchaseOrderLineItem) => ({
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
    notes: po.notes ?? undefined,
    status: po.status ?? undefined
  };
}
