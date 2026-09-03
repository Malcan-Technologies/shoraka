import { snapshotBusinessReference } from "../../../lib/audit/display-references";

const MISSING = "—";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Customer-facing party ID: allocated ISS-/IVT- display_reference only.
 * Never freeze a Prisma/CUID primary key into the certificate.
 */
export function certificatePartyDisplayReference(
  displayReference: string | null | undefined,
  databaseId?: string | null
): string {
  return snapshotBusinessReference(displayReference, databaseId) ?? MISSING;
}

function resolveCodSsm(corporateOnboardingData: unknown): string | null {
  const cod = asRecord(corporateOnboardingData);
  const basic = asRecord(cod?.basicInfo) ?? asRecord(cod?.basic_info);
  return (
    nonEmpty(basic?.ssmRegistrationNumber) ??
    nonEmpty(basic?.ssmRegisterNumber) ??
    nonEmpty(basic?.ssm_registration_number)
  );
}

/**
 * Company No. for the certificate: frozen issuer_snapshot first, then the
 * same org-column + COD SSM aliases used by Letter of Offer (Toyota legacy).
 */
export function resolveCertificateCompanyRegistration(input: {
  issuerSnapshot: Record<string, unknown> | null;
  issuerOrganization: {
    registration_number?: string | null;
    corporate_onboarding_data?: unknown;
  } | null;
}): string {
  return (
    nonEmpty(input.issuerSnapshot?.registration_number) ??
    nonEmpty(input.issuerOrganization?.registration_number) ??
    resolveCodSsm(input.issuerOrganization?.corporate_onboarding_data) ??
    MISSING
  );
}
