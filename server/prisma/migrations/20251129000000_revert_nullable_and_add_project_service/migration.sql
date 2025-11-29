-- Delete any PlacedElement entries with null designElementId (if any exist)
DELETE FROM "PlacedElement" WHERE "designElementId" IS NULL;

-- Revert designElementId to required (NOT NULL)
ALTER TABLE "PlacedElement" ALTER COLUMN "designElementId" SET NOT NULL;

-- Create ProjectService table for non-3D services added to projects
CREATE TABLE "ProjectService" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isBooked" BOOLEAN NOT NULL DEFAULT FALSE,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectService_projectId_idx" ON "ProjectService"("projectId");

-- CreateIndex
CREATE INDEX "ProjectService_serviceListingId_idx" ON "ProjectService"("serviceListingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectService_projectId_serviceListingId_key" ON "ProjectService"("projectId", "serviceListingId");

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for ProjectService.bookingId -> Booking.id
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add booking lifecycle columns to PlacedElement
ALTER TABLE "PlacedElement" ADD COLUMN "isBooked" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "PlacedElement" ADD COLUMN "bookingId" TEXT;

-- AddForeignKey for PlacedElement.bookingId -> Booking.id
ALTER TABLE "PlacedElement" ADD CONSTRAINT "PlacedElement_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
