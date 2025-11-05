/*
  Warnings:

  - You are about to drop the column `vendorCode` on the `Vendor` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."Vendor_vendorCode_key";

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "vendorCode";
