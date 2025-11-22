-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "coupleLastReadAt" TIMESTAMP(3),
ADD COLUMN     "vendorLastReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DesignElement" ALTER COLUMN "updatedAt" DROP DEFAULT;
