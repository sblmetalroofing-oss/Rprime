-- RUN THIS IN NEON SQL EDITOR

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar,
  "first_name" varchar,
  "last_name" varchar,
  "profile_image_url" varchar,
  "password_hash" varchar,
  "email_verified" timestamp,
  "auth_provider" varchar DEFAULT 'local',
  "google_id" varchar,
  "organization_id" varchar,
  "is_super_admin" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

-- 2. Organizations Table
CREATE TABLE IF NOT EXISTS "organizations" (
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
  "owner_id" varchar REFERENCES "users"("id"),
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

-- 3. Sessions Table
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- 4. Crew Members Table
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

-- 5. Email Verifications
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar NOT NULL,
  "code" varchar(6) NOT NULL,
  "type" varchar DEFAULT 'verify' NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- 6. Customers Table
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

-- 7. Suppliers Table
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

-- 8. Items Table
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

-- 9. Jobs Table
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

-- 10. Reports Table
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

-- 11. Document Themes
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

-- 12. Quotes Table
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

-- 13. Quote Items Table
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

-- 14. Document Settings
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
