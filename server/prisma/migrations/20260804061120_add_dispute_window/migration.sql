-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "disputeWindowEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "disputes" ADD COLUMN     "filedDuringWindow" BOOLEAN NOT NULL DEFAULT false;
