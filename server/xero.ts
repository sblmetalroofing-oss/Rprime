import { XeroClient, Contact, Invoice, LineItem, Invoices, Contacts, LineAmountTypes, Payment, Payments, Account } from 'xero-node';
import * as crypto from 'crypto';

export class XeroAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XeroAuthError';
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const XERO_SCOPES = 'openid profile email accounting.transactions accounting.contacts accounting.settings.read offline_access';

function getRedirectUri(): string {
  if (process.env.XERO_REDIRECT_URI) {
    return process.env.XERO_REDIRECT_URI;
  }
  const domain = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000';
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  return `${baseUrl}/api/xero/callback`;
}

function createXeroClient(): XeroClient {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('XERO_CLIENT_ID and XERO_CLIENT_SECRET environment variables are required');
  }
  
  return new XeroClient({
    clientId,
    clientSecret,
    redirectUris: [getRedirectUri()],
    scopes: XERO_SCOPES.split(' '),
  });
}

export async function getAuthUrl(state: string): Promise<string> {
  const xero = createXeroClient();
  const consentUrl = await xero.buildConsentUrl();
  
  const url = new URL(consentUrl);
  url.searchParams.set('state', state);
  
  console.log('[Xero] Generated auth URL with state:', state);
  return url.toString();
}

export async function handleCallback(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  idToken?: string;
  tenantId: string;
  tenantName: string;
}> {
  const xero = createXeroClient();
  const redirectUri = getRedirectUri();
  
  console.log('[Xero] Exchanging code for tokens...');
  console.log('[Xero] Using redirect URI:', redirectUri);
  
  const callbackUrl = `${redirectUri}?code=${encodeURIComponent(code)}`;
  const tokenSet = await xero.apiCallback(callbackUrl);
  
  if (!tokenSet.access_token || !tokenSet.refresh_token) {
    throw new Error('Failed to obtain tokens from Xero');
  }
  
  await xero.updateTenants();
  const tenants = xero.tenants;
  
  if (!tenants || tenants.length === 0) {
    throw new Error('No Xero tenants (organizations) found for this account');
  }
  
  const tenant = tenants[0];
  
  console.log('[Xero] Successfully connected to tenant:', tenant.tenantName);
  
  const expiresIn = tokenSet.expires_in || 1800;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  
  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresAt,
    idToken: tokenSet.id_token,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || 'Unknown Organization',
  };
}

export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const xero = createXeroClient();
  
  console.log('[Xero] Refreshing access token...');
  
  const tokenSet = await xero.refreshWithRefreshToken(
    process.env.XERO_CLIENT_ID!,
    process.env.XERO_CLIENT_SECRET!,
    refreshToken
  );
  
  if (!tokenSet.access_token || !tokenSet.refresh_token) {
    throw new Error('Failed to refresh tokens');
  }
  
  const expiresIn = tokenSet.expires_in || 1800;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  
  console.log('[Xero] Token refreshed successfully');
  
  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresAt,
  };
}

export async function syncInvoiceToXero(
  connection: { accessToken: string; xeroTenantId: string },
  invoice: {
    invoiceNumber: string;
    customerName: string;
    customerEmail?: string;
    date: string;
    dueDate?: string;
    lineItems: Array<{
      description: string;
      quantity: number;
      unitAmount: number;
    }>;
    total: number;
    status?: string; // local invoice status (draft, sent, paid, etc.)
  }
): Promise<{ xeroInvoiceId: string }> {
  const xero = createXeroClient();
  
  xero.setTokenSet({
    access_token: connection.accessToken,
    token_type: 'Bearer',
  });
  
  const tenantId = connection.xeroTenantId;
  
  console.log('[Xero] Syncing invoice:', invoice.invoiceNumber, 'to tenant:', tenantId);
  
  let contactId: string;
  
  try {
    const existingContacts = await xero.accountingApi.getContacts(
      tenantId,
      undefined,
      `Name=="${invoice.customerName.replace(/"/g, '\\"')}"`
    );
    
    if (existingContacts.body.contacts && existingContacts.body.contacts.length > 0) {
      contactId = existingContacts.body.contacts[0].contactID!;
      console.log('[Xero] Found existing contact:', contactId);
    } else {
      const newContact: Contact = {
        name: invoice.customerName,
        emailAddress: invoice.customerEmail,
      };
      
      const contacts: Contacts = {
        contacts: [newContact],
      };
      
      const contactResponse = await xero.accountingApi.createContacts(tenantId, contacts);
      
      if (!contactResponse.body.contacts || contactResponse.body.contacts.length === 0) {
        throw new Error('Failed to create contact in Xero');
      }
      
      contactId = contactResponse.body.contacts[0].contactID!;
      console.log('[Xero] Created new contact:', contactId);
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[Xero] Error finding/creating contact:', message);
    if (message.includes('403') || message.includes('AuthenticationUnsuccessful') || message.includes('Forbidden') || (typeof error === 'object' && error !== null && 'response' in error && (error as any).response?.statusCode === 403)) {
      throw new XeroAuthError('Xero authentication failed. Please disconnect and reconnect Xero in Settings.');
    }
    throw new Error(`Failed to find or create contact: ${message}`);
  }
  
  try {
    const lineItems: LineItem[] = invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      accountCode: '200',
    }));
    
    // Only authorize invoices that have been sent, keep drafts as drafts
    const xeroStatus = invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue'
      ? Invoice.StatusEnum.AUTHORISED
      : Invoice.StatusEnum.DRAFT;
    
    // Check if invoice already exists in Xero by invoice number
    let existingInvoiceId: string | null = null;
    try {
      const existingInvoices = await xero.accountingApi.getInvoices(
        tenantId,
        undefined,
        `InvoiceNumber=="${invoice.invoiceNumber.replace(/"/g, '\\"')}"`
      );
      
      if (existingInvoices.body.invoices && existingInvoices.body.invoices.length > 0) {
        existingInvoiceId = existingInvoices.body.invoices[0].invoiceID!;
        console.log('[Xero] Found existing invoice:', existingInvoiceId, '- will update instead of create');
      }
    } catch (lookupError: unknown) {
      console.log('[Xero] Could not check for existing invoice, will create new:', getErrorMessage(lookupError));
    }
    
    const xeroInvoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: { contactID: contactId },
      lineItems,
      date: invoice.date,
      dueDate: invoice.dueDate || invoice.date,
      invoiceNumber: invoice.invoiceNumber,
      status: xeroStatus,
      lineAmountTypes: LineAmountTypes.Exclusive,
    };
    
    let resultInvoice: Invoice;
    
    if (existingInvoiceId) {
      // Update existing invoice using updateOrCreateInvoices which accepts the Invoices wrapper
      xeroInvoice.invoiceID = existingInvoiceId;
      const invoices: Invoices = { invoices: [xeroInvoice] };
      const invoiceResponse = await xero.accountingApi.updateOrCreateInvoices(tenantId, invoices, true);
      
      if (!invoiceResponse.body.invoices || invoiceResponse.body.invoices.length === 0) {
        throw new Error('Failed to update invoice in Xero');
      }
      
      resultInvoice = invoiceResponse.body.invoices[0];
      console.log('[Xero] Successfully updated invoice:', existingInvoiceId);
    } else {
      // Create new invoice
      const invoices: Invoices = { invoices: [xeroInvoice] };
      const invoiceResponse = await xero.accountingApi.createInvoices(tenantId, invoices);
      
      if (!invoiceResponse.body.invoices || invoiceResponse.body.invoices.length === 0) {
        throw new Error('Failed to create invoice in Xero');
      }
      
      resultInvoice = invoiceResponse.body.invoices[0];
      console.log('[Xero] Successfully created invoice:', resultInvoice.invoiceID);
    }
    
    if (resultInvoice.hasErrors && resultInvoice.validationErrors) {
      const errorMessages = resultInvoice.validationErrors.map(e => e.message).join(', ');
      throw new Error(`Xero validation errors: ${errorMessages}`);
    }
    
    const xeroInvoiceId = resultInvoice.invoiceID!;
    
    return { xeroInvoiceId };
  } catch (error: unknown) {
    if (error instanceof XeroAuthError) throw error;
    const message = getErrorMessage(error);
    console.error('[Xero] Error syncing invoice:', message);
    if (message.includes('403') || message.includes('AuthenticationUnsuccessful') || message.includes('Forbidden') || (typeof error === 'object' && error !== null && 'response' in error && (error as any).response?.statusCode === 403)) {
      throw new XeroAuthError('Xero authentication failed. Please disconnect and reconnect Xero in Settings.');
    }
    throw new Error(`Failed to sync invoice to Xero: ${message}`);
  }
}

// Create a payment in Xero for a paid invoice
export async function syncPaymentToXero(
  connection: { accessToken: string; xeroTenantId: string },
  paymentData: {
    xeroInvoiceId: string;
    amount: number;
    paymentDate: string;
    reference?: string;
  }
): Promise<{ xeroPaymentId: string }> {
  const xero = createXeroClient();
  
  xero.setTokenSet({
    access_token: connection.accessToken,
    token_type: 'Bearer',
  });
  
  const tenantId = connection.xeroTenantId;
  
  console.log('[Xero] Creating payment for invoice:', paymentData.xeroInvoiceId);
  
  try {
    // Get a bank account to apply the payment to
    // First try to find a default bank account
    let accountId: string | undefined;
    
    try {
      const accounts = await xero.accountingApi.getAccounts(
        tenantId,
        undefined,
        `Type=="BANK" AND Status=="ACTIVE"`
      );
      
      if (accounts.body.accounts && accounts.body.accounts.length > 0) {
        accountId = accounts.body.accounts[0].accountID;
        console.log('[Xero] Using bank account:', accounts.body.accounts[0].name);
      }
    } catch (accountError: unknown) {
      console.log('[Xero] Could not find bank account, will use default');
    }
    
    const payment: Payment = {
      invoice: { invoiceID: paymentData.xeroInvoiceId },
      amount: paymentData.amount,
      date: paymentData.paymentDate,
      reference: paymentData.reference || 'Payment via RPrime',
    };
    
    if (accountId) {
      payment.account = { accountID: accountId };
    }
    
    const payments: Payments = { payments: [payment] };
    const paymentResponse = await xero.accountingApi.createPayments(tenantId, payments);
    
    if (!paymentResponse.body.payments || paymentResponse.body.payments.length === 0) {
      throw new Error('Failed to create payment in Xero');
    }
    
    const createdPayment = paymentResponse.body.payments[0];
    
    if (createdPayment.hasValidationErrors && createdPayment.validationErrors) {
      const errorMessages = createdPayment.validationErrors.map(e => e.message).join(', ');
      throw new Error(`Xero payment validation errors: ${errorMessages}`);
    }
    
    console.log('[Xero] Successfully created payment:', createdPayment.paymentID);
    
    return { xeroPaymentId: createdPayment.paymentID! };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('[Xero] Error creating payment:', message);
    throw new Error(`Failed to create payment in Xero: ${message}`);
  }
}

// Get invoice status from Xero by invoice number
export async function getInvoiceFromXero(
  connection: { accessToken: string; xeroTenantId: string },
  invoiceNumber: string
): Promise<{ 
  xeroInvoiceId: string; 
  status: string; 
  amountDue: number; 
  amountPaid: number;
  total: number;
} | null> {
  const xero = createXeroClient();
  
  xero.setTokenSet({
    access_token: connection.accessToken,
    token_type: 'Bearer',
  });
  
  const tenantId = connection.xeroTenantId;
  
  try {
    const response = await xero.accountingApi.getInvoices(
      tenantId,
      undefined,
      `InvoiceNumber=="${invoiceNumber.replace(/"/g, '\\"')}"`
    );
    
    if (response.body.invoices && response.body.invoices.length > 0) {
      const invoice = response.body.invoices[0];
      return {
        xeroInvoiceId: invoice.invoiceID!,
        status: String(invoice.status || 'UNKNOWN'),
        amountDue: invoice.amountDue || 0,
        amountPaid: invoice.amountPaid || 0,
        total: invoice.total || 0,
      };
    }
    
    return null;
  } catch (error: unknown) {
    console.error('[Xero] Error fetching invoice:', getErrorMessage(error));
    return null;
  }
}

// Get invoice by Xero invoice ID
export async function getInvoiceByXeroId(
  connection: { accessToken: string; xeroTenantId: string },
  xeroInvoiceId: string
): Promise<{ 
  invoiceNumber: string;
  status: string; 
  amountDue: number; 
  amountPaid: number;
  total: number;
} | null> {
  const xero = createXeroClient();
  
  xero.setTokenSet({
    access_token: connection.accessToken,
    token_type: 'Bearer',
  });
  
  const tenantId = connection.xeroTenantId;
  
  try {
    const response = await xero.accountingApi.getInvoice(tenantId, xeroInvoiceId);
    
    if (response.body.invoices && response.body.invoices.length > 0) {
      const invoice = response.body.invoices[0];
      return {
        invoiceNumber: invoice.invoiceNumber || '',
        status: String(invoice.status || 'UNKNOWN'),
        amountDue: invoice.amountDue || 0,
        amountPaid: invoice.amountPaid || 0,
        total: invoice.total || 0,
      };
    }
    
    return null;
  } catch (error: unknown) {
    console.error('[Xero] Error fetching invoice by ID:', getErrorMessage(error));
    return null;
  }
}

// Verify Xero webhook signature
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;
  
  if (!webhookKey) {
    console.error('[Xero Webhook] XERO_WEBHOOK_KEY not configured');
    return false;
  }
  
  if (!signature) {
    console.log('[Xero Webhook] Missing signature header');
    return false;
  }
  
  try {
    // Compute expected signature using HMAC-SHA256, output as raw bytes
    const expectedSignatureBuffer = crypto
      .createHmac('sha256', webhookKey)
      .update(payload)
      .digest();
    
    // Decode the incoming signature from base64 to raw bytes
    const receivedSignatureBuffer = Buffer.from(signature, 'base64');
    
    // Both buffers must be the same length for timingSafeEqual
    if (expectedSignatureBuffer.length !== receivedSignatureBuffer.length) {
      console.log('[Xero Webhook] Signature length mismatch');
      return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(expectedSignatureBuffer, receivedSignatureBuffer);
    
    if (!isValid) {
      console.log('[Xero Webhook] Signature mismatch');
    }
    
    return isValid;
  } catch (error) {
    console.error('[Xero Webhook] Signature verification error:', error);
    return false;
  }
}

// Compute webhook response hash for intent-to-receive verification
export function computeWebhookResponseHash(payload: string): string {
  const webhookKey = process.env.XERO_WEBHOOK_KEY;
  
  if (!webhookKey) {
    throw new Error('XERO_WEBHOOK_KEY not configured');
  }
  
  return crypto
    .createHmac('sha256', webhookKey)
    .update(payload)
    .digest('base64');
}
