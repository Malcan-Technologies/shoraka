import { SC_DESIGNATION_LABELS } from "@cashsouk/types";
import type { DeedOfAssignmentMergeData } from "../applications/deed-of-assignment/doa-merge.types";
import type { FacilityAgreementMergeData } from "../applications/facility-agreement/fa-merge.types";
import type { JsgMergeData } from "../applications/joint-several-guarantee/jsg-merge.types";
import type { ContractFacilityLoMergeData } from "../applications/letter-of-offer/facility-lo-merge.types";

/** Longest SC board label — this is the string that wrapped under Signed by. */
export const LONG_SC_DESIGNATION =
  SC_DESIGNATION_LABELS.DEPUTY_CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT;

export const LONG_PERSON_NAME =
  "Tunku Puan Sri Datin Seri Wan Nur Aisyah binti Tengku Abdul Rahman";

export const LONG_COMPANY_NAME =
  "Perusahaan Perkilangan Komponen Elektronik Termaju Holdings Sdn. Bhd.";

export const LONG_ADDRESS =
  "Unit 12-01, Level 12, Menara Southpoint, Mid Valley City, Lingkaran Syed Putra, 59200 Kuala Lumpur, Wilayah Persekutuan, Malaysia";

export const LONG_IDENTITY_NUMBER =
  "900101-14-5678 / Passport K12345678 (Malaysian IC and international passport)";

export const LONG_EMAIL = "finance.treasury.operations@perusahaan-perkilangan-elektronik.my";

export const LONG_BANK_NAME = "Malayan Banking Berhad (Maybank) Trustee Services";

export const LONG_CONTRACT_DESCRIPTION =
  "supply of precision electronic components and related after-sales maintenance under Master Purchase Agreement MPA-2026-0147";

export function withLongDeedOfAssignmentStrings(
  base: DeedOfAssignmentMergeData
): DeedOfAssignmentMergeData {
  return {
    ...base,
    assignor_company_name: LONG_COMPANY_NAME,
    assignor_registered_address: LONG_ADDRESS,
    assignor_business_postal_address: LONG_ADDRESS,
    assignor_email: LONG_EMAIL,
    ssp_1_name: LONG_PERSON_NAME,
    ssp_1_designation: LONG_SC_DESIGNATION,
    ssp_2_name: LONG_PERSON_NAME,
    ssp_2_designation: LONG_SC_DESIGNATION,
    trust_bank_name: LONG_BANK_NAME,
    trust_account_name: `${LONG_COMPANY_NAME} Repayment Pool`,
    assignor_signatories: base.assignor_signatories.map((signatory) => ({
      ...signatory,
      name: LONG_PERSON_NAME,
      identity_number: LONG_IDENTITY_NUMBER,
      designation: LONG_SC_DESIGNATION,
      witness_name: LONG_PERSON_NAME,
      witness_designation: LONG_SC_DESIGNATION,
    })),
  };
}

export function withLongFacilityAgreementStrings(
  base: FacilityAgreementMergeData
): FacilityAgreementMergeData {
  return {
    ...base,
    issuer_name: LONG_COMPANY_NAME,
    issuer_address: LONG_ADDRESS,
    issuer_email: LONG_EMAIL,
    issuer_bank_name: LONG_BANK_NAME,
    issuer_bank_account_name: LONG_COMPANY_NAME,
    investor_1_name: LONG_PERSON_NAME,
    investor_1_designation: LONG_SC_DESIGNATION,
    investor_2_name: LONG_PERSON_NAME,
    investor_2_designation: LONG_SC_DESIGNATION,
    agent_1_name: LONG_PERSON_NAME,
    agent_1_designation: LONG_SC_DESIGNATION,
    agent_2_name: LONG_PERSON_NAME,
    agent_2_designation: LONG_SC_DESIGNATION,
    issuer_signatories: base.issuer_signatories.map((signatory) => ({
      ...signatory,
      name: LONG_PERSON_NAME,
      designation: LONG_SC_DESIGNATION,
      witness_name: LONG_PERSON_NAME,
      witness_nric: LONG_IDENTITY_NUMBER,
    })),
  };
}

export function withLongJsgStrings(base: JsgMergeData): JsgMergeData {
  return {
    ...base,
    issuer_name: LONG_COMPANY_NAME,
    issuer_address: LONG_ADDRESS,
    issuer_business_address: LONG_ADDRESS,
    operator_1_name: LONG_PERSON_NAME,
    operator_1_nric: LONG_IDENTITY_NUMBER,
    operator_1_designation: LONG_SC_DESIGNATION,
    operator_2_name: LONG_PERSON_NAME,
    operator_2_nric: LONG_IDENTITY_NUMBER,
    operator_2_designation: LONG_SC_DESIGNATION,
    guarantor_witness_name: LONG_PERSON_NAME,
    guarantor_witness_nric: LONG_IDENTITY_NUMBER,
    guarantors_individual: base.guarantors_individual.map((row) => ({
      ...row,
      name: LONG_PERSON_NAME,
      nric: LONG_IDENTITY_NUMBER,
      line: `${LONG_PERSON_NAME} (NRIC No. ${LONG_IDENTITY_NUMBER})`,
    })),
    guarantors_corporate: base.guarantors_corporate.map((row) => ({
      ...row,
      name: LONG_COMPANY_NAME,
      signatories: row.signatories.map((signatory) => ({
        ...signatory,
        name: LONG_PERSON_NAME,
        nric: LONG_IDENTITY_NUMBER,
      })),
    })),
    schedule_guarantors: base.schedule_guarantors.map((row) => ({
      line: row.representatives.length
        ? `${LONG_COMPANY_NAME} (Registration No. 123456-A)`
        : `${LONG_PERSON_NAME} (NRIC No. 900101145678)`,
      representatives: row.representatives.map(() => ({
        rep_line: `${LONG_PERSON_NAME} (NRIC No. 880101015555)`,
      })),
    })),
  };
}

export function withLongFacilityLoStrings(
  base: ContractFacilityLoMergeData
): ContractFacilityLoMergeData {
  return {
    ...base,
    issuer_name: LONG_COMPANY_NAME,
    issuer_address: LONG_ADDRESS,
    attention_name: LONG_PERSON_NAME,
    attention_position: LONG_SC_DESIGNATION,
    assigned_contract_counterparty: LONG_COMPANY_NAME,
    assigned_contract_description: LONG_CONTRACT_DESCRIPTION,
    guarantors_individual: base.guarantors_individual.map((row) => ({
      ...row,
      name: LONG_PERSON_NAME,
      line: `${LONG_PERSON_NAME} (NRIC No. ${row.nric})`,
    })),
    guarantors_corporate: base.guarantors_corporate.map((row) => ({
      ...row,
      name: LONG_COMPANY_NAME,
      signatories: row.signatories.map((signatory) => ({
        ...signatory,
        name: LONG_PERSON_NAME,
      })),
    })),
    finance_documents_guarantors: base.finance_documents_guarantors.map((row) => ({
      ...row,
      line: row.representatives.length
        ? `${LONG_COMPANY_NAME} (Registration No. 123456-A)`
        : `${LONG_PERSON_NAME} (NRIC No. 900101145678)`,
      representatives: row.representatives.map(() => ({
        rep_line: `${LONG_PERSON_NAME} (NRIC No. 880101015555)`,
      })),
    })),
  };
}
