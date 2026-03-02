/*
  Warnings:

  - You are about to drop the column `costPrice` on the `OrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "costPrice";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "commissionRate" INTEGER DEFAULT 40;
