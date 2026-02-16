import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, Content, TableCell, StyleDictionary, CustomTableLayout } from 'pdfmake/interfaces';
import type { DocumentData } from '@/components/document-preview-layout';
import type { DocumentTheme, DocumentThemeSettings } from '@/lib/api';
import { formatDateLong } from '@/lib/date-utils';

interface PdfMakeWithVfs {
  vfs: typeof pdfFonts.vfs;
}

(pdfMake as unknown as PdfMakeWithVfs).vfs = pdfFonts.vfs;

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  section?: string;
}

interface GeneratePdfOptions {
  document: DocumentData;
  theme: DocumentTheme | null;
  themeSettings: DocumentThemeSettings | null;
  logoBase64?: string;
}

interface TableLayoutNode {
  table: {
    body: TableCell[][];
  };
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr: string): string {
  return formatDateLong(dateStr) || '';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 229, g: 57, b: 53 };
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

function buildTextSection(
  label: string,
  text: string,
  style: string,
  fillColor: string
): Content[] {
  const lines = text.split(/\n/);
  const isShort = lines.length <= 5 && text.length < 400;
  
  if (isShort) {
    return [{
      stack: [
        { text: label, style: 'sectionLabel' },
        { text: text, style, fillColor, margin: [8, 8, 8, 8] as [number, number, number, number] }
      ],
      margin: [0, 0, 0, 16] as [number, number, number, number],
      unbreakable: true
    }];
  }
  
  const content: Content[] = [];
  const firstTwoLines = lines.slice(0, 2).join('\n');
  const remainingLines = lines.slice(2);
  
  content.push({
    stack: [
      { text: label, style: 'sectionLabel' },
      { text: firstTwoLines, style, fillColor, margin: [8, 8, 8, 2] as [number, number, number, number] }
    ],
    margin: [0, 0, 0, 2] as [number, number, number, number],
    unbreakable: true
  });
  
  if (remainingLines.length > 0) {
    content.push({
      text: remainingLines.join('\n'),
      style,
      fillColor,
      margin: [8, 2, 8, 8] as [number, number, number, number],
      preserveLeadingSpaces: true
    });
  }
  
  content.push({ text: '', margin: [0, 0, 0, 12] as [number, number, number, number] });
  
  return content;
}

const typeLabels: Record<string, string> = {
  quote: 'Quote',
  invoice: 'Tax Invoice',
  purchase_order: 'Purchase Order',
  report: 'Inspection Report'
};

async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

function buildDocumentContent(options: GeneratePdfOptions, logoBase64: string): { content: Content[], styles: StyleDictionary } {
  const { document: doc, theme, themeSettings } = options;

  const themeColor = theme?.themeColor || '#e53935';
  const contrastColor = getContrastColor(themeColor);
  const companyName = theme?.companyName || 'RPrime Roofing Pty Ltd';
  const abn = theme?.abn || '15 652 595 438';
  const licenseNumber = theme?.licenseNumber || '152 85249';
  const email1 = theme?.email1 || 'Accounts@rprimeroofing.com.au';
  const email2 = theme?.email2 || 'Admin@rprimeroofing.com.au';
  const phone = theme?.phone || '0435 222 683';
  const termsUrl = theme?.termsUrl || 'https://www.rprimeroofing.com.au/terms-conditions';
  const hasBankDetails = !!(theme?.bankBsb || theme?.bankAccountNumber || theme?.bankAccountName || theme?.payId);

  const isPurchaseOrder = doc.type === 'purchase_order';

  const getDocumentTitle = (): string => {
    if (themeSettings) {
      if (doc.status === 'draft' && themeSettings.draftTitle) {
        return themeSettings.draftTitle;
      }
      if (themeSettings.documentTitle) {
        return themeSettings.documentTitle;
      }
    }
    return typeLabels[doc.type] || 'Document';
  };

  const showJobNumber = themeSettings?.showJobNumber !== 'false';
  const showJobAddress = themeSettings?.showJobAddress !== 'false';
  const showReference = themeSettings?.showReference !== 'false';
  const showNotes = themeSettings?.showNotes !== 'false';
  const showDiscount = themeSettings?.showDiscount !== 'false';

  const content: Content[] = [];

  const headerLeft: Content[] = [];
  const headerRight: Content[] = [];

  if (logoBase64) {
    headerLeft.push({
      image: logoBase64,
      width: 120,
      margin: [0, 0, 0, 8]
    });
  }

  const companyInfoStack: Content[] = [
    { text: companyName, style: 'companyName' }
  ];
  if (abn) companyInfoStack.push({ text: `ABN: ${abn}`, style: 'companyDetail' });
  if (licenseNumber) companyInfoStack.push({ text: `QBCC: ${licenseNumber}`, style: 'companyDetail' });
  if (email1) companyInfoStack.push({ text: email1, style: 'companyDetail' });
  if (email2) companyInfoStack.push({ text: email2, style: 'companyDetail' });
  if (phone) companyInfoStack.push({ text: phone, style: 'companyDetailBold' });

  headerRight.push({
    stack: companyInfoStack,
    alignment: 'right'
  });

  content.push({
    columns: [
      { stack: headerLeft, width: '*' },
      { stack: headerRight, width: 'auto' }
    ],
    margin: [0, 0, 0, 8]
  });

  content.push({
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 3, lineColor: themeColor }
    ],
    margin: [0, 0, 0, 20]
  });

  content.push({
    columns: [
      { text: getDocumentTitle(), style: 'documentTitle', color: themeColor },
      { 
        text: doc.number, 
        style: 'documentNumber',
        alignment: 'right',
        background: '#f3f4f6',
        margin: [8, 4, 8, 4]
      }
    ],
    margin: [0, 0, 0, 20]
  });

  const billToContent: Content[] = [
    { text: isPurchaseOrder ? 'SUPPLIER' : 'BILL TO', style: 'sectionLabel' },
    { text: isPurchaseOrder ? doc.supplier || '' : doc.customerName, style: 'customerName' }
  ];

  if (isPurchaseOrder) {
    if (doc.supplierContact) billToContent.push({ text: doc.supplierContact, style: 'infoText' });
    if (doc.supplierPhone) billToContent.push({ text: doc.supplierPhone, style: 'infoText' });
    if (doc.supplierEmail) billToContent.push({ text: doc.supplierEmail, style: 'infoText' });
  } else {
    if (doc.address) billToContent.push({ text: doc.address, style: 'infoText' });
    if (doc.suburb) billToContent.push({ text: doc.suburb, style: 'infoText' });
    if (doc.customerEmail) billToContent.push({ text: doc.customerEmail, style: 'infoText' });
    if (doc.customerPhone) billToContent.push({ text: doc.customerPhone, style: 'infoText' });
  }

  const jobContent: Content[] = [{ text: 'JOB DETAILS', style: 'sectionLabel' }];
  if (showJobNumber && doc.jobNumber) {
    jobContent.push({
      columns: [
        { text: 'Job Number', style: 'infoLabel', width: 70 },
        { text: doc.jobNumber, style: 'infoText' }
      ]
    });
  }
  if (showJobAddress && doc.jobAddress) {
    jobContent.push({
      columns: [
        { text: 'Job Address', style: 'infoLabel', width: 70 },
        { text: doc.jobAddress, style: 'infoText' }
      ]
    });
  }
  if (showReference && doc.reference) {
    jobContent.push({
      columns: [
        { text: 'Reference', style: 'infoLabel', width: 70 },
        { text: doc.reference, style: 'infoText' }
      ]
    });
  }

  const docInfoContent: Content[] = [{ text: 'DOCUMENT INFO', style: 'sectionLabel' }];
  const dateLabel = doc.type === 'invoice' ? 'Invoice Date' : doc.type === 'quote' ? 'Quote Date' : doc.type === 'purchase_order' ? 'Order Date' : 'Report Date';
  docInfoContent.push({
    columns: [
      { text: dateLabel, style: 'infoLabel', width: 75 },
      { text: formatDateDisplay(doc.date), style: 'infoText' }
    ]
  });

  if (doc.dueDate) {
    const dueDateLabel = doc.type === 'quote' ? 'Valid Until' : doc.type === 'purchase_order' ? 'Delivery Date' : 'Due Date';
    docInfoContent.push({
      columns: [
        { text: dueDateLabel, style: 'infoLabel', width: 75 },
        { text: formatDateDisplay(doc.dueDate), style: 'infoText' }
      ]
    });
  }

  if (doc.customerAbn) {
    docInfoContent.push({
      columns: [
        { text: 'ABN', style: 'infoLabel', width: 75 },
        { text: doc.customerAbn, style: 'infoText' }
      ]
    });
  }

  content.push({
    columns: [
      { stack: billToContent, width: '*' },
      { stack: jobContent, width: '*' },
      { stack: docInfoContent, width: '*' }
    ],
    columnGap: 15,
    margin: [0, 0, 0, 20]
  });

  const tableWidths = ['*', 50, 80, 90];
  const tableBody: TableCell[][] = [];

  tableBody.push([
    { text: 'Description', style: 'tableHeader', fillColor: themeColor, color: contrastColor },
    { text: 'Qty', style: 'tableHeader', alignment: 'center', fillColor: themeColor, color: contrastColor },
    { text: 'Unit Price', style: 'tableHeader', alignment: 'right', fillColor: themeColor, color: contrastColor },
    { text: 'Amount', style: 'tableHeader', alignment: 'right', fillColor: themeColor, color: contrastColor }
  ]);

  const hasSections = doc.items.some(item => item.section);

  if (hasSections) {
    const groupedItems: Record<string, LineItem[]> = {};
    const sectionOrder: string[] = [];

    doc.items.forEach((item: LineItem) => {
      const sectionKey = item.section || 'General';
      if (!groupedItems[sectionKey]) {
        groupedItems[sectionKey] = [];
        sectionOrder.push(sectionKey);
      }
      groupedItems[sectionKey].push(item);
    });

    sectionOrder.forEach((section) => {
      const sectionItems = groupedItems[section];
      const sectionSubtotal = sectionItems.reduce((sum, item) => sum + item.total, 0);

      tableBody.push([
        { 
          text: section.toUpperCase(), 
          colSpan: 4, 
          style: 'sectionHeader',
          fillColor: '#ffffff',
          border: [false, true, false, false],
          margin: [0, 6, 0, 6]
        },
        {}, {}, {}
      ]);

      sectionItems.forEach((item, index) => {
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
        tableBody.push([
          { text: item.description, style: 'tableCell', fillColor: bgColor },
          { text: item.quantity.toString(), style: 'tableCell', alignment: 'center', fillColor: bgColor },
          { text: `$${formatCurrency(item.unitPrice)}`, style: 'tableCell', alignment: 'right', fillColor: bgColor },
          { text: `$${formatCurrency(item.total)}`, style: 'tableCellBold', alignment: 'right', fillColor: bgColor }
        ]);
      });

      tableBody.push([
        { text: '', colSpan: 2, fillColor: '#f3f4f6' },
        {},
        { text: `${section} Subtotal`, style: 'subtotalLabel', alignment: 'right', fillColor: '#f3f4f6' },
        { text: `$${formatCurrency(sectionSubtotal)}`, style: 'subtotalValue', alignment: 'right', fillColor: '#f3f4f6' }
      ]);
    });
  } else {
    doc.items.forEach((item: LineItem, index: number) => {
      const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
      tableBody.push([
        { text: item.description, style: 'tableCell', fillColor: bgColor },
        { text: item.quantity.toString(), style: 'tableCell', alignment: 'center', fillColor: bgColor },
        { text: `$${formatCurrency(item.unitPrice)}`, style: 'tableCell', alignment: 'right', fillColor: bgColor },
        { text: `$${formatCurrency(item.total)}`, style: 'tableCellBold', alignment: 'right', fillColor: bgColor }
      ]);
    });
  }

  if (doc.items.length === 0) {
    tableBody.push([
      { text: 'No line items', colSpan: 4, style: 'noItems', alignment: 'center' },
      {}, {}, {}
    ]);
  }

  const itemTableLayout: CustomTableLayout = {
    hLineWidth: (i: number, node: TableLayoutNode) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
    vLineWidth: () => 0,
    hLineColor: () => '#e5e7eb',
    paddingLeft: () => 10,
    paddingRight: () => 10,
    paddingTop: () => 8,
    paddingBottom: () => 8
  };

  content.push({
    table: {
      headerRows: 1,
      widths: tableWidths,
      body: tableBody,
      dontBreakRows: true
    },
    layout: itemTableLayout,
    margin: [0, 0, 0, 20]
  });

  const totalsTableBody: TableCell[][] = [];
  
  totalsTableBody.push([
    { text: 'Subtotal', style: 'totalsLabel', fillColor: '#f9fafb', border: [false, false, false, false] },
    { text: `$${formatCurrency(doc.subtotal)}`, style: 'totalsValue', alignment: 'right', fillColor: '#f9fafb', border: [false, false, false, false] }
  ]);

  if (showDiscount && (doc.discount || 0) > 0) {
    totalsTableBody.push([
      { text: 'Discount', style: 'discountLabel', fillColor: '#f0fdf4', border: [false, false, false, false] },
      { text: `-$${formatCurrency(doc.discount || 0)}`, style: 'discountValue', alignment: 'right', fillColor: '#f0fdf4', border: [false, false, false, false] }
    ]);
  }

  totalsTableBody.push([
    { text: 'GST (10%)', style: 'totalsLabel', fillColor: '#f9fafb', border: [false, false, false, false] },
    { text: `$${formatCurrency(doc.gst)}`, style: 'totalsValue', alignment: 'right', fillColor: '#f9fafb', border: [false, false, false, false] }
  ]);

  totalsTableBody.push([
    { text: 'TOTAL (AUD)', style: 'totalFinalLabel', color: contrastColor, fillColor: themeColor, border: [false, false, false, false] },
    { text: `$${formatCurrency(doc.total)}`, style: 'totalFinalValue', alignment: 'right', color: contrastColor, fillColor: themeColor, border: [false, false, false, false] }
  ]);

  if (doc.type === 'invoice' && doc.amountPaid !== undefined && doc.amountPaid > 0) {
    totalsTableBody.push([
      { text: 'Amount Paid', style: 'paidLabel', fillColor: '#f0fdf4', border: [false, false, false, false] },
      { text: `$${formatCurrency(doc.amountPaid)}`, style: 'paidValue', alignment: 'right', fillColor: '#f0fdf4', border: [false, false, false, false] }
    ]);

    totalsTableBody.push([
      { text: 'Balance Due', style: 'balanceLabel', fillColor: '#fef2f2', border: [false, false, false, false] },
      { text: `$${formatCurrency(doc.total - doc.amountPaid)}`, style: 'balanceValue', alignment: 'right', fillColor: '#fef2f2', border: [false, false, false, false] }
    ]);
  }

  const totalsTableLayout: CustomTableLayout = {
    hLineWidth: () => 0,
    vLineWidth: () => 0,
    paddingLeft: () => 12,
    paddingRight: () => 12,
    paddingTop: () => 8,
    paddingBottom: () => 8
  };

  const totalsHeight = totalsTableBody.length * 32 + 24;
  
  content.push({
    columns: [
      { text: '', width: '*' },
      { 
        table: {
          widths: ['*', 'auto'],
          body: totalsTableBody
        },
        layout: totalsTableLayout,
        width: 220,
        margin: [0, 0, 0, 20]
      }
    ],
    unbreakable: true,
    id: 'totals-block',
    estimatedHeight: totalsHeight
  } as Content);

  if (doc.type === 'invoice' && hasBankDetails) {
    const bankDetails: Content[] = [];
    if (theme?.bankAccountName) bankDetails.push({ text: `Account: ${theme.bankAccountName}`, style: 'infoText' });
    if (theme?.bankBsb) bankDetails.push({ text: `BSB: ${theme.bankBsb}`, style: 'infoText' });
    if (theme?.bankAccountNumber) bankDetails.push({ text: `ACC: ${theme.bankAccountNumber}`, style: 'infoText' });
    if (theme?.payId) bankDetails.push({ text: `PayID: ${theme.payId}`, style: 'infoText' });

    content.push({
      stack: [
        { text: 'PAYMENT DETAILS', style: 'sectionLabel', margin: [0, 0, 0, 8] },
        {
          columns: bankDetails.length > 2 
            ? [{ stack: bankDetails.slice(0, 2) }, { stack: bankDetails.slice(2) }]
            : bankDetails
        }
      ],
      fillColor: '#f9fafb',
      margin: [0, 0, 0, 20],
      unbreakable: true
    });
  }

  if (isPurchaseOrder && doc.description) {
    const descriptionContent = buildTextSection('DESCRIPTION', doc.description, 'noteText', '#f9fafb');
    content.push(...descriptionContent);
  }

  if (isPurchaseOrder && doc.deliveryAddress) {
    const deliverToContent = buildTextSection('DELIVER TO', doc.deliveryAddress, 'noteText', '#f9fafb');
    content.push(...deliverToContent);
  }

  if (isPurchaseOrder && doc.deliveryInstructions) {
    const instructionsContent = buildTextSection('DELIVERY INSTRUCTIONS', doc.deliveryInstructions, 'noteText', '#f9fafb');
    content.push(...instructionsContent);
  }

  if (showNotes && doc.notes) {
    const notesContent = buildTextSection('NOTES', doc.notes, 'noteText', '#fffbeb');
    content.push(...notesContent);
  }

  if (themeSettings?.defaultTerms) {
    const termsContent = buildTextSection('TERMS & CONDITIONS', themeSettings.defaultTerms, 'termsText', '#f9fafb');
    content.push(...termsContent);
  }


  const styles: StyleDictionary = {
    companyName: { fontSize: 13, bold: true, color: '#111827', margin: [0, 0, 0, 4] },
    companyDetail: { fontSize: 9, color: '#4b5563', margin: [0, 1, 0, 1] },
    companyDetailBold: { fontSize: 9, color: '#4b5563', bold: true, margin: [0, 1, 0, 1] },
    documentTitle: { fontSize: 22, bold: true },
    documentNumber: { fontSize: 18, bold: true, color: '#111827' },
    sectionLabel: { fontSize: 8, bold: true, color: '#6b7280', margin: [0, 0, 0, 6] },
    customerName: { fontSize: 11, bold: true, color: '#111827', margin: [0, 0, 0, 4] },
    infoLabel: { fontSize: 9, bold: true, color: '#374151' },
    infoText: { fontSize: 9, color: '#4b5563' },
    tableHeader: { fontSize: 9, bold: true, margin: [0, 4, 0, 4] },
    sectionHeader: { fontSize: 10, bold: true, color: '#374151' },
    sectionHeaderStandalone: { fontSize: 11, bold: true, color: '#111827' },
    tableCell: { fontSize: 9, color: '#374151' },
    tableCellBold: { fontSize: 9, bold: true, color: '#111827' },
    subtotalLabel: { fontSize: 9, bold: true, color: '#374151' },
    subtotalValue: { fontSize: 9, bold: true, color: '#111827' },
    noItems: { fontSize: 9, color: '#9ca3af', italics: true, margin: [0, 20, 0, 20] },
    totalsLabel: { fontSize: 9, color: '#4b5563' },
    totalsValue: { fontSize: 9, bold: true, color: '#111827' },
    discountLabel: { fontSize: 9, color: '#15803d' },
    discountValue: { fontSize: 9, bold: true, color: '#15803d' },
    totalFinalLabel: { fontSize: 11, bold: true },
    totalFinalValue: { fontSize: 11, bold: true },
    paidLabel: { fontSize: 9, color: '#15803d' },
    paidValue: { fontSize: 9, bold: true, color: '#15803d' },
    balanceLabel: { fontSize: 10, bold: true, color: '#dc2626' },
    balanceValue: { fontSize: 10, bold: true, color: '#dc2626' },
    noteText: { fontSize: 9, color: '#4b5563', lineHeight: 1.4 },
    termsText: { fontSize: 8, color: '#4b5563', lineHeight: 1.3 },
    footer: { fontSize: 8, color: '#6b7280' }
  };

  return { content, styles };
}

interface PdfDocGenerator {
  getBase64: (callback: (base64: string) => void) => void;
}

interface PdfNode {
  pageNumbers?: number[];
  startPosition?: {
    top: number;
    pageInnerHeight: number;
  };
  unbreakable?: boolean;
  headlineLevel?: number;
  style?: string | string[];
  id?: string;
  table?: { body?: unknown[][] };
  stack?: unknown[];
  estimatedHeight?: number;
}

const TOTALS_BLOCK_HEIGHT = 200;
const SECTION_HEADER_HEIGHT = 100;
const MIN_CONTENT_SPACE = 120;

function createPageBreakBefore() {
  return (currentNode: PdfNode): boolean => {
    if (!currentNode.startPosition) return false;
    
    const { top, pageInnerHeight } = currentNode.startPosition;
    const remainingSpace = pageInnerHeight - top;
    
    // Use dynamic estimated height if available
    if (currentNode.estimatedHeight && remainingSpace < currentNode.estimatedHeight) {
      return true;
    }
    
    // Detect totals block by id or checking for columns with nested table
    if (currentNode.id === 'totals-block' || 
        (currentNode.unbreakable && hasNestedTable(currentNode))) {
      if (remainingSpace < TOTALS_BLOCK_HEIGHT) {
        return true;
      }
    }
    
    // If this is an unbreakable section header block (stack with label + text)
    // and there's not enough space for the header + some content
    if (currentNode.unbreakable && currentNode.stack && remainingSpace < SECTION_HEADER_HEIGHT) {
      return true;
    }
    
    // General check: unbreakable content near page bottom
    if (currentNode.unbreakable && remainingSpace < MIN_CONTENT_SPACE) {
      return true;
    }
    
    // Content that spans multiple pages - check if it would start with very little space
    if (remainingSpace < 60 && currentNode.pageNumbers && currentNode.pageNumbers.length > 1) {
      return true;
    }
    
    return false;
  };
}

function hasNestedTable(node: PdfNode): boolean {
  if (node.table) return true;
  if (Array.isArray(node.stack)) {
    return node.stack.some((child: unknown) => {
      if (typeof child === 'object' && child !== null) {
        return 'table' in child;
      }
      return false;
    });
  }
  return false;
}

export async function generateDocumentPdf(options: GeneratePdfOptions): Promise<string> {
  let logoBase64 = '';
  try {
    const logoUrl = options.theme?.logoUrl || '/assets/sbl-logo.png';
    logoBase64 = await loadImageAsBase64(logoUrl);
  } catch (e) {
    console.warn('Could not load logo for PDF:', e);
  }

  const { content, styles } = buildDocumentContent(options, logoBase64);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: {
      font: 'Roboto'
    },
    pageBreakBefore: createPageBreakBefore() as unknown as TDocumentDefinitions['pageBreakBefore']
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDocGenerator = pdfMake.createPdf(docDefinition) as unknown as PdfDocGenerator;
      pdfDocGenerator.getBase64((base64: string) => {
        resolve(base64);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function downloadDocumentPdf(options: GeneratePdfOptions, filename: string, iosWindow?: Window | null): Promise<void> {
  let logoBase64 = '';
  try {
    const logoUrl = options.theme?.logoUrl || '/assets/sbl-logo.png';
    logoBase64 = await loadImageAsBase64(logoUrl);
  } catch (e) {
    console.warn('Could not load logo for PDF:', e);
  }

  const { content, styles } = buildDocumentContent(options, logoBase64);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
    defaultStyle: {
      font: 'Roboto'
    },
    pageBreakBefore: createPageBreakBefore() as unknown as TDocumentDefinitions['pageBreakBefore']
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  if (isIOS) {
    const dataUrl = await new Promise<string>((resolve) => {
      (pdfDoc as unknown as { getDataUrl: (cb: (result: string) => void) => void }).getDataUrl((result: string) => resolve(result));
    });
    if (iosWindow) {
      iosWindow.location.href = dataUrl;
    } else {
      const blob = await new Promise<Blob>((resolve) => {
        (pdfDoc as unknown as { getBlob: (cb: (blob: Blob) => void) => void }).getBlob((result: Blob) => resolve(result));
      });
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      if (navigator.share && typeof File !== 'undefined') {
        try {
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          await navigator.share({ files: [file], title: filename });
          return;
        } catch (shareErr) {
          if ((shareErr as Error)?.name === 'AbortError') return;
        }
      }
      const blobUrl = URL.createObjectURL(pdfBlob);
      window.location.href = blobUrl;
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    }
  } else {
    await new Promise<void>((resolve, reject) => {
      try {
        (pdfDoc as unknown as { download: (filename: string, cb?: () => void) => void }).download(filename, () => {
          resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
