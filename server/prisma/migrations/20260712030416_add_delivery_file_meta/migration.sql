-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_contractId_fkey";

-- DropForeignKey
ALTER TABLE "deliveries" DROP CONSTRAINT "deliveries_freelancerId_fkey";

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "deliveryFileMeta" JSONB;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "fileMeta" JSONB,
ALTER COLUMN "files" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
