/**
 * SECTION: Build frozen notes.issuer_snapshot at Note create
 * WHY: Page 2 About the Issuer must not read live org/Application at render
 */

import { Prisma } from "@prisma/client";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmptyTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveIssuerIndustryFromCorporateData(
  data: Prisma.JsonValue | null | undefined
): string | null {
  const corporateData = asRecord(data);
  const basicInfo = asRecord(corporateData?.basicInfo);
  return nonEmptyTrimmed(basicInfo?.industry);
}

export function resolveBusinessDescriptionFromBusinessDetails(
  businessDetails: Prisma.JsonValue | null | undefined
): string | null {
  const details = asRecord(businessDetails);
  const about = asRecord(details?.about_your_business);
  return nonEmptyTrimmed(about?.what_does_company_do);
}

export interface NoteIssuerSnapshotOrganizationInput {
  id: string;
  name: string | null;
  type: string;
  registration_number?: string | null;
  country?: string | null;
  corporate_onboarding_data: Prisma.JsonValue | null;
}

export interface NoteIssuerSnapshot {
  id: string;
  name: string | null;
  type: string;
  industry: string | null;
  registration_number: string | null;
  country: string | null;
  business_description: string | null;
}

/**
 * Freeze issuer identity for prospectus Page 2 Stage 1.
 * Preserves existing id/name/type/industry; adds registration_number, country, business_description.
 */
export function buildNoteIssuerSnapshot(input: {
  organization: NoteIssuerSnapshotOrganizationInput;
  businessDetails: Prisma.JsonValue | null | undefined;
}): NoteIssuerSnapshot {
  const org = input.organization;
  return {
    id: org.id,
    name: org.name,
    type: org.type,
    industry: resolveIssuerIndustryFromCorporateData(org.corporate_onboarding_data),
    registration_number: nonEmptyTrimmed(org.registration_number),
    country: nonEmptyTrimmed(org.country),
    business_description: resolveBusinessDescriptionFromBusinessDetails(input.businessDetails),
  };
}
