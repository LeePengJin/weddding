/*
  Warnings:

  - The values [cancelled] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('pending_vendor_confirmation', 'pending_deposit_payment', 'confirmed', 'pending_final_payment', 'cancelled_by_couple', 'cancelled_by_vendor', 'rejected', 'completed');
ALTER TABLE "public"."Booking" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Booking" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "Booking" ALTER COLUMN "status" SET DEFAULT 'pending_vendor_confirmation';
COMMIT;

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'cancellation_fee';

-- AlterTable
ALTER TABLE "ServiceListing" ADD COLUMN     "cancellationFeeTiers" JSONB,
ADD COLUMN     "cancellationPolicy" TEXT;

-- CreateTable
CREATE TABLE "Cancellation" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledBy" TEXT NOT NULL,
    "cancellationReason" TEXT,
    "cancellationFee" DECIMAL(12,2),
    "cancellationFeePaymentId" TEXT,

    CONSTRAINT "Cancellation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cancellation_bookingId_key" ON "Cancellation"("bookingId");

-- CreateIndex
CREATE INDEX "Cancellation_cancelledBy_idx" ON "Cancellation"("cancelledBy");

-- CreateIndex
CREATE INDEX "Cancellation_cancelledAt_idx" ON "Cancellation"("cancelledAt");

-- AddForeignKey
ALTER TABLE "Cancellation" ADD CONSTRAINT "Cancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
