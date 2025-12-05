-- AlterTable
ALTER TABLE "PlacedElement" ADD COLUMN     "parentElementId" TEXT;

-- CreateIndex
CREATE INDEX "PlacedElement_parentElementId_idx" ON "PlacedElement"("parentElementId");

-- AddForeignKey
ALTER TABLE "PlacedElement" ADD CONSTRAINT "PlacedElement_parentElementId_fkey" FOREIGN KEY ("parentElementId") REFERENCES "PlacedElement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
