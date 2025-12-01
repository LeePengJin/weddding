-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('not_applicable', 'pending', 'processed');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "dependsOnVenueBookingId" TEXT;

-- AlterTable
ALTER TABLE "Cancellation" ADD COLUMN     "refundAmount" DECIMAL(12,2),
ADD COLUMN     "refundMethod" TEXT,
ADD COLUMN     "refundNotes" TEXT,
ADD COLUMN     "refundRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "refundStatus" "RefundStatus" NOT NULL DEFAULT 'not_applicable';

-- CreateIndex
CREATE INDEX "Booking_dependsOnVenueBookingId_idx" ON "Booking"("dependsOnVenueBookingId");

-- CreateIndex
CREATE INDEX "Cancellation_refundStatus_idx" ON "Cancellation"("refundStatus");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dependsOnVenueBookingId_fkey" FOREIGN KEY ("dependsOnVenueBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
