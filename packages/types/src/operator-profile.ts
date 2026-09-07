import type {
  OperatorAdvisorType,
  OperatorHolderType,
  OrganizationPartyEntityType,
  ScCompanyType,
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

function operatorHasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

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

export function buildOperatorProfileCompleteness(
  profile: OperatorProfileDto
): OperatorProfileCompleteness {
  const generalMissing: OperatorProfileMissingItem[] = [];
  if (!operatorHasText(profile.name)) {
    generalMissing.push({ section: "general", field: "name", label: "Name of RMO" });
  }
  if (!operatorHasText(profile.registrationNumber)) {
    generalMissing.push({
      section: "general",
      field: "registrationNumber",
      label: "Company Registration Number",
    });
  }
  if (!profile.scCompanyType) {
    generalMissing.push({
      section: "general",
      field: "scCompanyType",
      label: "Type of Company",
    });
  }
  if (!operatorHasText(profile.responsiblePersonName)) {
    generalMissing.push({
      section: "general",
      field: "responsiblePersonName",
      label: "Name of Responsible Person",
    });
  }
  if (!operatorHasText(profile.responsiblePersonPhone)) {
    generalMissing.push({
      section: "general",
      field: "responsiblePersonPhone",
      label: "Contact Number of Responsible Person",
    });
  }

  const capitalKind = operatorShareCapitalKind(profile.scCompanyType);
  const capitalMissing: OperatorProfileMissingItem[] = [];
  if (capitalKind === "SDN_BHD") {
    if (!operatorHasText(profile.shareCapital?.totalPaidUpCapital)) {
      capitalMissing.push({
        section: "shareCapital",
        field: "totalPaidUpCapital",
        label: "Total paid up capital (for Sdn Bhd)",
      });
    }
  } else if (capitalKind === "LLP") {
    if (!operatorHasText(profile.shareCapital?.totalLlp)) {
      capitalMissing.push({
        section: "shareCapital",
        field: "totalLlp",
        label: "Total Limited Liability Partnership",
      });
    }
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
      if (!operatorHasText(row.identityNumber)) {
        shareholderMissing.push({
          section: "shareholders",
          field: `shareholders.${row.id}.identityNumber`,
          label: "Holder identity number",
        });
      }
    }
  }
  const shareholderRequired =
    profile.shareholders.length === 0 ? 1 : profile.shareholders.length * 2;

  const officerMissing: OperatorProfileMissingItem[] = [];
  if (profile.officers.length === 0) {
    officerMissing.push({
      section: "officers",
      field: "officers",
      label: "At least one board or management person",
    });
  } else {
    for (const row of profile.officers) {
      if (!operatorHasText(row.name)) {
        officerMissing.push({
          section: "officers",
          field: `officers.${row.id}.name`,
          label: "Officer name",
        });
      }
      if (!operatorHasText(row.identityNumber)) {
        officerMissing.push({
          section: "officers",
          field: `officers.${row.id}.identityNumber`,
          label: "Officer identity number",
        });
      }
    }
    if (!profile.officers.some((row) => row.isResponsiblePerson)) {
      officerMissing.push({
        section: "officers",
        field: "responsiblePerson",
        label: "Responsible person on board / management",
      });
    }
  }
  const officerRequired = profile.officers.length === 0 ? 1 : profile.officers.length * 2 + 1;

  const advisorMissing: OperatorProfileMissingItem[] = [];
  for (const row of profile.advisors) {
    if (!operatorHasText(row.name)) {
      advisorMissing.push({
        section: "advisors",
        field: `advisors.${row.id}.name`,
        label: "Advisor name",
      });
    }
  }

  const interestMissing: OperatorProfileMissingItem[] = [];
  for (const row of profile.interests) {
    if (!operatorHasText(row.name)) {
      interestMissing.push({
        section: "interests",
        field: `interests.${row.id}.name`,
        label: "Company name",
      });
    }
  }

  const financialMissing: OperatorProfileMissingItem[] = [];
  if (profile.financialStatements.length === 0) {
    financialMissing.push({
      section: "financials",
      field: "financialStatements",
      label: "At least one financial statement",
    });
  } else {
    for (const row of profile.financialStatements) {
      if (!operatorHasText(row.financialYearEnd)) {
        financialMissing.push({
          section: "financials",
          field: `financialStatements.${row.id}.financialYearEnd`,
          label: "Financial year end",
        });
      }
      if (!operatorHasText(row.totalAssets)) {
        financialMissing.push({
          section: "financials",
          field: `financialStatements.${row.id}.totalAssets`,
          label: "Total assets",
        });
      }
      if (!operatorHasText(row.totalRevenue)) {
        financialMissing.push({
          section: "financials",
          field: `financialStatements.${row.id}.totalRevenue`,
          label: "Total revenue",
        });
      }
      if (!operatorHasText(row.profitBeforeTax)) {
        financialMissing.push({
          section: "financials",
          field: `financialStatements.${row.id}.profitBeforeTax`,
          label: "Profit before tax",
        });
      }
    }
  }
  const financialRequired = profile.financialStatements.length === 0 ? 1 : profile.financialStatements.length * 4;

  const capitalRequired = capitalKind === "SDN_BHD" || capitalKind === "LLP" ? 1 : 0;
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
      requiredCount: advisorMissing.length > 0 ? advisorMissing.length : 0,
      filledCount: 0,
      missing: advisorMissing,
    },
    {
      id: "interests",
      label: OPERATOR_PROFILE_SECTION_LABELS.interests,
      complete: interestMissing.length === 0,
      requiredCount: interestMissing.length > 0 ? interestMissing.length : 0,
      filledCount: 0,
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
