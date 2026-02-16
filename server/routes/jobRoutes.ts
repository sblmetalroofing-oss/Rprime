import { Router, Request, Response } from "express";
import { getOrganizationId, canUserDelete, getUserAttribution, AuthenticatedRequest } from "./middleware";
import { storage } from "../storage";
import {
  insertJobSchema,
  insertJobStatusHistorySchema,
  insertJobTemplateSchema,
  insertJobActivitySchema,
  insertAppointmentSchema,
  insertCrewChecklistSchema,
  insertChecklistItemSchema,
} from "@shared/schema";
import { getChatWebSocket } from "../websocket";
import { notifyAppointmentCreated, notifyAppointmentUpdated } from "../notification-service";

const router = Router();

router.get("/jobs", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const jobs = await storage.getAllJobs(organizationId);
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const job = await storage.getJob(organizationId, id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.get("/jobs/:id/full", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const result = await storage.getJobWithDocuments(organizationId, id);
    if (!result.job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching job with documents:", error);
    res.status(500).json({ error: "Failed to fetch job with documents" });
  }
});

router.post("/jobs", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertJobSchema.parse({ ...req.body, organizationId });
    
    let referenceNumber = validatedData.referenceNumber;
    if (!referenceNumber) {
      referenceNumber = await storage.getAndIncrementJobNumber(organizationId);
    }
    
    const data = { ...validatedData, referenceNumber };
    const job = await storage.createJob(data);
    
    res.status(201).json(job);
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(400).json({ error: "Failed to create job" });
  }
});

router.put("/jobs/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertJobSchema.partial().parse(req.body);
    const job = await storage.updateJob(organizationId, id, validatedData);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (error) {
    console.error("Error updating job:", error);
    res.status(400).json({ error: "Failed to update job" });
  }
});

router.delete("/jobs/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteJob(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting job:", error);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

router.get("/jobs/:id/status-history", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const job = await storage.getJob(organizationId, id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const history = await storage.getJobStatusHistory(organizationId, id);
    res.json(history);
  } catch (error) {
    console.error("Error fetching job status history:", error);
    res.status(500).json({ error: "Failed to fetch job status history" });
  }
});

router.post("/jobs/:id/status-history", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const job = await storage.getJob(organizationId, id);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    const dataWithId = {
      ...req.body,
      id: req.body.id || `jsh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId: id,
    };
    const validatedData = insertJobStatusHistorySchema.parse(dataWithId);
    const entry = await storage.createJobStatusHistory(organizationId, validatedData);
    res.status(201).json(entry);
  } catch (error) {
    console.error("Error creating job status history:", error);
    res.status(400).json({ error: "Failed to create job status history" });
  }
});

router.get("/job-templates", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const templates = await storage.getAllJobTemplates(organizationId);
    res.json(templates);
  } catch (error) {
    console.error("Error fetching job templates:", error);
    res.status(500).json({ error: "Failed to fetch job templates" });
  }
});

router.get("/job-templates/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const template = await storage.getJobTemplate(organizationId, id);
    if (!template) {
      return res.status(404).json({ error: "Job template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error fetching job template:", error);
    res.status(500).json({ error: "Failed to fetch job template" });
  }
});

router.post("/job-templates", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const dataWithId = {
      ...req.body,
      id: req.body.id || `jt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationId,
    };
    const validatedData = insertJobTemplateSchema.parse(dataWithId);
    const template = await storage.createJobTemplate(validatedData);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating job template:", error);
    res.status(400).json({ error: "Failed to create job template" });
  }
});

router.put("/job-templates/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const validatedData = insertJobTemplateSchema.partial().parse(req.body);
    const template = await storage.updateJobTemplate(organizationId, id, validatedData);
    if (!template) {
      return res.status(404).json({ error: "Job template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error updating job template:", error);
    res.status(400).json({ error: "Failed to update job template" });
  }
});

router.delete("/job-templates/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteJobTemplate(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting job template:", error);
    res.status(500).json({ error: "Failed to delete job template" });
  }
});

router.get("/activities/recent", async (req: Request, res: Response) => {
  try {
    const organizationId = await getOrganizationId(req as AuthenticatedRequest);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const activities = await storage.getRecentActivities(organizationId, 10);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    res.status(500).json({ error: "Failed to fetch recent activities" });
  }
});

router.get("/jobs/:id/activities", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const activities = await storage.getJobActivities(organizationId, id);
    res.json(activities);
  } catch (error) {
    console.error("Error fetching job activities:", error);
    res.status(500).json({ error: "Failed to fetch job activities" });
  }
});

router.post("/jobs/:id/activities", async (req, res) => {
  try {
    const { id } = req.params;
    
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "You must be logged in to add notes" });
    }
    
    const authReq = req as AuthenticatedRequest;
    const sessionUser = authReq.session?.user;
    const passportUser = authReq.user;
    
    const crewMembers = await storage.getAllCrewMembers(organizationId);
    const userEmail = sessionUser?.email || passportUser?.claims?.email || passportUser?.email;
    const matchingCrewMember = crewMembers.find(m => 
      m.email && userEmail && 
      m.email.toLowerCase() === userEmail.toLowerCase()
    );
    
    const claims = passportUser?.claims || {};
    const firstName = sessionUser?.firstName || claims.first_name || '';
    const lastName = sessionUser?.lastName || claims.last_name || '';
    const email = userEmail || '';
    
    const dataWithId: Record<string, unknown> = {
      ...req.body,
      id: req.body.id || `ja-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId: id,
    };
    
    if (matchingCrewMember) {
      dataWithId.createdBy = matchingCrewMember.id;
      dataWithId.createdByName = matchingCrewMember.name;
    } else {
      dataWithId.createdBy = email || null;
      const displayName = firstName 
        || (firstName && lastName ? `${firstName} ${lastName}` : null)
        || email?.split('@')[0] 
        || 'Team Member';
      dataWithId.createdByName = displayName;
    }
    
    const validatedData = insertJobActivitySchema.parse(dataWithId);
    const activity = await storage.createJobActivity(organizationId, validatedData);
    
    const content = req.body.content || '';
    const mentionPattern = /@([A-Za-z]+(?:\s+[A-Za-z]+)?)/g;
    const mentions = content.match(mentionPattern);
    
    if (mentions && mentions.length > 0) {
      const mentionedCrewIds: string[] = [];
      for (const mention of mentions) {
        const mentionName = mention.substring(1).toLowerCase();
        const mentionedMember = crewMembers.find(m => 
          m.name.toLowerCase().includes(mentionName) ||
          m.name.toLowerCase().split(' ')[0] === mentionName
        );
        if (mentionedMember && !mentionedCrewIds.includes(mentionedMember.id)) {
          mentionedCrewIds.push(mentionedMember.id);
        }
      }
      
      if (mentionedCrewIds.length > 0) {
        const channels = await storage.getAllChatChannels(organizationId);
        let generalChannel = channels.find(c => c.name.toLowerCase() === 'general');
        
        const senderId = matchingCrewMember?.id || 'system';
        const senderName = matchingCrewMember?.name || (dataWithId.createdByName as string) || 'Team Member';
        const senderColor = matchingCrewMember?.color || '#6366f1';
        
        if (!generalChannel) {
          generalChannel = await storage.createChatChannel({
            organizationId,
            name: 'general',
            description: 'General team chat and notifications',
            type: 'general',
            createdBy: senderId,
          });
        }
        
        const job = await storage.getJob(organizationId, id);
        const jobRef = job ? `${job.address || 'Job'}` : 'a job';
        
        const mentionNames = mentionedCrewIds.map(mid => {
          const m = crewMembers.find(c => c.id === mid);
          return m ? `@${m.name}` : '';
        }).filter(Boolean).join(' ');
        
        const chatContent = `${mentionNames} - Activity update on ${jobRef}: "${content.substring(0, 200)}${content.length > 200 ? '...' : ''}"`;
        
        try {
          const message = await storage.createChatMessage({
            channelId: generalChannel.id,
            senderId: senderId,
            senderName: senderName,
            senderColor: senderColor,
            content: chatContent,
          });
          
          const wss = getChatWebSocket();
          if (wss) {
            wss.broadcastNewMessage(generalChannel.id, message);
          }
          
          console.log(`[Mentions] Posted chat message for ${mentionedCrewIds.length} mention(s) in activity`);
        } catch (chatError) {
          console.error('[Mentions] Failed to create chat message:', chatError);
        }
      }
    }
    
    res.status(201).json(activity);
  } catch (error) {
    console.error("Error creating job activity:", error);
    res.status(400).json({ error: "Failed to create job activity" });
  }
});

router.delete("/job-activities/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteJobActivity(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting job activity:", error);
    res.status(500).json({ error: "Failed to delete job activity" });
  }
});

router.get("/appointments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const appointments = await storage.getAllAppointments(organizationId);
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const appointment = await storage.getAppointment(organizationId, id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

router.post("/appointments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertAppointmentSchema.parse({ ...req.body, organizationId });
    const appointment = await storage.createAppointment(validatedData);
    notifyAppointmentCreated(appointment);
    res.status(201).json(appointment);
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(400).json({ error: "Failed to create appointment" });
  }
});

router.put("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const existingAppointment = await storage.getAppointment(organizationId, id);
    const previousAssignedTo = existingAppointment?.assignedTo || null;
    const validatedData = insertAppointmentSchema.partial().parse(req.body);
    const appointment = await storage.updateAppointment(organizationId, id, validatedData);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    if (appointment) {
      notifyAppointmentUpdated(appointment, previousAssignedTo);
    }
    res.json(appointment);
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(400).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    if (!await canUserDelete(req)) {
      return res.status(403).json({ error: "Permission denied: Admin or Manager role required" });
    }
    const { id } = req.params;
    await storage.deleteAppointment(organizationId, id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting appointment:", error);
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

router.get("/jobs/:id/appointments", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const appointments = await storage.getAppointmentsByJob(organizationId, id);
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching job appointments:", error);
    res.status(500).json({ error: "Failed to fetch job appointments" });
  }
});

router.post("/appointments/batch", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { appointments } = req.body;
    if (!Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({ error: "Appointments array is required" });
    }
    const createdAppointments = await Promise.all(
      appointments.map(async (appt: Record<string, unknown>) => {
        const validatedData = insertAppointmentSchema.parse({ ...appt, organizationId });
        return storage.createAppointment(validatedData);
      })
    );
    res.status(201).json(createdAppointments);
  } catch (error) {
    console.error("Error creating batch appointments:", error);
    res.status(400).json({ error: "Failed to create appointments" });
  }
});

router.get("/jobs/:jobId/checklists", async (req, res) => {
  try {
    const { jobId } = req.params;
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const checklists = await storage.getChecklistsForJob(organizationId, jobId);
    res.json(checklists);
  } catch (error) {
    console.error("Error fetching checklists:", error);
    res.status(500).json({ error: "Failed to fetch checklists" });
  }
});

router.post("/jobs/:jobId/checklists", async (req, res) => {
  try {
    const { jobId } = req.params;
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const validatedData = insertCrewChecklistSchema.parse({ ...req.body, jobId });
    const checklist = await storage.createChecklist(organizationId, validatedData);
    res.status(201).json(checklist);
  } catch (error) {
    console.error("Error creating checklist:", error);
    res.status(400).json({ error: "Failed to create checklist" });
  }
});

router.get("/checklists/:id", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const checklist = await storage.getChecklist(organizationId, id);
    if (!checklist) {
      return res.status(404).json({ error: "Checklist not found" });
    }
    const items = await storage.getChecklistItems(organizationId, id);
    res.json({ ...checklist, items });
  } catch (error) {
    console.error("Error fetching checklist:", error);
    res.status(500).json({ error: "Failed to fetch checklist" });
  }
});

router.post("/checklists/:checklistId/items", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { checklistId } = req.params;
    const validatedData = insertChecklistItemSchema.parse({ ...req.body, checklistId });
    const item = await storage.createChecklistItem(organizationId, validatedData);
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating checklist item:", error);
    res.status(400).json({ error: "Failed to create checklist item" });
  }
});

router.put("/checklist-items/:id/check", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { checkedBy, notes } = req.body;
    const item = await storage.checkChecklistItem(organizationId, id, checkedBy, notes);
    res.json(item);
  } catch (error) {
    console.error("Error checking checklist item:", error);
    res.status(500).json({ error: "Failed to check checklist item" });
  }
});

router.put("/checklists/:id/complete", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { id } = req.params;
    const { completedBy } = req.body;
    const checklist = await storage.completeChecklist(organizationId, id, completedBy);
    res.json(checklist);
  } catch (error) {
    console.error("Error completing checklist:", error);
    res.status(500).json({ error: "Failed to complete checklist" });
  }
});

router.get("/crew/schedule", async (req, res) => {
  try {
    const organizationId = await getOrganizationId(req);
    if (!organizationId) {
      return res.status(401).json({ error: "Not authenticated or no organization" });
    }
    const { crewMemberId, date } = req.query;
    const scheduleDate = date ? String(date) : new Date().toISOString().split('T')[0];
    const jobs = await storage.getCrewSchedule(organizationId, crewMemberId as string | undefined, scheduleDate);
    res.json(jobs);
  } catch (error) {
    console.error("Error fetching crew schedule:", error);
    res.status(500).json({ error: "Failed to fetch crew schedule" });
  }
});

export default router;
