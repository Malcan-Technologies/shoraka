-- DropForeignKey
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_admin_user_id_fkey";

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
