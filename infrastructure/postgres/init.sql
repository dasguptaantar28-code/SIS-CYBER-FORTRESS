-- SIS Cyber Fortress PostgreSQL Initialization Script
-- Runs on initial Docker Postgres container bootstrap.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
