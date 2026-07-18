/*
  Warnings:

  - Added the required column `size` to the `Folder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "starred" BOOLEAN NOT NULL DEFAULT false;
