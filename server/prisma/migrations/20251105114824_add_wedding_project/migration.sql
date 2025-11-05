-- CreateEnum
CREATE TYPE "WeddingType" AS ENUM ('self_organized', 'prepackaged');

-- CreateTable
CREATE TABLE "WeddingProject" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "weddingDate" TIMESTAMP(3) NOT NULL,
    "weddingType" "WeddingType" NOT NULL,
    "basePackageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeddingProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeddingProject_coupleId_idx" ON "WeddingProject"("coupleId");

-- CreateIndex
CREATE INDEX "WeddingProject_weddingDate_idx" ON "WeddingProject"("weddingDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeddingProject_coupleId_projectName_key" ON "WeddingProject"("coupleId", "projectName");

-- AddForeignKey
ALTER TABLE "WeddingProject" ADD CONSTRAINT "WeddingProject_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeddingProject" ADD CONSTRAINT "WeddingProject_basePackageId_fkey" FOREIGN KEY ("basePackageId") REFERENCES "WeddingPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
