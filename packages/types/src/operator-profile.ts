import type {
  OperatorAdvisorType,
  OperatorHolderType,
  OrganizationPartyEntityType,
  ScDesignation,
  ScPersonKind,
  ScShareType,
} from "./comrep-profile";

export interface OperatorProfileDto {
  id: string;
  singletonKey: string;
  name: string | null;
  registrationNumber: string | null;
  trusteeRegistrationNumber: string | null;
  responsiblePersonName: string | null;
  responsiblePersonPhone: string | null;
  shareCapital: OperatorShareCapitalDto | null;
  shareholders: OperatorShareholderDto[];
  officers: OperatorOfficerDto[];
  advisors: OperatorAdvisorDto[];
  interests: OperatorInterestDto[];
  financialStatements: OperatorFinancialStatementDto[];
  updatedAt: string;
}

export interface OperatorShareCapitalDto {
  id: string;
  ordinaryUnits: string | null;
  ordinaryAmount: string | null;
  preferenceUnits: string | null;
  preferenceAmount: string | null;
  othersUnits: string | null;
  othersAmount: string | null;
  totalPaidUpCapital: string | null;
  llpMembersCapitalUnits: string | null;
  llpMembersCapitalAmount: string | null;
  llpMembersReservesUnits: string | null;
  llpMembersReservesAmount: string | null;
  llpSubordinatedLoansUnits: string | null;
  llpSubordinatedLoansAmount: string | null;
  totalLlp: string | null;
}

export interface OperatorShareholderDto {
  id: string;
  holderType: OperatorHolderType;
  entityType: OrganizationPartyEntityType;
  name: string | null;
  salutation: string | null;
  identityNumber: string | null;
  dateOfBirth: string | null;
  dateOfIncorporation: string | null;
  nationality: string | null;
  address: string | null;
  dateAcquired: string | null;
  dateDisposal: string | null;
  shareType: ScShareType | null;
  shareTypeOther: string | null;
  shareholdingUnits: string | null;
  shareholdingAmount: string | null;
  shareholdingPercentage: string | null;
}

export interface OperatorOfficerDto {
  id: string;
  personKind: ScPersonKind;
  name: string | null;
  salutation: string | null;
  isResponsiblePerson: boolean;
  identityNumber: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  address: string | null;
  designation: ScDesignation | null;
  designationOther: string | null;
  appointmentDate: string | null;
  resignationDate: string | null;
}

export interface OperatorAdvisorDto {
  id: string;
  advisorType: OperatorAdvisorType;
  name: string | null;
  registrationNumber: string | null;
  country: string | null;
  address: string | null;
  appointmentDate: string | null;
  cessationDate: string | null;
}

export interface OperatorInterestDto {
  id: string;
  name: string | null;
  registrationNumber: string | null;
  country: string | null;
  address: string | null;
  acquisitionDate: string | null;
  disposalDate: string | null;
  shareType: ScShareType | null;
  shareTypeOther: string | null;
  shareholdingUnits: string | null;
  shareholdingPercentage: string | null;
}

export interface OperatorFinancialStatementDto {
  id: string;
  consolidatedAccounts: boolean | null;
  auditorName: string | null;
  financialYearEnd: string | null;
  unmodifiedReports: boolean | null;
  dateTabledToBoard: string | null;
  currency: string | null;
  numberOfShares: string | null;
  totalAssets: string | null;
  nonCurrentAssets: string | null;
  currentAssets: string | null;
  totalEquity: string | null;
  paidUpCapital: string | null;
  shareApplicationAccount: string | null;
  sharePremiumAndReserves: string | null;
  accumulatedProfitCarriedForward: string | null;
  equityMinorityInterest: string | null;
  totalLiabilities: string | null;
  nonCurrentLiabilities: string | null;
  currentLiabilities: string | null;
  totalRevenue: string | null;
  revenueDonation: string | null;
  revenueReward: string | null;
  revenueLending: string | null;
  revenueEquity: string | null;
  revenueFees: string | null;
  revenueOther: string | null;
  incomeDepositInterest: string | null;
  incomeOther: string | null;
  totalCost: string | null;
  costStaff: string | null;
  costSystem: string | null;
  costPromotion: string | null;
  costOther: string | null;
  profitBeforeTax: string | null;
  taxation: string | null;
  profitAfterTax: string | null;
  pnlMinorityInterest: string | null;
  netDividend: string | null;
}

export const OPERATOR_PROFILE_SECTION_IDS = [
  "general",
  "shareCapital",
  "shareholders",
  "officers",
  "advisors",
  "interests",
  "financials",
] as const;
export type OperatorProfileSectionId = (typeof OPERATOR_PROFILE_SECTION_IDS)[number];

export const OPERATOR_PROFILE_SECTION_LABELS: Record<OperatorProfileSectionId, string> = {
  general: "General Information",
  shareCapital: "Share Capital",
  shareholders: "Shareholders / Members / Beneficial Owners",
  officers: "Board & Management",
  advisors: "Advisers",
  interests: "Interests in Other Companies",
  financials: "Financial Statements",
};

export type OperatorProfileMissingItem = {
  section: OperatorProfileSectionId;
  field: string;
  label: string;
};

export type OperatorProfileSectionCompleteness = {
  id: OperatorProfileSectionId;
  label: string;
  complete: boolean;
  requiredCount: number;
  filledCount: number;
  missing: OperatorProfileMissingItem[];
};

export type OperatorProfileCompleteness = {
  complete: boolean;
  percent: number;
  sections: OperatorProfileSectionCompleteness[];
  missing: OperatorProfileMissingItem[];
};

function operatorHasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function operatorSection(
  id: OperatorProfileSectionId,
  missing: OperatorProfileMissingItem[],
  requiredCount: number
): OperatorProfileSectionCompleteness {
  const filledCount = Math.max(0, requiredCount - missing.length);
  return {
    id,
    label: OPERATOR_PROFILE_SECTION_LABELS[id],
    complete: missing.length === 0 && requiredCount > 0,
    requiredCount,
    filledCount,
    missing,
  };
}

export function buildOperatorProfileCompleteness(
  profile: OperatorProfileDto
): OperatorProfileCompleteness {
  const generalMissing: OperatorProfileMissingItem[] = [];
  if (!operatorHasText(profile.name)) {
    generalMissing.push({ section: "general", field: "name", label: "RMO / operator name" });
  }
  if (!operatorHasText(profile.registrationNumber)) {
    generalMissing.push({
      section: "general",
      field: "registrationNumber",
      label: "Company registration number",
    });
  }
  if (!operatorHasText(profile.responsiblePersonName)) {
    generalMissing.push({
      section: "general",
      field: "responsiblePersonName",
      label: "Responsible person",
    });
  }
  if (!operatorHasText(profile.responsiblePersonPhone)) {
    generalMissing.push({
      section: "general",
      field: "responsiblePersonPhone",
      label: "Responsible person contact",
    });
  }

  const capitalMissing: OperatorProfileMissingItem[] = [];
  if (!operatorHasText(profile.shareCapital?.totalPaidUpCapital)) {
    capitalMissing.push({
      section: "shareCapital",
      field: "totalPaidUpCapital",
      label: "Total paid-up capital",
    });
  }

  const shareholderMissing: OperatorProfileMissingItem[] = [];
  if (profile.shareholders.length === 0) {
    shareholderMissing.push({
      section: "shareholders",
      field: "shareholders",
      label: "At least one shareholder, member, or beneficial owner",
    });
  } else {
    for (const row of profile.shareholders) {
      if (!operatorHasText(row.name)) {
        shareholderMissing.push({
          section: "shareholders",
          field: `shareholders.${row.id}.name`,
          label: "Holder name",
        });
      }
    }
  }

  const officerMissing: OperatorProfileMissingItem[] = [];
  if (profile.officers.length === 0) {
    officerMissing.push({
      section: "officers",
      field: "officers",
      label: "At least one board or management person",
    });
  } else if (!profile.officers.some((row) => row.isResponsiblePerson)) {
    officerMissing.push({
      section: "officers",
      field: "responsiblePerson",
      label: "Responsible person on board / management",
    });
  }

  const financialMissing: OperatorProfileMissingItem[] = [];
  if (profile.financialStatements.length === 0) {
    financialMissing.push({
      section: "financials",
      field: "financialStatements",
      label: "At least one financial statement",
    });
  }

  const sections: OperatorProfileSectionCompleteness[] = [
    operatorSection("general", generalMissing, 4),
    operatorSection("shareCapital", capitalMissing, 1),
    {
      id: "shareholders",
      label: OPERATOR_PROFILE_SECTION_LABELS.shareholders,
      complete: shareholderMissing.length === 0,
      requiredCount: profile.shareholders.length === 0 ? 1 : profile.shareholders.length,
      filledCount: Math.max(
        0,
        (profile.shareholders.length === 0 ? 1 : profile.shareholders.length) -
          shareholderMissing.length
      ),
      missing: shareholderMissing,
    },
    {
      id: "officers",
      label: OPERATOR_PROFILE_SECTION_LABELS.officers,
      complete: officerMissing.length === 0,
      requiredCount: 1,
      filledCount: officerMissing.length === 0 ? 1 : 0,
      missing: officerMissing,
    },
    {
      id: "advisors",
      label: OPERATOR_PROFILE_SECTION_LABELS.advisors,
      complete: true,
      requiredCount: 0,
      filledCount: 0,
      missing: [],
    },
    {
      id: "interests",
      label: OPERATOR_PROFILE_SECTION_LABELS.interests,
      complete: true,
      requiredCount: 0,
      filledCount: 0,
      missing: [],
    },
    operatorSection("financials", financialMissing, 1),
  ];

  const missing = sections.flatMap((section) => section.missing);
  const requiredTotal = sections.reduce((sum, section) => sum + section.requiredCount, 0);
  const filledTotal = sections.reduce((sum, section) => sum + section.filledCount, 0);
  const percent = requiredTotal === 0 ? 0 : Math.round((filledTotal / requiredTotal) * 100);

  return {
    complete: missing.length === 0,
    percent: Math.min(100, percent),
    sections,
    missing,
  };
}
