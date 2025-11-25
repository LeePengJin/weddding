-- CreateEnum
CREATE TYPE "WeddingPackageItemStatus" AS ENUM ('ok', 'missing_listing', 'listing_inactive', 'vendor_inactive', 'vendor_blocked');

-- AlterTable
ALTER TABLE "WeddingPackageItem" ADD COLUMN     "healthStatus" "WeddingPackageItemStatus" NOT NULL DEFAULT 'ok';
