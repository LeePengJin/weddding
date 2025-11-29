-- Migration: update pricing models and add table tagging

-- Step 1: Add new columns for pricing and event timing
ALTER TABLE "ServiceListing" 
  ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "tieredPricing" JSONB;

ALTER TABLE "WeddingProject"
  ADD COLUMN IF NOT EXISTS "eventStartTime" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eventEndTime" TIMESTAMP(3);

ALTER TABLE "PlacedElement"
  ADD COLUMN IF NOT EXISTS "serviceListingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "elementType" TEXT;

-- Step 2: Migrate existing pricingPolicy data to a temporary text column
ALTER TABLE "ServiceListing" 
  ADD COLUMN IF NOT EXISTS "pricingPolicy_temp" TEXT;

-- Only backfill when the temp column is null, so the migration is idempotent
UPDATE "ServiceListing" 
SET "pricingPolicy_temp" = 
  CASE 
    WHEN "pricingPolicy"::text = 'flat' THEN 'fixed_package'
    WHEN "pricingPolicy"::text = 'per_table' THEN 'per_table'
    WHEN "pricingPolicy"::text = 'per_set' THEN 'per_unit'
    WHEN "pricingPolicy"::text = 'per_guest' THEN 'per_unit'
    WHEN "pricingPolicy"::text = 'tiered' THEN 'tiered_package'
    ELSE 'fixed_package'
  END
WHERE "pricingPolicy_temp" IS NULL;

-- Step 3: Convert the existing pricingPolicy column to TEXT so we can drop the old enum
ALTER TABLE "ServiceListing" 
  ALTER COLUMN "pricingPolicy" TYPE TEXT USING "pricingPolicy"::text;

-- Step 4: Drop any existing default and old enum type if it exists, then create the new one
ALTER TABLE "ServiceListing"
  ALTER COLUMN "pricingPolicy" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PricingPolicy') THEN
    DROP TYPE "PricingPolicy";
  END IF;
END $$;

CREATE TYPE "PricingPolicy" AS ENUM ('per_unit', 'per_table', 'fixed_package', 'tiered_package', 'time_based');

-- Step 5: Re-type the column to the new enum and restore data from the temp column
ALTER TABLE "ServiceListing" 
  ALTER COLUMN "pricingPolicy" TYPE "PricingPolicy" USING 
    COALESCE("pricingPolicy_temp"::"PricingPolicy", 'fixed_package'::"PricingPolicy"),
  ALTER COLUMN "pricingPolicy" SET DEFAULT 'fixed_package';

-- Step 6: Clean up temp column and enforce constraints
ALTER TABLE "ServiceListing" 
  DROP COLUMN IF EXISTS "pricingPolicy_temp",
  ALTER COLUMN "pricingPolicy" SET NOT NULL;


