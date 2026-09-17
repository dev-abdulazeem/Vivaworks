-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'pdf', 'file', 'offer', 'delivery');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('pending_payment', 'active', 'in_progress', 'delivered', 'revision_requested', 'completed', 'cancelled', 'auto_cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'banned');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OfferStatus" ADD VALUE 'cancelled';
ALTER TYPE "OfferStatus" ADD VALUE 'completed';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryFiles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deliveryNote" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "graceEndDate" TIMESTAMP(3),
ADD COLUMN     "maxRevisions" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "revisionCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "offers" ADD COLUMN     "deliverables" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "durationDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "milestones" JSONB,
ADD COLUMN     "revisions" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "note" TEXT,
    "files" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_violations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "fileUrl" TEXT,
    "confidence" DOUBLE PRECISION,
    "autoBanned" BOOLEAN NOT NULL DEFAULT false,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_violations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_violations" ADD CONSTRAINT "content_violations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
