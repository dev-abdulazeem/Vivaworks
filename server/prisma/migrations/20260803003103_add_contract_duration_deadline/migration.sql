-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "revisionsTotal" INTEGER,
ADD COLUMN     "revisionsUsed" INTEGER DEFAULT 0;
