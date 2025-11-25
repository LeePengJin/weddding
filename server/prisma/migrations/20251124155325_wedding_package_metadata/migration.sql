/*
  Warnings:

  - You are about to drop the `_ServiceListingToWeddingPackage` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WeddingPackageStatus" AS ENUM ('draft', 'published', 'needs_vendor_updates', 'archived');

-- DropForeignKey
ALTER TABLE "public"."_ServiceListingToWeddingPackage" DROP CONSTRAINT "_ServiceListingToWeddingPackage_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_ServiceListingToWeddingPackage" DROP CONSTRAINT "_ServiceListingToWeddingPackage_B_fkey";

-- AlterTable
ALTER TABLE "WeddingPackage" ADD COLUMN     "invalidListingIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "lastValidatedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "WeddingPackageStatus" NOT NULL DEFAULT 'draft';

-- DropTable
DROP TABLE "public"."_ServiceListingToWeddingPackage";

-- CreateTable
CREATE TABLE "WeddingPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceListingId" TEXT,
    "label" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "serviceListingSnapshot" JSONB,
    "replacementTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeddingPackageItem_packageId_idx" ON "WeddingPackageItem"("packageId");

-- CreateIndex
CREATE INDEX "WeddingPackageItem_serviceListingId_idx" ON "WeddingPackageItem"("serviceListingId");

-- CreateIndex
CREATE INDEX "WeddingPackage_status_idx" ON "WeddingPackage"("status");

-- AddForeignKey
ALTER TABLE "WeddingPackageItem" ADD CONSTRAINT "WeddingPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "WeddingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingPackageItem" ADD CONSTRAINT "WeddingPackageItem_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
