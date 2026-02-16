-- DANGEROUS: This script deletes ALL data and tables.
-- Run this in your Neon SQL Editor to reset your database before importing a dump.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- If you have other schemas (like 'drizzle' or 'auth')
DROP SCHEMA IF EXISTS drizzle CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
