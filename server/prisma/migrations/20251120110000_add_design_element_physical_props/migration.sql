-- Add physical metadata to design elements for scaling & stacking
ALTER TABLE "DesignElement"
  ADD COLUMN IF NOT EXISTS "dimensions" JSONB,
  ADD COLUMN IF NOT EXISTS "isStackable" BOOLEAN NOT NULL DEFAULT false;

-- Ensure existing records have default values
UPDATE "DesignElement"
SET "isStackable" = false
WHERE "isStackable" IS NULL;

