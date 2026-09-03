import type { JsgMergeData } from "./jsg-merge.types";

/** Default values for JSG template render tests (not production generate). */
export function createJsgFixture(): JsgMergeData {
  return {
    guarantee_date: "19 August 2026",
    letter_date: "19 August 2026",
    our_reference: "contract_demo_001",
    issuer_name: "DEMO ISSUER SDN. BHD.",
    issuer_registration_number: "202001012345 (1234567-A)",
    issuer_address: "Level 10, Tower A, 1 Jalan Demo, 50450 Kuala Lumpur, Malaysia",
    issuer_business_address: "Lot 2, Jalan Industri, 40150 Shah Alam, Selangor, Malaysia",
    facility_description:
      "Account Receivable Financing-i Facility of RM 1,000,000.00 as described in the Letter of Offer dated 19 August 2026",
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
    ],
    schedule_guarantors: [
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
    ],
  };
}
