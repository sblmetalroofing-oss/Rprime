import { Router } from "express";
import { getOrganizationId, canUserDelete, getUserAttribution, AuthenticatedRequest } from "./middleware";
import { storage } from "../storage";
import { 
  insertLeadSchema, 
  insertLeadActivitySchema, 
  insertLeadReminderSchema,
  insertLeadAttachmentSchema,
  Lead
} from "@shared/schema";
import { randomUUID } from "crypto";
import { ObjectStorageService, objectStorageClient } from "../replit_integrations/object_storage";

const router = Router();
const objectStorageService = new ObjectStorageService();

router.get("/leads", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const leads = await storage.getAllLeads(organizationId);
    res.json(leads);
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({ error: "Failed to fetch leads" });
  }
});

router.get("/leads/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const lead = await storage.getLead(organizationId, id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const activities = await storage.getLeadActivities(id);
    const reminders = await storage.getLeadReminders(id);
    res.json({ ...lead, activities, reminders });
  } catch (error) {
    console.error("Error fetching lead:", error);
    res.status(500).json({ error: "Failed to fetch lead" });
  }
});

router.post("/leads", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertLeadSchema.parse({ ...req.body, organizationId });
    const data = { ...validatedData };
    const lead = await storage.createLead(data);
    res.status(201).json(lead);
  } catch (error) {
    console.error("Error creating lead:", error);
    res.status(400).json({ error: "Failed to create lead" });
  }
});

router.put("/leads/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertLeadSchema.partial().parse(req.body);
    const lead = await storage.updateLead(organizationId, id, validatedData);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    res.json(lead);
  } catch (error) {
    console.error("Error updating lead:", error);
    res.status(400).json({ error: "Failed to update lead" });
  }
});

router.delete("/leads/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteLead(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting lead:", error);
    res.status(500).json({ error: "Failed to delete lead" });
  }
});

router.post("/leads/:id/convert", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { createJob } = req.body;
    
    const lead = await storage.getLead(organizationId, id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const customerId = crypto.randomUUID();
    const customer = await storage.createCustomer({
      id: customerId,
      name: lead.name,
      email: lead.email || undefined,
      phone: lead.phone || undefined,
      address: lead.address || undefined,
      suburb: lead.suburb || undefined,
      postcode: lead.postcode || undefined,
      state: lead.state || undefined,
      notes: `Converted from lead on ${new Date().toLocaleDateString()}`,
      organizationId
    });

    let job = null;
    let attachmentsCopied = 0;
    if (createJob) {
      const jobId = crypto.randomUUID();
      const referenceNumber = await storage.getAndIncrementJobNumber(organizationId);
      job = await storage.createJob({
        id: jobId,
        customerId: customer.id,
        title: `New job for ${customer.name}`,
        address: customer.address || '',
        suburb: customer.suburb || undefined,
        status: 'scheduled',
        priority: 'normal',
        organizationId,
        referenceNumber
      });
      
      const leadAttachments = await storage.getLeadAttachments(id);
      for (const attachment of leadAttachments) {
        try {
          await storage.createJobAttachment({
            id: crypto.randomUUID(),
            jobId: job.id,
            category: attachment.category || 'other',
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            fileSize: attachment.fileSize,
            storageKey: attachment.storageKey,
            caption: attachment.caption || undefined,
            uploadedBy: attachment.uploadedBy || undefined,
            uploadedByName: attachment.uploadedByName || undefined,
          });
          attachmentsCopied++;
        } catch (err) {
          console.error('Failed to copy lead attachment to job:', err);
        }
      }
      
      await storage.updateLead(organizationId, id, { 
        stage: 'won', 
        customerId: customer.id, 
        jobId: job.id,
        convertedAt: new Date()
      } as Partial<Lead>);
    } else {
      await storage.updateLead(organizationId, id, { 
        stage: 'won', 
        customerId: customer.id,
        convertedAt: new Date()
      } as Partial<Lead>);
    }

    res.json({ customer, job, attachmentsCopied });
  } catch (error) {
    console.error("Error converting lead:", error);
    res.status(500).json({ error: "Failed to convert lead" });
  }
});

router.post("/leads/:id/create-quote", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const lead = await storage.getLead(organizationId, id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    if (lead.quoteId) {
      return res.status(400).json({ error: "Quote already created for this lead" });
    }

    let customerId = lead.customerId;
    let customer = null;
    if (!customerId) {
      customerId = randomUUID();
      customer = await storage.createCustomer({
        id: customerId,
        name: lead.name,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        address: lead.address || undefined,
        suburb: lead.suburb || undefined,
        postcode: lead.postcode || undefined,
        state: lead.state || undefined,
        notes: `Converted from lead on ${new Date().toLocaleDateString()}`,
        organizationId
      });
    }

    const quoteNumber = await storage.getAndIncrementQuoteNumber(organizationId);
    const userAttribution = await getUserAttribution(req as AuthenticatedRequest, organizationId);

    const quote = await storage.createQuote({
      id: randomUUID(),
      organizationId,
      quoteNumber,
      customerId,
      customerName: lead.name,
      customerEmail: lead.email || undefined,
      customerPhone: lead.phone || undefined,
      address: lead.address || '',
      suburb: lead.suburb || undefined,
      status: 'draft',
      description: lead.notes || undefined,
      createdBy: userAttribution.id,
      createdByName: userAttribution.name,
    });

    const leadUpdate: Partial<Lead> = {
      quoteId: quote.id,
    };
    if (!lead.customerId) {
      leadUpdate.customerId = customerId;
    }
    if (lead.stage === 'new' || lead.stage === 'contacted') {
      leadUpdate.stage = 'quoted';
    }
    await storage.updateLead(organizationId, id, leadUpdate as Partial<Lead>);

    res.status(201).json({ quote, customer });
  } catch (error) {
    console.error("Error creating quote from lead:", error);
    res.status(500).json({ error: "Failed to create quote from lead" });
  }
});

router.post("/leads/:id/convert-to-job", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const lead = await storage.getLead(organizationId, id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    if (lead.stage !== 'won') {
      return res.status(400).json({ error: "Lead must be in 'won' stage to convert to a job" });
    }
    if (lead.jobId) {
      return res.status(400).json({ error: "Job already created for this lead" });
    }

    let customerId = lead.customerId;
    if (!customerId) {
      customerId = randomUUID();
      await storage.createCustomer({
        id: customerId,
        name: lead.name,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        address: lead.address || undefined,
        suburb: lead.suburb || undefined,
        postcode: lead.postcode || undefined,
        state: lead.state || undefined,
        notes: `Converted from lead on ${new Date().toLocaleDateString()}`,
        organizationId
      });
    }

    const referenceNumber = await storage.getAndIncrementJobNumber(organizationId);
    const job = await storage.createJob({
      id: randomUUID(),
      customerId,
      title: `Job for ${lead.name}`,
      address: lead.address || '',
      suburb: lead.suburb || undefined,
      status: 'intake',
      priority: 'normal',
      organizationId,
      referenceNumber
    });

    if (lead.quoteId) {
      await storage.updateQuote(organizationId, lead.quoteId, { jobId: job.id });
    }

    let attachmentsCopied = 0;
    const leadAttachments = await storage.getLeadAttachments(id);
    for (const attachment of leadAttachments) {
      await storage.createJobAttachment({
        id: randomUUID(),
        jobId: job.id,
        category: attachment.category || 'other',
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        fileSize: attachment.fileSize,
        storageKey: attachment.storageKey,
        caption: attachment.caption || undefined,
        uploadedBy: attachment.uploadedBy || undefined,
        uploadedByName: attachment.uploadedByName || undefined,
      });
      attachmentsCopied++;
    }

    const jobLeadUpdate: Partial<Lead> = {
      jobId: job.id,
      convertedAt: new Date()
    };
    if (!lead.customerId) {
      jobLeadUpdate.customerId = customerId;
    }
    await storage.updateLead(organizationId, id, jobLeadUpdate as Partial<Lead>);

    res.status(201).json({ job, attachmentsCopied });
  } catch (error) {
    console.error("Error converting lead to job:", error);
    res.status(500).json({ error: "Failed to convert lead to job" });
  }
});

router.post("/leads/:leadId/activities", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const validatedData = insertLeadActivitySchema.parse({ ...req.body, leadId });
    const activity = await storage.createLeadActivity(validatedData);
    res.status(201).json(activity);
  } catch (error) {
    console.error("Error creating lead activity:", error);
    res.status(400).json({ error: "Failed to create lead activity" });
  }
});

router.post("/leads/:leadId/reminders", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const validatedData = insertLeadReminderSchema.parse({ ...req.body, leadId });
    const reminder = await storage.createLeadReminder(validatedData);
    res.status(201).json(reminder);
  } catch (error) {
    console.error("Error creating lead reminder:", error);
    res.status(400).json({ error: "Failed to create lead reminder" });
  }
});

router.put("/reminders/:id/complete", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const reminder = await storage.completeLeadReminder(organizationId, id);
    res.json(reminder);
  } catch (error) {
    console.error("Error completing reminder:", error);
    res.status(500).json({ error: "Failed to complete reminder" });
  }
});

router.get("/reminders/pending", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const reminders = await storage.getPendingReminders(organizationId);
    res.json(reminders);
  } catch (error) {
    console.error("Error fetching pending reminders:", error);
    res.status(500).json({ error: "Failed to fetch pending reminders" });
  }
});

router.get("/leads/:leadId/attachments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const attachments = await storage.getLeadAttachments(leadId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching lead attachments:", error);
    res.status(500).json({ error: "Failed to fetch lead attachments" });
  }
});

router.get("/leads/:leadId/attachments/count", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const count = await storage.getLeadAttachmentCount(leadId);
    res.json({ count });
  } catch (error) {
    console.error("Error fetching lead attachment count:", error);
    res.status(500).json({ error: "Failed to fetch attachment count" });
  }
});

router.post("/leads/:leadId/attachments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const { data, contentType, fileName, category = "other", caption } = req.body;
    
    if (!data || !contentType || !fileName) {
      return res.status(400).json({ error: "Missing required fields: data, contentType, fileName" });
    }
    
    const authReq = req as AuthenticatedRequest;
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    const uploadedBy = sessionUser?.email || passportUser?.email || passportUser?.claims?.email || "unknown";
    const uploadedByName = sessionUser?.firstName || passportUser?.claims?.first_name || uploadedBy;
    
    const base64Data = data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    const extension = fileName.split(".").pop() || "bin";
    const uniqueFilename = `${randomUUID()}.${extension}`;
    
    const privateDir = objectStorageService.getPrivateObjectDir();
    const objectPath = `${privateDir}/lead-attachments/${leadId}/${uniqueFilename}`;
    
    const pathParts = objectPath.split("/").filter((p: string) => p);
    const bucketName = pathParts[0];
    const objectName = pathParts.slice(1).join("/");
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    await file.save(buffer, {
      contentType,
      metadata: {
        cacheControl: "public, max-age=31536000",
        originalFileName: fileName,
      },
    });
    
    const storageKey = `/objects/lead-attachments/${leadId}/${uniqueFilename}`;
    const attachmentData = {
      id: `att_${randomUUID()}`,
      leadId,
      category,
      fileName,
      contentType,
      fileSize: buffer.length,
      storageKey,
      caption: caption || null,
      uploadedBy,
      uploadedByName,
    };
    
    const validatedData = insertLeadAttachmentSchema.parse(attachmentData);
    const attachment = await storage.createLeadAttachment(validatedData);
    
    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error uploading lead attachment:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

router.put("/attachments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const existingAttachment = await storage.getLeadAttachment(id);
    if (!existingAttachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const lead = await storage.getLead(organizationId, existingAttachment.leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    const { caption, category } = req.body;
    const attachment = await storage.updateLeadAttachment(id, { caption, category });
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    res.json(attachment);
  } catch (error) {
    console.error("Error updating attachment:", error);
    res.status(500).json({ error: "Failed to update attachment" });
  }
});

router.delete("/attachments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    
    const attachment = await storage.getLeadAttachment(id);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }
    const lead = await storage.getLead(organizationId, attachment.leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    try {
      const privateDir = objectStorageService.getPrivateObjectDir();
      const objectPath = attachment.storageKey.replace("/objects/", `${privateDir.split("/")[1]}/`);
      const pathParts = objectPath.split("/").filter((p: string) => p);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join("/");
      
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      await file.delete();
    } catch (storageError) {
      console.warn("Could not delete file from storage:", storageError);
    }
    
    await storage.deleteLeadAttachment(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

router.get("/objects/lead-attachments/:leadId/:filename", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { leadId, filename } = req.params;
    const lead = await storage.getLead(organizationId, leadId);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }
    
    const privateDir = objectStorageService.getPrivateObjectDir();
    const pathParts = privateDir.split("/").filter((p: string) => p);
    const bucketName = pathParts[0];
    const objectName = `${pathParts.slice(1).join("/")}/lead-attachments/${leadId}/${filename}`;
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }
    
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    
    const [contents] = await file.download();
    res.send(contents);
  } catch (error) {
    console.error("Error serving lead attachment:", error);
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
