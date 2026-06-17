-- Replace enum in one step; map legacy submitted -> verified via CASE (avoids
-- PostgreSQL "new enum values must be committed before they can be used").
CREATE TYPE "SigningCloudEkycStatus_new" AS ENUM ('pending', 'verified', 'failed', 'error');

ALTER TABLE "signingcloud_ekyc"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SigningCloudEkycStatus_new"
    USING (
      CASE "status"::text
        WHEN 'submitted' THEN 'verified'
        ELSE "status"::text
      END
    )::"SigningCloudEkycStatus_new";

ALTER TABLE "signingcloud_ekyc"
  ALTER COLUMN "status" SET DEFAULT 'pending';

DROP TYPE "SigningCloudEkycStatus";
ALTER TYPE "SigningCloudEkycStatus_new" RENAME TO "SigningCloudEkycStatus";
