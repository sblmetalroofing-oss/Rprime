import { Router } from "express";
import { getOrganizationId, canUserDelete, getUserAttribution } from "./middleware";
import { storage } from "../storage";
import { insertPurchaseOrderSchema, insertPurchaseOrderItemSchema } from "@shared/schema";

const router = Router();

router.get("/purchase-orders", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const purchaseOrders = await storage.getAllPurchaseOrders(organizationId);
    res.json(purchaseOrders);
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
});

router.get("/purchase-orders/next-number", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const poNumber = await storage.getAndIncrementPONumber(organizationId);
    res.json({ poNumber });
  } catch (error) {
    console.error("Error getting PO number:", error);
    res.status(500).json({ error: "Failed to get PO number" });
  }
});

router.get("/purchase-orders/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const [po, items] = await Promise.all([
      storage.getPurchaseOrder(organizationId, id),
      storage.getPurchaseOrderItems(organizationId, id)
    ]);
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    res.json({ ...po, items });
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ error: "Failed to fetch purchase order" });
  }
});

router.post("/purchase-orders", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { items, ...poData } = req.body;
    poData.organizationId = organizationId;
    const validatedData = insertPurchaseOrderSchema.parse(poData);
    const userAttribution = await getUserAttribution(req, organizationId);
    const data = { 
      ...validatedData, 
      createdBy: userAttribution.id,
      createdByName: userAttribution.name,
    };
    const po = await storage.createPurchaseOrder(data);
    
    if (items && items.length > 0) {
      for (const item of items) {
        const validatedItem = insertPurchaseOrderItemSchema.parse({ ...item, purchaseOrderId: po.id });
        await storage.createPurchaseOrderItem(organizationId, validatedItem);
      }
    }
    
    const createdItems = await storage.getPurchaseOrderItems(organizationId, po.id);
    res.status(201).json({ ...po, items: createdItems });
  } catch (error) {
    console.error("Error creating purchase order:", error);
    res.status(400).json({ error: "Failed to create purchase order" });
  }
});

router.put("/purchase-orders/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { items, ...poData } = req.body;
    const validatedData = insertPurchaseOrderSchema.partial().parse(poData);
    const po = await storage.updatePurchaseOrder(organizationId, id, validatedData);
    
    if (!po) {
      return res.status(404).json({ error: "Purchase order not found" });
    }
    
    if (items) {
      await storage.deletePurchaseOrderItems(organizationId, id);
      for (const item of items) {
        const validatedItem = insertPurchaseOrderItemSchema.parse({ ...item, purchaseOrderId: id });
        await storage.createPurchaseOrderItem(organizationId, validatedItem);
      }
    }
    
    const updatedItems = await storage.getPurchaseOrderItems(organizationId, id);
    res.json({ ...po, items: updatedItems });
  } catch (error) {
    console.error("Error updating purchase order:", error);
    res.status(400).json({ error: "Failed to update purchase order" });
  }
});

router.delete("/purchase-orders/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deletePurchaseOrder(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting purchase order:", error);
    res.status(500).json({ error: "Failed to delete purchase order" });
  }
});

export default router;
