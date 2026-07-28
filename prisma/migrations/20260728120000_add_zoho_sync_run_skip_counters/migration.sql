-- AlterTable
ALTER TABLE "public"."zoho_sync_runs" ADD COLUMN     "skipped_unmapped" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skipped_not_approved" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skipped_invalid" INTEGER NOT NULL DEFAULT 0;
