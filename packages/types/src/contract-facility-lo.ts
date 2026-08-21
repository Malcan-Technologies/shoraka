/**
 * Merge payload for ARF-i contract facility Letter of Offer (LO).
 * Shared by admin demo and production generate (`arf_contract_facility_lo`).
 */

export type ContractFacilityLoIndividualGuarantor = {
  name: string;
  nric: string;
  /** Formatted "Name (NRIC No. …)" for finance-document lists. */
  line: string;
};

export type ContractFacilityLoMergeData = {
  issuer_id: string;
  our_reference: string;
  letter_date: string;
  issuer_name: string;
  issuer_registration_number: string;
  issuer_address: string;
  attention_name: string;
  attention_position: string;
  /** Part A financing limit — main schedule + Schedule A + MoA. */
  financing_limit_rm: string;
  /** Main schedule “Up to N days”. */
  tenure_days: string;
  /** Schedule A Part A + Part B max invoice tenure (“up to N”). */
  max_invoice_tenure_days: string;
  /** Schedule A Part A sub-limit per invoice. */
  sub_limit_per_invoice_rm: string;
  /** Schedule A Part B financing amount per invoice. */
  part_b_financing_amount_rm: string;
  /** Individual guarantors — repeated in Word via docxtemplater loops. */
  guarantors_individual: ContractFacilityLoIndividualGuarantor[];
  payment_period_days: string;
  grace_period_days: string;
  grace_period_days_words: string;
  transaction_docs_days: string;
  transaction_docs_days_words: string;
  offer_validity_phrase: string;
  assigned_contract_date: string;
  assigned_contract_counterparty: string;
  assigned_contract_description: string;
  moa_authorised_signatory_names: string;
  corporate_guarantor_name: string;
  corporate_guarantor_ssm: string;
  corporate_signatory_1_name: string;
  corporate_signatory_2_name: string;
};

/** Scalar merge keys (demo form + Zod body). Arrays are handled separately. */
export const CONTRACT_FACILITY_LO_MERGE_KEYS = [
  "issuer_id",
  "our_reference",
  "letter_date",
  "issuer_name",
  "issuer_registration_number",
  "issuer_address",
  "attention_name",
  "attention_position",
  "financing_limit_rm",
  "tenure_days",
  "max_invoice_tenure_days",
  "sub_limit_per_invoice_rm",
  "part_b_financing_amount_rm",
  "payment_period_days",
  "grace_period_days",
  "grace_period_days_words",
  "transaction_docs_days",
  "transaction_docs_days_words",
  "offer_validity_phrase",
  "assigned_contract_date",
  "assigned_contract_counterparty",
  "assigned_contract_description",
  "moa_authorised_signatory_names",
  "corporate_guarantor_name",
  "corporate_guarantor_ssm",
  "corporate_signatory_1_name",
  "corporate_signatory_2_name",
] as const satisfies ReadonlyArray<keyof ContractFacilityLoMergeData>;
