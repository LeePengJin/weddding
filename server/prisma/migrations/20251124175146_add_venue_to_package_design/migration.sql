-- AlterTable
ALTER TABLE "PackageDesign" ADD COLUMN     "venueServiceListingId" TEXT;

-- AddForeignKey
ALTER TABLE "PackageDesign" ADD CONSTRAINT "PackageDesign_venueServiceListingId_fkey" FOREIGN KEY ("venueServiceListingId") REFERENCES "ServiceListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
