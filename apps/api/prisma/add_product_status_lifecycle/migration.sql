-- Migration: add_product_status_lifecycle
-- Adds ProductStatus enum and status + deleted_at columns to products table.
BEGIN;

-- Create enum type for product status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_status') THEN
        CREATE TYPE product_status AS ENUM ('ACTIVE','INACTIVE','DELETED');
    END IF;
END$$;

-- Add status column with default ACTIVE
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS status product_status NOT NULL DEFAULT 'ACTIVE';

-- Add deleted_at timestamp column (nullable)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMIT;
