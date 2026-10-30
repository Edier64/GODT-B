/*
  Warnings:

  - Added the required column `updated_at` to the `DONATION_LEGALIZATION` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DONATION_LEGALIZATION" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;
