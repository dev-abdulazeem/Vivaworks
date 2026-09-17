/*
  Warnings:

  - You are about to alter the column `amount` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `escrowAmount` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `freelancerPayout` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `platformFee` on the `contracts` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `totalEarned` on the `earning_badges` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `totalSpent` on the `earning_badges` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `budget` on the `jobs` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `offers` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `proposedRate` on the `proposals` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `proposedBudget` on the `proposals` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `transactions` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `hourlyRate` on the `users` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `wallet_topup_otps` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `balance` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `escrow` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `dailyWithdrawalSum` on the `wallets` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `withdrawal_otps` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "contracts" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "escrowAmount" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "freelancerPayout" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "platformFee" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "earning_badges" ALTER COLUMN "totalEarned" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "totalSpent" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "budget" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "offers" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "proposals" ALTER COLUMN "proposedRate" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "proposedBudget" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "hourlyRate" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "wallet_topup_otps" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "wallets" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "escrow" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "dailyWithdrawalSum" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "withdrawal_otps" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);
