import type { FacilityAgreementMergeData } from "./fa-merge.types";

/** Default values for Facility Agreement render tests (not production generate). */
export function createFacilityAgreementFixture(): FacilityAgreementMergeData {
  return {
    facility_agreement_date: "{facility_agreement_date}",
    letter_date: "19 August 2026",
    our_reference: "contract_demo_001",
    issuer_name: "DEMO ISSUER SDN. BHD.",
    issuer_registration_number: "202001012345 (1234567-A)",
    issuer_address: "Level 10, Tower A, 1 Jalan Demo, 50450 Kuala Lumpur, Malaysia",
    issuer_email: "finance@demo-issuer.my",
    facility_description:
      "Account Receivable Financing-i Facility of RM 1,000,000.00 as described in the Letter of Offer dated 19 August 2026",
    financing_limit_rm: "RM 1,000,000.00",
    sub_limit_per_invoice_rm: "RM 250,000.00",
    facility_fee_rate_percent: "1%",
    drawdown_fee: "{drawdown_fee}",
    trustee_disclosure_email: "trustee@example.com",
    issuer_bank_name: "Maybank",
    issuer_bank_branch: "{issuer_bank_branch}",
    issuer_bank_account_name: "DEMO ISSUER SDN. BHD.",
    issuer_bank_swift: "{issuer_bank_swift}",
    guarantors_individual: [
      {
        name: "Ali Bin Abu",
        nric: "900101145678",
        line: "Ali Bin Abu (NRIC No. 900101145678)",
      },
    ],
    guarantors_corporate: [
      {
        name: "HOLDCO ONE SDN. BHD.",
        ssm: "123456-A",
        signatories: [
          { name: "Nora Abdullah", nric: "880101015555", capacity: "authorised_signatory" },
        ],
      },
    ],
    issuer_signatories: [
      { name: "Ali Bin Abu", designation: "Director" },
      { name: "Siti Binti Ahmad", designation: "Authorised Signatory" },
    ],
  };
}
