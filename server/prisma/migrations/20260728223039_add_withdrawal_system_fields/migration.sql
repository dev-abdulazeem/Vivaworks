-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "dailyWithdrawalDate" TIMESTAMP(3),
ADD COLUMN     "dailyWithdrawalSum" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "lastWithdrawalAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "withdrawal_otps" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ipAddress" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
