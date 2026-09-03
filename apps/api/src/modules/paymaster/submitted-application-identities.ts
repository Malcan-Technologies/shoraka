/**
 * Admin Paymaster Detail: derive linked applications and submitted identities
 * from Paymaster-linked contracts. Same SSM still maps to one master.
 * Invoice-only applications are included via their holder contract.
 */

import type {
  PaymasterLinkedApplicationRow,
  PaymasterSubmittedApplicationIdentity,
} from "@cashsouk/types";
import { parseSubmittedIdentity, type PaymasterSubmittedIdentity } from "./identity";

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
  updatedAt: string | null;
  issuerOrganizationId: string;
  issuerName: string | null;
  financingStructure: unknown;
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

/** Same Facility / Invoice labels as the Admin applications list. */
export function paymasterApplicationProductType(
  financingStructure: unknown,
  hasContract: boolean
): string {
  const structure =
    financingStructure && typeof financingStructure === "object" && !Array.isArray(financingStructure)
      ? (financingStructure as { structure_type?: unknown }).structure_type
      : null;
  if (structure === "invoice_only") return "Invoice financing";
  if (structure === "existing_contract" || structure === "new_contract") {
    return "Facility financing";
  }
  return hasContract ? "Facility financing" : "Invoice financing";
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

export type LinkedContractApplication = {
  id: string;
  display_reference: string | null;
  status: string;
  submitted_at: Date | null;
  updated_at: Date;
  financing_type: unknown;
  financing_structure: unknown;
};

export type LinkedPaymasterContract = {
  issuer_organization_id: string;
  customer_details: unknown;
  issuer_organization: { name: string | null };
  originating_application: LinkedContractApplication | null;
  applications: LinkedContractApplication[];
};

function applicationsOnContract(contract: LinkedPaymasterContract): LinkedContractApplication[] {
  return [
    ...(contract.originating_application ? [contract.originating_application] : []),
    ...contract.applications,
  ];
}

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
    updatedAt: application.updated_at.toISOString(),
    issuerOrganizationId: contract.issuer_organization_id,
    issuerName: contract.issuer_organization.name,
    financingStructure: application.financing_structure,
    customerDetails: contract.customer_details,
  };
}

export function collectLinkedApplicationIdentitySources(
  contracts: LinkedPaymasterContract[]
): LinkedApplicationIdentitySource[] {
  const sources: LinkedApplicationIdentitySource[] = [];
  for (const contract of contracts) {
    for (const application of applicationsOnContract(contract)) {
      sources.push(applicationToSource(application, contract));
    }
  }
  return sources;
}

/**
 * Unique issuer applications linked to this Paymaster via facility or
 * invoice-only holder contracts. Dedupes duplicate contract joins only.
 */
export function collectLinkedPaymasterApplications(
  contracts: LinkedPaymasterContract[]
): PaymasterLinkedApplicationRow[] {
  const byId = new Map<string, PaymasterLinkedApplicationRow>();
  for (const source of collectLinkedApplicationIdentitySources(contracts)) {
    const existing = byId.get(source.applicationId);
    if (existing && (existing.updatedAt ?? "") >= (source.updatedAt ?? "")) continue;
    byId.set(source.applicationId, {
      id: source.applicationId,
      reference: source.applicationDisplayReference,
      issuerOrganizationId: source.issuerOrganizationId,
      issuerName: source.issuerName,
      productType: paymasterApplicationProductType(source.financingStructure, true),
      status: source.applicationStatus,
      updatedAt: source.updatedAt,
      productId: source.applicationProductId,
    });
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/**
 * Admin reference rows for what each linked application declared.
 * One row per application. Matching the master is still listed.
 */
export function selectSubmittedApplicationIdentities(params: {
  master: PaymasterMasterIdentityRow;
  sources: LinkedApplicationIdentitySource[];
}): PaymasterSubmittedApplicationIdentity[] {
  const seenApplications = new Set<string>();
  const rows: PaymasterSubmittedApplicationIdentity[] = [];

  for (const source of params.sources) {
    if (seenApplications.has(source.applicationId)) continue;
    seenApplications.add(source.applicationId);

    const identity = parseSubmittedIdentity(asCustomerDetails(source.customerDetails));
    if (!identity) continue;
    if (identity.registrationNumber !== params.master.registration_number) continue;

    rows.push(toSubmittedRow(source, identity));
  }

  return rows.sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}
