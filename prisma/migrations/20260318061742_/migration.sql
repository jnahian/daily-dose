/*
  Warnings:

  - You are about to drop the column `country` on the `holidays` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[organization_id,date]` on the table `holidays` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organization_id` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `holidays` table without a default value. This is not possible if the table is not empty.
  - Made the column `name` on table `holidays` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."holidays_date_country_key";

-- AlterTable
ALTER TABLE "public"."holidays" DROP COLUMN "country",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."team_members" ADD COLUMN     "hide_from_not_responded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receive_notifications" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."teams" ALTER COLUMN "standup_time" SET DATA TYPE TEXT,
ALTER COLUMN "posting_time" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "public"."super_admins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_by" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_user_id_key" ON "public"."super_admins"("user_id");

-- CreateIndex
CREATE INDEX "super_admins_user_id_idx" ON "public"."super_admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "public"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "public"."sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "public"."sessions"("expires_at");

-- CreateIndex
CREATE INDEX "holidays_organization_id_idx" ON "public"."holidays"("organization_id");

-- CreateIndex
CREATE INDEX "holidays_date_idx" ON "public"."holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_organization_id_date_key" ON "public"."holidays"("organization_id", "date");

-- AddForeignKey
ALTER TABLE "public"."holidays" ADD CONSTRAINT "holidays_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."super_admins" ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
