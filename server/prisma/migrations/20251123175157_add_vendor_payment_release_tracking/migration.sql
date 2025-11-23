-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "releasedBy" TEXT,
ADD COLUMN     "releasedToVendor" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Payment_releasedToVendor_idx" ON "Payment"("releasedToVendor");
