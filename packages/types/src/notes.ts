import type { SoukscoreRiskRating } from "./invoice-offer-risk-rating";

/** Display label for a stored note reference (e.g. NOTE-20260512-ABC → Note 20260512-ABC). */
export function formatNoteReferenceDisplay(reference: string | null | undefined): string {
  const trimmed = (reference ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("NOTE-") ? `Note ${trimmed.slice("NOTE-".length)}` : trimmed;
}

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

export enum ServiceFeeTrusteeInstructionStatus {
  PENDING_LETTER = "PENDING_LETTER",
  LETTER_GENERATED = "LETTER_GENERATED",
  SUBMITTED_TO_TRUSTEE = "SUBMITTED_TO_TRUSTEE",
  COMPLETED = "COMPLETED",
}

export enum NoteLedgerAccountType {
  INVESTOR_POOL = "INVESTOR_POOL",
  REPAYMENT_POOL = "REPAYMENT_POOL",
  OPERATING_ACCOUNT = "OPERATING_ACCOUNT",
  TAWIDH_ACCOUNT = "TAWIDH_ACCOUNT",
  GHARAMAH_ACCOUNT = "GHARAMAH_ACCOUNT",
  ISSUER_PAYABLE = "ISSUER_PAYABLE",
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
  ISSUER_DISBURSEMENT = "ISSUER_DISBURSEMENT",
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
  totalTawidhAmount: number;
  tawidhInvestorSharePercent: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  gharamahAccountAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
  profitStartDate: string | null;
  profitMaturityDate: string | null;
  profitDays: number;
  annualProfitRatePercent: number;
  postedAt: string | null;
  /** Posted settlement with platform service fee: trustee instruction workflow (pools). */
  serviceFeeTrusteeStatus: ServiceFeeTrusteeInstructionStatus | null;
  serviceFeeTrusteeSubmittedAt: string | null;
  serviceFeeTrusteeCompletedAt: string | null;
}

/** Issuer portal: derived residual payout state for a note with `settlementSummary`. */
export type IssuerResidualPayoutListStatus =
  | { kind: "none" }
  | { kind: "paid" }
  | { kind: "pending"; withTrustee: boolean }
  | { kind: "awaiting" };

export interface NoteInvestorSettlementEvent {
  settlementId: string;
  postedAt: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
}

export interface NoteInvestorRepaymentSummary {
  investedPrincipal: number;
  expectedPayoutAmount: number;
  /** Net profit after service fee on gross contractual profit. */
  expectedProfitAmount: number;
  expectedProfitGrossAmount: number;
  expectedServiceFeeAmount: number;
  profitDays: number;
  profitStartDate: string | null;
  profitMaturityDate: string | null;
  receivedPayoutAmount: number;
  receivedProfitNetAmount: number;
  receivedProfitGrossAmount: number;
  receivedServiceFeeAmount: number;
  receivedTawidhCompensationAmount: number;
  expectedReturnRatePercent: number;
  actualReturnRatePercent: number | null;
  progressPercent: number;
  receivedSettlementEvents: NoteInvestorSettlementEvent[];
}

export interface NoteListItem extends NoteMoneySummary {
  id: string;
  noteReference: string;
  title: string;
  productCategory: string | null;
  /** Display name from product workflow / snapshot; preferred for marketplace card title. */
  productName: string | null;
  issuerIndustry: string | null;
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
  isFeatured: boolean;
  featuredRank: number | null;
  featuredFrom: string | null;
  featuredUntil: string | null;
  featuredActive: boolean;
  maturityDate: string | null;
  /** Marketplace listing close time (`note_listings.closes_at`); used for funding-window countdown. */
  listingClosesAt: string | null;
  activatedAt: string | null;
  publishedAt: string | null;
  settlementSummary: NoteSettlementPoolSummary | null;
  /** Issuer portal list: residual trustee payout vs `settlementSummary` (omitted elsewhere). */
  issuerResidualPayout?: IssuerResidualPayoutListStatus;
  investorRepaymentSummary?: NoteInvestorRepaymentSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends NoteListItem {
  productSnapshot: Record<string, unknown> | null;
  issuerSnapshot: Record<string, unknown>;
  paymasterSnapshot: Record<string, unknown> | null;
  contractSnapshot: Record<string, unknown> | null;
  invoiceSnapshot: Record<string, unknown> | null;
  /** Live source-invoice offer signing (active + archived); not frozen in invoice_snapshot */
  sourceInvoiceOfferSigning?: import("./offer-signing").OfferSigningAdminView | null;
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
  withdrawals: WithdrawalInstruction[];
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

export interface MarketplaceNoteListing {
  id: string;
  noteId: string;
  status: NoteListingStatus;
  opensAt: string | null;
  closesAt: string | null;
  publishedAt: string | null;
  visibility: string;
  summary: string | null;
  riskDisclosure: Record<string, unknown> | null;
}

export interface MarketplaceNoteDetail extends NoteListItem {
  listing: MarketplaceNoteListing | null;
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
  profitStartDate: string | null;
  profitMaturityDate: string | null;
  profitDays: number;
  annualProfitRatePercent: number;
  investorProfitGross: number;
  serviceFeeAmount: number;
  investorProfitNet: number;
  tawidhAmount: number;
  tawidhInvestorSharePercent: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
  previewSnapshot: Record<string, unknown>;
  approvedAt: string | null;
  postedAt: string | null;
  serviceFeeTrusteeStatus: ServiceFeeTrusteeInstructionStatus | null;
  serviceFeeTrusteeSubmittedAt: string | null;
  serviceFeeTrusteeCompletedAt: string | null;
}

export interface NoteSettlementAllocationPreview {
  investmentId: string;
  investorOrganizationId: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
}

export interface NoteSettlementPreviewResult {
  settlementId: string;
  grossReceiptAmount: number;
  investorPrincipal: number;
  profitStartDate: string;
  profitMaturityDate: string;
  profitDays: number;
  annualProfitRatePercent: number;
  investorProfitGross: number;
  serviceFeeAmount: number;
  investorProfitNet: number;
  tawidhAmount: number;
  tawidhInvestorSharePercent: number;
  tawidhInvestorAmount: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  investorPoolTotal: number;
  availableLateFeeHeadroomAmount: number;
  settlementShortfallAmount: number;
  issuerResidualAmount: number;
  unappliedAmount: number;
  includedPaymentIds: string[];
  allocations: NoteSettlementAllocationPreview[];
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

export interface NoteLedgerBucketActivityEntry extends NoteLedgerEntry {
  noteReference: string | null;
  noteTitle: string | null;
}

export interface NoteLedgerBucketActivityResponse {
  bucket: NoteLedgerBucketBalance;
  entries: NoteLedgerBucketActivityEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  generatedAt: string;
}

export interface NoteActionRequiredCountResponse {
  count: number;
  breakdown: {
    readyInvoices: number;
    draftNotes: number;
    fundingReady: number;
  };
}

export interface AdminInvestmentItem {
  id: string;
  noteId: string;
  noteTitle: string | null;
  noteReference: string | null;
  noteStatus: NoteStatus | string | null;
  noteFundingStatus: NoteFundingStatus | string | null;
  noteTargetAmount: number | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  investorOrganizationId: string;
  investorOrganizationName: string | null;
  investorUserId: string;
  investorUserName: string | null;
  investorUserEmail: string | null;
  status: NoteInvestmentStatus;
  amount: number;
  allocationPercent: number;
  currency: string;
  committedAt: string | null;
  confirmedAt: string | null;
  releasedAt: string | null;
}

export interface AdminInvestmentsPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface GetAdminInvestmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: NoteInvestmentStatus;
  noteId?: string;
  investorOrganizationId?: string;
}

export interface GetAdminInvestmentsResponse {
  items: AdminInvestmentItem[];
  pagination: AdminInvestmentsPagination;
}

export type PendingRepaymentAction = "REVIEW" | "AWAIT_REMAINDER" | "POST_SETTLEMENT";

export interface PendingRepaymentItem {
  paymentId: string;
  noteId: string;
  noteTitle: string | null;
  noteStatus: string | null;
  amount: number;
  currency: string;
  receivedAt: string | null;
  reference: string | null;
  source: string;
  status: string;
  actionNeeded: PendingRepaymentAction;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  createdAt: string;
}

export interface PendingRepaymentsResponse {
  count: number;
  items: PendingRepaymentItem[];
}

export interface PendingIssuerPayoutItem {
  withdrawalId: string;
  settlementId: string | null;
  noteId: string;
  noteTitle: string | null;
  noteStatus: string | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  rowSource: "WITHDRAWAL" | "SETTLEMENT_RESIDUAL";
  withdrawalType: string;
  amount: number;
  currency: string;
  status: string;
  generatedAt: string | null;
  submittedToTrusteeAt: string | null;
  createdAt: string;
}

export interface PendingIssuerPayoutsResponse {
  count: number;
  items: PendingIssuerPayoutItem[];
}

/** Posted settlements with trustee movements where the settlement trustee instruction is not fully completed. */
export interface PendingServiceFeeTrusteeLetterItem {
  settlementId: string;
  noteId: string;
  noteTitle: string | null;
  noteStatus: string | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  /** Total settlement trustee instruction amount across all instruction rows. */
  serviceFeeAmount: number;
  currency: string;
  settlementPostedAt: string | null;
  trusteeInstructionStatus: ServiceFeeTrusteeInstructionStatus | null;
  submittedToTrusteeAt: string | null;
  instructionCompletedAt: string | null;
}

export interface PendingServiceFeeTrusteeLettersResponse {
  count: number;
  items: PendingServiceFeeTrusteeLetterItem[];
}

export interface PendingInvestorWithdrawalsCountResponse {
  count: number;
}

export interface PlatformFinanceSetting {
  id: string;
  key: string;
  gracePeriodDays: number;
  arrearsThresholdDays: number;
  tawidhRateCapPercent: number;
  gharamahRateCapPercent: number;
  platformFeeRateCapPercent: number;
  defaultTawidhRatePercent: number;
  defaultGharamahRatePercent: number;
  withdrawalLetterTemplate: string;
  arrearsLetterTemplate: string;
  defaultLetterTemplate: string;
  issuerOnboardingFeeAmount: number;
  applicationProcessingFeeAmount: number;
  investorMinDepositAmount: number;
  investorMaxDepositAmount: number;
  trusteeLetterConfig: TrusteeLetterConfig | null;
  platformAccountsConfig: PlatformAccountsConfig | null;
  ledgerBucketAccountsConfig: LedgerBucketAccountsConfig | null;
  updatedByUserId: string | null;
  updatedAt: string;
}

export interface TrusteeAccountDetails {
  displayName: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  remarks: string;
}

export interface TrusteeLetterConfig {
  trusteeName: string;
  trusteeAddressLine1: string;
  trusteeAddressLine2: string;
  trusteeAddressLine3?: string;
  attentionPerson: string;
  defaultContactPerson: string;
  authorisedSignatoryLabel: string;
  authorisedSignatureImageKey?: string;
  authorisedSignatureImageUrl?: string;
  authorisedSignatureImageFileName?: string;
  authorisedSignatureImageContentType?: string;
  platformDisplayName: string;
  /** @deprecated Global value-date default is no longer used by trustee PDF generation. */
  defaultValueDateBehavior?: string;
  /** @deprecated Global reference prefix is no longer used by trustee PDF generation. */
  defaultLetterRefPrefix?: string;
}

export interface TrusteeSignatureUploadUrlRequest {
  fileName: string;
  contentType: "image/png" | "image/jpeg" | "image/jpg" | "image/webp";
  fileSize: number;
}

export interface TrusteeSignatureUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface PlatformAccountsConfig {
  platformOperating: TrusteeAccountDetails;
  serviceFee: TrusteeAccountDetails;
  platformFee: TrusteeAccountDetails;
  facilityFee: TrusteeAccountDetails;
}

export interface LedgerBucketAccountsConfig {
  INVESTOR_POOL: TrusteeAccountDetails;
  REPAYMENT_POOL: TrusteeAccountDetails;
  OPERATING_ACCOUNT: TrusteeAccountDetails;
  ISSUER_PAYABLE: TrusteeAccountDetails;
  TAWIDH_ACCOUNT: TrusteeAccountDetails;
  GHARAMAH_ACCOUNT: TrusteeAccountDetails;
}

export interface InvestorWithdrawalListItem {
  withdrawalId: string;
  investorOrganizationId: string | null;
  investorOrganizationName: string | null;
  requestedByUserId: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  beneficiarySnapshot: Record<string, unknown>;
  letterS3Key: string | null;
  generatedAt: string | null;
  submittedToTrusteeAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface InvestorWithdrawalsResponse {
  count: number;
  items: InvestorWithdrawalListItem[];
}

export interface WithdrawalInstruction {
  id: string;
  noteId: string | null;
  settlementId: string | null;
  investorOrganizationId: string | null;
  issuerOrganizationId: string | null;
  requestedByUserId: string;
  submittedByUserId: string | null;
  status: WithdrawalStatus;
  withdrawalType: WithdrawalType;
  amount: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  grossFundedAmount?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  platformFeeAmount?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  facilityFeeRatePercent?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  facilityFeeCap?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  facilityFeePaidBefore?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  facilityFeeCharged?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  facilityFeeRemainingAfter?: number;
  /** Present only for some issuer disbursement withdrawals (contract financing). */
  netIssuerDisbursement?: number;
  currency: string;
  beneficiarySnapshot: Record<string, unknown>;
  letterS3Key: string | null;
  /**
   * True when the issuer disbursement has an associated Shoraka certificate stored in S3.
   * This is safe for UI gating and does not expose the raw S3 key.
   */
  hasShorakaCertificate?: boolean;
  generatedAt: string | null;
  submittedToTrusteeAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ShorakaOperationalStatus {
  providerStatus: string;
  label: string;
  nextAction: string;
  meaning: string;
  canFetchCertificate: boolean;
  hasCertificate: boolean;
  requiresManualReview: boolean;
  cutoffWarning: string | null;
}

export interface ShorakaTradeOrderParsedFields {
  orderDate: string | null;
  valueDate: string | null;
  cancelDate: string | null;
  ownershipName: string | null;
  orderAmount: string | null;
  murabahaAmount: string | null;
  certificateUrl: string | null;
  certificateDetails1: string | null;
  certificateDetails2: string | null;
  certificateDetails3: string | null;
}

export interface ShorakaTradeOrderStateTradeOrder {
  id: string;
  withdrawal_instruction_id: string;
  note_id: string;
  provider_order_id: string | null;
  status: string;
  idempotency_key: string;
  submitted_at: string | null;
  status_last_checked_at: string | null;
  callback_payload: unknown | null;
  callback_received_at: string | null;

  submit_request_payload: unknown;
  submit_response_payload: unknown;
  status_response_payload: unknown;

  certificate_s3_key: string | null;
  certificate_file_sha256: string | null;
  provider_certificate_id: string | null;
  certificate_uploaded_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface ShorakaWithdrawalState {
  tradeOrder: ShorakaTradeOrderStateTradeOrder;
  operationalStatus: ShorakaOperationalStatus;
  parsed: ShorakaTradeOrderParsedFields;
  cutoffWarning: string | null;
}

export interface ShorakaSubmitOrderStateResponse {
  tradeOrder: ShorakaTradeOrderStateTradeOrder;
  operationalStatus: ShorakaOperationalStatus;
  cutoffWarning: string | null;
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
  featuredOnly?: boolean;
  excludeRepaid?: boolean;
  /**
   * When true, omit notes only if they are repaid or servicing SETTLED, have a posted settlement,
   * and service-fee trustee is complete (no material fee or status COMPLETED). Matches the
   * default admin registry "active work" view.
   */
  excludeFullySettledRegistryNotes?: boolean;
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

export interface InvestorPortfolioResponse {
  portfolioTotal: number;
  totalInvestment: number;
  availableBalance: number;
  investmentCount: number;
}

export type InvestorPortfolioHistoryRange = "1W" | "1M" | "3M" | "6M" | "YTD" | "ALL";
export type InvestorPortfolioHistoryGranularity = "day" | "month";

export interface InvestorPortfolioHistoryPoint {
  date: string;
  availableBalance: number;
  portfolioTotal: number;
}

export interface InvestorPortfolioHistoryResponse {
  range: InvestorPortfolioHistoryRange;
  granularity: InvestorPortfolioHistoryGranularity;
  points: InvestorPortfolioHistoryPoint[];
  generatedAt: string;
}

export interface InvestorBalanceActivityEntry {
  id: string;
  investorOrganizationId: string;
  direction: "IN" | "OUT";
  amount: number;
  source: string;
  noteId: string | null;
  noteInvestmentId: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
  postedAt: string;
  createdAt: string;
}

export interface InvestorBalanceActivityResponse {
  entries: InvestorBalanceActivityEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    inTotal: number;
    outTotal: number;
    netChange: number;
    availableBalance: number;
  };
  generatedAt: string;
}

export interface ExportInvestorBalanceStatementParams {
  startDate: string;
  endDate: string;
  investorOrganizationId?: string;
  format: "csv" | "pdf";
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

export interface UpdateNoteFeaturedInput {
  isFeatured: boolean;
  featuredRank?: number | null;
  featuredFrom?: string | null;
  featuredUntil?: string | null;
}

export interface CreateNoteInvestmentInput {
  amount: number;
  investorOrganizationId: string;
}

export type GatewayPaymentStatus =
  | "CREATED"
  | "PAID"
  | "NAME_CHECK_PENDING"
  | "COMPLETED"
  | "HELD"
  | "REFUND_INITIATED"
  | "REFUNDED"
  | "FAILED"
  | "EXPIRED";

export type NameCheckResult = "PASS" | "FAIL" | "NAME_UNAVAILABLE";

export interface InvestorDepositLimits {
  minAmount: number;
  maxAmount: number;
}

export interface CreateInvestorDepositInput {
  investorOrganizationId: string;
  amount: number;
}

export interface InvestorDepositResponse {
  id: string;
  status: GatewayPaymentStatus;
  purpose: string;
  amount: number;
  currency: string;
  curlecOrderId: string;
  curlecKeyId: string;
  investorOrganizationId: string | null;
  nameCheckResult: NameCheckResult | null;
  payerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssuerOnboardingFeeInput {
  issuerOrganizationId: string;
}

export interface IssuerOnboardingFeeResponse {
  id: string;
  status: GatewayPaymentStatus;
  purpose: string;
  amount: number;
  currency: string;
  curlecOrderId: string;
  curlecKeyId: string;
  issuerOrganizationId: string | null;
  applicationId: string | null;
  nameCheckResult: NameCheckResult | null;
  payerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationProcessingFeeInput {
  applicationId: string;
}

export type ApplicationProcessingFeeResponse = IssuerOnboardingFeeResponse;

export interface RecordNotePaymentInput {
  source: NotePaymentSource;
  receiptAmount: number;
  receiptDate: string;
  reference?: string | null;
  evidenceS3Key?: string | null;
  scheduleId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function mapNoteSettlementToPoolSummary(
  settlement: Pick<
    NoteSettlement,
    | "id"
    | "status"
    | "grossReceiptAmount"
    | "investorPrincipal"
    | "investorProfitNet"
    | "tawidhAmount"
    | "tawidhInvestorSharePercent"
    | "tawidhInvestorAmount"
    | "tawidhAccountAmount"
    | "gharamahAmount"
    | "issuerResidualAmount"
    | "unappliedAmount"
    | "profitStartDate"
    | "profitMaturityDate"
    | "profitDays"
    | "annualProfitRatePercent"
    | "postedAt"
    | "serviceFeeAmount"
    | "serviceFeeTrusteeStatus"
    | "serviceFeeTrusteeSubmittedAt"
    | "serviceFeeTrusteeCompletedAt"
  >
): NoteSettlementPoolSummary {
  return {
    settlementId: settlement.id,
    status: settlement.status,
    grossReceiptAmount: settlement.grossReceiptAmount,
    investorPoolAmount:
      settlement.investorPrincipal +
      settlement.investorProfitNet +
      settlement.tawidhInvestorAmount,
    operatingAccountAmount: settlement.serviceFeeAmount,
    totalTawidhAmount: settlement.tawidhAmount,
    tawidhInvestorSharePercent: settlement.tawidhInvestorSharePercent,
    tawidhInvestorAmount: settlement.tawidhInvestorAmount,
    tawidhAccountAmount: settlement.tawidhAccountAmount,
    gharamahAccountAmount: settlement.gharamahAmount,
    issuerResidualAmount: settlement.issuerResidualAmount,
    unappliedAmount: settlement.unappliedAmount,
    profitStartDate: settlement.profitStartDate,
    profitMaturityDate: settlement.profitMaturityDate,
    profitDays: settlement.profitDays,
    annualProfitRatePercent: settlement.annualProfitRatePercent,
    postedAt: settlement.postedAt,
    serviceFeeTrusteeStatus: settlement.serviceFeeTrusteeStatus,
    serviceFeeTrusteeSubmittedAt: settlement.serviceFeeTrusteeSubmittedAt,
    serviceFeeTrusteeCompletedAt: settlement.serviceFeeTrusteeCompletedAt,
  };
}

export interface SettlementPreviewInput {
  paymentId?: string | null;
  receiptAmount?: number;
  receiptDate?: string;
  tawidhAmount?: number;
  tawidhInvestorSharePercent?: number;
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
  /** Max Ta'widh + Gharamah that fit in the invoice settlement pool after principal and gross profit. */
  availableLateFeeHeadroomAmount: number | null;
  suggestedTawidhAmount: number;
  suggestedGharamahAmount: number;
  message: string;
}

export * from "./note-expected-return";
export * from "./note-money";
