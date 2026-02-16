import { Router } from "express";
import { getOrganizationId, canUserDelete, getUserAttribution } from "./middleware";
import { storage } from "../storage";
import { insertInvoiceSchema, insertInvoiceItemSchema, insertInvoicePaymentSchema } from "@shared/schema";
import * as xeroService from "../xero";

const router = Router();

router.get("/invoices", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const invoices = await storage.getAllInvoices(organizationId);
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

router.get("/invoices/next-number", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const invoiceNumber = await storage.getAndIncrementInvoiceNumber(organizationId);
    res.json({ invoiceNumber });
  } catch (error) {
    console.error("Error getting invoice number:", error);
    res.status(500).json({ error: "Failed to get invoice number" });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const [invoice, items] = await Promise.all([
      storage.getInvoice(organizationId, id),
      storage.getInvoiceItems(organizationId, id)
    ]);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    res.json({ ...invoice, items });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { items, ...invoiceData } = req.body;
    const roundMoney = (v: any) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    if (invoiceData.subtotal != null) invoiceData.subtotal = roundMoney(invoiceData.subtotal);
    if (invoiceData.gst != null) invoiceData.gst = roundMoney(invoiceData.gst);
    if (invoiceData.total != null) invoiceData.total = roundMoney(invoiceData.total);
    if (invoiceData.discount != null) invoiceData.discount = roundMoney(invoiceData.discount);
    if (invoiceData.amountPaid != null) invoiceData.amountPaid = roundMoney(invoiceData.amountPaid);
    invoiceData.organizationId = organizationId;
    const validatedData = insertInvoiceSchema.parse(invoiceData);
    const userAttribution = await getUserAttribution(req, organizationId);
    const data = { 
      ...validatedData, 
      createdBy: userAttribution.id,
      createdByName: userAttribution.name,
    };
    const invoice = await storage.createInvoice(data);
    
    if (items && items.length > 0) {
      for (const item of items) {
        if (item.unitCost != null) item.unitCost = roundMoney(item.unitCost);
        if (item.total != null) item.total = roundMoney(item.total);
        const validatedItem = insertInvoiceItemSchema.parse({ ...item, invoiceId: invoice.id });
        await storage.createInvoiceItem(organizationId, validatedItem);
      }
    }
    
    const createdItems = await storage.getInvoiceItems(organizationId, invoice.id);
    
    if (createdItems.length > 0) {
      const subtotal = roundMoney(createdItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitCost)), 0));
      const discount = Number(invoice.discount) || 0;
      const gst = roundMoney((subtotal - discount) * 0.1);
      const total = roundMoney(subtotal - discount + gst);
      await storage.updateInvoice(organizationId, invoice.id, { subtotal, gst, total });
      Object.assign(invoice, { subtotal, gst, total });
    } else {
      const zeroTotals = { subtotal: 0, gst: 0, total: 0 };
      await storage.updateInvoice(organizationId, invoice.id, zeroTotals);
      Object.assign(invoice, zeroTotals);
    }
    
    res.status(201).json({ ...invoice, items: createdItems });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    const message = error?.issues ? error.issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join('; ') : (error?.message || "Failed to create invoice");
    res.status(400).json({ error: message });
  }
});

router.put("/invoices/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { items, ...invoiceData } = req.body;
    const roundMoney = (v: any) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    if (invoiceData.subtotal != null) invoiceData.subtotal = roundMoney(invoiceData.subtotal);
    if (invoiceData.gst != null) invoiceData.gst = roundMoney(invoiceData.gst);
    if (invoiceData.total != null) invoiceData.total = roundMoney(invoiceData.total);
    if (invoiceData.discount != null) invoiceData.discount = roundMoney(invoiceData.discount);
    if (invoiceData.amountPaid != null) invoiceData.amountPaid = roundMoney(invoiceData.amountPaid);
    const validatedData = insertInvoiceSchema.partial().parse(invoiceData);
    
    if (validatedData.status) {
      const existingInvoice = await storage.getInvoice(organizationId, id);
      if (!existingInvoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const currentStatus = existingInvoice.status || 'draft';
      const newStatus = validatedData.status;
      const validTransitions: Record<string, string[]> = {
        'draft': ['sent', 'void'],
        'sent': ['paid', 'void', 'draft'],
        'paid': ['void'],
        'void': [],
      };
      const allowed = validTransitions[currentStatus] || [];
      if (currentStatus !== newStatus && !allowed.includes(newStatus)) {
        return res.status(400).json({ 
          error: `Cannot change invoice status from '${currentStatus}' to '${newStatus}'. ${currentStatus === 'void' ? 'Voided invoices cannot be modified.' : `Allowed transitions: ${allowed.join(', ') || 'none'}.`}` 
        });
      }
    }
    
    if (validatedData.status === 'paid') {
      const existingInvoice = await storage.getInvoice(organizationId, id);
      if (existingInvoice && (!validatedData.amountPaid || validatedData.amountPaid === 0)) {
        validatedData.amountPaid = validatedData.total || existingInvoice.total || 0;
      }
    }
    
    const invoice = await storage.updateInvoice(organizationId, id, validatedData);
    
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    if (items) {
      await storage.deleteInvoiceItems(organizationId, id);
      for (const item of items) {
        if (item.unitCost != null) item.unitCost = roundMoney(item.unitCost);
        if (item.total != null) item.total = roundMoney(item.total);
        const validatedItem = insertInvoiceItemSchema.parse({ ...item, invoiceId: id });
        await storage.createInvoiceItem(organizationId, validatedItem);
      }
    }
    
    const updatedItems = await storage.getInvoiceItems(organizationId, id);
    
    if (items !== undefined) {
      if (updatedItems.length > 0) {
        const subtotal = roundMoney(updatedItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitCost)), 0));
        const discount = Number(validatedData.discount ?? invoice!.discount) || 0;
        const gst = roundMoney((subtotal - discount) * 0.1);
        const total = roundMoney(subtotal - discount + gst);
        const recalcUpdated = await storage.updateInvoice(organizationId, id, { subtotal, gst, total });
        if (recalcUpdated) Object.assign(invoice!, { subtotal, gst, total });
      } else {
        const zeroTotals = { subtotal: 0, gst: 0, total: 0 };
        const recalcUpdated = await storage.updateInvoice(organizationId, id, zeroTotals);
        if (recalcUpdated) Object.assign(invoice!, zeroTotals);
      }
    }
    
    res.json({ ...invoice, items: updatedItems });
  } catch (error: any) {
    console.error("Error updating invoice:", error);
    const message = error?.issues ? error.issues.map((i: any) => `${i.path?.join('.')}: ${i.message}`).join('; ') : (error?.message || "Failed to update invoice");
    res.status(400).json({ error: message });
  }
});

router.delete("/invoices/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteInvoice(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

router.get("/invoices/:id/payments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const invoice = await storage.getInvoice(organizationId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const payments = await storage.getInvoicePayments(organizationId, id);
    res.json(payments);
  } catch (error) {
    console.error("Error fetching invoice payments:", error);
    res.status(500).json({ error: "Failed to fetch invoice payments" });
  }
});

router.post("/invoices/:id/payments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const invoice = await storage.getInvoice(organizationId, id);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: "This invoice has already been fully paid. No additional payments can be recorded." });
    }
    if (invoice.status === 'void') {
      return res.status(400).json({ error: "This invoice has been voided. Payments cannot be added to voided invoices." });
    }
    const dataWithId = {
      ...req.body,
      id: req.body.id || `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      invoiceId: id
    };
    const validatedData = insertInvoicePaymentSchema.parse(dataWithId);
    const payment = await storage.createInvoicePayment(organizationId, validatedData);
    
    const allPayments = await storage.getInvoicePayments(organizationId, id);
    const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const invoiceTotal = invoice.total || 0;
    
    let newStatus: string;
    if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'sent';
    } else if (invoice.status === 'paid') {
      newStatus = 'sent';
    } else {
      newStatus = invoice.status;
    }
    
    await storage.updateInvoice(organizationId, id, { 
      amountPaid: totalPaid,
      status: newStatus
    });
    
    (async () => {
      try {
        const xeroConnection = await storage.getXeroConnection(organizationId);
        if (!xeroConnection || xeroConnection.isActive !== 'true') {
          return;
        }
        
        const syncHistory = await storage.getXeroSyncHistory(organizationId, 100);
        const invoiceSync = syncHistory.find(s => s.recordId === id && s.syncType === 'invoice' && s.status === 'success');
        
        if (!invoiceSync?.xeroId) {
          console.log('[Xero Payment Sync] Invoice not synced to Xero yet, skipping payment sync');
          return;
        }
        
        let accessToken = xeroConnection.accessToken;
        const tokenExpiry = new Date(xeroConnection.tokenExpiresAt);
        const bufferTime = 5 * 60 * 1000;
        if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
          console.log('[Xero Payment Sync] Token expired or expiring soon, refreshing...');
          const refreshed = await xeroService.refreshTokens(xeroConnection.refreshToken);
          await storage.updateXeroConnection(organizationId, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: refreshed.expiresAt,
          });
          accessToken = refreshed.accessToken;
        }
        
        const result = await xeroService.syncPaymentToXero(
          { accessToken, xeroTenantId: xeroConnection.xeroTenantId },
          {
            xeroInvoiceId: invoiceSync.xeroId,
            amount: validatedData.amount,
            paymentDate: validatedData.paymentDate || new Date().toISOString().split('T')[0],
            reference: validatedData.reference || `Payment ${payment.id}`,
          }
        );
        
        await storage.createXeroSyncHistory({
          organizationId,
          syncType: 'payment',
          direction: 'push',
          status: 'success',
          recordId: payment.id,
          xeroId: result.xeroPaymentId,
        });
        
        console.log(`[Xero Payment Sync] Payment synced successfully: ${result.xeroPaymentId}`);
      } catch (xeroError: unknown) {
        const xeroErrorMessage = xeroError instanceof Error ? xeroError.message : String(xeroError);
        console.error('[Xero Payment Sync] Error syncing payment:', xeroErrorMessage);
        try {
          await storage.createXeroSyncHistory({
            organizationId,
            syncType: 'payment',
            direction: 'push',
            status: 'error',
            recordId: payment.id,
            errorMessage: xeroErrorMessage,
          });
        } catch (logError) {
          console.error('[Xero Payment Sync] Failed to log sync error:', logError);
        }
      }
    })();
    
    res.status(201).json(payment);
  } catch (error) {
    console.error("Error creating invoice payment:", error);
    res.status(400).json({ error: "Failed to create invoice payment" });
  }
});

router.delete("/invoice-payments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const payment = await storage.getInvoicePayment(organizationId, id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const invoice = await storage.getInvoice(organizationId, payment.invoiceId);
    if (!invoice) {
      return res.status(404).json({ error: "Payment not found" });
    }
    await storage.deleteInvoicePayment(organizationId, id);
    
    const remainingPayments = await storage.getInvoicePayments(organizationId, payment.invoiceId);
    const totalPaid = remainingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const invoiceTotal = invoice.total || 0;
    
    let newStatus: string;
    if (totalPaid >= invoiceTotal && invoiceTotal > 0) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'sent';
    } else if (invoice.status === 'paid') {
      newStatus = 'sent';
    } else {
      newStatus = invoice.status;
    }
    
    await storage.updateInvoice(organizationId, payment.invoiceId, { 
      amountPaid: totalPaid,
      status: newStatus
    });
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting invoice payment:", error);
    res.status(500).json({ error: "Failed to delete invoice payment" });
  }
});

export default router;
