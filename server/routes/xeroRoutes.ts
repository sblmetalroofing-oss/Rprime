import { Router } from "express";
import express from "express";
import { randomUUID } from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { xeroConnections, InsertInvoice } from "@shared/schema";
import { getOrganizationId, SessionUser } from "./middleware";
import * as xeroService from "../xero";
import { XeroAuthError } from "../xero";
import { storage } from "../storage";

// Session types for Xero OAuth flow
interface XeroOAuthState {
  nonce: string;
  organizationId: string;
  createdAt: number;
}

// Augment express-session to include our Xero OAuth state
declare module "express-session" {
  interface SessionData {
    xeroOAuthState?: XeroOAuthState;
    user?: SessionUser;
  }
}

// Webhook event types from Xero
interface XeroWebhookEvent {
  eventType: string;
  eventCategory: string;
  resourceId: string;
  tenantId: string;
}

interface XeroWebhookPayload {
  events?: XeroWebhookEvent[];
}

const router = Router();

router.get("/xero/auth", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const stateNonce = randomUUID();
    
    req.session.xeroOAuthState = {
      nonce: stateNonce,
      organizationId: organizationId,
      createdAt: Date.now(),
    };
    
    await new Promise<void>((resolve, reject) => {
      req.session.save((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    const authUrl = await xeroService.getAuthUrl(stateNonce);
    res.json({ authUrl });
  } catch (error) {
    console.error("Xero auth error:", error);
    res.status(500).json({ error: "Failed to initiate Xero authentication" });
  }
});

router.get("/xero/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect("/settings?xero=error&message=missing_params");
    }
    
    const storedState = req.session?.xeroOAuthState;
    if (!storedState || storedState.nonce !== state) {
      console.error("Xero OAuth state mismatch - potential CSRF attack");
      return res.redirect("/settings?xero=error&message=state_mismatch");
    }
    
    if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
      console.error("Xero OAuth state expired");
      return res.redirect("/settings?xero=error&message=state_expired");
    }
    
    const organizationId = storedState.organizationId;
    
    delete req.session.xeroOAuthState;
    await new Promise<void>((resolve) => req.session.save(() => resolve()));
    
    const tokenData = await xeroService.handleCallback(code as string);
    
    await storage.createXeroConnection({
      organizationId,
      xeroTenantId: tokenData.tenantId,
      xeroTenantName: tokenData.tenantName,
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken,
      tokenExpiresAt: tokenData.expiresAt,
      idToken: tokenData.idToken,
      scope: "openid profile email accounting.transactions accounting.contacts offline_access",
    });
    
    res.redirect("/settings?xero=connected");
  } catch (error) {
    console.error("Xero callback error:", error);
    res.redirect("/settings?xero=error&message=callback_failed");
  }
});

router.get("/xero/status", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const connection = await storage.getXeroConnection(organizationId);
    
    if (!connection) {
      return res.json({ connected: false });
    }
    
    res.json({
      connected: connection.isActive === "true",
      tenantName: connection.xeroTenantName,
      lastSyncAt: connection.lastSyncAt,
      tokenExpiresAt: connection.tokenExpiresAt,
    });
  } catch (error) {
    console.error("Xero status error:", error);
    res.status(500).json({ error: "Failed to get Xero status" });
  }
});

router.post("/xero/disconnect", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    await storage.deleteXeroConnection(organizationId);
    res.json({ success: true });
  } catch (error) {
    console.error("Xero disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect Xero" });
  }
});

router.post("/xero/sync/invoice/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const invoiceId = req.params.id;
    
    const connection = await storage.getXeroConnection(organizationId);
    if (!connection || connection.isActive !== "true") {
      return res.status(400).json({ error: "Xero not connected" });
    }
    
    let accessToken = connection.accessToken;
    const tokenExpiry = new Date(connection.tokenExpiresAt);
    const bufferTime = 5 * 60 * 1000;
    if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
      try {
        console.log('[Xero Sync] Token expired or expiring soon, refreshing...');
        const refreshed = await xeroService.refreshTokens(connection.refreshToken);
        await storage.updateXeroConnection(organizationId, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
        accessToken = refreshed.accessToken;
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        await storage.updateXeroConnection(organizationId, { isActive: "false" });
        return res.status(401).json({ error: "Xero authentication expired. Please reconnect." });
      }
    }
    
    const invoice = await storage.getInvoice(organizationId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    const invoiceItems = await storage.getInvoiceItems(organizationId, invoiceId);
    
    const result = await xeroService.syncInvoiceToXero(
      { accessToken, xeroTenantId: connection.xeroTenantId },
      {
        invoiceNumber: invoice.invoiceNumber || invoiceId,
        customerName: invoice.customerName || "Unknown Customer",
        customerEmail: invoice.customerEmail || undefined,
        date: invoice.issueDate || new Date().toISOString().split("T")[0],
        dueDate: invoice.dueDate || undefined,
        lineItems: invoiceItems.map(item => ({
          description: item.description || "Item",
          quantity: item.qty || 1,
          unitAmount: item.unitCost || 0,
        })),
        total: invoice.total || 0,
        status: invoice.status || 'draft',
      }
    );
    
    await storage.createXeroSyncHistory({
      organizationId,
      syncType: "invoice",
      direction: "push",
      status: "success",
      recordId: invoiceId,
      xeroId: result.xeroInvoiceId,
    });
    
    await storage.updateXeroConnection(organizationId, {
      lastSyncAt: new Date(),
    });
    
    res.json({ success: true, xeroInvoiceId: result.xeroInvoiceId });
  } catch (error) {
    console.error("Xero invoice sync error:", error);
    
    const organizationId = await getOrganizationId(req);
    if (organizationId) {
      await storage.createXeroSyncHistory({
        organizationId,
        syncType: "invoice",
        direction: "push",
        status: "error",
        recordId: req.params.id,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      if (error instanceof XeroAuthError) {
        await storage.updateXeroConnection(organizationId, { isActive: "false" });
        return res.status(401).json({ error: "Your Xero connection has expired. Please disconnect and reconnect in Settings." });
      }
    }
    
    res.status(500).json({ error: "Failed to sync invoice to Xero" });
  }
});

router.post("/xero/pull/invoice/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const invoiceId = req.params.id;
    
    const connection = await storage.getXeroConnection(organizationId);
    if (!connection || connection.isActive !== "true") {
      return res.status(400).json({ error: "Xero not connected" });
    }
    
    let accessToken = connection.accessToken;
    const tokenExpiry = new Date(connection.tokenExpiresAt);
    const bufferTime = 5 * 60 * 1000;
    if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
      try {
        console.log('[Xero Pull] Token expired or expiring soon, refreshing...');
        const refreshed = await xeroService.refreshTokens(connection.refreshToken);
        await storage.updateXeroConnection(organizationId, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          tokenExpiresAt: refreshed.expiresAt,
        });
        accessToken = refreshed.accessToken;
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        await storage.updateXeroConnection(organizationId, { isActive: "false" });
        return res.status(401).json({ error: "Xero authentication expired. Please reconnect." });
      }
    }
    
    const invoice = await storage.getInvoice(organizationId, invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    const xeroInvoice = await xeroService.getInvoiceFromXero(
      { accessToken, xeroTenantId: connection.xeroTenantId },
      invoice.invoiceNumber || invoiceId
    );
    
    if (!xeroInvoice) {
      return res.status(404).json({ error: "Invoice not found in Xero" });
    }
    
    console.log(`[Xero Pull] Invoice ${invoice.invoiceNumber} - Xero status: ${xeroInvoice.status}, amountPaid: ${xeroInvoice.amountPaid}`);
    
    const existingPayments = await storage.getInvoicePayments(organizationId, invoiceId);
    const existingPaidAmount = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const xeroAmountPaid = Number(xeroInvoice.amountPaid) || 0;
    const paymentDelta = xeroAmountPaid - existingPaidAmount;
    
    console.log(`[Xero Pull] Existing payments: $${existingPaidAmount}, Xero amountPaid: $${xeroAmountPaid}, Delta: $${paymentDelta}`);
    
    let updated = false;
    let paymentCreated = false;
    
    if (paymentDelta > 0.01) {
      const today = new Date().toISOString().split('T')[0];
      try {
        await storage.createInvoicePayment(organizationId, {
          id: `pay-xero-pull-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: invoiceId,
          amount: paymentDelta,
          paymentMethod: 'xero_sync',
          paymentDate: today,
          reference: 'Synced from Xero',
          notes: `Payment pulled from Xero on ${today}`,
        });
        console.log(`[Xero Pull] Created payment record for $${paymentDelta}`);
        paymentCreated = true;
      } catch (paymentError) {
        console.error(`[Xero Pull] Failed to create payment record:`, paymentError);
      }
    }
    
    if (xeroInvoice.status === 'PAID' && invoice.status !== 'paid') {
      await storage.updateInvoice(organizationId, invoiceId, {
        status: 'paid',
        amountPaid: xeroAmountPaid,
      });
      updated = true;
      console.log(`[Xero Pull] Updated invoice status to paid`);
    } else if (paymentCreated) {
      const newTotalPaid = existingPaidAmount + paymentDelta;
      await storage.updateInvoice(organizationId, invoiceId, {
        amountPaid: newTotalPaid,
      });
      updated = true;
    }
    
    await storage.createXeroSyncHistory({
      organizationId,
      syncType: "invoice",
      direction: "pull",
      status: "success",
      recordId: invoiceId,
      xeroId: xeroInvoice.xeroInvoiceId,
    });
    
    res.json({ 
      success: true, 
      xeroStatus: xeroInvoice.status,
      xeroAmountPaid: xeroInvoice.amountPaid,
      updated 
    });
  } catch (error) {
    console.error("Xero invoice pull error:", error);
    res.status(500).json({ error: "Failed to pull invoice from Xero" });
  }
});

router.get("/xero/sync-history", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const history = await storage.getXeroSyncHistory(organizationId, 50);
    
    // Enrich sync history with invoice numbers and readable action labels
    const enrichedHistory = await Promise.all(
      history.map(async (sync) => {
        let invoiceNumber: string | null = null;
        
        // Get invoice number if this is an invoice sync
        if (sync.syncType === 'invoice' && sync.recordId) {
          try {
            const invoice = await storage.getInvoice(organizationId, sync.recordId);
            invoiceNumber = invoice?.invoiceNumber || null;
          } catch (e) {
            // Invoice might have been deleted
          }
        }
        
        // Create readable action label
        let action = '';
        const syncTypeLabel = sync.syncType ? sync.syncType.charAt(0).toUpperCase() + sync.syncType.slice(1) : 'Record';
        
        if (sync.direction === 'push') {
          switch (sync.syncType) {
            case 'invoice':
              action = 'Invoice pushed to Xero';
              break;
            case 'payment':
              action = 'Payment pushed to Xero';
              break;
            case 'contact':
              action = 'Contact pushed to Xero';
              break;
            default:
              action = `${syncTypeLabel} pushed to Xero`;
          }
        } else if (sync.direction === 'pull') {
          switch (sync.syncType) {
            case 'invoice':
              action = 'Invoice updated from Xero';
              break;
            case 'payment':
              action = 'Payment received from Xero';
              break;
            case 'contact':
              action = 'Contact synced from Xero';
              break;
            default:
              action = `${syncTypeLabel} synced from Xero`;
          }
        } else {
          // Fallback for missing/unknown direction
          action = `${syncTypeLabel} synced`;
        }
        
        return {
          id: sync.id,
          invoiceNumber,
          invoiceId: sync.recordId,
          action,
          syncType: sync.syncType,
          direction: sync.direction,
          status: sync.status,
          xeroId: sync.xeroId,
          errorMessage: sync.errorMessage,
          syncedAt: sync.createdAt,
        };
      })
    );
    
    res.json(enrichedHistory);
  } catch (error) {
    console.error("Xero sync history error:", error);
    res.status(500).json({ error: "Failed to get sync history" });
  }
});

router.get("/xero/invoice-sync-status", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const history = await storage.getXeroSyncHistory(organizationId, 500);
    
    const invoiceSyncMap: Record<string, { 
      synced: boolean; 
      xeroId: string | null; 
      lastSyncAt: string | null; 
      status: string; 
      errorMessage?: string | null;
    }> = {};
    
    for (const sync of history) {
      if (sync.syncType === 'invoice' && sync.recordId && !invoiceSyncMap[sync.recordId]) {
        invoiceSyncMap[sync.recordId] = {
          synced: sync.status === 'success',
          xeroId: sync.xeroId,
          lastSyncAt: sync.createdAt?.toISOString() || null,
          status: sync.status,
          errorMessage: sync.errorMessage,
        };
      }
    }
    
    res.json(invoiceSyncMap);
  } catch (error) {
    console.error("Xero invoice sync status error:", error);
    res.status(500).json({ error: "Failed to get invoice sync status" });
  }
});

router.get("/xero/invoice-sync-status/:invoiceId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { invoiceId } = req.params;
    const history = await storage.getXeroSyncHistory(organizationId, 100);
    
    const latestSync = history.find(s => s.syncType === 'invoice' && s.recordId === invoiceId);
    
    if (!latestSync) {
      return res.json({ synced: false, xeroId: null, lastSyncAt: null, status: 'never' });
    }
    
    res.json({
      synced: latestSync.status === 'success',
      xeroId: latestSync.xeroId,
      lastSyncAt: latestSync.createdAt?.toISOString() || null,
      status: latestSync.status,
      errorMessage: latestSync.errorMessage,
    });
  } catch (error) {
    console.error("Xero invoice sync status error:", error);
    res.status(500).json({ error: "Failed to get invoice sync status" });
  }
});

router.post("/xero/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-xero-signature'] as string | undefined;
    const payload = (req.body as Buffer).toString();
    
    if (!signature || !xeroService.verifyWebhookSignature(payload, signature)) {
      console.log('[Xero Webhook] Invalid or missing signature - returning 401');
      return res.status(401).send();
    }
    
    let events: XeroWebhookPayload;
    try {
      events = JSON.parse(payload) as XeroWebhookPayload;
    } catch (parseError) {
      console.error('[Xero Webhook] Failed to parse payload:', parseError);
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    
    console.log('[Xero Webhook] Received events:', JSON.stringify(events, null, 2));
    
    if (!events.events || events.events.length === 0) {
      console.log('[Xero Webhook] Empty events array - likely ITR validation');
      return res.status(200).json({ received: true });
    }
    
    for (const event of events.events) {
      if ((event.eventType === 'UPDATE' || event.eventType === 'CREATE') && event.eventCategory === 'INVOICE') {
        const xeroInvoiceId = event.resourceId;
        const tenantId = event.tenantId;
        
        console.log(`[Xero Webhook] Invoice updated: ${xeroInvoiceId} in tenant ${tenantId}`);
        
        const connections = await db.select().from(xeroConnections)
          .where(eq(xeroConnections.xeroTenantId, tenantId));
        
        if (connections.length === 0) {
          console.log('[Xero Webhook] No organization found for tenant:', tenantId);
          continue;
        }
        
        const connection = connections[0];
        const organizationId = connection.organizationId;
        
        let accessToken = connection.accessToken;
        const tokenExpiry = new Date(connection.tokenExpiresAt);
        const bufferTime = 5 * 60 * 1000;
        if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
          try {
            console.log('[Xero Webhook] Token expired or expiring soon, refreshing...');
            const refreshed = await xeroService.refreshTokens(connection.refreshToken);
            await storage.updateXeroConnection(organizationId, {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              tokenExpiresAt: refreshed.expiresAt,
            });
            accessToken = refreshed.accessToken;
          } catch (refreshError) {
            console.error('[Xero Webhook] Token refresh failed:', refreshError);
            continue;
          }
        }
        
        const xeroInvoice = await xeroService.getInvoiceByXeroId(
          { accessToken, xeroTenantId: tenantId },
          xeroInvoiceId
        );
        
        if (!xeroInvoice) {
          console.log('[Xero Webhook] Could not fetch invoice from Xero');
          continue;
        }
        
        console.log(`[Xero Webhook] Invoice ${xeroInvoice.invoiceNumber} status: ${xeroInvoice.status}, amountPaid: ${xeroInvoice.amountPaid}`);
        
        if (!xeroInvoice.invoiceNumber) {
          console.log('[Xero Webhook] Xero invoice has no invoice number');
          continue;
        }
        
        const matchingInvoice = await storage.getInvoiceByNumber(organizationId, xeroInvoice.invoiceNumber);
        
        if (!matchingInvoice) {
          console.log('[Xero Webhook] No matching RPrime invoice found for:', xeroInvoice.invoiceNumber);
          continue;
        }
        
        const xeroStatusNormalized = String(xeroInvoice.status).toUpperCase();
        const isFullyPaid = xeroStatusNormalized === 'PAID' || xeroInvoice.amountDue === 0;
        
        console.log(`[Xero Webhook] Status check - normalized: ${xeroStatusNormalized}, amountDue: ${xeroInvoice.amountDue}, isFullyPaid: ${isFullyPaid}`);
        
        if (isFullyPaid) {
          if (matchingInvoice.status !== 'paid') {
            const paymentAmount = xeroInvoice.amountPaid || Number(matchingInvoice.total) || 0;
            
            await storage.updateInvoice(organizationId, matchingInvoice.id, {
              status: 'paid',
              amountPaid: paymentAmount,
            });
            
            const today = new Date().toISOString().split('T')[0];
            try {
              await storage.createInvoicePayment(organizationId, {
                id: `pay-xero-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                invoiceId: matchingInvoice.id,
                amount: paymentAmount,
                paymentMethod: 'xero_sync',
                paymentDate: today,
                reference: `Synced from Xero`,
                notes: `Payment reconciled in Xero on ${today}`,
              });
              console.log(`[Xero Webhook] Created payment record for ${matchingInvoice.invoiceNumber}`);
            } catch (paymentError) {
              console.error(`[Xero Webhook] Failed to create payment record:`, paymentError);
            }
            
            console.log(`[Xero Webhook] Updated RPrime invoice ${matchingInvoice.invoiceNumber} to PAID`);
            
            await storage.createXeroSyncHistory({
              organizationId,
              syncType: 'payment',
              direction: 'pull',
              status: 'success',
              recordId: matchingInvoice.id,
              xeroId: xeroInvoiceId,
            });
          }
        } else if (xeroInvoice.amountPaid > 0) {
          const invoiceTotal = Number(matchingInvoice.total) || 0;
          const xeroAmountPaid = xeroInvoice.amountPaid || 0;
          const isNowFullyPaid = xeroAmountPaid >= invoiceTotal && invoiceTotal > 0;
          
          console.log(`[Xero Webhook] Payment detected: ${xeroAmountPaid} paid, invoice total: ${invoiceTotal}, fully paid: ${isNowFullyPaid}`);
          
          if (Number(matchingInvoice.amountPaid || 0) < xeroAmountPaid) {
            const updateData: Partial<InsertInvoice> = {
              amountPaid: xeroAmountPaid,
            };
            
            if (isNowFullyPaid && matchingInvoice.status !== 'paid') {
              updateData.status = 'paid';
              console.log(`[Xero Webhook] Auto-marking invoice ${matchingInvoice.invoiceNumber} as PAID (amountPaid >= total)`);
            }
            
            await storage.updateInvoice(organizationId, matchingInvoice.id, updateData);
            
            const today = new Date().toISOString().split('T')[0];
            try {
              await storage.createInvoicePayment(organizationId, {
                id: `pay-xero-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                invoiceId: matchingInvoice.id,
                amount: xeroAmountPaid - Number(matchingInvoice.amountPaid || 0),
                paymentMethod: 'xero_sync',
                paymentDate: today,
                reference: `Synced from Xero`,
                notes: `Payment reconciled in Xero on ${today}`,
              });
              console.log(`[Xero Webhook] Created payment record for ${matchingInvoice.invoiceNumber}`);
            } catch (paymentError) {
              console.error(`[Xero Webhook] Failed to create payment record:`, paymentError);
            }
            
            console.log(`[Xero Webhook] Updated RPrime invoice ${matchingInvoice.invoiceNumber} payment: ${xeroAmountPaid}`);
          }
        }
      }
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Xero Webhook] Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

if (process.env.NODE_ENV === "development") {
  router.post("/xero/test-webhook", async (req, res) => {
    try {
      const organizationId = await getOrganizationId(req);
      if (!organizationId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const { invoiceNumber, amountPaid } = req.body;
      
      if (!invoiceNumber) {
        return res.status(400).json({ error: "invoiceNumber is required" });
      }
      
      console.log(`[Xero Test Webhook] Simulating payment for invoice ${invoiceNumber}`);
      
      const invoice = await storage.getInvoiceByNumber(organizationId, invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ error: `Invoice ${invoiceNumber} not found` });
      }
      
      const invoiceTotal = Number(invoice.total) || 0;
      const paymentAmount = amountPaid !== undefined ? Number(amountPaid) : invoiceTotal;
      
      console.log(`[Xero Test Webhook] Invoice ${invoiceNumber}: total=${invoiceTotal}, payment=${paymentAmount}`);
      
      const updateData: Partial<InsertInvoice> = {
        amountPaid: paymentAmount,
        status: 'paid',
      };
      
      console.log(`[Xero Test Webhook] Marking invoice ${invoiceNumber} as PAID`);
      
      await storage.updateInvoice(organizationId, invoice.id, updateData);
      
      const today = new Date().toISOString().split('T')[0];
      let paymentCreated = false;
      try {
        await storage.createInvoicePayment(organizationId, {
          id: `pay-xero-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentMethod: 'xero_sync',
          paymentDate: today,
          reference: `Test Xero Sync`,
          notes: `Test payment simulating Xero reconciliation on ${today}`,
        });
        paymentCreated = true;
        console.log(`[Xero Test Webhook] Created payment record for ${invoiceNumber}`);
      } catch (paymentError) {
        console.error(`[Xero Test Webhook] Failed to create payment record:`, paymentError);
      }
      
      const updatedInvoice = await storage.getInvoice(organizationId, invoice.id);
      
      res.json({
        success: true,
        message: `Invoice ${invoiceNumber} updated - amountPaid: ${paymentAmount}, status: ${updatedInvoice?.status}${paymentCreated ? ', payment record created' : ''}`,
        invoice: {
          id: updatedInvoice?.id,
          invoiceNumber: updatedInvoice?.invoiceNumber,
          total: updatedInvoice?.total,
          amountPaid: updatedInvoice?.amountPaid,
          status: updatedInvoice?.status,
        },
        paymentCreated,
        paymentDate: today,
      });
    } catch (error) {
      console.error("[Xero Test Webhook] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Test webhook failed" });
    }
  });
}

export default router;
