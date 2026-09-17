-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "linkDomain" TEXT,
ALTER COLUMN "hashtags" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "mentions" SET DEFAULT ARRAY[]::TEXT[];
