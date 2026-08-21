import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";

/** Default form values for the admin LO demo (editable). */
export function createFacilityLoFixture(): ContractFacilityLoMergeData {
  return {
    issuer_id: "issuer_org_demo_001",
    our_reference: "contract_demo_001",
    letter_date: "16 August 2026",
    issuer_name: "DEMO ISSUER SDN. BHD.",
    issuer_registration_number: "202001012345 (1234567-A)",
    issuer_address: "Level 10, Tower A, 1 Jalan Demo, 50450 Kuala Lumpur, Malaysia",
    attention_name: "Jane Doe",
    attention_position: "Director",
    financing_limit_rm: "RM 1,000,000.00",
    tenure_days: "120",
    max_invoice_tenure_days: "180",
    sub_limit_per_invoice_rm: "RM 1,000,000.00",
    part_b_financing_amount_rm: "RM 1,000,000.00",
    guarantors_individual: [
      {
        name: "Ali Bin Abu",
        nric: "900101145678",
        line: "Ali Bin Abu (NRIC No. 900101145678)",
      },
      {
        name: "Siti Binti Ahmad",
        nric: "880202085432",
        line: "Siti Binti Ahmad (NRIC No. 880202085432)",
      },
    ],
    payment_period_days: "90",
    grace_period_days: "7",
    grace_period_days_words: "seven",
    transaction_docs_days: "14",
    transaction_docs_days_words: "fourteen",
    offer_validity_phrase: "seven (7) days",
    assigned_contract_date: "1 January 2026",
    assigned_contract_counterparty: "DEMO BUYER SDN. BHD.",
    assigned_contract_description: "supply of goods under Purchase Order PO-2026-001",
    moa_authorised_signatory_names: "Jane Doe",
    corporate_guarantor_name: "",
    corporate_guarantor_ssm: "",
    corporate_signatory_1_name: "",
    corporate_signatory_2_name: "",
  };
}
