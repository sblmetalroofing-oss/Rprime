import { Router } from "express";
import { getOrganizationId, canUserDelete, getUserAttribution } from "./middleware";
import { storage } from "../storage";
import { insertQuoteSchema, insertQuoteItemSchema } from "@shared/schema";

const router = Router();

router.get("/quotes", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const quotes = await storage.getAllQuotes(organizationId);
    res.json(quotes);
  } catch (error) {
    console.error("Error fetching quotes:", error);
    res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

router.get("/quotes/next-number", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const quoteNumber = await storage.getAndIncrementQuoteNumber(organizationId);
    res.json({ quoteNumber });
  } catch (error) {
    console.error("Error getting quote number:", error);
    res.status(500).json({ error: "Failed to get quote number" });
  }
});

router.get("/quotes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const [quote, items] = await Promise.all([
      storage.getQuote(organizationId, id),
      storage.getQuoteItems(organizationId, id)
    ]);
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    res.json({ ...quote, items });
  } catch (error) {
    console.error("Error fetching quote:", error);
    res.status(500).json({ error: "Failed to fetch quote" });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { items, ...quoteData } = req.body;
    quoteData.organizationId = organizationId;
    const validatedData = insertQuoteSchema.parse(quoteData);
    const userAttribution = await getUserAttribution(req, organizationId);
    const data = { 
      ...validatedData, 
      createdBy: userAttribution.id,
      createdByName: userAttribution.name,
    };
    const quote = await storage.createQuote(data);
    
    if (items && items.length > 0) {
      for (const item of items) {
        const validatedItem = insertQuoteItemSchema.parse({ ...item, quoteId: quote.id });
        await storage.createQuoteItem(organizationId, validatedItem);
      }
    }
    
    const createdItems = await storage.getQuoteItems(organizationId, quote.id);
    
    const roundMoney = (v: any) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
    if (createdItems.length > 0) {
      const subtotal = roundMoney(createdItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitCost)), 0));
      const discount = Number(quote.discount) || 0;
      const gst = roundMoney((subtotal - discount) * 0.1);
      const total = roundMoney(subtotal - discount + gst);
      const totalCost = roundMoney(createdItems.reduce((sum, item) => sum + (Number(item.qty) * (Number(item.costPrice) || 0)), 0));
      const grossProfit = roundMoney(subtotal - totalCost);
      await storage.updateQuote(organizationId, quote.id, { subtotal, gst, total, totalCost, grossProfit });
      Object.assign(quote, { subtotal, gst, total, totalCost, grossProfit });
    } else {
      const zeroTotals = { subtotal: 0, gst: 0, total: 0, totalCost: 0, grossProfit: 0 };
      await storage.updateQuote(organizationId, quote.id, zeroTotals);
      Object.assign(quote, zeroTotals);
    }
    
    for (const item of createdItems) {
      if (item.description && item.unitCost) {
        const normalizedKey = item.description.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
        try {
          await storage.upsertMlPricingPattern(organizationId, {
            itemDescription: item.description,
            normalizedKey,
            unitPrice: Number(item.unitCost) || 0,
            quantity: Number(item.qty) || 1,
            amount: Number(item.total) || (Number(item.unitCost) * (Number(item.qty) || 1)),
            source: 'quote',
          });
        } catch (mlError) {
          console.error("ML learning error:", mlError);
        }
      }
    }
    
    res.status(201).json({ ...quote, items: createdItems });
  } catch (error) {
    console.error("Error creating quote:", error);
    res.status(400).json({ error: "Failed to create quote" });
  }
});

router.put("/quotes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { items, ...quoteData } = req.body;
    const validatedData = insertQuoteSchema.partial().parse(quoteData);
    
    if (validatedData.status) {
      const existingQuote = await storage.getQuote(organizationId, id);
      if (!existingQuote) {
        return res.status(404).json({ error: "Quote not found" });
      }
      const currentStatus = existingQuote.status || 'draft';
      const newStatus = validatedData.status;
      const validTransitions: Record<string, string[]> = {
        'draft': ['approved', 'sent', 'accepted', 'declined'],
        'approved': ['sent', 'accepted', 'declined', 'draft'],
        'sent': ['accepted', 'declined', 'draft'],
        'accepted': [],
        'declined': ['draft'],
      };
      const allowed = validTransitions[currentStatus] || [];
      if (currentStatus !== newStatus && !allowed.includes(newStatus)) {
        return res.status(400).json({ 
          error: `Cannot change quote status from '${currentStatus}' to '${newStatus}'. ${currentStatus === 'accepted' ? 'Accepted quotes cannot be modified.' : currentStatus === 'declined' ? 'Declined quotes can only be reverted to draft.' : `Allowed transitions: ${allowed.join(', ') || 'none'}.`}` 
        });
      }
    }
    
    const quote = await storage.updateQuote(organizationId, id, validatedData);
    
    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    
    if (items) {
      await storage.deleteQuoteItems(organizationId, id);
      for (const item of items) {
        const validatedItem = insertQuoteItemSchema.parse({ ...item, quoteId: id });
        await storage.createQuoteItem(organizationId, validatedItem);
      }
    }
    
    const updatedItems = await storage.getQuoteItems(organizationId, id);
    
    if (items !== undefined) {
      const roundMoney = (v: any) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
      if (updatedItems.length > 0) {
        const subtotal = roundMoney(updatedItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitCost)), 0));
        const discount = Number(validatedData.discount ?? quote!.discount) || 0;
        const gst = roundMoney((subtotal - discount) * 0.1);
        const total = roundMoney(subtotal - discount + gst);
        const totalCost = roundMoney(updatedItems.reduce((sum, item) => sum + (Number(item.qty) * (Number(item.costPrice) || 0)), 0));
        const grossProfit = roundMoney(subtotal - totalCost);
        const updatedQuote = await storage.updateQuote(organizationId, id, { subtotal, gst, total, totalCost, grossProfit });
        if (updatedQuote) Object.assign(quote!, { subtotal, gst, total, totalCost, grossProfit });
      } else {
        const zeroTotals = { subtotal: 0, gst: 0, total: 0, totalCost: 0, grossProfit: 0 };
        const updatedQuote = await storage.updateQuote(organizationId, id, zeroTotals);
        if (updatedQuote) Object.assign(quote!, zeroTotals);
      }
    }
    
    for (const item of updatedItems) {
      if (item.description && item.unitCost) {
        const normalizedKey = item.description.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 100);
        try {
          await storage.upsertMlPricingPattern(organizationId, {
            itemDescription: item.description,
            normalizedKey,
            unitPrice: Number(item.unitCost) || 0,
            quantity: Number(item.qty) || 1,
            amount: Number(item.total) || (Number(item.unitCost) * (Number(item.qty) || 1)),
            source: 'quote',
          });
        } catch (mlError) {
          console.error("ML learning error:", mlError);
        }
      }
    }
    
    res.json({ ...quote, items: updatedItems });
  } catch (error) {
    console.error("Error updating quote:", error);
    res.status(400).json({ error: "Failed to update quote" });
  }
});

router.delete("/quotes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteQuote(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting quote:", error);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

router.get("/quote-templates", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const templates = await storage.getAllQuoteTemplates(organizationId);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching quote templates:", error);
    res.status(500).json({ error: "Failed to fetch quote templates" });
  }
});

router.get("/quote-templates/active", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const templates = await storage.getActiveQuoteTemplates(organizationId);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching active quote templates:", error);
    res.status(500).json({ error: "Failed to fetch active quote templates" });
  }
});

router.get("/quote-templates/default", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const template = await storage.getDefaultQuoteTemplate(organizationId);
    res.json(template || null);
  } catch (error) {
    console.error("Error fetching default quote template:", error);
    res.status(500).json({ error: "Failed to fetch default quote template" });
  }
});

router.get("/quote-templates/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const template = await storage.getQuoteTemplate(organizationId, req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    console.error("Error fetching quote template:", error);
    res.status(500).json({ error: "Failed to fetch quote template" });
  }
});

router.post("/quote-templates", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const template = await storage.createQuoteTemplate({ ...req.body, organizationId });
    res.json(template);
  } catch (error) {
    console.error("Error creating quote template:", error);
    res.status(500).json({ error: "Failed to create quote template" });
  }
});

router.put("/quote-templates/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const template = await storage.updateQuoteTemplate(organizationId, req.params.id, req.body);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  } catch (error) {
    console.error("Error updating quote template:", error);
    res.status(500).json({ error: "Failed to update quote template" });
  }
});

router.delete("/quote-templates/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  if (!canUserDelete(req)) {
    return res.status(403).json({ error: "Permission denied - only admins or managers can delete" });
  }
  
  try {
    await storage.deleteQuoteTemplate(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote template:", error);
    res.status(500).json({ error: "Failed to delete quote template" });
  }
});

router.get("/quote-templates/:templateId/mappings", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const mappings = await storage.getQuoteTemplateMappings(organizationId, req.params.templateId);
    res.json(mappings);
  } catch (error) {
    console.error("Error fetching template mappings:", error);
    res.status(500).json({ error: "Failed to fetch template mappings" });
  }
});

router.post("/quote-templates/:templateId/mappings", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const mapping = await storage.createQuoteTemplateMapping(organizationId, {
      ...req.body,
      templateId: req.params.templateId
    });
    res.json(mapping);
  } catch (error) {
    console.error("Error creating template mapping:", error);
    res.status(500).json({ error: "Failed to create template mapping" });
  }
});

router.put("/quote-template-mappings/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const mapping = await storage.updateQuoteTemplateMapping(organizationId, req.params.id, req.body);
    if (!mapping) return res.status(404).json({ error: "Mapping not found" });
    res.json(mapping);
  } catch (error) {
    console.error("Error updating template mapping:", error);
    res.status(500).json({ error: "Failed to update template mapping" });
  }
});

router.delete("/quote-template-mappings/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  if (!canUserDelete(req)) {
    return res.status(403).json({ error: "Permission denied - only admins or managers can delete" });
  }
  
  try {
    await storage.deleteQuoteTemplateMapping(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting template mapping:", error);
    res.status(500).json({ error: "Failed to delete template mapping" });
  }
});

router.get("/roof-extractions/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const extraction = await storage.getRoofReportExtraction(organizationId, req.params.id);
    if (!extraction) return res.status(404).json({ error: "Extraction not found" });
    res.json(extraction);
  } catch (error) {
    console.error("Error fetching roof extraction:", error);
    res.status(500).json({ error: "Failed to fetch roof extraction" });
  }
});

router.get("/roof-extractions/by-quote/:quoteId", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const extraction = await storage.getRoofReportExtractionByQuote(organizationId, req.params.quoteId);
    res.json(extraction || null);
  } catch (error) {
    console.error("Error fetching roof extraction by quote:", error);
    res.status(500).json({ error: "Failed to fetch roof extraction" });
  }
});

router.post("/roof-extractions", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const extraction = await storage.createRoofReportExtraction({ ...req.body, organizationId });
    res.json(extraction);
  } catch (error) {
    console.error("Error creating roof extraction:", error);
    res.status(500).json({ error: "Failed to create roof extraction" });
  }
});

router.put("/roof-extractions/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  try {
    const extraction = await storage.updateRoofReportExtraction(organizationId, req.params.id, req.body);
    if (!extraction) return res.status(404).json({ error: "Extraction not found" });
    res.json(extraction);
  } catch (error) {
    console.error("Error updating roof extraction:", error);
    res.status(500).json({ error: "Failed to update roof extraction" });
  }
});

router.delete("/roof-extractions/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) return res.status(401).json({ error: "Unauthorized" });
  
  if (!canUserDelete(req)) {
    return res.status(403).json({ error: "Permission denied - only admins or managers can delete" });
  }
  
  try {
    await storage.deleteRoofReportExtraction(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting roof extraction:", error);
    res.status(500).json({ error: "Failed to delete roof extraction" });
  }
});

export default router;
