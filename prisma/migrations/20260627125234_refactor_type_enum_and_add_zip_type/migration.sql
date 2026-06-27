/*
  Warnings:

  - The values [Picture,Video,File] on the enum `Type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Type_new" AS ENUM ('image', 'movie', 'zip', 'file');
ALTER TABLE "public"."File" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "File" ALTER COLUMN "type" TYPE "Type_new" USING ("type"::text::"Type_new");
ALTER TYPE "Type" RENAME TO "Type_old";
ALTER TYPE "Type_new" RENAME TO "Type";
DROP TYPE "public"."Type_old";
ALTER TABLE "File" ALTER COLUMN "type" SET DEFAULT 'file';
COMMIT;

-- AlterTable
ALTER TABLE "File" ALTER COLUMN "type" SET DEFAULT 'file';
