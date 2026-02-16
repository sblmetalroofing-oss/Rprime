import { Router } from "express";
import { getOrganizationId, canUserDelete } from "./middleware";
import { storage } from "../storage";
import { 
  insertDocumentSettingsSchema,
  insertDocumentThemeSchema,
  insertDocumentThemeSettingsSchema,
  insertDocumentAttachmentSchema
} from "@shared/schema";
import { trackSettingsChange } from "../settings-migration-tracker";

const router = Router();

// Document Settings routes
router.get("/document-settings/:type", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { type } = req.params;
    const settings = await storage.getDocumentSettings(organizationId, type);
    if (!settings) {
      return res.json({
        type,
        prefix: type === 'quote' ? 'Q' : 'INV',
        nextNumber: 1,
        defaultExpiryDays: 30,
        defaultDueDays: 14,
        defaultTerms: '',
        bankName: '',
        bsb: '',
        accountNumber: '',
        accountName: '',
        reminderMessage: '',
        emailRemindersDefault: 'false',
        smsRemindersDefault: 'false',
        customerCanAccept: 'true',
        customerCanDecline: 'true',
        autoMarkPaid: 'false'
      });
    }
    res.json(settings);
  } catch (error) {
    console.error("Error fetching document settings:", error);
    res.status(500).json({ error: "Failed to fetch document settings" });
  }
});

router.put("/document-settings/:type", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { type } = req.params;
    const oldSettings = await storage.getDocumentSettings(organizationId, type);
    const dataWithType = { ...req.body, type, organizationId };
    const validatedData = insertDocumentSettingsSchema.parse(dataWithType);
    const settings = await storage.upsertDocumentSettings(organizationId, validatedData);
    await trackSettingsChange(
      'document_settings',
      settings.id,
      oldSettings ? 'update' : 'insert',
      oldSettings || null,
      settings,
      organizationId
    );
    res.json(settings);
  } catch (error) {
    console.error("Error updating document settings:", error);
    res.status(400).json({ error: "Failed to update document settings" });
  }
});

// App Settings routes
router.get("/app-settings", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const settings = await storage.getAllAppSettings(organizationId);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching app settings:", error);
    res.status(500).json({ error: "Failed to fetch app settings" });
  }
});

router.get("/app-settings/:key", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { key } = req.params;
    const value = await storage.getAppSetting(organizationId, key);
    res.json({ key, value: value || null });
  } catch (error) {
    console.error("Error fetching app setting:", error);
    res.status(500).json({ error: "Failed to fetch app setting" });
  }
});

router.put("/app-settings/:key", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { key } = req.params;
    const { value } = req.body;
    const oldValue = await storage.getAppSetting(organizationId, key);
    await storage.setAppSetting(organizationId, key, value);
    await trackSettingsChange(
      'app_settings',
      `${organizationId}-${key}`,
      oldValue !== undefined ? 'update' : 'insert',
      oldValue !== undefined ? { key, value: oldValue } : null,
      { key, value },
      organizationId
    );
    res.json({ key, value });
  } catch (error) {
    console.error("Error updating app setting:", error);
    res.status(400).json({ error: "Failed to update app setting" });
  }
});

// Document Theme routes
router.get("/document-themes", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const themes = await storage.getAllDocumentThemes(organizationId);
    res.json(themes);
  } catch (error) {
    console.error("Error fetching document themes:", error);
    res.status(500).json({ error: "Failed to fetch document themes" });
  }
});

router.get("/document-themes/default", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const theme = await storage.getDefaultDocumentTheme(organizationId);
    if (!theme) {
      return res.json(null);
    }
    res.json(theme);
  } catch (error) {
    console.error("Error fetching default theme:", error);
    res.status(500).json({ error: "Failed to fetch default theme" });
  }
});

router.get("/document-themes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const theme = await storage.getDocumentTheme(organizationId, id);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    res.json(theme);
  } catch (error) {
    console.error("Error fetching document theme:", error);
    res.status(500).json({ error: "Failed to fetch document theme" });
  }
});

router.post("/document-themes", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertDocumentThemeSchema.parse(req.body);
    const data = { ...validatedData, organizationId };
    const theme = await storage.createDocumentTheme(data);
    await storage.createDefaultThemeSettings(theme.id);
    await trackSettingsChange('document_themes', theme.id, 'insert', null, theme, organizationId);
    res.status(201).json(theme);
  } catch (error) {
    console.error("Error creating document theme:", error);
    res.status(400).json({ error: "Failed to create document theme" });
  }
});

router.put("/document-themes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const oldTheme = await storage.getDocumentTheme(organizationId, id);
    const validatedData = insertDocumentThemeSchema.partial().parse(req.body);
    const theme = await storage.updateDocumentTheme(organizationId, id, validatedData);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    await trackSettingsChange('document_themes', id, 'update', oldTheme || null, theme, organizationId);
    res.json(theme);
  } catch (error) {
    console.error("Error updating document theme:", error);
    res.status(400).json({ error: "Failed to update document theme" });
  }
});

router.post("/document-themes/:id/set-default", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const oldTheme = await storage.getDocumentTheme(organizationId, id);
    const theme = await storage.setDefaultDocumentTheme(organizationId, id);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    await trackSettingsChange('document_themes', id, 'update', oldTheme || null, theme, organizationId);
    res.json(theme);
  } catch (error) {
    console.error("Error setting default theme:", error);
    res.status(400).json({ error: "Failed to set default theme" });
  }
});

router.post("/document-themes/:id/archive", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { archived } = req.body;
    const oldTheme = await storage.getDocumentTheme(organizationId, id);
    const theme = await storage.archiveDocumentTheme(organizationId, id, archived !== false);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    await trackSettingsChange('document_themes', id, 'update', oldTheme || null, theme, organizationId);
    res.json(theme);
  } catch (error) {
    console.error("Error archiving document theme:", error);
    res.status(400).json({ error: "Failed to archive document theme" });
  }
});

router.delete("/document-themes/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const oldTheme = await storage.getDocumentTheme(organizationId, id);
    await storage.deleteDocumentTheme(organizationId, id);
    if (oldTheme) {
      await trackSettingsChange('document_themes', id, 'delete', oldTheme, null, organizationId);
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting document theme:", error);
    res.status(500).json({ error: "Failed to delete document theme" });
  }
});

// Document Theme Settings routes
router.get("/document-themes/:themeId/settings", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { themeId } = req.params;
    const theme = await storage.getDocumentTheme(organizationId, themeId);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    let settings = await storage.getDocumentThemeSettings(themeId);
    if (settings.length === 0) {
      settings = await storage.createDefaultThemeSettings(themeId);
    }
    res.json(settings);
  } catch (error) {
    console.error("Error fetching theme settings:", error);
    res.status(500).json({ error: "Failed to fetch theme settings" });
  }
});

router.put("/document-themes/:themeId/settings", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { themeId } = req.params;
    const theme = await storage.getDocumentTheme(organizationId, themeId);
    if (!theme) {
      return res.status(404).json({ error: "Theme not found" });
    }
    const settingsArray = req.body;
    if (!Array.isArray(settingsArray)) {
      return res.status(400).json({ error: "Expected array of settings" });
    }
    const oldSettings = await storage.getDocumentThemeSettings(themeId);
    const oldSettingsMap = new Map(oldSettings.map(s => [s.documentType, s]));
    const results = [];
    for (const settings of settingsArray) {
      const { id, createdAt, updatedAt, ...settingsData } = settings;
      const validatedData = insertDocumentThemeSettingsSchema.parse({ ...settingsData, themeId });
      const oldSetting = oldSettingsMap.get(settingsData.documentType);
      const result = await storage.upsertDocumentThemeSettings(validatedData);
      results.push(result);
      const operation = oldSetting ? 'update' : 'insert';
      const recordId = `${themeId}:${settingsData.documentType}`;
      await trackSettingsChange('document_theme_settings', recordId, operation, oldSetting || null, result, organizationId);
    }
    res.json(results);
  } catch (error) {
    console.error("Error updating theme settings:", error);
    res.status(400).json({ error: "Failed to update theme settings" });
  }
});

// Document Attachment routes
router.get("/document-attachments/:documentType/:documentId", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { documentType, documentId } = req.params;
    const ownsDocument = await storage.verifyDocumentOwnership(organizationId, documentType, documentId);
    if (!ownsDocument) {
      return res.status(404).json({ error: "Document not found" });
    }
    const attachments = await storage.getDocumentAttachments(documentType, documentId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

router.post("/document-attachments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertDocumentAttachmentSchema.parse(req.body);
    const ownsDocument = await storage.verifyDocumentOwnership(organizationId, validatedData.documentType, validatedData.documentId);
    if (!ownsDocument) {
      return res.status(404).json({ error: "Document not found" });
    }
    const attachment = await storage.createDocumentAttachment(validatedData);
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error creating attachment:", error);
    res.status(400).json({ error: "Failed to create attachment" });
  }
});

router.delete("/document-attachments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const attachment = await storage.getDocumentAttachment(id);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const ownsDocument = await storage.verifyDocumentOwnership(organizationId, attachment.documentType, attachment.documentId);
    if (!ownsDocument) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    await storage.deleteDocumentAttachment(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export default router;
