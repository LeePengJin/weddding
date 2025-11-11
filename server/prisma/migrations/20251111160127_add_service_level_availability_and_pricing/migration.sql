-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'ready_to_book', 'booked');

-- CreateEnum
CREATE TYPE "ServiceAvailabilityType" AS ENUM ('exclusive', 'reusable', 'quantity_based');

-- CreateEnum
CREATE TYPE "PricingPolicy" AS ENUM ('flat', 'per_table', 'per_set', 'per_guest', 'tiered');

-- AlterTable
ALTER TABLE "ServiceListing" ADD COLUMN     "availabilityType" "ServiceAvailabilityType" NOT NULL DEFAULT 'exclusive',
ADD COLUMN     "maxQuantity" INTEGER,
ADD COLUMN     "pricingPolicy" "PricingPolicy" NOT NULL DEFAULT 'flat';

-- AlterTable
ALTER TABLE "WeddingProject" ADD COLUMN     "lastAvailabilityCheck" TIMESTAMP(3),
ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "venueServiceListingId" TEXT;

-- CreateTable
CREATE TABLE "ServiceAvailability" (
    "id" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "availabilityType" "ServiceAvailabilityType" NOT NULL,
    "maxQuantity" INTEGER,
    "availableQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceComponent" (
    "id" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "designElementId" TEXT NOT NULL,
    "quantityPerUnit" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT,

    CONSTRAINT "ServiceComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceAvailability_serviceListingId_date_idx" ON "ServiceAvailability"("serviceListingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceAvailability_serviceListingId_date_key" ON "ServiceAvailability"("serviceListingId", "date");

-- CreateIndex
CREATE INDEX "ServiceComponent_serviceListingId_idx" ON "ServiceComponent"("serviceListingId");

-- CreateIndex
CREATE INDEX "ServiceComponent_designElementId_idx" ON "ServiceComponent"("designElementId");

-- CreateIndex
CREATE INDEX "WeddingProject_venueServiceListingId_idx" ON "WeddingProject"("venueServiceListingId");

-- AddForeignKey
ALTER TABLE "WeddingProject" ADD CONSTRAINT "WeddingProject_venueServiceListingId_fkey" FOREIGN KEY ("venueServiceListingId") REFERENCES "ServiceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceAvailability" ADD CONSTRAINT "ServiceAvailability_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComponent" ADD CONSTRAINT "ServiceComponent_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceComponent" ADD CONSTRAINT "ServiceComponent_designElementId_fkey" FOREIGN KEY ("designElementId") REFERENCES "DesignElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
