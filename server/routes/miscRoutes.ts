import { Router, Request, Response } from "express";
import { getOrganizationId, AuthenticatedRequest } from "./middleware";
import { checkRateLimit } from "./rateLimiter";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { organizations, Quote, Invoice, PurchaseOrder, Report, QuoteItem, InvoiceItem, PurchaseOrderItem, Finding } from "@shared/schema";
import { randomUUID } from "crypto";
import { generateNotificationToken, generateChatToken } from "../websocket";
import { getCrewMemberByEmail } from "../auth-local";
import { ObjectStorageService, objectStorageClient } from "../replit_integrations/object_storage";
import { sendDocumentEmail } from "../email";
import * as xeroService from "../xero";
import { XeroAuthError } from "../xero";
import { getUncachableStripeClient } from "../stripeClient";

interface AuthenticatedUser {
  claims?: { sub?: string };
  id?: string;
}

const objectStorageService = new ObjectStorageService();
const router = Router();

router.get("/notifications/token", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    let userId: string | null = null;
    
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      const user = authReq.user as AuthenticatedUser;
      userId = user.claims?.sub || user.id || null;
    }
    
    if (!userId && authReq.session?.user?.id) {
      userId = authReq.session.user.id;
    }
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const dbUser = await storage.getUser(userId);
    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    if (!dbUser.isSuperAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }
    
    const token = generateNotificationToken(userId, dbUser.organizationId);
    if (!token) {
      return res.status(503).json({ error: "Token service unavailable" });
    }
    res.json({ token });
  } catch (error) {
    console.error("Error generating notification token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

router.get("/chat/token", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    let userId: string | null = null;
    
    if (authReq.isAuthenticated && authReq.isAuthenticated() && authReq.user) {
      const user = authReq.user as AuthenticatedUser;
      userId = user.claims?.sub || user.id || null;
    }
    
    if (!userId && authReq.session?.user?.id) {
      userId = authReq.session.user.id;
    }
    
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const dbUser = await storage.getUser(userId);
    if (!dbUser || !dbUser.organizationId) {
      return res.status(401).json({ error: "User not found or no organization" });
    }

    const userEmail = dbUser.email || authReq.session?.user?.email;
    if (!userEmail) {
      return res.status(401).json({ error: "No email on account" });
    }

    const crewMember = await getCrewMemberByEmail(userEmail);
    if (!crewMember || crewMember.isActive !== 'true') {
      return res.status(403).json({ error: "No active crew member linked to this account" });
    }

    if (crewMember.organizationId !== dbUser.organizationId) {
      return res.status(403).json({ error: "Organization mismatch" });
    }

    const token = generateChatToken(crewMember.id, dbUser.organizationId);
    if (!token) {
      return res.status(503).json({ error: "Token service unavailable" });
    }
    res.json({ token, crewMemberId: crewMember.id });
  } catch (error) {
    console.error("Error generating chat token:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

router.post("/uploads/base64", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { data, contentType = "image/jpeg" } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: "Missing required field: data" });
    }
    
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    const extension = contentType.split("/")[1] || "jpg";
    const filename = `${randomUUID()}.${extension}`;
    
    const privateDir = objectStorageService.getPrivateObjectDir();
    const objectPath = `${privateDir}/photos/${filename}`;
    
    const pathParts = objectPath.split("/").filter(p => p);
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });
    
    const photoUrl = `/objects/photos/${filename}`;
    
    res.json({ url: photoUrl, objectPath: photoUrl });
  } catch (error) {
    console.error("Error uploading base64 photo:", error);
    res.status(500).json({ error: "Failed to upload photo" });
  }
});

router.get("/public/view/:token", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('public', clientIp, 30, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { token } = req.params;
    
    const tokenInfo = await storage.validateViewToken(token);
    if (!tokenInfo) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    const { documentType, documentId } = tokenInfo;
    
    let document: Quote | Invoice | PurchaseOrder | undefined;
    let items: (QuoteItem | InvoiceItem | PurchaseOrderItem)[] = [];
    let settings: { acceptDeclineEnabled?: boolean; creditCardEnabled?: boolean } = {};
    
    if (documentType === 'quote') {
      [document, items] = await Promise.all([
        storage.getQuotePublic(documentId),
        storage.getQuoteItemsPublic(documentId)
      ]);
      if (document) {
        const docSettings = await storage.getDocumentSettingsPublic(document.organizationId, 'quote');
        settings.acceptDeclineEnabled = docSettings?.customerCanAccept === 'true';
      }
    } else if (documentType === 'invoice') {
      [document, items] = await Promise.all([
        storage.getInvoicePublic(documentId),
        storage.getInvoiceItemsPublic(documentId)
      ]);
      if (document) {
        settings.creditCardEnabled = (document as Invoice).creditCardEnabled === 'true';
      }
    } else if (documentType === 'purchase_order') {
      [document, items] = await Promise.all([
        storage.getPurchaseOrderPublic(documentId),
        storage.getPurchaseOrderItemsPublic(documentId)
      ]);
    } else if (documentType === 'report') {
      const [report, findings] = await Promise.all([
        storage.getReportPublic(documentId),
        storage.getReportFindingsPublic(documentId)
      ]);
      if (!report) {
        return res.status(404).json({ error: "Document not found" });
      }
      return res.json({ documentType, document: { ...report, findings } });
    } else {
      return res.status(400).json({ error: "Unsupported document type" });
    }
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    res.json({ documentType, document: { ...document, items }, settings });
  } catch (error) {
    console.error("Error fetching document by token:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

router.get("/public/quotes/:id", async (req, res) => {
  return res.status(401).json({ error: "Authentication required. Please use a valid view link." });
});

router.post("/public/quote/accept", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('public', clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { token, customerName, signature } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }
    
    const tokenInfo = await storage.validateViewToken(token);
    if (!tokenInfo) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    if (tokenInfo.documentType !== 'quote') {
      return res.status(400).json({ error: "Invalid document type" });
    }
    
    const quote = await storage.getQuotePublic(tokenInfo.documentId);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    
    if (quote.acceptedAt) {
      return res.json({ success: true, quote, message: "Quote was already accepted" });
    }
    
    if (quote.declinedAt) {
      return res.status(400).json({ error: "Quote has already been declined and cannot be accepted" });
    }
    
    const settings = await storage.getDocumentSettingsPublic(quote.organizationId, 'quote');
    if (settings?.customerCanAccept !== 'true') {
      return res.status(403).json({ error: "Accept/decline is not enabled for this organization" });
    }
    
    const updated = await storage.updateQuotePublic(tokenInfo.documentId, {
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedByName: customerName || quote.customerName,
      acceptedSignature: signature,
    } as any);
    
    res.json({ success: true, quote: updated });
  } catch (error) {
    console.error("Error accepting quote:", error);
    res.status(500).json({ error: "Failed to accept quote" });
  }
});

router.post("/public/quote/decline", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('public', clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { token, reason } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }
    
    const tokenInfo = await storage.validateViewToken(token);
    if (!tokenInfo) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    if (tokenInfo.documentType !== 'quote') {
      return res.status(400).json({ error: "Invalid document type" });
    }
    
    const quote = await storage.getQuotePublic(tokenInfo.documentId);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    
    if (quote.acceptedAt) {
      return res.status(400).json({ error: "Quote has already been accepted" });
    }
    
    if (quote.declinedAt) {
      return res.status(400).json({ error: "Quote has already been declined" });
    }
    
    const settings = await storage.getDocumentSettingsPublic(quote.organizationId, 'quote');
    if (settings?.customerCanDecline !== 'true') {
      return res.status(403).json({ error: "Accept/decline is not enabled for this organization" });
    }
    
    const updated = await storage.updateQuotePublic(tokenInfo.documentId, {
      status: 'declined',
      declinedAt: new Date(),
      declineReason: reason || null,
    } as any);
    
    res.json({ success: true, quote: updated });
  } catch (error) {
    console.error("Error declining quote:", error);
    res.status(500).json({ error: "Failed to decline quote" });
  }
});

router.get("/public/invoices/:id", async (req, res) => {
  return res.status(401).json({ error: "Authentication required. Please use a valid view link." });
});

router.post("/public/invoice/create-checkout", async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit('public', clientIp, 10, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }
    
    const tokenInfo = await storage.validateViewToken(token);
    if (!tokenInfo) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    
    if (tokenInfo.documentType !== 'invoice') {
      return res.status(400).json({ error: "Invalid document type" });
    }
    
    const invoice = await storage.getInvoicePublic(tokenInfo.documentId);
    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    if (invoice.creditCardEnabled !== 'true') {
      return res.status(403).json({ error: "Online payment is not enabled for this invoice" });
    }
    
    if (invoice.status === 'paid') {
      return res.status(400).json({ error: "Invoice has already been paid" });
    }
    
    const amountDue = (invoice.total || 0) - (invoice.amountPaid || 0);
    if (amountDue <= 0) {
      return res.status(400).json({ error: "No balance due on this invoice" });
    }
    
    const [org] = await db.select().from(organizations).where(eq(organizations.id, invoice.organizationId));
    const businessName = org?.businessName || org?.name || 'RPrime';
    
    const stripe = await getUncachableStripeClient();
    
    const baseUrl = process.env.APP_URL 
      || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
      || (process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : '');
    
    const session = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: 'aud',
          product_data: {
            name: `Invoice #${invoice.invoiceNumber}`,
            description: `Payment for invoice from ${businessName}`,
          },
          unit_amount: Math.round(amountDue * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${baseUrl}/view/doc/${token}?payment=success`,
      cancel_url: `${baseUrl}/view/doc/${token}?payment=cancelled`,
      metadata: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber || '',
        organizationId: invoice.organizationId,
        type: 'invoice_payment',
      },
      customer_email: invoice.customerEmail || undefined,
    });
    
    res.json({ url: session.url });
  } catch (error) {
    console.error("Error creating invoice checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.get("/public/purchase-orders/:id", async (req, res) => {
  return res.status(401).json({ error: "Authentication required. Please use a valid view link." });
});

router.post("/email/send", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const organizationId = await getOrganizationId(authReq);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { documentType, documentId, recipientEmail, recipientName, customMessage, includePdf, pdfBase64, sendCopyToSender, senderEmail } = req.body;
    const sessionEmail = authReq.session?.user?.email || senderEmail;
    
    if (!documentType || !documentId || !recipientEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const trackingToken = `${documentType}_${documentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let documentNumber = '';
    let document: Quote | Invoice | PurchaseOrder | Report | undefined;
    
    if (documentType === 'quote') {
      document = await storage.getQuote(organizationId, documentId);
      documentNumber = document?.quoteNumber || documentId;
    } else if (documentType === 'invoice') {
      document = await storage.getInvoice(organizationId, documentId);
      documentNumber = document?.invoiceNumber || documentId;
    } else if (documentType === 'report') {
      document = await storage.getReport(organizationId, documentId);
      documentNumber = document?.id || documentId;
    } else if (documentType === 'purchase_order') {
      document = await storage.getPurchaseOrder(organizationId, documentId);
      documentNumber = document?.poNumber || documentId;
    }
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    // Block sending draft documents - must be approved first
    if (document.status === 'draft') {
      return res.status(400).json({ error: "Document must be approved before sending" });
    }
    
    if (documentType === 'quote') {
      const quote = document as Quote;
      const quoteItems = await storage.getQuoteItems(organizationId, documentId);
      if (!quoteItems || quoteItems.length === 0) {
        return res.status(400).json({ error: "Cannot send a quote with no line items. Please add at least one item." });
      }
      if (!quote.total || quote.total <= 0) {
        return res.status(400).json({ error: "Cannot send a quote with a $0 total. Please add items with valid prices." });
      }
    } else if (documentType === 'invoice') {
      const invoice = document as Invoice;
      const invoiceItems = await storage.getInvoiceItems(organizationId, documentId);
      if (!invoiceItems || invoiceItems.length === 0) {
        return res.status(400).json({ error: "Cannot send an invoice with no line items. Please add at least one item." });
      }
      if (!invoice.total || invoice.total <= 0) {
        return res.status(400).json({ error: "Cannot send an invoice with a $0 total. Please add items with valid prices." });
      }
    }
    
    const [organization] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    const organizationName = organization?.businessName || organization?.name || undefined;
    
    const viewToken = await storage.createViewToken(documentType, documentId, 30);
    
    const baseUrl = process.env.APP_URL 
      || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : '')
      || (process.env.REPLIT_DOMAINS?.split(',')[0] ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : '');
    const viewLink = `${baseUrl}/view/doc/${viewToken}`;
    
    const additionalAttachments: Array<{ filename: string; content: string }> = [];
    try {
      const docTypeForAttachment = documentType === 'quote' ? 'quote' 
        : documentType === 'invoice' ? 'invoice' 
        : documentType === 'purchase_order' ? 'purchase_order'
        : null;
      if (docTypeForAttachment) {
        const attachments = await storage.getDocumentAttachments(docTypeForAttachment as 'quote' | 'invoice' | 'purchase_order', documentId);
        for (const att of attachments) {
          try {
            const normalizedKey = att.storageKey.replace(/^\/?objects\//, '').replace(/^\/+/, '');
            const storagePath = `/objects/${normalizedKey}`;
            const objectFile = await objectStorageService.getObjectEntityFile(storagePath);
            const [content] = await objectFile.download();
            const base64Content = content.toString('base64');
            additionalAttachments.push({
              filename: att.fileName,
              content: base64Content,
            });
          } catch (attError) {
            console.error(`Failed to fetch attachment ${att.fileName}:`, attError);
          }
        }
      }
    } catch (attFetchError) {
      console.error("Error fetching document attachments:", attFetchError);
    }
    
    const emailSubject = `${organizationName || 'RPrime Roofing'} - ${documentType.charAt(0).toUpperCase() + documentType.slice(1)} #${documentNumber}`;
    await storage.createEmailTracking({
      id: `et_${Date.now()}`,
      documentType,
      documentId,
      recipientEmail,
      recipientName,
      trackingToken,
      subject: emailSubject,
      attachedPdf: includePdf ? 'true' : 'false',
    });
    
    sendDocumentEmail({
      to: recipientEmail,
      recipientName: recipientName || 'Valued Customer',
      documentType,
      documentNumber,
      documentId,
      trackingToken,
      viewLink,
      includeAttachment: includePdf,
      pdfBase64,
      customMessage,
      sendCopyToSender,
      senderEmail: sessionEmail,
      additionalAttachments: additionalAttachments.length > 0 ? additionalAttachments : undefined,
      organizationName,
    }).then(result => {
      if (!result.success) {
        console.error(`[Email] Failed to send ${documentType} #${documentNumber} to ${recipientEmail}:`, result.error);
      } else {
        console.log(`[Email] Successfully sent ${documentType} #${documentNumber} to ${recipientEmail}`);
      }
    }).catch(error => {
      console.error(`[Email] Error sending ${documentType} #${documentNumber} to ${recipientEmail}:`, error);
    });
    
    if (documentType === 'invoice') {
      void (async () => {
        try {
          const xeroConnection = await storage.getXeroConnection(organizationId);
          if (!xeroConnection || xeroConnection.isActive !== 'true') {
            return;
          }
          
          let accessToken = xeroConnection.accessToken;
          const tokenExpiry = new Date(xeroConnection.tokenExpiresAt);
          const bufferTime = 5 * 60 * 1000;
          if (tokenExpiry.getTime() <= Date.now() + bufferTime) {
            try {
              console.log('[Xero Auto-Sync] Token expired or expiring soon, refreshing...');
              const refreshed = await xeroService.refreshTokens(xeroConnection.refreshToken);
              await storage.updateXeroConnection(organizationId, {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
                tokenExpiresAt: refreshed.expiresAt,
              });
              accessToken = refreshed.accessToken;
            } catch (refreshError) {
              console.error('[Xero Auto-Sync] Token refresh failed, deactivating connection:', refreshError);
              await storage.updateXeroConnection(organizationId, { isActive: 'false' });
              return;
            }
          }
          
          const invoiceItems = await storage.getInvoiceItems(organizationId, documentId);
          const invoiceDoc = document as Invoice;
          
          const result = await xeroService.syncInvoiceToXero(
            { accessToken, xeroTenantId: xeroConnection.xeroTenantId },
            {
              invoiceNumber: documentNumber,
              customerName: invoiceDoc.customerName || 'Unknown Customer',
              customerEmail: invoiceDoc.customerEmail || undefined,
              date: invoiceDoc.issueDate || new Date().toISOString().split('T')[0],
              dueDate: invoiceDoc.dueDate || undefined,
              lineItems: invoiceItems.map(item => ({
                description: item.description || 'Item',
                quantity: item.qty || 1,
                unitAmount: item.unitCost || 0,
              })),
              total: invoiceDoc.total || 0,
              status: 'sent',
            }
          );
          
          await storage.createXeroSyncHistory({
            organizationId,
            syncType: 'invoice',
            direction: 'push',
            status: 'success',
            recordId: documentId,
            xeroId: result.xeroInvoiceId,
          });
          
          await storage.updateXeroConnection(organizationId, { lastSyncAt: new Date() });
          console.log(`[Xero Auto-Sync] Invoice #${documentNumber} synced successfully`);
        } catch (xeroError) {
          console.error(`[Xero Auto-Sync] Failed to sync invoice #${documentNumber}:`, xeroError);
          try {
            await storage.createXeroSyncHistory({
              organizationId,
              syncType: 'invoice',
              direction: 'push',
              status: 'error',
              recordId: documentId,
              errorMessage: xeroError instanceof Error ? xeroError.message : 'Unknown error',
            });
            if (xeroError instanceof XeroAuthError) {
              await storage.updateXeroConnection(organizationId, { isActive: 'false' });
              console.log(`[Xero Auto-Sync] Connection deactivated due to auth failure for org ${organizationId}`);
            }
          } catch (logError) {
            console.error('[Xero Auto-Sync] Failed to log sync error:', logError);
          }
        }
      })();
    }
    
    res.json({ success: true, message: 'Email queued successfully' });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

router.get("/email/track/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString();
    const userAgent = req.headers['user-agent'];
    
    await storage.recordEmailOpen(token, ipAddress, userAgent);
    
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(gif);
  } catch (error) {
    console.error("Error tracking email:", error);
    res.status(204).send();
  }
});

router.get("/email/tracking/:documentType/:documentId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { documentType, documentId } = req.params;

    let document;
    if (documentType === 'quote') {
      document = await storage.getQuote(organizationId, documentId);
    } else if (documentType === 'invoice') {
      document = await storage.getInvoice(organizationId, documentId);
    } else if (documentType === 'purchase_order') {
      document = await storage.getPurchaseOrder(organizationId, documentId);
    } else if (documentType === 'report') {
      document = await storage.getReport(organizationId, documentId);
    }

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const history = await storage.getEmailTrackingByDocument(documentType, documentId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching email tracking:", error);
    res.status(500).json({ error: "Failed to fetch email tracking" });
  }
});

router.get("/migrations/job-numbers/status", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { checkMigrationStatus } = await import("../migrate-job-numbers");
    const status = await checkMigrationStatus(organizationId);
    res.json(status);
  } catch (error) {
    console.error("Error checking migration status:", error);
    res.status(500).json({ error: "Failed to check migration status" });
  }
});

router.post("/migrations/job-numbers/run", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { migrateJobNumbersForOrg } = await import("../migrate-job-numbers");
    const result = await migrateJobNumbersForOrg(organizationId);
    res.json(result);
  } catch (error) {
    console.error("Error running job number migration:", error);
    res.status(500).json({ error: "Failed to run migration" });
  }
});

router.get("/migrations/job-schedules/status", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { checkScheduleMigrationStatus } = await import("../migrate-job-schedules");
    const status = await checkScheduleMigrationStatus(organizationId);
    res.json(status);
  } catch (error) {
    console.error("Error checking schedule migration status:", error);
    res.status(500).json({ error: "Failed to check migration status" });
  }
});

router.post("/migrations/job-schedules/run", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { migrateJobSchedulesToAppointments } = await import("../migrate-job-schedules");
    const result = await migrateJobSchedulesToAppointments(organizationId);
    res.json(result);
  } catch (error) {
    console.error("Error running schedule migration:", error);
    res.status(500).json({ error: "Failed to run migration" });
  }
});

router.get("/organization/timezone", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated" });
    const [org] = await db.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, organizationId));
    res.json({ timezone: org?.timezone || 'Australia/Brisbane' });
  } catch (error) {
    console.error("Error getting timezone:", error);
    res.status(500).json({ error: "Failed to get timezone" });
  }
});

router.put("/organization/timezone", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated" });
    const { timezone } = req.body;
    if (!timezone || typeof timezone !== 'string') return res.status(400).json({ error: "Timezone is required" });
    await db.update(organizations).set({ timezone, updatedAt: new Date() }).where(eq(organizations.id, organizationId));
    res.json({ timezone });
  } catch (error) {
    console.error("Error updating timezone:", error);
    res.status(500).json({ error: "Failed to update timezone" });
  }
});

export default router;
