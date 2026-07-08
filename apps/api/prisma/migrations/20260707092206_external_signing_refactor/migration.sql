/*
  Warnings:

  - You are about to alter the column `user_id` on the `signingcloud_ekyc` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(5)`.

*/
-- DropForeignKey
ALTER TABLE "signingcloud_ekyc" DROP CONSTRAINT "signingcloud_ekyc_user_id_fkey";

-- AlterTable
ALTER TABLE "signingcloud_ekyc" ALTER COLUMN "user_id" SET DATA TYPE VARCHAR(5),
ALTER COLUMN "doc_type" SET DEFAULT 'mykad';

-- AddForeignKey
ALTER TABLE "signingcloud_ekyc" ADD CONSTRAINT "signingcloud_ekyc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
