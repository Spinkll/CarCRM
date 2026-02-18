/*
  Warnings:

  - Added the required column `color` to the `Car` table without a default value. This is not possible if the table is not empty.
  - Made the column `plate` on table `Car` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Car" ADD COLUMN     "color" TEXT NOT NULL,
ALTER COLUMN "plate" SET NOT NULL;
