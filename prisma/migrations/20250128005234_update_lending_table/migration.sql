/*
  Warnings:

  - Added the required column `quantity` to the `Lending` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Lending` ADD COLUMN `quantity` INTEGER NOT NULL;
