import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";
import { FACILITY_LO_CHECKBOX_TICKED, FACILITY_LO_CHECKBOX_UNTICKED } from "./facility-lo-merge.types";

/** Default form values for the admin LO demo (editable). */
export function createFacilityLoFixture(): ContractFacilityLoMergeData {
  return {
    issuer_id: "issuer_org_demo_001",
    our_reference: "contract_demo_001",
    letter_date: "19 August 2026",
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
    part_a_checkbox: FACILITY_LO_CHECKBOX_TICKED,
    part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
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
    guarantors_corporate: [
      {
        name: "HOLDCO ONE SDN. BHD.",
        ssm: "123456-A",
        signatories: [
          { name: "Nora Abdullah", nric: "880101015555", capacity: "authorised_signatory" },
          { name: "Farid Hassan", nric: "770202025555", capacity: "director" },
        ],
      },
      {
        name: "HOLDCO TWO SDN. BHD.",
        ssm: "654321-U",
        signatories: [
          { name: "Aini Rahman", nric: "660101015555", capacity: "director" },
          { name: "Bala Krishnan", nric: "550202025555", capacity: "director" },
          { name: "Chen Wei", nric: "440303035555", capacity: "authorised_signatory" },
          { name: "Devi Nair", nric: "330404045555", capacity: "director" },
          { name: "Ehsan Malik", nric: "220505055555", capacity: "authorised_signatory" },
        ],
      },
    ],
    finance_documents_guarantors: [
      {
        line: "Ali Bin Abu (NRIC No. 900101145678)",
        representatives: [],
      },
      {
        line: "Siti Binti Ahmad (NRIC No. 880202085432)",
        representatives: [],
      },
      {
        line: "HOLDCO ONE SDN. BHD. (Registration No. 123456-A)",
        representatives: [
          { rep_line: "Nora Abdullah (NRIC No. 880101015555)" },
          { rep_line: "Farid Hassan (NRIC No. 770202025555)" },
        ],
      },
      {
        line: "HOLDCO TWO SDN. BHD. (Registration No. 654321-U)",
        representatives: [
          { rep_line: "Aini Rahman (NRIC No. 660101015555)" },
          { rep_line: "Bala Krishnan (NRIC No. 550202025555)" },
          { rep_line: "Chen Wei (NRIC No. 440303035555)" },
          { rep_line: "Devi Nair (NRIC No. 330404045555)" },
          { rep_line: "Ehsan Malik (NRIC No. 220505055555)" },
        ],
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
  };
}
