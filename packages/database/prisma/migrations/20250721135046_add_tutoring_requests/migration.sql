/*
  Warnings:

  - You are about to drop the column `auth_provider` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `google_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `supabase_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `magic_links` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `password_hash` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "request_status_enum" AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "request_urgency_enum" AS ENUM ('low', 'normal', 'high', 'urgent');

-- DropForeignKey
ALTER TABLE "magic_links" DROP CONSTRAINT "magic_links_email_fkey";

-- DropIndex
DROP INDEX "users_auth_provider_idx";

-- DropIndex
DROP INDEX "users_google_id_idx";

-- DropIndex
DROP INDEX "users_google_id_key";

-- DropIndex
DROP INDEX "users_supabase_id_idx";

-- DropIndex
DROP INDEX "users_supabase_id_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "auth_provider",
DROP COLUMN "google_id",
DROP COLUMN "supabase_id",
ALTER COLUMN "password_hash" SET NOT NULL;

-- DropTable
DROP TABLE "magic_links";

-- CreateTable
CREATE TABLE "tutoring_requests" (
    "id" TEXT NOT NULL,
    "tutee_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "preferred_schedule" TEXT,
    "budget" DECIMAL(10,2),
    "urgency" "request_urgency_enum" NOT NULL DEFAULT 'normal',
    "status" "request_status_enum" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tutoring_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_responses" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "proposed_rate" DECIMAL(10,2),
    "proposed_schedule" TEXT,
    "is_accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tutoring_requests_tutee_id_idx" ON "tutoring_requests"("tutee_id");

-- CreateIndex
CREATE INDEX "tutoring_requests_subject_id_idx" ON "tutoring_requests"("subject_id");

-- CreateIndex
CREATE INDEX "tutoring_requests_status_idx" ON "tutoring_requests"("status");

-- CreateIndex
CREATE INDEX "tutoring_requests_urgency_idx" ON "tutoring_requests"("urgency");

-- CreateIndex
CREATE INDEX "tutoring_requests_created_at_idx" ON "tutoring_requests"("created_at");

-- CreateIndex
CREATE INDEX "request_responses_request_id_idx" ON "request_responses"("request_id");

-- CreateIndex
CREATE INDEX "request_responses_tutor_id_idx" ON "request_responses"("tutor_id");

-- CreateIndex
CREATE INDEX "request_responses_is_accepted_idx" ON "request_responses"("is_accepted");

-- CreateIndex
CREATE UNIQUE INDEX "request_responses_request_id_tutor_id_key" ON "request_responses"("request_id", "tutor_id");

-- AddForeignKey
ALTER TABLE "tutoring_requests" ADD CONSTRAINT "tutoring_requests_tutee_id_fkey" FOREIGN KEY ("tutee_id") REFERENCES "tutee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutoring_requests" ADD CONSTRAINT "tutoring_requests_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "tutoring_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_responses" ADD CONSTRAINT "request_responses_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
