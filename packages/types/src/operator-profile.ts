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
