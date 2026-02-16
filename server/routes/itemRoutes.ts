import { Router } from "express";
import { getOrganizationId, canUserDelete } from "./middleware";
import { storage } from "../storage";
import { insertItemSchema } from "@shared/schema";

const router = Router();

router.get("/items", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { search } = req.query;
    const items = search 
      ? await storage.searchItems(organizationId, search as string)
      : await storage.getAllItems(organizationId);
    res.json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

router.get("/items/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const item = await storage.getItem(organizationId, id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({ error: "Failed to fetch item" });
  }
});

router.post("/items", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const itemWithId = {
      ...req.body,
      id: req.body.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    const validatedData = insertItemSchema.parse({ ...itemWithId, organizationId });
    const data = { ...validatedData };
    const item = await storage.createItem(data);
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating item:", error);
    res.status(400).json({ error: "Failed to create item" });
  }
});

router.post("/items/bulk", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { items: itemsData } = req.body;
    if (!Array.isArray(itemsData)) {
      return res.status(400).json({ error: "Items must be an array" });
    }
    const itemsWithIds = itemsData.map((item, index) => ({
      ...item,
      id: item.id || `item-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
    }));
    const validatedItems = itemsWithIds.map(item => insertItemSchema.parse(item));
    const createdItems = await storage.createItems(validatedItems);
    res.status(201).json({ created: createdItems.length, items: createdItems });
  } catch (error) {
    console.error("Error bulk creating items:", error);
    res.status(400).json({ error: "Failed to bulk create items" });
  }
});

router.post("/items/import-csv", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { rows, columnMapping, defaultMarkupPercent } = req.body;
    
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No data rows provided" });
    }
    
    if (!columnMapping || typeof columnMapping !== 'object') {
      return res.status(400).json({ error: "Column mapping is required" });
    }
    
    const markupMultiplier = defaultMarkupPercent ? 1 + (defaultMarkupPercent / 100) : 1.3;
    
    const createdItems = [];
    const errors: string[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const itemCode = columnMapping.itemCode !== undefined ? row[columnMapping.itemCode]?.toString().trim() : '';
        const description = columnMapping.description !== undefined ? row[columnMapping.description]?.toString().trim() : '';
        
        if (!itemCode || !description) {
          errors.push(`Row ${i + 1}: Missing required fields (itemCode or description)`);
          continue;
        }
        
        const costPrice = columnMapping.costPrice !== undefined 
          ? parseFloat(row[columnMapping.costPrice]?.toString().replace(/[^0-9.-]/g, '') || '0') || 0 
          : 0;
        let sellPrice = columnMapping.sellPrice !== undefined 
          ? parseFloat(row[columnMapping.sellPrice]?.toString().replace(/[^0-9.-]/g, '') || '0') || 0 
          : 0;
        
        if (sellPrice === 0 && costPrice > 0) {
          sellPrice = Math.round(costPrice * markupMultiplier * 100) / 100;
        }
        
        const markup = costPrice > 0 ? Math.round(((sellPrice - costPrice) / costPrice) * 100) : (defaultMarkupPercent || 0);
        
        const itemData = {
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          organizationId,
          itemCode,
          description,
          costPrice,
          sellPrice,
          markup,
          unit: columnMapping.unit !== undefined ? row[columnMapping.unit]?.toString().trim() || 'each' : 'each',
          category: columnMapping.category !== undefined ? row[columnMapping.category]?.toString().trim() || null : null,
          supplierName: columnMapping.supplierName !== undefined ? row[columnMapping.supplierName]?.toString().trim() || null : null,
          supplierItemCode: null,
          supplierId: null,
          notes: null,
          isActive: 'true',
        };
        
        const validatedData = insertItemSchema.parse(itemData);
        const item = await storage.createItem(validatedData);
        createdItems.push(item);
      } catch (rowError: unknown) {
        const message = rowError instanceof Error ? rowError.message : 'Failed to create item';
        errors.push(`Row ${i + 1}: ${message}`);
      }
    }
    
    res.status(201).json({ 
      created: createdItems.length, 
      total: rows.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    console.error("Error importing CSV items:", error);
    res.status(400).json({ error: "Failed to import CSV items" });
  }
});

router.put("/items/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertItemSchema.partial().parse(req.body);
    const item = await storage.updateItem(organizationId, id, validatedData);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    res.json(item);
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(400).json({ error: "Failed to update item" });
  }
});

router.post("/items/apply-markup", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    
    const { markupPercent } = req.body;
    const markup = parseFloat(markupPercent) || 30;
    const multiplier = 1 + (markup / 100);
    
    const allItems = await storage.getAllItems(organizationId);
    const itemsToUpdate = allItems.filter(item => item.sellPrice === 0 && item.costPrice > 0);
    
    let updated = 0;
    for (const item of itemsToUpdate) {
      const newSellPrice = Math.round(item.costPrice * multiplier * 100) / 100;
      await storage.updateItem(organizationId, item.id, { 
        sellPrice: newSellPrice,
        markup: markup
      });
      updated++;
    }
    
    res.json({ updated, total: itemsToUpdate.length, markup });
  } catch (error) {
    console.error("Error applying markup:", error);
    res.status(500).json({ error: "Failed to apply markup" });
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    
    const item = await storage.getItem(organizationId, id);
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }
    
    await storage.deleteItem(organizationId, id);
    res.status(204).send();
  } catch (error: unknown) {
    console.error("Error deleting item:", error);
    const dbError = error as { code?: string; message?: string };
    if (dbError?.code === '23503' || dbError?.message?.includes('foreign key constraint')) {
      return res.status(409).json({ error: "Cannot delete item: it is referenced by quotes, invoices, or purchase orders" });
    }
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
