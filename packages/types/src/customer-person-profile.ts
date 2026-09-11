/**
 * Customer-facing issuer/investor person Profile projection.
 * Reads OrganizationPartyProfile master fields for Overview and only KYC or KYB
 * identifiers for verification tabs. Does not change CTOS/RegTank workflows.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import {
  SC_DESIGNATION_LABELS,
  SC_GENDER_LABELS,
  SC_IDENTITY_PREFIX_LABELS,
  SC_SHARE_TYPE_LABELS,
  type ScIdentityPrefix,
} from "./comrep-profile";
import { SC_MONTHLY_PERSON_KIND_LABELS } from "./comrep-field-copy";
import { getAmlGroup, getKycGroup } from "./director-shareholder-single-status-display";
import {
  formatPartyRoleLineWithoutShare,
  formatPartySharePercent,
  type OrganizationPartyProfileDto,
} from "./organization-party-profile";
import { displayGovernmentIdentityNumber } from "./organization-party-key";
import { collectPartyRegTankRefreshIds } from "./people-access-refresh";
import {
  formatPeopleAccessCompanyRoleLine,
  peopleAccessCompanyRolesFromParty,
  peopleAccessCompanyRolesFromPerson,
  peopleAccessCorporateKybLabel,
  peopleAccessKycLabel,
} from "./people-access-rows";
import { formatPeopleRolesLineTitleCaseWithoutShare } from "./application-people-display";
import { isPersonKycApproved, personIdentityDisplay } from "./person-onboarding-display";
import { PROFILE_ADDRESS_FIELD_LABELS, PROFILE_LABEL, formatProfileRmAmount } from "./profile-field-copy";
import { adminOnboardingStageLabel } from "./admin-people-access-detail";

export const CUSTOMER_PERSON_LABEL = {
  fullName: PROFILE_LABEL.fullName,
  companyName: PROFILE_LABEL.companyName,
  entityType: "Entity Type",
  salutation: PROFILE_LABEL.salutation,
  identityType: "Identity Type",
  identityNumber: PROFILE_LABEL.identityNumber,
  companyRegistrationNumber: PROFILE_LABEL.companyRegistrationNumber,
  gender: PROFILE_LABEL.gender,
  dateOfBirth: PROFILE_LABEL.dateOfBirth,
  dateOfIncorporation: PROFILE_LABEL.dateOfIncorporation,
  nationality: PROFILE_LABEL.nationality,
  countryOfIncorporation: PROFILE_LABEL.countryOfIncorporation,
  roles: "Roles",
  shareholding: "Shareholding",
  typeOfShares: PROFILE_LABEL.typeOfShares,
  typeOfSharesOther: PROFILE_LABEL.typeOfSharesOther,
  shareholdingUnits: PROFILE_LABEL.shareholdingUnits,
  shareholdingAmount: "Shareholding Amount",
  personEmail: PROFILE_LABEL.personEmail,
  accountEmail: PROFILE_LABEL.accountEmail,
  address: PROFILE_ADDRESS_FIELD_LABELS.address,
  addressLine2: PROFILE_ADDRESS_FIELD_LABELS.addressLine2,
  state: PROFILE_ADDRESS_FIELD_LABELS.state,
  postcode: PROFILE_ADDRESS_FIELD_LABELS.postcode,
  designation: PROFILE_LABEL.designation,
  designationOther: PROFILE_LABEL.designationOther,
  appointmentDate: PROFILE_LABEL.appointmentDate,
  resignationDate: PROFILE_LABEL.resignationDate,
  personKind: "Board / Management",
} as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function isInternalOnboardingRequestId(value: string | null | undefined): boolean {
  const id = String(value ?? "").trim().toUpperCase();
  return /^(KYC|KYB|EOD|COD|LD)\d/.test(id);
}

export function formatCustomerProfileDate(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const iso = raw.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const day = Number(match[3]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11 || day < 1 || day > 31) return iso;
  return `${day} ${MONTHS[month]} ${match[1]}`;
}

export function formatCustomerCountryName(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatCustomerCount(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === "") return "";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return String(value).trim();
  return n.toLocaleString("en-MY", { maximumFractionDigits: 0 });
}

export function customerIdentityType(party: OrganizationPartyProfileDto | null | undefined): string {
  const prefix = party?.identityPrefix;
  if (prefix && prefix in SC_IDENTITY_PREFIX_LABELS) {
    return SC_IDENTITY_PREFIX_LABELS[prefix as ScIdentityPrefix];
  }
  return prefix ?? "";
}

export function customerIdentityNumber(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): string {
  const party = params.party ?? null;
  const person = params.person ?? null;
  const rawIdentity = party ? party.identityNumber : person?.identityNumber;
  const rawKey = party ? party.partyKey : person?.matchKey;
  const identityNumber = rawIdentity && !isInternalOnboardingRequestId(rawIdentity) ? rawIdentity : null;
  const partyKey = rawKey && !isInternalOnboardingRequestId(rawKey) ? rawKey : null;
  const displayed = displayGovernmentIdentityNumber({ identityNumber, partyKey });
  if (displayed && !isInternalOnboardingRequestId(displayed)) return displayed;
  return personIdentityDisplay({
    identityNumber,
    partyKey,
    matchKey: person?.matchKey && !isInternalOnboardingRequestId(person.matchKey) ? person.matchKey : null,
    kycOnboardingStatus: person?.onboarding?.status,
  }).value;
}

export function customerKycId(person: ApplicationPersonRow | null | undefined): string | null {
  if (!person || person.entityType === "CORPORATE") return null;
  return collectPartyRegTankRefreshIds(person).kycId;
}

export function customerKybId(person: ApplicationPersonRow | null | undefined): string | null {
  if (!person || person.entityType !== "CORPORATE") return null;
  return collectPartyRegTankRefreshIds(person).kybId;
}

export function customerPersonEmail(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): string {
  const partyEmail = String(params.party?.email ?? "").trim();
  if (partyEmail) return partyEmail;
  if (params.party) return "";
  return String(params.person?.email ?? "").trim();
}

export function customerAccountEmail(party: OrganizationPartyProfileDto | null | undefined): string {
  return String(party?.linkedUser?.email ?? "").trim();
}

export function customerShareholding(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): string {
  if (params.party) {
    return formatPartySharePercent(params.party.shareholdingPercentage) ?? "";
  }
  return formatPartySharePercent(params.person?.sharePercentage) ?? "";
}

export function customerRoleLine(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): string {
  if (params.party) {
    const fromAccess = formatPeopleAccessCompanyRoleLine(peopleAccessCompanyRolesFromParty(params.party));
    if (fromAccess && fromAccess !== "—") return fromAccess.replace(/, /g, " · ");
    const fromParty = formatPartyRoleLineWithoutShare(params.party);
    return fromParty === "Person" || fromParty === "Company" ? "" : fromParty;
  }
  if (params.person) {
    const fromAccess = formatPeopleAccessCompanyRoleLine(peopleAccessCompanyRolesFromPerson(params.person));
    if (fromAccess && fromAccess !== "—") return fromAccess.replace(/, /g, " · ");
    return formatPeopleRolesLineTitleCaseWithoutShare(params.person).replace(/, /g, " · ");
  }
  return "";
}

export function customerProcessStatusLabel(params: {
  kind: "kyc" | "kyb" | "aml";
  person?: ApplicationPersonRow | null;
}): string {
  const person = params.person ?? null;
  if (params.kind === "aml") {
    const group = getAmlGroup(person?.screening?.status ?? "");
    if (group === "NOT_STARTED") return "Not started";
    if (group === "IN_PROGRESS") return "In progress";
    if (group === "UNDER_REVIEW") return "Pending Review";
    if (group === "APPROVED") return "Approved";
    if (group === "REJECTED") return "Rejected";
    return "In progress";
  }
  if (params.kind === "kyb") {
    const label = peopleAccessCorporateKybLabel(person);
    if (label === "—") {
      const group = getKycGroup(person?.onboarding?.status ?? "");
      return customerKycGroupLabel(group);
    }
    return label === "Pending approval" ? "Pending Review" : label;
  }
  const label = peopleAccessKycLabel(person);
  if (label === "—") return "Not started";
  return label === "Pending approval" ? "Pending Review" : label;
}

function customerKycGroupLabel(group: ReturnType<typeof getKycGroup>): string {
  if (group === "NOT_STARTED") return "Not started";
  if (group === "IN_PROGRESS") return "In progress";
  if (group === "PENDING_REVIEW") return "Pending Review";
  if (group === "APPROVED") return "Approved";
  if (group === "REJECTED") return "Rejected";
  if (group === "EXPIRED") return "Expired";
  return "In progress";
}

export function customerKycCurrentStage(params: {
  person?: ApplicationPersonRow | null;
  statusLabel: string;
}): string | null {
  const raw = params.person?.onboarding?.status;
  if (!raw) return null;
  if (params.statusLabel === "Approved" || params.statusLabel === "Rejected" || params.statusLabel === "Expired") {
    return null;
  }
  const stage = adminOnboardingStageLabel(raw);
  if (!stage || stage === params.statusLabel) return null;
  return stage;
}

export function customerAmlWaitingCopy(params: {
  corporate: boolean;
  person?: ApplicationPersonRow | null;
  amlLabel: string;
}): string | null {
  if (params.corporate) return null;
  const kycApproved = isPersonKycApproved(params.person?.onboarding?.status);
  const amlGroup = getAmlGroup(params.person?.screening?.status ?? "");
  if (!kycApproved && (amlGroup === "NOT_STARTED" || params.amlLabel === "Not started" || params.amlLabel === "—")) {
    return "AML screening will begin after KYC approval.";
  }
  return null;
}

export function customerApprovedAt(person: ApplicationPersonRow | null | undefined): string {
  if (!isPersonKycApproved(person?.onboarding?.status)) return "";
  return formatCustomerProfileDate(person?.onboarding?.updatedAt);
}

export type CustomerProfileField = { label: string; value: string };
export type CustomerProfileSection = {
  id: "details" | "role" | "contact" | "address";
  title: string;
  fields: CustomerProfileField[];
};

function present(value: string | null | undefined): boolean {
  return Boolean(value && String(value).trim() && String(value).trim() !== "—");
}

function field(label: string, value: string | null | undefined): CustomerProfileField | null {
  if (!present(value)) return null;
  return { label, value: String(value).trim() };
}

function push(fields: CustomerProfileField[], item: CustomerProfileField | null): void {
  if (item) fields.push(item);
}

export function buildCustomerPersonOverviewSections(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): CustomerProfileSection[] {
  const party = params.party ?? null;
  const person = params.person ?? null;
  const corporate = (party?.entityType ?? person?.entityType) === "CORPORATE";
  const shareholder = Boolean(party?.isShareholder || person?.roles?.includes("SHAREHOLDER"));
  const officer = Boolean(party?.isDirector || party?.isBoard || party?.isManagement);
  const name = party?.name || person?.name || "";
  const identityType = customerIdentityType(party);
  const identityNumber = customerIdentityNumber({ party, person });
  const identityPending = identityNumber === "Pending onboarding" || identityNumber === "Not available";
  const gender =
    party?.gender && party.gender in SC_GENDER_LABELS
      ? SC_GENDER_LABELS[party.gender]
      : party?.gender ?? "";
  const shareType =
    party?.shareType && party.shareType in SC_SHARE_TYPE_LABELS
      ? SC_SHARE_TYPE_LABELS[party.shareType]
      : party?.shareType ?? "";
  const designation =
    party?.designation && party.designation in SC_DESIGNATION_LABELS
      ? SC_DESIGNATION_LABELS[party.designation]
      : party?.designation ?? "";
  const personKind = [
    party?.isBoard ? SC_MONTHLY_PERSON_KIND_LABELS.BOARD : null,
    party?.isManagement ? SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT : null,
  ]
    .filter(Boolean)
    .join("; ");

  const details: CustomerProfileField[] = [];
  push(details, field(corporate ? CUSTOMER_PERSON_LABEL.companyName : CUSTOMER_PERSON_LABEL.fullName, name));
  push(details, field(CUSTOMER_PERSON_LABEL.entityType, corporate ? "Company" : "Individual"));
  if (!corporate) {
    push(details, field(CUSTOMER_PERSON_LABEL.salutation, party?.salutation));
  }
  if (corporate) {
    push(
      details,
      field(
        CUSTOMER_PERSON_LABEL.companyRegistrationNumber,
        identityPending ? "" : identityNumber
      )
    );
    push(details, field(CUSTOMER_PERSON_LABEL.identityType, identityType));
  } else {
    push(details, field(CUSTOMER_PERSON_LABEL.identityType, identityType));
    push(details, field(CUSTOMER_PERSON_LABEL.identityNumber, identityNumber));
  }
  if (!corporate) {
    push(details, field(CUSTOMER_PERSON_LABEL.gender, gender === "Not Applicable" ? "" : gender));
    push(details, field(CUSTOMER_PERSON_LABEL.dateOfBirth, formatCustomerProfileDate(party?.dateOfBirth)));
    push(details, field(CUSTOMER_PERSON_LABEL.nationality, formatCustomerCountryName(party?.nationality)));
  } else {
    push(
      details,
      field(CUSTOMER_PERSON_LABEL.dateOfIncorporation, formatCustomerProfileDate(party?.dateOfIncorporation))
    );
    push(
      details,
      field(
        CUSTOMER_PERSON_LABEL.countryOfIncorporation,
        formatCustomerCountryName(party?.countryOfIncorporation)
      )
    );
  }

  const role: CustomerProfileField[] = [];
  push(role, field(CUSTOMER_PERSON_LABEL.roles, customerRoleLine({ party, person })));
  if (shareholder) {
    push(role, field(CUSTOMER_PERSON_LABEL.shareholding, customerShareholding({ party, person })));
    push(role, field(CUSTOMER_PERSON_LABEL.typeOfShares, shareType));
    if (party?.shareType === "OTHERS") {
      push(role, field(CUSTOMER_PERSON_LABEL.typeOfSharesOther, party.shareTypeOther));
    }
    push(role, field(CUSTOMER_PERSON_LABEL.shareholdingUnits, formatCustomerCount(party?.shareholdingUnits)));
    const amount = party?.shareholdingAmount;
    if (present(amount)) {
      const formatted = formatProfileRmAmount(amount);
      push(role, field(CUSTOMER_PERSON_LABEL.shareholdingAmount, formatted === "—" ? String(amount) : formatted));
    }
  }
  if (officer && !corporate) {
    push(role, field(CUSTOMER_PERSON_LABEL.personKind, personKind));
    push(role, field(CUSTOMER_PERSON_LABEL.designation, designation));
    if (party?.designation === "OTHERS") {
      push(role, field(CUSTOMER_PERSON_LABEL.designationOther, party.designationOther));
    }
    push(role, field(CUSTOMER_PERSON_LABEL.appointmentDate, formatCustomerProfileDate(party?.appointmentDate)));
    push(role, field(CUSTOMER_PERSON_LABEL.resignationDate, formatCustomerProfileDate(party?.resignationDate)));
  }

  const contact: CustomerProfileField[] = [];
  if (!corporate) {
    push(contact, field(CUSTOMER_PERSON_LABEL.personEmail, customerPersonEmail({ party, person })));
  }

  const address: CustomerProfileField[] = [];
  if (party) {
    push(address, field(CUSTOMER_PERSON_LABEL.address, party.address?.line1));
    push(address, field(CUSTOMER_PERSON_LABEL.addressLine2, party.address?.line2));
    push(address, field(CUSTOMER_PERSON_LABEL.state, party.address?.state));
    push(address, field(CUSTOMER_PERSON_LABEL.postcode, party.address?.postalCode));
  }

  const sections: CustomerProfileSection[] = [];
  if (details.length > 0) {
    sections.push({
      id: "details",
      title: corporate ? "Company Details" : "Personal Details",
      fields: details,
    });
  }
  if (role.length > 0) {
    sections.push({ id: "role", title: "Company Role", fields: role });
  }
  if (contact.length > 0) {
    sections.push({ id: "contact", title: "Contact", fields: contact });
  }
  if (address.length > 0) {
    sections.push({ id: "address", title: "Address", fields: address });
  }
  return sections;
}

export function customerOverviewContainsCtos(sections: CustomerProfileSection[]): boolean {
  const blob = sections
    .flatMap((section) => [section.title, ...section.fields.map((field) => `${field.label} ${field.value}`)])
    .join(" ");
  return /ctos/i.test(blob);
}

export function customerHeaderFacts(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): string {
  return customerRoleLine(params);
}
