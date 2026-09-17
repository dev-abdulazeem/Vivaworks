-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'released');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "freelancerPayout" DOUBLE PRECISION,
ADD COLUMN     "payoutDate" TIMESTAMP(3),
ADD COLUMN     "payoutStatus" "PayoutStatus",
ADD COLUMN     "platformFee" DOUBLE PRECISION;
