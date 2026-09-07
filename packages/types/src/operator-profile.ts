import type {
  OperatorAdvisorType,
  OperatorHolderType,
  OrganizationPartyEntityType,
  ScCompanyType,
  ScDesignation,
  ScPersonKind,
  ScShareType,
} from "./comrep-profile";
import {
  validateOperatorAdvisor,
  validateOperatorFinancialStatement,
  validateOperatorGeneral,
  validateOperatorInterest,
  validateOperatorOfficer,
  validateOperatorShareCapital,
  validateOperatorShareholder,
} from "./comrep-requiredness";

export interface OperatorProfileDto {
  id: string;
  singletonKey: string;
  name: string | null;
  registrationNumber: string | null;
  trusteeRegistrationNumber: string | null;
  /** SC Type of Company values used to choose the [02000] Sdn Bhd vs LLP share-capital block. */
  scCompanyType: ScCompanyType | null;
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
  interests: "Interest in Other Company",
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

/**
 * SC [02000] Summary of Share Capital is two explicit blocks:
 * Ordinary/Preference/Others/Total paid up capital (for Sdn Bhd), and
 * Limited liability partnership. Other Type of Company values are not mapped.
 */
export function operatorShareCapitalKind(
  scCompanyType: ScCompanyType | null | undefined
): "SDN_BHD" | "LLP" | null {
  if (scCompanyType === "PRIVATE_LIMITED") return "SDN_BHD";
  if (scCompanyType === "LLP") return "LLP";
  return null;
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

function issuesToOperatorMissing(
  section: OperatorProfileSectionId,
  issues: Array<{ field: string; label: string }>,
  prefix?: string
): OperatorProfileMissingItem[] {
  return issues.map((issue) => ({
    section,
    field: prefix ? `${prefix}.${issue.field}` : issue.field,
    label: issue.label,
  }));
}

export function buildOperatorProfileCompleteness(
  profile: OperatorProfileDto
): OperatorProfileCompleteness {
  const generalMissing = issuesToOperatorMissing(
    "general",
    validateOperatorGeneral({
      name: profile.name,
      registrationNumber: profile.registrationNumber,
      scCompanyType: profile.scCompanyType,
      responsiblePersonName: profile.responsiblePersonName,
      responsiblePersonPhone: profile.responsiblePersonPhone,
    })
  );

  const capitalKind = operatorShareCapitalKind(profile.scCompanyType);
  const capitalIssues =
    capitalKind && profile.shareCapital
      ? validateOperatorShareCapital({ ...profile.shareCapital }, capitalKind)
      : capitalKind
        ? validateOperatorShareCapital({}, capitalKind)
        : [];
  const capitalMissing = issuesToOperatorMissing("shareCapital", capitalIssues);
  const capitalRequired =
    capitalKind === "SDN_BHD" ? 7 : capitalKind === "LLP" ? 5 : 0;

  const shareholderMissing: OperatorProfileMissingItem[] = [];
  let shareholderRequired = 0;
  if (profile.shareholders.length === 0) {
    shareholderMissing.push({
      section: "shareholders",
      field: "shareholders",
      label: "At least one shareholder, member, or beneficial owner",
    });
    shareholderRequired = 1;
  } else {
    for (const row of profile.shareholders) {
      const issues = validateOperatorShareholder(row);
      shareholderMissing.push(
        ...issuesToOperatorMissing("shareholders", issues, `shareholders.${row.id}`)
      );
      shareholderRequired += validateOperatorShareholder({
        entityType: row.entityType,
        holderType: row.holderType,
        shareType: row.shareType === "OTHERS" ? "OTHERS" : undefined,
      }).length;
    }
  }

  const officerMissing: OperatorProfileMissingItem[] = [];
  let officerRequired = 0;
  if (profile.officers.length === 0) {
    officerMissing.push({
      section: "officers",
      field: "officers",
      label: "At least one board or management person",
    });
    officerRequired = 1;
  } else {
    for (const row of profile.officers) {
      const issues = validateOperatorOfficer(row);
      officerMissing.push(...issuesToOperatorMissing("officers", issues, `officers.${row.id}`));
      officerRequired += validateOperatorOfficer({
        personKind: row.personKind,
        designation: row.designation === "OTHERS" ? "OTHERS" : undefined,
      }).length;
    }
    if (!profile.officers.some((row) => row.isResponsiblePerson)) {
      officerMissing.push({
        section: "officers",
        field: "responsiblePerson",
        label: "Responsible Person",
      });
      officerRequired += 1;
    } else {
      officerRequired += 1;
    }
  }

  const advisorMissing: OperatorProfileMissingItem[] = [];
  let advisorRequired = 0;
  for (const row of profile.advisors) {
    const issues = validateOperatorAdvisor(row);
    advisorMissing.push(...issuesToOperatorMissing("advisors", issues, `advisors.${row.id}`));
    advisorRequired += validateOperatorAdvisor({ advisorType: row.advisorType }).length;
  }

  const interestMissing: OperatorProfileMissingItem[] = [];
  let interestRequired = 0;
  for (const row of profile.interests) {
    const issues = validateOperatorInterest(row);
    interestMissing.push(...issuesToOperatorMissing("interests", issues, `interests.${row.id}`));
    interestRequired += validateOperatorInterest({
      shareType: row.shareType === "OTHERS" ? "OTHERS" : undefined,
    }).length;
  }

  const financialMissing: OperatorProfileMissingItem[] = [];
  let financialRequired = 0;
  if (profile.financialStatements.length === 0) {
    financialMissing.push({
      section: "financials",
      field: "financialStatements",
      label: "At least one financial statement",
    });
    financialRequired = 1;
  } else {
    for (const row of profile.financialStatements) {
      const issues = validateOperatorFinancialStatement(row as unknown as Record<string, unknown>);
      financialMissing.push(
        ...issuesToOperatorMissing("financials", issues, `financialStatements.${row.id}`)
      );
      financialRequired += validateOperatorFinancialStatement({}).length;
    }
  }

  const sections: OperatorProfileSectionCompleteness[] = [
    operatorSection("general", generalMissing, 5),
    {
      id: "shareCapital",
      label: OPERATOR_PROFILE_SECTION_LABELS.shareCapital,
      complete: capitalKind !== null && capitalMissing.length === 0,
      requiredCount: capitalRequired,
      filledCount: Math.max(0, capitalRequired - capitalMissing.length),
      missing: capitalMissing,
    },
    {
      id: "shareholders",
      label: OPERATOR_PROFILE_SECTION_LABELS.shareholders,
      complete: shareholderMissing.length === 0,
      requiredCount: shareholderRequired,
      filledCount: Math.max(0, shareholderRequired - shareholderMissing.length),
      missing: shareholderMissing,
    },
    {
      id: "officers",
      label: OPERATOR_PROFILE_SECTION_LABELS.officers,
      complete: officerMissing.length === 0,
      requiredCount: officerRequired,
      filledCount: Math.max(0, officerRequired - officerMissing.length),
      missing: officerMissing,
    },
    {
      id: "advisors",
      label: OPERATOR_PROFILE_SECTION_LABELS.advisors,
      complete: advisorMissing.length === 0,
      requiredCount: advisorRequired,
      filledCount: Math.max(0, advisorRequired - advisorMissing.length),
      missing: advisorMissing,
    },
    {
      id: "interests",
      label: OPERATOR_PROFILE_SECTION_LABELS.interests,
      complete: interestMissing.length === 0,
      requiredCount: interestRequired,
      filledCount: Math.max(0, interestRequired - interestMissing.length),
      missing: interestMissing,
    },
    operatorSection("financials", financialMissing, financialRequired),
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
