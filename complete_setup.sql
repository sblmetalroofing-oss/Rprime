
-- 1. Create ORGANIZATIONS (Full Schema)
-- If it exists from previous manual setup, we drop and recreate as that one was incomplete.
-- WARNING: This will delete existing organization data if any.
DROP TABLE IF EXISTS "organizations" CASCADE;
CREATE TABLE "organizations" (
  "id" varchar PRIMARY KEY,
  "name" text NOT NULL,
  "business_name" text,
  "abn" text,
  "email" text,
  "phone" text,
  "address" text,
  "suburb" text,
  "state" text,
  "postcode" text,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "subscription_status" text DEFAULT 'trialing',
  "subscription_plan" text DEFAULT 'starter',
  "trial_ends_at" timestamp,
  "current_period_end" timestamp,
  "owner_id" varchar,
  "billing_override" text DEFAULT 'none',
  "plan_override" text,
  "override_reason" text,
  "override_set_at" timestamp,
  "override_set_by" varchar,
  "status" text DEFAULT 'active',
  "suspended_at" timestamp,
  "suspended_by" varchar,
  "suspended_reason" text,
  "deleted_at" timestamp,
  "deleted_by" varchar,
  "timezone" text DEFAULT 'Australia/Brisbane',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 2. CUSTOMERS
CREATE TABLE IF NOT EXISTS "customers" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "address" text,
  "suburb" text,
  "postcode" text,
  "state" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customers_organization_id_idx" ON "customers" ("organization_id");

-- 3. SUPPLIERS
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "contact_name" text,
  "email" text,
  "phone" text,
  "address" text,
  "suburb" text,
  "postcode" text,
  "state" text,
  "account_number" text,
  "payment_terms" text,
  "notes" text,
  "is_active" text DEFAULT 'true' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "suppliers_organization_id_idx" ON "suppliers" ("organization_id");

-- 4. REPORTS
CREATE TABLE IF NOT EXISTS "reports" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "customer_id" varchar REFERENCES "customers"("id"),
  "job_id" varchar,
  "theme_id" varchar,
  "customer_name" text NOT NULL,
  "contact_phone" text,
  "address" text NOT NULL,
  "suburb" text NOT NULL,
  "date" text NOT NULL,
  "inspector" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "roof_type" text NOT NULL,
  "roof_pitch" text,
  "storeys" text,
  "access_method" text,
  "measurements" jsonb,
  "total_estimates" real DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "reports_organization_id_idx" ON "reports" ("organization_id");
CREATE INDEX IF NOT EXISTS "reports_customer_id_idx" ON "reports" ("customer_id");

-- 5. FINDINGS
CREATE TABLE IF NOT EXISTS "findings" (
  "id" varchar PRIMARY KEY,
  "report_id" varchar NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "severity" text NOT NULL,
  "description" text NOT NULL,
  "recommendation" text NOT NULL,
  "photo_url" text,
  "photo_urls" text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "findings_report_id_idx" ON "findings" ("report_id");

-- 6. ESTIMATE ITEMS
CREATE TABLE IF NOT EXISTS "estimate_items" (
  "id" varchar PRIMARY KEY,
  "report_id" varchar NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "qty" real NOT NULL,
  "unit_cost" real NOT NULL,
  "markup" real DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "estimate_items_report_id_idx" ON "estimate_items" ("report_id");

-- 7. JOBS
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "reference_number" text,
  "builder_reference" text,
  "customer_id" varchar REFERENCES "customers"("id"),
  "title" text NOT NULL,
  "description" text,
  "address" text NOT NULL,
  "suburb" text,
  "scheduled_date" text,
  "scheduled_time" text,
  "estimated_duration" real,
  "status" text DEFAULT 'intake' NOT NULL,
  "priority" text DEFAULT 'normal' NOT NULL,
  "assigned_to" text[],
  "notes" text,
  "labor_hours" real,
  "labor_rate" real DEFAULT 75,
  "completed_at" timestamp,
  "timer_started_at" timestamp,
  "timer_total_seconds" real DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "jobs_organization_id_idx" ON "jobs" ("organization_id");
CREATE INDEX IF NOT EXISTS "jobs_customer_id_idx" ON "jobs" ("customer_id");

-- 8. JOB STATUS HISTORY
CREATE TABLE IF NOT EXISTS "job_status_history" (
  "id" varchar PRIMARY KEY,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "from_status" text,
  "to_status" text NOT NULL,
  "changed_by" text,
  "note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_status_history_job_id_idx" ON "job_status_history" ("job_id");

-- 9. JOB TEMPLATES
CREATE TABLE IF NOT EXISTS "job_templates" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "default_title" text NOT NULL,
  "default_description" text,
  "estimated_duration" real,
  "priority" text DEFAULT 'normal' NOT NULL,
  "category" text,
  "is_active" text DEFAULT 'true' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_templates_organization_id_idx" ON "job_templates" ("organization_id");

-- 10. JOB ACTIVITIES
CREATE TABLE IF NOT EXISTS "job_activities" (
  "id" varchar PRIMARY KEY,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "type" text DEFAULT 'note' NOT NULL,
  "content" text NOT NULL,
  "attachments" text[],
  "created_by" text,
  "created_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_activities_job_id_idx" ON "job_activities" ("job_id");

-- 11. CREW MEMBERS
CREATE TABLE IF NOT EXISTS "crew_members" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "role" text DEFAULT 'tradesperson' NOT NULL,
  "hourly_rate" real DEFAULT 75,
  "color" text DEFAULT '#3e4f61',
  "is_active" text DEFAULT 'true' NOT NULL,
  "is_admin" text DEFAULT 'false' NOT NULL,
  "can_view_all_jobs" text DEFAULT 'false' NOT NULL,
  "can_edit_jobs" text DEFAULT 'true' NOT NULL,
  "can_view_financials" text DEFAULT 'false' NOT NULL,
  "can_access_settings" text DEFAULT 'false' NOT NULL,
  "invite_token" text,
  "invite_status" text DEFAULT 'pending' NOT NULL,
  "invite_sent_at" timestamp,
  "user_id" varchar,
  "dashboard_widgets" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "crew_members_organization_id_idx" ON "crew_members" ("organization_id");

-- 12. APPOINTMENTS
CREATE TABLE IF NOT EXISTS "appointments" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "location" text,
  "scheduled_date" text NOT NULL,
  "scheduled_time" text,
  "end_time" text,
  "assigned_to" text[],
  "job_id" varchar REFERENCES "jobs"("id"),
  "created_by" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "appointments_organization_id_idx" ON "appointments" ("organization_id");

-- 13. QUOTES
CREATE TABLE IF NOT EXISTS "quotes" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "quote_number" text NOT NULL,
  "customer_id" varchar REFERENCES "customers"("id"),
  "report_id" varchar REFERENCES "reports"("id"),
  "job_id" varchar REFERENCES "jobs"("id"),
  "theme_id" varchar,
  "customer_name" text NOT NULL,
  "customer_email" text,
  "customer_phone" text,
  "address" text NOT NULL,
  "suburb" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "valid_until" text,
  "reference" text,
  "description" text,
  "discount" real DEFAULT 0,
  "subtotal" real DEFAULT 0 NOT NULL,
  "gst" real DEFAULT 0 NOT NULL,
  "total" real DEFAULT 0 NOT NULL,
  "total_cost" real DEFAULT 0,
  "gross_profit" real DEFAULT 0,
  "notes" text,
  "terms" text,
  "email_reminders" text DEFAULT 'false',
  "sms_reminders" text DEFAULT 'false',
  "sent_at" timestamp,
  "accepted_at" timestamp,
  "declined_at" timestamp,
  "decline_reason" text,
  "applied_markup_percent" real DEFAULT 100,
  "created_by" text,
  "created_by_name" text,
  "sent_by" text,
  "sent_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "quotes_organization_id_idx" ON "quotes" ("organization_id");
CREATE INDEX IF NOT EXISTS "quotes_customer_id_idx" ON "quotes" ("customer_id");
CREATE INDEX IF NOT EXISTS "quotes_job_id_idx" ON "quotes" ("job_id");

-- 14. ITEMS (Products)
CREATE TABLE IF NOT EXISTS "items" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "item_code" text NOT NULL,
  "supplier_item_code" text,
  "description" text NOT NULL,
  "category" text,
  "unit" text DEFAULT 'each',
  "cost_price" real DEFAULT 0 NOT NULL,
  "sell_price" real DEFAULT 0 NOT NULL,
  "markup" real DEFAULT 0,
  "supplier_id" varchar REFERENCES "suppliers"("id"),
  "supplier_name" text,
  "notes" text,
  "is_active" text DEFAULT 'true',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "items_organization_id_idx" ON "items" ("organization_id");

-- 15. QUOTE ITEMS
CREATE TABLE IF NOT EXISTS "quote_items" (
  "id" varchar PRIMARY KEY,
  "quote_id" varchar NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "product_id" varchar REFERENCES "items"("id") ON DELETE SET NULL,
  "item_code" text,
  "description" text NOT NULL,
  "qty" real NOT NULL,
  "unit_cost" real NOT NULL,
  "cost_price" real DEFAULT 0,
  "total" real NOT NULL,
  "sort_order" real DEFAULT 0,
  "section" text
);
CREATE INDEX IF NOT EXISTS "quote_items_quote_id_idx" ON "quote_items" ("quote_id");

-- 16. INVOICES
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "invoice_number" text NOT NULL,
  "customer_id" varchar REFERENCES "customers"("id"),
  "quote_id" varchar REFERENCES "quotes"("id"),
  "job_id" varchar REFERENCES "jobs"("id"),
  "theme_id" varchar,
  "customer_name" text NOT NULL,
  "customer_email" text,
  "customer_phone" text,
  "address" text NOT NULL,
  "suburb" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "issue_date" text NOT NULL,
  "due_date" text NOT NULL,
  "reference" text,
  "description" text,
  "discount" real DEFAULT 0,
  "subtotal" real DEFAULT 0 NOT NULL,
  "gst" real DEFAULT 0 NOT NULL,
  "total" real DEFAULT 0 NOT NULL,
  "amount_paid" real DEFAULT 0 NOT NULL,
  "notes" text,
  "terms" text,
  "email_reminders" text DEFAULT 'false',
  "sms_reminders" text DEFAULT 'false',
  "credit_card_enabled" text DEFAULT 'false',
  "surcharge_passthrough" text DEFAULT 'false',
  "sent_at" timestamp,
  "paid_at" timestamp,
  "invoice_type" text DEFAULT 'standard',
  "deposit_percent" real,
  "created_by" text,
  "created_by_name" text,
  "sent_by" text,
  "sent_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invoices_organization_id_idx" ON "invoices" ("organization_id");
CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_job_id_idx" ON "invoices" ("job_id");
CREATE INDEX IF NOT EXISTS "invoices_quote_id_idx" ON "invoices" ("quote_id");

-- 17. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS "invoice_items" (
  "id" varchar PRIMARY KEY,
  "invoice_id" varchar NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "product_id" varchar REFERENCES "items"("id") ON DELETE SET NULL,
  "item_code" text,
  "description" text NOT NULL,
  "qty" real NOT NULL,
  "unit_cost" real NOT NULL,
  "cost_price" real DEFAULT 0,
  "total" real NOT NULL,
  "sort_order" real DEFAULT 0,
  "section" text
);
CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx" ON "invoice_items" ("invoice_id");

-- 18. PURCHASE ORDERS
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "po_number" text NOT NULL,
  "job_id" varchar REFERENCES "jobs"("id"),
  "theme_id" varchar,
  "supplier_id" varchar REFERENCES "suppliers"("id"),
  "supplier" text NOT NULL,
  "supplier_contact" text,
  "supplier_phone" text,
  "supplier_email" text,
  "status" text DEFAULT 'draft' NOT NULL,
  "order_date" text,
  "expected_delivery" text,
  "delivery_address" text,
  "delivery_instructions" text,
  "reference" text,
  "description" text,
  "discount" real DEFAULT 0 NOT NULL,
  "subtotal" real DEFAULT 0 NOT NULL,
  "gst" real DEFAULT 0 NOT NULL,
  "total" real DEFAULT 0 NOT NULL,
  "tax_mode" text DEFAULT 'exclusive' NOT NULL,
  "notes" text,
  "created_by" text,
  "created_by_name" text,
  "sent_by" text,
  "sent_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "purchase_orders_organization_id_idx" ON "purchase_orders" ("organization_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_job_id_idx" ON "purchase_orders" ("job_id");

-- 19. PURCHASE ORDER ITEMS
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" varchar PRIMARY KEY,
  "purchase_order_id" varchar NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
  "product_id" varchar REFERENCES "items"("id") ON DELETE SET NULL,
  "item_code" text,
  "description" text NOT NULL,
  "qty" real NOT NULL,
  "unit_cost" real NOT NULL,
  "total" real NOT NULL,
  "sort_order" real DEFAULT 0,
  "section" text
);
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items" ("purchase_order_id");

-- 20. EMAIL TRACKING
CREATE TABLE IF NOT EXISTS "email_tracking" (
  "id" varchar PRIMARY KEY,
  "document_type" text NOT NULL,
  "document_id" varchar NOT NULL,
  "recipient_email" text NOT NULL,
  "recipient_name" text,
  "tracking_token" varchar NOT NULL,
  "subject" text,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "opened_at" timestamp,
  "open_count" real DEFAULT 0,
  "last_opened_at" timestamp,
  "ip_address" text,
  "user_agent" text,
  "attached_pdf" text DEFAULT 'false'
);
CREATE INDEX IF NOT EXISTS "email_tracking_document_idx" ON "email_tracking" ("document_type", "document_id");

-- 21. INVOICE PAYMENTS
CREATE TABLE IF NOT EXISTS "invoice_payments" (
  "id" varchar PRIMARY KEY,
  "invoice_id" varchar NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "amount" real NOT NULL,
  "payment_method" text DEFAULT 'bank_transfer' NOT NULL,
  "payment_date" text NOT NULL,
  "reference" text,
  "notes" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invoice_payments_invoice_id_idx" ON "invoice_payments" ("invoice_id");

-- 22. DOCUMENT SETTINGS
CREATE TABLE IF NOT EXISTS "document_settings" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "type" text NOT NULL,
  "prefix" text DEFAULT '',
  "next_number" real DEFAULT 1,
  "default_expiry_days" real DEFAULT 30,
  "default_due_days" real DEFAULT 14,
  "default_terms" text,
  "bank_name" text,
  "bsb" text,
  "account_number" text,
  "account_name" text,
  "reminder_message" text,
  "email_reminders_default" text DEFAULT 'false',
  "sms_reminders_default" text DEFAULT 'false',
  "customer_can_accept" text DEFAULT 'true',
  "customer_can_decline" text DEFAULT 'true',
  "auto_mark_paid" text DEFAULT 'false',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "document_settings_organization_id_idx" ON "document_settings" ("organization_id");

-- 23. APP SETTINGS
CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "app_settings_organization_id_idx" ON "app_settings" ("organization_id");

-- 24. DOCUMENT THEMES
CREATE TABLE IF NOT EXISTS "document_themes" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "is_default" text DEFAULT 'false' NOT NULL,
  "is_archived" text DEFAULT 'false' NOT NULL,
  "theme_color" text DEFAULT '#0891b2',
  "company_name" text,
  "abn" text,
  "license_number" text,
  "email1" text,
  "email2" text,
  "phone" text,
  "website" text,
  "address" text,
  "logo_url" text,
  "logo_position" text DEFAULT 'left',
  "terms_url" text,
  "custom_link1_label" text,
  "custom_link1_url" text,
  "custom_link2_label" text,
  "custom_link2_url" text,
  "bank_name" text,
  "bank_bsb" text,
  "bank_account_number" text,
  "bank_account_name" text,
  "pay_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "document_themes_organization_id_idx" ON "document_themes" ("organization_id");

-- 25. DOCUMENT THEME SETTINGS
CREATE TABLE IF NOT EXISTS "document_theme_settings" (
  "id" varchar PRIMARY KEY,
  "theme_id" varchar NOT NULL REFERENCES "document_themes"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL,
  "document_title" text,
  "draft_title" text,
  "default_terms" text,
  "show_job_number" text DEFAULT 'true',
  "show_job_address" text DEFAULT 'true',
  "show_reference" text DEFAULT 'true',
  "show_description" text DEFAULT 'true',
  "show_quantity" text DEFAULT 'true',
  "show_unit_price" text DEFAULT 'true',
  "show_discount" text DEFAULT 'true',
  "show_amount" text DEFAULT 'true',
  "show_notes" text DEFAULT 'true',
  "description_position" text DEFAULT 'below',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 26. DOCUMENT ATTACHMENTS
CREATE TABLE IF NOT EXISTS "document_attachments" (
  "id" varchar PRIMARY KEY,
  "document_type" text NOT NULL,
  "document_id" varchar NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "file_size" real NOT NULL,
  "storage_key" text NOT NULL,
  "uploaded_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "document_attachments_document_idx" ON "document_attachments" ("document_type", "document_id");

---- Additional Tables (Leads, Flashing, etc.) ---
-- 27. LEADS
CREATE TABLE IF NOT EXISTS "leads" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "email" text,
  "phone" text,
  "address" text,
  "suburb" text,
  "postcode" text,
  "state" text,
  "source" text DEFAULT 'website' NOT NULL,
  "stage" text DEFAULT 'new' NOT NULL,
  "notes" text,
  "estimated_value" real,
  "assigned_to" text,
  "next_follow_up" timestamp,
  "customer_id" varchar REFERENCES "customers"("id"),
  "quote_id" varchar REFERENCES "quotes"("id"),
  "job_id" varchar REFERENCES "jobs"("id"),
  "converted_at" timestamp,
  "lost_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "leads_organization_id_idx" ON "leads" ("organization_id");

-- 28. LEAD ACTIVITIES
CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" varchar PRIMARY KEY,
  "lead_id" varchar NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "type" text DEFAULT 'note' NOT NULL,
  "content" text NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_idx" ON "lead_activities" ("lead_id");

-- 29. LEAD REMINDERS
CREATE TABLE IF NOT EXISTS "lead_reminders" (
  "id" varchar PRIMARY KEY,
  "lead_id" varchar NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "reminder_date" timestamp NOT NULL,
  "message" text NOT NULL,
  "is_completed" text DEFAULT 'false',
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_reminders_lead_id_idx" ON "lead_reminders" ("lead_id");

-- 30. LEAD ATTACHMENTS
CREATE TABLE IF NOT EXISTS "lead_attachments" (
  "id" varchar PRIMARY KEY,
  "lead_id" varchar NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "category" text DEFAULT 'other' NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "file_size" real NOT NULL,
  "storage_key" text NOT NULL,
  "caption" text,
  "uploaded_by" text,
  "uploaded_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "lead_attachments_lead_id_idx" ON "lead_attachments" ("lead_id");

-- 31. JOB ATTACHMENTS
CREATE TABLE IF NOT EXISTS "job_attachments" (
  "id" varchar PRIMARY KEY,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "category" text DEFAULT 'other' NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "file_size" real NOT NULL,
  "storage_key" text NOT NULL,
  "caption" text,
  "uploaded_by" text,
  "uploaded_by_name" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "job_attachments_job_id_idx" ON "job_attachments" ("job_id");

-- 32. CREW CHECKLISTS
CREATE TABLE IF NOT EXISTS "crew_checklists" (
  "id" varchar PRIMARY KEY,
  "job_id" varchar NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" text DEFAULT 'safety' NOT NULL,
  "is_completed" text DEFAULT 'false',
  "completed_by" text,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "crew_checklists_job_id_idx" ON "crew_checklists" ("job_id");

-- 33. CHECKLIST ITEMS
CREATE TABLE IF NOT EXISTS "checklist_items" (
  "id" varchar PRIMARY KEY,
  "checklist_id" varchar NOT NULL REFERENCES "crew_checklists"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "is_checked" text DEFAULT 'false',
  "checked_by" text,
  "checked_at" timestamp,
  "notes" text,
  "sort_order" real DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "checklist_items_checklist_id_idx" ON "checklist_items" ("checklist_id");

-- 34. OFFLINE SYNC QUEUE
CREATE TABLE IF NOT EXISTS "offline_sync_queue" (
  "id" varchar PRIMARY KEY,
  "device_id" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" varchar NOT NULL,
  "action" text NOT NULL,
  "payload" jsonb,
  "sync_status" text DEFAULT 'pending' NOT NULL,
  "synced_at" timestamp,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 35. PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" varchar PRIMARY KEY,
  "crew_member_id" varchar NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "push_subscriptions_crew_member_id_idx" ON "push_subscriptions" ("crew_member_id");

-- 36. FLASHING MATERIALS
CREATE TABLE IF NOT EXISTS "flashing_materials" (
  "id" varchar PRIMARY KEY,
  "name" text NOT NULL,
  "brand" text DEFAULT 'Colorbond',
  "color_code" text,
  "is_active" text DEFAULT 'true',
  "sort_order" real DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 37. FLASHING ORDERS
CREATE TABLE IF NOT EXISTS "flashing_orders" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "order_number" text NOT NULL,
  "job_id" varchar REFERENCES "jobs"("id"),
  "purchase_order_id" varchar REFERENCES "purchase_orders"("id"),
  "supplier_id" varchar REFERENCES "suppliers"("id"),
  "job_reference" text,
  "contact_name" text,
  "contact_phone" text,
  "delivery_address" text,
  "delivery_method" text DEFAULT 'pickup',
  "status" text DEFAULT 'draft',
  "notes" text,
  "total_flashings" real DEFAULT 0,
  "total_folds" real DEFAULT 0,
  "total_linear_meters" real DEFAULT 0,
  "total_sqm" real DEFAULT 0,
  "pdf_url" text,
  "sent_at" timestamp,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "flashing_orders_organization_id_idx" ON "flashing_orders" ("organization_id");

-- 38. FLASHING PROFILES
CREATE TABLE IF NOT EXISTS "flashing_profiles" (
  "id" varchar PRIMARY KEY,
  "order_id" varchar NOT NULL REFERENCES "flashing_orders"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "name" text,
  "material_id" varchar REFERENCES "flashing_materials"("id"),
  "material_name" text,
  "points" jsonb NOT NULL,
  "girth" real NOT NULL,
  "folds" real DEFAULT 2 NOT NULL,
  "quantity" real DEFAULT 1 NOT NULL,
  "length" real NOT NULL,
  "total_linear_meters" real DEFAULT 0 NOT NULL,
  "sort_order" real DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "flashing_profiles_order_id_idx" ON "flashing_profiles" ("order_id");

-- 39. FLASHING TEMPLATES
CREATE TABLE IF NOT EXISTS "flashing_templates" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "points" jsonb NOT NULL,
  "default_girth" real,
  "default_folds" real DEFAULT 2,
  "description" text,
  "is_active" text DEFAULT 'true',
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "flashing_templates_organization_id_idx" ON "flashing_templates" ("organization_id");

-- 40. TENANT MIGRATIONS
CREATE TABLE IF NOT EXISTS "tenant_migrations" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "migration_key" text NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);

-- 41. ADMIN AUDIT LOGS
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id" varchar PRIMARY KEY,
  "admin_user_id" varchar NOT NULL,
  "action" text NOT NULL,
  "target_organization_id" varchar,
  "target_organization_name" text,
  "details" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 42. DOCUMENT VIEW TOKENS
CREATE TABLE IF NOT EXISTS "document_view_tokens" (
  "id" varchar PRIMARY KEY,
  "document_type" text NOT NULL,
  "document_id" varchar NOT NULL,
  "token" varchar NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 43. XERO CONNECTIONS
CREATE TABLE IF NOT EXISTS "xero_connections" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "xero_tenant_id" text NOT NULL,
  "xero_tenant_name" text,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp NOT NULL,
  "id_token" text,
  "scope" text,
  "is_active" text DEFAULT 'true',
  "last_sync_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "xero_connections_organization_id_idx" ON "xero_connections" ("organization_id");

-- 44. XERO SYNC HISTORY
CREATE TABLE IF NOT EXISTS "xero_sync_history" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "sync_type" text NOT NULL,
  "direction" text NOT NULL,
  "status" text NOT NULL,
  "record_id" varchar,
  "xero_id" text,
  "error_message" text,
  "details" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "xero_sync_history_organization_id_idx" ON "xero_sync_history" ("organization_id");

-- 45. QUOTE TEMPLATES
CREATE TABLE IF NOT EXISTS "quote_templates" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "is_default" text DEFAULT 'false' NOT NULL,
  "is_active" text DEFAULT 'true' NOT NULL,
  "waste_percent" real DEFAULT 10,
  "labor_markup_percent" real DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "quote_templates_organization_id_idx" ON "quote_templates" ("organization_id");

-- 46. QUOTE TEMPLATE MAPPINGS
CREATE TABLE IF NOT EXISTS "quote_template_mappings" (
  "id" varchar PRIMARY KEY,
  "template_id" varchar NOT NULL REFERENCES "quote_templates"("id") ON DELETE CASCADE,
  "measurement_type" text NOT NULL,
  "product_id" varchar REFERENCES "items"("id") ON DELETE SET NULL,
  "product_description" text,
  "unit_price" real DEFAULT 0,
  "calculation_type" text DEFAULT 'per_unit' NOT NULL,
  "coverage_per_unit" real DEFAULT 1,
  "apply_waste" text DEFAULT 'true' NOT NULL,
  "labor_minutes_per_unit" real DEFAULT 0,
  "labor_rate" real DEFAULT 75,
  "custom_formula" text,
  "sort_order" real DEFAULT 0,
  "is_active" text DEFAULT 'true' NOT NULL
);

-- 47. SAVED LINE SECTIONS
CREATE TABLE IF NOT EXISTS "saved_line_sections" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now()
);

-- 48. SAVED LINE SECTION ITEMS
CREATE TABLE IF NOT EXISTS "saved_line_section_items" (
  "id" varchar PRIMARY KEY,
  "section_id" varchar NOT NULL REFERENCES "saved_line_sections"("id") ON DELETE CASCADE,
  "description" text NOT NULL,
  "qty" real DEFAULT 1 NOT NULL,
  "unit_cost" real DEFAULT 0 NOT NULL,
  "total" real DEFAULT 0 NOT NULL,
  "item_code" text,
  "cost_price" real DEFAULT 0,
  "product_id" varchar REFERENCES "items"("id") ON DELETE SET NULL,
  "section" text,
  "sort_order" real DEFAULT 0
);

-- 49. ROOF REPORT EXTRACTIONS
CREATE TABLE IF NOT EXISTS "roof_report_extractions" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "quote_id" varchar REFERENCES "quotes"("id") ON DELETE SET NULL,
  "job_id" varchar REFERENCES "jobs"("id") ON DELETE SET NULL,
  "filename" text NOT NULL,
  "source_url" text,
  "property_address" text,
  "total_roof_area" real,
  "pitched_roof_area" real,
  "flat_roof_area" real,
  "predominant_pitch" real,
  "facet_count" real,
  "eaves" real,
  "ridges" real,
  "valleys" real,
  "hips" real,
  "rakes" real,
  "wall_flashing" real,
  "step_flashing" real,
  "parapet_wall" real,
  "transitions" real,
  "raw_extraction" jsonb,
  "extracted_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "roof_report_extractions_organization_id_idx" ON "roof_report_extractions" ("organization_id");

-- 50. SETTINGS MIGRATIONS
CREATE TABLE IF NOT EXISTS "settings_migrations" (
  "id" varchar PRIMARY KEY,
  "table_name" text NOT NULL,
  "record_id" varchar NOT NULL,
  "organization_id" varchar,
  "operation" text NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "status" text DEFAULT 'pending' NOT NULL,
  "applied_at" timestamp,
  "applied_by" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "settings_migrations_organization_id_idx" ON "settings_migrations" ("organization_id");

-- 51. ML PRICING PATTERNS
CREATE TABLE IF NOT EXISTS "ml_pricing_patterns" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "item_description" text NOT NULL,
  "normalized_key" text NOT NULL,
  "avg_unit_price" real NOT NULL,
  "min_unit_price" real,
  "max_unit_price" real,
  "avg_quantity" real,
  "occurrence_count" integer DEFAULT 1 NOT NULL,
  "total_revenue" real DEFAULT 0,
  "source" text DEFAULT 'tradify' NOT NULL,
  "product_id" varchar,
  "item_code" text,
  "cost_price" real,
  "markup_percentage" real,
  "unit" text,
  "last_updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ml_pricing_patterns_organization_id_idx" ON "ml_pricing_patterns" ("organization_id");

-- 52. ML IMPORT SESSIONS
CREATE TABLE IF NOT EXISTS "ml_import_sessions" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "filename" text NOT NULL,
  "source" text DEFAULT 'tradify' NOT NULL,
  "total_quotes" integer DEFAULT 0,
  "accepted_quotes" integer DEFAULT 0,
  "total_line_items" integer DEFAULT 0,
  "unique_patterns" integer DEFAULT 0,
  "status" text DEFAULT 'processing' NOT NULL,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ml_import_sessions_organization_id_idx" ON "ml_import_sessions" ("organization_id");

-- 53. FEEDBACK EVENTS
CREATE TABLE IF NOT EXISTS "feedback_events" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar,
  "user_id" varchar,
  "event_type" text NOT NULL,
  "severity" text DEFAULT 'info' NOT NULL,
  "message" text NOT NULL,
  "context" jsonb,
  "stack_trace" text,
  "metadata" jsonb,
  "user_email" text,
  "resolved" text DEFAULT 'false' NOT NULL,
  "ai_analysis" text,
  "priority" text DEFAULT 'medium' NOT NULL,
  "assigned_to" varchar,
  "resolution_notes" text,
  "resolved_at" timestamp,
  "resolved_by" varchar,
  "group_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 54. USER BEHAVIOR EVENTS
CREATE TABLE IF NOT EXISTS "user_behavior_events" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar,
  "user_id" varchar,
  "session_id" varchar,
  "event_type" text NOT NULL,
  "element_selector" text,
  "page_url" text,
  "context" jsonb,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 55. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" varchar PRIMARY KEY,
  "organization_id" varchar NOT NULL,
  "recipient_crew_member_id" varchar NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "is_read" text DEFAULT 'false',
  "action_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
