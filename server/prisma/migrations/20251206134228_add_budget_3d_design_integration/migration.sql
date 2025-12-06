-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "plannedSpend" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "from3DDesign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placedElementId" TEXT,
ADD COLUMN     "serviceListingId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_bookingId_idx" ON "Expense"("bookingId");

-- CreateIndex
CREATE INDEX "Expense_serviceListingId_idx" ON "Expense"("serviceListingId");

-- CreateIndex
CREATE INDEX "Expense_placedElementId_idx" ON "Expense"("placedElementId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
