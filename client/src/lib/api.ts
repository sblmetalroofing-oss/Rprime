import type { Report, Finding, EstimateItem } from './store';
export type { Report } from './store';
import type { 
  Customer, InsertCustomer,
  Supplier, InsertSupplier,
  Job, InsertJob,
  Quote, InsertQuote, QuoteItem,
  Invoice, InsertInvoice, InvoiceItem,
  PurchaseOrder, InsertPurchaseOrder, PurchaseOrderItem,
  Item, InsertItem,
  CrewMember, InsertCrewMember,
  Appointment, InsertAppointment,
  DocumentSettings,
  LeadAttachment, InsertLeadAttachment
} from '@shared/schema';

import { feedbackLogger } from '@/lib/feedback';

const API_BASE = '/api';

// Shared fetch wrapper that includes credentials for session authentication
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  });
  
  // Log API failures (non-2xx responses) to feedback system
  if (!response.ok && !url.includes('/api/feedback/')) {
    try {
      const clonedResponse = response.clone();
      const responseText = await clonedResponse.text().catch(() => 'Unable to read response');
      feedbackLogger.logApiFailure(url, response.status, responseText);
    } catch (e) {
      // Silently ignore logging errors
    }
  }
  
  return response;
}

// Custom error class for API errors with status codes
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function fetchReports(): Promise<Report[]> {
  try {
    const response = await apiFetch(`${API_BASE}/reports`);
    if (!response.ok) throw new Error('Failed to fetch reports');
    const dbReports = await response.json();
    
    return dbReports.map((report: Omit<Report, 'findings' | 'estimateItems'>) => ({
      ...report,
      findings: [],
      estimateItems: []
    }));
  } catch (error) {
    console.error('Error fetching reports from API:', error);
    return [];
  }
}

export async function fetchReport(id: string): Promise<Report | null> {
  try {
    const response = await apiFetch(`${API_BASE}/reports/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch report');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching report from API:', error);
    return null;
  }
}

function stripReportForApi(report: Partial<Report> & Record<string, unknown>) {
  const { findings, estimateItems, createdAt, updatedAt, ...rest } = report as Partial<Report> & { createdAt?: unknown; updatedAt?: unknown };
  return rest;
}

export async function createReport(report: Omit<Report, 'createdAt' | 'updatedAt'>): Promise<Report | null> {
  try {
    const cleanReport = stripReportForApi(report);
    const response = await apiFetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanReport)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Create report error:', error);
      throw new Error('Failed to create report');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating report:', error);
    return null;
  }
}

export async function updateReport(id: string, updates: Partial<Report>): Promise<Report | null> {
  try {
    const cleanUpdates = stripReportForApi(updates);
    const response = await apiFetch(`${API_BASE}/reports/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanUpdates)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Update report error:', error);
      throw new Error('Failed to update report');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating report:', error);
    return null;
  }
}

export async function deleteReport(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/reports/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting report:', error);
    return false;
  }
}

export async function createFinding(reportId: string, finding: Finding): Promise<Finding | null> {
  try {
    // Extract only the fields needed for the database, ensuring required fields have defaults
    const findingData = {
      id: finding.id,
      category: finding.category || 'General Condition',
      severity: finding.severity || 'low',
      description: finding.description || '',
      recommendation: finding.recommendation || '',
      photoUrl: finding.photoUrl || null,
      photoUrls: (finding as Finding & { photoUrls?: string[] }).photoUrls || [],
    };
    
    const response = await apiFetch(`${API_BASE}/reports/${reportId}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(findingData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] createFinding failed:', response.status, errorText);
      throw new Error('Failed to create finding: ' + errorText);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[API] Error creating finding:', error);
    return null;
  }
}

export async function deleteFinding(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/findings/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting finding:', error);
    return false;
  }
}

export async function updateFinding(id: string, updates: Partial<Finding>): Promise<Finding | null> {
  try {
    const response = await apiFetch(`${API_BASE}/findings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update finding');
    return await response.json();
  } catch (error) {
    console.error('Error updating finding:', error);
    return null;
  }
}

export async function createEstimateItem(reportId: string, item: EstimateItem): Promise<EstimateItem | null> {
  try {
    const response = await apiFetch(`${API_BASE}/reports/${reportId}/estimate-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!response.ok) throw new Error('Failed to create estimate item');
    return await response.json();
  } catch (error) {
    console.error('Error creating estimate item:', error);
    return null;
  }
}

export async function deleteEstimateItem(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/estimate-items/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting estimate item:', error);
    return false;
  }
}

// Customer API functions
export async function fetchCustomers(search?: string): Promise<Customer[]> {
  try {
    const url = search 
      ? `${API_BASE}/customers?search=${encodeURIComponent(search)}`
      : `${API_BASE}/customers`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch customers');
    return await response.json();
  } catch (error) {
    console.error('Error fetching customers from API:', error);
    return [];
  }
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  try {
    const response = await apiFetch(`${API_BASE}/customers/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch customer');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching customer from API:', error);
    return null;
  }
}

export async function createCustomer(customer: InsertCustomer): Promise<Customer | null> {
  try {
    const response = await apiFetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Create customer error:', error);
      throw new Error('Failed to create customer');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating customer:', error);
    return null;
  }
}

export async function updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | null> {
  try {
    const response = await apiFetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Update customer error:', error);
      throw new Error('Failed to update customer');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating customer:', error);
    return null;
  }
}

export async function deleteCustomer(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
}

// Supplier API functions
export async function fetchSuppliers(search?: string): Promise<Supplier[]> {
  try {
    const url = search 
      ? `${API_BASE}/suppliers?search=${encodeURIComponent(search)}`
      : `${API_BASE}/suppliers`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch suppliers');
    return await response.json();
  } catch (error) {
    console.error('Error fetching suppliers from API:', error);
    return [];
  }
}

export async function fetchSupplier(id: string): Promise<Supplier | null> {
  try {
    const response = await apiFetch(`${API_BASE}/suppliers/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch supplier');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching supplier from API:', error);
    return null;
  }
}

export async function createSupplier(supplier: InsertSupplier): Promise<Supplier | null> {
  try {
    const response = await apiFetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Create supplier error:', error);
      throw new Error('Failed to create supplier');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating supplier:', error);
    return null;
  }
}

export async function updateSupplier(id: string, updates: Partial<InsertSupplier>): Promise<Supplier | null> {
  try {
    const response = await apiFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Update supplier error:', error);
      throw new Error('Failed to update supplier');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating supplier:', error);
    return null;
  }
}

export async function deleteSupplier(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting supplier:', error);
    return false;
  }
}

// Job API functions
export async function fetchJobs(): Promise<Job[]> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs`);
    if (!response.ok) throw new Error('Failed to fetch jobs');
    return await response.json();
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }
}

export async function fetchJob(id: string): Promise<Job | null> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch job');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching job:', error);
    return null;
  }
}

export interface JobWithDocuments {
  job: Job;
  reports: Report[];
  quotes: Quote[];
  invoices: Invoice[];
  purchaseOrders: PurchaseOrder[];
}

export async function fetchJobWithDocuments(id: string): Promise<JobWithDocuments | null> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${id}/full`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch job with documents');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching job with documents:', error);
    return null;
  }
}

export async function createJob(job: InsertJob): Promise<Job> {
  const response = await apiFetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create job');
  }
  return await response.json();
}

export async function updateJob(id: string, updates: Partial<InsertJob>): Promise<Job> {
  const response = await apiFetch(`${API_BASE}/jobs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update job');
  }
  return await response.json();
}

export async function deleteJob(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete job');
  }
}

// Job Status History API
export interface JobStatusHistory {
  id: string;
  jobId: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  note: string | null;
  createdAt: string;
}

export async function fetchJobStatusHistory(jobId: string): Promise<JobStatusHistory[]> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${jobId}/status-history`);
    if (!response.ok) throw new Error('Failed to fetch status history');
    return await response.json();
  } catch (error) {
    console.error('Error fetching status history:', error);
    return [];
  }
}

// Job Activities API
export interface JobActivity {
  id: string;
  jobId: string;
  type: string;
  content: string;
  attachments: string[] | null;
  createdBy: string | null;
  createdAt: string;
}

export async function fetchJobActivities(jobId: string): Promise<JobActivity[]> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${jobId}/activities`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch activities');
    return await response.json();
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

export interface RecentActivity {
  id: string;
  type: string;
  documentId?: string;
  documentNumber?: string;
  jobId?: string;
  content: string;
  address?: string;
  attachments?: string[] | null;
  createdByName?: string | null;
  timestamp: string;
}

export async function fetchRecentActivities(): Promise<RecentActivity[]> {
  try {
    const response = await apiFetch(`${API_BASE}/activities/recent`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch recent activities');
    return await response.json();
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return [];
  }
}

export async function createJobActivity(jobId: string, content: string, type: string = 'note', attachments: string[] = [], createdBy?: string): Promise<JobActivity> {
  const response = await apiFetch(`${API_BASE}/jobs/${jobId}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ jobId, content, type, attachments: attachments.length > 0 ? attachments : null, createdBy })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create activity');
  }
  return await response.json();
}

export async function deleteJobActivity(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/job-activities/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete activity');
  }
}

// Job Templates API
export interface JobTemplate {
  id: string;
  name: string;
  description: string | null;
  defaultTitle: string;
  defaultDescription: string | null;
  estimatedDuration: number | null;
  priority: string;
  category: string | null;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchJobTemplates(): Promise<JobTemplate[]> {
  try {
    const response = await apiFetch(`${API_BASE}/job-templates`);
    if (!response.ok) throw new Error('Failed to fetch job templates');
    return await response.json();
  } catch (error) {
    console.error('Error fetching job templates:', error);
    return [];
  }
}

export async function createJobTemplate(template: Omit<JobTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<JobTemplate> {
  const response = await apiFetch(`${API_BASE}/job-templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(template)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create job template');
  }
  return await response.json();
}

export async function updateJobTemplate(id: string, updates: Partial<JobTemplate>): Promise<JobTemplate> {
  const response = await apiFetch(`${API_BASE}/job-templates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update job template');
  }
  return await response.json();
}

export async function deleteJobTemplate(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/job-templates/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete job template');
  }
}

// Quote API functions
export type QuoteWithItems = Quote & { items: QuoteItem[] };

export async function fetchQuotes(): Promise<Quote[]> {
  try {
    const response = await apiFetch(`${API_BASE}/quotes`);
    if (!response.ok) throw new Error('Failed to fetch quotes');
    return await response.json();
  } catch (error) {
    console.error('Error fetching quotes:', error);
    return [];
  }
}

export async function fetchQuote(id: string): Promise<QuoteWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/quotes/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch quote');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching quote:', error);
    return null;
  }
}

export async function fetchQuotePublic(id: string): Promise<QuoteWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/public/quotes/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch quote');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching public quote:', error);
    return null;
  }
}

export interface ReportData {
  id: string;
  reportNumber: string;
  propertyAddress: string;
  inspectionDate: string;
  propertyType: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  roofType: string | null;
  roofAge: string | null;
  roofCondition: string | null;
  summary: string | null;
  status: string;
  findings: Array<{
    id: string;
    category: string;
    severity: string;
    description: string;
    recommendation: string;
    photoUrl: string | null;
    photoUrls: string[];
  }>;
  estimateItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export interface PublicDocumentResponse {
  documentType: 'quote' | 'invoice' | 'purchase_order' | 'report';
  document: QuoteWithItems | InvoiceWithItems | PurchaseOrderWithItems | ReportData;
  settings?: {
    acceptDeclineEnabled?: boolean;
    creditCardEnabled?: boolean;
  };
}

export async function fetchDocumentByToken(token: string): Promise<PublicDocumentResponse | null> {
  try {
    const response = await apiFetch(`${API_BASE}/public/view/${token}`);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid or expired token');
      }
      if (response.status === 404) return null;
      throw new Error('Failed to fetch document');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching document by token:', error);
    throw error;
  }
}

export async function acceptQuotePublic(token: string, customerName?: string, signature?: string): Promise<{ success: boolean; quote?: Quote }> {
  const response = await fetch(`${API_BASE}/public/quote/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, customerName, signature })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to accept quote');
  }
  return await response.json();
}

export async function declineQuotePublic(token: string, reason?: string): Promise<{ success: boolean; quote?: Quote }> {
  const response = await fetch(`${API_BASE}/public/quote/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, reason })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to decline quote');
  }
  return await response.json();
}

export async function createInvoiceCheckout(token: string): Promise<{ url: string }> {
  const response = await fetch(`${API_BASE}/public/invoice/create-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }
  return await response.json();
}

export async function getNextQuoteNumber(): Promise<string> {
  try {
    const response = await apiFetch(`${API_BASE}/quotes/next-number`);
    if (!response.ok) throw new Error('Failed to get quote number');
    const data = await response.json();
    return data.quoteNumber;
  } catch (error) {
    console.error('Error getting quote number:', error);
    return `Q${Date.now()}`;
  }
}

export async function createQuote(quote: InsertQuote & { items?: Omit<QuoteItem, 'id' | 'quoteId'>[] }): Promise<QuoteWithItems> {
  const response = await apiFetch(`${API_BASE}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quote)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create quote');
  }
  return await response.json();
}

export async function updateQuote(id: string, updates: Partial<InsertQuote> & { items?: Omit<QuoteItem, 'quoteId'>[] }): Promise<QuoteWithItems> {
  const response = await apiFetch(`${API_BASE}/quotes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update quote');
  }
  return await response.json();
}

export async function deleteQuote(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/quotes/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete quote');
  }
}

// Invoice API functions
export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

export async function fetchInvoices(): Promise<Invoice[]> {
  try {
    const response = await apiFetch(`${API_BASE}/invoices`);
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

export async function fetchInvoice(id: string): Promise<InvoiceWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/invoices/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch invoice');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return null;
  }
}

export async function fetchInvoicePublic(id: string): Promise<InvoiceWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/public/invoices/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch invoice');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching public invoice:', error);
    return null;
  }
}

export async function getNextInvoiceNumber(): Promise<string> {
  try {
    const response = await apiFetch(`${API_BASE}/invoices/next-number`);
    if (!response.ok) throw new Error('Failed to get invoice number');
    const data = await response.json();
    return data.invoiceNumber;
  } catch (error) {
    console.error('Error getting invoice number:', error);
    return `INV${Date.now()}`;
  }
}

export async function createInvoice(invoice: InsertInvoice & { items?: Omit<InvoiceItem, 'id' | 'invoiceId'>[] }): Promise<InvoiceWithItems> {
  const response = await apiFetch(`${API_BASE}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(invoice)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create invoice');
  }
  return await response.json();
}

export async function updateInvoice(id: string, updates: Partial<InsertInvoice> & { items?: Omit<InvoiceItem, 'invoiceId'>[] }): Promise<InvoiceWithItems> {
  const response = await apiFetch(`${API_BASE}/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update invoice');
  }
  return await response.json();
}

export async function deleteInvoice(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete invoice');
  }
}

// Purchase Order API functions
export type PurchaseOrderWithItems = PurchaseOrder & { items: PurchaseOrderItem[] };

export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> {
  try {
    const response = await apiFetch(`${API_BASE}/purchase-orders`);
    if (!response.ok) throw new Error('Failed to fetch purchase orders');
    return await response.json();
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return [];
  }
}

export async function fetchPurchaseOrder(id: string): Promise<PurchaseOrderWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/purchase-orders/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch purchase order');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return null;
  }
}

export async function fetchPurchaseOrderPublic(id: string): Promise<PurchaseOrderWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/public/purchase-orders/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch purchase order');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching public purchase order:', error);
    return null;
  }
}

export async function getNextPONumber(): Promise<string> {
  try {
    const response = await apiFetch(`${API_BASE}/purchase-orders/next-number`);
    if (!response.ok) throw new Error('Failed to get PO number');
    const data = await response.json();
    return data.poNumber;
  } catch (error) {
    console.error('Error getting PO number:', error);
    return `PO${Date.now()}`;
  }
}

export async function createPurchaseOrder(po: InsertPurchaseOrder & { items?: Omit<PurchaseOrderItem, 'id' | 'purchaseOrderId'>[] }): Promise<PurchaseOrderWithItems> {
  const response = await apiFetch(`${API_BASE}/purchase-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(po)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create purchase order');
  }
  return await response.json();
}

export async function updatePurchaseOrder(id: string, updates: Partial<InsertPurchaseOrder> & { items?: Omit<PurchaseOrderItem, 'purchaseOrderId'>[] }): Promise<PurchaseOrderWithItems> {
  const response = await apiFetch(`${API_BASE}/purchase-orders/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update purchase order');
  }
  return await response.json();
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  const response = await apiFetch(`${API_BASE}/purchase-orders/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete purchase order');
  }
}

// Items/Products catalog API functions
export async function fetchItems(search?: string): Promise<Item[]> {
  try {
    const url = search ? `${API_BASE}/items?search=${encodeURIComponent(search)}` : `${API_BASE}/items`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch items');
    return await response.json();
  } catch (error) {
    console.error('Error fetching items:', error);
    return [];
  }
}

export async function fetchItem(id: string): Promise<Item | null> {
  try {
    const response = await apiFetch(`${API_BASE}/items/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch item');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching item:', error);
    return null;
  }
}

export async function createItem(item: InsertItem): Promise<Item | null> {
  try {
    const response = await apiFetch(`${API_BASE}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!response.ok) throw new Error('Failed to create item');
    return await response.json();
  } catch (error) {
    console.error('Error creating item:', error);
    return null;
  }
}

export async function createItemsBulk(items: InsertItem[]): Promise<{ created: number; items: Item[] } | null> {
  try {
    const response = await apiFetch(`${API_BASE}/items/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (!response.ok) throw new Error('Failed to bulk create items');
    return await response.json();
  } catch (error) {
    console.error('Error bulk creating items:', error);
    return null;
  }
}

export interface ColumnMapping {
  itemCode?: number;
  description?: number;
  sellPrice?: number;
  costPrice?: number;
  category?: number;
  unit?: number;
  supplierName?: number;
}

export async function importItemsCSV(rows: string[][], columnMapping: ColumnMapping, defaultMarkupPercent?: number): Promise<{ created: number; total: number; errors?: string[] } | null> {
  try {
    const response = await apiFetch(`${API_BASE}/items/import-csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, columnMapping, defaultMarkupPercent })
    });
    if (!response.ok) throw new Error('Failed to import CSV items');
    return await response.json();
  } catch (error) {
    console.error('Error importing CSV items:', error);
    return null;
  }
}

export async function updateItem(id: string, updates: Partial<InsertItem>): Promise<Item | null> {
  try {
    const response = await apiFetch(`${API_BASE}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update item');
    return await response.json();
  } catch (error) {
    console.error('Error updating item:', error);
    return null;
  }
}

export async function deleteItem(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/items/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
}

// Document Settings API functions
// Re-export DocumentSettings type from shared schema
export type { DocumentSettings } from '@shared/schema';

export async function fetchDocumentSettings(type: string): Promise<DocumentSettings | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-settings/${type}`);
    if (!response.ok) throw new Error('Failed to fetch document settings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching document settings:', error);
    return null;
  }
}

export async function updateDocumentSettings(type: string, settings: Partial<DocumentSettings>): Promise<DocumentSettings | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-settings/${type}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!response.ok) throw new Error('Failed to update document settings');
    return await response.json();
  } catch (error) {
    console.error('Error updating document settings:', error);
    return null;
  }
}

// App Settings API functions
export async function fetchAppSettings(): Promise<Record<string, string>> {
  try {
    const response = await apiFetch(`${API_BASE}/app-settings`);
    if (!response.ok) throw new Error('Failed to fetch app settings');
    return await response.json();
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return {};
  }
}

export async function fetchAppSetting(key: string): Promise<string | null> {
  try {
    const response = await apiFetch(`${API_BASE}/app-settings/${key}`);
    if (!response.ok) throw new Error('Failed to fetch app setting');
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Error fetching app setting:', error);
    return null;
  }
}

export async function updateAppSetting(key: string, value: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/app-settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    return response.ok;
  } catch (error) {
    console.error('Error updating app setting:', error);
    return false;
  }
}

// Invoice Payment API functions
export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export async function fetchInvoicePayments(invoiceId: string): Promise<InvoicePayment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/invoices/${invoiceId}/payments`);
    if (!response.ok) throw new Error('Failed to fetch invoice payments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoice payments:', error);
    return [];
  }
}

export async function createInvoicePayment(invoiceId: string, payment: Omit<InvoicePayment, 'id' | 'invoiceId' | 'createdAt'>): Promise<InvoicePayment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payment)
    });
    if (!response.ok) throw new Error('Failed to create invoice payment');
    return await response.json();
  } catch (error) {
    console.error('Error creating invoice payment:', error);
    return null;
  }
}

export async function deleteInvoicePayment(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/invoice-payments/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting invoice payment:', error);
    return false;
  }
}

// Crew Member API functions
export async function fetchCrewMembers(): Promise<CrewMember[]> {
  try {
    const response = await apiFetch(`${API_BASE}/crew-members`);
    if (!response.ok) throw new Error('Failed to fetch crew members');
    return await response.json();
  } catch (error) {
    console.error('Error fetching crew members:', error);
    return [];
  }
}

export async function createCrewMember(member: InsertCrewMember): Promise<CrewMember | null> {
  try {
    const response = await apiFetch(`${API_BASE}/crew-members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    if (!response.ok) throw new Error('Failed to create crew member');
    return await response.json();
  } catch (error) {
    console.error('Error creating crew member:', error);
    return null;
  }
}

export async function updateCrewMember(id: string, updates: Partial<InsertCrewMember>): Promise<CrewMember | null> {
  try {
    const response = await apiFetch(`${API_BASE}/crew-members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update crew member');
    return await response.json();
  } catch (error) {
    console.error('Error updating crew member:', error);
    return null;
  }
}

export async function deleteCrewMember(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/crew-members/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting crew member:', error);
    return false;
  }
}

// Appointment API functions
export async function fetchAppointments(): Promise<Appointment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments`);
    if (!response.ok) throw new Error('Failed to fetch appointments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}

export async function fetchAppointment(id: string): Promise<Appointment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch appointment');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return null;
  }
}

export async function createAppointment(appointment: InsertAppointment): Promise<Appointment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    });
    if (!response.ok) throw new Error('Failed to create appointment');
    return await response.json();
  } catch (error) {
    console.error('Error creating appointment:', error);
    return null;
  }
}

export async function updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update appointment');
    return await response.json();
  } catch (error) {
    console.error('Error updating appointment:', error);
    return null;
  }
}

export async function deleteAppointment(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
}

export async function fetchAppointmentsByJob(jobId: string): Promise<Appointment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${jobId}/appointments`);
    if (!response.ok) throw new Error('Failed to fetch job appointments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching job appointments:', error);
    return [];
  }
}

export async function createBatchAppointments(appointments: InsertAppointment[]): Promise<Appointment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/appointments/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointments })
    });
    if (!response.ok) throw new Error('Failed to create appointments');
    return await response.json();
  } catch (error) {
    console.error('Error creating batch appointments:', error);
    return [];
  }
}

// Photo Upload API - uploads base64 photo to cloud storage
export async function uploadPhoto(base64Data: string): Promise<string | null> {
  try {
    const response = await apiFetch(`${API_BASE}/uploads/base64`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64Data, contentType: 'image/jpeg' })
    });
    if (!response.ok) throw new Error('Failed to upload photo');
    const result = await response.json();
    return result.url;
  } catch (error) {
    console.error('Error uploading photo:', error);
    return null;
  }
}

// AI Photo Analysis API
export interface PhotoAnalysisResult {
  category: string;
  severity: string;
  description: string;
  recommendation: string;
}

export async function analyzePhoto(photoUrls: string | string[], context?: string): Promise<PhotoAnalysisResult> {
  const urls = Array.isArray(photoUrls) ? photoUrls : [photoUrls];
  const response = await apiFetch(`${API_BASE}/ai/analyze-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrls: urls, context })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to analyze photo');
  }
  return await response.json();
}

// AI Report Analysis API
export interface ReportSuggestion {
  type: 'content' | 'missing' | 'structure' | 'estimate' | 'language';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  findingIndex: number | null;
}

export interface ReportAnalysisResult {
  overallScore: number;
  summary: string;
  suggestions: ReportSuggestion[];
  quickWins: string[];
}

export interface ReportAnalysisInput {
  findings: Array<{
    category: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  estimateItems?: Array<{
    description: string;
    qty: number;
    unitCost: number;
  }>;
  roofType?: string;
  roofPitch?: string;
  reportStatus?: string;
}

export async function analyzeReport(input: ReportAnalysisInput): Promise<ReportAnalysisResult> {
  const response = await apiFetch(`${API_BASE}/ai/analyze-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to analyze report');
  }
  return await response.json();
}

export interface ReportSummaryInput {
  findings: Array<{
    category: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  estimateItems?: Array<{
    description: string;
    qty: number;
    unitCost: number;
  }>;
  roofType?: string;
  roofPitch?: string;
  storeys?: string;
  accessMethod?: string;
  customerName?: string;
  address?: string;
  date?: string;
  inspector?: string;
}

export async function summarizeReport(input: ReportSummaryInput): Promise<{ summary: string }> {
  const response = await apiFetch(`${API_BASE}/ai/summarize-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to generate report summary');
  }
  return await response.json();
}

// Lead API functions
import type { Lead, InsertLead, LeadActivity, InsertLeadActivity, LeadReminder, InsertLeadReminder } from '@shared/schema';

export type LeadWithDetails = Lead & { activities: LeadActivity[]; reminders: LeadReminder[] };

export async function fetchLeads(): Promise<Lead[]> {
  try {
    const response = await apiFetch(`${API_BASE}/leads`);
    if (!response.ok) throw new Error('Failed to fetch leads');
    return await response.json();
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
}

export async function fetchLead(id: string): Promise<LeadWithDetails | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch lead');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching lead:', error);
    return null;
  }
}

export async function createLead(lead: InsertLead): Promise<Lead | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead)
    });
    if (!response.ok) throw new Error('Failed to create lead');
    return await response.json();
  } catch (error) {
    console.error('Error creating lead:', error);
    return null;
  }
}

export async function updateLead(id: string, updates: Partial<InsertLead>): Promise<Lead | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update lead');
    return await response.json();
  } catch (error) {
    console.error('Error updating lead:', error);
    return null;
  }
}

export async function deleteLead(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting lead:', error);
    return false;
  }
}

export async function convertLead(id: string, createJob: boolean): Promise<{ customer: Customer; job?: Job } | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ createJob })
    });
    if (!response.ok) throw new Error('Failed to convert lead');
    return await response.json();
  } catch (error) {
    console.error('Error converting lead:', error);
    return null;
  }
}

export async function createQuoteFromLead(leadId: string): Promise<{ quote: any; customer: any } | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/create-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create quote from lead');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating quote from lead:', error);
    throw error;
  }
}

export async function convertLeadToJob(leadId: string): Promise<{ job: any; attachmentsCopied: number } | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/convert-to-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to convert lead to job');
    }
    return await response.json();
  } catch (error) {
    console.error('Error converting lead to job:', error);
    throw error;
  }
}

export async function createLeadActivity(leadId: string, activity: Omit<InsertLeadActivity, 'leadId'>): Promise<LeadActivity | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity)
    });
    if (!response.ok) throw new Error('Failed to create lead activity');
    return await response.json();
  } catch (error) {
    console.error('Error creating lead activity:', error);
    return null;
  }
}

export async function createLeadReminder(leadId: string, reminder: Omit<InsertLeadReminder, 'leadId'>): Promise<LeadReminder | null> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminder)
    });
    if (!response.ok) throw new Error('Failed to create lead reminder');
    return await response.json();
  } catch (error) {
    console.error('Error creating lead reminder:', error);
    return null;
  }
}

// Lead Attachment API functions
export async function fetchLeadAttachments(leadId: string): Promise<LeadAttachment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/attachments`);
    if (!response.ok) throw new Error('Failed to fetch lead attachments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching lead attachments:', error);
    return [];
  }
}

export async function fetchLeadAttachmentCount(leadId: string): Promise<number> {
  try {
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/attachments/count`);
    if (!response.ok) throw new Error('Failed to fetch attachment count');
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error fetching lead attachment count:', error);
    return 0;
  }
}

export async function uploadLeadAttachment(
  leadId: string, 
  file: File, 
  category: string = 'other',
  caption?: string
): Promise<LeadAttachment | null> {
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    const response = await apiFetch(`${API_BASE}/leads/${leadId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: base64,
        contentType: file.type,
        fileName: file.name,
        category,
        caption
      })
    });
    if (!response.ok) throw new Error('Failed to upload attachment');
    return await response.json();
  } catch (error) {
    console.error('Error uploading lead attachment:', error);
    return null;
  }
}

export async function updateLeadAttachment(
  id: string, 
  updates: { caption?: string; category?: string }
): Promise<LeadAttachment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/attachments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update attachment');
    return await response.json();
  } catch (error) {
    console.error('Error updating lead attachment:', error);
    return null;
  }
}

export async function deleteLeadAttachment(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/attachments/${id}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting lead attachment:', error);
    return false;
  }
}

// Crew Schedule and Checklist API functions
import type { CrewChecklist, InsertCrewChecklist, ChecklistItem } from '@shared/schema';

export type CrewChecklistWithItems = CrewChecklist & { items: ChecklistItem[] };

export async function getCrewSchedule(date?: string, crewMemberId?: string): Promise<Job[]> {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (crewMemberId) params.append('crewMemberId', crewMemberId);
    const url = `${API_BASE}/crew/schedule${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch crew schedule');
    return await response.json();
  } catch (error) {
    console.error('Error fetching crew schedule:', error);
    return [];
  }
}

export async function getJobChecklists(jobId: string): Promise<CrewChecklist[]> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${jobId}/checklists`);
    if (!response.ok) throw new Error('Failed to fetch job checklists');
    return await response.json();
  } catch (error) {
    console.error('Error fetching job checklists:', error);
    return [];
  }
}

export async function getChecklist(id: string): Promise<CrewChecklistWithItems | null> {
  try {
    const response = await apiFetch(`${API_BASE}/checklists/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch checklist');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return null;
  }
}

export async function checkChecklistItem(id: string, checkedBy: string, notes?: string): Promise<ChecklistItem | null> {
  try {
    const response = await apiFetch(`${API_BASE}/checklist-items/${id}/check`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkedBy, notes })
    });
    if (!response.ok) throw new Error('Failed to check checklist item');
    return await response.json();
  } catch (error) {
    console.error('Error checking checklist item:', error);
    return null;
  }
}

export async function completeChecklist(id: string, completedBy: string): Promise<CrewChecklist | null> {
  try {
    const response = await apiFetch(`${API_BASE}/checklists/${id}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedBy })
    });
    if (!response.ok) throw new Error('Failed to complete checklist');
    return await response.json();
  } catch (error) {
    console.error('Error completing checklist:', error);
    return null;
  }
}

export async function createJobChecklist(jobId: string, checklist: Omit<InsertCrewChecklist, 'jobId'>): Promise<CrewChecklist | null> {
  try {
    const response = await apiFetch(`${API_BASE}/jobs/${jobId}/checklists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checklist)
    });
    if (!response.ok) throw new Error('Failed to create checklist');
    return await response.json();
  } catch (error) {
    console.error('Error creating checklist:', error);
    return null;
  }
}

// ===== CHAT API =====
import type { ChatChannel, InsertChatChannel, ChatMessage, InsertChatMessage, DirectMessage, InsertDirectMessage } from '@shared/schema';

export async function fetchChatChannels(): Promise<ChatChannel[]> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch channels');
    return await response.json();
  } catch (error) {
    console.error('Error fetching channels:', error);
    return [];
  }
}

export async function fetchChatChannel(id: string): Promise<ChatChannel | null> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels/${id}`, { credentials: 'include' });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching channel:', error);
    return null;
  }
}

export async function createChatChannel(channel: InsertChatChannel): Promise<ChatChannel | null> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(channel)
    });
    if (!response.ok) throw new Error('Failed to create channel');
    return await response.json();
  } catch (error) {
    console.error('Error creating channel:', error);
    return null;
  }
}

export async function fetchChatMessages(channelId: string, limit?: number, before?: string): Promise<ChatMessage[]> {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages?${params}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return await response.json();
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

export async function createChatMessage(channelId: string, message: Omit<InsertChatMessage, 'channelId'>): Promise<ChatMessage | null> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(message)
    });
    if (!response.ok) throw new Error('Failed to create message');
    return await response.json();
  } catch (error) {
    console.error('Error creating message:', error);
    return null;
  }
}

export async function updateChatMessage(id: string, updates: Partial<InsertChatMessage>): Promise<ChatMessage | null> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/messages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update message');
    return await response.json();
  } catch (error) {
    console.error('Error updating message:', error);
    return null;
  }
}

export async function deleteChatMessage(id: string, senderId: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/messages/${id}?senderId=${encodeURIComponent(senderId)}`, { method: 'DELETE', credentials: 'include' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
}

export async function fetchDMConversations(userId: string): Promise<{recipientId: string, recipientName: string, lastMessage: DirectMessage}[]> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/dm/conversations?userId=${userId}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return await response.json();
  } catch (error) {
    console.error('Error fetching DM conversations:', error);
    return [];
  }
}

export async function fetchDirectMessages(userId1: string, userId2: string, limit?: number, before?: string): Promise<DirectMessage[]> {
  try {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await apiFetch(`${API_BASE}/chat/dm/${userId1}/${userId2}${queryString}`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch DMs');
    return await response.json();
  } catch (error) {
    console.error('Error fetching direct messages:', error);
    return [];
  }
}

export async function createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage | null> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/dm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(message)
    });
    if (!response.ok) throw new Error('Failed to create DM');
    return await response.json();
  } catch (error) {
    console.error('Error creating direct message:', error);
    return null;
  }
}

export async function markDMsRead(senderId: string, recipientId: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/dm/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ senderId, recipientId })
    });
    return response.ok;
  } catch (error) {
    console.error('Error marking DMs read:', error);
    return false;
  }
}

export async function markChannelRead(channelId: string, crewMemberId: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/read/${crewMemberId}`, {
      method: 'POST',
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    console.error('Error marking channel read:', error);
    return false;
  }
}

export async function getChannelUnreadCount(channelId: string, crewMemberId: string): Promise<number> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/channels/${channelId}/unread/${crewMemberId}`, {
      credentials: 'include'
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error getting channel unread count:', error);
    return 0;
  }
}

export async function getDMUnreadCount(senderId: string, recipientId: string): Promise<number> {
  try {
    const response = await apiFetch(`${API_BASE}/chat/dm/unread/${senderId}/${recipientId}`, {
      credentials: 'include'
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error getting DM unread count:', error);
    return 0;
  }
}

export interface DocumentTheme {
  id: string;
  name: string;
  themeColor: string | null;
  companyName: string | null;
  abn: string | null;
  licenseNumber: string | null;
  phone: string | null;
  email1: string | null;
  email2: string | null;
  website: string | null;
  address: string | null;
  logoUrl: string | null;
  logoPosition: string | null;
  termsUrl: string | null;
  customLink1Label: string | null;
  customLink1Url: string | null;
  customLink2Label: string | null;
  customLink2Url: string | null;
  bankName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  payId: string | null;
  isDefault: string;
  isArchived: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function fetchDocumentThemes(includeArchived?: boolean): Promise<DocumentTheme[]> {
  try {
    const params = includeArchived ? '?includeArchived=true' : '';
    const response = await apiFetch(`${API_BASE}/document-themes${params}`);
    if (!response.ok) throw new Error('Failed to fetch themes');
    return await response.json();
  } catch (error) {
    console.error('Error fetching document themes:', error);
    return [];
  }
}

export async function fetchDocumentTheme(id: string): Promise<DocumentTheme | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch theme');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching document theme:', error);
    return null;
  }
}

export async function fetchDefaultDocumentTheme(): Promise<DocumentTheme | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes/default`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch default theme');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching default document theme:', error);
    return null;
  }
}

export async function createDocumentTheme(theme: Partial<DocumentTheme>): Promise<DocumentTheme | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(theme)
    });
    if (!response.ok) throw new Error('Failed to create theme');
    return await response.json();
  } catch (error) {
    console.error('Error creating document theme:', error);
    return null;
  }
}

export async function updateDocumentTheme(id: string, updates: Partial<DocumentTheme>): Promise<DocumentTheme | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update theme');
    return await response.json();
  } catch (error) {
    console.error('Error updating document theme:', error);
    return null;
  }
}

export async function deleteDocumentTheme(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting document theme:', error);
    return false;
  }
}

export interface DocumentThemeSettings {
  id: string;
  themeId: string;
  documentType: string;
  documentTitle: string | null;
  draftTitle: string | null;
  defaultTerms: string | null;
  showJobNumber: string;
  showJobAddress: string;
  showReference: string;
  showDescription: string;
  showQuantity: string;
  showUnitPrice: string;
  showDiscount: string;
  showAmount: string;
  showNotes: string;
  descriptionPosition: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export async function fetchDocumentThemeSettings(themeId: string): Promise<DocumentThemeSettings[]> {
  try {
    const response = await apiFetch(`${API_BASE}/document-themes/${themeId}/settings`);
    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error('Failed to fetch theme settings');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching document theme settings:', error);
    return [];
  }
}

// Document Attachment API functions
export interface DocumentAttachment {
  id: string;
  documentType: string;
  documentId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  storageKey: string;
  uploadedBy?: string;
  createdAt: string;
}

export async function fetchDocumentAttachments(documentType: string, documentId: string): Promise<DocumentAttachment[]> {
  try {
    const response = await apiFetch(`${API_BASE}/document-attachments/${documentType}/${documentId}`);
    if (!response.ok) throw new Error('Failed to fetch attachments');
    return await response.json();
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return [];
  }
}

export async function createDocumentAttachment(data: Omit<DocumentAttachment, 'id' | 'createdAt'>): Promise<DocumentAttachment | null> {
  try {
    const response = await apiFetch(`${API_BASE}/document-attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create attachment');
    return await response.json();
  } catch (error) {
    console.error('Error creating attachment:', error);
    return null;
  }
}

export async function deleteDocumentAttachment(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/document-attachments/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return false;
  }
}

// ============================================
// RFlash - Flashing Profile Designer API
// ============================================

export interface FlashingMaterial {
  id: string;
  name: string;
  brand: string | null;
  colorCode: string | null;
  isActive: string;
  sortOrder: number | null;
  createdAt: string | null;
}

export interface FlashingOrder {
  id: string;
  organizationId: string;
  orderNumber: string;
  jobId: string | null;
  purchaseOrderId: string | null;
  customerName: string | null;
  customerAddress: string | null;
  supplierName: string | null;
  notes: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
}

export interface FlashingProfilePoint {
  x: number;
  y: number;
}

export interface FlashingEndFoldState {
  type: 'none' | 'crush' | 'open_crush' | 'hook' | 'break';
  length: number;
  direction: 'up' | 'down';
}

export interface FlashingProfile {
  id: string;
  orderId: string;
  code: string;
  name: string | null;
  materialId: string | null;
  materialName: string | null;
  points: FlashingProfilePoint[];
  girth: number;
  folds: number;
  quantity: number;
  lengthMm: number;
  colorSide: string | null;
  startFold: FlashingEndFoldState | null;
  endFold: FlashingEndFoldState | null;
  labelOffsets: Record<string, { x: number; y: number }> | null;
  comments: Array<{ id: string; text: string; x: number; y: number; width: number; height: number }> | null;
  sortOrder: number | null;
  createdAt: string | null;
}

export interface FlashingTemplate {
  id: string;
  organizationId: string;
  name: string;
  category: string | null;
  points: FlashingProfilePoint[];
  defaultGirth: number | null;
  defaultFolds: number | null;
  isActive: string;
  createdAt: string | null;
}

export async function fetchFlashingMaterials(): Promise<FlashingMaterial[]> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/materials`);
    if (!response.ok) throw new Error('Failed to fetch materials');
    return await response.json();
  } catch (error) {
    console.error('Error fetching flashing materials:', error);
    return [];
  }
}

export async function fetchFlashingOrders(jobId?: string): Promise<FlashingOrder[]> {
  try {
    const url = jobId ? `${API_BASE}/rflash/orders?jobId=${jobId}` : `${API_BASE}/rflash/orders`;
    const response = await apiFetch(url);
    if (!response.ok) throw new Error('Failed to fetch orders');
    return await response.json();
  } catch (error) {
    console.error('Error fetching flashing orders:', error);
    return [];
  }
}

export async function fetchFlashingOrder(id: string): Promise<FlashingOrder | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch order');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching flashing order:', error);
    return null;
  }
}

export async function createFlashingOrder(data: Partial<FlashingOrder>): Promise<FlashingOrder | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create order');
    return await response.json();
  } catch (error) {
    console.error('Error creating flashing order:', error);
    return null;
  }
}

export async function updateFlashingOrder(id: string, data: Partial<FlashingOrder>): Promise<FlashingOrder | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update order');
    return await response.json();
  } catch (error) {
    console.error('Error updating flashing order:', error);
    return null;
  }
}

export async function deleteFlashingOrder(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting flashing order:', error);
    return false;
  }
}

export async function fetchFlashingProfiles(orderId: string): Promise<FlashingProfile[]> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders/${orderId}/profiles`);
    if (!response.ok) throw new Error('Failed to fetch profiles');
    return await response.json();
  } catch (error) {
    console.error('Error fetching flashing profiles:', error);
    return [];
  }
}

export async function createFlashingProfile(data: Partial<FlashingProfile>): Promise<FlashingProfile | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create profile');
    return await response.json();
  } catch (error) {
    console.error('Error creating flashing profile:', error);
    return null;
  }
}

export async function updateFlashingProfile(id: string, data: Partial<FlashingProfile>): Promise<FlashingProfile | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return await response.json();
  } catch (error) {
    console.error('Error updating flashing profile:', error);
    return null;
  }
}

export async function deleteFlashingProfile(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/profiles/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting flashing profile:', error);
    return false;
  }
}

export async function fetchNextFlashingCode(orderId: string): Promise<string> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/orders/${orderId}/next-code`);
    if (!response.ok) throw new Error('Failed to get next code');
    const data = await response.json();
    return data.code;
  } catch (error) {
    console.error('Error getting next flashing code:', error);
    return 'A1';
  }
}

export async function fetchFlashingTemplates(): Promise<FlashingTemplate[]> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/templates`);
    if (!response.ok) throw new Error('Failed to fetch templates');
    return await response.json();
  } catch (error) {
    console.error('Error fetching flashing templates:', error);
    return [];
  }
}

export async function createFlashingTemplate(data: Partial<FlashingTemplate>): Promise<FlashingTemplate | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create template');
    return await response.json();
  } catch (error) {
    console.error('Error creating flashing template:', error);
    return null;
  }
}

export async function updateFlashingTemplate(id: string, data: Partial<FlashingTemplate>): Promise<FlashingTemplate | null> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update template');
    return await response.json();
  } catch (error) {
    console.error('Error updating flashing template:', error);
    return null;
  }
}

export async function deleteFlashingTemplate(id: string): Promise<boolean> {
  try {
    const response = await apiFetch(`${API_BASE}/rflash/templates/${id}`, { method: 'DELETE' });
    return response.ok;
  } catch (error) {
    console.error('Error deleting flashing template:', error);
    return false;
  }
}

// Dashboard Widget types and API
export interface DashboardWidget {
  id: string;
  name: string;
  visible: boolean;
  order: number;
}

export async function fetchDashboardWidgets(): Promise<DashboardWidget[] | null> {
  try {
    const response = await apiFetch(`${API_BASE}/dashboard-widgets`);
    if (!response.ok) throw new Error('Failed to fetch dashboard widgets');
    const data = await response.json();
    return data.widgets;
  } catch (error) {
    console.error('Error fetching dashboard widgets:', error);
    return null;
  }
}

export async function saveDashboardWidgets(widgets: DashboardWidget[]): Promise<DashboardWidget[] | null> {
  try {
    const response = await apiFetch(`${API_BASE}/dashboard-widgets`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgets })
    });
    if (!response.ok) throw new Error('Failed to save dashboard widgets');
    const data = await response.json();
    return data.widgets;
  } catch (error) {
    console.error('Error saving dashboard widgets:', error);
    return null;
  }
}
