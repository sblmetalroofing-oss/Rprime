import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export * from "./models/auth";
export * from "./models/chat";

import { users } from "./models/auth";

// Customers table for CRM
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  suburb: text("suburb"),
  postcode: text("postcode"),
  state: text("state"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("customers_organization_id_idx").on(table.organizationId),
]);

// Suppliers table for material suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  suburb: text("suburb"),
  postcode: text("postcode"),
  state: text("state"),
  accountNumber: text("account_number"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  isActive: text("is_active").notNull().default('true'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("suppliers_organization_id_idx").on(table.organizationId),
]);

export const insertSupplierSchema = createInsertSchema(suppliers).omit({ createdAt: true, updatedAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const reports = pgTable("reports", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  jobId: varchar("job_id"),
  themeId: varchar("theme_id"),
  customerName: text("customer_name").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address").notNull(),
  suburb: text("suburb").notNull(),
  date: text("date").notNull(),
  inspector: text("inspector").notNull(),
  status: text("status").notNull().default('draft'),
  roofType: text("roof_type").notNull(),
  roofPitch: text("roof_pitch"),
  storeys: text("storeys"),
  accessMethod: text("access_method"),
  measurements: jsonb("measurements"),
  totalEstimates: real("total_estimates").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("reports_organization_id_idx").on(table.organizationId),
  index("reports_customer_id_idx").on(table.customerId),
  index("reports_job_id_idx").on(table.jobId),
]);

export const findings = pgTable("findings", {
  id: varchar("id").primaryKey(),
  reportId: varchar("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  photoUrl: text("photo_url"),
  photoUrls: text("photo_urls").array(),
}, (table) => [
  index("findings_report_id_idx").on(table.reportId),
]);

export const estimateItems = pgTable("estimate_items", {
  id: varchar("id").primaryKey(),
  reportId: varchar("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  qty: real("qty").notNull(),
  unitCost: real("unit_cost").notNull(),
  markup: real("markup").notNull().default(0),
}, (table) => [
  index("estimate_items_report_id_idx").on(table.reportId),
]);

// Jobs table for scheduling
export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  referenceNumber: text("reference_number"),
  builderReference: text("builder_reference"),
  customerId: varchar("customer_id").references(() => customers.id),
  title: text("title").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  suburb: text("suburb"),
  scheduledDate: text("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  estimatedDuration: real("estimated_duration"),
  status: text("status").notNull().default('intake'),
  priority: text("priority").notNull().default('normal'),
  assignedTo: text("assigned_to").array(),
  notes: text("notes"),
  laborHours: real("labor_hours"),
  laborRate: real("labor_rate").default(75),
  completedAt: timestamp("completed_at"),
  timerStartedAt: timestamp("timer_started_at"),
  timerTotalSeconds: real("timer_total_seconds").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("jobs_organization_id_idx").on(table.organizationId),
  index("jobs_customer_id_idx").on(table.customerId),
  index("jobs_status_idx").on(table.status),
]);

// Job status history for tracking changes
export const jobStatusHistory = pgTable("job_status_history", {
  id: varchar("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  changedBy: text("changed_by"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("job_status_history_job_id_idx").on(table.jobId),
]);

// Job templates for quick job creation
export const jobTemplates = pgTable("job_templates", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  defaultTitle: text("default_title").notNull(),
  defaultDescription: text("default_description"),
  estimatedDuration: real("estimated_duration"),
  priority: text("priority").notNull().default('normal'),
  category: text("category"),
  isActive: text("is_active").notNull().default('true'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("job_templates_organization_id_idx").on(table.organizationId),
]);

// Job activity/notes for communication
export const jobActivities = pgTable("job_activities", {
  id: varchar("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('note'),
  content: text("content").notNull(),
  attachments: text("attachments").array(),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("job_activities_job_id_idx").on(table.jobId),
]);

// Crew members table
export const crewMembers = pgTable("crew_members", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default('tradesperson'),
  hourlyRate: real("hourly_rate").default(75),
  color: text("color").default('#3e4f61'),
  isActive: text("is_active").notNull().default('true'),
  // Permission fields
  isAdmin: text("is_admin").notNull().default('false'),
  canViewAllJobs: text("can_view_all_jobs").notNull().default('false'),
  canEditJobs: text("can_edit_jobs").notNull().default('true'),
  canViewFinancials: text("can_view_financials").notNull().default('false'),
  canAccessSettings: text("can_access_settings").notNull().default('false'),
  // Invitation fields
  inviteToken: text("invite_token"),
  inviteStatus: text("invite_status").notNull().default('pending'),
  inviteSentAt: timestamp("invite_sent_at"),
  userId: varchar("user_id"),
  // Dashboard widget preferences (stored as JSON array of widget configs)
  dashboardWidgets: jsonb("dashboard_widgets"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("crew_members_organization_id_idx").on(table.organizationId),
]);

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;

// Appointments table for non-job calendar events (meetings, training, etc)
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  scheduledDate: text("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  endTime: text("end_time"),
  assignedTo: text("assigned_to").array(),
  jobId: varchar("job_id").references(() => jobs.id),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("appointments_organization_id_idx").on(table.organizationId),
]);

export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// Quotes table
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  quoteNumber: text("quote_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  reportId: varchar("report_id").references(() => reports.id),
  jobId: varchar("job_id").references(() => jobs.id),
  themeId: varchar("theme_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  address: text("address").notNull(),
  suburb: text("suburb"),
  status: text("status").notNull().default('draft'),
  validUntil: text("valid_until"),
  reference: text("reference"),
  description: text("description"),
  discount: real("discount").default(0),
  subtotal: real("subtotal").notNull().default(0),
  gst: real("gst").notNull().default(0),
  total: real("total").notNull().default(0),
  totalCost: real("total_cost").default(0),
  grossProfit: real("gross_profit").default(0),
  notes: text("notes"),
  terms: text("terms"),
  emailReminders: text("email_reminders").default('false'),
  smsReminders: text("sms_reminders").default('false'),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  declineReason: text("decline_reason"),
  appliedMarkupPercent: real("applied_markup_percent").default(100),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  sentBy: text("sent_by"),
  sentByName: text("sent_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("quotes_organization_id_idx").on(table.organizationId),
  index("quotes_customer_id_idx").on(table.customerId),
  index("quotes_job_id_idx").on(table.jobId),
  index("quotes_status_idx").on(table.status),
]);

// Quote line items
export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey(),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").references(() => items.id, { onDelete: 'set null' }),
  itemCode: text("item_code"),
  description: text("description").notNull(),
  qty: real("qty").notNull(),
  unitCost: real("unit_cost").notNull(),
  costPrice: real("cost_price").default(0),
  total: real("total").notNull(),
  sortOrder: real("sort_order").default(0),
  section: text("section"),
}, (table) => [
  index("quote_items_quote_id_idx").on(table.quoteId),
]);

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobId: varchar("job_id").references(() => jobs.id),
  themeId: varchar("theme_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  address: text("address").notNull(),
  suburb: text("suburb"),
  status: text("status").notNull().default('draft'),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date").notNull(),
  reference: text("reference"),
  description: text("description"),
  discount: real("discount").default(0),
  subtotal: real("subtotal").notNull().default(0),
  gst: real("gst").notNull().default(0),
  total: real("total").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  notes: text("notes"),
  terms: text("terms"),
  emailReminders: text("email_reminders").default('false'),
  smsReminders: text("sms_reminders").default('false'),
  creditCardEnabled: text("credit_card_enabled").default('false'),
  surchargePassthrough: text("surcharge_passthrough").default('false'),
  sentAt: timestamp("sent_at"),
  paidAt: timestamp("paid_at"),
  invoiceType: text("invoice_type").default('standard'), // standard, deposit, progress, final
  depositPercent: real("deposit_percent"), // for deposit invoices, e.g. 30 for 30%
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  sentBy: text("sent_by"),
  sentByName: text("sent_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("invoices_organization_id_idx").on(table.organizationId),
  index("invoices_customer_id_idx").on(table.customerId),
  index("invoices_job_id_idx").on(table.jobId),
  index("invoices_quote_id_idx").on(table.quoteId),
  index("invoices_status_idx").on(table.status),
]);

// Invoice line items
export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey(),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").references(() => items.id, { onDelete: 'set null' }),
  itemCode: text("item_code"),
  description: text("description").notNull(),
  qty: real("qty").notNull(),
  unitCost: real("unit_cost").notNull(),
  costPrice: real("cost_price").default(0),
  total: real("total").notNull(),
  sortOrder: real("sort_order").default(0),
  section: text("section"),
}, (table) => [
  index("invoice_items_invoice_id_idx").on(table.invoiceId),
]);

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  poNumber: text("po_number").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  themeId: varchar("theme_id"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplier: text("supplier").notNull(),
  supplierContact: text("supplier_contact"),
  supplierPhone: text("supplier_phone"),
  supplierEmail: text("supplier_email"),
  status: text("status").notNull().default('draft'),
  orderDate: text("order_date"),
  expectedDelivery: text("expected_delivery"),
  deliveryAddress: text("delivery_address"),
  deliveryInstructions: text("delivery_instructions"),
  reference: text("reference"),
  description: text("description"),
  discount: real("discount").notNull().default(0),
  subtotal: real("subtotal").notNull().default(0),
  gst: real("gst").notNull().default(0),
  total: real("total").notNull().default(0),
  taxMode: text("tax_mode").notNull().default('exclusive'),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdByName: text("created_by_name"),
  sentBy: text("sent_by"),
  sentByName: text("sent_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("purchase_orders_organization_id_idx").on(table.organizationId),
  index("purchase_orders_job_id_idx").on(table.jobId),
]);

// Purchase Order line items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey(),
  purchaseOrderId: varchar("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: varchar("product_id").references(() => items.id, { onDelete: 'set null' }),
  itemCode: text("item_code"),
  description: text("description").notNull(),
  qty: real("qty").notNull(),
  unitCost: real("unit_cost").notNull(),
  total: real("total").notNull(),
  sortOrder: real("sort_order").default(0),
  section: text("section"),
}, (table) => [
  index("purchase_order_items_purchase_order_id_idx").on(table.purchaseOrderId),
]);

// Email tracking for sent documents
export const emailTracking = pgTable("email_tracking", {
  id: varchar("id").primaryKey(),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'report'
  documentId: varchar("document_id").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  trackingToken: varchar("tracking_token").notNull(),
  subject: text("subject"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  openedAt: timestamp("opened_at"),
  openCount: real("open_count").default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  attachedPdf: text("attached_pdf").default('false'),
}, (table) => [
  index("email_tracking_document_idx").on(table.documentType, table.documentId),
]);

// Items/Products catalog for quotes, invoices, POs
export const items = pgTable("items", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  itemCode: text("item_code").notNull(),
  supplierItemCode: text("supplier_item_code"),
  description: text("description").notNull(),
  category: text("category"),
  unit: text("unit").default('each'),
  costPrice: real("cost_price").notNull().default(0),
  sellPrice: real("sell_price").notNull().default(0),
  markup: real("markup").default(0),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name"),
  notes: text("notes"),
  isActive: text("is_active").default('true'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("items_organization_id_idx").on(table.organizationId),
]);

// Invoice payments table
export const invoicePayments = pgTable("invoice_payments", {
  id: varchar("id").primaryKey(),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull().default('bank_transfer'),
  paymentDate: text("payment_date").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("invoice_payments_invoice_id_idx").on(table.invoiceId),
]);

// Document settings table for quote/invoice defaults
export const documentSettings = pgTable("document_settings", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  type: text("type").notNull(), // 'quote' or 'invoice'
  prefix: text("prefix").default(''),
  nextNumber: real("next_number").default(1),
  defaultExpiryDays: real("default_expiry_days").default(30),
  defaultDueDays: real("default_due_days").default(14),
  defaultTerms: text("default_terms"),
  bankName: text("bank_name"),
  bsb: text("bsb"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  reminderMessage: text("reminder_message"),
  emailRemindersDefault: text("email_reminders_default").default('false'),
  smsRemindersDefault: text("sms_reminders_default").default('false'),
  customerCanAccept: text("customer_can_accept").default('true'),
  customerCanDecline: text("customer_can_decline").default('true'),
  autoMarkPaid: text("auto_mark_paid").default('false'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("document_settings_organization_id_idx").on(table.organizationId),
]);

// App-wide settings (timer toggle, feature flags, etc.)
export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("app_settings_organization_id_idx").on(table.organizationId),
]);

// Document themes for branding quotes, invoices, POs
export const documentThemes = pgTable("document_themes", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  isDefault: text("is_default").notNull().default('false'),
  isArchived: text("is_archived").notNull().default('false'),
  // Brand color
  themeColor: text("theme_color").default('#0891b2'),
  // Company contact details
  companyName: text("company_name"),
  abn: text("abn"),
  licenseNumber: text("license_number"),
  email1: text("email1"),
  email2: text("email2"),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  // Logo settings
  logoUrl: text("logo_url"),
  logoPosition: text("logo_position").default('left'), // 'left', 'center', 'right'
  // Footer links
  termsUrl: text("terms_url"),
  customLink1Label: text("custom_link1_label"),
  customLink1Url: text("custom_link1_url"),
  customLink2Label: text("custom_link2_label"),
  customLink2Url: text("custom_link2_url"),
  // Bank/Payment details
  bankName: text("bank_name"),
  bankBsb: text("bank_bsb"),
  bankAccountNumber: text("bank_account_number"),
  bankAccountName: text("bank_account_name"),
  payId: text("pay_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("document_themes_organization_id_idx").on(table.organizationId),
]);

// Document theme settings per document type (quote, invoice, purchase_order)
export const documentThemeSettings = pgTable("document_theme_settings", {
  id: varchar("id").primaryKey(),
  themeId: varchar("theme_id").notNull().references(() => documentThemes.id, { onDelete: 'cascade' }),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'purchase_order'
  // Titles
  documentTitle: text("document_title"), // e.g. "TAX INVOICE", "QUOTE", "PURCHASE ORDER"
  draftTitle: text("draft_title"), // e.g. "DRAFT INVOICE", "DRAFT QUOTE"
  // Default terms
  defaultTerms: text("default_terms"),
  // Field visibility toggles
  showJobNumber: text("show_job_number").default('true'),
  showJobAddress: text("show_job_address").default('true'),
  showReference: text("show_reference").default('true'),
  showDescription: text("show_description").default('true'),
  showQuantity: text("show_quantity").default('true'),
  showUnitPrice: text("show_unit_price").default('true'),
  showDiscount: text("show_discount").default('true'),
  showAmount: text("show_amount").default('true'),
  showNotes: text("show_notes").default('true'),
  // Description position
  descriptionPosition: text("description_position").default('below'), // 'above' or 'below' line items
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDocumentThemeSettingsSchema = createInsertSchema(documentThemeSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentThemeSettings = z.infer<typeof insertDocumentThemeSettingsSchema>;
export type DocumentThemeSettings = typeof documentThemeSettings.$inferSelect;

// Document attachments for quotes, invoices, and POs
export const documentAttachments = pgTable("document_attachments", {
  id: varchar("id").primaryKey(),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'purchase_order'
  documentId: varchar("document_id").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: real("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("document_attachments_document_idx").on(table.documentType, table.documentId),
]);

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  reports: many(reports),
  jobs: many(jobs),
  quotes: many(quotes),
  invoices: many(invoices),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  customer: one(customers, {
    fields: [reports.customerId],
    references: [customers.id],
  }),
  job: one(jobs, {
    fields: [reports.jobId],
    references: [jobs.id],
  }),
  findings: many(findings),
  estimateItems: many(estimateItems),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  report: one(reports, {
    fields: [findings.reportId],
    references: [reports.id],
  }),
}));

export const estimateItemsRelations = relations(estimateItems, ({ one }) => ({
  report: one(reports, {
    fields: [estimateItems.reportId],
    references: [reports.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  customer: one(customers, {
    fields: [jobs.customerId],
    references: [customers.id],
  }),
  reports: many(reports),
  quotes: many(quotes),
  invoices: many(invoices),
  purchaseOrders: many(purchaseOrders),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  report: one(reports, {
    fields: [quotes.reportId],
    references: [reports.id],
  }),
  job: one(jobs, {
    fields: [quotes.jobId],
    references: [jobs.id],
  }),
  items: many(quoteItems),
  invoices: many(invoices),
}));

export const quoteItemsRelations = relations(quoteItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteItems.quoteId],
    references: [quotes.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  quote: one(quotes, {
    fields: [invoices.quoteId],
    references: [quotes.id],
  }),
  job: one(jobs, {
    fields: [invoices.jobId],
    references: [jobs.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  job: one(jobs, {
    fields: [purchaseOrders.jobId],
    references: [jobs.id],
  }),
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertFindingSchema = createInsertSchema(findings);
export const insertEstimateItemSchema = createInsertSchema(estimateItems);

export const insertJobSchema = createInsertSchema(jobs).omit({
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const insertJobStatusHistorySchema = createInsertSchema(jobStatusHistory).omit({
  createdAt: true,
});

export const insertJobTemplateSchema = createInsertSchema(jobTemplates).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertJobActivitySchema = createInsertSchema(jobActivities).omit({
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  acceptedAt: true,
  declinedAt: true,
});
export const insertQuoteItemSchema = createInsertSchema(quoteItems);

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  createdAt: true,
  updatedAt: true,
  sentAt: true,
  paidAt: true,
});
export const insertInvoiceItemSchema = createInsertSchema(invoiceItems);

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems);

// Types
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findings.$inferSelect;

export type InsertEstimateItem = z.infer<typeof insertEstimateItemSchema>;
export type EstimateItem = typeof estimateItems.$inferSelect;

export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobs.$inferSelect;

export type InsertJobStatusHistory = z.infer<typeof insertJobStatusHistorySchema>;
export type JobStatusHistory = typeof jobStatusHistory.$inferSelect;

export type InsertJobTemplate = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplate = typeof jobTemplates.$inferSelect;

export type InsertJobActivity = z.infer<typeof insertJobActivitySchema>;
export type JobActivity = typeof jobActivities.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;
export type QuoteItem = typeof quoteItems.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;

export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<typeof insertPurchaseOrderItemSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof items.$inferSelect;

export const insertEmailTrackingSchema = createInsertSchema(emailTracking).omit({
  sentAt: true,
  openedAt: true,
  openCount: true,
  lastOpenedAt: true,
  ipAddress: true,
  userAgent: true,
});
export type InsertEmailTracking = z.infer<typeof insertEmailTrackingSchema>;
export type EmailTracking = typeof emailTracking.$inferSelect;

export const insertInvoicePaymentSchema = createInsertSchema(invoicePayments).omit({
  createdAt: true,
});
export type InsertInvoicePayment = z.infer<typeof insertInvoicePaymentSchema>;
export type InvoicePayment = typeof invoicePayments.$inferSelect;

export const insertDocumentSettingsSchema = createInsertSchema(documentSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocumentSettings = z.infer<typeof insertDocumentSettingsSchema>;
export type DocumentSettings = typeof documentSettings.$inferSelect;

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;

export const insertDocumentThemeSchema = createInsertSchema(documentThemes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocumentTheme = z.infer<typeof insertDocumentThemeSchema>;
export type DocumentTheme = typeof documentThemes.$inferSelect;

export const insertDocumentAttachmentSchema = createInsertSchema(documentAttachments).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentAttachment = z.infer<typeof insertDocumentAttachmentSchema>;
export type DocumentAttachment = typeof documentAttachments.$inferSelect;

// Leads table for sales pipeline
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  suburb: text("suburb"),
  postcode: text("postcode"),
  state: text("state"),
  source: text("source").notNull().default('website'),
  stage: text("stage").notNull().default('new'),
  notes: text("notes"),
  estimatedValue: real("estimated_value"),
  assignedTo: text("assigned_to"),
  nextFollowUp: timestamp("next_follow_up"),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  jobId: varchar("job_id").references(() => jobs.id),
  convertedAt: timestamp("converted_at"),
  lostReason: text("lost_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("leads_organization_id_idx").on(table.organizationId),
]);

// Lead activities/notes
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey(),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: 'cascade' }),
  type: text("type").notNull().default('note'),
  content: text("content").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lead_activities_lead_id_idx").on(table.leadId),
]);

// Lead follow-up reminders
export const leadReminders = pgTable("lead_reminders", {
  id: varchar("id").primaryKey(),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: 'cascade' }),
  reminderDate: timestamp("reminder_date").notNull(),
  message: text("message").notNull(),
  isCompleted: text("is_completed").default('false'),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lead_reminders_lead_id_idx").on(table.leadId),
]);

// Lead attachments for files (site photos, roof reports, etc.)
export const leadAttachments = pgTable("lead_attachments", {
  id: varchar("id").primaryKey(),
  leadId: varchar("lead_id").notNull().references(() => leads.id, { onDelete: 'cascade' }),
  category: text("category").notNull().default('other'), // site_photo, roof_report, quote, customer_doc, other
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: real("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  uploadedByName: text("uploaded_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("lead_attachments_lead_id_idx").on(table.leadId),
]);

// Job attachments for files (site photos, contracts, plans, etc.)
export const jobAttachments = pgTable("job_attachments", {
  id: varchar("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  category: text("category").notNull().default('other'), // site_photo, contract, plans, safety_doc, other
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: real("file_size").notNull(),
  storageKey: text("storage_key").notNull(),
  caption: text("caption"),
  uploadedBy: text("uploaded_by"),
  uploadedByName: text("uploaded_by_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("job_attachments_job_id_idx").on(table.jobId),
]);

export const insertJobAttachmentSchema = createInsertSchema(jobAttachments).omit({ createdAt: true });
export type InsertJobAttachment = z.infer<typeof insertJobAttachmentSchema>;
export type JobAttachment = typeof jobAttachments.$inferSelect;

// Crew checklists for jobs
export const crewChecklists = pgTable("crew_checklists", {
  id: varchar("id").primaryKey(),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  type: text("type").notNull().default('safety'),
  isCompleted: text("is_completed").default('false'),
  completedBy: text("completed_by"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("crew_checklists_job_id_idx").on(table.jobId),
]);

// Checklist items
export const checklistItems = pgTable("checklist_items", {
  id: varchar("id").primaryKey(),
  checklistId: varchar("checklist_id").notNull().references(() => crewChecklists.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  isChecked: text("is_checked").default('false'),
  checkedBy: text("checked_by"),
  checkedAt: timestamp("checked_at"),
  notes: text("notes"),
  sortOrder: real("sort_order").default(0),
}, (table) => [
  index("checklist_items_checklist_id_idx").on(table.checklistId),
]);

// Offline sync queue for crew mobile app
export const offlineSyncQueue = pgTable("offline_sync_queue", {
  id: varchar("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  action: text("action").notNull(),
  payload: jsonb("payload"),
  syncStatus: text("sync_status").notNull().default('pending'),
  syncedAt: timestamp("synced_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for new tables
export const insertLeadSchema = createInsertSchema(leads).omit({
  createdAt: true,
  updatedAt: true,
  convertedAt: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  createdAt: true,
});
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;
export type LeadActivity = typeof leadActivities.$inferSelect;

export const insertLeadReminderSchema = createInsertSchema(leadReminders).omit({
  createdAt: true,
  completedAt: true,
});
export type InsertLeadReminder = z.infer<typeof insertLeadReminderSchema>;
export type LeadReminder = typeof leadReminders.$inferSelect;

export const insertLeadAttachmentSchema = createInsertSchema(leadAttachments).omit({
  createdAt: true,
});
export type InsertLeadAttachment = z.infer<typeof insertLeadAttachmentSchema>;
export type LeadAttachment = typeof leadAttachments.$inferSelect;

export const insertCrewChecklistSchema = createInsertSchema(crewChecklists).omit({
  createdAt: true,
  completedAt: true,
});
export type InsertCrewChecklist = z.infer<typeof insertCrewChecklistSchema>;
export type CrewChecklist = typeof crewChecklists.$inferSelect;

export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  checkedAt: true,
});
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof checklistItems.$inferSelect;

export const insertOfflineSyncQueueSchema = createInsertSchema(offlineSyncQueue).omit({
  createdAt: true,
  syncedAt: true,
});
export type InsertOfflineSyncQueue = z.infer<typeof insertOfflineSyncQueueSchema>;
export type OfflineSyncQueue = typeof offlineSyncQueue.$inferSelect;

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey(),
  crewMemberId: varchar("crew_member_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_crew_member_id_idx").on(table.crewMemberId),
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// ============================================
// RFlash - Flashing Profile Designer
// ============================================

// Flashing materials catalog (Colorbond colors, Zinc, etc.)
export const flashingMaterials = pgTable("flashing_materials", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(), // e.g., "Monument", "Surfmist", "Zinc .55"
  brand: text("brand").default("Colorbond"), // Colorbond, Zinc, etc.
  colorCode: text("color_code"), // Hex color for preview
  isActive: text("is_active").default("true"),
  sortOrder: real("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFlashingMaterialSchema = createInsertSchema(flashingMaterials).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashingMaterial = z.infer<typeof insertFlashingMaterialSchema>;
export type FlashingMaterial = typeof flashingMaterials.$inferSelect;

// Flashing orders - main container for a set of flashings
export const flashingOrders = pgTable("flashing_orders", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  orderNumber: text("order_number").notNull(),
  jobId: varchar("job_id").references(() => jobs.id),
  purchaseOrderId: varchar("purchase_order_id").references(() => purchaseOrders.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  jobReference: text("job_reference"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  deliveryAddress: text("delivery_address"),
  deliveryMethod: text("delivery_method").default("pickup"), // pickup, delivery
  status: text("status").default("draft"), // draft, sent, completed
  notes: text("notes"),
  totalFlashings: real("total_flashings").default(0),
  totalFolds: real("total_folds").default(0),
  totalLinearMeters: real("total_linear_meters").default(0),
  totalSqm: real("total_sqm").default(0),
  pdfUrl: text("pdf_url"),
  sentAt: timestamp("sent_at"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("flashing_orders_organization_id_idx").on(table.organizationId),
]);

export const insertFlashingOrderSchema = createInsertSchema(flashingOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  sentAt: true,
});
export type InsertFlashingOrder = z.infer<typeof insertFlashingOrderSchema>;
export type FlashingOrder = typeof flashingOrders.$inferSelect;

// Individual flashing profiles within an order
export const flashingProfiles = pgTable("flashing_profiles", {
  id: varchar("id").primaryKey(),
  orderId: varchar("order_id").notNull().references(() => flashingOrders.id, { onDelete: 'cascade' }),
  code: text("code").notNull(), // A1, A2, A3, etc.
  name: text("name"), // Optional position name like "Barge Left"
  materialId: varchar("material_id").references(() => flashingMaterials.id),
  materialName: text("material_name"), // Denormalized for display
  points: jsonb("points").notNull(), // Array of {x, y} coordinates
  girth: real("girth").notNull(), // Total girth in mm
  folds: real("folds").notNull().default(2), // Number of folds
  quantity: real("quantity").notNull().default(1),
  length: real("length").notNull(), // Length in mm
  totalLinearMeters: real("total_linear_meters").notNull().default(0),
  sortOrder: real("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("flashing_profiles_order_id_idx").on(table.orderId),
]);

export const insertFlashingProfileSchema = createInsertSchema(flashingProfiles).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashingProfile = z.infer<typeof insertFlashingProfileSchema>;
export type FlashingProfile = typeof flashingProfiles.$inferSelect;

// Saved flashing templates for reuse (profile library)
export const flashingTemplates = pgTable("flashing_templates", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(), // e.g., "Standard Barge", "Valley Flashing"
  category: text("category"), // Barge, Valley, Apron, Gutter, etc.
  points: jsonb("points").notNull(), // Default points for this template
  defaultGirth: real("default_girth"),
  defaultFolds: real("default_folds").default(2),
  description: text("description"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("flashing_templates_organization_id_idx").on(table.organizationId),
]);

export const insertFlashingTemplateSchema = createInsertSchema(flashingTemplates).omit({
  id: true,
  createdAt: true,
});
export type InsertFlashingTemplate = z.infer<typeof insertFlashingTemplateSchema>;
export type FlashingTemplate = typeof flashingTemplates.$inferSelect;

// ============================================
// Organizations - Multi-tenant billing for trades/companies
// ============================================

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  businessName: text("business_name"),
  abn: text("abn"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  suburb: text("suburb"),
  state: text("state"),
  postcode: text("postcode"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trialing"),
  subscriptionPlan: text("subscription_plan").default("starter"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
  ownerId: varchar("owner_id").references(() => users.id),
  billingOverride: text("billing_override").default("none"),
  planOverride: text("plan_override"),
  overrideReason: text("override_reason"),
  overrideSetAt: timestamp("override_set_at"),
  overrideSetBy: varchar("override_set_by"),
  status: text("status").default("active"),
  suspendedAt: timestamp("suspended_at"),
  suspendedBy: varchar("suspended_by"),
  suspendedReason: text("suspended_reason"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: varchar("deleted_by"),
  timezone: text("timezone").default("Australia/Brisbane"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

// ============================================
// Tenant Migrations - Track one-time data migrations per organization
// ============================================

export const tenantMigrations = pgTable("tenant_migrations", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  migrationKey: text("migration_key").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});

export type TenantMigration = typeof tenantMigrations.$inferSelect;

// ============================================
// Admin Audit Logs - Track super admin actions
// ============================================

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: varchar("id").primaryKey(),
  adminUserId: varchar("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetOrganizationId: varchar("target_organization_id"),
  targetOrganizationName: text("target_organization_name"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// ============================================
// Document View Tokens - Secure public document access
// ============================================

export const documentViewTokens = pgTable("document_view_tokens", {
  id: varchar("id").primaryKey(),
  documentType: text("document_type").notNull(), // 'quote', 'invoice', 'purchase_order'
  documentId: varchar("document_id").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentViewTokenSchema = createInsertSchema(documentViewTokens).omit({
  id: true,
  createdAt: true,
});
export type InsertDocumentViewToken = z.infer<typeof insertDocumentViewTokenSchema>;
export type DocumentViewToken = typeof documentViewTokens.$inferSelect;

// ============================================
// Xero Integration - OAuth tokens and sync tracking
// ============================================

export const xeroConnections = pgTable("xero_connections", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  xeroTenantId: text("xero_tenant_id").notNull(),
  xeroTenantName: text("xero_tenant_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  idToken: text("id_token"),
  scope: text("scope"),
  isActive: text("is_active").default("true"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("xero_connections_organization_id_idx").on(table.organizationId),
]);

export const insertXeroConnectionSchema = createInsertSchema(xeroConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertXeroConnection = z.infer<typeof insertXeroConnectionSchema>;
export type XeroConnection = typeof xeroConnections.$inferSelect;

// Track individual sync operations
export const xeroSyncHistory = pgTable("xero_sync_history", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  syncType: text("sync_type").notNull(), // 'invoice', 'payment', 'contact'
  direction: text("direction").notNull(), // 'push' or 'pull'
  status: text("status").notNull(), // 'pending', 'success', 'error'
  recordId: varchar("record_id"), // Local ID of synced record
  xeroId: text("xero_id"), // Xero's ID for the record
  errorMessage: text("error_message"),
  details: jsonb("details"), // Additional sync details
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("xero_sync_history_organization_id_idx").on(table.organizationId),
]);

export const insertXeroSyncHistorySchema = createInsertSchema(xeroSyncHistory).omit({
  id: true,
  createdAt: true,
});
export type InsertXeroSyncHistory = z.infer<typeof insertXeroSyncHistorySchema>;
export type XeroSyncHistory = typeof xeroSyncHistory.$inferSelect;

// ============================================
// Quote Templates - AI-powered auto-quoting from roof reports
// ============================================

export const quoteTemplates = pgTable("quote_templates", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isDefault: text("is_default").notNull().default('false'),
  isActive: text("is_active").notNull().default('true'),
  // Global settings for the template
  wastePercent: real("waste_percent").default(10),
  laborMarkupPercent: real("labor_markup_percent").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("quote_templates_organization_id_idx").on(table.organizationId),
]);

export const insertQuoteTemplateSchema = createInsertSchema(quoteTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuoteTemplate = z.infer<typeof insertQuoteTemplateSchema>;
export type QuoteTemplate = typeof quoteTemplates.$inferSelect;

// Template line mappings - how measurements map to products
export const quoteTemplateMappings = pgTable("quote_template_mappings", {
  id: varchar("id").primaryKey(),
  templateId: varchar("template_id").notNull().references(() => quoteTemplates.id, { onDelete: 'cascade' }),
  // What measurement this mapping applies to
  measurementType: text("measurement_type").notNull(), // 'roof_area', 'ridges', 'eaves', 'valleys', 'hips', 'wall_flashing', 'step_flashing', 'parapet_wall', 'rakes', 'flat_area', 'pitched_area'
  // Which product to use
  productId: varchar("product_id").references(() => items.id, { onDelete: 'set null' }),
  productDescription: text("product_description"), // Fallback description if no product linked
  unitPrice: real("unit_price").default(0), // Fallback unit price when no product linked (from AI/historical data)
  // Calculation settings
  calculationType: text("calculation_type").notNull().default('per_unit'), // 'per_unit' (per m/m²), 'fixed', 'per_coverage' (e.g. 1 bundle per 3m²)
  coveragePerUnit: real("coverage_per_unit").default(1), // For 'per_coverage': how many m/m² one unit covers
  applyWaste: text("apply_waste").notNull().default('true'),
  // Labor component
  laborMinutesPerUnit: real("labor_minutes_per_unit").default(0), // Minutes of labor per unit of measurement
  laborRate: real("labor_rate").default(75), // $/hr for labor calculation
  customFormula: text("custom_formula"), // Formula expression using 'measurement' variable, e.g. "measurement * 1.1", "measurement / 0.762"
  // Display
  sortOrder: real("sort_order").default(0),
  isActive: text("is_active").notNull().default('true'),
});

export const insertQuoteTemplateMappingSchema = createInsertSchema(quoteTemplateMappings).omit({
  id: true,
});
export type InsertQuoteTemplateMapping = z.infer<typeof insertQuoteTemplateMappingSchema>;
export type QuoteTemplateMapping = typeof quoteTemplateMappings.$inferSelect;

export const savedLineSections = pgTable("saved_line_sections", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSavedLineSectionSchema = createInsertSchema(savedLineSections).omit({ id: true });
export type InsertSavedLineSection = z.infer<typeof insertSavedLineSectionSchema>;
export type SavedLineSection = typeof savedLineSections.$inferSelect;

export const savedLineSectionItems = pgTable("saved_line_section_items", {
  id: varchar("id").primaryKey(),
  sectionId: varchar("section_id").notNull().references(() => savedLineSections.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  qty: real("qty").notNull().default(1),
  unitCost: real("unit_cost").notNull().default(0),
  total: real("total").notNull().default(0),
  itemCode: text("item_code"),
  costPrice: real("cost_price").default(0),
  productId: varchar("product_id").references(() => items.id, { onDelete: 'set null' }),
  section: text("section"),
  sortOrder: real("sort_order").default(0),
});

export const insertSavedLineSectionItemSchema = createInsertSchema(savedLineSectionItems).omit({ id: true });
export type InsertSavedLineSectionItem = z.infer<typeof insertSavedLineSectionItemSchema>;
export type SavedLineSectionItem = typeof savedLineSectionItems.$inferSelect;

// Extracted roof report data (cached from AI parsing)
export const roofReportExtractions = pgTable("roof_report_extractions", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  quoteId: varchar("quote_id").references(() => quotes.id, { onDelete: 'set null' }),
  jobId: varchar("job_id").references(() => jobs.id, { onDelete: 'set null' }),
  // Source file
  filename: text("filename").notNull(),
  sourceUrl: text("source_url"),
  // Property info
  propertyAddress: text("property_address"),
  // Extracted measurements
  totalRoofArea: real("total_roof_area"), // m²
  pitchedRoofArea: real("pitched_roof_area"), // m²
  flatRoofArea: real("flat_roof_area"), // m²
  predominantPitch: real("predominant_pitch"), // degrees
  facetCount: real("facet_count"),
  // Linear measurements (meters)
  eaves: real("eaves"),
  ridges: real("ridges"),
  valleys: real("valleys"),
  hips: real("hips"),
  rakes: real("rakes"),
  wallFlashing: real("wall_flashing"),
  stepFlashing: real("step_flashing"),
  parapetWall: real("parapet_wall"),
  transitions: real("transitions"),
  // Raw JSON from AI for additional data
  rawExtraction: jsonb("raw_extraction"),
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("roof_report_extractions_organization_id_idx").on(table.organizationId),
]);

export const insertRoofReportExtractionSchema = createInsertSchema(roofReportExtractions).omit({
  id: true,
  createdAt: true,
  extractedAt: true,
});
export type InsertRoofReportExtraction = z.infer<typeof insertRoofReportExtractionSchema>;
export type RoofReportExtraction = typeof roofReportExtractions.$inferSelect;

// ============================================
// Settings Migrations - Track settings changes for prod sync
// ============================================

export const settingsMigrations = pgTable("settings_migrations", {
  id: varchar("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: varchar("record_id").notNull(),
  organizationId: varchar("organization_id"),
  operation: text("operation").notNull(), // 'insert', 'update', 'delete'
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  status: text("status").notNull().default("pending"), // 'pending', 'applied', 'skipped'
  appliedAt: timestamp("applied_at"),
  appliedBy: varchar("applied_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("settings_migrations_organization_id_idx").on(table.organizationId),
]);

export const insertSettingsMigrationSchema = createInsertSchema(settingsMigrations).omit({
  id: true,
  createdAt: true,
});
export type InsertSettingsMigration = z.infer<typeof insertSettingsMigrationSchema>;
export type SettingsMigration = typeof settingsMigrations.$inferSelect;

// ============================================
// ML Pricing Patterns - Historical pricing data for ML
// ============================================

export const mlPricingPatterns = pgTable("ml_pricing_patterns", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  itemDescription: text("item_description").notNull(),
  normalizedKey: text("normalized_key").notNull(), // lowercase, trimmed for matching
  avgUnitPrice: real("avg_unit_price").notNull(),
  minUnitPrice: real("min_unit_price"),
  maxUnitPrice: real("max_unit_price"),
  avgQuantity: real("avg_quantity"),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  totalRevenue: real("total_revenue").default(0),
  source: text("source").notNull().default("tradify"), // 'tradify', 'rprime', 'manual'
  // Product catalog linking
  productId: varchar("product_id"), // Links to items.id
  itemCode: text("item_code"), // Links to items.itemCode
  costPrice: real("cost_price"), // Cost price from product catalog
  markupPercentage: real("markup_percentage"), // Markup % = (sellPrice - costPrice) / costPrice * 100
  unit: text("unit"), // Unit of measurement from product
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ml_pricing_patterns_organization_id_idx").on(table.organizationId),
]);

export const insertMlPricingPatternSchema = createInsertSchema(mlPricingPatterns).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertMlPricingPattern = z.infer<typeof insertMlPricingPatternSchema>;
export type MlPricingPattern = typeof mlPricingPatterns.$inferSelect;

// ML Import Sessions - Track CSV imports
export const mlImportSessions = pgTable("ml_import_sessions", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  filename: text("filename").notNull(),
  source: text("source").notNull().default("tradify"),
  totalQuotes: integer("total_quotes").default(0),
  acceptedQuotes: integer("accepted_quotes").default(0),
  totalLineItems: integer("total_line_items").default(0),
  uniquePatterns: integer("unique_patterns").default(0),
  status: text("status").notNull().default("processing"), // 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("ml_import_sessions_organization_id_idx").on(table.organizationId),
]);

export const insertMlImportSessionSchema = createInsertSchema(mlImportSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertMlImportSession = z.infer<typeof insertMlImportSessionSchema>;
export type MlImportSession = typeof mlImportSessions.$inferSelect;

// ============================================
// Feedback Events - AI-powered debugging tool
// ============================================

export const feedbackEvents = pgTable("feedback_events", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id"),
  eventType: text("event_type").notNull(), // 'error', 'api_failure', 'user_action', 'performance', 'data_issue'
  severity: text("severity").notNull().default('info'), // 'critical', 'error', 'warning', 'info'
  message: text("message").notNull(),
  context: jsonb("context"), // Additional context like URL, component, user agent
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"), // API response, timing data, etc
  userEmail: text("user_email"),
  resolved: text("resolved").notNull().default('false'),
  aiAnalysis: text("ai_analysis"), // AI-generated analysis of this event
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high', 'critical'
  assignedTo: varchar("assigned_to"), // references crew member id
  resolutionNotes: text("resolution_notes"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"), // user id who resolved
  groupId: varchar("group_id"), // for grouping similar errors
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFeedbackEventSchema = createInsertSchema(feedbackEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertFeedbackEvent = z.infer<typeof insertFeedbackEventSchema>;
export type FeedbackEvent = typeof feedbackEvents.$inferSelect;

// ============================================
// User Behavior Events - UX behavior tracking
// ============================================

export const userBehaviorEvents = pgTable("user_behavior_events", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id"),
  sessionId: varchar("session_id"), // to group events in a session
  eventType: text("event_type").notNull(), // 'rage_click', 'dead_click', 'abandonment', 'thrashing', 'slow_action', 'scroll_confusion'
  elementSelector: text("element_selector"), // the element involved
  pageUrl: text("page_url"),
  context: jsonb("context"), // additional data like click count, duration, etc.
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserBehaviorEventSchema = createInsertSchema(userBehaviorEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertUserBehaviorEvent = z.infer<typeof insertUserBehaviorEventSchema>;
export type UserBehaviorEvent = typeof userBehaviorEvents.$inferSelect;

// ============================================
// In-App Notifications for crew members
// ============================================

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey(),
  organizationId: varchar("organization_id").notNull(),
  recipientCrewMemberId: varchar("recipient_crew_member_id").notNull(),
  type: text("type").notNull(), // 'appointment_created', 'appointment_updated', 'appointment_reminder'
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: text("read").notNull().default('false'),
  metadata: jsonb("metadata"), // { appointmentId, jobId, etc. }
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("notifications_recipient_idx").on(table.recipientCrewMemberId),
  index("notifications_organization_idx").on(table.organizationId),
]);

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

