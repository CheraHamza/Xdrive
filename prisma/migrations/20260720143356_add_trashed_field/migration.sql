-- AlterTable
ALTER TABLE "File" ADD COLUMN     "trashed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "trashed" BOOLEAN NOT NULL DEFAULT false;
