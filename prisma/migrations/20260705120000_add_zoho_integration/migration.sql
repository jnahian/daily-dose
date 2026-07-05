-- CreateEnum
CREATE TYPE "public"."LeaveSource" AS ENUM ('MANUAL', 'ZOHO');

-- CreateEnum
CREATE TYPE "public"."HolidaySource" AS ENUM ('MANUAL', 'ZOHO');

-- CreateEnum
CREATE TYPE "public"."ZohoSyncType" AS ENUM ('HOLIDAY', 'LEAVE');

-- CreateEnum
CREATE TYPE "public"."ZohoSyncStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "public"."leaves" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "source" "public"."LeaveSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "public"."holidays" ADD COLUMN     "external_id" TEXT,
ADD COLUMN     "source" "public"."HolidaySource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "public"."zoho_credentials" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "data_center" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zoho_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zoho_user_mappings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "zoho_employee_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zoho_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."zoho_sync_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sync_type" "public"."ZohoSyncType" NOT NULL,
    "status" "public"."ZohoSyncStatus" NOT NULL,
    "records_synced" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "zoho_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zoho_credentials_organization_id_key" ON "public"."zoho_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "zoho_user_mappings_user_id_idx" ON "public"."zoho_user_mappings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_user_mappings_organization_id_user_id_key" ON "public"."zoho_user_mappings"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "zoho_user_mappings_organization_id_zoho_employee_id_key" ON "public"."zoho_user_mappings"("organization_id", "zoho_employee_id");

-- CreateIndex
CREATE INDEX "zoho_sync_runs_organization_id_sync_type_started_at_idx" ON "public"."zoho_sync_runs"("organization_id", "sync_type", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "leaves_source_external_id_key" ON "public"."leaves"("source", "external_id");

-- AddForeignKey
ALTER TABLE "public"."zoho_credentials" ADD CONSTRAINT "zoho_credentials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zoho_user_mappings" ADD CONSTRAINT "zoho_user_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zoho_user_mappings" ADD CONSTRAINT "zoho_user_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."zoho_sync_runs" ADD CONSTRAINT "zoho_sync_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

