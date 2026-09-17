/*
  Warnings:

  - Made the column `revisionsTotal` on table `contracts` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "contracts" ALTER COLUMN "revisionsTotal" SET NOT NULL,
ALTER COLUMN "revisionsTotal" SET DEFAULT 3;
