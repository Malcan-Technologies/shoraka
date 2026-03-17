-- CreateEnum
CREATE TYPE "WithdrawReason" AS ENUM ('USER_CANCELLED', 'OFFER_EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "ApplicationStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'WITHDRAWN';

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "withdraw_reason" "WithdrawReason";

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "withdraw_reason" "WithdrawReason";
