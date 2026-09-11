/**
 * Admin People & Access person-detail presentation.
 * Display/projection only — does not change KYC, AML, RegTank, or CTOS workflows.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import {
  getRegtankCorporateOnboardingUrl,
  getRegtankCorporatePersonOnboardingUrl,
  getRegtankLivenessUrl,
  getRegtankScreeningLink,
} from "./application-people-display";
import type { AdminPeopleAccessRow } from "./admin-people-access-rows";
import {
  ORGANIZATION_PARTY_ORIGIN_LABELS,
  SC_IDENTITY_PREFIX_LABELS,
  type OrganizationPartyOrigin,
  type ScIdentityPrefix,
} from "./comrep-profile";
import { PROFILE_LABEL } from "./profile-field-copy";
import { normalizeRawStatus } from "./status-normalization";
import { collectPartyRegTankRefreshIds } from "./people-access-refresh";
import {
  isPersonKycApproved,
  PERSON_KYC_REQUIRED_BEFORE_PROFILE_COMPLETION,
  personIdentityDisplay,
  shouldDeferOnboardingPersonComrep,
} from "./person-onboarding-display";
import { resolvePartyCtosComparison } from "./party-ctos-comparison";
import { displayGovernmentIdentityNumber } from "./organization-party-key";
import {
  peopleAccessAmlLabel,
  peopleAccessCorporateKybLabel,
  peopleAccessKycLabel,
} from "./people-access-rows";
import { getAmlGroup } from "./director-shareholder-single-status-display";

export type AdminPeopleAccessDetailItem = {
  label: string;
  value: string;
};

export type AdminPersonRegTankRoleKind = "director" | "shareholder" | "corporate" | "liveness";

export type AdminPersonRegTankRoleRecord = {
  kind: AdminPersonRegTankRoleKind;
  title: string;
  requestId: string;
  stageLabel: string;
  url: string | null;
  actionLabel: string;
};

function trimId(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isPresent(value: unknown): boolean {
  return value != null && String(value).trim() !== "" && String(value).trim() !== "—";
}

/** Person-level KYC/KYB stage copy. Badge groups stay on peopleAccessKycLabel. */
export function adminOnboardingStageLabel(statusRaw: string | null | undefined): string {
  const s = normalizeRawStatus(statusRaw);
  if (!s) return "Not started";
  switch (s) {
    case "NOT_STARTED":
    case "REQUIRED":
    case "KYC_REQUIRED":
    case "NONE":
    case "IDLE":
      return "Not started";
    case "URL_GENERATED":
    case "EMAIL_SENT":
    case "SENT":
      return "Invitation sent";
    case "FORM_FILLING":
      return "Form in progress";
    case "ID_UPLOADED":
      return "Identity documents submitted";
    case "LIVENESS_STARTED":
      return "Liveness check in progress";
    case "LIVENESS_PASSED":
      return "Liveness check passed";
    case "PROCESSING":
    case "IN_PROGRESS":
    case "PENDING":
      return "In progress";
    case "WAIT_FOR_APPROVAL":
    case "WAITING_FOR_APPROVAL":
    case "PENDING_APPROVAL":
      return "Pending approval";
    case "APPROVED":
    case "AML_APPROVED":
    case "CLEAR":
    case "COMPLETED":
      return "Approved";
    case "REJECTED":
    case "FAILED":
    case "DECLINED":
      return "Rejected";
    case "EXPIRED":
    case "TIMEOUT":
      return "Expired";
    default:
      return "In progress";
  }
}

export function adminPartyRecordSourceLabel(origin: string | null | undefined): string | null {
  const key = String(origin ?? "").trim();
  if (key === "REGTANK_PARTY") return "Created from RegTank onboarding";
  if (key === "CTOS_PARTY") return "Created from CTOS information";
  if (key === "USER_ADDED") return "Added on the company profile";
  if (key && key in ORGANIZATION_PARTY_ORIGIN_LABELS) {
    return ORGANIZATION_PARTY_ORIGIN_LABELS[key as OrganizationPartyOrigin];
  }
  return null;
}

export function adminPartyProfileStatusLabel(row: Pick<AdminPeopleAccessRow, "observed" | "inactive" | "kind">): string {
  if (row.observed) return "Observed from CTOS";
  if (row.inactive) return "Inactive";
  if (row.kind === "people_only") return "Not on current profile";
  if (row.kind === "platform_only") return "Platform access only";
  return "Active profile";
}

export function adminPeopleAccessDetailRoleLine(row: AdminPeopleAccessRow): string | null {
  const roles = row.companyRoleLine && row.companyRoleLine !== "—" ? row.companyRoleLine.replace(/, /g, " · ") : "";
  const shareRaw = row.party?.shareholdingPercentage ?? row.person?.sharePercentage;
  const share = shareRaw == null || String(shareRaw).trim() === "" ? "" : `${String(shareRaw).replace(/%$/, "")}%`;
  if (roles && share && row.companyRoles.includes("Shareholder")) return `${roles} · ${share}`;
  if (roles) return roles;
  if (row.corporate && share) return `Shareholder · ${share}`;
  return roles || null;
}

export function personRegTankKycId(person: ApplicationPersonRow | null | undefined): string | null {
  if (!person) return null;
  return collectPartyRegTankRefreshIds(person).kycId;
}

export function personRegTankKybId(person: ApplicationPersonRow | null | undefined): string | null {
  if (!person) return null;
  return collectPartyRegTankRefreshIds(person).kybId;
}

export function adminPersonKycResultUrl(person: ApplicationPersonRow | null | undefined): string | null {
  const kycId = personRegTankKycId(person);
  if (!kycId || !person) return null;
  return getRegtankScreeningLink({ screeningRequestId: kycId, requestId: kycId, screening: person.screening });
}

export function adminPersonKybResultUrl(person: ApplicationPersonRow | null | undefined): string | null {
  const kybId = personRegTankKybId(person);
  if (!kybId || !person) return null;
  return getRegtankScreeningLink({ screeningRequestId: kybId, requestId: kybId, screening: person.screening });
}

export function roleOnboardingStatusFromCorporateEntities(
  corporateEntities: unknown,
  eodRequestId: string | null | undefined
): string | null {
  const id = trimId(eodRequestId);
  if (!id) return null;
  const root = asRecord(corporateEntities);
  if (!root) return null;
  for (const list of [root.directors, root.shareholders]) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const rec = asRecord(row);
      if (!rec) continue;
      if (trimId(String(rec.eodRequestId ?? "")) !== id) continue;
      const status = trimId(String(rec.status ?? ""));
      return status || null;
    }
  }
  return null;
}

export function buildAdminPersonRegTankRoleRecords(params: {
  person: ApplicationPersonRow | null | undefined;
  corporateEntities?: unknown;
}): AdminPersonRegTankRoleRecord[] {
  const person = params.person;
  if (!person) return [];
  const parentCod = trimId(person.parentCorporateRequestId);
  const directorEod = trimId(person.directorEodRequestId);
  const shareholderEod = trimId(person.shareholderEodRequestId);
  const ownCod = trimId(person.partyCorporateRequestId);
  const personStage = adminOnboardingStageLabel(person.onboarding?.status);
  const records: AdminPersonRegTankRoleRecord[] = [];

  if (person.entityType === "CORPORATE") {
    if (ownCod) {
      records.push({
        kind: "corporate",
        title: "Corporate shareholder",
        requestId: ownCod,
        stageLabel: personStage,
        url: getRegtankCorporateOnboardingUrl(ownCod),
        actionLabel: "View corporate shareholder onboarding",
      });
    }
    return records;
  }

  const pushPerson = (
    kind: "director" | "shareholder",
    title: string,
    eod: string,
    actionLabel: string
  ) => {
    if (!eod) return;
    const roleStatus = roleOnboardingStatusFromCorporateEntities(params.corporateEntities, eod);
    const url = parentCod
      ? getRegtankCorporatePersonOnboardingUrl(parentCod, eod)
      : eod.startsWith("LD")
        ? getRegtankLivenessUrl(eod)
        : null;
    records.push({
      kind,
      title,
      requestId: eod,
      stageLabel: adminOnboardingStageLabel(roleStatus ?? person.onboarding?.status),
      url,
      actionLabel: url ? actionLabel : "Open in RegTank",
    });
  };

  if (directorEod && directorEod === shareholderEod) {
    pushPerson("director", "Director and shareholder", directorEod, "Open in RegTank");
    return records;
  }
  if (directorEod) {
    pushPerson("director", "Director", directorEod, "View Director onboarding");
  }
  if (shareholderEod) {
    const share = person.sharePercentage != null ? ` · ${person.sharePercentage}%` : "";
    pushPerson("shareholder", `Shareholder${share}`, shareholderEod, "View Shareholder onboarding");
  }
  if (records.length === 0) {
    const ld = collectPartyRegTankRefreshIds(person).individualOnboardingRequestId;
    if (ld) {
      records.push({
        kind: "liveness",
        title: "Individual onboarding",
        requestId: ld,
        stageLabel: personStage,
        url: getRegtankLivenessUrl(ld),
        actionLabel: "View onboarding",
      });
    }
  }
  return records;
}

export function adminPersonHasRegTankEvidence(person: ApplicationPersonRow | null | undefined): boolean {
  if (!person) return false;
  if (buildAdminPersonRegTankRoleRecords({ person }).length > 0) return true;
  if (personRegTankKycId(person) || personRegTankKybId(person)) return true;
  if (trimId(person.onboarding?.status)) return true;
  if (trimId(person.icFrontUrl) || trimId(person.icBackUrl)) return true;
  return false;
}

export function adminPersonHasCtosEvidence(row: AdminPeopleAccessRow): boolean {
  if (row.kind === "platform_only" || row.kind === "people_only") return false;
  if (row.observed || row.identityConflict) return true;
  if (row.ctos === "Matched" || row.ctos === "Differs" || row.ctos === "Not found" || row.ctos === "Observed only") {
    return true;
  }
  const party = row.party;
  if (!party) return false;
  if (party.absentFromLatestExternal) return true;
  if ((party.mismatches?.length ?? 0) > 0) return true;
  if (party.externalObservation) return true;
  return resolvePartyCtosComparison(party).state !== "NO_COMPARISON";
}

export function adminPersonCtosAbsenceCopy(row: AdminPeopleAccessRow): string | null {
  if (adminPersonHasCtosEvidence(row)) return null;
  return "No CTOS record has been linked to this person yet.";
}

export function adminAmlWaitingCopy(params: {
  corporate: boolean;
  person: ApplicationPersonRow | null | undefined;
  amlLabel: string;
}): string | null {
  if (params.corporate) {
    if (params.amlLabel === "—" || params.amlLabel === "Not started") {
      return "Business screening has not started yet.";
    }
    return null;
  }
  const kycApproved = isPersonKycApproved(params.person?.onboarding?.status);
  const amlGroup = getAmlGroup(params.person?.screening?.status ?? "");
  if (!kycApproved && (amlGroup === "NOT_STARTED" || params.amlLabel === "Not started" || params.amlLabel === "—")) {
    return "AML review becomes available after KYC approval.";
  }
  if (kycApproved && amlGroup === "NOT_STARTED") {
    return "AML screening has not started yet.";
  }
  return null;
}

export function adminProfileCompletenessHint(params: {
  applyIssuerComrep: boolean;
  row: AdminPeopleAccessRow;
  missingCount: number;
  kycApproved: boolean;
}): string | null {
  if (!params.applyIssuerComrep || params.row.inactive || params.row.observed || !params.row.party) return null;
  const deferred = shouldDeferOnboardingPersonComrep({
    entityType: params.row.party.entityType,
    isDirector: params.row.party.isDirector,
    isShareholder: params.row.party.isShareholder,
    kycOnboardingStatus: params.row.person?.onboarding?.status ?? null,
  });
  if (deferred) return PERSON_KYC_REQUIRED_BEFORE_PROFILE_COMPLETION;
  if (params.kycApproved && params.missingCount > 0) {
    return `${params.missingCount} profile ${params.missingCount === 1 ? "field remains" : "fields remain"} — use Complete profile.`;
  }
  return null;
}

function formatShareholding(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === "") return null;
  const raw = String(value).trim().replace(/%$/, "");
  return `${raw}%`;
}

export function buildAdminPeopleAccessOverviewItems(row: AdminPeopleAccessRow): AdminPeopleAccessDetailItem[] {
  const party = row.party;
  const person = row.person;
  const corporate = row.corporate || party?.entityType === "CORPORATE" || person?.entityType === "CORPORATE";
  const items: AdminPeopleAccessDetailItem[] = [];
  const name = party?.name || person?.name || row.name;
  if (isPresent(name)) {
    items.push({ label: corporate ? PROFILE_LABEL.companyName : PROFILE_LABEL.fullName, value: String(name) });
  }
  items.push({ label: "Entity Type", value: corporate ? "Company" : "Individual" });
  const companyRoles =
    row.companyRoleLine && row.companyRoleLine !== "—"
      ? row.companyRoleLine.replace(/, /g, " · ")
      : "";
  if (companyRoles) items.push({ label: "Company Roles", value: companyRoles });
  const share = formatShareholding(party?.shareholdingPercentage ?? person?.sharePercentage);
  if (share && (corporate || party?.isShareholder || person?.roles?.includes("SHAREHOLDER"))) {
    items.push({ label: "Shareholding", value: share });
  }
  if (!corporate && isPresent(row.personEmail)) {
    items.push({ label: PROFILE_LABEL.personEmail, value: String(row.personEmail) });
  }
  const identityNumber = displayGovernmentIdentityNumber({
    partyKey: party?.partyKey ?? person?.matchKey,
    identityNumber: party?.identityNumber ?? person?.identityNumber,
  });
  const identity = personIdentityDisplay({
    identityNumber: party?.identityNumber ?? person?.identityNumber,
    partyKey: party?.partyKey,
    matchKey: person?.matchKey,
    kycOnboardingStatus: person?.onboarding?.status,
  });
  if (corporate) {
    if (identityNumber) {
      items.push({ label: PROFILE_LABEL.companyRegistrationNumber, value: identityNumber });
    }
  } else if (identityNumber) {
    items.push({ label: PROFILE_LABEL.identityNumber, value: identityNumber });
  } else if (identity.value && identity.pending) {
    items.push({ label: PROFILE_LABEL.identityNumber, value: identity.value });
  }
  const prefix = party?.identityPrefix;
  if (prefix && prefix in SC_IDENTITY_PREFIX_LABELS) {
    items.push({
      label: corporate ? "Identity Type" : "Identity Type",
      value: SC_IDENTITY_PREFIX_LABELS[prefix as ScIdentityPrefix],
    });
  }
  if (!corporate && isPresent(party?.dateOfBirth)) {
    items.push({ label: PROFILE_LABEL.dateOfBirth, value: String(party?.dateOfBirth).slice(0, 10) });
  }
  if (corporate && isPresent(party?.dateOfIncorporation)) {
    items.push({ label: PROFILE_LABEL.dateOfIncorporation, value: String(party?.dateOfIncorporation).slice(0, 10) });
  }
  if (row.kind === "platform_only") {
    items.push({
      label: "Platform Access",
      value: row.platformAccess === "—" ? "No access" : row.platformAccess,
    });
  } else if (corporate) {
    items.push({ label: "Platform Access", value: "Not applicable" });
  } else {
    items.push({
      label: "Platform Access",
      value:
        row.platformAccess === "—" || row.platformAccess === "No access" ? "No access" : row.platformAccess,
    });
  }
  items.push({ label: "Profile Status", value: adminPartyProfileStatusLabel(row) });
  return items;
}

export function adminPeopleAccessVerificationLabel(corporate: boolean): "KYC" | "KYB" {
  return corporate ? "KYB" : "KYC";
}

export function adminPeopleAccessKycOrKybLabel(row: AdminPeopleAccessRow): string {
  if (row.corporate) return peopleAccessCorporateKybLabel(row.person);
  return peopleAccessKycLabel(row.person);
}

export function adminPeopleAccessAmlDisplayLabel(row: AdminPeopleAccessRow): string {
  if (row.corporate) {
    const status = row.person?.screening?.status;
    if (!status || !String(status).trim()) return "Not started";
  }
  const label = row.aml;
  if (label === "—") return row.corporate ? "Not started" : peopleAccessAmlLabel(row.person);
  return label;
}

export function isCustomerRegTankVerifyUrl(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim().toLowerCase();
  if (!value) return false;
  return value.includes("-onboarding.") || value.includes("onboarding-proxy") || value.includes("/Onboarding");
}
