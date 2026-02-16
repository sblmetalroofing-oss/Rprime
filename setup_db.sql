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

-- 3. Sessions Table (Mandatory for Auth)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- 4. Crew Members Table (Required for Login Check)
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
