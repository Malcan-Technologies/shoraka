import type { SoukscoreRiskRating } from "./invoice-offer-risk-rating";

export enum NoteStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  FUNDING = "FUNDING",
  ACTIVE = "ACTIVE",
  REPAID = "REPAID",
  ARREARS = "ARREARS",
  DEFAULTED = "DEFAULTED",
  FAILED_FUNDING = "FAILED_FUNDING",
  CANCELLED = "CANCELLED",
}

export enum NoteListingStatus {
  NOT_LISTED = "NOT_LISTED",
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  UNPUBLISHED = "UNPUBLISHED",
  CLOSED = "CLOSED",
}

export enum NoteFundingStatus {
  NOT_OPEN = "NOT_OPEN",
  OPEN = "OPEN",
  FUNDED = "FUNDED",
  FAILED = "FAILED",
  CLOSED = "CLOSED",
}

export enum NoteServicingStatus {
  NOT_STARTED = "NOT_STARTED",
  CURRENT = "CURRENT",
  PARTIAL = "PARTIAL",
  ADVANCE_PAID = "ADVANCE_PAID",
  LATE = "LATE",
  ARREARS = "ARREARS",
  DEFAULTED = "DEFAULTED",
  SETTLED = "SETTLED",
}

export enum NoteInvestmentStatus {
  COMMITTED = "COMMITTED",
  CONFIRMED = "CONFIRMED",
  RELEASED = "RELEASED",
  CANCELLED = "CANCELLED",
  SETTLED = "SETTLED",
}

export enum NotePaymentSource {
  PAYMASTER = "PAYMASTER",
  ISSUER_ON_BEHALF = "ISSUER_ON_BEHALF",
  ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT",
}

export enum NotePaymentStatus {
  PENDING = "PENDING",
  PARTIAL = "PARTIAL",
  RECEIVED = "RECEIVED",
  RECONCILED = "RECONCILED",
  SETTLED = "SETTLED",
  VOID = "VOID",
}

export enum NoteSettlementStatus {
  PREVIEW = "PREVIEW",
  APPROVED = "APPROVED",
  POSTED = "POSTED",
  VOID = "VOID",
}

export enum NoteSettlementType {
  STANDARD = "STANDARD",
  PARTIAL = "PARTIAL",
  ADVANCE = "ADVANCE",
  LATE = "LATE",
  DEFAULT_RECOVERY = "DEFAULT_RECOVERY",
}

export enum NoteLedgerAccountType {
  INVESTOR_POOL = "INVESTOR_POOL",
  REPAYMENT_POOL = "REPAYMENT_POOL",
  OPERATING_ACCOUNT = "OPERATING_ACCOUNT",
  TAWIDH_ACCOUNT = "TAWIDH_ACCOUNT",
  GHARAMAH_ACCOUNT = "GHARAMAH_ACCOUNT",
}

export enum NoteLedgerDirection {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
}

export enum WithdrawalStatus {
  DRAFT = "DRAFT",
  LETTER_GENERATED = "LETTER_GENERATED",
  SUBMITTED_TO_TRUSTEE = "SUBMITTED_TO_TRUSTEE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum WithdrawalType {
  INVESTOR_WITHDRAWAL = "INVESTOR_WITHDRAWAL",
  ISSUER_RESIDUAL_RETURN = "ISSUER_RESIDUAL_RETURN",
  ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT",
}

export interface NoteMoneySummary {
  requestedAmount: number;
  invoiceAmount: number;
  settlementAmount: number;
  targetAmount: number;
  fundedAmount: number;
  fundingPercent: number;
  minimumFundingPercent: number;
  profitRatePercent: number | null;
  platformFeeRatePercent: number;
  serviceFeeRatePercent: number;
}

export interface NoteSettlementPoolSummary {
  settlementId: string;
  status: NoteSettlementStatus;
  grossReceiptAmount: number;
  investorPoolAmount: number;
  operatingAccountAmount: number;
  tawidhAccountAmount: number;
  gharamahAccountAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
  postedAt: string | null;
}

export interface NoteListItem extends NoteMoneySummary {
  id: string;
  noteReference: string;
  title: string;
  sourceApplicationId: string;
  sourceContractId: string | null;
  sourceInvoiceId: string | null;
  issuerOrganizationId: string;
  issuerName: string | null;
  paymasterName: string | null;
  riskRating: SoukscoreRiskRating | null;
  status: NoteStatus;
  listingStatus: NoteListingStatus;
  fundingStatus: NoteFundingStatus;
  servicingStatus: NoteServicingStatus;
  maturityDate: string | null;
  publishedAt: string | null;
  settlementSummary: NoteSettlementPoolSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends NoteListItem {
  productSnapshot: Record<string, unknown> | null;
  issuerSnapshot: Record<string, unknown>;
  paymasterSnapshot: Record<string, unknown> | null;
  contractSnapshot: Record<string, unknown> | null;
  invoiceSnapshot: Record<string, unknown> | null;
  serviceFeeCustomerScope: string | null;
  gracePeriodDays: number;
  arrearsThresholdDays: number;
  tawidhRateCapPercent: number;
  gharamahRateCapPercent: number;
  defaultMarkedAt: string | null;
  defaultReason: string | null;
  listing: NoteListing | null;
  investments: NoteInvestment[];
  paymentSchedules: NotePaymentSchedule[];
  payments: NotePayment[];
  settlements: NoteSettlement[];
  events: NoteEvent[];
}

export interface NoteListing {
  id: string;
  noteId: string;
  status: NoteListingStatus;
  opensAt: string | null;
  closesAt: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  visibility: string;
  summary: string | null;
  riskDisclosure: Record<string, unknown> | null;
}

export interface NoteInvestment {
  id: string;
  noteId: string;
  investorOrganizationId: string;
  investorUserId: string;
  status: NoteInvestmentStatus;
  amount: number;
  allocationPercent: number;
  committedAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
}

export interface NotePaymentSchedule {
  id: string;
  noteId: string;
  status: NotePaymentStatus;
  sequence: number;
  dueDate: string;
  expectedPrincipal: number;
  expectedProfit: number;
  expectedTotal: number;
  paidPrincipal: number;
  paidProfit: number;
  paidTotal: number;
}

export interface NotePayment {
  id: string;
  noteId: string;
  scheduleId: string | null;
  source: NotePaymentSource;
  status: NotePaymentStatus;
  receiptAmount: number;
  receiptDate: string;
  receivedIntoAccountCode: string;
  evidenceS3Key: string | null;
  reference: string | null;
  recordedByUserId: string | null;
  reconciledByUserId: string | null;
  reconciledAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface NoteSettlement {
  id: string;
  noteId: string;
  paymentId: string | null;
  status: NoteSettlementStatus;
  settlementType: NoteSettlementType;
  grossReceiptAmount: number;
  investorPrincipal: number;
  investorProfitGross: number;
  serviceFeeAmount: number;
  investorProfitNet: number;
  tawidhAmount: number;
  gharamahAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
  previewSnapshot: Record<string, unknown>;
  approvedAt: string | null;
  postedAt: string | null;
}

export interface NoteEvent {
  id: string;
  noteId: string;
  eventType: string;
  actorUserId: string | null;
  actorRole: string | null;
  portal: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NoteLedgerEntry {
  id: string;
  noteId: string | null;
  accountCode: string;
  accountName: string;
  direction: NoteLedgerDirection;
  amount: number;
  currency: string;
  description: string;
  idempotencyKey: string;
  postedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface NoteLedgerBucketBalance {
  accountCode: NoteLedgerAccountType;
  accountName: string;
  accountType: NoteLedgerAccountType;
  currency: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
  entryCount: number;
  lastPostedAt: string | null;
}

export interface NoteLedgerBucketBalancesResponse {
  buckets: NoteLedgerBucketBalance[];
  totals: {
    debitTotal: number;
    creditTotal: number;
    balance: number;
  };
  generatedAt: string;
}

export interface NoteActionRequiredCountResponse {
  count: number;
  breakdown: {
    readyInvoices: number;
    draftNotes: number;
    fundingReady: number;
    activationReady: number;
    pendingIssuerPayments: number;
  };
}

export interface PlatformFinanceSetting {
  id: string;
  key: string;
  gracePeriodDays: number;
  arrearsThresholdDays: number;
  tawidhRateCapPercent: number;
  gharamahRateCapPercent: number;
  defaultTawidhRatePercent: number;
  defaultGharamahRatePercent: number;
  withdrawalLetterTemplate: string;
  arrearsLetterTemplate: string;
  defaultLetterTemplate: string;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface WithdrawalInstruction {
  id: string;
  noteId: string | null;
  investorOrganizationId: string | null;
  issuerOrganizationId: string | null;
  requestedByUserId: string;
  submittedByUserId: string | null;
  status: WithdrawalStatus;
  withdrawalType: WithdrawalType;
  amount: number;
  currency: string;
  beneficiarySnapshot: Record<string, unknown>;
  letterS3Key: string | null;
  generatedAt: string | null;
  submittedToTrusteeAt: string | null;
  createdAt: string;
}

export interface GetAdminNotesParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: NoteStatus;
  listingStatus?: NoteListingStatus;
  fundingStatus?: NoteFundingStatus;
  servicingStatus?: NoteServicingStatus;
  issuerOrganizationId?: string;
  paymaster?: string;
}

export interface NotesResponse {
  notes: NoteListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface EligibleNoteInvoice {
  invoiceId: string;
  applicationId: string;
  contractId: string | null;
  issuerOrganizationId: string;
  issuerName: string | null;
  paymasterName: string | null;
  invoiceNumber: string | null;
  invoiceAmount: number;
  offeredAmount: number | null;
  profitRatePercent: number | null;
  riskRating: SoukscoreRiskRating | null;
  maturityDate: string | null;
  invoiceStatus: string;
  applicationStatus: string;
  noteId: string | null;
  noteReference: string | null;
  noteStatus: NoteStatus | null;
}

export interface EligibleNoteInvoicesResponse {
  invoices: EligibleNoteInvoice[];
}

export interface CreateNoteFromApplicationInput {
  sourceInvoiceId?: string | null;
  title?: string;
}

export interface UpdateNoteDraftInput {
  title?: string;
  targetAmount?: number;
  maturityDate?: string | null;
  platformFeeRatePercent?: number;
  serviceFeeRatePercent?: number;
  serviceFeeCustomerScope?: string | null;
  profitRatePercent?: number | null;
  summary?: string | null;
}

export interface CreateNoteInvestmentInput {
  amount: number;
  investorOrganizationId: string;
}

export interface RecordNotePaymentInput {
  source: NotePaymentSource;
  receiptAmount: number;
  receiptDate: string;
  reference?: string | null;
  evidenceS3Key?: string | null;
  scheduleId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SettlementPreviewInput {
  paymentId?: string | null;
  receiptAmount?: number;
  receiptDate?: string;
  tawidhAmount?: number;
  gharamahAmount?: number;
}

export interface OverdueLateChargeInput {
  receiptAmount?: number;
  receiptDate?: string;
}

export interface OverdueLateChargeResult {
  overdue: boolean;
  dueDate: string | null;
  checkDate: string;
  gracePeriodDays: number;
  daysLate: number;
  receiptAmount: number;
  totalTawidhCap: number;
  totalGharamahCap: number;
  appliedTawidhAmount: number;
  appliedGharamahAmount: number;
  remainingTawidhAmount: number;
  remainingGharamahAmount: number;
  suggestedTawidhAmount: number;
  suggestedGharamahAmount: number;
  message: string;
}

