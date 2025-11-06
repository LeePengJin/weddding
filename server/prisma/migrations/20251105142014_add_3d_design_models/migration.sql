-- AlterTable
ALTER TABLE "ServiceListing" ADD COLUMN     "designElementId" TEXT;

-- CreateTable
CREATE TABLE "Coordinates" (
    "id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Coordinates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignElement" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "elementType" TEXT,
    "modelFile" TEXT NOT NULL,

    CONSTRAINT "DesignElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueDesign" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "layoutData" JSONB,
    "cameraPositionId" TEXT,
    "zoomLevel" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacedElement" (
    "id" TEXT NOT NULL,
    "venueDesignId" TEXT NOT NULL,
    "designElementId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "rotation" DOUBLE PRECISION,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlacedElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueDesign_projectId_key" ON "VenueDesign"("projectId");

-- CreateIndex
CREATE INDEX "PlacedElement_venueDesignId_idx" ON "PlacedElement"("venueDesignId");

-- CreateIndex
CREATE INDEX "PlacedElement_designElementId_idx" ON "PlacedElement"("designElementId");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_designElementId_fkey" FOREIGN KEY ("designElementId") REFERENCES "DesignElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueDesign" ADD CONSTRAINT "VenueDesign_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "WeddingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueDesign" ADD CONSTRAINT "VenueDesign_cameraPositionId_fkey" FOREIGN KEY ("cameraPositionId") REFERENCES "Coordinates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedElement" ADD CONSTRAINT "PlacedElement_venueDesignId_fkey" FOREIGN KEY ("venueDesignId") REFERENCES "VenueDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedElement" ADD CONSTRAINT "PlacedElement_designElementId_fkey" FOREIGN KEY ("designElementId") REFERENCES "DesignElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedElement" ADD CONSTRAINT "PlacedElement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Coordinates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
