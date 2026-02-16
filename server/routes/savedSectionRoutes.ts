import { Router } from "express";
import { getOrganizationId, getUserAttribution } from "./middleware";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

router.get("/saved-line-sections", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated or no organization" });
    const sections = await storage.getSavedLineSections(organizationId);
    res.json(sections);
  } catch (error) {
    console.error("Error fetching saved sections:", error);
    res.status(500).json({ error: "Failed to fetch saved sections" });
  }
});

router.get("/saved-line-sections/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated or no organization" });
    const result = await storage.getSavedLineSectionWithItems(organizationId, req.params.id);
    if (!result) return res.status(404).json({ error: "Section not found" });
    res.json(result);
  } catch (error) {
    console.error("Error fetching saved section:", error);
    res.status(500).json({ error: "Failed to fetch saved section" });
  }
});

router.post("/saved-line-sections", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated or no organization" });
    const userAttribution = await getUserAttribution(req, organizationId);
    const savedSectionSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      items: z.array(z.object({
        description: z.string(),
        qty: z.number().optional(),
        unitCost: z.number().optional(),
        total: z.number().optional(),
        itemCode: z.string().optional(),
        costPrice: z.number().optional(),
        productId: z.string().optional(),
        section: z.string().optional(),
        sortOrder: z.number().optional(),
      })).min(1, "At least one item is required"),
    });
    const { name, description, items } = savedSectionSchema.parse(req.body);
    const section = await storage.createSavedLineSection(organizationId, {
      name,
      description,
      createdBy: userAttribution.id || userAttribution.name,
      items,
    });
    res.json(section);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating saved section:", error);
    res.status(500).json({ error: "Failed to create saved section" });
  }
});

router.delete("/saved-line-sections/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) return res.status(401).json({ error: "Not authenticated or no organization" });
    await storage.deleteSavedLineSection(organizationId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved section:", error);
    res.status(500).json({ error: "Failed to delete saved section" });
  }
});

export default router;
