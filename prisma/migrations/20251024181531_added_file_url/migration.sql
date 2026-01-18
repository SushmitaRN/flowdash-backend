/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "fileUrl",
ADD COLUMN     "fileUrl_manager" TEXT,
ADD COLUMN     "fileUrl_operator" TEXT;
