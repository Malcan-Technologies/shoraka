-- CreateEnum
CREATE TYPE "ReviewSection" AS ENUM ('FINANCIAL', 'JUSTIFICATION', 'DOCUMENTS');

-- CreateEnum
CREATE TYPE "ReviewStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'AMENDMENT_REQUESTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE 'AMENDMENT_REQUESTED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'RESUBMITTED';

-- CreateTable
CREATE TABLE "application_reviews" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "section" "ReviewSection" NOT NULL,
    "status" "ReviewStepStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_review_items" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "status" "ReviewStepStatus" NOT NULL DEFAULT 'PENDING',
    "reviewer_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_review_notes" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "scope_key" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_review_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_review_events" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "scope" TEXT,
    "scope_key" TEXT,
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "reviewer_user_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_review_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_reviews_application_id_idx" ON "application_reviews"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_reviews_application_id_section_key" ON "application_reviews"("application_id", "section");

-- CreateIndex
CREATE INDEX "application_review_items_application_id_idx" ON "application_review_items"("application_id");

-- CreateIndex
CREATE INDEX "application_review_items_application_id_item_type_idx" ON "application_review_items"("application_id", "item_type");

-- CreateIndex
CREATE UNIQUE INDEX "application_review_items_application_id_item_type_item_id_key" ON "application_review_items"("application_id", "item_type", "item_id");

-- CreateIndex
CREATE INDEX "application_review_notes_application_id_idx" ON "application_review_notes"("application_id");

-- CreateIndex
CREATE INDEX "application_review_notes_application_id_scope_key_idx" ON "application_review_notes"("application_id", "scope_key");

-- CreateIndex
CREATE INDEX "application_review_events_application_id_idx" ON "application_review_events"("application_id");

-- CreateIndex
CREATE INDEX "application_review_events_application_id_created_at_idx" ON "application_review_events"("application_id", "created_at");

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_review_items" ADD CONSTRAINT "application_review_items_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_review_notes" ADD CONSTRAINT "application_review_notes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_review_events" ADD CONSTRAINT "application_review_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
