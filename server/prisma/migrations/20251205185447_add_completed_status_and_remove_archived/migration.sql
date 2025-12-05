/*
  Warnings:

  - The values [archived] on the enum `ProjectStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('draft', 'ready_to_book', 'booked', 'completed');
ALTER TABLE "public"."WeddingProject" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WeddingProject" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "public"."ProjectStatus_old";
ALTER TABLE "WeddingProject" ALTER COLUMN "status" SET DEFAULT 'draft';
COMMIT;
