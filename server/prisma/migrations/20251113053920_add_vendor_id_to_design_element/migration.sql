-- DropForeignKey
ALTER TABLE "public"."ServiceComponent" DROP CONSTRAINT IF EXISTS "ServiceComponent_designElementId_fkey";

-- Step 1: Add columns as nullable first (to handle existing data)
ALTER TABLE "DesignElement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- Step 2: Populate vendorId for existing DesignElements from their usage in ServiceListings or ServiceComponents
-- First, update from ServiceListings
UPDATE "DesignElement" de
SET "vendorId" = sl."vendorId"
FROM "ServiceListing" sl
WHERE de.id = sl."designElementId" AND de."vendorId" IS NULL;

-- Then, update from ServiceComponents (via ServiceListings)
UPDATE "DesignElement" de
SET "vendorId" = sl."vendorId"
FROM "ServiceComponent" sc
JOIN "ServiceListing" sl ON sc."serviceListingId" = sl.id
WHERE de.id = sc."designElementId" AND de."vendorId" IS NULL;

-- Step 3: Set default values for any remaining nulls (safety check)
-- If there are any DesignElements without a vendorId, assign to first vendor
UPDATE "DesignElement" 
SET "vendorId" = (SELECT "userId" FROM "Vendor" LIMIT 1)
WHERE "vendorId" IS NULL;

-- Step 4: Set defaults for existing null values first
UPDATE "DesignElement" 
SET "createdAt" = CURRENT_TIMESTAMP 
WHERE "createdAt" IS NULL;

UPDATE "DesignElement" 
SET "updatedAt" = CURRENT_TIMESTAMP 
WHERE "updatedAt" IS NULL;

-- Step 5: Set defaults and make columns NOT NULL
ALTER TABLE "DesignElement" 
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL,
  ALTER COLUMN "vendorId" SET NOT NULL;

-- AlterTable: Make designElementId nullable in ServiceComponent
ALTER TABLE "ServiceComponent" ALTER COLUMN "designElementId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DesignElement_vendorId_idx" ON "DesignElement"("vendorId");

-- AddForeignKey: ServiceComponent -> DesignElement (with SET NULL on delete)
ALTER TABLE "ServiceComponent" ADD CONSTRAINT "ServiceComponent_designElementId_fkey" FOREIGN KEY ("designElementId") REFERENCES "DesignElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DesignElement -> Vendor
ALTER TABLE "DesignElement" ADD CONSTRAINT "DesignElement_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
