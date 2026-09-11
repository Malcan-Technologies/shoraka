import { normalizeProfilePhone } from "./profile-phone";
import { shouldDeferOnboardingPersonComrep } from "./person-onboarding-display";
import { FINANCIAL_FIELD_LABELS } from "./financial-field-labels";
import {
  PROFILE_ADDRESS_FIELD_LABELS,
  PROFILE_LABEL,
  profileAddressCompletenessLabel,
} from "./profile-field-copy";

/**
 * SC ComRep enumerations and CashSouk master-profile completeness.
 * Annual RMO Information Report tables are [01000]–[11000]; issuer/investor
 * profile completeness uses monthly P2P [02000], [05000], [06000], [07000], [09000], [09100].
 *
 * Issuer [02000] "Issuer ID (if any)" and [02000] Company Activities are not
 * completeness blockers: the former is explicitly "if any"; the latter is stored
 * as the issuer's general/current activity on Issuer Profile. Campaign-specific
 * ComRep interpretation of Company Activities remains
 * Needs business/compliance confirmation.
 *
 * [02000] Company category and [03000] Sustainability Category of the Campaign
 * are invoice/campaign fields, not issuer-profile completeness.
 */

export const SC_COMPANY_CATEGORIES = ["TECHNOLOGY", "NON_TECHNOLOGY"] as const;
export type ScCompanyCategory = (typeof SC_COMPANY_CATEGORIES)[number];

/** ComRep [03000] Sustainability Category of the Campaign (UN SDG). */
export const SC_SUSTAINABILITY_CATEGORIES = [
  "NONE",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
  "G10",
  "G11",
  "G12",
  "G13",
  "G14",
  "G15",
  "G16",
  "G17",
] as const;
export type ScSustainabilityCategory = (typeof SC_SUSTAINABILITY_CATEGORIES)[number];

export const SC_COMPANY_TYPES = [
  "SOLE_PROPRIETORSHIP",
  "PARTNERSHIP",
  "LLP",
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "FOREIGN",
] as const;
export type ScCompanyType = (typeof SC_COMPANY_TYPES)[number];

export const SC_SHARE_TYPES = ["ORDINARY", "PREFERENCE", "OTHERS"] as const;
export type ScShareType = (typeof SC_SHARE_TYPES)[number];

export const SC_IDENTITY_PREFIXES = ["NRIC", "PASSPORT", "ROC"] as const;
export type ScIdentityPrefix = (typeof SC_IDENTITY_PREFIXES)[number];

export const SC_GENDERS = ["MALE", "FEMALE", "NOT_APPLICABLE"] as const;
export type ScGender = (typeof SC_GENDERS)[number];

export const SC_PERSON_KINDS = ["BOARD", "MANAGEMENT"] as const;
export type ScPersonKind = (typeof SC_PERSON_KINDS)[number];

export const SC_DESIGNATIONS = [
  "CHIEF_EXECUTIVE_OFFICER",
  "CHIEF_COMPLIANCE_OFFICER",
  "CHIEF_FINANCIAL_OFFICER",
  "SECRETARY",
  "CHAIRMAN_EXECUTIVE",
  "CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT",
  "CHAIRMAN_NON_EXECUTIVE_INDEPENDENT",
  "DEPUTY_CHAIRMAN_EXECUTIVE",
  "DEPUTY_CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT",
  "DEPUTY_CHAIRMAN_NON_EXECUTIVE_INDEPENDENT",
  "DIRECTOR_EXECUTIVE",
  "DIRECTOR_NON_EXECUTIVE_NON_INDEPENDENT",
  "DIRECTOR_NON_EXECUTIVE_INDEPENDENT",
  "ALTERNATE_DIRECTOR",
  "OTHERS",
] as const;
export type ScDesignation = (typeof SC_DESIGNATIONS)[number];

export const SC_INVESTOR_CATEGORIES = [
  "ANGEL",
  "RETAIL",
  "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL",
  "SOPHISTICATED_ACCREDITED",
  "SOPHISTICATED_HIGH_NET_WORTH_ENTITY",
  "NON_SOPHISTICATED_ENTITY",
] as const;
export type ScInvestorCategory = (typeof SC_INVESTOR_CATEGORIES)[number];

export const PROFILE_VALUE_SOURCES = ["CTOS", "REGTANK", "USER", "ADMIN", "SYSTEM"] as const;
export type ProfileValueSource = (typeof PROFILE_VALUE_SOURCES)[number];

export const ORGANIZATION_PARTY_ORIGINS = [
  "CTOS_PARTY",
  "REGTANK_PARTY",
  "USER_ADDED",
] as const;
export type OrganizationPartyOrigin = (typeof ORGANIZATION_PARTY_ORIGINS)[number];

export const ORGANIZATION_PARTY_ORIGIN_LABELS: Record<OrganizationPartyOrigin, string> = {
  CTOS_PARTY: "CTOS",
  REGTANK_PARTY: "RegTank",
  USER_ADDED: "Issuer/User",
};

export const ORGANIZATION_PARTY_ENTITY_TYPES = ["INDIVIDUAL", "CORPORATE"] as const;
export type OrganizationPartyEntityType = (typeof ORGANIZATION_PARTY_ENTITY_TYPES)[number];

export const ORGANIZATION_PARTY_MEMBERSHIP_STATUSES = [
  "MASTER_ACTIVE",
  "MASTER_INACTIVE",
  "EXTERNAL_OBSERVED",
] as const;
export type OrganizationPartyMembershipStatus =
  (typeof ORGANIZATION_PARTY_MEMBERSHIP_STATUSES)[number];

export const OPERATOR_ADVISOR_TYPES = [
  "ACCOUNTING",
  "AUDITOR",
  "BANKER",
  "COMPLIANCE_AND_RISK",
  "CREDIT_RATING",
  "LEGAL",
  "TAXATION",
  "TRUSTEE_ESCROW",
] as const;
export type OperatorAdvisorType = (typeof OPERATOR_ADVISOR_TYPES)[number];

/** Annual RMO [03000] holder role, distinct from Individual vs Corporate entity_type. */
export const OPERATOR_HOLDER_TYPES = ["SHAREHOLDER", "MEMBER", "BENEFICIAL_OWNER"] as const;
export type OperatorHolderType = (typeof OPERATOR_HOLDER_TYPES)[number];

export const SC_MALAYSIAN_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Outside Malaysia",
] as const;
export type ScMalaysianState = (typeof SC_MALAYSIAN_STATES)[number];

export const SC_COMPANY_CATEGORY_LABELS: Record<ScCompanyCategory, string> = {
  TECHNOLOGY: "Technology",
  NON_TECHNOLOGY: "Non-Technology",
};

export const SC_SUSTAINABILITY_CATEGORY_LABELS: Record<ScSustainabilityCategory, string> = {
  NONE: "00 – None",
  G1: "G1 – No Poverty",
  G2: "G2 – Zero Hunger",
  G3: "G3 – Good Health and Well-being",
  G4: "G4 – Quality education",
  G5: "G5 – Gender Equality",
  G6: "G6 – Clean water",
  G7: "G7 – Affordable and Clean Energy",
  G8: "G8 – Decent Work and Economic Growth",
  G9: "G9 – Industry, Innovation and Infrastructure",
  G10: "G10 – Reduced Inequalities",
  G11: "G11 – Sustainable Cities and Communities",
  G12: "G12 – Responsible Consumption and Production",
  G13: "G13 – Climate Action",
  G14: "G14 – Life Below Water",
  G15: "G15 – Life on Land",
  G16: "G16 – Peace, Justice and Strong Institutions",
  G17: "G17 – Partnerships for the Goals",
};

export function isScCompanyCategory(value: unknown): value is ScCompanyCategory {
  return typeof value === "string" && (SC_COMPANY_CATEGORIES as readonly string[]).includes(value);
}

export function isScSustainabilityCategory(value: unknown): value is ScSustainabilityCategory {
  return (
    typeof value === "string" && (SC_SUSTAINABILITY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function parseInvoiceOfferCompanyCategory(offer: unknown): ScCompanyCategory | null {
  if (!offer || typeof offer !== "object") return null;
  const raw = (offer as Record<string, unknown>).company_category;
  return isScCompanyCategory(raw) ? raw : null;
}

export function parseInvoiceOfferSustainabilityCategory(
  offer: unknown
): ScSustainabilityCategory | null {
  if (!offer || typeof offer !== "object") return null;
  const raw = (offer as Record<string, unknown>).sustainability_category;
  return isScSustainabilityCategory(raw) ? raw : null;
}

/**
 * Authoritative Company category for an invoice/campaign.
 * Offer freeze wins after send (copied from issuer-submitted invoice.details); otherwise invoice.details.
 * Never read IssuerOrganization.company_category.
 */
export function resolveInvoiceCompanyCategory(invoice: {
  details?: unknown;
  offer_details?: unknown;
}): ScCompanyCategory | null {
  return (
    parseInvoiceOfferCompanyCategory(invoice.offer_details) ??
    parseInvoiceOfferCompanyCategory(invoice.details)
  );
}

/**
 * Authoritative Sustainability Category of the Campaign for an invoice/campaign.
 * Offer freeze wins after send (copied from issuer-submitted invoice.details); otherwise invoice.details.
 * Do not default to 00 – None.
 */
export function resolveInvoiceSustainabilityCategory(invoice: {
  details?: unknown;
  offer_details?: unknown;
}): ScSustainabilityCategory | null {
  return (
    parseInvoiceOfferSustainabilityCategory(invoice.offer_details) ??
    parseInvoiceOfferSustainabilityCategory(invoice.details)
  );
}

/** ComRep [07000] Investment by Related Party — per investment, not investor profile. */
export const SC_INVESTMENT_RELATED_PARTIES = [
  "SHAREHOLDER_OF_RMO",
  "RELATED_CO_OF_RMO",
  "OFFICER_OF_RMO",
  "NOT_APPLICABLE",
] as const;
export type ScInvestmentRelatedParty = (typeof SC_INVESTMENT_RELATED_PARTIES)[number];

export const SC_INVESTMENT_RELATED_PARTY_LABELS: Record<ScInvestmentRelatedParty, string> = {
  SHAREHOLDER_OF_RMO: "Shareholder of the RMO",
  RELATED_CO_OF_RMO: "Related co of the RMO",
  OFFICER_OF_RMO: "Officer of the RMO",
  NOT_APPLICABLE: "Not applicable",
};

/**
 * SC Campaign Sector (SME Corp closed list). Invoice/campaign field, not issuer Industry.
 * Labels match the ComRep RMO-P2P manual. Do not auto-map from CashSouk industry taxonomy.
 */
export const SC_CAMPAIGN_SECTORS = [
  "AGRICULTURE_FORESTRY_FISHING",
  "MINING_QUARRYING",
  "MANUFACTURING",
  "ELECTRICITY_GAS_AIR_CONDITIONING",
  "CONSTRUCTIONS",
  "WATER_SEWERAGE_WASTE",
  "WHOLESALE_RETAIL_TRADE",
  "TRANSPORTATION_STORAGE",
  "INFORMATION_COMMUNICATION",
  "ACCOMMODATION_FOOD",
  "FINANCIAL_INSURANCE_TAKAFUL",
  "REAL_ESTATE",
  "PROFESSIONAL_SCIENTIFIC_TECHNICAL",
  "ADMINISTRATIVE_SUPPORT",
  "EDUCATION",
  "PUBLIC_ADMINISTRATION_DEFENCE",
  "ARTS_ENTERTAINMENT_RECREATION",
  "HUMAN_HEALTH_SOCIAL_WORK",
  "HOUSEHOLDS_AS_EMPLOYERS",
  "EXTRATERRITORIAL",
  "OTHER_SERVICE_ACTIVITIES",
] as const;
export type ScCampaignSector = (typeof SC_CAMPAIGN_SECTORS)[number];

export const SC_CAMPAIGN_SECTOR_LABELS: Record<ScCampaignSector, string> = {
  AGRICULTURE_FORESTRY_FISHING: "Agriculture, Forestry and Fishing.",
  MINING_QUARRYING: "Mining and Quarrying.",
  MANUFACTURING: "Manufacturing.",
  ELECTRICITY_GAS_AIR_CONDITIONING: "Electricity, Gas and Air Conditioning Supply.",
  CONSTRUCTIONS: "Constructions.",
  WATER_SEWERAGE_WASTE:
    "Water Supply, Sewerage, Waste Management, and Remedies Activities.",
  WHOLESALE_RETAIL_TRADE:
    "Wholesale and Retail Trade; Repair of Motor Vehicles and Motorcycles.",
  TRANSPORTATION_STORAGE: "Transportation and Storage.",
  INFORMATION_COMMUNICATION: "Information and Communication.",
  ACCOMMODATION_FOOD: "Accommodation and Food Services Activities.",
  FINANCIAL_INSURANCE_TAKAFUL: "Financial and Insurance/Takaful Activities.",
  REAL_ESTATE: "Real-Estate Activities",
  PROFESSIONAL_SCIENTIFIC_TECHNICAL: "Professional, Scientific and Technical Activities.",
  ADMINISTRATIVE_SUPPORT: "Administrative and Support Service Activities.",
  EDUCATION: "Education.",
  PUBLIC_ADMINISTRATION_DEFENCE:
    "Public Administration and Defence; Compulsory Social Security.",
  ARTS_ENTERTAINMENT_RECREATION: "Arts, Entertainment and Recreation.",
  HUMAN_HEALTH_SOCIAL_WORK: "Human Health and Social Work Activities.",
  HOUSEHOLDS_AS_EMPLOYERS:
    "Activities of Households as Employers; Undifferentiated Goods And Services Producing Activities of Households for Own Use.",
  EXTRATERRITORIAL: "Activities of Extraterritorial Organisations and Bodies.",
  OTHER_SERVICE_ACTIVITIES: "Other Service Activities.",
};

export function isScCampaignSector(value: unknown): value is ScCampaignSector {
  return typeof value === "string" && (SC_CAMPAIGN_SECTORS as readonly string[]).includes(value);
}

export function parseInvoiceOfferCampaignSector(offer: unknown): ScCampaignSector | null {
  if (!offer || typeof offer !== "object") return null;
  const raw = (offer as Record<string, unknown>).campaign_sector;
  return isScCampaignSector(raw) ? raw : null;
}

/**
 * Authoritative Campaign Sector for an invoice/campaign.
 * Offer freeze wins after send (copied from issuer-submitted invoice.details); otherwise invoice.details.
 * Never read issuer Industry / profile.
 */
export function resolveInvoiceCampaignSector(invoice: {
  details?: unknown;
  offer_details?: unknown;
}): ScCampaignSector | null {
  return (
    parseInvoiceOfferCampaignSector(invoice.offer_details) ??
    parseInvoiceOfferCampaignSector(invoice.details)
  );
}

/** SC Purpose of Fund Raising. Campaign/application field — not issuer Profile. */
export const SC_FUND_RAISING_PURPOSES = [
  "WORKING_CAPITAL",
  "BUSINESS_EXPANSION",
  "OTHERS",
] as const;
export type ScFundRaisingPurpose = (typeof SC_FUND_RAISING_PURPOSES)[number];

export const SC_FUND_RAISING_PURPOSE_LABELS: Record<ScFundRaisingPurpose, string> = {
  WORKING_CAPITAL: "Working Capital",
  BUSINESS_EXPANSION: "Business Expansion",
  OTHERS: "Others",
};

export function isScFundRaisingPurpose(value: unknown): value is ScFundRaisingPurpose {
  return (
    typeof value === "string" && (SC_FUND_RAISING_PURPOSES as readonly string[]).includes(value)
  );
}

function trimmedPurposeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * User-facing Purpose of Fund Raising from the SC enum.
 * When Others, appends the specified free-text if present.
 */
export function formatScPurposeOfFundRaisingDisplay(
  purpose: unknown,
  other?: unknown
): string | null {
  if (!isScFundRaisingPurpose(purpose)) return null;
  const label = SC_FUND_RAISING_PURPOSE_LABELS[purpose];
  if (purpose !== "OTHERS") return label;
  const otherText = trimmedPurposeText(other);
  return otherText ? `${label}: ${otherText}` : label;
}

/**
 * Application/review purpose string: SC enum when present, else legacy `financing_for`.
 * Never concatenates both — the SC field replaced the free-text purpose question.
 */
export function resolveApplicationPurposeOfFundRaising(why: unknown): string | null {
  const record =
    why && typeof why === "object" && !Array.isArray(why)
      ? (why as Record<string, unknown>)
      : null;
  if (!record) return null;
  const sc = formatScPurposeOfFundRaisingDisplay(
    record.sc_purpose_of_fund_raising ?? record.scPurposeOfFundRaising,
    record.sc_purpose_other ?? record.scPurposeOther
  );
  if (sc) return sc;
  return trimmedPurposeText(record.financing_for ?? record.financingFor);
}

export const SC_COMPANY_TYPE_LABELS: Record<ScCompanyType, string> = {
  SOLE_PROPRIETORSHIP: "Sole proprietorship",
  PARTNERSHIP: "Partnership",
  LLP: "Limited Liability Partnership",
  PRIVATE_LIMITED: "Private Limited (Sdn Bhd)",
  PUBLIC_LIMITED: "Public Limited (Bhd)",
  FOREIGN: "Foreign",
};

/**
 * Confirmed RegTank COD "Type of Entity" → SC Type of Company.
 * Unlisted Public Company and Foreign have no confirmed mapping — leave incomplete.
 */
const REGTANK_ENTITY_TYPE_TO_SC_COMPANY_TYPE: Record<string, ScCompanyType> = {
  "private limited company (sdn bhd)": "PRIVATE_LIMITED",
  "limited liability partnerships": "LLP",
};

/** Map only confirmed exact RegTank Type of Entity strings (trimmed, case-insensitive). */
export function mapRegTankEntityTypeToScCompanyType(raw: unknown): ScCompanyType | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().toLowerCase();
  if (!n) return null;
  return REGTANK_ENTITY_TYPE_TO_SC_COMPANY_TYPE[n] ?? null;
}

/** Current CashSouk issuer operational contact. Distinct from RegTank personInCharge evidence. */
export type IssuerContactPerson = {
  name?: string | null;
  position?: string | null;
  email?: string | null;
  contact?: string | null;
};

/** RegTank onboarding PIC snapshot. Not the current ComRep contact once contactPerson is filled. */
export type IssuerPersonInChargeEvidence = {
  name?: string | null;
  position?: string | null;
  email?: string | null;
  contactNumber?: string | null;
};

function trimContactText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isIssuerContactPersonFilled(
  contact: IssuerContactPerson | null | undefined
): boolean {
  if (!contact) return false;
  return Boolean(
    trimContactText(contact.name) ||
      trimContactText(contact.position) ||
      trimContactText(contact.email) ||
      trimContactText(contact.contact)
  );
}

/** Current Profile contact, then RegTank PIC — same resolution the issuer application company-details step uses. */
export function resolveIssuerProfileContactPerson(
  contactPerson: IssuerContactPerson | null | undefined,
  personInCharge: IssuerPersonInChargeEvidence | null | undefined
): IssuerContactPerson {
  if (isIssuerContactPersonFilled(contactPerson)) {
    return {
      name: trimContactText(contactPerson?.name) || null,
      position: trimContactText(contactPerson?.position) || null,
      email: trimContactText(contactPerson?.email) || null,
      contact: trimContactText(contactPerson?.contact) || null,
    };
  }
  return seedIssuerContactPersonFromPic(personInCharge);
}

export function seedIssuerContactPersonFromPic(
  pic: IssuerPersonInChargeEvidence | null | undefined
): IssuerContactPerson {
  return {
    name: pic?.name ?? null,
    position: pic?.position ?? null,
    email: pic?.email ?? null,
    contact: pic?.contactNumber ?? null,
  };
}

export function asIssuerContactPerson(value: unknown): IssuerContactPerson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  return {
    name: typeof rec.name === "string" ? rec.name : rec.name == null ? null : String(rec.name),
    position:
      typeof rec.position === "string" ? rec.position : rec.position == null ? null : String(rec.position),
    email: typeof rec.email === "string" ? rec.email : rec.email == null ? null : String(rec.email),
    contact:
      typeof rec.contact === "string"
        ? rec.contact
        : rec.contact == null
          ? typeof rec.contactNumber === "string"
            ? rec.contactNumber
            : rec.contactNumber == null
              ? null
              : String(rec.contactNumber)
          : String(rec.contact),
  };
}

export function asIssuerPersonInCharge(value: unknown): IssuerPersonInChargeEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  return {
    name: typeof rec.name === "string" ? rec.name : rec.name == null ? null : String(rec.name),
    position:
      typeof rec.position === "string" ? rec.position : rec.position == null ? null : String(rec.position),
    email: typeof rec.email === "string" ? rec.email : rec.email == null ? null : String(rec.email),
    contactNumber:
      typeof rec.contactNumber === "string"
        ? rec.contactNumber
        : rec.contactNumber == null
          ? typeof rec.contact === "string"
            ? rec.contact
            : rec.contact == null
              ? null
              : String(rec.contact)
          : String(rec.contactNumber),
  };
}

/**
 * Keep filled CashSouk contactPerson; seed from RegTank PIC only when master is empty.
 * Incoming PIC missing must not delete a filled master.
 */
export function mergeCodContactPersonMaster(params: {
  existingContact: unknown;
  incomingPic: unknown;
  incomingContact: unknown;
}): IssuerContactPerson | null {
  const existing = asIssuerContactPerson(params.existingContact);
  if (isIssuerContactPersonFilled(existing)) return existing;
  const incomingContact = asIssuerContactPerson(params.incomingContact);
  if (isIssuerContactPersonFilled(incomingContact)) return incomingContact;
  const pic = asIssuerPersonInCharge(params.incomingPic);
  const seeded = seedIssuerContactPersonFromPic(pic);
  return isIssuerContactPersonFilled(seeded) ? seeded : existing;
}

/** ComRep [02000] E-mail Address: current Contact Person, then RegTank PIC evidence. */
export function resolveIssuerComrepEmail(
  contactPerson: IssuerContactPerson | null | undefined,
  personInCharge: IssuerPersonInChargeEvidence | null | undefined
): string | null {
  const fromContact = trimContactText(contactPerson?.email);
  if (fromContact) return fromContact;
  const fromPic = trimContactText(personInCharge?.email);
  return fromPic || null;
}

/** ComRep [02000] Phone Number: current Contact Person, then RegTank PIC evidence. */
export function resolveIssuerComrepPhone(
  contactPerson: IssuerContactPerson | null | undefined,
  personInCharge: IssuerPersonInChargeEvidence | null | undefined
): string | null {
  const fromContact = trimContactText(contactPerson?.contact);
  if (fromContact) return fromContact;
  const fromPic = trimContactText(personInCharge?.contactNumber);
  return fromPic || null;
}

export const PROFILE_LOCKED_VERIFIED_DURING_ONBOARDING =
  "This field is locked because it was verified during onboarding.";
export const PROFILE_LOCKED_ROLES_CANNOT_CHANGE = "Roles cannot be changed here.";

/** Individual KYC fields on the organisation itself belong to personal investors only. */
export function shouldShowOrganizationPersonalKycCard(organizationType: "PERSONAL" | "COMPANY"): boolean {
  return organizationType !== "COMPANY";
}

/** Board/Management officer fields. Director is a separate role and is not Board. */
export function isIssuerOfficerRole(roles: { isBoard?: boolean; isManagement?: boolean }): boolean {
  return Boolean(roles.isBoard || roles.isManagement);
}

export const SELECT_AT_LEAST_ONE_ROLE_MESSAGE = "Select at least one role.";

/** True when at least one People role is selected. Roles are independent. */
export function hasOrganizationPartyRole(roles: {
  isDirector?: boolean;
  isShareholder?: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
}): boolean {
  return Boolean(roles.isDirector || roles.isShareholder || roles.isBoard || roles.isManagement);
}

/** Display the stored CashSouk Type of Company only. Confirmed RegTank maps prefill the master; they are not a live completeness substitute. */
export function displayScCompanyTypeLabel(
  scCompanyType: string | null | undefined,
  _regTankEntityType?: string | null
): string | null {
  const stored =
    scCompanyType && scCompanyType in SC_COMPANY_TYPE_LABELS
      ? (scCompanyType as ScCompanyType)
      : null;
  return stored ? SC_COMPANY_TYPE_LABELS[stored] : null;
}

export const SC_SHARE_TYPE_LABELS: Record<ScShareType, string> = {
  ORDINARY: "Ordinary shares",
  PREFERENCE: "Preference shares",
  OTHERS: "Others",
};

/** Annual RMO [10000] Interest in Other Company uses Ordinary / Preference / Others. */
export const SC_INTEREST_SHARE_TYPE_LABELS: Record<ScShareType, string> = {
  ORDINARY: "Ordinary",
  PREFERENCE: "Preference",
  OTHERS: "Others",
};

export const SC_IDENTITY_PREFIX_LABELS: Record<ScIdentityPrefix, string> = {
  NRIC: "NRIC",
  PASSPORT: "Passport",
  ROC: "ROC",
};

export const SC_GENDER_LABELS: Record<ScGender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  NOT_APPLICABLE: "Not Applicable",
};

export const SC_PERSON_KIND_LABELS: Record<ScPersonKind, string> = {
  BOARD: "Board of director",
  MANAGEMENT: "Management team",
};

export const SC_DESIGNATION_LABELS: Record<ScDesignation, string> = {
  CHIEF_EXECUTIVE_OFFICER: "Chief Executive Officer",
  CHIEF_COMPLIANCE_OFFICER: "Chief Compliance Officer",
  CHIEF_FINANCIAL_OFFICER: "Chief Financial Officer",
  SECRETARY: "Secretary",
  CHAIRMAN_EXECUTIVE: "Chairman – Executive",
  CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT: "Chairman – Non-Executive, Non-Independent",
  CHAIRMAN_NON_EXECUTIVE_INDEPENDENT: "Chairman – Non-Executive, Independent",
  DEPUTY_CHAIRMAN_EXECUTIVE: "Deputy Chairman – Executive",
  DEPUTY_CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT: "Deputy Chairman – Non-Executive, Non-Independent",
  DEPUTY_CHAIRMAN_NON_EXECUTIVE_INDEPENDENT: "Deputy Chairman – Non-Executive, Independent",
  DIRECTOR_EXECUTIVE: "Director – Executive",
  DIRECTOR_NON_EXECUTIVE_NON_INDEPENDENT: "Director – Non-Executive, Non-Independent",
  DIRECTOR_NON_EXECUTIVE_INDEPENDENT: "Director – Non-Executive, Independent",
  ALTERNATE_DIRECTOR: "Alternate Director",
  OTHERS: "Others",
};

export const SC_INVESTOR_CATEGORY_LABELS: Record<ScInvestorCategory, string> = {
  ANGEL: "Angel",
  RETAIL: "Retail",
  SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL: "Sophisticated – High net worth individual",
  SOPHISTICATED_ACCREDITED: "Sophisticated – Accredited",
  SOPHISTICATED_HIGH_NET_WORTH_ENTITY: "Sophisticated – High net worth entity",
  NON_SOPHISTICATED_ENTITY: "Non-sophisticated entity",
};

export const SC_INVESTOR_CATEGORY_DEFINITIONS: Record<ScInvestorCategory, string> = {
  ANGEL:
    "An individual who meets the SC angel investor requirements, including the relevant Malaysian tax residence and asset or income conditions.",
  RETAIL: "An individual who is neither an Angel investor nor a Sophisticated Investor.",
  SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL:
    "An individual who meets the SC high-net-worth investor requirements.",
  SOPHISTICATED_ACCREDITED: "An investor who qualifies under the SC accredited-investor categories.",
  SOPHISTICATED_HIGH_NET_WORTH_ENTITY:
    "A company or entity that meets the SC high-net-worth entity requirements.",
  NON_SOPHISTICATED_ENTITY:
    "A company or entity that does not meet the sophisticated-investor requirements.",
};

export const SC_INVESTOR_CATEGORIES_PERSONAL_NON_SOPHISTICATED = [
  "ANGEL",
  "RETAIL",
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_PERSONAL_SOPHISTICATED = [
  "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL",
  "SOPHISTICATED_ACCREDITED",
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_PERSONAL = [
  ...SC_INVESTOR_CATEGORIES_PERSONAL_NON_SOPHISTICATED,
  ...SC_INVESTOR_CATEGORIES_PERSONAL_SOPHISTICATED,
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_CORPORATE_SOPHISTICATED = [
  "SOPHISTICATED_HIGH_NET_WORTH_ENTITY",
  "SOPHISTICATED_ACCREDITED",
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_CORPORATE_NON_SOPHISTICATED = [
  "NON_SOPHISTICATED_ENTITY",
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_CORPORATE = [
  ...SC_INVESTOR_CATEGORIES_CORPORATE_SOPHISTICATED,
  ...SC_INVESTOR_CATEGORIES_CORPORATE_NON_SOPHISTICATED,
] as const satisfies readonly ScInvestorCategory[];

export const SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE =
  "Select Sophisticated Investor first.";

export type ScInvestorCategoryScope = {
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticatedInvestor?: boolean | null;
};

export function isScInvestorCategory(value: unknown): value is ScInvestorCategory {
  return typeof value === "string" && (SC_INVESTOR_CATEGORIES as readonly string[]).includes(value);
}

export function isSophisticatedInvestorSelected(
  value: unknown
): value is boolean {
  return value === true || value === false;
}

/** RegTank answers set Sophisticated Yes/No for personal investors only. */
export function appliesRegTankSophisticatedStatus(
  organizationType: "PERSONAL" | "COMPANY" | string
): boolean {
  return organizationType === "PERSONAL";
}

export function allowedScInvestorCategories(input: ScInvestorCategoryScope): ScInvestorCategory[] {
  if (!isSophisticatedInvestorSelected(input.isSophisticatedInvestor)) {
    return [];
  }
  if (input.organizationType === "COMPANY") {
    return input.isSophisticatedInvestor
      ? [...SC_INVESTOR_CATEGORIES_CORPORATE_SOPHISTICATED]
      : [...SC_INVESTOR_CATEGORIES_CORPORATE_NON_SOPHISTICATED];
  }
  return input.isSophisticatedInvestor
    ? [...SC_INVESTOR_CATEGORIES_PERSONAL_SOPHISTICATED]
    : [...SC_INVESTOR_CATEGORIES_PERSONAL_NON_SOPHISTICATED];
}

export function isAllowedScInvestorCategory(
  category: unknown,
  input: ScInvestorCategoryScope
): category is ScInvestorCategory {
  return (
    isScInvestorCategory(category) && allowedScInvestorCategories(input).includes(category)
  );
}

export function scInvestorCategoryAfterSophisticatedChange(
  current: unknown,
  input: ScInvestorCategoryScope
): ScInvestorCategory | null {
  return isAllowedScInvestorCategory(current, input) ? current : null;
}

export function scInvestorCategoryHelp(
  categories: readonly ScInvestorCategory[]
): string {
  return categories
    .map((category) => `${SC_INVESTOR_CATEGORY_LABELS[category]}\n${SC_INVESTOR_CATEGORY_DEFINITIONS[category]}`)
    .join("\n\n");
}

export function typeOfInvestorValidationMessage(
  category: unknown,
  input: ScInvestorCategoryScope
): string | null {
  if (!isSophisticatedInvestorSelected(input.isSophisticatedInvestor)) {
    return SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE;
  }
  if (category == null || (typeof category === "string" && category.trim() === "")) {
    return "Type of Investor is required.";
  }
  if (!isAllowedScInvestorCategory(category, input)) {
    return "This Type of Investor is not valid for this organisation.";
  }
  return null;
}

export const OPERATOR_ADVISOR_TYPE_LABELS: Record<OperatorAdvisorType, string> = {
  ACCOUNTING: "Accounting – Accountant appointed by RMO.",
  AUDITOR: "Auditor – Auditor which RMO currently engages.",
  BANKER: "Banker – Bank which RMO currently engages for deposits and withdrawal of trust monies.",
  COMPLIANCE_AND_RISK: "Compliance & Risk – Advisor appointed to provide compliance and risk services.",
  CREDIT_RATING: "Credit Rating – Credit Rating/Scoring Agency the RMOs engages for services.",
  LEGAL: "Legal – Legal advisor appointed by the RMOs",
  TAXATION: "Taxation – Tax advisor appointed by the RMOs.",
  TRUSTEE_ESCROW:
    "Trustee/Escrow Account – Trustee which RMO currently engages to manage deposits and withdrawal of trust monies.",
};

export const OPERATOR_HOLDER_TYPE_LABELS: Record<OperatorHolderType, string> = {
  SHAREHOLDER: "Shareholder",
  MEMBER: "Member",
  BENEFICIAL_OWNER: "Beneficial Owner",
};

export const PROFILE_VALUE_SOURCE_LABELS: Record<ProfileValueSource, string> = {
  CTOS: "CTOS",
  REGTANK: "RegTank",
  USER: "User",
  ADMIN: "Admin",
  SYSTEM: "System",
};

export interface ProfileAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface ProfileFieldSource {
  source: ProfileValueSource;
  updatedAt: string;
}

export type ProfileFieldSources = Record<string, ProfileFieldSource>;

export type ProfileMissingOwner = "USER" | "ADMIN" | "SYSTEM";

export interface ProfileMissingItem {
  step: ComrepProfileStepId;
  field: string;
  label: string;
  partyKey?: string;
  partyName?: string | null;
  owner?: ProfileMissingOwner;
}

export function isUserActionableMissingItem(item: ProfileMissingItem): boolean {
  return (item.owner ?? "USER") === "USER";
}

export function userActionableMissing(missing: ProfileMissingItem[]): ProfileMissingItem[] {
  return missing.filter(isUserActionableMissingItem);
}

export const ISSUER_PROFILE_STEP_IDS = [
  "company",
  "shareholders",
  "board",
  "financials",
  "review",
] as const;
export type IssuerProfileStepId = (typeof ISSUER_PROFILE_STEP_IDS)[number];

export const INVESTOR_PROFILE_STEP_IDS = ["identity", "review"] as const;
export type InvestorProfileStepId = (typeof INVESTOR_PROFILE_STEP_IDS)[number];
/** Identity required fields: all USER-editable on the normal Investor Profile, including `scInvestorCategory`. */
export const INVESTOR_IDENTITY_REQUIRED_COUNT = 10;
export const INVESTOR_ADMIN_IDENTITY_REQUIRED_COUNT = 0;

export type ComrepProfileStepId = IssuerProfileStepId | InvestorProfileStepId;

export const ISSUER_PROFILE_STEP_LABELS: Record<IssuerProfileStepId, string> = {
  company: "Company",
  shareholders: "Shareholders",
  board: "Board & Management",
  financials: "Financials",
  review: "Review",
};

export const INVESTOR_PROFILE_STEP_LABELS: Record<InvestorProfileStepId, string> = {
  identity: "Identity",
  review: "Review",
};

/** User-facing complete-profile steps. Completeness still scores shareholders + board separately. */
export const ISSUER_PROFILE_FLOW_STEP_IDS = ["company", "people", "financials", "review"] as const;
export type IssuerProfileFlowStepId = (typeof ISSUER_PROFILE_FLOW_STEP_IDS)[number];

export const ISSUER_PROFILE_FLOW_STEP_LABELS: Record<IssuerProfileFlowStepId, string> = {
  company: "Company",
  people: "People",
  financials: "Financials",
  review: "Review",
};

export function missingItemsForIssuerFlowStep(
  completeness: ComrepProfileCompleteness | null | undefined,
  step: IssuerProfileFlowStepId
): ProfileMissingItem[] {
  const missing = completeness?.missing ?? [];
  if (step === "review") return missing;
  if (step === "people") {
    return missing.filter((item) => item.step === "shareholders" || item.step === "board");
  }
  return missing.filter((item) => item.step === step);
}

export function issuerFlowStepComplete(
  completeness: ComrepProfileCompleteness | null | undefined,
  step: IssuerProfileFlowStepId
): boolean {
  if (!completeness) return false;
  if (step === "review") return completeness.complete;
  return missingItemsForIssuerFlowStep(completeness, step).length === 0;
}

export type ProfileUiSectionId =
  | "company"
  | "about"
  | "addresses"
  | "contact"
  | "people"
  | "financials"
  | "personal"
  | "identity"
  | "classification";

export type ProfileUiSectionRow = {
  id: ProfileUiSectionId;
  label: string;
  href: string;
  missingCount: number;
  complete: boolean;
};

export const ISSUER_PROFILE_UI_SECTIONS: Array<{
  id: ProfileUiSectionId;
  label: string;
  href: string;
}> = [
  { id: "company", label: "Company Details", href: "#profile-company" },
  { id: "about", label: "About your business", href: "#profile-about" },
  { id: "addresses", label: "Addresses", href: "#profile-addresses" },
  { id: "contact", label: "Person in Charge", href: "#profile-contact" },
  { id: "people", label: "People & Access", href: "#profile-people" },
  { id: "financials", label: "Financials", href: "#profile-financials" },
];

export function issuerUiSectionForMissing(item: ProfileMissingItem): ProfileUiSectionId {
  if (item.step === "shareholders" || item.step === "board") return "people";
  if (item.step === "financials") return "financials";
  if (item.field === "companyActivities") return "about";
  if (item.field.startsWith("registeredAddress") || item.field.startsWith("businessAddress")) {
    return "addresses";
  }
  if (
    item.field === "contactPersonEmail" ||
    item.field === "contactPersonPhone" ||
    item.field === "contactPersonName" ||
    item.field === "contactPersonPosition"
  ) {
    return "contact";
  }
  return "company";
}

export function groupIssuerMissingByProfileSection(
  missing: ProfileMissingItem[]
): ProfileUiSectionRow[] {
  const counts = new Map<ProfileUiSectionId, number>();
  for (const item of missing) {
    const id = issuerUiSectionForMissing(item);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return ISSUER_PROFILE_UI_SECTIONS.map((section) => {
    const missingCount = counts.get(section.id) ?? 0;
    return { ...section, missingCount, complete: missingCount === 0 };
  });
}

export const INVESTOR_PERSONAL_UI_SECTIONS: Array<{
  id: ProfileUiSectionId;
  label: string;
  href: string;
}> = [
  { id: "personal", label: "Personal Details", href: "#profile-personal" },
  { id: "addresses", label: "Address", href: "#profile-address" },
  { id: "contact", label: "Contact details", href: "#profile-contact" },
  { id: "classification", label: "Investor classification", href: "#profile-classification" },
];

export const INVESTOR_COMPANY_UI_SECTIONS: Array<{
  id: ProfileUiSectionId;
  label: string;
  href: string;
}> = [
  { id: "company", label: "Company Details", href: "#profile-company" },
  { id: "addresses", label: "Business Address", href: "#profile-addresses" },
  { id: "contact", label: "Account owner", href: "#profile-contact" },
  { id: "classification", label: "Investor classification", href: "#profile-classification" },
];

export function investorUiSectionForMissing(
  item: ProfileMissingItem,
  organizationType: "PERSONAL" | "COMPANY"
): ProfileUiSectionId {
  if (item.field === "state" || item.field === "postalCode") return "addresses";
  if (item.field === "businessState" || item.field === "businessPostalCode") return "addresses";
  if (item.field === "scInvestorCategory" || item.field === "isSophisticatedInvestor") {
    return "classification";
  }
  if (
    organizationType === "COMPANY" &&
    (item.field === "name" ||
      item.field === "registrationNumber" ||
      item.field === "identityPrefix" ||
      item.field === "dateOfIncorporation" ||
      item.field === "countryOfIncorporation" ||
      item.field === "gender")
  ) {
    return "company";
  }
  return "personal";
}

export function groupInvestorMissingByProfileSection(
  missing: ProfileMissingItem[],
  organizationType: "PERSONAL" | "COMPANY"
): ProfileUiSectionRow[] {
  const catalog =
    organizationType === "COMPANY" ? INVESTOR_COMPANY_UI_SECTIONS : INVESTOR_PERSONAL_UI_SECTIONS;
  const counts = new Map<ProfileUiSectionId, number>();
  for (const item of missing) {
    const id = investorUiSectionForMissing(item, organizationType);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return catalog.map((section) => {
    const missingCount = counts.get(section.id) ?? 0;
    return { ...section, missingCount, complete: missingCount === 0 };
  });
}

export function groupPeopleMissingByParty(missing: ProfileMissingItem[]): Array<{
  partyKey: string;
  partyName: string | null;
  items: ProfileMissingItem[];
}> {
  const groups = new Map<string, { partyKey: string; partyName: string | null; items: ProfileMissingItem[] }>();
  const ungrouped: ProfileMissingItem[] = [];
  for (const item of missing) {
    if (!item.partyKey) {
      ungrouped.push(item);
      continue;
    }
    const existing = groups.get(item.partyKey);
    if (existing) {
      existing.items.push(item);
      if (!existing.partyName && item.partyName) existing.partyName = item.partyName;
    } else {
      groups.set(item.partyKey, {
        partyKey: item.partyKey,
        partyName: item.partyName ?? null,
        items: [item],
      });
    }
  }
  const result = [...groups.values()];
  if (ungrouped.length > 0) {
    result.unshift({
      partyKey: "",
      partyName: null,
      items: ungrouped,
    });
  }
  return result;
}

export interface ComrepProfileStepCompleteness {
  id: ComrepProfileStepId;
  label: string;
  complete: boolean;
  requiredCount: number;
  filledCount: number;
  missing: ProfileMissingItem[];
}

export interface ComrepProfileCompleteness {
  portal: "issuer" | "investor";
  organizationType: "PERSONAL" | "COMPANY";
  complete: boolean;
  percent: number;
  steps: ComrepProfileStepCompleteness[];
  missing: ProfileMissingItem[];
  /** USER-actionable completeness. Fields the user can maintain on the normal Profile. */
  userComplete?: boolean;
  userPercent?: number;
  userMissing?: ProfileMissingItem[];
}

export function userFacingCompleteness(completeness: ComrepProfileCompleteness): {
  complete: boolean;
  percent: number;
  missing: ProfileMissingItem[];
} {
  const missing = completeness.userMissing ?? userActionableMissing(completeness.missing);
  return {
    complete: completeness.userComplete ?? missing.length === 0,
    percent: completeness.userPercent ?? completeness.percent,
    missing,
  };
}

export interface IssuerCompanyCompletenessInput {
  name: string | null | undefined;
  registrationNumber: string | null | undefined;
  organizationId: string | null | undefined;
  dateOfIncorporation: string | Date | null | undefined;
  dateOfCommencement: string | Date | null | undefined;
  countryOfIncorporation: string | null | undefined;
  scCompanyType: ScCompanyType | null | undefined;
  registeredAddress: ProfileAddress | null | undefined;
  businessAddress: ProfileAddress | null | undefined;
  contactPerson?: IssuerContactPerson | null;
  personInCharge?: IssuerPersonInChargeEvidence | null;
  companyActivities: string | null | undefined;
}

export interface PartyAddressCompletenessInput {
  line1?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface ShareholderCompletenessInput {
  partyKey: string;
  name: string | null | undefined;
  entityType: OrganizationPartyEntityType;
  identityPrefix: ScIdentityPrefix | null | undefined;
  identityNumber: string | null | undefined;
  dateOfBirth: string | Date | null | undefined;
  dateOfIncorporation: string | Date | null | undefined;
  gender: ScGender | null | undefined;
  nationality: string | null | undefined;
  countryOfIncorporation: string | null | undefined;
  address: PartyAddressCompletenessInput | null | undefined;
  shareType: ScShareType | null | undefined;
  shareTypeOther: string | null | undefined;
  shareholdingUnits: number | string | null | undefined;
  shareholdingAmount: number | string | null | undefined;
  shareholdingPercentage: number | string | null | undefined;
}

export interface BoardCompletenessInput {
  partyKey: string;
  name: string | null | undefined;
  personKind: ScPersonKind | null | undefined;
  identityPrefix: ScIdentityPrefix | null | undefined;
  identityNumber: string | null | undefined;
  gender: ScGender | null | undefined;
  dateOfBirth: string | Date | null | undefined;
  nationality: string | null | undefined;
  address: PartyAddressCompletenessInput | null | undefined;
  designation: ScDesignation | null | undefined;
  designationOther: string | null | undefined;
  appointmentDate: string | Date | null | undefined;
  /** Designation / appointment are Board and Management only, not Director. */
  requireOfficerFields?: boolean;
}

export interface IssuerPersonCompletenessInput {
  partyKey: string;
  name: string | null | undefined;
  entityType: OrganizationPartyEntityType;
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  isManagement: boolean;
  identityPrefix: ScIdentityPrefix | null | undefined;
  identityNumber: string | null | undefined;
  dateOfBirth: string | Date | null | undefined;
  dateOfIncorporation: string | Date | null | undefined;
  gender: ScGender | null | undefined;
  nationality: string | null | undefined;
  countryOfIncorporation: string | null | undefined;
  address: PartyAddressCompletenessInput | null | undefined;
  shareType: ScShareType | null | undefined;
  shareTypeOther: string | null | undefined;
  shareholdingUnits: number | string | null | undefined;
  shareholdingAmount: number | string | null | undefined;
  shareholdingPercentage: number | string | null | undefined;
  designation: ScDesignation | null | undefined;
  designationOther: string | null | undefined;
  appointmentDate: string | Date | null | undefined;
  /** When set, onboarding-eligible individuals defer ComRep gaps until KYC APPROVED. */
  kycOnboardingStatus?: string | null;
}

export interface IssuerFinancialCompletenessInput {
  currentAssets: number | string | null | undefined;
  nonCurrentAssets: number | string | null | undefined;
  currentBorrowing: number | string | null | undefined;
  currentNonBorrowing: number | string | null | undefined;
  nonCurrentLoan: number | string | null | undefined;
  nonCurrentNonLoan: number | string | null | undefined;
  equityCapital: number | string | null | undefined;
  accumulatedProfit: number | string | null | undefined;
  revenue: number | string | null | undefined;
  operatingCost: number | string | null | undefined;
  adminCost: number | string | null | undefined;
  interestCost: number | string | null | undefined;
  otherCost: number | string | null | undefined;
  profitBeforeTax: number | string | null | undefined;
  profitAfterTax: number | string | null | undefined;
  minorityInterest: number | string | null | undefined;
  netDividend: number | string | null | undefined;
}

export interface InvestorPersonalCompletenessInput {
  name: string | null | undefined;
  identityPrefix: ScIdentityPrefix | null | undefined;
  identityNumber: string | null | undefined;
  dateOfBirth: string | Date | null | undefined;
  gender: ScGender | null | undefined;
  state: string | null | undefined;
  postalCode: string | null | undefined;
  nationality: string | null | undefined;
  scInvestorCategory: ScInvestorCategory | null | undefined;
  isSophisticatedInvestor?: boolean | null;
}

export interface InvestorCorporateCompletenessInput {
  name: string | null | undefined;
  registrationNumber: string | null | undefined;
  identityPrefix: ScIdentityPrefix | null | undefined;
  dateOfIncorporation: string | Date | null | undefined;
  countryOfIncorporation: string | null | undefined;
  gender: ScGender | null | undefined;
  businessState: string | null | undefined;
  businessPostalCode: string | null | undefined;
  scInvestorCategory: ScInvestorCategory | null | undefined;
  isSophisticatedInvestor?: boolean | null;
}

export const ISSUER_FINANCIAL_COMREP_KEYS = [
  "curlib_borrowing",
  "curlib_non_borrowing",
  "ncl_loan",
  "ncl_non_loan",
  "equity_share_application",
  "equity_share_premium",
  "equity_accumulated_profit",
  "equity_minority",
  "operating_cost",
  "admin_cost",
  "interest_cost",
  "other_cost",
  "pl_minority",
] as const;
export type IssuerFinancialComrepKey = (typeof ISSUER_FINANCIAL_COMREP_KEYS)[number];

export const ISSUER_FINANCIAL_COMREP_LABELS: Record<IssuerFinancialComrepKey, string> = {
  curlib_borrowing: "Liabilities|Current - Borrowing (RM)",
  curlib_non_borrowing: "Liabilities|Current - Non Borrowing (RM)",
  ncl_loan: "Liabilities|Non Current - Loan (RM)",
  ncl_non_loan: "Liabilities|Non Current - Non Loan (RM)",
  equity_share_application: "Equity|Share Application Account (if applicable) (RM)",
  equity_share_premium: "Equity|Share Premium & Other Reserves (if applicable) (RM)",
  equity_accumulated_profit: "Equity|Accumulated Profit Carried Forward (RM)",
  equity_minority: "Equity|Minority Interest (if applicable) (RM)",
  operating_cost: "Operating Cost (RM)",
  admin_cost: "Administrative Cost (RM)",
  interest_cost: "Interest Cost (RM)",
  other_cost: "Other Cost (RM)",
  pl_minority: "Minority Interest (RM)",
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidEmailValue(value: unknown): boolean {
  return hasText(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function hasValidPhoneValue(value: unknown): boolean {
  return hasText(value) && normalizeProfilePhone(String(value)) != null;
}

function hasDate(value: unknown): boolean {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = new Date(trimmed);
  return !Number.isNaN(parsed.getTime());
}

function hasNumber(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n);
  }
  return false;
}

function hasRequiredPostcodeValue(
  postalCode: string | null | undefined,
  state: string | null | undefined
): boolean {
  if (typeof state === "string" && state.trim() === "Outside Malaysia") return true;
  return hasText(postalCode);
}

function hasRequiredPostcode(
  address: PartyAddressCompletenessInput | null | undefined
): boolean {
  return hasRequiredPostcodeValue(address?.postalCode, address?.state);
}

function hasAddressLineAndLocation(address: PartyAddressCompletenessInput | null | undefined): {
  line1: boolean;
  state: boolean;
  postalCode: boolean;
} {
  return {
    line1: hasText(address?.line1),
    state: hasText(address?.state),
    postalCode: hasRequiredPostcode(address),
  };
}

function pushMissing(
  missing: ProfileMissingItem[],
  step: ComrepProfileStepId,
  field: string,
  label: string,
  party?: { partyKey: string; partyName?: string | null },
  owner: ProfileMissingOwner = "USER"
): void {
  missing.push({
    step,
    field,
    label,
    partyKey: party?.partyKey,
    partyName: party?.partyName ?? null,
    owner,
  });
}

function pushMissingInvestorCategory(
  missing: ProfileMissingItem[],
  step: ComrepProfileStepId,
  scope: ScInvestorCategoryScope,
  existing: ScInvestorCategory | null | undefined
): void {
  if (isAllowedScInvestorCategory(existing, scope)) return;
  pushMissing(missing, step, "scInvestorCategory", "Type of Investor", undefined, "USER");
}

function pushMissingSophisticatedInvestor(
  missing: ProfileMissingItem[],
  step: ComrepProfileStepId,
  existing: boolean | null | undefined
): void {
  if (isSophisticatedInvestorSelected(existing)) return;
  pushMissing(missing, step, "isSophisticatedInvestor", "Sophisticated Investor", undefined, "USER");
}

function withUserFacingCompleteness(
  completeness: Omit<ComrepProfileCompleteness, "userComplete" | "userPercent" | "userMissing">
): ComrepProfileCompleteness {
  const userMissing = userActionableMissing(completeness.missing);
  if (completeness.portal === "issuer") {
    return {
      ...completeness,
      userComplete: completeness.complete,
      userPercent: completeness.percent,
      userMissing,
    };
  }
  const identityRequired = completeness.steps.find((step) => step.id === "identity")?.requiredCount ?? 10;
  const peopleRequired = completeness.steps.find((step) => step.id === "shareholders")?.requiredCount ?? 0;
  const userRequiredCount =
    Math.max(0, identityRequired - INVESTOR_ADMIN_IDENTITY_REQUIRED_COUNT) + peopleRequired;
  const userFilledCount = Math.max(0, userRequiredCount - userMissing.length);
  const userPercent =
    userRequiredCount === 0 ? 100 : Math.round((userFilledCount / userRequiredCount) * 100);
  return {
    ...completeness,
    userComplete: userMissing.length === 0,
    userPercent: Math.min(100, userPercent),
    userMissing,
  };
}

/**
 * Platform completeness for issuer company master data.
 * Includes Person in Charge Full Name and Position because the issuer application
 * company-details step cannot continue without them on Profile.
 * Issuer ID (if any) and Company Activities are not counted.
 */
export const ISSUER_COMPANY_COMPLETENESS_FIELD_COUNT = 16;

export function computeIssuerCompanyCompleteness(
  input: IssuerCompanyCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "company";
  if (!hasText(input.name)) pushMissing(missing, step, "name", PROFILE_LABEL.companyName);
  if (!hasText(input.registrationNumber)) {
    pushMissing(missing, step, "registrationNumber", PROFILE_LABEL.companyRegistrationNumber);
  }
  if (!hasDate(input.dateOfIncorporation)) {
    pushMissing(missing, step, "dateOfIncorporation", PROFILE_LABEL.dateOfIncorporation);
  }
  if (!hasDate(input.dateOfCommencement)) {
    pushMissing(missing, step, "dateOfCommencement", PROFILE_LABEL.dateBusinessCommenced);
  }
  if (!hasText(input.countryOfIncorporation)) {
    pushMissing(missing, step, "countryOfIncorporation", PROFILE_LABEL.countryOfIncorporation);
  }
  if (!hasText(input.scCompanyType)) {
    pushMissing(missing, step, "scCompanyType", PROFILE_LABEL.typeOfCompany);
  }
  if (!hasText(input.registeredAddress?.line1)) {
    pushMissing(missing, step, "registeredAddress.line1", profileAddressCompletenessLabel("registered", "line1"));
  }
  if (!hasText(input.registeredAddress?.state)) {
    pushMissing(missing, step, "registeredAddress.state", profileAddressCompletenessLabel("registered", "state"));
  }
  if (!hasRequiredPostcodeValue(input.registeredAddress?.postalCode, input.registeredAddress?.state)) {
    pushMissing(
      missing,
      step,
      "registeredAddress.postalCode",
      profileAddressCompletenessLabel("registered", "postcode")
    );
  }
  if (!hasText(input.businessAddress?.line1)) {
    pushMissing(missing, step, "businessAddress.line1", profileAddressCompletenessLabel("business", "line1"));
  }
  if (!hasText(input.businessAddress?.state)) {
    pushMissing(missing, step, "businessAddress.state", profileAddressCompletenessLabel("business", "state"));
  }
  if (!hasRequiredPostcodeValue(input.businessAddress?.postalCode, input.businessAddress?.state)) {
    pushMissing(
      missing,
      step,
      "businessAddress.postalCode",
      profileAddressCompletenessLabel("business", "postcode")
    );
  }
  const profileContact = resolveIssuerProfileContactPerson(input.contactPerson, input.personInCharge);
  if (!hasText(profileContact.name)) {
    pushMissing(missing, step, "contactPersonName", PROFILE_LABEL.fullName);
  }
  if (!hasText(profileContact.position)) {
    pushMissing(missing, step, "contactPersonPosition", PROFILE_LABEL.position);
  }
  const contactEmail = resolveIssuerComrepEmail(input.contactPerson, input.personInCharge);
  const contactPhone = resolveIssuerComrepPhone(input.contactPerson, input.personInCharge);
  if (!hasValidPhoneValue(contactPhone)) {
    pushMissing(missing, step, "contactPersonPhone", PROFILE_LABEL.phone);
  }
  if (!hasValidEmailValue(contactEmail)) {
    pushMissing(missing, step, "contactPersonEmail", PROFILE_LABEL.personEmail);
  }
  return missing;
}

export function computeShareholderCompleteness(
  party: ShareholderCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "shareholders";
  const who = { partyKey: party.partyKey, partyName: party.name ?? null };
  if (!hasText(party.entityType)) {
    pushMissing(missing, step, "entityType", "Shareholder Type", who);
  }
  if (!hasText(party.name)) pushMissing(missing, step, "name", PROFILE_LABEL.fullName, who);
  if (party.entityType === "CORPORATE") {
    if (party.identityPrefix !== "ROC") {
      pushMissing(missing, step, "identityPrefix", "Identity Prefix", who);
    }
  } else if (!hasText(party.identityPrefix) || party.identityPrefix === "ROC") {
    pushMissing(missing, step, "identityPrefix", "Identity Prefix", who);
  }
  if (!hasText(party.identityNumber)) {
    pushMissing(
      missing,
      step,
      "identityNumber",
      PROFILE_LABEL.identityNumber,
      who
    );
  }
  if (party.entityType === "INDIVIDUAL") {
    if (!hasDate(party.dateOfBirth)) {
      pushMissing(missing, step, "dateOfBirth", PROFILE_LABEL.dateOfBirth, who);
    }
    if (!hasText(party.gender) || party.gender === "NOT_APPLICABLE") {
      pushMissing(missing, step, "gender", "Gender", who);
    }
    if (!hasText(party.nationality)) pushMissing(missing, step, "nationality", PROFILE_LABEL.nationality, who);
  } else {
    if (!hasDate(party.dateOfIncorporation)) {
      pushMissing(missing, step, "dateOfIncorporation", PROFILE_LABEL.dateOfIncorporation, who);
    }
    if (party.gender !== "NOT_APPLICABLE") {
      pushMissing(missing, step, "gender", "Gender", who);
    }
    if (!hasText(party.countryOfIncorporation)) {
      pushMissing(missing, step, "countryOfIncorporation", PROFILE_LABEL.countryOfIncorporation, who);
    }
  }
  const addr = hasAddressLineAndLocation(party.address);
  if (!addr.line1) {
    pushMissing(missing, step, "address.line1", PROFILE_ADDRESS_FIELD_LABELS.address, who);
  }
  if (!addr.state) {
    pushMissing(missing, step, "address.state", PROFILE_ADDRESS_FIELD_LABELS.state, who);
  }
  if (!addr.postalCode) {
    pushMissing(missing, step, "address.postalCode", PROFILE_ADDRESS_FIELD_LABELS.postcode, who);
  }
  if (!hasText(party.shareType)) pushMissing(missing, step, "shareType", PROFILE_LABEL.typeOfShares, who);
  if (party.shareType === "OTHERS" && !hasText(party.shareTypeOther)) {
    pushMissing(missing, step, "shareTypeOther", PROFILE_LABEL.typeOfSharesOther, who);
  }
  if (!hasNumber(party.shareholdingUnits)) {
    pushMissing(missing, step, "shareholdingUnits", PROFILE_LABEL.shareholdingUnits, who);
  }
  if (!hasNumber(party.shareholdingAmount)) {
    pushMissing(missing, step, "shareholdingAmount", PROFILE_LABEL.shareholdingAmount, who);
  }
  if (!hasNumber(party.shareholdingPercentage)) {
    pushMissing(missing, step, "shareholdingPercentage", PROFILE_LABEL.shareholdingPercentage, who);
  }
  return missing;
}

export function computeBoardCompleteness(party: BoardCompletenessInput): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "board";
  const who = { partyKey: party.partyKey, partyName: party.name ?? null };
  const requireOfficerFields = party.requireOfficerFields !== false;
  if (!hasText(party.name)) pushMissing(missing, step, "name", PROFILE_LABEL.fullName, who);
  if (!hasText(party.identityPrefix) || party.identityPrefix === "ROC") {
    pushMissing(missing, step, "identityPrefix", PROFILE_LABEL.identityPrefix, who);
  }
  if (!hasText(party.identityNumber)) {
    pushMissing(missing, step, "identityNumber", PROFILE_LABEL.identityNumber, who);
  }
  if (!hasText(party.gender) || party.gender === "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", PROFILE_LABEL.gender, who);
  }
  if (!hasDate(party.dateOfBirth)) {
    pushMissing(missing, step, "dateOfBirth", PROFILE_LABEL.dateOfBirth, who);
  }
  if (!hasText(party.nationality)) pushMissing(missing, step, "nationality", PROFILE_LABEL.nationality, who);
  const addr = hasAddressLineAndLocation(party.address);
  if (!addr.line1) pushMissing(missing, step, "address.line1", PROFILE_ADDRESS_FIELD_LABELS.address, who);
  if (!addr.state) pushMissing(missing, step, "address.state", PROFILE_ADDRESS_FIELD_LABELS.state, who);
  if (!addr.postalCode) {
    pushMissing(missing, step, "address.postalCode", PROFILE_ADDRESS_FIELD_LABELS.postcode, who);
  }
  if (requireOfficerFields) {
    if (!hasText(party.designation)) pushMissing(missing, step, "designation", PROFILE_LABEL.designation, who);
    if (party.designation === "OTHERS" && !hasText(party.designationOther)) {
      pushMissing(missing, step, "designationOther", PROFILE_LABEL.designationOther, who);
    }
    if (!hasDate(party.appointmentDate)) {
      pushMissing(missing, step, "appointmentDate", PROFILE_LABEL.appointmentDate, who);
    }
  }
  return missing;
}

type IssuerPersonRequiredField = {
  step: ComrepProfileStepId;
  field: string;
  label: string;
  filled: boolean;
};

function issuerPersonRequiredFields(party: IssuerPersonCompletenessInput): IssuerPersonRequiredField[] {
  const active =
    party.isDirector || party.isShareholder || party.isBoard || party.isManagement;
  if (!active) return [];
  if (
    shouldDeferOnboardingPersonComrep({
      entityType: party.entityType,
      isDirector: party.isDirector,
      isShareholder: party.isShareholder,
      kycOnboardingStatus: party.kycOnboardingStatus,
    })
  ) {
    return [];
  }
  const fields: IssuerPersonRequiredField[] = [];
  const corporate = party.entityType === "CORPORATE";
  const identityStep: ComrepProfileStepId = party.isShareholder ? "shareholders" : "board";
  const push = (
    step: ComrepProfileStepId,
    field: string,
    label: string,
    filled: boolean
  ) => {
    fields.push({ step, field, label, filled });
  };

  if (party.isShareholder) {
    push("shareholders", "entityType", "Shareholder Type", hasText(party.entityType));
  }
  push(
    identityStep,
    "name",
    PROFILE_LABEL.fullName,
    hasText(party.name)
  );
  if (corporate) {
    push(identityStep, "identityPrefix", PROFILE_LABEL.identityPrefix, party.identityPrefix === "ROC");
  } else {
    push(
      identityStep,
      "identityPrefix",
      PROFILE_LABEL.identityPrefix,
      hasText(party.identityPrefix) && party.identityPrefix !== "ROC"
    );
  }
  push(
    identityStep,
    "identityNumber",
    PROFILE_LABEL.identityNumber,
    hasText(party.identityNumber)
  );
  if (corporate) {
    push(
      identityStep,
      "dateOfIncorporation",
      PROFILE_LABEL.dateOfIncorporation,
      hasDate(party.dateOfIncorporation)
    );
    push(
      identityStep,
      "countryOfIncorporation",
      PROFILE_LABEL.countryOfIncorporation,
      hasText(party.countryOfIncorporation)
    );
  } else {
    push(identityStep, "dateOfBirth", PROFILE_LABEL.dateOfBirth, hasDate(party.dateOfBirth));
    push(
      identityStep,
      "gender",
      PROFILE_LABEL.gender,
      hasText(party.gender) && party.gender !== "NOT_APPLICABLE"
    );
    push(
      identityStep,
      "nationality",
      PROFILE_LABEL.nationality,
      hasText(party.nationality)
    );
  }
  const addr = hasAddressLineAndLocation(party.address);
  push(identityStep, "address.line1", PROFILE_ADDRESS_FIELD_LABELS.address, addr.line1);
  push(identityStep, "address.state", PROFILE_ADDRESS_FIELD_LABELS.state, addr.state);
  push(identityStep, "address.postalCode", PROFILE_ADDRESS_FIELD_LABELS.postcode, addr.postalCode);

  if (party.isShareholder) {
    push("shareholders", "shareType", PROFILE_LABEL.typeOfShares, hasText(party.shareType));
    if (party.shareType === "OTHERS") {
      push(
        "shareholders",
        "shareTypeOther",
        PROFILE_LABEL.typeOfSharesOther,
        hasText(party.shareTypeOther)
      );
    }
    push(
      "shareholders",
      "shareholdingUnits",
      PROFILE_LABEL.shareholdingUnits,
      hasNumber(party.shareholdingUnits)
    );
    push(
      "shareholders",
      "shareholdingAmount",
      PROFILE_LABEL.shareholdingAmount,
      hasNumber(party.shareholdingAmount)
    );
    push(
      "shareholders",
      "shareholdingPercentage",
      PROFILE_LABEL.shareholdingPercentage,
      hasNumber(party.shareholdingPercentage)
    );
  }

  if (!corporate && isIssuerOfficerRole(party)) {
    push("board", "designation", PROFILE_LABEL.designation, hasText(party.designation));
    if (party.designation === "OTHERS") {
      push(
        "board",
        "designationOther",
        PROFILE_LABEL.designationOther,
        hasText(party.designationOther)
      );
    }
    push(
      "board",
      "appointmentDate",
      PROFILE_LABEL.appointmentDate,
      hasDate(party.appointmentDate)
    );
  }

  return fields;
}

export function issuerPersonCompletenessInputFromParty(party: {
  partyKey: string;
  name: string | null | undefined;
  entityType: OrganizationPartyEntityType;
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  isManagement: boolean;
  identityPrefix: ScIdentityPrefix | null | undefined;
  identityNumber: string | null | undefined;
  dateOfBirth: string | Date | null | undefined;
  dateOfIncorporation: string | Date | null | undefined;
  gender: ScGender | null | undefined;
  nationality: string | null | undefined;
  countryOfIncorporation: string | null | undefined;
  address: PartyAddressCompletenessInput | null | undefined;
  shareType: ScShareType | null | undefined;
  shareTypeOther: string | null | undefined;
  shareholdingUnits: number | string | null | undefined;
  shareholdingAmount: number | string | null | undefined;
  shareholdingPercentage: number | string | null | undefined;
  designation: ScDesignation | null | undefined;
  designationOther: string | null | undefined;
  appointmentDate: string | Date | null | undefined;
  kycOnboardingStatus?: string | null;
}): IssuerPersonCompletenessInput {
  return {
    partyKey: party.partyKey,
    name: party.name,
    entityType: party.entityType,
    isDirector: party.isDirector,
    isShareholder: party.isShareholder,
    isBoard: party.isBoard,
    isManagement: party.isManagement,
    identityPrefix: party.identityPrefix,
    identityNumber: party.identityNumber,
    dateOfBirth: party.dateOfBirth,
    dateOfIncorporation: party.dateOfIncorporation,
    gender: party.gender,
    nationality: party.nationality,
    countryOfIncorporation: party.countryOfIncorporation,
    address: party.address,
    shareType: party.shareType,
    shareTypeOther: party.shareTypeOther,
    shareholdingUnits: party.shareholdingUnits,
    shareholdingAmount: party.shareholdingAmount,
    shareholdingPercentage: party.shareholdingPercentage,
    designation: party.designation,
    designationOther: party.designationOther,
    appointmentDate: party.appointmentDate,
    kycOnboardingStatus: party.kycOnboardingStatus,
  };
}

export function countIssuerPersonRequiredFields(party: IssuerPersonCompletenessInput): number {
  return issuerPersonRequiredFields(party).length;
}

export function computeIssuerPersonCompleteness(
  party: IssuerPersonCompletenessInput
): ProfileMissingItem[] {
  const who = { partyKey: party.partyKey, partyName: party.name ?? null };
  return issuerPersonRequiredFields(party)
    .filter((field) => !field.filled)
    .map((field) => ({
      step: field.step,
      field: field.field,
      label: field.label,
      owner: "USER" as const,
      ...who,
    }));
}

export function dedupeProfileMissingByPartyField(items: ProfileMissingItem[]): ProfileMissingItem[] {
  const seen = new Set<string>();
  const out: ProfileMissingItem[] = [];
  for (const item of items) {
    const key = item.partyKey ? `${item.partyKey}::${item.field}` : `${item.step}::${item.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export const ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT = 17;

const EMPTY_ISSUER_FINANCIALS: IssuerFinancialCompletenessInput = {
  currentAssets: null,
  nonCurrentAssets: null,
  currentBorrowing: null,
  currentNonBorrowing: null,
  nonCurrentLoan: null,
  nonCurrentNonLoan: null,
  equityCapital: null,
  accumulatedProfit: null,
  revenue: null,
  operatingCost: null,
  adminCost: null,
  interestCost: null,
  otherCost: null,
  profitBeforeTax: null,
  profitAfterTax: null,
  minorityInterest: null,
  netDividend: null,
};

export function computeIssuerFinancialCompleteness(
  input: IssuerFinancialCompletenessInput | null | undefined
): ProfileMissingItem[] {
  const source = input ?? EMPTY_ISSUER_FINANCIALS;
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "financials";
  const checks: Array<[unknown, string, string]> = [
    [source.currentAssets, "currentAssets", FINANCIAL_FIELD_LABELS.bscatot],
    [source.nonCurrentAssets, "nonCurrentAssets", FINANCIAL_FIELD_LABELS.bsclbank],
    [source.currentBorrowing, "currentBorrowing", FINANCIAL_FIELD_LABELS.curlib_borrowing],
    [source.currentNonBorrowing, "currentNonBorrowing", FINANCIAL_FIELD_LABELS.curlib_non_borrowing],
    [source.nonCurrentLoan, "nonCurrentLoan", FINANCIAL_FIELD_LABELS.ncl_loan],
    [source.nonCurrentNonLoan, "nonCurrentNonLoan", FINANCIAL_FIELD_LABELS.ncl_non_loan],
    [source.equityCapital, "equityCapital", FINANCIAL_FIELD_LABELS.bsqpuc],
    [source.accumulatedProfit, "accumulatedProfit", FINANCIAL_FIELD_LABELS.equity_accumulated_profit],
    [source.revenue, "revenue", FINANCIAL_FIELD_LABELS.turnover],
    [source.operatingCost, "operatingCost", FINANCIAL_FIELD_LABELS.operating_cost],
    [source.adminCost, "adminCost", FINANCIAL_FIELD_LABELS.admin_cost],
    [source.interestCost, "interestCost", FINANCIAL_FIELD_LABELS.interest_cost],
    [source.otherCost, "otherCost", FINANCIAL_FIELD_LABELS.other_cost],
    [source.profitBeforeTax, "profitBeforeTax", FINANCIAL_FIELD_LABELS.plnpbt],
    [source.profitAfterTax, "profitAfterTax", FINANCIAL_FIELD_LABELS.plnpat],
    [source.minorityInterest, "minorityInterest", FINANCIAL_FIELD_LABELS.pl_minority],
    [source.netDividend, "netDividend", FINANCIAL_FIELD_LABELS.plnetdiv],
  ];
  for (const [value, field, label] of checks) {
    if (!hasNumber(value)) pushMissing(missing, step, field, label);
  }
  return missing;
}

export function computeInvestorPersonalCompleteness(
  input: InvestorPersonalCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "identity";
  if (!hasText(input.name)) pushMissing(missing, step, "name", PROFILE_LABEL.fullName);
  if (!hasText(input.identityPrefix)) {
    pushMissing(missing, step, "identityPrefix", PROFILE_LABEL.identityPrefix);
  }
  if (!hasText(input.identityNumber)) {
    pushMissing(missing, step, "identityNumber", PROFILE_LABEL.identityNumber);
  }
  if (!hasDate(input.dateOfBirth)) {
    pushMissing(missing, step, "dateOfBirth", PROFILE_LABEL.dateOfBirth);
  }
  if (!hasText(input.gender) || input.gender === "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", PROFILE_LABEL.gender);
  }
  if (!hasText(input.state)) {
    pushMissing(missing, step, "state", PROFILE_ADDRESS_FIELD_LABELS.state);
  }
  if (!hasRequiredPostcodeValue(input.postalCode, input.state)) {
    pushMissing(missing, step, "postalCode", PROFILE_ADDRESS_FIELD_LABELS.postcode);
  }
  if (!hasText(input.nationality)) pushMissing(missing, step, "nationality", PROFILE_LABEL.nationality);
  pushMissingSophisticatedInvestor(missing, step, input.isSophisticatedInvestor);
  pushMissingInvestorCategory(
    missing,
    step,
    {
      organizationType: "PERSONAL",
      isSophisticatedInvestor: input.isSophisticatedInvestor,
    },
    input.scInvestorCategory
  );
  return missing;
}

export function computeInvestorCorporateCompleteness(
  input: InvestorCorporateCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "identity";
  if (!hasText(input.name)) pushMissing(missing, step, "name", PROFILE_LABEL.companyName);
  if (!hasText(input.registrationNumber)) {
    pushMissing(missing, step, "registrationNumber", PROFILE_LABEL.companyRegistrationNumber);
  }
  if (input.identityPrefix !== "ROC") {
    pushMissing(missing, step, "identityPrefix", PROFILE_LABEL.identityPrefix);
  }
  if (!hasDate(input.dateOfIncorporation)) {
    pushMissing(missing, step, "dateOfIncorporation", PROFILE_LABEL.dateOfIncorporation);
  }
  if (!hasText(input.countryOfIncorporation)) {
    pushMissing(missing, step, "countryOfIncorporation", PROFILE_LABEL.countryOfIncorporation);
  }
  if (input.gender !== "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", PROFILE_LABEL.gender);
  }
  if (!hasText(input.businessState)) {
    pushMissing(missing, step, "businessState", PROFILE_ADDRESS_FIELD_LABELS.state);
  }
  if (!hasRequiredPostcodeValue(input.businessPostalCode, input.businessState)) {
    pushMissing(missing, step, "businessPostalCode", PROFILE_ADDRESS_FIELD_LABELS.postcode);
  }
  pushMissingSophisticatedInvestor(missing, step, input.isSophisticatedInvestor);
  pushMissingInvestorCategory(
    missing,
    step,
    {
      organizationType: "COMPANY",
      isSophisticatedInvestor: input.isSophisticatedInvestor,
    },
    input.scInvestorCategory
  );
  return missing;
}

function stepFromMissing(
  id: ComrepProfileStepId,
  label: string,
  missing: ProfileMissingItem[],
  requiredCount: number
): ComrepProfileStepCompleteness {
  const filledCount = Math.max(0, requiredCount - missing.length);
  return {
    id,
    label,
    complete: missing.length === 0 && requiredCount > 0,
    requiredCount,
    filledCount,
    missing,
  };
}

export function buildIssuerProfileCompleteness(input: {
  company: IssuerCompanyCompletenessInput;
  shareholders: ShareholderCompletenessInput[];
  board: BoardCompletenessInput[];
  people?: IssuerPersonCompletenessInput[];
  financials: IssuerFinancialCompletenessInput | null | undefined;
}): ComrepProfileCompleteness {
  const companyMissing = computeIssuerCompanyCompleteness(input.company);
  const companyRequired = ISSUER_COMPANY_COMPLETENESS_FIELD_COUNT;
  const peopleMissing = input.people
    ? input.people.flatMap(computeIssuerPersonCompleteness)
    : dedupeProfileMissingByPartyField([
        ...input.shareholders.flatMap(computeShareholderCompleteness),
        ...input.board.flatMap(computeBoardCompleteness),
      ]);
  const hasShareholder =
    input.people != null
      ? input.people.some((party) => party.isShareholder)
      : input.shareholders.length > 0;
  const shareholderMissing = peopleMissing.filter((item) => item.step === "shareholders");
  const boardMissing = peopleMissing.filter((item) => item.step === "board");
  const peopleRequired = input.people
    ? input.people.reduce((total, party) => total + countIssuerPersonRequiredFields(party), 0)
    : null;
  const shareholderStepMissing = hasShareholder
    ? peopleRequired != null
      ? peopleMissing
      : shareholderMissing
    : [
        {
          step: "shareholders" as const,
          field: "shareholders",
          label: "At least one shareholder",
          owner: "USER" as const,
        },
      ];
  const shareholderFieldCount = hasShareholder
    ? peopleRequired ?? input.shareholders.length * 14
    : 1;
  const boardFieldCount =
    peopleRequired != null
      ? 0
      : input.board.length === 0
        ? 0
        : input.board.length * 12;
  const boardStepMissing = peopleRequired != null ? [] : boardMissing;
  const financialMissing = computeIssuerFinancialCompleteness(input.financials);
  const financialRequired = ISSUER_FINANCIAL_REQUIRED_FIELD_COUNT;

  const steps: ComrepProfileStepCompleteness[] = [
    stepFromMissing("company", ISSUER_PROFILE_STEP_LABELS.company, companyMissing, companyRequired),
    {
      id: "shareholders",
      label: ISSUER_PROFILE_STEP_LABELS.shareholders,
      complete: shareholderStepMissing.length === 0,
      requiredCount: shareholderFieldCount,
      filledCount: Math.max(0, shareholderFieldCount - shareholderStepMissing.length),
      missing: shareholderStepMissing,
    },
    {
      id: "board",
      label: ISSUER_PROFILE_STEP_LABELS.board,
      complete: boardStepMissing.length === 0,
      requiredCount: boardFieldCount,
      filledCount: Math.max(0, boardFieldCount - boardStepMissing.length),
      missing: boardStepMissing,
    },
    stepFromMissing(
      "financials",
      ISSUER_PROFILE_STEP_LABELS.financials,
      financialMissing,
      financialRequired
    ),
  ];

  const allMissing = steps.flatMap((s) => s.missing);
  const requiredTotal = steps.reduce((n, s) => n + s.requiredCount, 0);
  const filledTotal = steps.reduce((n, s) => n + s.filledCount, 0);
  const percent = requiredTotal === 0 ? 0 : Math.round((filledTotal / requiredTotal) * 100);

  return withUserFacingCompleteness({
    portal: "issuer",
    organizationType: "COMPANY",
    complete: allMissing.length === 0,
    percent: Math.min(100, percent),
    steps: [
      ...steps,
      {
        id: "review",
        label: ISSUER_PROFILE_STEP_LABELS.review,
        complete: allMissing.length === 0,
        requiredCount: 0,
        filledCount: 0,
        missing: [],
      },
    ],
    missing: allMissing,
  });
}

export function buildInvestorProfileCompleteness(input: {
  organizationType: "PERSONAL" | "COMPANY";
  personal?: InvestorPersonalCompletenessInput;
  corporate?: InvestorCorporateCompletenessInput;
}): ComrepProfileCompleteness {
  const identityMissing =
    input.organizationType === "COMPANY"
      ? computeInvestorCorporateCompleteness(input.corporate ?? ({} as InvestorCorporateCompletenessInput))
      : computeInvestorPersonalCompleteness(input.personal ?? ({} as InvestorPersonalCompletenessInput));
  const identityRequired = INVESTOR_IDENTITY_REQUIRED_COUNT;
  const identityFilled = Math.max(0, identityRequired - identityMissing.length);
  const percent = Math.round((identityFilled / identityRequired) * 100);
  return withUserFacingCompleteness({
    portal: "investor",
    organizationType: input.organizationType,
    complete: identityMissing.length === 0,
    percent,
    steps: [
      {
        id: "identity",
        label: INVESTOR_PROFILE_STEP_LABELS.identity,
        complete: identityMissing.length === 0,
        requiredCount: identityRequired,
        filledCount: identityFilled,
        missing: identityMissing,
      },
      {
        id: "review",
        label: INVESTOR_PROFILE_STEP_LABELS.review,
        complete: identityMissing.length === 0,
        requiredCount: 0,
        filledCount: 0,
        missing: [],
      },
    ],
    missing: identityMissing,
  });
}

export function issuerFinancialsFromYearBlock(
  block: Record<string, unknown> | null | undefined
): IssuerFinancialCompletenessInput | null {
  if (!block) return null;
  const num = (key: string, fallbackKey?: string): number | string | null => {
    const primary = block[key];
    if (hasNumber(primary)) return primary as number | string;
    if (fallbackKey && hasNumber(block[fallbackKey])) return block[fallbackKey] as number | string;
    return null;
  };
  return {
    currentAssets: num("bscatot"),
    nonCurrentAssets: num("assets_non_current", "bsclbank"),
    currentBorrowing: num("curlib_borrowing"),
    currentNonBorrowing: num("curlib_non_borrowing"),
    nonCurrentLoan: num("ncl_loan"),
    nonCurrentNonLoan: num("ncl_non_loan"),
    equityCapital: num("bsqpuc"),
    accumulatedProfit: num("equity_accumulated_profit"),
    revenue: num("turnover"),
    operatingCost: num("operating_cost"),
    adminCost: num("admin_cost"),
    interestCost: num("interest_cost"),
    otherCost: num("other_cost"),
    profitBeforeTax: num("plnpbt"),
    profitAfterTax: num("plnpat"),
    minorityInterest: num("pl_minority"),
    netDividend: num("plnetdiv"),
  };
}

export function latestUnauditedYearKey(financialStatements: unknown): string | null {
  if (!financialStatements || typeof financialStatements !== "object") return null;
  const record = financialStatements as { unaudited_by_year?: unknown };
  const byYear = record.unaudited_by_year;
  if (!byYear || typeof byYear !== "object") return null;
  const years = Object.keys(byYear)
    .map((y) => Number(y))
    .filter((y) => Number.isFinite(y))
    .sort((a, b) => b - a);
  return years.length === 0 ? null : String(years[0]);
}

export function latestUnauditedYearBlock(
  financialStatements: unknown
): Record<string, unknown> | null {
  const yearKey = latestUnauditedYearKey(financialStatements);
  if (!yearKey || !financialStatements || typeof financialStatements !== "object") return null;
  const byYear = (financialStatements as { unaudited_by_year?: Record<string, unknown> })
    .unaudited_by_year;
  if (!byYear || typeof byYear !== "object") return null;
  const block = byYear[yearKey];
  if (!block || typeof block !== "object") return null;
  return block as Record<string, unknown>;
}

export interface IssuerOrgFinancialSummary {
  latestYear: string | null;
  complete: boolean;
  missingCount: number;
  missing: ProfileMissingItem[];
  fields: Record<string, unknown> | null;
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const DMY_DATE_RE = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * CTOS appoint/resign strings are DD-MM-YYYY. Do not use `new Date("01-12-2001")`
 * (JS treats that as 12 January).
 */
export function parseComrepCalendarDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(ISO_DATE_RE);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = trimmed.match(DMY_DATE_RE);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function comrepCalendarDateKey(value: unknown): string | null {
  const d = parseComrepCalendarDate(value);
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function asComparableNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (!DECIMAL_RE.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value)) {
    const asString = String(value);
    if (DECIMAL_RE.test(asString)) {
      const n = Number(asString);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export function valuesEqualForMismatch(a: unknown, b: unknown): boolean {
  const aDate = comrepCalendarDateKey(a);
  const bDate = comrepCalendarDateKey(b);
  if (aDate && bDate) return aDate === bDate;
  const aNum = asComparableNumber(a);
  const bNum = asComparableNumber(b);
  if (aNum != null && bNum != null) return aNum === bNum;
  const norm = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") return v.trim().toUpperCase().replace(/\s+/g, " ");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };
  return norm(a) === norm(b);
}

export function isMasterFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (typeof value === "number") return !Number.isFinite(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === "object") {
    if (asComparableNumber(value) != null) return false;
    const obj = value as Record<string, unknown>;
    return Object.values(obj).every((v) => isMasterFieldEmpty(v));
  }
  return false;
}
