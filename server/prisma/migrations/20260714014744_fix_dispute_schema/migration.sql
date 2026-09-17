/*
  Warnings:

  - The `evidence` column on the `Dispute` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Dispute" DROP COLUMN "evidence",
ADD COLUMN     "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "title" TEXT;
