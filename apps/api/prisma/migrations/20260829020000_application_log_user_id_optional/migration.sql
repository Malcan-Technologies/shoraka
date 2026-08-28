-- System/provider-derived application logs have no human actor.
ALTER TABLE "application_logs" ALTER COLUMN "user_id" DROP NOT NULL;
