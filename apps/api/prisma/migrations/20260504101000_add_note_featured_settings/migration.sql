ALTER TABLE "notes"
ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featured_rank" INTEGER,
ADD COLUMN "featured_from" TIMESTAMP(3),
ADD COLUMN "featured_until" TIMESTAMP(3);

CREATE INDEX "notes_is_featured_featured_rank_idx" ON "notes"("is_featured", "featured_rank");
CREATE INDEX "notes_featured_from_featured_until_idx" ON "notes"("featured_from", "featured_until");
