-- DropIndex
DROP INDEX "signingcloud_ekyc_email_idx";

-- AlterTable
ALTER TABLE "signingcloud_ekyc" DROP CONSTRAINT "signingcloud_ekyc_pkey",
DROP COLUMN "id",
DROP COLUMN "email",
DROP COLUMN "country",
DROP COLUMN "name",
DROP COLUMN "id_number",
DROP COLUMN "wiseai_encryption",
DROP COLUMN "submit_response",
ADD CONSTRAINT "signingcloud_ekyc_pkey" PRIMARY KEY ("user_id");

-- DropIndex
DROP INDEX "signingcloud_ekyc_user_id_key";
