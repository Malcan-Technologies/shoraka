/**
 * SoukScore-aligned guarantor relationship values stored on application.business_details.guarantors.
 */

export const GUARANTOR_INDIVIDUAL_RELATIONSHIPS = [
  "family_members_of_director",
  "director_shareholder",
  "unrelated_party",
  "others",
] as const;

export const GUARANTOR_COMPANY_RELATIONSHIPS = [
  "parent_company",
  "subsidiary",
  "related_party",
] as const;

export type GuarantorIndividualRelationship = (typeof GUARANTOR_INDIVIDUAL_RELATIONSHIPS)[number];
export type GuarantorCompanyRelationship = (typeof GUARANTOR_COMPANY_RELATIONSHIPS)[number];

export const GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS: Record<
  GuarantorIndividualRelationship,
  string
> = {
  family_members_of_director: "Family members of director",
  director_shareholder: "Director / shareholder",
  unrelated_party: "Unrelated party",
  others: "Others",
};

export const GUARANTOR_COMPANY_RELATIONSHIP_LABELS: Record<GuarantorCompanyRelationship, string> =
  {
    parent_company: "Parent company",
    subsidiary: "Subsidiary",
    related_party: "Related party",
  };
