-- Company Sophisticated Yes/No is an explicit choice. Do not default new companies to Yes or No.
ALTER TABLE "investor_organizations" ALTER COLUMN "is_sophisticated_investor" DROP NOT NULL;
ALTER TABLE "investor_organizations" ALTER COLUMN "is_sophisticated_investor" DROP DEFAULT;
