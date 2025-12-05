-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "gracePeriodEndDate" TIMESTAMP(3),
ADD COLUMN     "isPendingVenueReplacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalDepositDueDate" TIMESTAMP(3),
ADD COLUMN     "originalFinalDueDate" TIMESTAMP(3),
ADD COLUMN     "venueCancellationDate" TIMESTAMP(3);
