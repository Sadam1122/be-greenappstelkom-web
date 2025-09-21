-- CreateEnum
CREATE TYPE "public"."RedemptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."RewardRedemption" ADD COLUMN     "status" "public"."RedemptionStatus" NOT NULL DEFAULT 'PENDING';
