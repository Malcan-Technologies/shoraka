-- Access-token denylist used after logout so a still-valid Cognito JWT is rejected.
CREATE TABLE "revoked_access_tokens" (
    "jti" TEXT NOT NULL,
    "user_id" VARCHAR(5) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_access_tokens_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "revoked_access_tokens_expires_at_idx" ON "revoked_access_tokens"("expires_at");

CREATE INDEX "revoked_access_tokens_user_id_idx" ON "revoked_access_tokens"("user_id");

ALTER TABLE "revoked_access_tokens" ADD CONSTRAINT "revoked_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
