import { db } from './db';
import { xeroConnections, xeroSyncHistory, invoices } from '@shared/schema';
import { eq, and, ne, isNotNull, sql } from 'drizzle-orm';
import * as xeroService from './xero';
import { storage } from './storage';

const POLLING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let isPolling = false; // Lock to prevent overlapping poll cycles

async function syncXeroPaymentsForOrganization(
  organizationId: string,
  accessToken: string,
  xeroTenantId: string
) {
  console.log(`[Xero Polling] Syncing payments for org ${organizationId}`);
  
  try {
    // Get distinct invoices synced to Xero that aren't marked as paid
    // Use subquery to get only the latest sync record per invoice
    const syncedInvoices = await db
      .selectDistinctOn([xeroSyncHistory.recordId], {
        invoiceId: xeroSyncHistory.recordId,
        xeroId: xeroSyncHistory.xeroId,
      })
      .from(xeroSyncHistory)
      .innerJoin(invoices, eq(xeroSyncHistory.recordId, invoices.id))
      .where(
        and(
          eq(xeroSyncHistory.organizationId, organizationId),
          eq(xeroSyncHistory.syncType, 'invoice'),
          eq(xeroSyncHistory.direction, 'push'),
          eq(xeroSyncHistory.status, 'success'),
          isNotNull(xeroSyncHistory.xeroId),
          ne(invoices.status, 'paid'),
          eq(invoices.organizationId, organizationId)
        )
      );

    if (syncedInvoices.length === 0) {
      console.log(`[Xero Polling] No unpaid synced invoices for org ${organizationId}`);
      return;
    }

    console.log(`[Xero Polling] Found ${syncedInvoices.length} unpaid synced invoices`);

    for (const syncedInvoice of syncedInvoices) {
      if (!syncedInvoice.invoiceId || !syncedInvoice.xeroId) continue;

      try {
        // Get invoice from RPrime
        const invoice = await storage.getInvoice(organizationId, syncedInvoice.invoiceId);
        if (!invoice) continue;

        // Get invoice status from Xero using the stored Xero invoice ID directly
        const xeroInvoice = await xeroService.getInvoiceByXeroId(
          { accessToken, xeroTenantId },
          syncedInvoice.xeroId
        );

        if (!xeroInvoice) {
          console.log(`[Xero Polling] Invoice ${syncedInvoice.xeroId} not found in Xero`);
          continue;
        }

        // Get existing payments
        const existingPayments = await storage.getInvoicePayments(organizationId, syncedInvoice.invoiceId);
        const existingPaidAmount = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const xeroAmountPaid = Number(xeroInvoice.amountPaid) || 0;
        const paymentDelta = xeroAmountPaid - existingPaidAmount;

        // Create payment if there's a positive delta
        if (paymentDelta > 0.01) {
          const today = new Date().toISOString().split('T')[0];
          await storage.createInvoicePayment(organizationId, {
            id: `pay-xero-poll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            invoiceId: syncedInvoice.invoiceId,
            amount: paymentDelta,
            paymentMethod: 'xero_sync',
            paymentDate: today,
            reference: 'Synced from Xero (background)',
            notes: `Payment synced from Xero on ${today}`,
          });
          console.log(`[Xero Polling] Created payment for invoice ${invoice.invoiceNumber}: $${paymentDelta}`);
        }

        // Update invoice status if fully paid
        if (xeroInvoice.status === 'PAID' && invoice.status !== 'paid') {
          await storage.updateInvoice(organizationId, syncedInvoice.invoiceId, {
            status: 'paid',
            amountPaid: xeroAmountPaid,
          });
          console.log(`[Xero Polling] Marked invoice ${invoice.invoiceNumber} as paid`);
        } else if (paymentDelta > 0.01) {
          const newTotalPaid = existingPaidAmount + paymentDelta;
          await storage.updateInvoice(organizationId, syncedInvoice.invoiceId, {
            amountPaid: newTotalPaid,
          });
        }
      } catch (invoiceError) {
        console.error(`[Xero Polling] Error syncing invoice ${syncedInvoice.invoiceId}:`, invoiceError);
      }
    }
  } catch (error) {
    console.error(`[Xero Polling] Error syncing org ${organizationId}:`, error);
  }
}

async function pollXeroPayments() {
  // Prevent overlapping poll cycles
  if (isPolling) {
    console.log('[Xero Polling] Previous cycle still running, skipping...');
    return;
  }

  isPolling = true;
  console.log('[Xero Polling] Starting payment sync cycle...');

  try {
    // Get all active Xero connections
    const connections = await db
      .select()
      .from(xeroConnections)
      .where(eq(xeroConnections.isActive, 'true'));

    if (connections.length === 0) {
      console.log('[Xero Polling] No active Xero connections');
      return;
    }

    console.log(`[Xero Polling] Found ${connections.length} active Xero connections`);

    for (const connection of connections) {
      try {
        let accessToken = connection.accessToken;

        // Check if token needs refresh
        const tokenExpiry = new Date(connection.tokenExpiresAt);
        const bufferTime = 5 * 60 * 1000;
        if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
          console.log(`[Xero Polling] Refreshing token for org ${connection.organizationId}`);
          try {
            const refreshed = await xeroService.refreshTokens(connection.refreshToken);
            await storage.updateXeroConnection(connection.organizationId, {
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              tokenExpiresAt: refreshed.expiresAt,
            });
            accessToken = refreshed.accessToken;
          } catch (refreshError) {
            console.error(`[Xero Polling] Token refresh failed for org ${connection.organizationId}:`, refreshError);
            await storage.updateXeroConnection(connection.organizationId, { isActive: 'false' });
            continue;
          }
        }

        await syncXeroPaymentsForOrganization(
          connection.organizationId,
          accessToken,
          connection.xeroTenantId
        );
      } catch (connError) {
        console.error(`[Xero Polling] Error processing connection for org ${connection.organizationId}:`, connError);
      }
    }

    console.log('[Xero Polling] Payment sync cycle complete');
  } catch (error) {
    console.error('[Xero Polling] Fatal error in polling cycle:', error);
  } finally {
    isPolling = false;
  }
}

export function startXeroPolling() {
  console.log(`[Xero Polling] Starting background polling every ${POLLING_INTERVAL / 1000 / 60} minutes`);
  
  // Run immediately on startup (after a short delay)
  setTimeout(() => {
    pollXeroPayments().catch(console.error);
  }, 30000); // 30 second delay on startup
  
  // Then run every 5 minutes
  setInterval(() => {
    pollXeroPayments().catch(console.error);
  }, POLLING_INTERVAL);
}
