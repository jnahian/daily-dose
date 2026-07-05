-- DropIndex
DROP INDEX "public"."leaves_source_external_id_key";

-- AlterTable
ALTER TABLE "public"."leaves" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leaves_organization_id_source_external_id_key" ON "public"."leaves"("organization_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "public"."leaves" ADD CONSTRAINT "leaves_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

