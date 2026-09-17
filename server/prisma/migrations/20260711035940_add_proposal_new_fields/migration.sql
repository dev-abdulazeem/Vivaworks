-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "linkDesc" TEXT,
ADD COLUMN     "linkImage" TEXT,
ADD COLUMN     "linkTitle" TEXT,
ADD COLUMN     "linkUrl" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'text';

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN     "proposedBudget" DOUBLE PRECISION,
ADD COLUMN     "proposedDuration" INTEGER,
ALTER COLUMN "proposedRate" DROP NOT NULL;
