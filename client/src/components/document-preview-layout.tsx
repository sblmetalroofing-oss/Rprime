import React, { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  ArrowLeft, 
  Download, 
  Printer, 
  Send, 
  Pencil,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from "lucide-react";
import logoUrl from "@assets/sbl-logo.png";
import { formatDateLong } from "@/lib/date-utils";
import { fetchDefaultDocumentTheme, fetchDocumentTheme, fetchDocumentThemeSettings, type DocumentTheme, type DocumentThemeSettings } from "@/lib/api";
import { downloadDocumentPdf } from "@/lib/pdfmake-generator";
import { useToast } from "@/hooks/use-toast";

type DocumentType = 'quote' | 'invoice' | 'purchase_order' | 'report';

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  section?: string;
}

export interface DocumentData {
  type: DocumentType;
  id: string;
  number: string;
  date: string;
  dueDate?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address: string;
  suburb?: string;
  jobId?: string;
  jobTitle?: string;
  jobAddress?: string;
  jobNumber?: string;
  reference?: string;
  customerAbn?: string;
  siteAddress?: string;
  supplier?: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  description?: string;
  items: LineItem[];
  subtotal: number;
  discount?: number;
  gst: number;
  total: number;
  notes?: string;
  terms?: string;
  status?: string;
  amountPaid?: number;
  themeId?: string | null;
}

interface DocumentPreviewLayoutProps {
  document: DocumentData;
  onEmail?: () => void;
  backUrl?: string;
  editUrl?: string;
  children?: React.ReactNode;
  isPublicView?: boolean;
  theme?: DocumentTheme | null;
  themeSettings?: DocumentThemeSettings | null;
}

const typeLabels: Record<DocumentType, string> = {
  quote: 'Quote',
  invoice: 'Tax Invoice',
  purchase_order: 'Purchase Order',
  report: 'Inspection Report'
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  declined: "bg-red-500",
  expired: "bg-orange-500",
  ordered: "bg-blue-500",
  received: "bg-green-500",
  partial: "bg-orange-500",
  cancelled: "bg-gray-400",
  paid: "bg-green-500",
  overdue: "bg-red-500",
  pending: "bg-yellow-500"
};

function formatCurrency(amount: number) {
  return amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr: string) {
  return formatDateLong(dateStr) || '';
}

interface DocumentTemplateProps {
  document: DocumentData;
  templateRef?: React.RefObject<HTMLDivElement | null>;
  theme?: DocumentTheme | null;
  themeSettings?: DocumentThemeSettings | null;
}

export function DocumentTemplate({ document, templateRef, theme, themeSettings }: DocumentTemplateProps) {
  const isPurchaseOrder = document.type === 'purchase_order';
  
  const getDocumentTitle = () => {
    if (themeSettings) {
      if (document.status === 'draft' && themeSettings.draftTitle) {
        return themeSettings.draftTitle;
      }
      if (themeSettings.documentTitle) {
        return themeSettings.documentTitle;
      }
    }
    return typeLabels[document.type];
  };
  
  const showJobNumber = themeSettings?.showJobNumber !== 'false';
  const showJobAddress = themeSettings?.showJobAddress !== 'false';
  const showReference = themeSettings?.showReference !== 'false';
  const showNotes = themeSettings?.showNotes !== 'false';
  const showDescription = themeSettings?.showDescription !== 'false';
  const showQuantity = themeSettings?.showQuantity !== 'false';
  const showUnitPrice = themeSettings?.showUnitPrice !== 'false';
  const showAmount = themeSettings?.showAmount !== 'false';
  const showDiscount = themeSettings?.showDiscount !== 'false';

  const themeColor = theme?.themeColor || '#e53935';
  const themeLogo = theme?.logoUrl || logoUrl;
  const companyName = theme?.companyName || 'RPrime Roofing Pty Ltd';
  const abn = theme?.abn || '15 652 595 438';
  const licenseNumber = theme?.licenseNumber || '152 85249';
  const email1 = theme?.email1 || 'Accounts@rprimeroofing.com.au';
  const email2 = theme?.email2 || 'Admin@rprimeroofing.com.au';
  const phone = theme?.phone || '0435 222 683';
  const logoPosition = theme?.logoPosition || 'left';
  const termsUrl = theme?.termsUrl || 'https://www.rprimeroofing.com.au/terms-conditions';
  const hasBankDetails = !!(theme?.bankBsb || theme?.bankAccountNumber || theme?.bankAccountName || theme?.payId);
  const bankBsb = theme?.bankBsb || '';
  const bankAccountNumber = theme?.bankAccountNumber || '';
  const bankAccountName = theme?.bankAccountName || '';
  const payId = theme?.payId || '';

  return (
    <div ref={templateRef} style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      width: '794px',
      minHeight: '1123px',
      padding: '40px 48px',
      boxSizing: 'border-box' as const,
      backgroundColor: '#ffffff',
      color: '#1f2937',
      fontSize: '12px',
      lineHeight: 1.6
    }}>
      {/* Header with logo and company info */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '32px',
        paddingBottom: '24px',
        borderBottom: `3px solid ${themeColor}`,
        flexDirection: logoPosition === 'right' ? 'row-reverse' : 'row'
      }}>
        <div>
          <img src={themeLogo} alt={companyName} style={{ height: '80px', marginBottom: '8px' }} />
        </div>
        <div style={{ textAlign: logoPosition === 'right' ? 'left' : 'right', fontSize: '11px', color: '#4b5563', lineHeight: 1.7 }}>
          <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '14px', color: '#111827' }}>{companyName}</div>
          {abn && <div>ABN: {abn}</div>}
          {licenseNumber && <div>QBCC: {licenseNumber}</div>}
          {email1 && <div>{email1}</div>}
          {email2 && <div>{email2}</div>}
          {phone && <div style={{ fontWeight: '600' }}>{phone}</div>}
        </div>
      </div>

      {/* Document title and number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: themeColor, letterSpacing: '-0.5px', textTransform: 'uppercase' as const }}>{getDocumentTitle()}</h1>
        <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827', backgroundColor: '#f3f4f6', padding: '8px 16px', borderRadius: '4px' }}>
          {document.number}
        </div>
      </div>

      {/* Customer and job details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '28px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
        <div style={{ lineHeight: 1.7 }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: '6px', letterSpacing: '0.5px' }}>
            {isPurchaseOrder ? 'Supplier' : 'Bill To'}
          </div>
          <div style={{ fontWeight: '700', fontSize: '13px', marginBottom: '4px', color: '#111827' }}>
            {isPurchaseOrder ? document.supplier : document.customerName}
          </div>
          {isPurchaseOrder ? (
            <>
              {document.supplierContact && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.supplierContact}</div>}
              {document.supplierPhone && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.supplierPhone}</div>}
              {document.supplierEmail && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.supplierEmail}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.address}</div>
              {document.suburb && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.suburb}</div>}
              {document.customerEmail && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.customerEmail}</div>}
              {document.customerPhone && <div style={{ fontSize: '11px', color: '#4b5563' }}>{document.customerPhone}</div>}
            </>
          )}
        </div>

        <div style={{ lineHeight: 1.8 }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: '6px', letterSpacing: '0.5px' }}>Job Details</div>
          {showJobNumber && document.jobNumber && (
            <div style={{ display: 'flex', fontSize: '11px', marginBottom: '2px' }}>
              <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>Job Number</span>
              <span style={{ color: '#4b5563' }}>{document.jobNumber}</span>
            </div>
          )}
          {showJobAddress && document.jobAddress && (
            <div style={{ display: 'flex', fontSize: '11px', marginBottom: '2px' }}>
              <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>Job Address</span>
              <span style={{ wordBreak: 'break-word' as const, color: '#4b5563' }}>{document.jobAddress}</span>
            </div>
          )}
          {showReference && document.reference && (
            <div style={{ display: 'flex', fontSize: '11px' }}>
              <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>Reference</span>
              <span style={{ color: '#4b5563' }}>{document.reference}</span>
            </div>
          )}
        </div>

        <div style={{ lineHeight: 1.8 }}>
          <div style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' as const, color: '#6b7280', marginBottom: '6px', letterSpacing: '0.5px' }}>Document Info</div>
          <div style={{ display: 'flex', fontSize: '11px', marginBottom: '2px' }}>
            <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>
              {document.type === 'invoice' ? 'Invoice Date' : document.type === 'quote' ? 'Quote Date' : document.type === 'purchase_order' ? 'Order Date' : 'Report Date'}
            </span>
            <span style={{ color: '#4b5563' }}>{formatDateDisplay(document.date)}</span>
          </div>
          {document.dueDate && (
            <div style={{ display: 'flex', fontSize: '11px', marginBottom: '2px' }}>
              <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>
                {document.type === 'quote' ? 'Valid Until' : document.type === 'purchase_order' ? 'Delivery Date' : 'Due Date'}
              </span>
              <span style={{ color: '#4b5563' }}>{formatDateDisplay(document.dueDate)}</span>
            </div>
          )}
          {document.customerAbn && (
            <div style={{ display: 'flex', fontSize: '11px' }}>
              <span style={{ fontWeight: '600', width: '90px', flexShrink: 0, color: '#374151' }}>ABN</span>
              <span style={{ color: '#4b5563' }}>{document.customerAbn}</span>
            </div>
          )}
        </div>
      </div>

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '24px' }}>
        <thead>
          <tr style={{ backgroundColor: themeColor }}>
            <th style={{ padding: '12px 16px', textAlign: 'left' as const, fontWeight: '600', fontSize: '11px', color: '#ffffff', letterSpacing: '0.3px' }}>Description</th>
            <th style={{ padding: '12px 16px', textAlign: 'center' as const, fontWeight: '600', fontSize: '11px', color: '#ffffff', width: '70px' }}>Qty</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' as const, fontWeight: '600', fontSize: '11px', color: '#ffffff', width: '100px' }}>Unit Price</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' as const, fontWeight: '600', fontSize: '11px', color: '#ffffff', width: '110px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const hasSections = document.items.some(item => item.section);
            
            if (hasSections) {
              const groupedItems: Record<string, typeof document.items> = {};
              const sectionOrder: string[] = [];
              
              document.items.forEach(item => {
                const sectionKey = item.section || 'General';
                if (!groupedItems[sectionKey]) {
                  groupedItems[sectionKey] = [];
                  sectionOrder.push(sectionKey);
                }
                groupedItems[sectionKey].push(item);
              });
              
              return sectionOrder.map((section, sectionIndex) => {
                const sectionItems = groupedItems[section];
                const sectionSubtotal = sectionItems.reduce((sum, item) => sum + item.total, 0);
                
                return (
                  <React.Fragment key={section}>
                    {/* Section header */}
                    <tr style={{ backgroundColor: '#e5e7eb', pageBreakAfter: 'avoid' as const }}>
                      <td colSpan={4} style={{ padding: '10px 16px', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' as const, color: '#374151', letterSpacing: '0.5px' }}>
                        {section}
                      </td>
                    </tr>
                    {/* Section items */}
                    {sectionItems.map((item, index) => (
                      <tr key={`${section}-${index}`} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '14px 16px', fontSize: '11px', whiteSpace: 'pre-line' as const, color: '#374151', lineHeight: 1.5 }}>{item.description}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' as const, fontSize: '11px', color: '#4b5563' }}>{item.quantity}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' as const, fontSize: '11px', color: '#4b5563' }}>${formatCurrency(item.unitPrice)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' as const, fontSize: '11px', fontWeight: '600', color: '#111827' }}>${formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                    {/* Section subtotal */}
                    <tr style={{ backgroundColor: '#f3f4f6', borderBottom: sectionIndex < sectionOrder.length - 1 ? `3px solid ${themeColor}` : '1px solid #e5e7eb', pageBreakBefore: 'avoid' as const }}>
                      <td colSpan={3} style={{ padding: '10px 16px', fontWeight: '600', fontSize: '11px', textAlign: 'right' as const, color: '#374151' }}>
                        {section} Subtotal
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: '700', fontSize: '11px', textAlign: 'right' as const, color: '#111827' }}>
                        ${formatCurrency(sectionSubtotal)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              });
            } else {
              return document.items.map((item, index) => (
                <tr key={index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '14px 16px', fontSize: '11px', whiteSpace: 'pre-line' as const, color: '#374151', lineHeight: 1.5 }}>{item.description}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' as const, fontSize: '11px', color: '#4b5563' }}>{item.quantity}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' as const, fontSize: '11px', color: '#4b5563' }}>${formatCurrency(item.unitPrice)}</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' as const, fontSize: '11px', fontWeight: '600', color: '#111827' }}>${formatCurrency(item.total)}</td>
                </tr>
              ));
            }
          })()}
          {document.items.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: '32px', textAlign: 'center' as const, color: '#9ca3af', fontStyle: 'italic' as const }}>No line items</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals section */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px', pageBreakInside: 'avoid' as const, breakInside: 'avoid' as const }}>
        <div style={{ width: '280px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '11px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#4b5563' }}>Subtotal</span>
            <span style={{ fontWeight: '600', color: '#111827' }}>${formatCurrency(document.subtotal)}</span>
          </div>
          {showDiscount && (document.discount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '11px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
              <span style={{ color: '#15803d' }}>Discount</span>
              <span style={{ fontWeight: '600', color: '#15803d' }}>-${formatCurrency(document.discount || 0)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '11px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ color: '#4b5563' }}>GST (10%)</span>
            <span style={{ fontWeight: '600', color: '#111827' }}>${formatCurrency(document.gst)}</span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '14px 16px', 
            backgroundColor: themeColor, 
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '14px'
          }}>
            <span>TOTAL (AUD)</span>
            <span>${formatCurrency(document.total)}</span>
          </div>
          {document.type === 'invoice' && document.amountPaid !== undefined && document.amountPaid > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '11px', backgroundColor: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                <span style={{ color: '#15803d' }}>Amount Paid</span>
                <span style={{ color: '#15803d', fontWeight: '700' }}>${formatCurrency(document.amountPaid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: '12px', fontWeight: '700', backgroundColor: '#fef2f2' }}>
                <span style={{ color: '#dc2626' }}>Balance Due</span>
                <span style={{ color: '#dc2626' }}>${formatCurrency(document.total - document.amountPaid)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bank details for invoices */}
      {document.type === 'invoice' && hasBankDetails && (
        <div style={{ marginBottom: '28px', padding: '16px 20px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as const, color: '#374151', marginBottom: '10px', letterSpacing: '0.5px' }}>Payment Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', lineHeight: 1.6 }}>
            {bankAccountName && <div><span style={{ fontWeight: '600', color: '#4b5563' }}>Account:</span> <span style={{ color: '#111827' }}>{bankAccountName}</span></div>}
            {bankBsb && <div><span style={{ fontWeight: '600', color: '#4b5563' }}>BSB:</span> <span style={{ color: '#111827' }}>{bankBsb}</span></div>}
            {bankAccountNumber && <div><span style={{ fontWeight: '600', color: '#4b5563' }}>ACC:</span> <span style={{ color: '#111827' }}>{bankAccountNumber}</span></div>}
            {payId && <div><span style={{ fontWeight: '600', color: '#4b5563' }}>PayID:</span> <span style={{ color: '#111827' }}>{payId}</span></div>}
          </div>
        </div>
      )}

      {/* Purchase order specific fields */}
      {isPurchaseOrder && document.description && (
        <div style={{ marginBottom: '20px', fontSize: '11px' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#374151', textTransform: 'uppercase' as const, fontSize: '10px', letterSpacing: '0.5px' }}>Description</div>
          <div style={{ color: '#4b5563', whiteSpace: 'pre-line', lineHeight: 1.6, padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>{document.description}</div>
        </div>
      )}

      {isPurchaseOrder && document.deliveryAddress && (
        <div style={{ marginBottom: '20px', fontSize: '11px' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#374151', textTransform: 'uppercase' as const, fontSize: '10px', letterSpacing: '0.5px' }}>Deliver To</div>
          <div style={{ color: '#4b5563', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>{document.deliveryAddress}</div>
        </div>
      )}

      {isPurchaseOrder && document.deliveryInstructions && (
        <div style={{ marginBottom: '20px', fontSize: '11px' }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#374151', textTransform: 'uppercase' as const, fontSize: '10px', letterSpacing: '0.5px' }}>Delivery Instructions</div>
          <div style={{ color: '#4b5563', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>{document.deliveryInstructions}</div>
        </div>
      )}

      {/* Notes section */}
      {showNotes && document.notes && (
        <div style={{ marginBottom: '20px', fontSize: '11px', pageBreakInside: 'avoid' as const, breakInside: 'avoid' as const }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#374151', textTransform: 'uppercase' as const, fontSize: '10px', letterSpacing: '0.5px' }}>Notes</div>
          <div style={{ color: '#4b5563', whiteSpace: 'pre-line', lineHeight: 1.6, padding: '12px', backgroundColor: '#fffbeb', borderRadius: '4px', borderLeft: `3px solid ${themeColor}` }}>{document.notes}</div>
        </div>
      )}

      {/* Terms section - uses Doc Theme defaultTerms */}
      {themeSettings?.defaultTerms && (
        <div style={{ marginBottom: '20px', fontSize: '11px', pageBreakInside: 'avoid' as const, breakInside: 'avoid' as const }}>
          <div style={{ fontWeight: '700', marginBottom: '6px', color: '#374151', textTransform: 'uppercase' as const, fontSize: '10px', letterSpacing: '0.5px' }}>Terms & Conditions</div>
          <div style={{ color: '#4b5563', whiteSpace: 'pre-line', lineHeight: 1.6, padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', fontSize: '10px' }}>{themeSettings.defaultTerms}</div>
        </div>
      )}

    </div>
  );
}

export function DocumentPreviewLayout({ document, onEmail, backUrl, editUrl, children, isPublicView = false, theme: themeProp, themeSettings: themeSettingsProp }: DocumentPreviewLayoutProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const templateRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Start with smaller zoom on mobile for better fit on regular iPhone screens
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [zoom, setZoom] = useState(isMobile ? 0.5 : 1.05);
  
  const [internalTheme, setInternalTheme] = useState<DocumentTheme | null>(null);
  const [internalThemeSettings, setInternalThemeSettings] = useState<DocumentThemeSettings | null>(null);
  const isExternalThemeLoading = themeProp !== undefined && themeProp === null;
  const [themeLoading, setThemeLoading] = useState(themeProp === undefined || isExternalThemeLoading);

  const theme = themeProp !== undefined ? themeProp : internalTheme;
  const themeSettings = themeSettingsProp !== undefined ? themeSettingsProp : internalThemeSettings;

  // Enable pinch-zoom on public document views for mobile users
  useEffect(() => {
    if (isPublicView) {
      const viewport = window.document.querySelector('meta[name="viewport"]');
      const originalContent = viewport?.getAttribute('content') || '';
      
      // Enable user scaling for public views
      viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover');
      
      return () => {
        // Restore original viewport on unmount
        viewport?.setAttribute('content', originalContent);
      };
    }
  }, [isPublicView]);

  useEffect(() => {
    if (themeProp !== undefined) {
      setThemeLoading(themeProp === null);
      return;
    }
    
    const loadTheme = async () => {
      setThemeLoading(true);
      try {
        let loadedTheme: DocumentTheme | null = null;
        
        if (document.themeId) {
          const specificTheme = await fetchDocumentTheme(document.themeId);
          if (specificTheme) {
            loadedTheme = specificTheme;
          }
        }
        
        if (!loadedTheme) {
          loadedTheme = await fetchDefaultDocumentTheme();
        }
        
        setInternalTheme(loadedTheme);
        
        if (loadedTheme?.id) {
          const settingsArray = await fetchDocumentThemeSettings(loadedTheme.id);
          const docTypeSettings = settingsArray.find(s => s.documentType === document.type);
          setInternalThemeSettings(docTypeSettings || null);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setThemeLoading(false);
      }
    };
    loadTheme();
  }, [document.themeId, document.type, themeProp]);

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const resetZoom = () => setZoom(isMobile ? 0.5 : 1.05);

  const handleBack = () => {
    if (backUrl) {
      setLocation(backUrl);
    } else {
      window.history.back();
    }
  };

  const handleEdit = () => {
    if (editUrl) {
      setLocation(editUrl);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    let iosWindow: Window | null = null;
    if (isIOS) {
      iosWindow = window.open('about:blank', '_blank');
      if (iosWindow) {
        iosWindow.document.write('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:system-ui"><p>Generating PDF...</p></body></html>');
      }
    }
    
    try {
      const typePrefix = document.type === 'quote' ? 'Quote' : document.type === 'invoice' ? 'Invoice' : document.type === 'purchase_order' ? 'PO' : 'Report';
      const filename = `${typePrefix}_${document.number}.pdf`;
      
      await downloadDocumentPdf({
        document,
        theme,
        themeSettings
      }, filename, iosWindow);
    } catch (error: unknown) {
      console.error('Error generating PDF:', error instanceof Error ? error.message : error);
      if (iosWindow) iosWindow.close();
      toast({ title: "Download failed", description: "There was an error generating the PDF. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      <div className="sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {!isPublicView && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-11 w-11"
                data-testid="button-preview-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  {typeLabels[document.type]} {document.number}
                </span>
                {!isPublicView && document.status && (
                  <Badge className={`${statusColors[document.status] || 'bg-gray-500'} text-white capitalize`}>
                    {document.status}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {document.type === 'purchase_order' ? document.supplier : document.customerName}
              </p>
            </div>
          </div>

          <div className="text-right hidden sm:block">
            <p className="text-2xl font-bold">${formatCurrency(document.total)}</p>
            {document.type === 'invoice' && (document.amountPaid || 0) > 0 && (
              <p className="text-sm text-muted-foreground">
                Balance: <span className="text-red-500 font-medium">${formatCurrency(document.total - (document.amountPaid || 0))}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 pb-3 overflow-x-auto">
          {!isPublicView && editUrl && (
            <Button variant="default" onClick={handleEdit} className="h-11 px-3 sm:px-4 shrink-0" data-testid="button-preview-edit">
              <Pencil className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
          
          <Button 
            variant="outline" 
            onClick={handleDownload} 
            disabled={isGenerating || themeLoading}
            className="h-11 px-3 sm:px-4 shrink-0"
            data-testid="button-preview-download"
          >
            {isGenerating || themeLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Download className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">Download</span>
          </Button>

          <Button variant="outline" onClick={handlePrint} className="h-11 shrink-0 hidden sm:flex" data-testid="button-preview-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>

          {!isPublicView && onEmail && (
            document.status === 'draft' ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button variant="outline" disabled className="h-11 px-3 sm:px-4 shrink-0 opacity-50" data-testid="button-preview-email">
                        <Send className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Email</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Change status from Draft before sending</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button variant="outline" onClick={onEmail} disabled={themeLoading} className="h-11 px-3 sm:px-4 shrink-0" data-testid="button-preview-email">
                {themeLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Send className="h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">Email</span>
              </Button>
            )
          )}

          <div className="flex items-center gap-1 bg-muted rounded-md p-1 ml-auto shrink-0">
            <Button 
              variant="ghost" 
              onClick={zoomOut}
              disabled={zoom <= 0.3}
              className="h-11 w-11 p-0"
              data-testid="button-preview-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm w-10 sm:w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
            <Button 
              variant="ghost" 
              onClick={zoomIn}
              disabled={zoom >= 1.5}
              className="h-11 w-11 p-0"
              data-testid="button-preview-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={resetZoom}
              className="h-11 w-11 p-0"
              data-testid="button-preview-zoom-reset"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {themeLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex justify-center min-w-fit">
            <div 
              className="shadow-xl transition-transform duration-200 origin-top"
              style={{ 
                transform: `scale(${zoom})`,
                marginBottom: zoom < 1 ? `${(1 - zoom) * -1123}px` : 0
              }}
            >
              <DocumentTemplate document={document} templateRef={templateRef} theme={theme} themeSettings={themeSettings} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .sticky { display: none !important; }
          .overflow-auto { overflow: visible !important; padding: 0 !important; }
          body { background: white !important; }
          .shadow-xl { box-shadow: none !important; transform: none !important; }
        }
        @media (max-width: 640px) {
          .overflow-auto { -webkit-overflow-scrolling: touch; }
        }
      `}</style>
    </div>
  );
}
