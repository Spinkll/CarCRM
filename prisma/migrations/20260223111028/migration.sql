/*
  Warnings:

  - You are about to drop the column `price` on the `Part` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `Part` table. All the data in the column will be lost.
  - Added the required column `purchasePrice` to the `Part` table without a default value. This is not possible if the table is not empty.
  - Added the required column `retailPrice` to the `Part` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Part" DROP COLUMN "price",
DROP COLUMN "stock",
ADD COLUMN     "minStockLevel" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "purchasePrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "retailPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "stockQuantity" INTEGER NOT NULL DEFAULT 0;
