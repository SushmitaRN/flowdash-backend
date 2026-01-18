/*
  Warnings:

  - The values [OTHER] on the enum `LeaveType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `approvedById` on the `LeaveRequest` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('PERFORMANCE', 'FESTIVAL', 'SPOT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterEnum
BEGIN;
CREATE TYPE "LeaveType_new" AS ENUM ('SICK', 'CASUAL', 'EARNED', 'UNPAID');
ALTER TABLE "LeaveRequest" ALTER COLUMN "type" TYPE "LeaveType_new" USING ("type"::text::"LeaveType_new");
ALTER TYPE "LeaveType" RENAME TO "LeaveType_old";
ALTER TYPE "LeaveType_new" RENAME TO "LeaveType";
DROP TYPE "public"."LeaveType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."LeaveRequest" DROP CONSTRAINT "LeaveRequest_approvedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."LeaveRequest" DROP CONSTRAINT "LeaveRequest_userId_fkey";

-- DropIndex
DROP INDEX "public"."LeaveRequest_status_idx";

-- DropIndex
DROP INDEX "public"."LeaveRequest_userId_idx";

-- AlterTable
ALTER TABLE "LeaveRequest" DROP COLUMN "approvedById",
ADD COLUMN     "approverId" TEXT;

-- CreateTable
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "type" "BonusType" NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'PENDING',
    "userId" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bonus_userId_idx" ON "Bonus"("userId");

-- CreateIndex
CREATE INDEX "Bonus_status_idx" ON "Bonus"("status");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bonus" ADD CONSTRAINT "Bonus_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
