import type { DeedOfAssignmentMergeData } from "./doa-merge.types";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import { formatLetterDate } from "../letter-of-offer/lo-format";
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
  swift_code: string;
} {
  const root = asRecord(ledgerBucketAccountsConfig);
  const pool = asRecord(root?.REPAYMENT_POOL);
  return {
    bank_name: asString(pool?.bankName),
    account_name: asString(pool?.accountName) || asString(pool?.displayName),
    account_number: asString(pool?.accountNumber),
    swift_code: asString(pool?.swiftCode) || asString(pool?.swift),
  };
}

export type DeedOfAssignmentOfferKind = "contract" | "invoice";

export type BuildDeedOfAssignmentMergeInput = {
  offerKind: DeedOfAssignmentOfferKind;
  contract: {
    id: string;
    contract_details?: unknown;
    offer_details?: unknown;
    issuer_organization_id: string;
  };
  invoice?: {
    id: string;
    display_reference?: unknown;
    offer_details?: unknown;
  } | null;
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
  } | null;
  ledgerBucketAccountsConfig?: unknown;
};

export function buildDeedOfAssignmentMergeData(
  input: BuildDeedOfAssignmentMergeInput
): DeedOfAssignmentMergeData {
  const base = createDeedOfAssignmentFixture();
  const offerDetails =
    input.offerKind === "invoice" ? input.invoice?.offer_details : input.contract.offer_details;
  const offer = asRecord(offerDetails);
  const company = asRecord(input.application?.company_details);
  const contact = asRecord(company?.contact_person);
  const sentAt = asString(offer?.sent_at);
  const assignmentDate = sentAt ? formatLetterDate(sentAt) : "";
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
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
    trust_swift_code: trust.swift_code,
  };
}
