import { 
  users, 
  reports, 
  findings, 
  estimateItems,
  customers,
  jobs,
  quotes,
  quoteItems,
  invoices,
  invoiceItems,
  purchaseOrders,
  purchaseOrderItems,
  items,
  jobStatusHistory,
  jobTemplates,
  jobActivities,
  crewMembers,
  emailTracking,
  leads,
  leadActivities,
  leadReminders,
  leadAttachments,
  jobAttachments,
  crewChecklists,
  checklistItems,
  offlineSyncQueue,
  suppliers,
  chatChannels,
  chatMessages,
  directMessages,
  channelReadStatus,
  pushSubscriptions,
  documentSettings,
  appSettings,
  invoicePayments,
  flashingMaterials,
  flashingOrders,
  flashingProfiles,
  flashingTemplates,
  savedLineSections,
  savedLineSectionItems,
  type User, 
  type UpsertUser,
  type Supplier,
  type InsertSupplier,
  type Report,
  type InsertReport,
  type Finding,
  type InsertFinding,
  type EstimateItem,
  type InsertEstimateItem,
  type Customer,
  type InsertCustomer,
  type Job,
  type InsertJob,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type InsertQuoteItem,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type PurchaseOrder,
  type InsertPurchaseOrder,
  type PurchaseOrderItem,
  type InsertPurchaseOrderItem,
  type Item,
  type InsertItem,
  type JobStatusHistory,
  type InsertJobStatusHistory,
  type JobTemplate,
  type InsertJobTemplate,
  type JobActivity,
  type InsertJobActivity,
  type CrewMember,
  type InsertCrewMember,
  type EmailTracking,
  type InsertEmailTracking,
  type Lead,
  type InsertLead,
  type LeadActivity,
  type InsertLeadActivity,
  type LeadReminder,
  type InsertLeadReminder,
  type LeadAttachment,
  type InsertLeadAttachment,
  type JobAttachment,
  type InsertJobAttachment,
  type CrewChecklist,
  type InsertCrewChecklist,
  type ChecklistItem,
  type InsertChecklistItem,
  type ChatChannel,
  type InsertChatChannel,
  type ChatMessage,
  type InsertChatMessage,
  type DirectMessage,
  type InsertDirectMessage,
  type ChannelReadStatus,
  type InsertChannelReadStatus,
  type PushSubscription,
  type InsertPushSubscription,
  type DocumentSettings,
  type InsertDocumentSettings,
  type InvoicePayment,
  type InsertInvoicePayment,
  documentThemes,
  type DocumentTheme,
  type InsertDocumentTheme,
  documentThemeSettings,
  type DocumentThemeSettings,
  type InsertDocumentThemeSettings,
  documentAttachments,
  type DocumentAttachment,
  type InsertDocumentAttachment,
  type FlashingMaterial,
  type InsertFlashingMaterial,
  type FlashingOrder,
  type InsertFlashingOrder,
  type FlashingProfile,
  type InsertFlashingProfile,
  type FlashingTemplate,
  type InsertFlashingTemplate,
  appointments,
  type Appointment,
  type InsertAppointment,
  xeroConnections,
  type XeroConnection,
  type InsertXeroConnection,
  xeroSyncHistory,
  type XeroSyncHistory,
  type InsertXeroSyncHistory,
  documentViewTokens,
  type DocumentViewToken,
  type InsertDocumentViewToken,
  settingsMigrations,
  type SettingsMigration,
  type InsertSettingsMigration,
  quoteTemplates,
  type QuoteTemplate,
  type InsertQuoteTemplate,
  quoteTemplateMappings,
  type QuoteTemplateMapping,
  type InsertQuoteTemplateMapping,
  roofReportExtractions,
  type RoofReportExtraction,
  type InsertRoofReportExtraction,
  mlPricingPatterns,
  type MlPricingPattern,
  type InsertMlPricingPattern,
  mlImportSessions,
  type MlImportSession,
  type InsertMlImportSession,
  feedbackEvents,
  type FeedbackEvent,
  type InsertFeedbackEvent,
  userBehaviorEvents,
  type UserBehaviorEvent,
  type InsertUserBehaviorEvent,
  notifications,
  type Notification,
  type InsertNotification,
  type SavedLineSection,
  type SavedLineSectionItem,
  type InsertSavedLineSectionItem,
} from "@shared/schema";
import { db } from "./db";
import { eq, ilike, or, desc, sql, and, lt, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { nanoid } from "nanoid";

export interface UnifiedActivity {
  id: string;
  type: string;
  documentId?: string;
  documentNumber?: string;
  jobId?: string;
  content: string;
  address?: string;
  attachments?: string[] | null;
  createdByName?: string | null;
  timestamp: Date;
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Customer methods
  getCustomer(organizationId: string, id: string): Promise<Customer | undefined>;
  getAllCustomers(organizationId: string): Promise<Customer[]>;
  searchCustomers(organizationId: string, query: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(organizationId: string, id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(organizationId: string, id: string): Promise<void>;
  
  // Supplier methods
  getSupplier(organizationId: string, id: string): Promise<Supplier | undefined>;
  getAllSuppliers(organizationId: string): Promise<Supplier[]>;
  searchSuppliers(organizationId: string, query: string): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(organizationId: string, id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(organizationId: string, id: string): Promise<void>;
  
  // Report methods
  getReport(organizationId: string, id: string): Promise<Report | undefined>;
  getAllReports(organizationId: string): Promise<Report[]>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(organizationId: string, id: string, report: Partial<InsertReport>): Promise<Report | undefined>;
  deleteReport(organizationId: string, id: string): Promise<void>;
  
  // Finding methods
  getFindings(organizationId: string, reportId: string): Promise<Finding[]>;
  createFinding(organizationId: string, finding: InsertFinding): Promise<Finding>;
  updateFinding(organizationId: string, id: string, finding: Partial<InsertFinding>): Promise<Finding | undefined>;
  deleteFinding(organizationId: string, id: string): Promise<void>;
  
  // Estimate Item methods
  getEstimateItems(organizationId: string, reportId: string): Promise<EstimateItem[]>;
  createEstimateItem(organizationId: string, item: InsertEstimateItem): Promise<EstimateItem>;
  deleteEstimateItem(organizationId: string, id: string): Promise<void>;
  
  // Job methods
  getJob(organizationId: string, id: string): Promise<Job | undefined>;
  getAllJobs(organizationId: string): Promise<Job[]>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(organizationId: string, id: string, job: Partial<InsertJob>): Promise<Job | undefined>;
  deleteJob(organizationId: string, id: string): Promise<void>;
  getJobWithDocuments(organizationId: string, id: string): Promise<{
    job: Job | undefined;
    reports: Report[];
    quotes: Quote[];
    invoices: Invoice[];
    purchaseOrders: PurchaseOrder[];
  }>;
  getReportsByJobId(organizationId: string, jobId: string): Promise<Report[]>;
  getQuotesByJobId(organizationId: string, jobId: string): Promise<Quote[]>;
  getInvoicesByJobId(organizationId: string, jobId: string): Promise<Invoice[]>;
  getPurchaseOrdersByJobId(organizationId: string, jobId: string): Promise<PurchaseOrder[]>;
  getNextJobNumber(organizationId: string): Promise<string>;
  incrementJobNumber(organizationId: string): Promise<void>;
  getAndIncrementJobNumber(organizationId: string): Promise<string>;
  
  // Quote methods
  getQuote(organizationId: string, id: string): Promise<Quote | undefined>;
  getAllQuotes(organizationId: string): Promise<Quote[]>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(organizationId: string, id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(organizationId: string, id: string): Promise<void>;
  getQuoteItems(organizationId: string, quoteId: string): Promise<QuoteItem[]>;
  createQuoteItem(organizationId: string, item: InsertQuoteItem): Promise<QuoteItem>;
  deleteQuoteItem(organizationId: string, id: string): Promise<void>;
  deleteQuoteItems(organizationId: string, quoteId: string): Promise<void>;
  getNextQuoteNumber(organizationId: string): Promise<string>;
  incrementQuoteNumber(organizationId: string): Promise<void>;
  getAndIncrementQuoteNumber(organizationId: string): Promise<string>;
  getRecentQuotesWithItems(organizationId: string, limit?: number): Promise<Array<Quote & { items: QuoteItem[] }>>;
  
  // Invoice methods
  getInvoice(organizationId: string, id: string): Promise<Invoice | undefined>;
  getAllInvoices(organizationId: string): Promise<Invoice[]>;
  getInvoiceByNumber(organizationId: string, invoiceNumber: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(organizationId: string, id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(organizationId: string, id: string): Promise<void>;
  getInvoiceItems(organizationId: string, invoiceId: string): Promise<InvoiceItem[]>;
  createInvoiceItem(organizationId: string, item: InsertInvoiceItem): Promise<InvoiceItem>;
  deleteInvoiceItem(organizationId: string, id: string): Promise<void>;
  deleteInvoiceItems(organizationId: string, invoiceId: string): Promise<void>;
  getNextInvoiceNumber(organizationId: string): Promise<string>;
  incrementInvoiceNumber(organizationId: string): Promise<void>;
  getAndIncrementInvoiceNumber(organizationId: string): Promise<string>;
  
  // Purchase Order methods
  getPurchaseOrder(organizationId: string, id: string): Promise<PurchaseOrder | undefined>;
  getAllPurchaseOrders(organizationId: string): Promise<PurchaseOrder[]>;
  createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(organizationId: string, id: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(organizationId: string, id: string): Promise<void>;
  getPurchaseOrderItems(organizationId: string, poId: string): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(organizationId: string, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(organizationId: string, id: string): Promise<void>;
  deletePurchaseOrderItems(organizationId: string, poId: string): Promise<void>;
  getNextPONumber(organizationId: string): Promise<string>;
  incrementPONumber(organizationId: string): Promise<void>;
  getAndIncrementPONumber(organizationId: string): Promise<string>;
  
  // Public access methods (no org check - for email links)
  getQuotePublic(id: string): Promise<Quote | undefined>;
  getQuoteItemsPublic(quoteId: string): Promise<QuoteItem[]>;
  updateQuotePublic(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined>;
  getInvoicePublic(id: string): Promise<Invoice | undefined>;
  getInvoiceItemsPublic(invoiceId: string): Promise<InvoiceItem[]>;
  updateInvoicePublic(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getPurchaseOrderPublic(id: string): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderItemsPublic(poId: string): Promise<PurchaseOrderItem[]>;
  getReportPublic(id: string): Promise<Report | undefined>;
  getReportFindingsPublic(reportId: string): Promise<Finding[]>;
  getDocumentSettingsPublic(organizationId: string, type: string): Promise<DocumentSettings | undefined>;
  
  // Item catalog methods
  getItem(organizationId: string, id: string): Promise<Item | undefined>;
  getAllItems(organizationId: string): Promise<Item[]>;
  searchItems(organizationId: string, query: string): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  createItems(items: InsertItem[]): Promise<Item[]>;
  updateItem(organizationId: string, id: string, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(organizationId: string, id: string): Promise<void>;
  
  // Job Status History methods
  getJobStatusHistory(organizationId: string, jobId: string): Promise<JobStatusHistory[]>;
  createJobStatusHistory(organizationId: string, data: InsertJobStatusHistory): Promise<JobStatusHistory>;
  
  // Job Template methods
  getAllJobTemplates(organizationId: string): Promise<JobTemplate[]>;
  getJobTemplate(organizationId: string, id: string): Promise<JobTemplate | undefined>;
  createJobTemplate(data: InsertJobTemplate): Promise<JobTemplate>;
  updateJobTemplate(organizationId: string, id: string, data: Partial<InsertJobTemplate>): Promise<JobTemplate | undefined>;
  deleteJobTemplate(organizationId: string, id: string): Promise<void>;
  
  // Job Activity methods
  getJobActivities(organizationId: string, jobId: string): Promise<JobActivity[]>;
  getRecentActivities(organizationId: string, limit: number): Promise<UnifiedActivity[]>;
  createJobActivity(organizationId: string, data: InsertJobActivity): Promise<JobActivity>;
  deleteJobActivity(organizationId: string, id: string): Promise<void>;
  
  // Crew Member methods
  getAllCrewMembers(organizationId: string): Promise<CrewMember[]>;
  getCrewMember(organizationId: string, id: string): Promise<CrewMember | undefined>;
  createCrewMember(data: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(organizationId: string, id: string, data: Partial<InsertCrewMember>): Promise<CrewMember | undefined>;
  deleteCrewMember(organizationId: string, id: string): Promise<void>;
  
  // Appointment methods
  getAllAppointments(organizationId: string): Promise<Appointment[]>;
  getAppointment(organizationId: string, id: string): Promise<Appointment | undefined>;
  getAppointmentsByJob(organizationId: string, jobId: string): Promise<Appointment[]>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(organizationId: string, id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(organizationId: string, id: string): Promise<void>;
  
  // Notification methods
  getNotificationsForCrewMember(organizationId: string, crewMemberId: string): Promise<Notification[]>;
  getUnreadNotificationCount(organizationId: string, crewMemberId: string): Promise<number>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(organizationId: string, id: string): Promise<void>;
  markAllNotificationsRead(organizationId: string, crewMemberId: string): Promise<void>;
  clearNotifications(organizationId: string, crewMemberId: string): Promise<void>;

  // Email Tracking methods
  createEmailTracking(data: InsertEmailTracking): Promise<EmailTracking>;
  getEmailTrackingByToken(token: string): Promise<EmailTracking | undefined>;
  getEmailTrackingByDocument(documentType: string, documentId: string): Promise<EmailTracking[]>;
  recordEmailOpen(token: string, ipAddress?: string, userAgent?: string): Promise<void>;
  
  // Lead methods
  getLead(organizationId: string, id: string): Promise<Lead | undefined>;
  getAllLeads(organizationId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(organizationId: string, id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(organizationId: string, id: string): Promise<void>;
  
  // Lead Activity methods
  getLeadActivities(leadId: string): Promise<LeadActivity[]>;
  createLeadActivity(data: InsertLeadActivity): Promise<LeadActivity>;
  
  // Lead Reminder methods
  getLeadReminders(leadId: string): Promise<LeadReminder[]>;
  createLeadReminder(data: InsertLeadReminder): Promise<LeadReminder>;
  completeLeadReminder(organizationId: string, id: string): Promise<LeadReminder | undefined>;
  getPendingReminders(organizationId: string): Promise<LeadReminder[]>;
  
  // Lead Attachment methods
  getLeadAttachments(leadId: string): Promise<LeadAttachment[]>;
  getLeadAttachment(id: string): Promise<LeadAttachment | undefined>;
  createLeadAttachment(data: InsertLeadAttachment): Promise<LeadAttachment>;
  updateLeadAttachment(id: string, data: Partial<InsertLeadAttachment>): Promise<LeadAttachment | undefined>;
  deleteLeadAttachment(id: string): Promise<void>;
  getLeadAttachmentCount(leadId: string): Promise<number>;
  
  // Job Attachment methods
  getJobAttachments(jobId: string, organizationId: string): Promise<JobAttachment[]>;
  getJobAttachment(id: string, organizationId: string): Promise<JobAttachment | undefined>;
  createJobAttachment(data: InsertJobAttachment): Promise<JobAttachment>;
  deleteJobAttachment(id: string, organizationId: string): Promise<boolean>;
  getJobAttachmentCount(jobId: string, organizationId: string): Promise<number>;
  
  // Crew Checklist methods
  getChecklistsForJob(organizationId: string, jobId: string): Promise<CrewChecklist[]>;
  getChecklist(organizationId: string, id: string): Promise<CrewChecklist | undefined>;
  createChecklist(organizationId: string, data: InsertCrewChecklist): Promise<CrewChecklist>;
  completeChecklist(organizationId: string, id: string, completedBy: string): Promise<CrewChecklist | undefined>;
  
  // Checklist Item methods
  getChecklistItems(organizationId: string, checklistId: string): Promise<ChecklistItem[]>;
  createChecklistItem(organizationId: string, data: InsertChecklistItem): Promise<ChecklistItem>;
  checkChecklistItem(organizationId: string, id: string, checkedBy: string, notes?: string): Promise<ChecklistItem | undefined>;
  
  // Crew Schedule methods
  getCrewSchedule(organizationId: string, crewMemberId?: string, date?: string): Promise<Job[]>;
  
  // Chat Channel methods
  getAllChatChannels(organizationId: string): Promise<ChatChannel[]>;
  getChatChannel(organizationId: string, id: string): Promise<ChatChannel | undefined>;
  createChatChannel(data: InsertChatChannel): Promise<ChatChannel>;
  updateChatChannel(organizationId: string, id: string, data: Partial<InsertChatChannel>): Promise<ChatChannel | undefined>;
  deleteChatChannel(organizationId: string, id: string): Promise<void>;
  
  // Chat Message methods
  getChatMessages(channelId: string, limit?: number, before?: string): Promise<ChatMessage[]>;
  getChatMessage(id: string): Promise<ChatMessage | undefined>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  updateChatMessage(id: string, data: Partial<InsertChatMessage>): Promise<ChatMessage | undefined>;
  deleteChatMessage(id: string): Promise<void>;
  pinChatMessage(id: string, isPinned: boolean): Promise<ChatMessage | undefined>;
  
  // Direct Message methods
  getDirectMessages(organizationId: string, userId1: string, userId2: string, limit?: number, before?: string): Promise<DirectMessage[]>;
  getDirectMessageConversations(organizationId: string, userId: string): Promise<{recipientId: string, recipientName: string, lastMessage: DirectMessage}[]>;
  createDirectMessage(data: InsertDirectMessage): Promise<DirectMessage>;
  markDirectMessagesRead(organizationId: string, senderId: string, recipientId: string): Promise<void>;
  getUnreadDMCount(organizationId: string, recipientId: string): Promise<number>;
  getUnreadDMCountBySender(organizationId: string, senderId: string, recipientId: string): Promise<number>;
  
  // Channel Read Status methods
  getChannelReadStatus(channelId: string, crewMemberId: string): Promise<ChannelReadStatus | undefined>;
  updateChannelReadStatus(channelId: string, crewMemberId: string): Promise<ChannelReadStatus>;
  getUnreadMessageCount(channelId: string, crewMemberId: string): Promise<number>;
  getTotalUnreadChannelMessages(organizationId: string, crewMemberId: string, since: Date): Promise<number>;
  
  // Push Subscription methods
  getPushSubscriptions(crewMemberId: string): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(id: string): Promise<void>;
  deletePushSubscriptionByEndpoint(endpoint: string): Promise<void>;
  getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined>;
  
  // Document Settings methods
  getDocumentSettings(organizationId: string, type: string): Promise<DocumentSettings | undefined>;
  upsertDocumentSettings(organizationId: string, data: InsertDocumentSettings): Promise<DocumentSettings>;
  
  // App Settings methods
  getAppSetting(organizationId: string, key: string): Promise<string | undefined>;
  setAppSetting(organizationId: string, key: string, value: string): Promise<void>;
  getAllAppSettings(organizationId: string): Promise<Record<string, string>>;
  
  // Invoice Payment methods
  getInvoicePayments(organizationId: string, invoiceId: string): Promise<InvoicePayment[]>;
  getInvoicePayment(organizationId: string, id: string): Promise<InvoicePayment | undefined>;
  createInvoicePayment(organizationId: string, data: InsertInvoicePayment): Promise<InvoicePayment>;
  deleteInvoicePayment(organizationId: string, id: string): Promise<void>;
  
  // Document ownership verification (for multi-tenant security)
  verifyDocumentOwnership(organizationId: string, documentType: string, documentId: string): Promise<boolean>;
  
  // Document Theme methods
  getAllDocumentThemes(organizationId: string): Promise<DocumentTheme[]>;
  getDocumentTheme(organizationId: string, id: string): Promise<DocumentTheme | undefined>;
  getDefaultDocumentTheme(organizationId: string): Promise<DocumentTheme | undefined>;
  createDocumentTheme(data: InsertDocumentTheme): Promise<DocumentTheme>;
  updateDocumentTheme(organizationId: string, id: string, data: Partial<InsertDocumentTheme>): Promise<DocumentTheme | undefined>;
  setDefaultDocumentTheme(organizationId: string, id: string): Promise<DocumentTheme | undefined>;
  archiveDocumentTheme(organizationId: string, id: string, archived: boolean): Promise<DocumentTheme | undefined>;
  deleteDocumentTheme(organizationId: string, id: string): Promise<void>;
  
  // Document Theme Settings methods
  getDocumentThemeSettings(themeId: string): Promise<DocumentThemeSettings[]>;
  getDocumentThemeSetting(themeId: string, documentType: string): Promise<DocumentThemeSettings | undefined>;
  upsertDocumentThemeSettings(settings: InsertDocumentThemeSettings): Promise<DocumentThemeSettings>;
  createDefaultThemeSettings(themeId: string): Promise<DocumentThemeSettings[]>;
  deleteDocumentThemeSettings(themeId: string): Promise<void>;
  
  // Document Attachment methods
  getDocumentAttachments(documentType: string, documentId: string): Promise<DocumentAttachment[]>;
  getDocumentAttachment(id: string): Promise<DocumentAttachment | undefined>;
  createDocumentAttachment(data: InsertDocumentAttachment): Promise<DocumentAttachment>;
  deleteDocumentAttachment(id: string): Promise<void>;
  deleteDocumentAttachments(documentType: string, documentId: string): Promise<void>;
  
  // Xero Integration methods
  getXeroConnection(organizationId: string): Promise<XeroConnection | undefined>;
  createXeroConnection(connection: InsertXeroConnection): Promise<XeroConnection>;
  updateXeroConnection(organizationId: string, data: Partial<InsertXeroConnection>): Promise<XeroConnection | undefined>;
  deleteXeroConnection(organizationId: string): Promise<void>;
  createXeroSyncHistory(sync: InsertXeroSyncHistory): Promise<XeroSyncHistory>;
  getXeroSyncHistory(organizationId: string, limit?: number): Promise<XeroSyncHistory[]>;
  
  // Document View Token methods
  createViewToken(documentType: string, documentId: string, expiryDays?: number): Promise<string>;
  validateViewToken(token: string): Promise<{ documentType: string; documentId: string } | null>;
  
  // Settings Migration methods
  getAllSettingsMigrations(): Promise<SettingsMigration[]>;
  getPendingSettingsMigrations(): Promise<SettingsMigration[]>;
  createSettingsMigration(data: InsertSettingsMigration): Promise<SettingsMigration>;
  updateSettingsMigrationStatus(id: string, status: string, appliedBy?: string): Promise<void>;
  clearAllSettingsMigrations(): Promise<void>;
  
  // Feedback Event methods
  createFeedbackEvent(data: InsertFeedbackEvent): Promise<FeedbackEvent>;
  getFeedbackEventById(id: string): Promise<FeedbackEvent | undefined>;
  getFeedbackEvents(organizationId: string | null, options?: { eventType?: string; severity?: string; startDate?: Date; endDate?: Date; priority?: string; userEmail?: string; limit?: number }): Promise<FeedbackEvent[]>;
  deleteOldFeedbackEvents(organizationId: string, daysOld: number): Promise<number>;
  getUnresolvedFeedbackEvents(organizationId: string | null, daysBack?: number): Promise<FeedbackEvent[]>;
  resolveFeedbackEvent(id: string): Promise<FeedbackEvent | undefined>;
  updateFeedbackEventAnalysis(id: string, analysis: string): Promise<FeedbackEvent | undefined>;
  getGroupedFeedbackEvents(organizationId: string, options?: { eventType?: string; severity?: string; resolved?: string }): Promise<Array<{
    groupId: string;
    count: number;
    latestOccurrence: Date;
    sampleMessage: string;
    eventType: string;
    severity: string;
    events: FeedbackEvent[];
  }>>;
  getFeedbackEventsByGroupId(organizationId: string, groupId: string): Promise<FeedbackEvent[]>;
  updateFeedbackEvent(id: string, data: { priority?: string; assignedTo?: string | null; resolved?: string; resolutionNotes?: string; resolvedAt?: Date; resolvedBy?: string }): Promise<FeedbackEvent | undefined>;
  
  // User Behavior Event methods
  createBehaviorEvent(event: InsertUserBehaviorEvent): Promise<UserBehaviorEvent>;
  getBehaviorEvents(organizationId: string, filters?: { eventType?: string; startDate?: Date; endDate?: Date }): Promise<UserBehaviorEvent[]>;
  getBehaviorStats(organizationId: string): Promise<{ byType: Record<string, number>; byPage: Record<string, number> }>;

  getSavedLineSections(organizationId: string): Promise<SavedLineSection[]>;
  getSavedLineSectionWithItems(organizationId: string, sectionId: string): Promise<{ section: SavedLineSection; items: SavedLineSectionItem[] } | null>;
  createSavedLineSection(organizationId: string, data: { name: string; description?: string; createdBy?: string; items: Array<Omit<InsertSavedLineSectionItem, 'sectionId'>> }): Promise<SavedLineSection>;
  deleteSavedLineSection(organizationId: string, sectionId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
  
  // Customer methods
  async getCustomer(organizationId: string, id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
    return customer || undefined;
  }

  async getAllCustomers(organizationId: string): Promise<Customer[]> {
    return await db.select().from(customers).where(eq(customers.organizationId, organizationId)).orderBy(desc(customers.createdAt));
  }

  async searchCustomers(organizationId: string, query: string): Promise<Customer[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(customers).where(
      and(
        eq(customers.organizationId, organizationId),
        or(
          ilike(customers.name, searchPattern),
          ilike(customers.email, searchPattern),
          ilike(customers.phone, searchPattern),
          ilike(customers.address, searchPattern)
        )
      )
    ).orderBy(customers.name);
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async updateCustomer(organizationId: string, id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteCustomer(organizationId: string, id: string): Promise<void> {
    // Unlink customer from related records before deletion
    await db.update(jobs).set({ customerId: null }).where(eq(jobs.customerId, id));
    await db.update(reports).set({ customerId: null }).where(eq(reports.customerId, id));
    await db.update(quotes).set({ customerId: null }).where(eq(quotes.customerId, id));
    await db.update(invoices).set({ customerId: null }).where(eq(invoices.customerId, id));
    await db.update(leads).set({ customerId: null }).where(eq(leads.customerId, id));
    await db.delete(customers).where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)));
  }
  
  // Supplier methods
  async getSupplier(organizationId: string, id: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)));
    return supplier || undefined;
  }

  async getAllSuppliers(organizationId: string): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.organizationId, organizationId)).orderBy(desc(suppliers.createdAt));
  }

  async searchSuppliers(organizationId: string, query: string): Promise<Supplier[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(suppliers).where(
      and(
        eq(suppliers.organizationId, organizationId),
        or(
          ilike(suppliers.name, searchPattern),
          ilike(suppliers.contactName, searchPattern),
          ilike(suppliers.email, searchPattern),
          ilike(suppliers.phone, searchPattern)
        )
      )
    ).orderBy(suppliers.name);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(organizationId: string, id: string, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const [updated] = await db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() })
      .where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteSupplier(organizationId: string, id: string): Promise<void> {
    await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId)));
  }
  
  // Report methods
  async getReport(organizationId: string, id: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(and(eq(reports.id, id), eq(reports.organizationId, organizationId)));
    return report || undefined;
  }

  async getAllReports(organizationId: string): Promise<Report[]> {
    return await db.select().from(reports).where(eq(reports.organizationId, organizationId)).orderBy(reports.createdAt);
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }

  async updateReport(organizationId: string, id: string, report: Partial<InsertReport>): Promise<Report | undefined> {
    const [updated] = await db
      .update(reports)
      .set({ ...report, updatedAt: new Date() })
      .where(and(eq(reports.id, id), eq(reports.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteReport(organizationId: string, id: string): Promise<void> {
    await db.delete(reports).where(and(eq(reports.id, id), eq(reports.organizationId, organizationId)));
  }
  
  // Finding methods
  async getFindings(organizationId: string, reportId: string): Promise<Finding[]> {
    // Verify report belongs to organization
    const report = await this.getReport(organizationId, reportId);
    if (!report) return [];
    return await db.select().from(findings).where(eq(findings.reportId, reportId));
  }

  async createFinding(organizationId: string, finding: InsertFinding): Promise<Finding> {
    // Verify report belongs to organization
    const report = await this.getReport(organizationId, finding.reportId);
    if (!report) throw new Error("Report not found or access denied");
    const [created] = await db.insert(findings).values(finding).returning();
    return created;
  }

  async updateFinding(organizationId: string, id: string, finding: Partial<InsertFinding>): Promise<Finding | undefined> {
    // First get the finding to check its report
    const [existingFinding] = await db.select().from(findings).where(eq(findings.id, id));
    if (!existingFinding) return undefined;
    // Verify the report belongs to the organization
    const report = await this.getReport(organizationId, existingFinding.reportId);
    if (!report) return undefined;
    // Prevent reportId from being changed (security: prevents cross-tenant injection)
    const { reportId, ...safeUpdates } = finding;
    const [updated] = await db
      .update(findings)
      .set(safeUpdates)
      .where(eq(findings.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteFinding(organizationId: string, id: string): Promise<void> {
    // First get the finding to check its report
    const [existingFinding] = await db.select().from(findings).where(eq(findings.id, id));
    if (!existingFinding) return;
    // Verify the report belongs to the organization
    const report = await this.getReport(organizationId, existingFinding.reportId);
    if (!report) throw new Error("Report not found or access denied");
    await db.delete(findings).where(eq(findings.id, id));
  }
  
  // Estimate Item methods
  async getEstimateItems(organizationId: string, reportId: string): Promise<EstimateItem[]> {
    // Verify report belongs to organization
    const report = await this.getReport(organizationId, reportId);
    if (!report) return [];
    return await db.select().from(estimateItems).where(eq(estimateItems.reportId, reportId));
  }

  async createEstimateItem(organizationId: string, item: InsertEstimateItem): Promise<EstimateItem> {
    // Verify report belongs to organization
    const report = await this.getReport(organizationId, item.reportId);
    if (!report) throw new Error("Report not found or access denied");
    const [created] = await db.insert(estimateItems).values(item).returning();
    return created;
  }

  async deleteEstimateItem(organizationId: string, id: string): Promise<void> {
    // First get the estimate item to check its report
    const [existingItem] = await db.select().from(estimateItems).where(eq(estimateItems.id, id));
    if (!existingItem) return;
    // Verify the report belongs to the organization
    const report = await this.getReport(organizationId, existingItem.reportId);
    if (!report) throw new Error("Report not found or access denied");
    await db.delete(estimateItems).where(eq(estimateItems.id, id));
  }
  
  // Job methods
  async getJob(organizationId: string, id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, id), eq(jobs.organizationId, organizationId)));
    return job || undefined;
  }

  async getAllJobs(organizationId: string): Promise<Job[]> {
    return await db.select().from(jobs).where(eq(jobs.organizationId, organizationId)).orderBy(desc(jobs.createdAt));
  }

  async createJob(job: InsertJob): Promise<Job> {
    const [created] = await db.insert(jobs).values(job).returning();
    return created;
  }

  async updateJob(organizationId: string, id: string, job: Partial<InsertJob>): Promise<Job | undefined> {
    const existingJob = await this.getJob(organizationId, id);
    
    const [updated] = await db
      .update(jobs)
      .set({ ...job, updatedAt: new Date() })
      .where(and(eq(jobs.id, id), eq(jobs.organizationId, organizationId)))
      .returning();
    
    if (updated && job.status && existingJob && job.status !== existingJob.status) {
      await this.createJobStatusHistory(organizationId, {
        id: `jsh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        jobId: id,
        fromStatus: existingJob.status,
        toStatus: job.status,
      });
    }
    
    return updated || undefined;
  }

  async deleteJob(organizationId: string, id: string): Promise<void> {
    const job = await this.getJob(organizationId, id);
    if (!job) return;

    await db.delete(quoteItems).where(
      inArray(quoteItems.quoteId, db.select({ id: quotes.id }).from(quotes).where(eq(quotes.jobId, id)))
    );
    await db.delete(quotes).where(eq(quotes.jobId, id));

    const invoiceSubquery = db.select({ id: invoices.id }).from(invoices).where(eq(invoices.jobId, id));
    await db.delete(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceSubquery));
    await db.delete(invoicePayments).where(inArray(invoicePayments.invoiceId, invoiceSubquery));
    await db.delete(invoices).where(eq(invoices.jobId, id));

    await db.delete(purchaseOrderItems).where(
      inArray(purchaseOrderItems.purchaseOrderId, db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.jobId, id)))
    );
    await db.delete(purchaseOrders).where(eq(purchaseOrders.jobId, id));

    const reportSubquery = db.select({ id: reports.id }).from(reports).where(eq(reports.jobId, id));
    await db.delete(findings).where(inArray(findings.reportId, reportSubquery));
    await db.delete(estimateItems).where(inArray(estimateItems.reportId, reportSubquery));
    await db.delete(reports).where(eq(reports.jobId, id));

    await db.delete(flashingProfiles).where(
      inArray(flashingProfiles.orderId, db.select({ id: flashingOrders.id }).from(flashingOrders).where(eq(flashingOrders.jobId, id)))
    );
    await db.delete(flashingOrders).where(eq(flashingOrders.jobId, id));

    await db.update(leads).set({ jobId: null }).where(eq(leads.jobId, id));

    await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.organizationId, organizationId)));
  }

  async getNextJobNumber(organizationId: string): Promise<string> {
    const settings = await this.getDocumentSettings(organizationId, 'job');
    const prefix = settings?.prefix || 'JOB';
    
    let nextNum = settings?.nextNumber || 1;
    if (!settings) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.organizationId, organizationId));
      nextNum = (result?.count || 0) + 1;
    }
    
    return `${prefix}-${String(nextNum).padStart(4, '0')}`;
  }
  
  async incrementJobNumber(organizationId: string): Promise<void> {
    const settings = await this.getDocumentSettings(organizationId, 'job');
    if (settings) {
      await db.update(documentSettings)
        .set({ nextNumber: (settings.nextNumber || 1) + 1, updatedAt: new Date() })
        .where(eq(documentSettings.id, settings.id));
    } else {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.organizationId, organizationId));
      const nextNum = (result?.count || 0) + 1;
      const id = randomUUID();
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'job', 
        prefix: 'JOB', 
        nextNumber: nextNum 
      });
    }
  }
  
  // Truly atomic version: uses UPDATE RETURNING to increment and fetch in a single DB call
  async getAndIncrementJobNumber(organizationId: string): Promise<string> {
    // Try atomic update with RETURNING first - this handles the common case
    // Use COALESCE to handle NULL nextNumber values (default to 1, then increment)
    const [updated] = await db.update(documentSettings)
      .set({ 
        nextNumber: sql`COALESCE(${documentSettings.nextNumber}, 1) + 1`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, 'job')
      ))
      .returning({ 
        nextNumber: documentSettings.nextNumber,
        prefix: documentSettings.prefix 
      });
    
    if (updated) {
      // nextNumber was already incremented, so the value we should use is nextNumber - 1
      const usedNum = (updated.nextNumber ?? 2) - 1;
      const prefix = updated.prefix || 'JOB';
      return `${prefix}-${String(usedNum).padStart(4, '0')}`;
    }
    
    // No settings exist - create them atomically (use ON CONFLICT to handle race condition)
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.organizationId, organizationId));
    const nextNum = (result?.count || 0) + 1;
    const id = randomUUID();
    
    try {
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'job', 
        prefix: 'JOB', 
        nextNumber: nextNum + 1  // Set to next+1 since we're using nextNum now
      });
      return `JOB-${String(nextNum).padStart(4, '0')}`;
    } catch (error: unknown) {
      // If insert failed due to race condition, retry the atomic update
      const isUniqueViolation = error && typeof error === 'object' && 'code' in error && error.code === '23505';
      if (isUniqueViolation) {
        return this.getAndIncrementJobNumber(organizationId);
      }
      throw error;
    }
  }

  async getJobWithDocuments(organizationId: string, id: string): Promise<{
    job: Job | undefined;
    reports: Report[];
    quotes: Quote[];
    invoices: Invoice[];
    purchaseOrders: PurchaseOrder[];
  }> {
    const [job, jobReports, jobQuotes, jobInvoices, jobPOs] = await Promise.all([
      this.getJob(organizationId, id),
      this.getReportsByJobId(organizationId, id),
      this.getQuotesByJobId(organizationId, id),
      this.getInvoicesByJobId(organizationId, id),
      this.getPurchaseOrdersByJobId(organizationId, id),
    ]);
    return {
      job,
      reports: jobReports,
      quotes: jobQuotes,
      invoices: jobInvoices,
      purchaseOrders: jobPOs,
    };
  }

  async getReportsByJobId(organizationId: string, jobId: string): Promise<Report[]> {
    return await db.select().from(reports).where(and(eq(reports.organizationId, organizationId), eq(reports.jobId, jobId))).orderBy(desc(reports.createdAt));
  }

  async getQuotesByJobId(organizationId: string, jobId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(and(eq(quotes.organizationId, organizationId), eq(quotes.jobId, jobId))).orderBy(desc(quotes.createdAt));
  }

  async getInvoicesByJobId(organizationId: string, jobId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(and(eq(invoices.organizationId, organizationId), eq(invoices.jobId, jobId))).orderBy(desc(invoices.createdAt));
  }

  async getPurchaseOrdersByJobId(organizationId: string, jobId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.organizationId, organizationId), eq(purchaseOrders.jobId, jobId))).orderBy(desc(purchaseOrders.createdAt));
  }
  
  // Quote methods
  async getQuote(organizationId: string, id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.organizationId, organizationId)));
    return quote || undefined;
  }

  async getAllQuotes(organizationId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.organizationId, organizationId)).orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    const [created] = await db.insert(quotes).values(quote).returning();
    return created;
  }

  async updateQuote(organizationId: string, id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db
      .update(quotes)
      .set({ ...quote, updatedAt: new Date() })
      .where(and(eq(quotes.id, id), eq(quotes.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteQuote(organizationId: string, id: string): Promise<void> {
    await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.organizationId, organizationId)));
  }

  async getQuoteItems(organizationId: string, quoteId: string): Promise<QuoteItem[]> {
    const quote = await this.getQuote(organizationId, quoteId);
    if (!quote) return [];
    return await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async createQuoteItem(organizationId: string, item: InsertQuoteItem): Promise<QuoteItem> {
    const quote = await this.getQuote(organizationId, item.quoteId);
    if (!quote) throw new Error("Quote not found or access denied");
    const [created] = await db.insert(quoteItems).values(item).returning();
    return created;
  }

  async deleteQuoteItem(organizationId: string, id: string): Promise<void> {
    const [existingItem] = await db.select().from(quoteItems).where(eq(quoteItems.id, id));
    if (!existingItem) return;
    const quote = await this.getQuote(organizationId, existingItem.quoteId);
    if (!quote) throw new Error("Quote not found or access denied");
    await db.delete(quoteItems).where(eq(quoteItems.id, id));
  }

  async getRecentQuotesWithItems(organizationId: string, limit: number = 20): Promise<Array<Quote & { items: QuoteItem[] }>> {
    const recentQuotes = await db.select()
      .from(quotes)
      .where(and(
        eq(quotes.organizationId, organizationId),
        eq(quotes.status, 'accepted')
      ))
      .orderBy(desc(quotes.acceptedAt))
      .limit(limit);
    
    if (recentQuotes.length === 0) {
      return [];
    }
    
    // Batch query: fetch all items for all quotes in one query
    const quoteIds = recentQuotes.map(q => q.id);
    const allItems = await db.select()
      .from(quoteItems)
      .where(inArray(quoteItems.quoteId, quoteIds));
    
    // Group items by quoteId in memory
    const itemsByQuoteId = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const existing = itemsByQuoteId.get(item.quoteId) || [];
      existing.push(item);
      itemsByQuoteId.set(item.quoteId, existing);
    }
    
    // Combine quotes with their items
    const quotesWithItems = recentQuotes.map(quote => ({
      ...quote,
      items: itemsByQuoteId.get(quote.id) || []
    }));
    
    return quotesWithItems;
  }

  async deleteQuoteItems(organizationId: string, quoteId: string): Promise<void> {
    const quote = await this.getQuote(organizationId, quoteId);
    if (!quote) throw new Error("Quote not found or access denied");
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }

  async getNextQuoteNumber(organizationId: string): Promise<string> {
    const settings = await this.getDocumentSettings(organizationId, 'quote');
    const prefix = settings?.prefix || 'Q';
    
    let nextNum = settings?.nextNumber || 1;
    if (!settings) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.organizationId, organizationId));
      nextNum = (result?.count || 0) + 1;
    }
    
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }
  
  async incrementQuoteNumber(organizationId: string): Promise<void> {
    const settings = await this.getDocumentSettings(organizationId, 'quote');
    if (settings) {
      await db.update(documentSettings)
        .set({ nextNumber: (settings.nextNumber || 1) + 1, updatedAt: new Date() })
        .where(eq(documentSettings.id, settings.id));
    } else {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.organizationId, organizationId));
      const nextNum = (result?.count || 0) + 1;
      const id = randomUUID();
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'quote', 
        prefix: 'Q', 
        nextNumber: nextNum 
      });
    }
  }
  
  // Truly atomic version: uses UPDATE RETURNING to increment and fetch in a single DB call
  async getAndIncrementQuoteNumber(organizationId: string): Promise<string> {
    // Try atomic update with RETURNING first
    // Use COALESCE to handle NULL nextNumber values (default to 1, then increment)
    const [updated] = await db.update(documentSettings)
      .set({ 
        nextNumber: sql`COALESCE(${documentSettings.nextNumber}, 1) + 1`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, 'quote')
      ))
      .returning({ 
        nextNumber: documentSettings.nextNumber,
        prefix: documentSettings.prefix 
      });
    
    if (updated) {
      const usedNum = (updated.nextNumber ?? 2) - 1;
      const prefix = updated.prefix || 'Q';
      return `${prefix}${String(usedNum).padStart(5, '0')}`;
    }
    
    // No settings exist - create them
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.organizationId, organizationId));
    const nextNum = (result?.count || 0) + 1;
    const id = randomUUID();
    
    try {
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'quote', 
        prefix: 'Q', 
        nextNumber: nextNum + 1
      });
      return `Q${String(nextNum).padStart(5, '0')}`;
    } catch (error: unknown) {
      const isUniqueViolation = error && typeof error === 'object' && 'code' in error && error.code === '23505';
      if (isUniqueViolation) {
        return this.getAndIncrementQuoteNumber(organizationId);
      }
      throw error;
    }
  }
  
  // Invoice methods
  async getInvoice(organizationId: string, id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)));
    return invoice || undefined;
  }

  async getAllInvoices(organizationId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.organizationId, organizationId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoiceByNumber(organizationId: string, invoiceNumber: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices)
      .where(and(
        eq(invoices.organizationId, organizationId),
        eq(invoices.invoiceNumber, invoiceNumber)
      ));
    return invoice || undefined;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async updateInvoice(organizationId: string, id: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteInvoice(organizationId: string, id: string): Promise<void> {
    await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, organizationId)));
  }

  async getInvoiceItems(organizationId: string, invoiceId: string): Promise<InvoiceItem[]> {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (!invoice) return [];
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async createInvoiceItem(organizationId: string, item: InsertInvoiceItem): Promise<InvoiceItem> {
    const invoice = await this.getInvoice(organizationId, item.invoiceId);
    if (!invoice) throw new Error("Invoice not found or access denied");
    const [created] = await db.insert(invoiceItems).values(item).returning();
    return created;
  }

  async deleteInvoiceItem(organizationId: string, id: string): Promise<void> {
    const [existingItem] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, id));
    if (!existingItem) return;
    const invoice = await this.getInvoice(organizationId, existingItem.invoiceId);
    if (!invoice) throw new Error("Invoice not found or access denied");
    await db.delete(invoiceItems).where(eq(invoiceItems.id, id));
  }

  async deleteInvoiceItems(organizationId: string, invoiceId: string): Promise<void> {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (!invoice) throw new Error("Invoice not found or access denied");
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }

  async getNextInvoiceNumber(organizationId: string): Promise<string> {
    const settings = await this.getDocumentSettings(organizationId, 'invoice');
    const prefix = settings?.prefix || 'INV';
    
    let nextNum = settings?.nextNumber || 1;
    if (!settings) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.organizationId, organizationId));
      nextNum = (result?.count || 0) + 1;
    }
    
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }
  
  async incrementInvoiceNumber(organizationId: string): Promise<void> {
    const settings = await this.getDocumentSettings(organizationId, 'invoice');
    if (settings) {
      await db.update(documentSettings)
        .set({ nextNumber: (settings.nextNumber || 1) + 1, updatedAt: new Date() })
        .where(eq(documentSettings.id, settings.id));
    } else {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.organizationId, organizationId));
      const nextNum = (result?.count || 0) + 1;
      const id = randomUUID();
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'invoice', 
        prefix: 'INV', 
        nextNumber: nextNum 
      });
    }
  }
  
  // Truly atomic version: uses UPDATE RETURNING to increment and fetch in a single DB call
  async getAndIncrementInvoiceNumber(organizationId: string): Promise<string> {
    // Try atomic update with RETURNING first
    // Use COALESCE to handle NULL nextNumber values (default to 1, then increment)
    const [updated] = await db.update(documentSettings)
      .set({ 
        nextNumber: sql`COALESCE(${documentSettings.nextNumber}, 1) + 1`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, 'invoice')
      ))
      .returning({ 
        nextNumber: documentSettings.nextNumber,
        prefix: documentSettings.prefix 
      });
    
    if (updated) {
      const usedNum = (updated.nextNumber ?? 2) - 1;
      const prefix = updated.prefix || 'INV';
      return `${prefix}${String(usedNum).padStart(5, '0')}`;
    }
    
    // No settings exist - create them
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.organizationId, organizationId));
    const nextNum = (result?.count || 0) + 1;
    const id = randomUUID();
    
    try {
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'invoice', 
        prefix: 'INV', 
        nextNumber: nextNum + 1
      });
      return `INV${String(nextNum).padStart(5, '0')}`;
    } catch (error: unknown) {
      const isUniqueViolation = error && typeof error === 'object' && 'code' in error && error.code === '23505';
      if (isUniqueViolation) {
        return this.getAndIncrementInvoiceNumber(organizationId);
      }
      throw error;
    }
  }
  
  // Purchase Order methods
  async getPurchaseOrder(organizationId: string, id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));
    return po || undefined;
  }

  async getAllPurchaseOrders(organizationId: string): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId)).orderBy(desc(purchaseOrders.createdAt));
  }

  async createPurchaseOrder(po: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const [created] = await db.insert(purchaseOrders).values(po).returning();
    return created;
  }

  async updatePurchaseOrder(organizationId: string, id: string, po: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [updated] = await db
      .update(purchaseOrders)
      .set({ ...po, updatedAt: new Date() })
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deletePurchaseOrder(organizationId: string, id: string): Promise<void> {
    await db.delete(purchaseOrders).where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, organizationId)));
  }

  async getPurchaseOrderItems(organizationId: string, poId: string): Promise<PurchaseOrderItem[]> {
    const po = await this.getPurchaseOrder(organizationId, poId);
    if (!po) return [];
    return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  }

  async createPurchaseOrderItem(organizationId: string, item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const po = await this.getPurchaseOrder(organizationId, item.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found or access denied");
    const [created] = await db.insert(purchaseOrderItems).values(item).returning();
    return created;
  }

  async deletePurchaseOrderItem(organizationId: string, id: string): Promise<void> {
    const [existingItem] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    if (!existingItem) return;
    const po = await this.getPurchaseOrder(organizationId, existingItem.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found or access denied");
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
  }

  async deletePurchaseOrderItems(organizationId: string, poId: string): Promise<void> {
    const po = await this.getPurchaseOrder(organizationId, poId);
    if (!po) throw new Error("Purchase order not found or access denied");
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  }

  async getNextPONumber(organizationId: string): Promise<string> {
    const settings = await this.getDocumentSettings(organizationId, 'purchase_order');
    const prefix = settings?.prefix || 'PO';
    
    // If no settings exist, fall back to counting existing POs
    let nextNum = settings?.nextNumber || 1;
    if (!settings) {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
      nextNum = (result?.count || 0) + 1;
    }
    
    return `${prefix}${String(nextNum).padStart(5, '0')}`;
  }
  
  async incrementPONumber(organizationId: string): Promise<void> {
    const settings = await this.getDocumentSettings(organizationId, 'purchase_order');
    if (settings) {
      await db.update(documentSettings)
        .set({ nextNumber: (settings.nextNumber || 1) + 1, updatedAt: new Date() })
        .where(eq(documentSettings.id, settings.id));
    } else {
      // Create settings with initial count based on existing POs + 2 (since we just created one)
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
      const nextNum = (result?.count || 0) + 1; // +1 because we increment after creation
      const id = randomUUID();
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'purchase_order', 
        prefix: 'PO', 
        nextNumber: nextNum 
      });
    }
  }
  
  // Truly atomic version: uses UPDATE RETURNING to increment and fetch in a single DB call
  async getAndIncrementPONumber(organizationId: string): Promise<string> {
    // Try atomic update with RETURNING first
    // Use COALESCE to handle NULL nextNumber values (default to 1, then increment)
    const [updated] = await db.update(documentSettings)
      .set({ 
        nextNumber: sql`COALESCE(${documentSettings.nextNumber}, 1) + 1`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(documentSettings.organizationId, organizationId),
        eq(documentSettings.type, 'purchase_order')
      ))
      .returning({ 
        nextNumber: documentSettings.nextNumber,
        prefix: documentSettings.prefix 
      });
    
    if (updated) {
      const usedNum = (updated.nextNumber ?? 2) - 1;
      const prefix = updated.prefix || 'PO';
      return `${prefix}${String(usedNum).padStart(5, '0')}`;
    }
    
    // No settings exist - create them
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.organizationId, organizationId));
    const nextNum = (result?.count || 0) + 1;
    const id = randomUUID();
    
    try {
      await db.insert(documentSettings).values({ 
        id, 
        organizationId, 
        type: 'purchase_order', 
        prefix: 'PO', 
        nextNumber: nextNum + 1
      });
      return `PO${String(nextNum).padStart(5, '0')}`;
    } catch (error: unknown) {
      const isUniqueViolation = error && typeof error === 'object' && 'code' in error && error.code === '23505';
      if (isUniqueViolation) {
        return this.getAndIncrementPONumber(organizationId);
      }
      throw error;
    }
  }
  
  // Public access methods (no org check - for email links)
  async getQuotePublic(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote || undefined;
  }
  
  async getQuoteItemsPublic(quoteId: string): Promise<QuoteItem[]> {
    return await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quoteId));
  }
  
  async updateQuotePublic(id: string, updates: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db.update(quotes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getInvoicePublic(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }
  
  async getInvoiceItemsPublic(invoiceId: string): Promise<InvoiceItem[]> {
    return await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
  }
  
  async updateInvoicePublic(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getPurchaseOrderPublic(id: string): Promise<PurchaseOrder | undefined> {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return po || undefined;
  }
  
  async getPurchaseOrderItemsPublic(poId: string): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
  }
  
  async getReportPublic(id: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report || undefined;
  }
  
  async getReportFindingsPublic(reportId: string): Promise<Finding[]> {
    return await db.select().from(findings).where(eq(findings.reportId, reportId));
  }
  
  async getDocumentSettingsPublic(organizationId: string, type: string): Promise<DocumentSettings | undefined> {
    const [settings] = await db.select().from(documentSettings).where(and(eq(documentSettings.organizationId, organizationId), eq(documentSettings.type, type)));
    return settings || undefined;
  }
  
  // Item catalog methods
  async getItem(organizationId: string, id: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(and(eq(items.id, id), eq(items.organizationId, organizationId)));
    return item || undefined;
  }

  async getAllItems(organizationId: string): Promise<Item[]> {
    return await db.select().from(items).where(eq(items.organizationId, organizationId)).orderBy(items.itemCode);
  }

  async searchItems(organizationId: string, query: string): Promise<Item[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(items).where(
      and(
        eq(items.organizationId, organizationId),
        or(
          ilike(items.itemCode, searchPattern),
          ilike(items.description, searchPattern),
          ilike(items.category, searchPattern),
          ilike(items.supplierName, searchPattern)
        )
      )
    ).orderBy(items.itemCode);
  }

  async createItem(item: InsertItem): Promise<Item> {
    const id = randomUUID();
    const [created] = await db.insert(items).values({ ...item, id }).returning();
    return created;
  }

  async createItems(itemsData: InsertItem[]): Promise<Item[]> {
    if (itemsData.length === 0) return [];
    const itemsWithIds = itemsData.map(item => ({ ...item, id: randomUUID() }));
    const created = await db.insert(items).values(itemsWithIds).returning();
    return created;
  }

  async updateItem(organizationId: string, id: string, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db
      .update(items)
      .set({ ...item, updatedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteItem(organizationId: string, id: string): Promise<void> {
    await db.delete(items).where(and(eq(items.id, id), eq(items.organizationId, organizationId)));
  }
  
  // Job Status History methods
  async getJobStatusHistory(organizationId: string, jobId: string): Promise<JobStatusHistory[]> {
    const job = await this.getJob(organizationId, jobId);
    if (!job) return [];
    return await db.select().from(jobStatusHistory).where(eq(jobStatusHistory.jobId, jobId)).orderBy(desc(jobStatusHistory.createdAt));
  }

  async createJobStatusHistory(organizationId: string, data: InsertJobStatusHistory): Promise<JobStatusHistory> {
    // Defense in depth: verify job belongs to organization before creating status history
    const job = await this.getJob(organizationId, data.jobId);
    if (!job) {
      throw new Error('Job not found or does not belong to organization');
    }
    const [created] = await db.insert(jobStatusHistory).values(data).returning();
    return created;
  }
  
  // Job Template methods
  async getAllJobTemplates(organizationId: string): Promise<JobTemplate[]> {
    return await db.select().from(jobTemplates).where(eq(jobTemplates.organizationId, organizationId)).orderBy(jobTemplates.name);
  }

  async getJobTemplate(organizationId: string, id: string): Promise<JobTemplate | undefined> {
    const [template] = await db.select().from(jobTemplates).where(and(eq(jobTemplates.id, id), eq(jobTemplates.organizationId, organizationId)));
    return template || undefined;
  }

  async createJobTemplate(data: InsertJobTemplate): Promise<JobTemplate> {
    const [created] = await db.insert(jobTemplates).values(data).returning();
    return created;
  }

  async updateJobTemplate(organizationId: string, id: string, data: Partial<InsertJobTemplate>): Promise<JobTemplate | undefined> {
    const [updated] = await db
      .update(jobTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(jobTemplates.id, id), eq(jobTemplates.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteJobTemplate(organizationId: string, id: string): Promise<void> {
    await db.delete(jobTemplates).where(and(eq(jobTemplates.id, id), eq(jobTemplates.organizationId, organizationId)));
  }
  
  // Job Activity methods
  async getJobActivities(organizationId: string, jobId: string): Promise<JobActivity[]> {
    const job = await this.getJob(organizationId, jobId);
    if (!job) return [];
    return await db.select().from(jobActivities).where(eq(jobActivities.jobId, jobId)).orderBy(desc(jobActivities.createdAt));
  }

  async getRecentActivities(organizationId: string, limit: number): Promise<UnifiedActivity[]> {
    const activities: UnifiedActivity[] = [];

    const jobActivityResults = await db
      .select({
        id: jobActivities.id,
        jobId: jobActivities.jobId,
        type: jobActivities.type,
        content: jobActivities.content,
        attachments: jobActivities.attachments,
        createdByName: jobActivities.createdByName,
        createdAt: jobActivities.createdAt,
        jobAddress: jobs.address,
      })
      .from(jobActivities)
      .innerJoin(jobs, eq(jobActivities.jobId, jobs.id))
      .where(eq(jobs.organizationId, organizationId))
      .orderBy(desc(jobActivities.createdAt))
      .limit(50);

    for (const a of jobActivityResults) {
      const actType = a.type === 'photo' ? 'job_photo' : 'job_note';
      const hasAttachments = a.attachments && a.attachments.length > 0;
      
      let displayContent = (a.content || '').trim();
      
      if (!displayContent || displayContent === '(Attachments)') {
        if (hasAttachments) {
          const count = a.attachments!.length;
          displayContent = count === 1 ? 'Photo uploaded' : `${count} photos uploaded`;
        } else {
          displayContent = actType === 'job_photo' ? 'Photo uploaded' : 'Note added';
        }
      } else if (/^https?:\/\/\S+$/.test(displayContent)) {
        displayContent = 'Shared a link';
      }
      
      activities.push({
        id: a.id,
        type: actType,
        jobId: a.jobId,
        content: displayContent,
        address: a.jobAddress || undefined,
        attachments: a.attachments,
        createdByName: a.createdByName,
        timestamp: a.createdAt,
      });
    }

    const quoteResults = await db
      .select()
      .from(quotes)
      .where(eq(quotes.organizationId, organizationId))
      .orderBy(desc(quotes.createdAt))
      .limit(50);

    for (const q of quoteResults) {
      activities.push({
        id: `quote-created-${q.id}`,
        type: 'quote_created',
        documentId: q.id,
        documentNumber: q.quoteNumber,
        content: `Quote ${q.quoteNumber} created for ${q.customerName}`,
        address: q.address || undefined,
        createdByName: q.createdByName || null,
        timestamp: q.createdAt,
      });

      if (q.sentAt) {
        activities.push({
          id: `quote-sent-${q.id}`,
          type: 'quote_sent',
          documentId: q.id,
          documentNumber: q.quoteNumber,
          content: `Quote ${q.quoteNumber} sent to ${q.customerName}`,
          address: q.address || undefined,
          createdByName: q.sentByName || null,
          timestamp: q.sentAt,
        });
      }

      if (q.acceptedAt) {
        activities.push({
          id: `quote-accepted-${q.id}`,
          type: 'quote_accepted',
          documentId: q.id,
          documentNumber: q.quoteNumber,
          content: `Quote ${q.quoteNumber} accepted by ${q.customerName}`,
          address: q.address || undefined,
          timestamp: q.acceptedAt,
        });
      }

      if (q.declinedAt) {
        activities.push({
          id: `quote-declined-${q.id}`,
          type: 'quote_declined',
          documentId: q.id,
          documentNumber: q.quoteNumber,
          content: `Quote ${q.quoteNumber} declined by ${q.customerName}`,
          address: q.address || undefined,
          timestamp: q.declinedAt,
        });
      }
    }

    const invoiceResults = await db
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .orderBy(desc(invoices.createdAt))
      .limit(50);

    for (const inv of invoiceResults) {
      activities.push({
        id: `invoice-created-${inv.id}`,
        type: 'invoice_created',
        documentId: inv.id,
        documentNumber: inv.invoiceNumber,
        content: `Invoice ${inv.invoiceNumber} created for ${inv.customerName}`,
        address: inv.address || undefined,
        createdByName: inv.createdByName || null,
        timestamp: inv.createdAt,
      });

      if (inv.sentAt) {
        activities.push({
          id: `invoice-sent-${inv.id}`,
          type: 'invoice_sent',
          documentId: inv.id,
          documentNumber: inv.invoiceNumber,
          content: `Invoice ${inv.invoiceNumber} sent to ${inv.customerName}`,
          address: inv.address || undefined,
          createdByName: inv.sentByName || null,
          timestamp: inv.sentAt,
        });
      }

      if (inv.paidAt) {
        activities.push({
          id: `invoice-paid-${inv.id}`,
          type: 'invoice_paid',
          documentId: inv.id,
          documentNumber: inv.invoiceNumber,
          content: `Invoice ${inv.invoiceNumber} paid by ${inv.customerName}`,
          address: inv.address || undefined,
          timestamp: inv.paidAt,
        });
      }
    }

    const poResults = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, organizationId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(50);

    for (const po of poResults) {
      activities.push({
        id: `po-created-${po.id}`,
        type: 'po_created',
        documentId: po.id,
        documentNumber: po.poNumber,
        content: `PO ${po.poNumber} created for ${po.supplier}`,
        address: po.deliveryAddress || undefined,
        createdByName: po.createdByName || null,
        timestamp: po.createdAt,
      });

      if (po.status === 'sent' && po.updatedAt) {
        activities.push({
          id: `po-sent-${po.id}`,
          type: 'po_sent',
          documentId: po.id,
          documentNumber: po.poNumber,
          content: `PO ${po.poNumber} sent to ${po.supplier}`,
          address: po.deliveryAddress || undefined,
          createdByName: po.sentByName || null,
          timestamp: po.updatedAt,
        });
      }
    }

    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, limit);
  }

  async createJobActivity(organizationId: string, data: InsertJobActivity): Promise<JobActivity> {
    const job = await this.getJob(organizationId, data.jobId);
    if (!job) throw new Error("Job not found or access denied");
    const [created] = await db.insert(jobActivities).values(data).returning();
    return created;
  }

  async deleteJobActivity(organizationId: string, id: string): Promise<void> {
    const [activity] = await db.select().from(jobActivities).where(eq(jobActivities.id, id));
    if (!activity) return;
    const job = await this.getJob(organizationId, activity.jobId);
    if (!job) throw new Error("Job not found or access denied");
    await db.delete(jobActivities).where(eq(jobActivities.id, id));
  }
  
  // Crew Member methods
  async getAllCrewMembers(organizationId: string): Promise<CrewMember[]> {
    return await db.select().from(crewMembers).where(eq(crewMembers.organizationId, organizationId)).orderBy(crewMembers.name);
  }

  async getCrewMember(organizationId: string, id: string): Promise<CrewMember | undefined> {
    const [member] = await db.select().from(crewMembers).where(and(eq(crewMembers.id, id), eq(crewMembers.organizationId, organizationId)));
    return member || undefined;
  }

  async createCrewMember(data: InsertCrewMember): Promise<CrewMember> {
    const id = randomUUID();
    const [created] = await db.insert(crewMembers).values({ ...data, id }).returning();
    return created;
  }

  async updateCrewMember(organizationId: string, id: string, data: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const [updated] = await db
      .update(crewMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(crewMembers.id, id), eq(crewMembers.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteCrewMember(organizationId: string, id: string): Promise<void> {
    await db.delete(crewMembers).where(and(eq(crewMembers.id, id), eq(crewMembers.organizationId, organizationId)));
  }
  
  // Appointment methods
  async getAllAppointments(organizationId: string): Promise<Appointment[]> {
    return await db.select().from(appointments).where(eq(appointments.organizationId, organizationId)).orderBy(desc(appointments.scheduledDate));
  }

  async getAppointment(organizationId: string, id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)));
    return appointment || undefined;
  }

  async getAppointmentsByJob(organizationId: string, jobId: string): Promise<Appointment[]> {
    return await db.select().from(appointments)
      .where(and(eq(appointments.organizationId, organizationId), eq(appointments.jobId, jobId)))
      .orderBy(appointments.scheduledDate);
  }

  async createAppointment(data: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const [created] = await db.insert(appointments).values({ ...data, id }).returning();
    return created;
  }

  async updateAppointment(organizationId: string, id: string, data: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [updated] = await db
      .update(appointments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteAppointment(organizationId: string, id: string): Promise<void> {
    await db.delete(appointments).where(and(eq(appointments.id, id), eq(appointments.organizationId, organizationId)));
  }
  
  // Notification methods
  async getNotificationsForCrewMember(organizationId: string, crewMemberId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientCrewMemberId, crewMemberId)
      )
    ).orderBy(desc(notifications.createdAt)).limit(50);
  }

  async getUnreadNotificationCount(organizationId: string, crewMemberId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientCrewMemberId, crewMemberId),
        eq(notifications.read, 'false')
      )
    );
    return Number(result[0]?.count || 0);
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const id = nanoid();
    const [notification] = await db.insert(notifications).values({ ...data, id }).returning();
    return notification;
  }

  async markNotificationRead(organizationId: string, id: string): Promise<void> {
    await db.update(notifications)
      .set({ read: 'true' })
      .where(and(eq(notifications.id, id), eq(notifications.organizationId, organizationId)));
  }

  async markAllNotificationsRead(organizationId: string, crewMemberId: string): Promise<void> {
    await db.update(notifications)
      .set({ read: 'true' })
      .where(and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientCrewMemberId, crewMemberId)
      ));
  }

  async clearNotifications(organizationId: string, crewMemberId: string): Promise<void> {
    await db.delete(notifications).where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.recipientCrewMemberId, crewMemberId)
      )
    );
  }

  // Email Tracking methods
  async createEmailTracking(data: InsertEmailTracking): Promise<EmailTracking> {
    const [created] = await db.insert(emailTracking).values(data).returning();
    return created;
  }

  async getEmailTrackingByToken(token: string): Promise<EmailTracking | undefined> {
    const [tracking] = await db.select().from(emailTracking).where(eq(emailTracking.trackingToken, token));
    return tracking || undefined;
  }

  async getEmailTrackingByDocument(documentType: string, documentId: string): Promise<EmailTracking[]> {
    return await db.select().from(emailTracking)
      .where(sql`${emailTracking.documentType} = ${documentType} AND ${emailTracking.documentId} = ${documentId}`)
      .orderBy(desc(emailTracking.sentAt));
  }

  async recordEmailOpen(token: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const tracking = await this.getEmailTrackingByToken(token);
    if (!tracking) return;
    
    const now = new Date();
    await db.update(emailTracking)
      .set({
        openedAt: tracking.openedAt || now,
        openCount: (tracking.openCount || 0) + 1,
        lastOpenedAt: now,
        ipAddress: ipAddress || tracking.ipAddress,
        userAgent: userAgent || tracking.userAgent,
      })
      .where(eq(emailTracking.trackingToken, token));
  }
  
  // Lead methods
  async getLead(organizationId: string, id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));
    return lead || undefined;
  }

  async getAllLeads(organizationId: string): Promise<Lead[]> {
    return await db.select().from(leads).where(eq(leads.organizationId, organizationId)).orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const id = randomUUID();
    const [created] = await db.insert(leads).values({ ...lead, id }).returning();
    return created;
  }

  async updateLead(organizationId: string, id: string, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updated] = await db
      .update(leads)
      .set({ ...lead, updatedAt: new Date() })
      .where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }

  async deleteLead(organizationId: string, id: string): Promise<void> {
    await db.delete(leads).where(and(eq(leads.id, id), eq(leads.organizationId, organizationId)));
  }
  
  // Lead Activity methods
  async getLeadActivities(leadId: string): Promise<LeadActivity[]> {
    return await db.select().from(leadActivities).where(eq(leadActivities.leadId, leadId)).orderBy(desc(leadActivities.createdAt));
  }

  async createLeadActivity(data: InsertLeadActivity): Promise<LeadActivity> {
    const id = randomUUID();
    const [created] = await db.insert(leadActivities).values({ ...data, id }).returning();
    return created;
  }
  
  // Lead Reminder methods
  async getLeadReminders(leadId: string): Promise<LeadReminder[]> {
    return await db.select().from(leadReminders).where(eq(leadReminders.leadId, leadId)).orderBy(desc(leadReminders.reminderDate));
  }

  async createLeadReminder(data: InsertLeadReminder): Promise<LeadReminder> {
    const id = randomUUID();
    const [created] = await db.insert(leadReminders).values({ ...data, id }).returning();
    return created;
  }

  async completeLeadReminder(organizationId: string, id: string): Promise<LeadReminder | undefined> {
    const [reminder] = await db.select().from(leadReminders).where(eq(leadReminders.id, id));
    if (!reminder) return undefined;
    const lead = await this.getLead(organizationId, reminder.leadId);
    if (!lead) return undefined;
    const [updated] = await db
      .update(leadReminders)
      .set({ isCompleted: 'true', completedAt: new Date() })
      .where(eq(leadReminders.id, id))
      .returning();
    return updated || undefined;
  }

  async getPendingReminders(organizationId: string): Promise<LeadReminder[]> {
    return await db.select({
      id: leadReminders.id,
      leadId: leadReminders.leadId,
      reminderDate: leadReminders.reminderDate,
      message: leadReminders.message,
      isCompleted: leadReminders.isCompleted,
      completedAt: leadReminders.completedAt,
      createdAt: leadReminders.createdAt,
    }).from(leadReminders)
      .innerJoin(leads, eq(leadReminders.leadId, leads.id))
      .where(and(
        eq(leadReminders.isCompleted, 'false'),
        lt(leadReminders.reminderDate, new Date()),
        eq(leads.organizationId, organizationId)
      ))
      .orderBy(leadReminders.reminderDate);
  }
  
  // Lead Attachment methods
  async getLeadAttachments(leadId: string): Promise<LeadAttachment[]> {
    return await db.select().from(leadAttachments).where(eq(leadAttachments.leadId, leadId)).orderBy(desc(leadAttachments.createdAt));
  }

  async getLeadAttachment(id: string): Promise<LeadAttachment | undefined> {
    const [attachment] = await db.select().from(leadAttachments).where(eq(leadAttachments.id, id));
    return attachment || undefined;
  }

  async createLeadAttachment(data: InsertLeadAttachment): Promise<LeadAttachment> {
    const [created] = await db.insert(leadAttachments).values(data).returning();
    return created;
  }

  async updateLeadAttachment(id: string, data: Partial<InsertLeadAttachment>): Promise<LeadAttachment | undefined> {
    const [updated] = await db
      .update(leadAttachments)
      .set(data)
      .where(eq(leadAttachments.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLeadAttachment(id: string): Promise<void> {
    await db.delete(leadAttachments).where(eq(leadAttachments.id, id));
  }

  async getLeadAttachmentCount(leadId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(leadAttachments).where(eq(leadAttachments.leadId, leadId));
    return Number(result[0]?.count || 0);
  }
  
  // Job Attachment methods
  async getJobAttachments(jobId: string, organizationId: string): Promise<JobAttachment[]> {
    const job = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId))).limit(1);
    if (!job.length) return [];
    return await db.select().from(jobAttachments).where(eq(jobAttachments.jobId, jobId)).orderBy(desc(jobAttachments.createdAt));
  }

  async getJobAttachment(id: string, organizationId: string): Promise<JobAttachment | undefined> {
    const [attachment] = await db.select().from(jobAttachments).where(eq(jobAttachments.id, id));
    if (!attachment) return undefined;
    const job = await db.select().from(jobs).where(and(eq(jobs.id, attachment.jobId), eq(jobs.organizationId, organizationId))).limit(1);
    if (!job.length) return undefined;
    return attachment;
  }

  async createJobAttachment(data: InsertJobAttachment): Promise<JobAttachment> {
    const [created] = await db.insert(jobAttachments).values(data).returning();
    return created;
  }

  async deleteJobAttachment(id: string, organizationId: string): Promise<boolean> {
    const attachment = await this.getJobAttachment(id, organizationId);
    if (!attachment) return false;
    await db.delete(jobAttachments).where(eq(jobAttachments.id, id));
    return true;
  }

  async getJobAttachmentCount(jobId: string, organizationId: string): Promise<number> {
    const job = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.organizationId, organizationId))).limit(1);
    if (!job.length) return 0;
    const result = await db.select({ count: sql<number>`count(*)` }).from(jobAttachments).where(eq(jobAttachments.jobId, jobId));
    return Number(result[0]?.count || 0);
  }
  
  // Crew Checklist methods
  async getChecklistsForJob(organizationId: string, jobId: string): Promise<CrewChecklist[]> {
    const job = await this.getJob(organizationId, jobId);
    if (!job) return [];
    return await db.select().from(crewChecklists).where(eq(crewChecklists.jobId, jobId)).orderBy(desc(crewChecklists.createdAt));
  }

  async getChecklist(organizationId: string, id: string): Promise<CrewChecklist | undefined> {
    const [checklist] = await db.select().from(crewChecklists).where(eq(crewChecklists.id, id));
    if (!checklist) return undefined;
    const job = await this.getJob(organizationId, checklist.jobId);
    if (!job) return undefined;
    return checklist;
  }

  async createChecklist(organizationId: string, data: InsertCrewChecklist): Promise<CrewChecklist> {
    const job = await this.getJob(organizationId, data.jobId);
    if (!job) throw new Error("Job not found or access denied");
    const id = randomUUID();
    const [created] = await db.insert(crewChecklists).values({ ...data, id }).returning();
    return created;
  }

  async completeChecklist(organizationId: string, id: string, completedBy: string): Promise<CrewChecklist | undefined> {
    const checklist = await this.getChecklist(organizationId, id);
    if (!checklist) return undefined;
    const [updated] = await db
      .update(crewChecklists)
      .set({ isCompleted: 'true', completedBy, completedAt: new Date() })
      .where(eq(crewChecklists.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Checklist Item methods
  async getChecklistItems(organizationId: string, checklistId: string): Promise<ChecklistItem[]> {
    const checklist = await this.getChecklist(organizationId, checklistId);
    if (!checklist) return [];
    return await db.select().from(checklistItems).where(eq(checklistItems.checklistId, checklistId)).orderBy(checklistItems.sortOrder);
  }

  async createChecklistItem(organizationId: string, data: InsertChecklistItem): Promise<ChecklistItem> {
    const checklist = await this.getChecklist(organizationId, data.checklistId);
    if (!checklist) throw new Error("Checklist not found or access denied");
    const id = randomUUID();
    const [created] = await db.insert(checklistItems).values({ ...data, id }).returning();
    return created;
  }

  async checkChecklistItem(organizationId: string, id: string, checkedBy: string, notes?: string): Promise<ChecklistItem | undefined> {
    const [item] = await db.select().from(checklistItems).where(eq(checklistItems.id, id));
    if (!item) return undefined;
    const checklist = await this.getChecklist(organizationId, item.checklistId);
    if (!checklist) return undefined;
    const [updated] = await db
      .update(checklistItems)
      .set({ isChecked: 'true', checkedBy, checkedAt: new Date(), notes: notes || null })
      .where(eq(checklistItems.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Crew Schedule methods
  async getCrewSchedule(organizationId: string, crewMemberId?: string, date?: string): Promise<Job[]> {
    const conditions: ReturnType<typeof eq>[] = [eq(jobs.organizationId, organizationId)];
    
    if (date) {
      conditions.push(eq(jobs.scheduledDate, date));
    }
    
    const allJobs = await db.select().from(jobs).where(and(...conditions)).orderBy(jobs.scheduledTime);
    
    if (crewMemberId) {
      return allJobs.filter(job => job.assignedTo?.includes(crewMemberId));
    }
    
    return allJobs;
  }
  
  // Chat Channel methods
  async getAllChatChannels(organizationId: string): Promise<ChatChannel[]> {
    return await db.select().from(chatChannels).where(and(eq(chatChannels.isArchived, false), eq(chatChannels.organizationId, organizationId))).orderBy(chatChannels.createdAt);
  }
  
  async getChatChannel(organizationId: string, id: string): Promise<ChatChannel | undefined> {
    const [channel] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.organizationId, organizationId)));
    return channel || undefined;
  }
  
  async createChatChannel(data: InsertChatChannel & { id?: string }): Promise<ChatChannel> {
    const id = data.id || randomUUID();
    const [created] = await db.insert(chatChannels).values({ ...data, id }).returning();
    return created;
  }
  
  async updateChatChannel(organizationId: string, id: string, data: Partial<InsertChatChannel>): Promise<ChatChannel | undefined> {
    const [updated] = await db.update(chatChannels).set({ ...data, updatedAt: new Date() }).where(and(eq(chatChannels.id, id), eq(chatChannels.organizationId, organizationId))).returning();
    return updated || undefined;
  }
  
  async deleteChatChannel(organizationId: string, id: string): Promise<void> {
    await db.delete(chatChannels).where(and(eq(chatChannels.id, id), eq(chatChannels.organizationId, organizationId)));
  }
  
  // Chat Message methods
  async getChatMessages(channelId: string, limit: number = 50, before?: string): Promise<ChatMessage[]> {
    let whereCondition = eq(chatMessages.channelId, channelId);
    
    if (before) {
      const [beforeMsg] = await db.select().from(chatMessages).where(eq(chatMessages.id, before));
      if (beforeMsg) {
        whereCondition = and(eq(chatMessages.channelId, channelId), lt(chatMessages.createdAt, beforeMsg.createdAt)) as typeof whereCondition;
      }
    }
    
    const messages = await db.select().from(chatMessages)
      .where(whereCondition)
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return messages.reverse();
  }
  
  async getChatMessage(id: string): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message || undefined;
  }
  
  async createChatMessage(data: InsertChatMessage & { id?: string }): Promise<ChatMessage> {
    const id = data.id || randomUUID();
    const [created] = await db.insert(chatMessages).values({ ...data, id }).returning();
    return created;
  }
  
  async updateChatMessage(id: string, data: Partial<InsertChatMessage>): Promise<ChatMessage | undefined> {
    const [updated] = await db.update(chatMessages).set({ ...data, isEdited: true, updatedAt: new Date() }).where(eq(chatMessages.id, id)).returning();
    return updated || undefined;
  }
  
  async deleteChatMessage(id: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.id, id));
  }
  
  async pinChatMessage(id: string, isPinned: boolean): Promise<ChatMessage | undefined> {
    const [updated] = await db.update(chatMessages).set({ isPinned }).where(eq(chatMessages.id, id)).returning();
    return updated || undefined;
  }
  
  // Direct Message methods
  async getDirectMessages(organizationId: string, userId1: string, userId2: string, limit: number = 50, before?: string): Promise<DirectMessage[]> {
    let query = db.select().from(directMessages)
      .where(
        and(
          eq(directMessages.organizationId, organizationId),
          or(
            and(eq(directMessages.senderId, userId1), eq(directMessages.recipientId, userId2)),
            and(eq(directMessages.senderId, userId2), eq(directMessages.recipientId, userId1))
          )
        )
      )
      .orderBy(desc(directMessages.createdAt))
      .limit(limit);
    
    if (before) {
      const beforeMessage = await db.select().from(directMessages).where(eq(directMessages.id, before));
      if (beforeMessage.length > 0) {
        query = db.select().from(directMessages)
          .where(
            and(
              eq(directMessages.organizationId, organizationId),
              or(
                and(eq(directMessages.senderId, userId1), eq(directMessages.recipientId, userId2)),
                and(eq(directMessages.senderId, userId2), eq(directMessages.recipientId, userId1))
              ),
              lt(directMessages.createdAt, beforeMessage[0].createdAt)
            )
          )
          .orderBy(desc(directMessages.createdAt))
          .limit(limit);
      }
    }
    
    const messages = await query;
    return messages.reverse();
  }
  
  async getDirectMessageConversations(organizationId: string, userId: string): Promise<{recipientId: string, recipientName: string, lastMessage: DirectMessage}[]> {
    const sent = await db.select().from(directMessages)
      .where(and(eq(directMessages.organizationId, organizationId), eq(directMessages.senderId, userId)))
      .orderBy(desc(directMessages.createdAt));
    const received = await db.select().from(directMessages)
      .where(and(eq(directMessages.organizationId, organizationId), eq(directMessages.recipientId, userId)))
      .orderBy(desc(directMessages.createdAt));
    
    const all = [...sent, ...received].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const conversationMap = new Map<string, DirectMessage>();
    for (const msg of all) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }
    
    return Array.from(conversationMap.entries()).map(([recipientId, lastMessage]) => ({
      recipientId,
      recipientName: lastMessage.senderId === userId ? lastMessage.senderName : lastMessage.senderName,
      lastMessage
    }));
  }
  
  async createDirectMessage(data: InsertDirectMessage & { id?: string }): Promise<DirectMessage> {
    const id = data.id || randomUUID();
    const [created] = await db.insert(directMessages).values({ ...data, id }).returning();
    return created;
  }
  
  async markDirectMessagesRead(organizationId: string, senderId: string, recipientId: string): Promise<void> {
    await db.update(directMessages)
      .set({ isRead: true })
      .where(and(
        eq(directMessages.organizationId, organizationId),
        eq(directMessages.senderId, senderId), 
        eq(directMessages.recipientId, recipientId)
      ));
  }
  
  async getUnreadDMCount(organizationId: string, recipientId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(directMessages)
      .where(and(
        eq(directMessages.organizationId, organizationId),
        eq(directMessages.recipientId, recipientId), 
        eq(directMessages.isRead, false)
      ));
    return result[0]?.count || 0;
  }
  
  async getUnreadDMCountBySender(organizationId: string, senderId: string, recipientId: string): Promise<number> {
    const unread = await db.select().from(directMessages)
      .where(and(
        eq(directMessages.organizationId, organizationId),
        eq(directMessages.senderId, senderId),
        eq(directMessages.recipientId, recipientId), 
        eq(directMessages.isRead, false)
      ));
    return unread.length;
  }
  
  // Channel Read Status methods
  async getChannelReadStatus(channelId: string, crewMemberId: string): Promise<ChannelReadStatus | undefined> {
    const [status] = await db.select().from(channelReadStatus)
      .where(and(eq(channelReadStatus.channelId, channelId), eq(channelReadStatus.crewMemberId, crewMemberId)));
    return status || undefined;
  }
  
  async updateChannelReadStatus(channelId: string, crewMemberId: string): Promise<ChannelReadStatus> {
    const existing = await this.getChannelReadStatus(channelId, crewMemberId);
    if (existing) {
      const [updated] = await db.update(channelReadStatus)
        .set({ lastReadAt: new Date() })
        .where(eq(channelReadStatus.id, existing.id))
        .returning();
      return updated;
    } else {
      const id = randomUUID();
      const [created] = await db.insert(channelReadStatus).values({ id, channelId, crewMemberId }).returning();
      return created;
    }
  }
  
  async getUnreadMessageCount(channelId: string, crewMemberId: string): Promise<number> {
    const status = await this.getChannelReadStatus(channelId, crewMemberId);
    if (!status) {
      const all = await db.select().from(chatMessages).where(eq(chatMessages.channelId, channelId));
      return all.length;
    }
    
    const unread = await db.select().from(chatMessages)
      .where(and(
        eq(chatMessages.channelId, channelId),
        sql`${chatMessages.createdAt} > ${status.lastReadAt}`
      ));
    return unread.length;
  }
  
  async getTotalUnreadChannelMessages(organizationId: string, crewMemberId: string, since: Date): Promise<number> {
    const channels = await this.getAllChatChannels(organizationId);
    if (channels.length === 0) return 0;
    
    const channelIds = channels.map(c => c.id);

    const readStatuses = await db.select()
      .from(channelReadStatus)
      .where(and(
        inArray(channelReadStatus.channelId, channelIds),
        eq(channelReadStatus.crewMemberId, crewMemberId)
      ));

    const readMap = new Map(readStatuses.map(rs => [rs.channelId, rs.lastReadAt]));

    let total = 0;
    for (const channelId of channelIds) {
      const lastRead = readMap.get(channelId) || since;
      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(chatMessages)
        .where(and(
          eq(chatMessages.channelId, channelId),
          sql`${chatMessages.createdAt} > ${lastRead}`,
          sql`${chatMessages.senderId} != ${crewMemberId}`
        ));
      total += result[0]?.count || 0;
    }
    
    return total;
  }

  // Push Subscription methods
  async getPushSubscriptions(crewMemberId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.crewMemberId, crewMemberId));
  }
  
  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }
  
  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, data.endpoint));
    
    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set({ crewMemberId: data.crewMemberId, p256dh: data.p256dh, auth: data.auth })
        .where(eq(pushSubscriptions.endpoint, data.endpoint))
        .returning();
      return updated;
    }
    
    const id = randomUUID();
    const [created] = await db.insert(pushSubscriptions).values({ id, ...data }).returning();
    return created;
  }
  
  async deletePushSubscription(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  }
  
  async deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getPushSubscriptionByEndpoint(endpoint: string): Promise<PushSubscription | undefined> {
    const [sub] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1);
    return sub || undefined;
  }
  
  // Document Settings methods
  async getDocumentSettings(organizationId: string, type: string): Promise<DocumentSettings | undefined> {
    const [settings] = await db.select().from(documentSettings).where(and(eq(documentSettings.organizationId, organizationId), eq(documentSettings.type, type)));
    return settings || undefined;
  }
  
  async upsertDocumentSettings(organizationId: string, data: InsertDocumentSettings & { id?: string }): Promise<DocumentSettings> {
    const existing = await this.getDocumentSettings(organizationId, data.type);
    if (existing) {
      const [updated] = await db.update(documentSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(documentSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const id = data.id || randomUUID();
      const [created] = await db.insert(documentSettings).values({ ...data, id, organizationId }).returning();
      return created;
    }
  }
  
  // App Settings methods
  async getAppSetting(organizationId: string, key: string): Promise<string | undefined> {
    const [setting] = await db.select().from(appSettings).where(and(eq(appSettings.organizationId, organizationId), eq(appSettings.key, key)));
    return setting?.value;
  }
  
  async setAppSetting(organizationId: string, key: string, value: string): Promise<void> {
    const existing = await this.getAppSetting(organizationId, key);
    if (existing !== undefined) {
      await db.update(appSettings)
        .set({ value, updatedAt: new Date() })
        .where(and(eq(appSettings.organizationId, organizationId), eq(appSettings.key, key)));
    } else {
      await db.insert(appSettings).values({ id: randomUUID(), organizationId, key, value });
    }
  }
  
  async getAllAppSettings(organizationId: string): Promise<Record<string, string>> {
    const settings = await db.select().from(appSettings).where(eq(appSettings.organizationId, organizationId));
    return settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
  }
  
  // Invoice Payment methods
  async getInvoicePayments(organizationId: string, invoiceId: string): Promise<InvoicePayment[]> {
    const invoice = await this.getInvoice(organizationId, invoiceId);
    if (!invoice) return [];
    return db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, invoiceId)).orderBy(desc(invoicePayments.createdAt));
  }
  
  async getInvoicePayment(organizationId: string, id: string): Promise<InvoicePayment | undefined> {
    const [payment] = await db.select().from(invoicePayments).where(eq(invoicePayments.id, id));
    if (!payment) return undefined;
    const invoice = await this.getInvoice(organizationId, payment.invoiceId);
    if (!invoice) return undefined;
    return payment;
  }
  
  async createInvoicePayment(organizationId: string, data: InsertInvoicePayment): Promise<InvoicePayment> {
    const invoice = await this.getInvoice(organizationId, data.invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found or does not belong to organization');
    }
    const id = data.id || randomUUID();
    const [created] = await db.insert(invoicePayments).values({ ...data, id }).returning();
    return created;
  }
  
  async deleteInvoicePayment(organizationId: string, id: string): Promise<void> {
    const [payment] = await db.select().from(invoicePayments).where(eq(invoicePayments.id, id));
    if (!payment) return;
    const invoice = await this.getInvoice(organizationId, payment.invoiceId);
    if (!invoice) throw new Error('Invoice not found or access denied');
    await db.delete(invoicePayments).where(eq(invoicePayments.id, id));
  }
  
  // Document ownership verification for multi-tenant security
  async verifyDocumentOwnership(organizationId: string, documentType: string, documentId: string): Promise<boolean> {
    switch (documentType) {
      case 'quote': {
        const quote = await this.getQuote(organizationId, documentId);
        return !!quote;
      }
      case 'invoice': {
        const invoice = await this.getInvoice(organizationId, documentId);
        return !!invoice;
      }
      case 'purchase_order': {
        const po = await this.getPurchaseOrder(organizationId, documentId);
        return !!po;
      }
      case 'job': {
        const job = await this.getJob(organizationId, documentId);
        return !!job;
      }
      case 'report': {
        const [report] = await db.select().from(reports).where(and(eq(reports.id, documentId), eq(reports.organizationId, organizationId)));
        return !!report;
      }
      default:
        return false;
    }
  }
  
  // Document Theme methods
  async getAllDocumentThemes(organizationId: string): Promise<DocumentTheme[]> {
    return db.select().from(documentThemes).where(eq(documentThemes.organizationId, organizationId)).orderBy(desc(documentThemes.createdAt));
  }
  
  async getDocumentTheme(organizationId: string, id: string): Promise<DocumentTheme | undefined> {
    const [theme] = await db.select().from(documentThemes).where(and(eq(documentThemes.id, id), eq(documentThemes.organizationId, organizationId)));
    return theme || undefined;
  }
  
  async getDefaultDocumentTheme(organizationId: string): Promise<DocumentTheme | undefined> {
    const [theme] = await db.select().from(documentThemes).where(and(eq(documentThemes.organizationId, organizationId), eq(documentThemes.isDefault, 'true')));
    return theme || undefined;
  }
  
  async createDocumentTheme(data: InsertDocumentTheme): Promise<DocumentTheme> {
    const id = randomUUID();
    // If this is the first theme or marked as default, ensure only one default within the organization
    if (data.isDefault === 'true' && data.organizationId) {
      await db.update(documentThemes).set({ isDefault: 'false' }).where(and(eq(documentThemes.organizationId, data.organizationId), eq(documentThemes.isDefault, 'true')));
    }
    const [created] = await db.insert(documentThemes).values({ ...data, id }).returning();
    return created;
  }
  
  async updateDocumentTheme(organizationId: string, id: string, data: Partial<InsertDocumentTheme>): Promise<DocumentTheme | undefined> {
    const [updated] = await db.update(documentThemes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(documentThemes.id, id), eq(documentThemes.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  
  async setDefaultDocumentTheme(organizationId: string, id: string): Promise<DocumentTheme | undefined> {
    // Unset all other defaults within the organization
    await db.update(documentThemes).set({ isDefault: 'false' }).where(and(eq(documentThemes.organizationId, organizationId), eq(documentThemes.isDefault, 'true')));
    // Set this one as default
    const [updated] = await db.update(documentThemes)
      .set({ isDefault: 'true', updatedAt: new Date() })
      .where(and(eq(documentThemes.id, id), eq(documentThemes.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  
  async archiveDocumentTheme(organizationId: string, id: string, archived: boolean): Promise<DocumentTheme | undefined> {
    const [updated] = await db.update(documentThemes)
      .set({ isArchived: archived ? 'true' : 'false', updatedAt: new Date() })
      .where(and(eq(documentThemes.id, id), eq(documentThemes.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  
  async deleteDocumentTheme(organizationId: string, id: string): Promise<void> {
    await db.delete(documentThemes).where(and(eq(documentThemes.id, id), eq(documentThemes.organizationId, organizationId)));
  }
  
  // Document Theme Settings methods
  async getDocumentThemeSettings(themeId: string): Promise<DocumentThemeSettings[]> {
    return db.select().from(documentThemeSettings).where(eq(documentThemeSettings.themeId, themeId));
  }
  
  async getDocumentThemeSetting(themeId: string, documentType: string): Promise<DocumentThemeSettings | undefined> {
    const [setting] = await db.select().from(documentThemeSettings)
      .where(and(eq(documentThemeSettings.themeId, themeId), eq(documentThemeSettings.documentType, documentType)));
    return setting || undefined;
  }
  
  async upsertDocumentThemeSettings(settings: InsertDocumentThemeSettings): Promise<DocumentThemeSettings> {
    const existing = await this.getDocumentThemeSetting(settings.themeId, settings.documentType);
    if (existing) {
      const [updated] = await db.update(documentThemeSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(documentThemeSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const id = randomUUID();
      const [created] = await db.insert(documentThemeSettings).values({ ...settings, id }).returning();
      return created;
    }
  }
  
  async createDefaultThemeSettings(themeId: string): Promise<DocumentThemeSettings[]> {
    const documentTypes = ['quote', 'invoice', 'purchase_order'];
    const defaults: Record<string, { documentTitle: string; draftTitle: string }> = {
      quote: { documentTitle: 'QUOTE', draftTitle: 'DRAFT QUOTE' },
      invoice: { documentTitle: 'TAX INVOICE', draftTitle: 'DRAFT INVOICE' },
      purchase_order: { documentTitle: 'PURCHASE ORDER', draftTitle: 'DRAFT PURCHASE ORDER' }
    };
    
    const results: DocumentThemeSettings[] = [];
    for (const docType of documentTypes) {
      const id = randomUUID();
      const [created] = await db.insert(documentThemeSettings).values({
        id,
        themeId,
        documentType: docType,
        documentTitle: defaults[docType].documentTitle,
        draftTitle: defaults[docType].draftTitle,
        defaultTerms: '',
        showJobNumber: 'true',
        showJobAddress: 'true',
        showReference: 'true',
        showDescription: 'true',
        showQuantity: 'true',
        showUnitPrice: 'true',
        showDiscount: 'true',
        showAmount: 'true',
        showNotes: 'true',
        descriptionPosition: 'below'
      }).returning();
      results.push(created);
    }
    return results;
  }
  
  async deleteDocumentThemeSettings(themeId: string): Promise<void> {
    await db.delete(documentThemeSettings).where(eq(documentThemeSettings.themeId, themeId));
  }
  
  // Document Attachment methods
  async getDocumentAttachments(documentType: string, documentId: string): Promise<DocumentAttachment[]> {
    return db.select().from(documentAttachments)
      .where(and(
        eq(documentAttachments.documentType, documentType),
        eq(documentAttachments.documentId, documentId)
      ))
      .orderBy(desc(documentAttachments.createdAt));
  }
  
  async getDocumentAttachment(id: string): Promise<DocumentAttachment | undefined> {
    const [attachment] = await db.select().from(documentAttachments).where(eq(documentAttachments.id, id));
    return attachment || undefined;
  }
  
  async createDocumentAttachment(data: InsertDocumentAttachment): Promise<DocumentAttachment> {
    const id = randomUUID();
    const [created] = await db.insert(documentAttachments).values({ ...data, id }).returning();
    return created;
  }
  
  async deleteDocumentAttachment(id: string): Promise<void> {
    await db.delete(documentAttachments).where(eq(documentAttachments.id, id));
  }
  
  async deleteDocumentAttachments(documentType: string, documentId: string): Promise<void> {
    await db.delete(documentAttachments).where(and(
      eq(documentAttachments.documentType, documentType),
      eq(documentAttachments.documentId, documentId)
    ));
  }
  
  // ============================================
  // RFlash - Flashing Profile Designer Methods
  // ============================================
  
  // Flashing Materials (global for now - shared across organizations)
  async getAllFlashingMaterials(): Promise<FlashingMaterial[]> {
    return db.select().from(flashingMaterials)
      .where(eq(flashingMaterials.isActive, 'true'))
      .orderBy(flashingMaterials.sortOrder);
  }
  
  async getFlashingMaterial(id: string): Promise<FlashingMaterial | undefined> {
    const [material] = await db.select().from(flashingMaterials).where(eq(flashingMaterials.id, id));
    return material || undefined;
  }
  
  async createFlashingMaterial(data: InsertFlashingMaterial): Promise<FlashingMaterial> {
    const id = randomUUID();
    const [created] = await db.insert(flashingMaterials).values({ ...data, id }).returning();
    return created;
  }
  
  async updateFlashingMaterial(id: string, data: Partial<InsertFlashingMaterial>): Promise<FlashingMaterial | undefined> {
    const [updated] = await db.update(flashingMaterials)
      .set(data)
      .where(eq(flashingMaterials.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteFlashingMaterial(id: string): Promise<void> {
    await db.delete(flashingMaterials).where(eq(flashingMaterials.id, id));
  }
  
  // Flashing Orders - organization scoped
  async getAllFlashingOrders(organizationId: string): Promise<FlashingOrder[]> {
    return db.select().from(flashingOrders)
      .where(eq(flashingOrders.organizationId, organizationId))
      .orderBy(desc(flashingOrders.createdAt));
  }
  
  async getFlashingOrdersByJob(organizationId: string, jobId: string): Promise<FlashingOrder[]> {
    return db.select().from(flashingOrders)
      .where(and(
        eq(flashingOrders.organizationId, organizationId),
        eq(flashingOrders.jobId, jobId)
      ))
      .orderBy(desc(flashingOrders.createdAt));
  }
  
  async getFlashingOrder(organizationId: string, id: string): Promise<FlashingOrder | undefined> {
    const [order] = await db.select().from(flashingOrders)
      .where(and(
        eq(flashingOrders.id, id),
        eq(flashingOrders.organizationId, organizationId)
      ));
    return order || undefined;
  }
  
  async createFlashingOrder(organizationId: string, data: InsertFlashingOrder): Promise<FlashingOrder> {
    const id = randomUUID();
    // Generate order number scoped to organization
    const existingOrders = await db.select().from(flashingOrders)
      .where(eq(flashingOrders.organizationId, organizationId));
    const orderNumber = `RF${String(existingOrders.length + 1).padStart(5, '0')}`;
    const [created] = await db.insert(flashingOrders).values({ 
      ...data, 
      id, 
      orderNumber,
      organizationId 
    }).returning();
    return created;
  }
  
  async updateFlashingOrder(organizationId: string, id: string, data: Partial<InsertFlashingOrder>): Promise<FlashingOrder | undefined> {
    // Strip organizationId from data to prevent injection
    const { organizationId: _, ...safeData } = data as typeof data & { organizationId?: unknown };
    const [updated] = await db.update(flashingOrders)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(
        eq(flashingOrders.id, id),
        eq(flashingOrders.organizationId, organizationId)
      ))
      .returning();
    return updated || undefined;
  }
  
  async deleteFlashingOrder(organizationId: string, id: string): Promise<void> {
    await db.delete(flashingOrders).where(and(
      eq(flashingOrders.id, id),
      eq(flashingOrders.organizationId, organizationId)
    ));
  }
  
  // Flashing Profiles - verified via parent order ownership
  async getFlashingProfilesByOrder(organizationId: string, orderId: string): Promise<FlashingProfile[]> {
    // Verify order belongs to organization first
    const order = await this.getFlashingOrder(organizationId, orderId);
    if (!order) return [];
    
    return db.select().from(flashingProfiles)
      .where(eq(flashingProfiles.orderId, orderId))
      .orderBy(flashingProfiles.sortOrder);
  }
  
  async getFlashingProfile(organizationId: string, id: string): Promise<FlashingProfile | undefined> {
    const [profile] = await db.select().from(flashingProfiles).where(eq(flashingProfiles.id, id));
    if (!profile) return undefined;
    
    // Verify parent order belongs to organization
    const order = await this.getFlashingOrder(organizationId, profile.orderId);
    if (!order) return undefined;
    
    return profile;
  }
  
  async createFlashingProfile(organizationId: string, data: InsertFlashingProfile): Promise<FlashingProfile | undefined> {
    // Verify parent order belongs to organization
    const order = await this.getFlashingOrder(organizationId, data.orderId);
    if (!order) return undefined;
    
    const id = randomUUID();
    const [created] = await db.insert(flashingProfiles).values({ ...data, id }).returning();
    return created;
  }
  
  async updateFlashingProfile(organizationId: string, id: string, data: Partial<InsertFlashingProfile>): Promise<FlashingProfile | undefined> {
    // Verify existing profile's parent order belongs to organization
    const existingProfile = await this.getFlashingProfile(organizationId, id);
    if (!existingProfile) return undefined;
    
    // Strip orderId from data to prevent cross-tenant injection
    const { orderId: _, ...safeData } = data as typeof data & { orderId?: unknown };
    const [updated] = await db.update(flashingProfiles)
      .set(safeData)
      .where(eq(flashingProfiles.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteFlashingProfile(organizationId: string, id: string): Promise<void> {
    // Verify profile belongs to organization via parent order
    const profile = await this.getFlashingProfile(organizationId, id);
    if (!profile) return;
    
    await db.delete(flashingProfiles).where(eq(flashingProfiles.id, id));
  }
  
  // Flashing Templates - organization scoped
  async getAllFlashingTemplates(organizationId: string): Promise<FlashingTemplate[]> {
    return db.select().from(flashingTemplates)
      .where(and(
        eq(flashingTemplates.organizationId, organizationId),
        eq(flashingTemplates.isActive, 'true')
      ))
      .orderBy(flashingTemplates.name);
  }
  
  async getFlashingTemplate(organizationId: string, id: string): Promise<FlashingTemplate | undefined> {
    const [template] = await db.select().from(flashingTemplates)
      .where(and(
        eq(flashingTemplates.id, id),
        eq(flashingTemplates.organizationId, organizationId)
      ));
    return template || undefined;
  }
  
  async createFlashingTemplate(organizationId: string, data: InsertFlashingTemplate): Promise<FlashingTemplate> {
    const id = randomUUID();
    const [created] = await db.insert(flashingTemplates).values({ 
      ...data, 
      id,
      organizationId 
    }).returning();
    return created;
  }
  
  async updateFlashingTemplate(organizationId: string, id: string, data: Partial<InsertFlashingTemplate>): Promise<FlashingTemplate | undefined> {
    // Strip organizationId from data to prevent injection
    const { organizationId: _, ...safeData } = data as typeof data & { organizationId?: unknown };
    const [updated] = await db.update(flashingTemplates)
      .set(safeData)
      .where(and(
        eq(flashingTemplates.id, id),
        eq(flashingTemplates.organizationId, organizationId)
      ))
      .returning();
    return updated || undefined;
  }
  
  async deleteFlashingTemplate(organizationId: string, id: string): Promise<void> {
    await db.delete(flashingTemplates).where(and(
      eq(flashingTemplates.id, id),
      eq(flashingTemplates.organizationId, organizationId)
    ));
  }
  
  // Get next flashing code for an order
  async getNextFlashingCode(organizationId: string, orderId: string): Promise<string> {
    const profiles = await this.getFlashingProfilesByOrder(organizationId, orderId);
    const maxNum = profiles.reduce((max, p) => {
      const match = p.code.match(/A(\d+)/);
      const num = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, num);
    }, 0);
    return `A${maxNum + 1}`;
  }
  
  // Xero Integration methods
  async getXeroConnection(organizationId: string): Promise<XeroConnection | undefined> {
    const [connection] = await db.select().from(xeroConnections).where(eq(xeroConnections.organizationId, organizationId));
    return connection || undefined;
  }
  
  async createXeroConnection(connection: InsertXeroConnection): Promise<XeroConnection> {
    const id = randomUUID();
    const [created] = await db.insert(xeroConnections).values({ ...connection, id }).returning();
    return created;
  }
  
  async updateXeroConnection(organizationId: string, data: Partial<InsertXeroConnection>): Promise<XeroConnection | undefined> {
    const [updated] = await db
      .update(xeroConnections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(xeroConnections.organizationId, organizationId))
      .returning();
    return updated || undefined;
  }
  
  async deleteXeroConnection(organizationId: string): Promise<void> {
    await db.delete(xeroConnections).where(eq(xeroConnections.organizationId, organizationId));
  }
  
  async createXeroSyncHistory(sync: InsertXeroSyncHistory): Promise<XeroSyncHistory> {
    const id = randomUUID();
    const [created] = await db.insert(xeroSyncHistory).values({ ...sync, id }).returning();
    return created;
  }
  
  async getXeroSyncHistory(organizationId: string, limit?: number): Promise<XeroSyncHistory[]> {
    const query = db.select().from(xeroSyncHistory)
      .where(eq(xeroSyncHistory.organizationId, organizationId))
      .orderBy(desc(xeroSyncHistory.createdAt));
    
    if (limit) {
      return query.limit(limit);
    }
    return query;
  }
  
  // Document View Token methods
  async createViewToken(documentType: string, documentId: string, expiryDays: number = 30): Promise<string> {
    const id = randomUUID();
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
    
    await db.insert(documentViewTokens).values({
      id,
      documentType,
      documentId,
      token,
      expiresAt,
    });
    
    return token;
  }
  
  async validateViewToken(token: string): Promise<{ documentType: string; documentId: string } | null> {
    const [result] = await db.select().from(documentViewTokens)
      .where(and(
        eq(documentViewTokens.token, token),
        sql`${documentViewTokens.expiresAt} > NOW()`
      ));
    
    if (!result) {
      return null;
    }
    
    return {
      documentType: result.documentType,
      documentId: result.documentId,
    };
  }
  
  // Settings Migration methods
  async getAllSettingsMigrations(): Promise<SettingsMigration[]> {
    return db.select().from(settingsMigrations).orderBy(desc(settingsMigrations.createdAt));
  }
  
  async getPendingSettingsMigrations(): Promise<SettingsMigration[]> {
    return db.select().from(settingsMigrations)
      .where(eq(settingsMigrations.status, 'pending'))
      .orderBy(desc(settingsMigrations.createdAt));
  }
  
  async createSettingsMigration(data: InsertSettingsMigration): Promise<SettingsMigration> {
    const id = randomUUID();
    const [created] = await db.insert(settingsMigrations).values({ ...data, id }).returning();
    return created;
  }
  
  async updateSettingsMigrationStatus(id: string, status: string, appliedBy?: string): Promise<void> {
    await db.update(settingsMigrations)
      .set({ 
        status, 
        appliedAt: status === 'applied' ? new Date() : null,
        appliedBy: appliedBy || null
      })
      .where(eq(settingsMigrations.id, id));
  }
  
  async clearAllSettingsMigrations(): Promise<void> {
    await db.delete(settingsMigrations);
  }
  
  // Quote Template methods
  async getQuoteTemplate(organizationId: string, id: string): Promise<QuoteTemplate | undefined> {
    const [result] = await db.select().from(quoteTemplates).where(
      and(eq(quoteTemplates.id, id), eq(quoteTemplates.organizationId, organizationId))
    );
    return result || undefined;
  }
  
  async getAllQuoteTemplates(organizationId: string): Promise<QuoteTemplate[]> {
    return db.select().from(quoteTemplates)
      .where(eq(quoteTemplates.organizationId, organizationId))
      .orderBy(desc(quoteTemplates.createdAt));
  }
  
  async getActiveQuoteTemplates(organizationId: string): Promise<QuoteTemplate[]> {
    return db.select().from(quoteTemplates)
      .where(and(
        eq(quoteTemplates.organizationId, organizationId),
        eq(quoteTemplates.isActive, 'true')
      ))
      .orderBy(desc(quoteTemplates.createdAt));
  }
  
  async getDefaultQuoteTemplate(organizationId: string): Promise<QuoteTemplate | undefined> {
    const [result] = await db.select().from(quoteTemplates)
      .where(and(
        eq(quoteTemplates.organizationId, organizationId),
        eq(quoteTemplates.isDefault, 'true')
      ));
    return result || undefined;
  }
  
  async createQuoteTemplate(data: InsertQuoteTemplate): Promise<QuoteTemplate> {
    const id = randomUUID();
    // If setting as default, unset other defaults first
    if (data.isDefault === 'true') {
      await db.update(quoteTemplates)
        .set({ isDefault: 'false' })
        .where(eq(quoteTemplates.organizationId, data.organizationId));
    }
    const [created] = await db.insert(quoteTemplates).values({ ...data, id }).returning();
    return created;
  }
  
  async updateQuoteTemplate(organizationId: string, id: string, data: Partial<InsertQuoteTemplate>): Promise<QuoteTemplate | undefined> {
    const { organizationId: _, ...safeData } = data as typeof data & { organizationId?: unknown };
    // If setting as default, unset other defaults first
    if (safeData.isDefault === 'true') {
      await db.update(quoteTemplates)
        .set({ isDefault: 'false' })
        .where(eq(quoteTemplates.organizationId, organizationId));
    }
    const [updated] = await db.update(quoteTemplates)
      .set({ ...safeData, updatedAt: new Date() })
      .where(and(eq(quoteTemplates.id, id), eq(quoteTemplates.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  
  async deleteQuoteTemplate(organizationId: string, id: string): Promise<void> {
    await db.delete(quoteTemplates).where(
      and(eq(quoteTemplates.id, id), eq(quoteTemplates.organizationId, organizationId))
    );
  }
  
  // Quote Template Mapping methods
  async getQuoteTemplateMappings(organizationId: string, templateId: string): Promise<QuoteTemplateMapping[]> {
    // Verify template ownership first
    const template = await this.getQuoteTemplate(organizationId, templateId);
    if (!template) return [];
    
    return db.select().from(quoteTemplateMappings)
      .where(eq(quoteTemplateMappings.templateId, templateId))
      .orderBy(quoteTemplateMappings.sortOrder);
  }
  
  async createQuoteTemplateMapping(organizationId: string, data: InsertQuoteTemplateMapping): Promise<QuoteTemplateMapping> {
    // Verify template ownership
    const template = await this.getQuoteTemplate(organizationId, data.templateId);
    if (!template) throw new Error('Template not found');
    
    const id = randomUUID();
    const [created] = await db.insert(quoteTemplateMappings).values({ ...data, id }).returning();
    return created;
  }
  
  async updateQuoteTemplateMapping(organizationId: string, id: string, data: Partial<InsertQuoteTemplateMapping>): Promise<QuoteTemplateMapping | undefined> {
    // Strip templateId to prevent injection
    const { templateId: _, ...safeData } = data as typeof data & { templateId?: unknown };
    
    // Get mapping and verify ownership via template
    const [existing] = await db.select().from(quoteTemplateMappings).where(eq(quoteTemplateMappings.id, id));
    if (!existing) return undefined;
    
    const template = await this.getQuoteTemplate(organizationId, existing.templateId);
    if (!template) return undefined;
    
    const [updated] = await db.update(quoteTemplateMappings)
      .set(safeData)
      .where(eq(quoteTemplateMappings.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteQuoteTemplateMapping(organizationId: string, id: string): Promise<void> {
    // Get mapping and verify ownership via template
    const [existing] = await db.select().from(quoteTemplateMappings).where(eq(quoteTemplateMappings.id, id));
    if (!existing) return;
    
    const template = await this.getQuoteTemplate(organizationId, existing.templateId);
    if (!template) return;
    
    await db.delete(quoteTemplateMappings).where(eq(quoteTemplateMappings.id, id));
  }
  
  // Roof Report Extraction methods
  async getRoofReportExtraction(organizationId: string, id: string): Promise<RoofReportExtraction | undefined> {
    const [result] = await db.select().from(roofReportExtractions).where(
      and(eq(roofReportExtractions.id, id), eq(roofReportExtractions.organizationId, organizationId))
    );
    return result || undefined;
  }
  
  async getRoofReportExtractionByQuote(organizationId: string, quoteId: string): Promise<RoofReportExtraction | undefined> {
    const [result] = await db.select().from(roofReportExtractions).where(
      and(eq(roofReportExtractions.quoteId, quoteId), eq(roofReportExtractions.organizationId, organizationId))
    );
    return result || undefined;
  }
  
  async createRoofReportExtraction(data: InsertRoofReportExtraction): Promise<RoofReportExtraction> {
    const id = randomUUID();
    const [created] = await db.insert(roofReportExtractions).values({ ...data, id }).returning();
    return created;
  }
  
  async updateRoofReportExtraction(organizationId: string, id: string, data: Partial<InsertRoofReportExtraction>): Promise<RoofReportExtraction | undefined> {
    const { organizationId: _, ...safeData } = data as typeof data & { organizationId?: unknown };
    const [updated] = await db.update(roofReportExtractions)
      .set(safeData)
      .where(and(eq(roofReportExtractions.id, id), eq(roofReportExtractions.organizationId, organizationId)))
      .returning();
    return updated || undefined;
  }
  
  async deleteRoofReportExtraction(organizationId: string, id: string): Promise<void> {
    await db.delete(roofReportExtractions).where(
      and(eq(roofReportExtractions.id, id), eq(roofReportExtractions.organizationId, organizationId))
    );
  }

  // ML Pricing Pattern methods
  async getAllMlPricingPatterns(organizationId: string): Promise<MlPricingPattern[]> {
    return await db.select().from(mlPricingPatterns)
      .where(eq(mlPricingPatterns.organizationId, organizationId))
      .orderBy(desc(mlPricingPatterns.occurrenceCount));
  }

  async getMlPricingPatternByKey(organizationId: string, normalizedKey: string): Promise<MlPricingPattern | undefined> {
    const [result] = await db.select().from(mlPricingPatterns).where(
      and(eq(mlPricingPatterns.organizationId, organizationId), eq(mlPricingPatterns.normalizedKey, normalizedKey))
    );
    return result || undefined;
  }

  async upsertMlPricingPattern(organizationId: string, data: {
    itemDescription: string;
    normalizedKey: string;
    unitPrice: number;
    quantity: number;
    amount: number;
    source: string;
    itemCode?: string;
    costPrice?: number;
    markupPercentage?: number;
    unit?: string;
  }): Promise<MlPricingPattern> {
    const existing = await this.getMlPricingPatternByKey(organizationId, data.normalizedKey);
    
    if (existing) {
      // Update rolling averages
      const newCount = existing.occurrenceCount + 1;
      const newAvgPrice = ((existing.avgUnitPrice * existing.occurrenceCount) + data.unitPrice) / newCount;
      const newAvgQty = ((existing.avgQuantity || 0) * existing.occurrenceCount + data.quantity) / newCount;
      const newTotalRevenue = (existing.totalRevenue || 0) + data.amount;
      const newMinPrice = Math.min(existing.minUnitPrice || data.unitPrice, data.unitPrice);
      const newMaxPrice = Math.max(existing.maxUnitPrice || data.unitPrice, data.unitPrice);
      
      const [updated] = await db.update(mlPricingPatterns)
        .set({
          avgUnitPrice: newAvgPrice,
          avgQuantity: newAvgQty,
          minUnitPrice: newMinPrice,
          maxUnitPrice: newMaxPrice,
          occurrenceCount: newCount,
          totalRevenue: newTotalRevenue,
          lastUpdatedAt: new Date(),
          // Update product linking fields if provided (new data overrides)
          ...(data.itemCode !== undefined && { itemCode: data.itemCode }),
          ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
          ...(data.markupPercentage !== undefined && { markupPercentage: data.markupPercentage }),
          ...(data.unit !== undefined && { unit: data.unit }),
        })
        .where(eq(mlPricingPatterns.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new pattern
      const id = randomUUID();
      const [created] = await db.insert(mlPricingPatterns).values({
        id,
        organizationId,
        itemDescription: data.itemDescription,
        normalizedKey: data.normalizedKey,
        avgUnitPrice: data.unitPrice,
        minUnitPrice: data.unitPrice,
        maxUnitPrice: data.unitPrice,
        avgQuantity: data.quantity,
        occurrenceCount: 1,
        totalRevenue: data.amount,
        source: data.source,
        itemCode: data.itemCode,
        costPrice: data.costPrice,
        markupPercentage: data.markupPercentage,
        unit: data.unit,
      }).returning();
      return created;
    }
  }

  async clearMlPricingPatterns(organizationId: string, source?: string): Promise<void> {
    if (source) {
      await db.delete(mlPricingPatterns).where(
        and(eq(mlPricingPatterns.organizationId, organizationId), eq(mlPricingPatterns.source, source))
      );
    } else {
      await db.delete(mlPricingPatterns).where(eq(mlPricingPatterns.organizationId, organizationId));
    }
  }

  async updateMlPricingPattern(id: string, data: {
    itemCode?: string | null;
    costPrice?: number | null;
    markupPercentage?: number | null;
    unit?: string | null;
    avgUnitPrice?: number;
    productId?: string | null;
  }): Promise<MlPricingPattern | undefined> {
    const [updated] = await db.update(mlPricingPatterns)
      .set({
        ...(data.itemCode !== undefined && { itemCode: data.itemCode }),
        ...(data.costPrice !== undefined && { costPrice: data.costPrice }),
        ...(data.markupPercentage !== undefined && { markupPercentage: data.markupPercentage }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.avgUnitPrice !== undefined && { avgUnitPrice: data.avgUnitPrice }),
        ...(data.productId !== undefined && { productId: data.productId }),
        lastUpdatedAt: new Date(),
      })
      .where(eq(mlPricingPatterns.id, id))
      .returning();
    return updated || undefined;
  }

  // ML Import Session methods
  async createMlImportSession(data: InsertMlImportSession): Promise<MlImportSession> {
    const id = randomUUID();
    const [created] = await db.insert(mlImportSessions).values({ ...data, id }).returning();
    return created;
  }

  async updateMlImportSession(id: string, data: Partial<InsertMlImportSession>): Promise<MlImportSession | undefined> {
    const [updated] = await db.update(mlImportSessions).set(data).where(eq(mlImportSessions.id, id)).returning();
    return updated || undefined;
  }

  async getMlImportSessions(organizationId: string): Promise<MlImportSession[]> {
    return await db.select().from(mlImportSessions)
      .where(eq(mlImportSessions.organizationId, organizationId))
      .orderBy(desc(mlImportSessions.createdAt));
  }

  // Feedback Event methods
  async createFeedbackEvent(data: InsertFeedbackEvent): Promise<FeedbackEvent> {
    const id = randomUUID();
    const [created] = await db.insert(feedbackEvents).values({ ...data, id }).returning();
    return created;
  }

  async getFeedbackEventById(id: string): Promise<FeedbackEvent | undefined> {
    const [event] = await db.select().from(feedbackEvents).where(eq(feedbackEvents.id, id));
    return event || undefined;
  }

  async deleteOldFeedbackEvents(organizationId: string, daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await db.delete(feedbackEvents)
      .where(and(
        eq(feedbackEvents.organizationId, organizationId),
        sql`${feedbackEvents.createdAt} < ${cutoffDate}`
      ))
      .returning({ id: feedbackEvents.id });
    
    return result.length;
  }

  async getFeedbackEvents(organizationId: string | null, options?: { eventType?: string; severity?: string; startDate?: Date; endDate?: Date; priority?: string; userEmail?: string; limit?: number }): Promise<FeedbackEvent[]> {
    const conditions = [];
    if (organizationId) {
      conditions.push(eq(feedbackEvents.organizationId, organizationId));
    }
    if (options?.eventType) {
      conditions.push(eq(feedbackEvents.eventType, options.eventType));
    }
    if (options?.severity) {
      conditions.push(eq(feedbackEvents.severity, options.severity));
    }
    if (options?.startDate) {
      conditions.push(sql`${feedbackEvents.createdAt} >= ${options.startDate}`);
    }
    if (options?.endDate) {
      conditions.push(sql`${feedbackEvents.createdAt} <= ${options.endDate}`);
    }
    if (options?.priority) {
      conditions.push(eq(feedbackEvents.priority, options.priority));
    }
    if (options?.userEmail) {
      conditions.push(sql`lower(${feedbackEvents.userEmail}) LIKE ${`%${options.userEmail.toLowerCase()}%`}`);
    }
    
    const query = db.select().from(feedbackEvents);
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(feedbackEvents.createdAt)).limit(options?.limit || 500);
    }
    return await query.orderBy(desc(feedbackEvents.createdAt)).limit(options?.limit || 500);
  }

  async getUnresolvedFeedbackEvents(organizationId: string | null, daysBack: number = 7): Promise<FeedbackEvent[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const conditions = [
      eq(feedbackEvents.resolved, 'false'),
      sql`${feedbackEvents.createdAt} >= ${startDate}`
    ];
    if (organizationId) {
      conditions.push(eq(feedbackEvents.organizationId, organizationId));
    }
    
    return await db.select().from(feedbackEvents)
      .where(and(...conditions))
      .orderBy(desc(feedbackEvents.createdAt));
  }

  async resolveFeedbackEvent(id: string): Promise<FeedbackEvent | undefined> {
    const [updated] = await db.update(feedbackEvents)
      .set({ resolved: 'true' })
      .where(eq(feedbackEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async updateFeedbackEventAnalysis(id: string, analysis: string): Promise<FeedbackEvent | undefined> {
    const [updated] = await db.update(feedbackEvents)
      .set({ aiAnalysis: analysis })
      .where(eq(feedbackEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async updateFeedbackEvent(id: string, data: { priority?: string; assignedTo?: string | null; resolved?: string; resolutionNotes?: string; resolvedAt?: Date; resolvedBy?: string }): Promise<FeedbackEvent | undefined> {
    const updateData: Partial<{ priority: string; assignedTo: string | null; resolved: string; resolutionNotes: string; resolvedAt: Date; resolvedBy: string }> = {};
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
    if (data.resolved !== undefined) updateData.resolved = data.resolved;
    if (data.resolutionNotes !== undefined) updateData.resolutionNotes = data.resolutionNotes;
    if (data.resolvedAt !== undefined) updateData.resolvedAt = data.resolvedAt;
    if (data.resolvedBy !== undefined) updateData.resolvedBy = data.resolvedBy;
    
    if (Object.keys(updateData).length === 0) return undefined;
    
    const [updated] = await db.update(feedbackEvents)
      .set(updateData)
      .where(eq(feedbackEvents.id, id))
      .returning();
    return updated || undefined;
  }

  async getGroupedFeedbackEvents(organizationId: string, options?: { eventType?: string; severity?: string; resolved?: string }): Promise<Array<{
    groupId: string;
    count: number;
    latestOccurrence: Date;
    sampleMessage: string;
    eventType: string;
    severity: string;
    events: FeedbackEvent[];
  }>> {
    const conditions = [eq(feedbackEvents.organizationId, organizationId)];
    
    if (options?.eventType) {
      conditions.push(eq(feedbackEvents.eventType, options.eventType));
    }
    if (options?.severity) {
      conditions.push(eq(feedbackEvents.severity, options.severity));
    }
    if (options?.resolved) {
      conditions.push(eq(feedbackEvents.resolved, options.resolved));
    }
    
    const events = await db.select().from(feedbackEvents)
      .where(and(...conditions))
      .orderBy(desc(feedbackEvents.createdAt))
      .limit(1000);
    
    const groups = new Map<string, {
      groupId: string;
      count: number;
      latestOccurrence: Date;
      sampleMessage: string;
      eventType: string;
      severity: string;
      events: FeedbackEvent[];
    }>();
    
    for (const event of events) {
      const groupId = event.groupId || event.id;
      
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupId,
          count: 0,
          latestOccurrence: event.createdAt,
          sampleMessage: event.message,
          eventType: event.eventType,
          severity: event.severity,
          events: [],
        });
      }
      
      const group = groups.get(groupId)!;
      group.count++;
      group.events.push(event);
      
      if (event.createdAt > group.latestOccurrence) {
        group.latestOccurrence = event.createdAt;
      }
      
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 };
      const currentSeverity = severityOrder[event.severity as keyof typeof severityOrder] || 0;
      const groupSeverity = severityOrder[group.severity as keyof typeof severityOrder] || 0;
      if (currentSeverity > groupSeverity) {
        group.severity = event.severity;
      }
    }
    
    return Array.from(groups.values())
      .sort((a, b) => b.latestOccurrence.getTime() - a.latestOccurrence.getTime());
  }

  async getFeedbackEventsByGroupId(organizationId: string, groupId: string): Promise<FeedbackEvent[]> {
    return await db.select().from(feedbackEvents)
      .where(and(eq(feedbackEvents.organizationId, organizationId), eq(feedbackEvents.groupId, groupId)))
      .orderBy(desc(feedbackEvents.createdAt));
  }
  
  // User Behavior Event methods
  async createBehaviorEvent(event: InsertUserBehaviorEvent): Promise<UserBehaviorEvent> {
    const id = randomUUID();
    const [created] = await db.insert(userBehaviorEvents).values({ ...event, id }).returning();
    return created;
  }

  async getBehaviorEvents(organizationId: string, filters?: { eventType?: string; startDate?: Date; endDate?: Date }): Promise<UserBehaviorEvent[]> {
    const conditions = [eq(userBehaviorEvents.organizationId, organizationId)];
    
    if (filters?.eventType) {
      conditions.push(eq(userBehaviorEvents.eventType, filters.eventType));
    }
    if (filters?.startDate) {
      conditions.push(sql`${userBehaviorEvents.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${userBehaviorEvents.createdAt} <= ${filters.endDate}`);
    }
    
    return await db.select().from(userBehaviorEvents)
      .where(and(...conditions))
      .orderBy(desc(userBehaviorEvents.createdAt))
      .limit(500);
  }

  async getBehaviorStats(organizationId: string): Promise<{ byType: Record<string, number>; byPage: Record<string, number> }> {
    const events = await db.select().from(userBehaviorEvents)
      .where(eq(userBehaviorEvents.organizationId, organizationId));
    
    const byType: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    
    for (const event of events) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      if (event.pageUrl) {
        byPage[event.pageUrl] = (byPage[event.pageUrl] || 0) + 1;
      }
    }
    
    return { byType, byPage };
  }

  async getSavedLineSections(organizationId: string): Promise<SavedLineSection[]> {
    return await db.select().from(savedLineSections).where(eq(savedLineSections.organizationId, organizationId)).orderBy(savedLineSections.createdAt);
  }

  async getSavedLineSectionWithItems(organizationId: string, sectionId: string): Promise<{ section: SavedLineSection; items: SavedLineSectionItem[] } | null> {
    const [section] = await db.select().from(savedLineSections).where(and(eq(savedLineSections.id, sectionId), eq(savedLineSections.organizationId, organizationId)));
    if (!section) return null;
    const items = await db.select().from(savedLineSectionItems).where(eq(savedLineSectionItems.sectionId, sectionId)).orderBy(savedLineSectionItems.sortOrder);
    return { section, items };
  }

  async createSavedLineSection(organizationId: string, data: { name: string; description?: string; createdBy?: string; items: Array<Omit<InsertSavedLineSectionItem, 'sectionId'>> }): Promise<SavedLineSection> {
    const sectionId = `sls_${Date.now()}`;
    return await db.transaction(async (tx) => {
      const [section] = await tx.insert(savedLineSections).values({
        id: sectionId,
        organizationId,
        name: data.name,
        description: data.description || null,
        createdBy: data.createdBy || null,
      }).returning();
      
      if (data.items.length > 0) {
        await tx.insert(savedLineSectionItems).values(
          data.items.map((item, idx) => ({
            id: `slsi_${Date.now()}_${idx}`,
            sectionId,
            description: item.description,
            qty: item.qty ?? 1,
            unitCost: item.unitCost ?? 0,
            total: item.total ?? 0,
            itemCode: item.itemCode || null,
            costPrice: item.costPrice || null,
            productId: item.productId || null,
            section: item.section || null,
            sortOrder: item.sortOrder ?? idx,
          }))
        );
      }
      
      return section;
    });
  }

  async deleteSavedLineSection(organizationId: string, sectionId: string): Promise<void> {
    await db.delete(savedLineSections).where(and(eq(savedLineSections.id, sectionId), eq(savedLineSections.organizationId, organizationId)));
  }
}

export const storage = new DatabaseStorage();
