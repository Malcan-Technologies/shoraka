export type IssuerBookFundingProgressStatus = "pending_listing" | "open" | "funded" | "failed";

export type IssuerBookNextRepayment = {
  noteId: string;
  noteReference: string;
  amount: number;
  profit: number;
  dueDate: string;
  daysRemaining: number | null;
  paymasterName: string | null;
};

export type IssuerBookRepaymentMonth = {
  yearMonth: string;
  label: string;
  amount: number;
  count: number;
};

export type IssuerBookUpcomingRepayment = {
  noteId: string;
  noteReference: string;
  dueDate: string;
  amount: number;
  profit: number;
  paymasterName: string | null;
};

export type IssuerBookFundingProgress = {
  noteId: string;
  noteReference: string;
  tenorDays: number | null;
  daysLeft: number | null;
  fundedAmount: number;
  targetAmount: number;
  percent: number;
  status: IssuerBookFundingProgressStatus;
};

export type IssuerBookOutstandingPoint = {
  date: string;
  drawn: number;
  limit: number | null;
};

export type IssuerBookCostOfFinancingYtd = {
  year: number;
  total: number;
  profitOnNotes: number;
  drawdownFees: number;
  facilityFees: number;
  tawidh: number;
  effectivePercent: number | null;
};

export type IssuerDashboardBook = {
  outstandingAmount: number;
  liveNoteCount: number;
  nextRepayment: IssuerBookNextRepayment | null;
  availableLimit: number | null;
  approvedLimit: number | null;
  drawnAmount: number | null;
  drawnPercent: number | null;
  repaymentSchedule: IssuerBookRepaymentMonth[];
  upcomingRepayments: IssuerBookUpcomingRepayment[];
  fundingProgress: IssuerBookFundingProgress[];
  outstandingOverTime: IssuerBookOutstandingPoint[];
  costOfFinancingYtd: IssuerBookCostOfFinancingYtd;
};
