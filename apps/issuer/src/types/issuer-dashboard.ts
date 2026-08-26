import type { AdditionalFeeCharge, Contract, Invoice } from "@cashsouk/types";

export type IssuerDashboardNote = {
  id: string;
  noteReference: string;
  noteStatus: string;
  listingStatus: string | null;
  noteListingStatus: string | null;
  fundingStatus: string;
  servicingStatus: string;
  targetAmount: string;
  fundedAmount: string;
  fundingProgressPercent: number | null;
  minimumFundingPercent: string;
  fundingDeadline: string | null;
  maturityDate: string | null;
  tenureDays?: number | null;
  marketplaceStatusLabel: string | null;
  investorCount: number;
  disbursementBreakdown: {
    grossFundedAmount: string | null;
    platformFeeAmount: string | null;
    facilityFeeCharged: string | null;
    netIssuerDisbursement: string | null;
    additionalFees?: AdditionalFeeCharge[] | null;
    facilityFeeCollectionWaived?: boolean;
  } | null;
};

export type IssuerDashboardInvoice = {
  id: string;
  displayReference: string | null;
  applicationId: string;
  productId: string;
  productName: string | null;
  contractId: string | null;
  invoiceForModal: unknown;
  invoiceStatus: string;
  invoiceNumber: string;
  customerName: string | null;
  invoiceValue: string | null;
  financingAmount: string | null;
  submissionDate: string | null;
  note: IssuerDashboardNote | null;
  /** Application IDs that require action (AMENDMENT_REQUESTED). Usually 0 or 1 for invoice rows. */
  actionRequiredApplicationIds: string[];
};

export type IssuerDashboardContract = {
  id: string;
  displayReference: string | null;
  applicationId: string;
  productId: string;
  contractForModal: unknown;
  title: string | null;
  productName: string | null;
  customerName: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  approvedFacilityAmount: string | null;
  utilizedFacilityAmount: string | null;
  availableFacilityAmount: string | null;
  pendingFacilityAmount?: string | null;
  repaidFacilityAmount?: string | null;
  lifetimeCapAmount?: string | null;
  lifetimeUsedAmount?: string | null;
  lifetimeRemainingAmount?: string | null;
  contractValueAmount?: string | null;
  facilityFeeCapAmount: string | null;
  facilityFeePaidAmount: string | null;
  facilityFeeRemainingAmount: string | null;
  facilityFeeUpfrontAmount?: number | null;
  facilityFeeUpfrontOutstanding?: number | null;
  facilityFeeWaived?: boolean;
  facilityEnabled?: boolean;
  facilityDisabledReason?: string | null;
  activeNotesCount: number;
  contractStatus: string;
  /** Application IDs in AMENDMENT_REQUESTED that share this contract. Invoice-only changes do not hide an approved facility. */
  actionRequiredApplicationIds: string[];
  invoiceStats: {
    total: number;
    approved: number;
    rejected: number;
    unfinanced: number;
    fundingInProgress: number;
    activeNotes: number;
    completedNotes: number;
    unsuccessfulRaise: number;
    disputedNotes: number | null;
  };
};

export type IssuerDashboardData = {
  user: { displayName: string | null };
  overview: {
    successRatePercent: number | null;
    activeFinancingAmount: string | null;
    pastFinancingAmount: string | null;
    activeNotesCount: number;
    completedNotesCount: number;
  };
  repaymentPerformance: {
    onTimePercent: number | null;
    pastDueCount: number | null;
    lateRepaymentsLastSixMonthsCount: number | null;
  };
  contracts: IssuerDashboardContract[];
  invoices: IssuerDashboardInvoice[];
};

export function asContractForModal(value: unknown): Contract {
  return value as Contract;
}

export function asInvoiceForModal(value: unknown): Invoice {
  return value as Invoice;
}
