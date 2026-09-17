-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "extension_requests" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'pending',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extension_requests_contractId_idx" ON "extension_requests"("contractId");

-- CreateIndex
CREATE INDEX "extension_requests_status_idx" ON "extension_requests"("status");

-- AddForeignKey
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
