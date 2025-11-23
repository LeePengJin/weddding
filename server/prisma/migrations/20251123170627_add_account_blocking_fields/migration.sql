-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'blocked';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "blockedAt" TIMESTAMP(3);
