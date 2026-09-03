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
  companyEmail: string | null;
  scInvestorCategory: import("./comrep-profile").ScInvestorCategory | null;
  residentialAddress: ProfileAddress | null;
  fieldSources: ProfileFieldSources;
}

export function formatPartySharePercent(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/%/g, "").trim());
  if (!Number.isFinite(n)) return `${value}`.trim();
  const label = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${label}%`;
}

export function formatPartyRoleLine(party: OrganizationPartyProfileDto): string {
  const parts: string[] = [];
  if (party.isDirector) parts.push("Director");
  if (party.isBoard) parts.push("Board");
  if (party.isManagement) parts.push("Management");
  if (party.isShareholder) {
    const pct = formatPartySharePercent(party.shareholdingPercentage);
    parts.push(pct ? `Shareholder ${pct}` : "Shareholder");
  }
  return parts.join(" · ") || (party.entityType === "CORPORATE" ? "Company" : "Person");
}
