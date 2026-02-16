import { Router } from "express";
import { getOrganizationId, canUserDelete } from "./middleware";
import { storage } from "../storage";
import { z } from "zod";
import {
  insertFlashingMaterialSchema,
  insertFlashingOrderSchema,
  insertFlashingProfileSchema,
  insertFlashingTemplateSchema,
} from "@shared/schema";

const router = Router();

router.get("/rflash/materials", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const materials = await storage.getAllFlashingMaterials();
    res.json(materials);
  } catch (error) {
    console.error("Error fetching flashing materials:", error);
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

router.post("/rflash/materials", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or Manager role required." });
  }
  try {
    const validatedData = insertFlashingMaterialSchema.parse(req.body);
    const material = await storage.createFlashingMaterial(validatedData);
    res.json(material);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating flashing material:", error);
    res.status(500).json({ error: "Failed to create material" });
  }
});

router.put("/rflash/materials/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or Manager role required." });
  }
  try {
    const validatedData = insertFlashingMaterialSchema.partial().parse(req.body);
    const material = await storage.updateFlashingMaterial(req.params.id, validatedData);
    if (!material) {
      return res.status(404).json({ error: "Material not found" });
    }
    res.json(material);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating flashing material:", error);
    res.status(500).json({ error: "Failed to update material" });
  }
});

router.delete("/rflash/materials/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or manager role required." });
  }
  try {
    await storage.deleteFlashingMaterial(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashing material:", error);
    res.status(500).json({ error: "Failed to delete material" });
  }
});

router.get("/rflash/orders", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const { jobId } = req.query;
    let orders;
    if (jobId && typeof jobId === 'string') {
      orders = await storage.getFlashingOrdersByJob(organizationId, jobId);
    } else {
      orders = await storage.getAllFlashingOrders(organizationId);
    }
    res.json(orders);
  } catch (error) {
    console.error("Error fetching flashing orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/rflash/orders/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const order = await storage.getFlashingOrder(organizationId, req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Error fetching flashing order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.post("/rflash/orders", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingOrderSchema.parse(req.body);
    const order = await storage.createFlashingOrder(organizationId, validatedData);
    res.json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating flashing order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

router.put("/rflash/orders/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingOrderSchema.partial().parse(req.body);
    const order = await storage.updateFlashingOrder(organizationId, req.params.id, validatedData);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating flashing order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

router.delete("/rflash/orders/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or manager role required." });
  }
  try {
    await storage.deleteFlashingOrder(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashing order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

router.get("/rflash/orders/:orderId/profiles", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const profiles = await storage.getFlashingProfilesByOrder(organizationId, req.params.orderId);
    res.json(profiles);
  } catch (error) {
    console.error("Error fetching flashing profiles:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/rflash/profiles/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const profile = await storage.getFlashingProfile(organizationId, req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("Error fetching flashing profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.post("/rflash/profiles", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingProfileSchema.parse(req.body);
    const profile = await storage.createFlashingProfile(organizationId, validatedData);
    if (!profile) {
      return res.status(404).json({ error: "Order not found or access denied" });
    }
    res.json(profile);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating flashing profile:", error);
    res.status(500).json({ error: "Failed to create profile" });
  }
});

router.put("/rflash/profiles/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingProfileSchema.partial().parse(req.body);
    const profile = await storage.updateFlashingProfile(organizationId, req.params.id, validatedData);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating flashing profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.delete("/rflash/profiles/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or manager role required." });
  }
  try {
    await storage.deleteFlashingProfile(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashing profile:", error);
    res.status(500).json({ error: "Failed to delete profile" });
  }
});

router.get("/rflash/orders/:orderId/next-code", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const code = await storage.getNextFlashingCode(organizationId, req.params.orderId);
    res.json({ code });
  } catch (error) {
    console.error("Error getting next flashing code:", error);
    res.status(500).json({ error: "Failed to get next code" });
  }
});

router.get("/rflash/templates", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const templates = await storage.getAllFlashingTemplates(organizationId);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching flashing templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/rflash/templates", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingTemplateSchema.parse(req.body);
    const template = await storage.createFlashingTemplate(organizationId, validatedData);
    res.json(template);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating flashing template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/rflash/templates/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const validatedData = insertFlashingTemplateSchema.partial().parse(req.body);
    const template = await storage.updateFlashingTemplate(organizationId, req.params.id, validatedData);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating flashing template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/rflash/templates/:id", async (req, res) => {
  const organizationId = await getOrganizationId(req);
  if (!organizationId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const canDelete = await canUserDelete(req);
  if (!canDelete) {
    return res.status(403).json({ error: "Permission denied. Admin or manager role required." });
  }
  try {
    await storage.deleteFlashingTemplate(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting flashing template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
