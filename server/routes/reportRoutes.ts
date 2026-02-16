import { Router } from "express";
import { getOrganizationId, canUserDelete } from "./middleware";
import { storage } from "../storage";
import { insertReportSchema, insertFindingSchema, insertEstimateItemSchema } from "@shared/schema";

const router = Router();

router.get("/reports", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const reports = await storage.getAllReports(organizationId);
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.get("/reports/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const [report, findings, estimateItems] = await Promise.all([
      storage.getReport(organizationId, id),
      storage.getFindings(organizationId, id),
      storage.getEstimateItems(organizationId, id)
    ]);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json({ ...report, findings, estimateItems });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.post("/reports", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertReportSchema.parse({ ...req.body, organizationId });
    const data = { ...validatedData };
    const report = await storage.createReport(data);
    res.status(201).json(report);
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(400).json({ error: "Failed to create report" });
  }
});

router.put("/reports/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertReportSchema.partial().parse(req.body);
    const report = await storage.updateReport(organizationId, id, validatedData);

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(400).json({ error: "Failed to update report" });
  }
});

router.delete("/reports/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteReport(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

router.post("/reports/:reportId/findings", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { reportId } = req.params;
    console.log("[Finding] Creating finding for report:", reportId);
    console.log("[Finding] Request body:", JSON.stringify(req.body, null, 2));
    
    const dataToValidate = { ...req.body, reportId };
    console.log("[Finding] Data to validate:", JSON.stringify(dataToValidate, null, 2));
    
    const validatedData = insertFindingSchema.parse(dataToValidate);
    console.log("[Finding] Validated data:", JSON.stringify(validatedData, null, 2));
    
    const finding = await storage.createFinding(organizationId, validatedData);
    console.log("[Finding] Created successfully:", finding.id);
    res.status(201).json(finding);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Finding] Error creating finding:", errorMessage);
    if (error && typeof error === 'object' && 'errors' in error) {
      console.error("[Finding] Validation errors:", JSON.stringify((error as { errors: unknown }).errors, null, 2));
    }
    res.status(400).json({ error: "Failed to create finding", details: errorMessage });
  }
});

router.put("/findings/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertFindingSchema.partial().parse(req.body);
    const finding = await storage.updateFinding(organizationId, id, validatedData);
    if (!finding) {
      return res.status(404).json({ error: "Finding not found" });
    }
    res.json(finding);
  } catch (error) {
    console.error("Error updating finding:", error);
    res.status(400).json({ error: "Failed to update finding" });
  }
});

router.delete("/findings/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteFinding(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting finding:", error);
    res.status(500).json({ error: "Failed to delete finding" });
  }
});

router.post("/reports/:reportId/estimate-items", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { reportId } = req.params;
    const validatedData = insertEstimateItemSchema.parse({ ...req.body, reportId });
    const item = await storage.createEstimateItem(organizationId, validatedData);
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating estimate item:", error);
    res.status(400).json({ error: "Failed to create estimate item" });
  }
});

router.delete("/estimate-items/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteEstimateItem(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting estimate item:", error);
    res.status(500).json({ error: "Failed to delete estimate item" });
  }
});

export default router;
