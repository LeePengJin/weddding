-- CreateTable
CREATE TABLE "BookedTable" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "serviceListingId" TEXT NOT NULL,
    "placedElementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookedTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookedTable_bookingId_idx" ON "BookedTable"("bookingId");

-- CreateIndex
CREATE INDEX "BookedTable_serviceListingId_idx" ON "BookedTable"("serviceListingId");

-- CreateIndex
CREATE INDEX "BookedTable_placedElementId_idx" ON "BookedTable"("placedElementId");

-- CreateIndex
CREATE UNIQUE INDEX "BookedTable_bookingId_serviceListingId_placedElementId_key" ON "BookedTable"("bookingId", "serviceListingId", "placedElementId");

-- AddForeignKey
ALTER TABLE "BookedTable" ADD CONSTRAINT "BookedTable_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookedTable" ADD CONSTRAINT "BookedTable_serviceListingId_fkey" FOREIGN KEY ("serviceListingId") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookedTable" ADD CONSTRAINT "BookedTable_placedElementId_fkey" FOREIGN KEY ("placedElementId") REFERENCES "PlacedElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
