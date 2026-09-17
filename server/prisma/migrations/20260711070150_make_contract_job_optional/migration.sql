-- DropForeignKey
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_jobId_fkey";

-- AlterTable
ALTER TABLE "contracts" ALTER COLUMN "jobId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
