-- Backfill email from account before adding NOT NULL constraint.
ALTER TABLE "signingcloud_ekyc" ADD COLUMN "email" TEXT;

UPDATE "signingcloud_ekyc" AS ekyc
SET "email" = users.email
FROM "users" AS users
WHERE ekyc.user_id = users.user_id;

ALTER TABLE "signingcloud_ekyc" ALTER COLUMN "email" SET NOT NULL;

-- Surrogate primary key (user_id was previously the PK).
ALTER TABLE "signingcloud_ekyc" DROP CONSTRAINT "signingcloud_ekyc_pkey";
ALTER TABLE "signingcloud_ekyc" ADD COLUMN "id" TEXT;

UPDATE "signingcloud_ekyc"
SET "id" = 'ekyc_' || "user_id"
WHERE "id" IS NULL;

ALTER TABLE "signingcloud_ekyc" ALTER COLUMN "id" SET NOT NULL;

ALTER TABLE "signingcloud_ekyc" ADD CONSTRAINT "signingcloud_ekyc_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "signingcloud_ekyc_user_id_email_key" ON "signingcloud_ekyc"("user_id", "email");
CREATE INDEX "signingcloud_ekyc_user_id_idx" ON "signingcloud_ekyc"("user_id");
