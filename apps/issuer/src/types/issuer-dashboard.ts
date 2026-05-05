import type { Contract, Invoice } from "@cashsouk/types";

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
  marketplaceStatusLabel: string | null;
};

export type IssuerDashboardInvoice = {
  id: string;
  applicationId: string;
  productId: string;
  contractId: string | null;
  invoiceForModal: unknown;
  invoiceStatus: string;
  invoiceNumber: string;
  customerName: string | null;
  invoiceValue: string | null;
  financingAmount: string | null;
  submissionDate: string | null;
  note: IssuerDashboardNote | null;
};

export type IssuerDashboardContract = {
  id: string;
  applicationId: string;
  productId: string;
  contractForModal: unknown;
  title: string;
  productName: string | null;
  customerName: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  approvedFacilityAmount: string | null;
  utilizedFacilityAmount: string | null;
  availableFacilityAmount: string | null;
  activeNotesCount: number;
  contractStatus: string;
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
    activeNotesCount: number;
    completedNotesCount: number;
  };
  repaymentPerformance: {
    onTimePercent: number | null;
    pastDueDays: number | null;
    averageLateDays: number | null;
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
