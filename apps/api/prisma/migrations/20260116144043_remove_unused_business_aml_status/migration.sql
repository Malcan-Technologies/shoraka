-- AlterTable: Drop business_aml_status if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'investor_organizations' 
        AND column_name = 'business_aml_status'
    ) THEN
        ALTER TABLE "investor_organizations" DROP COLUMN "business_aml_status";
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'issuer_organizations' 
        AND column_name = 'business_aml_status'
    ) THEN
        ALTER TABLE "issuer_organizations" DROP COLUMN "business_aml_status";
    END IF;
END $$;
