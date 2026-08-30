-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Type" ADD VALUE 'audio';
ALTER TYPE "Type" ADD VALUE 'pdf';
ALTER TYPE "Type" ADD VALUE 'document';
ALTER TYPE "Type" ADD VALUE 'spreadsheet';
ALTER TYPE "Type" ADD VALUE 'presentation';
ALTER TYPE "Type" ADD VALUE 'code';
ALTER TYPE "Type" ADD VALUE 'text';
