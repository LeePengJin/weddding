/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('couple', 'vendor', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'pending_verification', 'rejected');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "profilePicture" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'pending_verification',
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'couple';
