import type {
  OrganizationPartyEntityType,
  OrganizationPartyMembershipStatus,
  OrganizationPartyOrigin,
  ProfileAddress,
  ProfileFieldSources,
  ProfileValueSource,
  ScDesignation,
  ScGender,
  ScIdentityPrefix,
  ScShareType,
} from "./comrep-profile";

export interface OrganizationPartyProfileDto {
  id: string;
  partyKey: string;
  origin: OrganizationPartyOrigin;
  membershipStatus: OrganizationPartyMembershipStatus;
  entityType: OrganizationPartyEntityType;
  absentFromLatestExternal: boolean;
  name: string | null;
  /** Person Email master. Not User.email and not an identity key. */
  email: string | null;
  salutation: string | null;
  identityPrefix: ScIdentityPrefix | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  dateOfIncorporation: string | null;
  gender: ScGender | null;
  nationality: string | null;
  countryOfIncorporation: string | null;
  address: ProfileAddress | null;
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  isManagement: boolean;
  shareType: ScShareType | null;
  shareTypeOther: string | null;
  shareholdingUnits: string | null;
  shareholdingAmount: string | null;
  shareholdingPercentage: string | null;
  designation: ScDesignation | null;
  designationOther: string | null;
  appointmentDate: string | null;
  resignationDate: string | null;
  fieldSources: ProfileFieldSources;
  externalObservation: Record<string, unknown> | null;
  mismatches: OrganizationPartyFieldMismatch[];
  createdAt: string;
  updatedAt: string;
  /**
   * OPTIONAL platform User for this company/regulatory person.
   * Never infer from email; only set via an explicit Person-scoped invitation.
   */
  userId: string | null;
  linkedUser: OrganizationPartyLinkedUser | null;
  platformAccess: import("./person-platform-access").PersonPlatformAccess;
}

export interface OrganizationPartyLinkedUser {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface OrganizationPartyFieldMismatch {
  field: string;
  masterValue: unknown;
  externalValue: unknown;
  source: ProfileValueSource | null;
}

export type PartyMismatchResolution = "KEEP" | "USE_EXTERNAL" | "EDIT";

export interface PartyMismatchResolveInput {
  action: PartyMismatchResolution;
  field: string;
  value?: unknown;
}

export interface OrganizationMasterProfileDto {
  dateOfIncorporation: string | null;
  dateOfCommencement: string | null;
  countryOfIncorporation: string | null;
  scCompanyType: import("./comrep-profile").ScCompanyType | null;
  companyCategory: import("./comrep-profile").ScCompanyCategory | null;
  scInvestorCategory: import("./comrep-profile").ScInvestorCategory | null;
  residentialAddress: ProfileAddress | null;
  fieldSources: ProfileFieldSources;
}

export function emptyPartyPlatformFields(): Pick<
  OrganizationPartyProfileDto,
  "userId" | "linkedUser" | "platformAccess"
> {
  return {
    userId: null,
    linkedUser: null,
    platformAccess: {
      status: "NOT_INVITED",
      label: "Not invited",
      memberRole: null,
      invitationId: null,
      invitationExpiresAt: null,
    },
  };
}

export function formatPartySharePercent(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/%/g, "").trim());
  if (!Number.isFinite(n)) return `${value}`.trim();
  const label = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${label}%`;
}

export function partyRoleLabels(party: {
  isDirector: boolean;
  isBoard: boolean;
  isManagement: boolean;
  isShareholder: boolean;
  shareholdingPercentage?: string | null;
  entityType?: OrganizationPartyEntityType;
}): string[] {
  const parts: string[] = [];
  if (party.isDirector) parts.push("Director");
  if (party.isBoard) parts.push("Board");
  if (party.isManagement) parts.push("Management");
  if (party.isShareholder) {
    const pct = formatPartySharePercent(party.shareholdingPercentage);
    parts.push(pct ? `Shareholder ${pct}` : "Shareholder");
  }
  return parts;
}

/** Role labels without ownership % — use when Shareholding is a separate field. */
export function partyRoleLabelsWithoutShare(party: {
  isDirector: boolean;
  isBoard: boolean;
  isManagement: boolean;
  isShareholder: boolean;
  entityType?: OrganizationPartyEntityType;
}): string[] {
  const parts: string[] = [];
  if (party.isDirector) parts.push("Director");
  if (party.isBoard) parts.push("Board");
  if (party.isManagement) parts.push("Management");
  if (party.isShareholder) parts.push("Shareholder");
  return parts;
}

export function formatPartyRoleLine(party: OrganizationPartyProfileDto): string {
  return partyRoleLabels(party).join(" · ") || (party.entityType === "CORPORATE" ? "Company" : "Person");
}

export function formatPartyRoleLineWithoutShare(party: OrganizationPartyProfileDto): string {
  return (
    partyRoleLabelsWithoutShare(party).join(" · ") ||
    (party.entityType === "CORPORATE" ? "Company" : "Person")
  );
}
