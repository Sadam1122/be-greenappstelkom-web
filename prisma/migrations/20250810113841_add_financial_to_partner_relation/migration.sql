-- AlterTable
ALTER TABLE "public"."FinancialEntry" ADD COLUMN     "partnerId" TEXT;

-- CreateIndex
CREATE INDEX "FinancialEntry_partnerId_idx" ON "public"."FinancialEntry"("partnerId");

-- AddForeignKey
ALTER TABLE "public"."FinancialEntry" ADD CONSTRAINT "FinancialEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "public"."Partner"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
