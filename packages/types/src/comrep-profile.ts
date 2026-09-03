/**
 * SC ComRep enumerations and CashSouk master-profile completeness.
 * Annual RMO Information Report tables are [01000]–[11000]; issuer/investor
 * profile completeness uses monthly P2P [02000], [05000], [06000], [07000], [09000], [09100].
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

export const SC_COMPANY_TYPE_LABELS: Record<ScCompanyType, string> = {
  SOLE_PROPRIETORSHIP: "Sole proprietorship",
  PARTNERSHIP: "Partnership",
  LLP: "Limited Liability Partnership",
  PRIVATE_LIMITED: "Private Limited (Sdn Bhd)",
  PUBLIC_LIMITED: "Public Limited (Bhd)",
  FOREIGN: "Foreign",
};

export const SC_SHARE_TYPE_LABELS: Record<ScShareType, string> = {
  ORDINARY: "Ordinary shares",
  PREFERENCE: "Preference shares",
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
  BOARD: "Board of Director",
  MANAGEMENT: "Management Team",
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

export const SC_INVESTOR_CATEGORIES_PERSONAL = [
  "ANGEL",
  "RETAIL",
  "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL",
  "SOPHISTICATED_ACCREDITED",
] as const satisfies readonly ScInvestorCategory[];

export const SC_INVESTOR_CATEGORIES_CORPORATE = [
  "SOPHISTICATED_HIGH_NET_WORTH_ENTITY",
  "NON_SOPHISTICATED_ENTITY",
] as const satisfies readonly ScInvestorCategory[];

export type SophisticatedQualificationKind = "HNW" | "ACCREDITED" | "COMPANY";

export function isScInvestorCategory(value: unknown): value is ScInvestorCategory {
  return typeof value === "string" && (SC_INVESTOR_CATEGORIES as readonly string[]).includes(value);
}

export function sophisticatedQualificationKindsFromReason(
  reason: string | null | undefined
): Set<SophisticatedQualificationKind> {
  const kinds = new Set<SophisticatedQualificationKind>();
  const text = (reason ?? "").toLowerCase();
  if (!text.trim()) return kinds;
  if (text.includes("company organization")) kinds.add("COMPANY");
  if (
    text.includes("net personal assets") ||
    text.includes("annual income") ||
    text.includes("investment portfolio")
  ) {
    kinds.add("HNW");
  }
  if (text.includes("professional qualification") || text.includes("capital market experience")) {
    kinds.add("ACCREDITED");
  }
  return kinds;
}

export function allowedScInvestorCategories(input: {
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticated: boolean;
}): ScInvestorCategory[] {
  if (input.organizationType === "COMPANY") {
    return [...SC_INVESTOR_CATEGORIES_CORPORATE];
  }
  if (input.isSophisticated) {
    return ["SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL", "SOPHISTICATED_ACCREDITED"];
  }
  return ["ANGEL", "RETAIL"];
}

export function isAllowedScInvestorCategory(
  category: unknown,
  input: { organizationType: "PERSONAL" | "COMPANY"; isSophisticated: boolean }
): category is ScInvestorCategory {
  return (
    isScInvestorCategory(category) && allowedScInvestorCategories(input).includes(category)
  );
}

export type ScInvestorCategoryDerivation =
  | { status: "unique"; category: ScInvestorCategory }
  | { status: "ambiguous"; candidates: ScInvestorCategory[] };

/**
 * Maps onboarding sophisticated-status evidence to a ComRep investor category
 * only when the mapping is unique. Does not treat `isSophisticated === true`
 * as a single SC category.
 */
export function deriveScInvestorCategory(input: {
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticated: boolean;
  sophisticatedReason?: string | null;
}): ScInvestorCategoryDerivation {
  const candidates = allowedScInvestorCategories(input);
  if (input.organizationType === "COMPANY") {
    if (!input.isSophisticated) {
      return { status: "unique", category: "NON_SOPHISTICATED_ENTITY" };
    }
    return { status: "ambiguous", candidates };
  }

  if (!input.isSophisticated) {
    return { status: "ambiguous", candidates };
  }

  const kinds = sophisticatedQualificationKindsFromReason(input.sophisticatedReason);
  const hnw = kinds.has("HNW");
  const accredited = kinds.has("ACCREDITED");
  if (hnw && !accredited) {
    return { status: "unique", category: "SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL" };
  }
  if (accredited && !hnw) {
    return { status: "unique", category: "SOPHISTICATED_ACCREDITED" };
  }
  return { status: "ambiguous", candidates };
}

export function resolveScInvestorCategoryForStorage(input: {
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticated: boolean;
  sophisticatedReason?: string | null;
  existing?: ScInvestorCategory | string | null;
}): ScInvestorCategory | null {
  if (isAllowedScInvestorCategory(input.existing, input)) {
    return input.existing;
  }
  const derived = deriveScInvestorCategory(input);
  return derived.status === "unique" ? derived.category : null;
}

export const OPERATOR_ADVISOR_TYPE_LABELS: Record<OperatorAdvisorType, string> = {
  ACCOUNTING: "Accounting",
  AUDITOR: "Auditor",
  BANKER: "Banker",
  COMPLIANCE_AND_RISK: "Compliance & Risk",
  CREDIT_RATING: "Credit Rating",
  LEGAL: "Legal",
  TAXATION: "Taxation",
  TRUSTEE_ESCROW: "Trustee/Escrow Account",
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

export interface ProfileMissingItem {
  step: ComrepProfileStepId;
  field: string;
  label: string;
  partyKey?: string;
  partyName?: string | null;
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
  phoneNumber: string | null | undefined;
  companyEmail: string | null | undefined;
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
  isSophisticatedInvestor: boolean;
  sophisticatedInvestorReason?: string | null;
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
  isSophisticatedInvestor: boolean;
  sophisticatedInvestorReason?: string | null;
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
  curlib_borrowing: "Current liabilities — borrowing",
  curlib_non_borrowing: "Current liabilities — non-borrowing",
  ncl_loan: "Non-current liabilities — loan",
  ncl_non_loan: "Non-current liabilities — non-loan",
  equity_share_application: "Share application account",
  equity_share_premium: "Share premium & other reserves",
  equity_accumulated_profit: "Accumulated profit carried forward",
  equity_minority: "Equity minority interest",
  operating_cost: "Operating cost",
  admin_cost: "Administrative cost",
  interest_cost: "Interest cost",
  other_cost: "Other cost",
  pl_minority: "Profit and loss minority interest",
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
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

function hasAddressLineAndLocation(address: PartyAddressCompletenessInput | null | undefined): {
  line1: boolean;
  state: boolean;
  postalCode: boolean;
} {
  return {
    line1: hasText(address?.line1),
    state: hasText(address?.state),
    postalCode: hasText(address?.postalCode),
  };
}

function pushMissing(
  missing: ProfileMissingItem[],
  step: ComrepProfileStepId,
  field: string,
  label: string,
  party?: { partyKey: string; partyName?: string | null }
): void {
  missing.push({
    step,
    field,
    label,
    partyKey: party?.partyKey,
    partyName: party?.partyName ?? null,
  });
}

function pushMissingInvestorCategory(
  missing: ProfileMissingItem[],
  step: ComrepProfileStepId,
  input: {
    organizationType: "PERSONAL" | "COMPANY";
    isSophisticated: boolean;
    sophisticatedReason?: string | null;
    existing: ScInvestorCategory | null | undefined;
  }
): void {
  if (resolveScInvestorCategoryForStorage(input)) return;
  pushMissing(missing, step, "scInvestorCategory", "Type of investor");
}

export function computeIssuerCompanyCompleteness(
  input: IssuerCompanyCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "company";
  if (!hasText(input.name)) pushMissing(missing, step, "name", "Name of issuer");
  if (!hasText(input.registrationNumber)) pushMissing(missing, step, "registrationNumber", "Issuer ROC");
  if (!hasText(input.organizationId)) pushMissing(missing, step, "organizationId", "Issuer ID");
  if (!hasDate(input.dateOfIncorporation)) {
    pushMissing(missing, step, "dateOfIncorporation", "Date of incorporation");
  }
  if (!hasDate(input.dateOfCommencement)) {
    pushMissing(missing, step, "dateOfCommencement", "Date of commencement");
  }
  if (!hasText(input.countryOfIncorporation)) {
    pushMissing(missing, step, "countryOfIncorporation", "Country of incorporation");
  }
  if (!hasText(input.scCompanyType)) {
    pushMissing(missing, step, "scCompanyType", "Type of company");
  }
  if (!hasText(input.registeredAddress?.line1)) {
    pushMissing(missing, step, "registeredAddress.line1", "Registered address");
  }
  if (!hasText(input.registeredAddress?.state)) {
    pushMissing(missing, step, "registeredAddress.state", "Registered address — state");
  }
  if (!hasText(input.registeredAddress?.postalCode)) {
    pushMissing(missing, step, "registeredAddress.postalCode", "Registered address — postcode");
  }
  if (!hasText(input.businessAddress?.line1)) {
    pushMissing(missing, step, "businessAddress.line1", "Business address");
  }
  if (!hasText(input.businessAddress?.state)) {
    pushMissing(missing, step, "businessAddress.state", "Business address — state");
  }
  if (!hasText(input.businessAddress?.postalCode)) {
    pushMissing(missing, step, "businessAddress.postalCode", "Business address — postcode");
  }
  if (!hasText(input.phoneNumber)) pushMissing(missing, step, "phoneNumber", "Phone number");
  if (!hasText(input.companyEmail)) pushMissing(missing, step, "companyEmail", "E-mail address");
  if (!hasText(input.companyActivities)) {
    pushMissing(missing, step, "companyActivities", "Company activities");
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
    pushMissing(missing, step, "entityType", "Shareholder type", who);
  }
  if (!hasText(party.name)) pushMissing(missing, step, "name", "Shareholder name", who);
  if (!hasText(party.identityPrefix)) {
    pushMissing(missing, step, "identityPrefix", "Identity prefix", who);
  }
  if (!hasText(party.identityNumber)) {
    pushMissing(missing, step, "identityNumber", "Shareholder identity", who);
  }
  if (party.entityType === "INDIVIDUAL") {
    if (!hasDate(party.dateOfBirth)) pushMissing(missing, step, "dateOfBirth", "Date of birth", who);
    if (!hasText(party.gender) || party.gender === "NOT_APPLICABLE") {
      pushMissing(missing, step, "gender", "Gender", who);
    }
    if (!hasText(party.nationality)) pushMissing(missing, step, "nationality", "Nationality", who);
  } else {
    if (!hasDate(party.dateOfIncorporation)) {
      pushMissing(missing, step, "dateOfIncorporation", "Date of incorporation", who);
    }
    if (party.gender !== "NOT_APPLICABLE") {
      pushMissing(missing, step, "gender", "Gender (Not Applicable for companies)", who);
    }
    if (!hasText(party.countryOfIncorporation)) {
      pushMissing(missing, step, "countryOfIncorporation", "Country of incorporation", who);
    }
  }
  const addr = hasAddressLineAndLocation(party.address);
  if (!addr.line1) {
    pushMissing(missing, step, "address.line1", "Business/residential address", who);
  }
  if (!addr.state) {
    pushMissing(missing, step, "address.state", "Address — state", who);
  }
  if (!addr.postalCode) {
    pushMissing(missing, step, "address.postalCode", "Address — postcode", who);
  }
  if (!hasText(party.shareType)) pushMissing(missing, step, "shareType", "Type of shares", who);
  if (party.shareType === "OTHERS" && !hasText(party.shareTypeOther)) {
    pushMissing(missing, step, "shareTypeOther", "Type of shares — others", who);
  }
  if (!hasNumber(party.shareholdingUnits)) {
    pushMissing(missing, step, "shareholdingUnits", "Shareholding units", who);
  }
  if (!hasNumber(party.shareholdingAmount)) {
    pushMissing(missing, step, "shareholdingAmount", "Shareholding amount", who);
  }
  if (!hasNumber(party.shareholdingPercentage)) {
    pushMissing(missing, step, "shareholdingPercentage", "Shareholding percentage", who);
  }
  return missing;
}

export function computeBoardCompleteness(party: BoardCompletenessInput): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "board";
  const who = { partyKey: party.partyKey, partyName: party.name ?? null };
  if (!hasText(party.personKind)) {
    pushMissing(missing, step, "personKind", "Board of Director / Management Team", who);
  }
  if (!hasText(party.name)) pushMissing(missing, step, "name", "Name", who);
  if (!hasText(party.identityPrefix)) {
    pushMissing(missing, step, "identityPrefix", "Identity prefix", who);
  }
  if (!hasText(party.identityNumber)) {
    pushMissing(missing, step, "identityNumber", "Identity number", who);
  }
  if (!hasText(party.gender) || party.gender === "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", "Gender", who);
  }
  if (!hasDate(party.dateOfBirth)) pushMissing(missing, step, "dateOfBirth", "Date of birth", who);
  if (!hasText(party.nationality)) pushMissing(missing, step, "nationality", "Nationality", who);
  const addr = hasAddressLineAndLocation(party.address);
  if (!addr.line1) pushMissing(missing, step, "address.line1", "Residential address", who);
  if (!addr.state) pushMissing(missing, step, "address.state", "Residential address — state", who);
  if (!addr.postalCode) {
    pushMissing(missing, step, "address.postalCode", "Residential address — postcode", who);
  }
  if (!hasText(party.designation)) pushMissing(missing, step, "designation", "Designation", who);
  if (party.designation === "OTHERS" && !hasText(party.designationOther)) {
    pushMissing(missing, step, "designationOther", "Designation — others", who);
  }
  if (!hasDate(party.appointmentDate)) {
    pushMissing(missing, step, "appointmentDate", "Appointment date", who);
  }
  return missing;
}

export function computeIssuerFinancialCompleteness(
  input: IssuerFinancialCompletenessInput | null | undefined
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "financials";
  if (!input) {
    pushMissing(missing, step, "financials", "Latest financial statements");
    return missing;
  }
  const checks: Array<[unknown, string, string]> = [
    [input.currentAssets, "currentAssets", "Current assets"],
    [input.nonCurrentAssets, "nonCurrentAssets", "Non-current assets"],
    [input.currentBorrowing, "currentBorrowing", "Current liabilities — borrowing"],
    [input.currentNonBorrowing, "currentNonBorrowing", "Current liabilities — non-borrowing"],
    [input.nonCurrentLoan, "nonCurrentLoan", "Non-current liabilities — loan"],
    [input.nonCurrentNonLoan, "nonCurrentNonLoan", "Non-current liabilities — non-loan"],
    [input.equityCapital, "equityCapital", "Equity capital"],
    [input.accumulatedProfit, "accumulatedProfit", "Accumulated profit carried forward"],
    [input.revenue, "revenue", "Total revenue and income"],
    [input.operatingCost, "operatingCost", "Operating cost"],
    [input.adminCost, "adminCost", "Administrative cost"],
    [input.interestCost, "interestCost", "Interest cost"],
    [input.otherCost, "otherCost", "Other cost"],
    [input.profitBeforeTax, "profitBeforeTax", "Profit/loss before tax"],
    [input.profitAfterTax, "profitAfterTax", "Profit/loss after tax"],
    [input.netDividend, "netDividend", "Net dividend"],
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
  if (!hasText(input.name)) pushMissing(missing, step, "name", "Investor name");
  if (!hasText(input.identityPrefix)) {
    pushMissing(missing, step, "identityPrefix", "Identity prefix");
  }
  if (!hasText(input.identityNumber)) {
    pushMissing(missing, step, "identityNumber", "Investor identification");
  }
  if (!hasDate(input.dateOfBirth)) {
    pushMissing(missing, step, "dateOfBirth", "Date of birth");
  }
  if (!hasText(input.gender) || input.gender === "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", "Gender");
  }
  if (!hasText(input.state)) pushMissing(missing, step, "state", "Address — state");
  if (!hasText(input.postalCode)) pushMissing(missing, step, "postalCode", "Address — postcode");
  if (!hasText(input.nationality)) pushMissing(missing, step, "nationality", "Nationality");
  pushMissingInvestorCategory(missing, step, {
    organizationType: "PERSONAL",
    isSophisticated: input.isSophisticatedInvestor,
    sophisticatedReason: input.sophisticatedInvestorReason,
    existing: input.scInvestorCategory,
  });
  return missing;
}

export function computeInvestorCorporateCompleteness(
  input: InvestorCorporateCompletenessInput
): ProfileMissingItem[] {
  const missing: ProfileMissingItem[] = [];
  const step: ComrepProfileStepId = "identity";
  if (!hasText(input.name)) pushMissing(missing, step, "name", "Investor name");
  if (!hasText(input.registrationNumber)) {
    pushMissing(missing, step, "registrationNumber", "Company registration number");
  }
  if (input.identityPrefix !== "ROC") {
    pushMissing(missing, step, "identityPrefix", "Identity prefix (ROC)");
  }
  if (!hasDate(input.dateOfIncorporation)) {
    pushMissing(missing, step, "dateOfIncorporation", "Date of incorporation");
  }
  if (!hasText(input.countryOfIncorporation)) {
    pushMissing(missing, step, "countryOfIncorporation", "Country of incorporation");
  }
  if (input.gender !== "NOT_APPLICABLE") {
    pushMissing(missing, step, "gender", "Gender (Not Applicable for companies)");
  }
  if (!hasText(input.businessState)) {
    pushMissing(missing, step, "businessState", "Business address — state");
  }
  if (!hasText(input.businessPostalCode)) {
    pushMissing(missing, step, "businessPostalCode", "Business address — postcode");
  }
  pushMissingInvestorCategory(missing, step, {
    organizationType: "COMPANY",
    isSophisticated: input.isSophisticatedInvestor,
    sophisticatedReason: input.sophisticatedInvestorReason,
    existing: input.scInvestorCategory,
  });
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
  financials: IssuerFinancialCompletenessInput | null | undefined;
}): ComrepProfileCompleteness {
  const companyMissing = computeIssuerCompanyCompleteness(input.company);
  const companyRequired = 16;
  const shareholderMissing = input.shareholders.flatMap(computeShareholderCompleteness);
  const shareholderFieldCount = input.shareholders.length === 0 ? 1 : input.shareholders.length * 14;
  const boardMissing = input.board.flatMap(computeBoardCompleteness);
  const boardFieldCount = input.board.length === 0 ? 0 : input.board.length * 12;
  const financialMissing = computeIssuerFinancialCompleteness(input.financials);
  const financialRequired = 16;

  const shareholderStepMissing =
    input.shareholders.length === 0
      ? [
          {
            step: "shareholders" as const,
            field: "shareholders",
            label: "At least one shareholder",
          },
        ]
      : shareholderMissing;

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
      complete: boardMissing.length === 0,
      requiredCount: boardFieldCount,
      filledCount: Math.max(0, boardFieldCount - boardMissing.length),
      missing: boardMissing,
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

  return {
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
  };
}

export function buildInvestorProfileCompleteness(input: {
  organizationType: "PERSONAL" | "COMPANY";
  personal?: InvestorPersonalCompletenessInput;
  corporate?: InvestorCorporateCompletenessInput;
}): ComrepProfileCompleteness {
  const missing =
    input.organizationType === "COMPANY"
      ? computeInvestorCorporateCompleteness(input.corporate ?? ({} as InvestorCorporateCompletenessInput))
      : computeInvestorPersonalCompleteness(input.personal ?? ({} as InvestorPersonalCompletenessInput));
  const requiredCount = missing.length === 0 ? (input.organizationType === "COMPANY" ? 9 : 9) : 9;
  const filledCount = Math.max(0, requiredCount - missing.length);
  const percent = Math.round((filledCount / requiredCount) * 100);
  return {
    portal: "investor",
    organizationType: input.organizationType,
    complete: missing.length === 0,
    percent,
    steps: [
      {
        id: "identity",
        label: INVESTOR_PROFILE_STEP_LABELS.identity,
        complete: missing.length === 0,
        requiredCount,
        filledCount,
        missing,
      },
      {
        id: "review",
        label: INVESTOR_PROFILE_STEP_LABELS.review,
        complete: missing.length === 0,
        requiredCount: 0,
        filledCount: 0,
        missing: [],
      },
    ],
    missing,
  };
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
