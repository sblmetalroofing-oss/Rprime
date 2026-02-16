
-- 1. Enable standard cryptography extension for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create SESSIONS table (Required for Express Session)
CREATE TABLE IF NOT EXISTS "sessions" (
  "sid" varchar PRIMARY KEY NOT NULL,
  "sess" jsonb NOT NULL,
  "expire" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "sessions" ("expire");

-- 3. Create ORGANIZATIONS table (Minimal structure)
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text UNIQUE,
  "logo_url" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- 4. Create USERS table
CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar UNIQUE,
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
  "updated_at" timestamp DEFAULT now()
);

-- 5. Create EMAIL_VERIFICATIONS table (for Email confirmation)
CREATE TABLE IF NOT EXISTS "email_verifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" varchar NOT NULL,
  "code" varchar(6) NOT NULL,
  "type" varchar NOT NULL DEFAULT 'verify',
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- 6. Create PASSWORD_RESETS table
CREATE TABLE IF NOT EXISTS "password_resets" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" varchar NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
