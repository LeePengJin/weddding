/*
  Warnings:

  - The values [tiered_package] on the enum `PricingPolicy` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `selectedTierIndex` on the `ProjectService` table. All the data in the column will be lost.
  - You are about to drop the column `tieredPricing` on the `ServiceListing` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PricingPolicy_new" AS ENUM ('per_unit', 'per_table', 'fixed_package', 'time_based');
ALTER TABLE "public"."ServiceListing" ALTER COLUMN "pricingPolicy" DROP DEFAULT;
ALTER TABLE "ServiceListing" ALTER COLUMN "pricingPolicy" TYPE "PricingPolicy_new" USING ("pricingPolicy"::text::"PricingPolicy_new");
ALTER TYPE "PricingPolicy" RENAME TO "PricingPolicy_old";
ALTER TYPE "PricingPolicy_new" RENAME TO "PricingPolicy";
DROP TYPE "public"."PricingPolicy_old";
ALTER TABLE "ServiceListing" ALTER COLUMN "pricingPolicy" SET DEFAULT 'fixed_package';
COMMIT;

-- AlterTable
ALTER TABLE "ProjectService" DROP COLUMN "selectedTierIndex";

-- AlterTable
ALTER TABLE "ServiceListing" DROP COLUMN "tieredPricing";

-- AlterTable
ALTER TABLE "WeddingProject" ALTER COLUMN "weddingDate" SET DATA TYPE DATE;
