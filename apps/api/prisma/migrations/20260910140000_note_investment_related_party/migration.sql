-- ComRep [07000] Investment by Related Party belongs to the investment, not investor profile.
CREATE TYPE "ScInvestmentRelatedParty" AS ENUM (
  'SHAREHOLDER_OF_RMO',
  'RELATED_CO_OF_RMO',
  'OFFICER_OF_RMO',
  'NOT_APPLICABLE'
);

ALTER TABLE "note_investments"
  ADD COLUMN "investment_by_related_party" "ScInvestmentRelatedParty";
