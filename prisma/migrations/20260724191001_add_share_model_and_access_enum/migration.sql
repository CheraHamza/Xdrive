-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('RESTRICTED', 'PUBLIC');

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "access" "AccessType" NOT NULL DEFAULT 'RESTRICTED',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "folderId" TEXT,
    "fileId" TEXT,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Share_shareToken_key" ON "Share"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "Share_folderId_key" ON "Share"("folderId");

-- CreateIndex
CREATE UNIQUE INDEX "Share_fileId_key" ON "Share"("fileId");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
