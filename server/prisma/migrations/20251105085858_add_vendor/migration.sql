-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('Photographer', 'Videographer', 'Venue', 'Caterer', 'Florist', 'DJ_Music', 'Other');

-- CreateTable
CREATE TABLE "Vendor" (
    "userId" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "verificationDocuments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
