/**
 * Merge payload for the ARF Deed of Assignment.
 * Shared by production generate (`arf_deed_of_assignment`).
 *
 * Schedule 2 stays the prescribed form (no merge tags). Schedule 3 is a standing
 * Nil note at execution — neither schedule is filled from platform data.
 */

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
] as const satisfies ReadonlyArray<keyof DeedOfAssignmentMergeData>;

export const DEED_OF_ASSIGNMENT_SIGNATORY_KEYS = [
  "name",
  "identity_number",
  "designation",
] as const satisfies ReadonlyArray<keyof DeedOfAssignmentSignatory>;
