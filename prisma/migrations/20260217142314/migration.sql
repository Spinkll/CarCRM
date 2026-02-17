/*
  Warnings:

  - You are about to drop the column `color` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `Car` table. All the data in the column will be lost.
  - You are about to drop the column `plateNumber` on the `Car` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Car` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Car" DROP CONSTRAINT "Car_ownerId_fkey";

-- DropIndex
DROP INDEX "Car_vin_key";

-- AlterTable
ALTER TABLE "Car" DROP COLUMN "color",
DROP COLUMN "ownerId",
DROP COLUMN "plateNumber",
ADD COLUMN     "mileage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plate" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "vin" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Car" ADD CONSTRAINT "Car_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
