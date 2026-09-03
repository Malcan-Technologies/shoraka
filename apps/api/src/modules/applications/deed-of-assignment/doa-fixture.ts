import type { DeedOfAssignmentMergeData } from "./doa-merge.types";

/** Default values for Deed of Assignment render tests (not production generate). */
export function createDeedOfAssignmentFixture(): DeedOfAssignmentMergeData {
  return {
    assignment_date: "19 August 2026",
    assignor_company_name: "DEMO ISSUER SDN. BHD.",
    assignor_registration_number: "202001012345 (1234567-A)",
    assignor_registered_address: "Level 10, Tower A, 1 Jalan Demo, 50450 Kuala Lumpur, Malaysia",
    assignor_business_postal_address: "Lot 2, Jalan Industri, 40150 Shah Alam, Selangor, Malaysia",
    assignor_email: "finance@demo-issuer.my",
    assignor_contact_number: "+60 3-1234 5678",
    assignor_signatories: [
      {
        name: "Ali Bin Abu",
        identity_number: "820508105871",
        designation: "Director",
      },
      {
        name: "Siti Binti Ahmad",
        identity_number: "900101015555",
        designation: "Director",
      },
    ],
    trust_bank_name: "Demo Trustee Bank",
    trust_account_name: "CashSouk Repayment Pool",
    trust_account_number: "1234567890",
    trust_swift_code: "",
    debtor_company_name: "BUYER CO SDN. BHD.",
    debtor_registration_number: "202134567890",
    debtor_address: "",
    debtor_attention: "",
    notice_date: "",
    notice_signatory_name: "",
    notice_signatory_designation: "",
    outstanding_amount: "",
    balance_as_of_date: "",
    debtor_signatory_name: "",
    debtor_signatory_designation: "",
    acknowledgement_date: "",
    transaction_documents: [
      {
        transaction_document_name_number: "INV-001",
        transaction_document_date: "1 July 2026",
        debtor_name: "BUYER CO SDN. BHD.",
        transaction_document_value: "RM 50,000.00",
        due_date: "30 August 2026",
      },
    ],
  };
}
