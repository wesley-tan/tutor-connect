/*
  Warnings:

  - A unique constraint covering the columns `[supabase_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "supabase_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");

-- CreateIndex
CREATE INDEX "users_supabase_id_idx" ON "users"("supabase_id");
