/**
 * Merge payload for the ARF Facility Agreement (FA).
 * Shared by production generate (`arf_facility_agreement`).
 * Guarantor loops reuse LO identity helpers.
 */

import type {
  ContractFacilityLoCorporateGuarantor,
  ContractFacilityLoIndividualGuarantor,
} from "./contract-facility-lo";

export type FacilityAgreementIssuerSignatory = {
  name: string;
  designation: string;
};

export type FacilityAgreementMergeData = {
  facility_agreement_date: string;
  letter_date: string;
  our_reference: string;
  issuer_name: string;
  issuer_registration_number: string;
  issuer_address: string;
  issuer_email: string;
  facility_description: string;
  financing_limit_rm: string;
  sub_limit_per_invoice_rm: string;
  facility_fee_rate_percent: string;
  drawdown_fee: string;
  trustee_disclosure_email: string;
  issuer_bank_name: string;
  issuer_bank_branch: string;
  issuer_bank_account_name: string;
  issuer_bank_swift: string;
  guarantors_individual: ContractFacilityLoIndividualGuarantor[];
  guarantors_corporate: ContractFacilityLoCorporateGuarantor[];
  issuer_signatories: FacilityAgreementIssuerSignatory[];
};

/** Scalar merge keys. Arrays are handled separately. */
export const FACILITY_AGREEMENT_MERGE_KEYS = [
  "facility_agreement_date",
  "letter_date",
  "our_reference",
  "issuer_name",
  "issuer_registration_number",
  "issuer_address",
  "issuer_email",
  "facility_description",
  "financing_limit_rm",
  "sub_limit_per_invoice_rm",
  "facility_fee_rate_percent",
  "drawdown_fee",
  "trustee_disclosure_email",
  "issuer_bank_name",
  "issuer_bank_branch",
  "issuer_bank_account_name",
  "issuer_bank_swift",
] as const satisfies ReadonlyArray<keyof FacilityAgreementMergeData>;
