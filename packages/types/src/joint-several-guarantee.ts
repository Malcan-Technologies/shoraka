/**
 * Merge payload for the ARF Joint and Several Guarantee (JSG).
 * Shared by production generate (`arf_joint_several_guarantee`).
 * Guarantor loops reuse LO page-break helpers.
 */

import type {
  ContractFacilityLoCorporateGuarantor,
  ContractFacilityLoFinanceDocumentParty,
  ContractFacilityLoIndividualGuarantor,
} from "./contract-facility-lo";

export type JsgMergeData = {
  guarantee_date: string;
  letter_date: string;
  our_reference: string;
  issuer_name: string;
  issuer_registration_number: string;
  issuer_address: string;
  issuer_business_address: string;
  facility_description: string;
  guarantors_individual: ContractFacilityLoIndividualGuarantor[];
  guarantors_corporate: ContractFacilityLoCorporateGuarantor[];
  schedule_guarantors: ContractFacilityLoFinanceDocumentParty[];
};

/** Scalar merge keys. Arrays are handled separately. */
export const JSG_MERGE_KEYS = [
  "guarantee_date",
  "letter_date",
  "our_reference",
  "issuer_name",
  "issuer_registration_number",
  "issuer_address",
  "issuer_business_address",
  "facility_description",
] as const satisfies ReadonlyArray<keyof JsgMergeData>;
