/**
 * Merge payload for the ARF Deed of Assignment.
 * Shared by production generate (`arf_deed_of_assignment`).
 */

export type DeedOfAssignmentTransactionDocument = {
  transaction_document_name_number: string;
  transaction_document_date: string;
  debtor_name: string;
  transaction_document_value: string;
  due_date: string;
};

export type DeedOfAssignmentSignatory = {
  name: string;
  identity_number: string;
  designation: string;
};

export type DeedOfAssignmentMergeData = {
  assignment_date: string;
  assignor_company_name: string;
  assignor_registration_number: string;
  assignor_registered_address: string;
  assignor_business_postal_address: string;
  assignor_email: string;
  assignor_contact_number: string;
  assignor_signatories: DeedOfAssignmentSignatory[];
  trust_bank_name: string;
  trust_account_name: string;
  trust_account_number: string;
  trust_swift_code: string;
  debtor_company_name: string;
  debtor_registration_number: string;
  debtor_address: string;
  debtor_attention: string;
  notice_date: string;
  notice_signatory_name: string;
  notice_signatory_designation: string;
  outstanding_amount: string;
  balance_as_of_date: string;
  debtor_signatory_name: string;
  debtor_signatory_designation: string;
  acknowledgement_date: string;
  transaction_documents: DeedOfAssignmentTransactionDocument[];
};

/** Scalar merge keys. Arrays are handled separately. */
export const DEED_OF_ASSIGNMENT_MERGE_KEYS = [
  "assignment_date",
  "assignor_company_name",
  "assignor_registration_number",
  "assignor_registered_address",
  "assignor_business_postal_address",
  "assignor_email",
  "assignor_contact_number",
  "trust_bank_name",
  "trust_account_name",
  "trust_account_number",
  "trust_swift_code",
  "debtor_company_name",
  "debtor_registration_number",
  "debtor_address",
  "debtor_attention",
  "notice_date",
  "notice_signatory_name",
  "notice_signatory_designation",
  "outstanding_amount",
  "balance_as_of_date",
  "debtor_signatory_name",
  "debtor_signatory_designation",
  "acknowledgement_date",
] as const satisfies ReadonlyArray<keyof DeedOfAssignmentMergeData>;

export const DEED_OF_ASSIGNMENT_SIGNATORY_KEYS = [
  "name",
  "identity_number",
  "designation",
] as const satisfies ReadonlyArray<keyof DeedOfAssignmentSignatory>;

export const DEED_OF_ASSIGNMENT_TRANSACTION_DOCUMENT_KEYS = [
  "transaction_document_name_number",
  "transaction_document_date",
  "debtor_name",
  "transaction_document_value",
  "due_date",
] as const satisfies ReadonlyArray<keyof DeedOfAssignmentTransactionDocument>;
