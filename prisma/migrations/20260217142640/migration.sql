/*
  Warnings:

  - Made the column `vin` on table `Car` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Car" ALTER COLUMN "vin" SET NOT NULL;
