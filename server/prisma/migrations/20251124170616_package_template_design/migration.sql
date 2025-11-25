/*
  Warnings:

  - You are about to drop the column `price` on the `WeddingPackage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WeddingPackage" DROP COLUMN "price";

-- CreateTable
CREATE TABLE "PackageDesign" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "venueName" TEXT,
    "layoutData" JSONB,
    "cameraPositionId" TEXT,
    "zoomLevel" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePlacedElement" (
    "id" TEXT NOT NULL,
    "packageDesignId" TEXT NOT NULL,
    "designElementId" TEXT NOT NULL,
    "serviceListingId" TEXT,
    "positionId" TEXT NOT NULL,
    "rotation" DOUBLE PRECISION,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,

    CONSTRAINT "PackagePlacedElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageDesign_packageId_key" ON "PackageDesign"("packageId");

-- CreateIndex
CREATE INDEX "PackagePlacedElement_packageDesignId_idx" ON "PackagePlacedElement"("packageDesignId");

-- CreateIndex
CREATE INDEX "PackagePlacedElement_designElementId_idx" ON "PackagePlacedElement"("designElementId");

-- CreateIndex
CREATE INDEX "PackagePlacedElement_serviceListingId_idx" ON "PackagePlacedElement"("serviceListingId");

-- AddForeignKey
ALTER TABLE "PackageDesign" ADD CONSTRAINT "PackageDesign_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "WeddingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageDesign" ADD CONSTRAINT "PackageDesign_cameraPositionId_fkey" FOREIGN KEY ("cameraPositionId") REFERENCES "Coordinates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlacedElement" ADD CONSTRAINT "PackagePlacedElement_packageDesignId_fkey" FOREIGN KEY ("packageDesignId") REFERENCES "PackageDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlacedElement" ADD CONSTRAINT "PackagePlacedElement_designElementId_fkey" FOREIGN KEY ("designElementId") REFERENCES "DesignElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlacedElement" ADD CONSTRAINT "PackagePlacedElement_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePlacedElement" ADD CONSTRAINT "PackagePlacedElement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Coordinates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
