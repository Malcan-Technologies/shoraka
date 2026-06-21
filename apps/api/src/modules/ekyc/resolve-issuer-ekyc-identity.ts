import { OrganizationType } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { extractGovernmentIdFromCorporateUserInfo } from "../regtank/helpers/extract-government-id";

const MALAYSIAN_IC_DIGITS = 12;

const EKYC_IDENTITY_NOT_ON_FILE_MESSAGE =
  "We don't have your verified MyKad details on file. Complete identity onboarding before signing.";

type IssuerOrgIdentitySource = {
  id: string;
  type: OrganizationType;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  document_number: string | null;
  corporate_entities: unknown;
};

export function normalizeMalaysianIcNumber(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.length === MALAYSIAN_IC_DIGITS ? digitsOnly : null;
}

export function normalizeEkycLegalName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim().replace(/\s+/g, " ").toUpperCase();
  return name.length > 0 ? name : null;
}

function buildPersonalOrgName(org: IssuerOrgIdentitySource): string | null {
  const parts = [org.first_name, org.middle_name, org.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  if (parts.length === 0) {
    return null;
  }

  return normalizeEkycLegalName(parts.join(" "));
}

function resolveCorporatePersonalName(personalInfo: Record<string, unknown>): string | null {
  const fullName = normalizeEkycLegalName(personalInfo.fullName);
  if (fullName) {
    return fullName;
  }

  const parts = [personalInfo.firstName, personalInfo.middleName, personalInfo.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());

  if (parts.length === 0) {
    return null;
  }

  return normalizeEkycLegalName(parts.join(" "));
}

function resolveCorporatePersonalIc(personalInfo: Record<string, unknown>): string | null {
  const fromField =
    typeof personalInfo.governmentIdNumber === "string"
      ? personalInfo.governmentIdNumber
      : extractGovernmentIdFromCorporateUserInfo(personalInfo);

  return normalizeMalaysianIcNumber(fromField);
}

function emailsMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function resolveFromCorporateEntities(
  corporateEntities: unknown,
  email: string
): { name: string; icNumber: string } | null {
  if (!corporateEntities || typeof corporateEntities !== "object" || Array.isArray(corporateEntities)) {
    return null;
  }

  const record = corporateEntities as Record<string, unknown>;
  const groups = [
    Array.isArray(record.directors) ? record.directors : [],
    Array.isArray(record.shareholders) ? record.shareholders : [],
  ];

  for (const group of groups) {
    for (const entry of group) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const personalInfo = (entry as Record<string, unknown>).personalInfo;
      if (!personalInfo || typeof personalInfo !== "object") {
        continue;
      }

      const personalRecord = personalInfo as Record<string, unknown>;
      const entryEmail = personalRecord.email;
      if (typeof entryEmail !== "string" || !emailsMatch(entryEmail, email)) {
        continue;
      }

      const name = resolveCorporatePersonalName(personalRecord);
      const icNumber = resolveCorporatePersonalIc(personalRecord);
      if (name && icNumber) {
        return { name, icNumber };
      }
    }
  }

  return null;
}

function resolveFromIssuerOrganization(
  org: IssuerOrgIdentitySource,
  email: string
): { name: string; icNumber: string } | null {
  if (org.type === OrganizationType.PERSONAL) {
    const name = buildPersonalOrgName(org);
    const icNumber = normalizeMalaysianIcNumber(org.document_number);
    return name && icNumber ? { name, icNumber } : null;
  }

  return resolveFromCorporateEntities(org.corporate_entities, email);
}

const issuerOrgIdentitySelect = {
  id: true,
  type: true,
  owner_user_id: true,
  first_name: true,
  last_name: true,
  middle_name: true,
  document_number: true,
  corporate_entities: true,
} as const;

async function loadIssuerOrganizationForUser(
  userId: string,
  issuerOrganizationId: string
): Promise<IssuerOrgIdentitySource> {
  const organization = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: {
      ...issuerOrgIdentitySelect,
      members: {
        where: { user_id: userId },
        select: { id: true },
      },
    },
  });

  if (!organization) {
    throw new AppError(404, "NOT_FOUND", "Issuer organization not found");
  }

  const isOwner = organization.owner_user_id === userId;
  const isMember = organization.members.length > 0;
  if (!isOwner && !isMember) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
  }

  return {
    id: organization.id,
    type: organization.type,
    first_name: organization.first_name,
    last_name: organization.last_name,
    middle_name: organization.middle_name,
    document_number: organization.document_number,
    corporate_entities: organization.corporate_entities,
  };
}

async function loadIssuerOrganizationsForUser(userId: string): Promise<IssuerOrgIdentitySource[]> {
  const ownedOrganizations = await prisma.issuerOrganization.findMany({
    where: { owner_user_id: userId },
    select: {
      id: true,
      type: true,
      first_name: true,
      last_name: true,
      middle_name: true,
      document_number: true,
      corporate_entities: true,
    },
    orderBy: { updated_at: "desc" },
  });

  const memberOrganizations = await prisma.organizationMember.findMany({
    where: {
      user_id: userId,
      issuer_organization_id: { not: null },
    },
    select: {
      issuer_organization: {
        select: {
          id: true,
          type: true,
          first_name: true,
          last_name: true,
          middle_name: true,
          document_number: true,
          corporate_entities: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const organizations: IssuerOrgIdentitySource[] = [];
  const seen = new Set<string>();

  for (const org of ownedOrganizations) {
    if (seen.has(org.id)) {
      continue;
    }
    seen.add(org.id);
    organizations.push(org);
  }

  for (const membership of memberOrganizations) {
    const org = membership.issuer_organization;
    if (!org || seen.has(org.id)) {
      continue;
    }
    seen.add(org.id);
    organizations.push(org);
  }

  return organizations;
}

/** Fail early when the active org does not have verified MyKad details for this user. */
export async function resolveIssuerEkycIdentityForOrganization(
  userId: string,
  issuerOrganizationId: string,
  email: string
): Promise<{ name: string; icNumber: string }> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
  }

  const organization = await loadIssuerOrganizationForUser(userId, issuerOrganizationId);
  const resolved = resolveFromIssuerOrganization(organization, normalizedEmail);
  if (resolved) {
    return resolved;
  }

  throw new AppError(400, "EKYC_IDENTITY_NOT_ON_FILE", EKYC_IDENTITY_NOT_ON_FILE_MESSAGE);
}

/** Resolve MyKad details from any issuer org the user belongs to. Not used on the eKYC complete path. */
export async function resolveIssuerEkycIdentityForUser(
  userId: string,
  email: string
): Promise<{ name: string; icNumber: string }> {
  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    throw new AppError(400, "INVALID_STATE", "Your account must have an email address to verify identity");
  }

  const organizations = await loadIssuerOrganizationsForUser(userId);
  for (const organization of organizations) {
    const resolved = resolveFromIssuerOrganization(organization, normalizedEmail);
    if (resolved) {
      return resolved;
    }
  }

  throw new AppError(400, "EKYC_IDENTITY_NOT_ON_FILE", EKYC_IDENTITY_NOT_ON_FILE_MESSAGE);
}
