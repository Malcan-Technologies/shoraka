import type {
  DeedOfAssignmentMergeData,
  DeedOfAssignmentTransactionDocument,
} from "./doa-merge.types";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import { formatDisplayDate, formatLetterDate, formatRmAmount } from "../letter-of-offer/lo-format";
import {
  resolveBusinessAddress,
  resolveIssuerRegistrationNumber,
  resolveRegisteredAddress,
} from "../letter-of-offer/build-facility-lo-merge-data";
import {
  getIssuerAuthorizedParty,
  getLoAuthorizedPartiesFromAcceptance,
  getOfferAcceptanceFromOfferDetails,
  type AuthorizedRepresentative,
  type AuthorizedRepresentativeCapacity,
} from "@cashsouk/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function formatDesignation(capacity: AuthorizedRepresentativeCapacity | string): string {
  if (capacity === "director") return "Director";
  if (capacity === "authorised_signatory") return "Authorised Signatory";
  return asString(capacity);
}

function mapSignatory(rep: AuthorizedRepresentative): {
  name: string;
  identity_number: string;
  designation: string;
} {
  return {
    name: asString(rep.name),
    identity_number: asString(rep.ic_number),
    designation: formatDesignation(rep.capacity),
  };
}

function readTrustAccount(ledgerBucketAccountsConfig: unknown): {
  bank_name: string;
  account_name: string;
  account_number: string;
} {
  const root = asRecord(ledgerBucketAccountsConfig);
  const pool = asRecord(root?.REPAYMENT_POOL);
  return {
    bank_name: asString(pool?.bankName),
    account_name: asString(pool?.accountName) || asString(pool?.displayName),
    account_number: asString(pool?.accountNumber),
  };
}

function mapTransactionDocuments(
  invoices: unknown,
  debtorName: string
): DeedOfAssignmentTransactionDocument[] {
  if (!Array.isArray(invoices)) return [];
  const rows: DeedOfAssignmentTransactionDocument[] = [];
  for (const entry of invoices) {
    const invoice = asRecord(entry);
    if (!invoice) continue;
    const details = asRecord(invoice.details) ?? {};
    const nameNumber =
      asString(details.invoice_number) ||
      asString(details.number) ||
      asString(invoice.display_reference);
    const date =
      formatDisplayDate(asString(details.issued_date) || asString(details.date)) ||
      formatDisplayDate(asString(details.start_date));
    const value = formatRmAmount(
      asNumber(details.value) ?? asNumber(details.invoice_value) ?? undefined
    );
    const dueDate = formatDisplayDate(
      asString(details.due_date) || asString(details.maturity_date)
    );
    rows.push({
      transaction_document_name_number: nameNumber,
      transaction_document_date: date,
      debtor_name: debtorName,
      transaction_document_value: value,
      due_date: dueDate,
    });
  }
  return rows;
}

export type BuildDeedOfAssignmentMergeInput = {
  contract: {
    id: string;
    contract_details?: unknown;
    offer_details?: unknown;
    customer_details?: unknown;
    issuer_organization_id: string;
  };
  issuerOrganization: {
    id: string;
    name?: string | null;
    registration_number?: string | null;
    address?: string | null;
    phone_number?: string | null;
    corporate_onboarding_data?: unknown;
  };
  application?: {
    id: string;
    company_details?: unknown;
    invoices?: unknown;
  } | null;
  ledgerBucketAccountsConfig?: unknown;
};

export function buildDeedOfAssignmentMergeData(
  input: BuildDeedOfAssignmentMergeInput
): DeedOfAssignmentMergeData {
  const base = createDeedOfAssignmentFixture();
  const offer = asRecord(input.contract.offer_details);
  const customer = asRecord(input.contract.customer_details);
  const company = asRecord(input.application?.company_details);
  const contact = asRecord(company?.contact_person);
  const sentAt = asString(offer?.sent_at);
  const assignmentDate = sentAt ? formatLetterDate(sentAt) : "";
  const debtorName = asString(customer?.name);
  const acceptance = getOfferAcceptanceFromOfferDetails(input.contract.offer_details);
  const authorizedParties = getLoAuthorizedPartiesFromAcceptance(acceptance);
  const issuerParty = getIssuerAuthorizedParty(authorizedParties);
  const assignor_signatories = (issuerParty?.representatives ?? [])
    .map((rep) => mapSignatory(rep))
    .filter((signatory) => signatory.name);
  const trust = readTrustAccount(input.ledgerBucketAccountsConfig);

  return {
    ...base,
    assignment_date: assignmentDate,
    assignor_company_name: asString(input.issuerOrganization.name),
    assignor_registration_number: resolveIssuerRegistrationNumber(input.issuerOrganization),
    assignor_registered_address: resolveRegisteredAddress(input.issuerOrganization),
    assignor_business_postal_address: resolveBusinessAddress(input.issuerOrganization),
    assignor_email: asString(contact?.email),
    assignor_contact_number:
      asString(contact?.contact) || asString(input.issuerOrganization.phone_number),
    assignor_signatories,
    trust_bank_name: trust.bank_name,
    trust_account_name: trust.account_name,
    trust_account_number: trust.account_number,
    trust_swift_code: "",
    debtor_company_name: debtorName,
    debtor_registration_number: asString(customer?.ssm_number),
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
    transaction_documents: mapTransactionDocuments(input.application?.invoices, debtorName),
  };
}
