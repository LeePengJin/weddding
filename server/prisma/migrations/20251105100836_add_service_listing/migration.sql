-- CreateTable
CREATE TABLE "ServiceListing" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "VendorCategory" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "averageRating" DECIMAL(3,2),
    "has3DModel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceListing_vendorId_idx" ON "ServiceListing"("vendorId");

-- CreateIndex
CREATE INDEX "ServiceListing_isActive_idx" ON "ServiceListing"("isActive");

-- AddForeignKey
ALTER TABLE "ServiceListing" ADD CONSTRAINT "ServiceListing_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
