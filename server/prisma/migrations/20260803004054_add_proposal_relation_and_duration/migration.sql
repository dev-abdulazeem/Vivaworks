/*
  Warnings:

  - A unique constraint covering the columns `[proposalId]` on the table `contracts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "proposalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposalId_key" ON "contracts"("proposalId");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
