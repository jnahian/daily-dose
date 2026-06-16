-- CreateEnum
CREATE TYPE "public"."TeamStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."teams" ADD COLUMN     "status" "public"."TeamStatus" NOT NULL DEFAULT 'ACTIVE';
