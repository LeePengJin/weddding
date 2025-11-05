-- CreateTable
CREATE TABLE "WeddingPackage" (
    "id" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "previewImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ServiceListingToWeddingPackage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServiceListingToWeddingPackage_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "WeddingPackage_packageName_idx" ON "WeddingPackage"("packageName");

-- CreateIndex
CREATE INDEX "_ServiceListingToWeddingPackage_B_index" ON "_ServiceListingToWeddingPackage"("B");

-- AddForeignKey
ALTER TABLE "_ServiceListingToWeddingPackage" ADD CONSTRAINT "_ServiceListingToWeddingPackage_A_fkey" FOREIGN KEY ("A") REFERENCES "ServiceListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceListingToWeddingPackage" ADD CONSTRAINT "_ServiceListingToWeddingPackage_B_fkey" FOREIGN KEY ("B") REFERENCES "WeddingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
