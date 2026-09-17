/*
  Warnings:

  - You are about to drop the column `kycVerified` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'DRIVERS_LICENSE', 'INTERNATIONAL_PASSPORT', 'VOTERS_CARD', 'BUSINESS_REGISTRATION', 'UTILITY_BILL', 'TAX_ID');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "kycVerified",
ADD COLUMN     "kycApprovedAt" TIMESTAMP(3),
ADD COLUMN     "kycRejectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "kycSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "document_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "frontImageUrl" TEXT,
    "backImageUrl" TEXT,
    "selfieUrl" TEXT,
    "fullName" TEXT,
    "documentNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "country" TEXT,
    "address" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_verifications_userId_key" ON "document_verifications"("userId");

-- CreateIndex
CREATE INDEX "document_verifications_status_idx" ON "document_verifications"("status");

-- CreateIndex
CREATE INDEX "document_verifications_userId_idx" ON "document_verifications"("userId");

-- AddForeignKey
ALTER TABLE "document_verifications" ADD CONSTRAINT "document_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
