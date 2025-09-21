/*
  Warnings:

  - You are about to drop the column `icon` on the `Reward` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Reward" DROP COLUMN "icon",
ADD COLUMN     "imageUrl" TEXT;
