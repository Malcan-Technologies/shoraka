/**
 * Admin Paymaster Detail: derive submitted application identities from linked
 * contract.customer_details. Same SSM still maps to one master; these rows are
 * reference/history only.
 */

import type { PaymasterSubmittedApplicationIdentity } from "@cashsouk/types";
import {
  parseSubmittedIdentity,
  submittedIdentityConflictsWithMaster,
  type PaymasterSubmittedIdentity,
} from "./identity";

export type PaymasterMasterIdentityRow = {
  legal_name: string;
  entity_type: string;
  registration_country: string;
  registration_number: string;
};

export type LinkedApplicationIdentitySource = {
  applicationId: string;
  applicationDisplayReference: string | null;
  applicationProductId: string | null;
  applicationStatus: string | null;
  submittedAt: string | null;
  issuerOrganizationId: string;
  issuerName: string | null;
  customerDetails: unknown;
};

export function productIdFromFinancingType(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = (value as { product_id?: unknown }).product_id;
  return typeof id === "string" && id.trim() ? id : null;
}

export function submittedIdentityFingerprint(identity: PaymasterSubmittedIdentity): string {
  return [
    identity.legalName.trim().toLowerCase(),
    identity.entityType.trim().toLowerCase(),
    identity.registrationCountry.trim().toUpperCase(),
    identity.registrationNumber,
  ].join("|");
}

function asCustomerDetails(value: unknown): {
  name?: unknown;
  ssm_number?: unknown;
  country?: unknown;
  entity_type?: unknown;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as {
    name?: unknown;
    ssm_number?: unknown;
    country?: unknown;
    entity_type?: unknown;
  };
}

function toSubmittedRow(
  source: LinkedApplicationIdentitySource,
  identity: PaymasterSubmittedIdentity
): PaymasterSubmittedApplicationIdentity {
  return {
    applicationId: source.applicationId,
    applicationDisplayReference: source.applicationDisplayReference,
    applicationProductId: source.applicationProductId,
    applicationStatus: source.applicationStatus,
    submittedAt: source.submittedAt,
    issuerOrganizationId: source.issuerOrganizationId,
    issuerName: source.issuerName,
    legalName: identity.legalName,
    registrationNumber: identity.registrationNumber,
    entityType: identity.entityType,
    registrationCountry: identity.registrationCountry,
  };
}

function newerSource(
  current: LinkedApplicationIdentitySource,
  next: LinkedApplicationIdentitySource
): LinkedApplicationIdentitySource {
  return (next.submittedAt ?? "") > (current.submittedAt ?? "") ? next : current;
}

type LinkedContractApplication = {
  id: string;
  display_reference: string | null;
  status: string;
  submitted_at: Date | null;
  financing_type: unknown;
};

export type LinkedPaymasterContract = {
  issuer_organization_id: string;
  customer_details: unknown;
  issuer_organization: { name: string | null };
  originating_application: LinkedContractApplication | null;
  applications: LinkedContractApplication[];
};

function applicationToSource(
  application: LinkedContractApplication,
  contract: LinkedPaymasterContract
): LinkedApplicationIdentitySource {
  return {
    applicationId: application.id,
    applicationDisplayReference: application.display_reference,
    applicationProductId: productIdFromFinancingType(application.financing_type),
    applicationStatus: application.status,
    submittedAt: application.submitted_at?.toISOString() ?? null,
    issuerOrganizationId: contract.issuer_organization_id,
    issuerName: contract.issuer_organization.name,
    customerDetails: contract.customer_details,
  };
}

export function collectLinkedApplicationIdentitySources(
  contracts: LinkedPaymasterContract[]
): LinkedApplicationIdentitySource[] {
  const sources: LinkedApplicationIdentitySource[] = [];
  for (const contract of contracts) {
    const applications = [
      ...(contract.originating_application ? [contract.originating_application] : []),
      ...contract.applications,
    ];
    for (const application of applications) {
      sources.push(applicationToSource(application, contract));
    }
  }
  return sources;
}

/**
 * Admin reference rows for issuer-declared identities on linked applications.
 * Hidden when every submission matches the current master. Identical submissions
 * collapse to one row. Distinct identities are listed even if one matches the master.
 */
export function selectDifferingSubmittedApplicationIdentities(params: {
  master: PaymasterMasterIdentityRow;
  sources: LinkedApplicationIdentitySource[];
}): PaymasterSubmittedApplicationIdentity[] {
  const seenApplications = new Set<string>();
  const groups = new Map<
    string,
    { identity: PaymasterSubmittedIdentity; source: LinkedApplicationIdentitySource }
  >();

  for (const source of params.sources) {
    if (seenApplications.has(source.applicationId)) continue;
    seenApplications.add(source.applicationId);

    const identity = parseSubmittedIdentity(asCustomerDetails(source.customerDetails));
    if (!identity) continue;
    if (identity.registrationNumber !== params.master.registration_number) continue;

    const fingerprint = submittedIdentityFingerprint(identity);
    const existing = groups.get(fingerprint);
    if (!existing) {
      groups.set(fingerprint, { identity, source });
      continue;
    }
    groups.set(fingerprint, {
      identity,
      source: newerSource(existing.source, source),
    });
  }

  const distinct = [...groups.values()];
  if (distinct.length === 0) return [];

  const conflicting = distinct.filter((group) =>
    submittedIdentityConflictsWithMaster(params.master, group.identity)
  );
  if (conflicting.length === 0) return [];

  const selected = distinct.length > 1 ? distinct : conflicting;
  return selected
    .map((group) => toSubmittedRow(group.source, group.identity))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}
