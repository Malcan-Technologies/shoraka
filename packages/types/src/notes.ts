import type { SoukscoreRiskRating } from "./invoice-offer-risk-rating";
import type { FacilityFeeCollectionWaiver, InvoiceFeeSchedule } from "./fee-schedule";
import type { ProfitWindowClassification } from "./tenure-profit";
import type { ExcessLateChargesDto } from "./excess-late-charges";

/** Display label for a stored note reference (e.g. NOTE-20260512-ABC → Note 20260512-ABC). */
export function formatNoteReferenceDisplay(reference: string | null | undefined): string {
  const trimmed = (reference ?? "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("NOTE-") ? `Note ${trimmed.slice("NOTE-".length)}` : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function trimmedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Frozen `notes.purpose_snapshot.financing_for` — investor-visible purpose of financing. */
export function resolvePurposeOfFinancing(purposeSnapshot: unknown): string | null {
  return trimmedText(asRecord(purposeSnapshot)?.financing_for);
}

/** Frozen `notes.contract_snapshot.contract_details.description`. */
export function resolveContractPurpose(contractSnapshot: unknown): string | null {
  const contract = asRecord(contractSnapshot);
  return (
    trimmedText(asRecord(contract?.contract_details)?.description) ??
    trimmedText(contract?.description)
  );
}

/** Frozen `notes.contract_snapshot.contract_details.title`. */
export function resolveContractTitle(contractSnapshot: unknown): string | null {
  const contract = asRecord(contractSnapshot);
  return (
    trimmedText(asRecord(contract?.contract_details)?.title) ?? trimmedText(contract?.title)
  );
}

/** Marketplace list/detail projection: hide issuer identity and prefer purpose as the title. */
export function toMarketplacePublicNote<
  T extends Pick<NoteListItem, "issuerName" | "title" | "noteReference"> & {
    purposeOfFinancing?: string | null;
  },
>(note: T): T {
  const purpose = trimmedText(note.purposeOfFinancing);
  return {
    ...note,
    issuerName: null,
    title: purpose || formatNoteReferenceDisplay(note.noteReference) || note.title,
    purposeOfFinancing: purpose,
  };
}

export type NoteHeaderPurposeRow = {
  label: string;
  value: string;
};

/**
 * Note hero rows shared by admin and issuer: contract work description plus
 * invoice financing purpose (`purpose_snapshot.financing_for`).
 */
export function getNoteHeaderPurposeRows(note: {
  purposeSnapshot?: unknown;
  contractSnapshot?: unknown;
  purposeOfFinancing?: string | null;
}): NoteHeaderPurposeRow[] {
  const contractPurpose = resolveContractPurpose(note.contractSnapshot);
  const invoicePurpose =
    trimmedText(note.purposeOfFinancing) || resolvePurposeOfFinancing(note.purposeSnapshot);
  const rows: NoteHeaderPurposeRow[] = [];
  if (contractPurpose) {
    rows.push({ label: "Purpose of contract", value: contractPurpose });
  }
  if (invoicePurpose) {
    rows.push({ label: "Purpose of invoice", value: invoicePurpose });
  }
  return rows;
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

export enum SettlementTrusteeInstructionStatus {
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
  displayReference: string | null;
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
  excessLateChargeAmount?: number;
  excessLateChargePaidAmount?: number;
  excessTawidhAmount?: number;
  excessGharamahAmount?: number;
  actualSettlementDate?: string | null;
  profitStartDate: string | null;
  profitMaturityDate: string | null;
  profitDays: number;
  annualProfitRatePercent: number;
  postedAt: string | null;
  /** Settlement-wide trustee instruction workflow status. */
  settlementTrusteeStatus: SettlementTrusteeInstructionStatus | null;
  settlementTrusteeCreatedAt: string | null;
  settlementTrusteeLetterGeneratedAt: string | null;
  settlementTrusteeSubmittedAt: string | null;
  settlementTrusteeCompletedAt: string | null;
  settlementTrusteeEmailSentAt: string | null;
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
  /** Days from profit start to the actual settlement date, not contractual tenure. */
  actualProfitDays?: number | null;
  actualProfitStartDate?: string | null;
  actualProfitEndDate?: string | null;
  receivedPayoutAmount: number;
  receivedProfitNetAmount: number;
  receivedProfitGrossAmount: number;
  receivedServiceFeeAmount: number;
  receivedTawidhCompensationAmount: number;
  expectedReturnRatePercent: number;
  /** Annualized net return using actual settlement days, or null before a payout. */
  actualReturnRatePercent: number | null;
  progressPercent: number;
  receivedSettlementEvents: NoteInvestorSettlementEvent[];
}

/** Prospectus workflow summary on admin Note list/detail. */
export type NoteProspectusSummary = {
  /** Normalized workflow status: DRAFT | APPROVED | PUBLISHED. */
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  /** User-facing: Draft | Approved | Published. */
  displayStatus: "Draft" | "Approved" | "Published";
  contentVersion: number | null;
  lastSavedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
};

export interface NoteListItem extends NoteMoneySummary {
  id: string;
  noteReference: string;
  title: string;
  productCategory: string | null;
  /** Display name from product workflow / snapshot; preferred for marketplace card title. */
  productName: string | null;
  /** Catalog image S3 key from the financing-type step (`products/…`). */
  productImageS3Key?: string | null;
  /** Presigned catalog image URL; set on public marketplace payloads. */
  productImageUrl?: string | null;
  /** Frozen `purpose_snapshot.financing_for`. Marketplace headline; issuer name stays hidden. */
  purposeOfFinancing?: string | null;
  /** Frozen `contract_snapshot.contract_details.title`. */
  contractTitle?: string | null;
  /** Frozen `contract_snapshot.contract_details.description` — purpose of contract. */
  purposeOfContract?: string | null;
  issuerIndustry: string | null;
  sourceApplicationId: string;
  sourceContractId: string | null;
  /** Canonical facility reference (`CON-…`) when the note is under a master facility. */
  sourceContractDisplayReference: string | null;
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
  /** Unique investor organisations with a non-cancelled commitment on this note. */
  investorCount: number;
  maturityDate: string | null;
  /** Null/omitted = grandfathered legacy profit engine. Set = tenure-based engine. */
  tenureDays?: number | null;
  /** Days after note maturity before late charges. Present on list payloads for tenure notes. */
  gracePeriodDays?: number;
  disbursementValueDate?: string | null;
  /** Marketplace listing close time (`note_listings.closes_at`); used for funding-window countdown. */
  listingClosesAt: string | null;
  activatedAt: string | null;
  publishedAt: string | null;
  /** When marketplace funding was closed (`notes.funding_closed_at`). */
  fundingClosedAt: string | null;
  /** When the note was fully repaid (`notes.repaid_at`). */
  repaidAt: string | null;
  settlementSummary: NoteSettlementPoolSummary | null;
  /** Issuer portal list: residual trustee payout vs `settlementSummary` (omitted elsewhere). */
  issuerResidualPayout?: IssuerResidualPayoutListStatus;
  /** Posted settlement late charges billed separately to the issuer. */
  excessLateCharges?: ExcessLateChargesDto | null;
  investorRepaymentSummary?: NoteInvestorRepaymentSummary | null;
  /** Admin list/detail: Prospectus workflow status for badges and publish checklist. */
  prospectus?: NoteProspectusSummary | null;
  /**
   * Investor investments list only: primary investment id for this Note + org
   * (used by investment-scoped View Prospectus).
   */
  investorInvestmentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetail extends NoteListItem {
  productSnapshot: Record<string, unknown> | null;
  /** Frozen at Note create: `{ financing_for }` from Application business_details. */
  purposeSnapshot: Record<string, unknown> | null;
  /** Frozen at publish: Page 1 Stage 7/8 track-record snapshot. */
  prospectusSnapshot: Record<string, unknown> | null;
  issuerSnapshot: Record<string, unknown>;
  paymasterSnapshot: Record<string, unknown> | null;
  contractSnapshot: Record<string, unknown> | null;
  invoiceSnapshot: Record<string, unknown> | null;
  feeSchedule?: InvoiceFeeSchedule | null;
  facilityFeeCollectionWaiver?: FacilityFeeCollectionWaiver | null;
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
  /**
   * Present on admin note detail responses. Derived from Platform Finance trustee letter settings.
   * Generic mapper/mutation responses may omit it.
   */
  trusteeAutoSendEmailEnabled?: boolean;
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
  dueDate: string | null;
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
  evidenceFiles?: PaymentEvidenceFile[] | null;
  reference: string | null;
  recordedByUserId: string | null;
  reconciledByUserId: string | null;
  reconciledAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PaymentEvidenceFile {
  s3Key: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface NoteSettlement {
  id: string;
  displayReference: string | null;
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
  excessLateChargeAmount?: number;
  excessLateChargePaidAmount?: number;
  excessTawidhAmount?: number;
  excessGharamahAmount?: number;
  actualSettlementDate?: string | null;
  profitClassification?: ProfitWindowClassification | null;
  ceilingAmount?: number | null;
  ceilingUsedAmount?: number | null;
  ceilingRemainingAmount?: number | null;
  previewSnapshot: Record<string, unknown>;
  approvedAt: string | null;
  postedAt: string | null;
  settlementTrusteeStatus: SettlementTrusteeInstructionStatus | null;
  settlementTrusteeCreatedAt: string | null;
  settlementTrusteeLetterGeneratedAt: string | null;
  settlementTrusteeSubmittedAt: string | null;
  settlementTrusteeCompletedAt: string | null;
  settlementTrusteeEmailSentAt: string | null;
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
  excessLateChargeAmount?: number;
  unpaidTawidhAmount?: number;
  unpaidGharamahAmount?: number;
  actualSettlementDate?: string;
  profitClassification?: ProfitWindowClassification;
  ceilingAmount?: number;
  ceilingUsedAmount?: number;
  ceilingRemainingAmount?: number;
  investorObligationCovered?: boolean;
  includedPaymentIds: string[];
  allocations: NoteSettlementAllocationPreview[];
}

export interface NoteEvent {
  id: string;
  noteId: string;
  eventType: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: string | null;
  portal: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorType?: string | null;
  source?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
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
  evidenceFiles?: PaymentEvidenceFile[] | null;
  createdAt: string;
}

export interface PendingRepaymentsResponse {
  count: number;
  items: PendingRepaymentItem[];
}

export interface PendingIssuerPayoutItem {
  withdrawalId: string;
  displayReference: string | null;
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
export interface PendingSettlementTrusteeLetterItem {
  settlementId: string;
  displayReference: string | null;
  noteId: string;
  noteTitle: string | null;
  noteStatus: string | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  /** Total settlement trustee instruction amount across all instruction rows. */
  trusteeInstructionAmount: number;
  currency: string;
  settlementPostedAt: string | null;
  trusteeInstructionStatus: SettlementTrusteeInstructionStatus | null;
  submittedToTrusteeAt: string | null;
  instructionCompletedAt: string | null;
}

export interface PendingSettlementTrusteeLettersResponse {
  count: number;
  items: PendingSettlementTrusteeLetterItem[];
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
  facilityFeeGatewayTxnMaxAmount: number;
  excessLateChargeGatewayTxnMaxAmount: number;
  /** Whole hour 0–23 MYT when offer phase deadline reminders are sent. */
  offerDeadlineReminderHour: number;
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
  autoSendTrusteeEmail?: boolean;
  trusteeEmail?: string;
  trusteeCcEmails?: string[];
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

export interface IssuerPaymentEvidenceUploadUrlRequest {
  fileName: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  fileSize: number;
}

export interface IssuerPaymentEvidenceUploadUrlResponse {
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
  displayReference: string | null;
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
  trusteeEmailSentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface InvestorWithdrawalsResponse {
  count: number;
  items: InvestorWithdrawalListItem[];
}

export interface WithdrawalInstruction {
  id: string;
  displayReference: string | null;
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
  additionalFees?: Array<{
    name: string;
    kind: "amount" | "percent_of_funded";
    value: number;
    chargedAmount: number;
  }>;
  facilityFeeCollectionWaived?: boolean;
  contractFacilityFeeWaived?: boolean;
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
  trusteeEmailSentAt: string | null;
  /**
   * Present on investor withdrawal detail. Derived from Platform Finance trustee letter settings.
   * Generic mapper/mutation responses may omit it.
   */
  trusteeAutoSendEmailEnabled?: boolean;
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
   * and settlement trustee is complete (no material trustee movement or status COMPLETED). Matches the
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
  /** Capital reserved on open listings (`COMMITTED`). */
  reservedInvestment: number;
  /** Capital in live notes (`CONFIRMED`). */
  confirmedInvestment: number;
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

export type InvestorBalanceActivityRelatedKind = "investment" | "withdrawal" | "deposit";

/** Current lifecycle of the investment, withdrawal, or in-flight deposit this row belongs to. */
export interface InvestorBalanceActivityRelated {
  kind: InvestorBalanceActivityRelatedKind;
  status: string;
  /** `confirmedAt` for investments, `completedAt` for withdrawals, credit time for deposits. */
  settledAt: string | null;
}

export interface InvestorBalanceActivityEntry {
  id: string;
  investorOrganizationId: string;
  direction: "IN" | "OUT";
  amount: number;
  source: string;
  noteId: string | null;
  noteReference?: string | null;
  noteInvestmentId: string | null;
  idempotencyKey: string;
  metadata: Record<string, unknown> | null;
  postedAt: string;
  createdAt: string;
  related: InvestorBalanceActivityRelated | null;
  /**
   * False for in-flight gateway deposits that have not credited the wallet yet
   * (name check, hold, or refund). Omit or true for posted ledger rows.
   */
  affectsAvailableBalance?: boolean;
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
  displayReference: string | null;
  applicationId: string;
  contractId: string | null;
  contractDisplayReference: string | null;
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
  /** Must be true — server rejects investments without Prospectus acknowledgement. */
  prospectusAcknowledged: true;
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

export type NameCheckResult = "PASS" | "REVIEW" | "FAIL" | "NAME_UNAVAILABLE";

export interface InvestorDepositLimits {
  minAmount: number;
  maxAmount: number;
}

export interface CreateInvestorDepositInput {
  investorOrganizationId: string;
  amount: number;
  depositIntentId: string;
}

export interface InvestorDepositResponse {
  id: string;
  status: GatewayPaymentStatus;
  purpose: string;
  gatewayAccount: "OPERATING" | "INVESTOR_POOL";
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
  gatewayAccount: "OPERATING" | "INVESTOR_POOL";
  amount: number;
  currency: string;
  curlecOrderId: string;
  curlecKeyId: string;
  issuerOrganizationId: string | null;
  applicationId: string | null;
  contractId?: string | null;
  nameCheckResult: NameCheckResult | null;
  payerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssuerOnboardingFeeStatusResponse {
  amount: number;
  latestPayment: IssuerOnboardingFeeResponse | null;
  isPaid: boolean;
  isUnderReview: boolean;
  /** True when the latest fee is REFUNDED and a new payment is required to continue. */
  requiresRepayment: boolean;
}

export interface CreateApplicationProcessingFeeInput {
  applicationId: string;
}

export type ApplicationProcessingFeeResponse = IssuerOnboardingFeeResponse;

export interface FacilityFeePaymentResponse extends IssuerOnboardingFeeResponse {
  contractId: string | null;
  upfrontAmount: number;
  paidAmount: number;
  outstanding: number;
  perTxnMaxAmount: number;
}

export interface ExcessLateChargePaymentResponse extends IssuerOnboardingFeeResponse {
  noteId: string | null;
  settlementId: string | null;
  owedAmount: number;
  paidAmount: number;
  outstanding: number;
  perTxnMaxAmount: number;
  noteReference: string;
}

export interface RecordNotePaymentInput {
  source: NotePaymentSource;
  receiptAmount: number;
  receiptDate: string;
  actualSettlementDate?: string;
  reference?: string | null;
  evidenceFiles?: PaymentEvidenceFile[] | null;
  scheduleId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ApproveNotePaymentInput {
  actualSettlementDate?: string;
}

export function mapNoteSettlementToPoolSummary(
  settlement: Pick<
    NoteSettlement,
    | "id"
    | "displayReference"
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
    | "excessLateChargeAmount"
    | "excessLateChargePaidAmount"
    | "excessTawidhAmount"
    | "excessGharamahAmount"
    | "actualSettlementDate"
    | "profitStartDate"
    | "profitMaturityDate"
    | "profitDays"
    | "annualProfitRatePercent"
    | "postedAt"
    | "serviceFeeAmount"
    | "settlementTrusteeStatus"
    | "settlementTrusteeCreatedAt"
    | "settlementTrusteeLetterGeneratedAt"
    | "settlementTrusteeSubmittedAt"
    | "settlementTrusteeCompletedAt"
    | "settlementTrusteeEmailSentAt"
  >
): NoteSettlementPoolSummary {
  return {
    settlementId: settlement.id,
    displayReference: settlement.displayReference,
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
    excessLateChargeAmount: settlement.excessLateChargeAmount ?? 0,
    excessLateChargePaidAmount: settlement.excessLateChargePaidAmount ?? 0,
    excessTawidhAmount: settlement.excessTawidhAmount ?? 0,
    excessGharamahAmount: settlement.excessGharamahAmount ?? 0,
    actualSettlementDate: settlement.actualSettlementDate ?? null,
    profitStartDate: settlement.profitStartDate,
    profitMaturityDate: settlement.profitMaturityDate,
    profitDays: settlement.profitDays,
    annualProfitRatePercent: settlement.annualProfitRatePercent,
    postedAt: settlement.postedAt,
    settlementTrusteeStatus: settlement.settlementTrusteeStatus,
    settlementTrusteeCreatedAt: settlement.settlementTrusteeCreatedAt,
    settlementTrusteeLetterGeneratedAt: settlement.settlementTrusteeLetterGeneratedAt,
    settlementTrusteeSubmittedAt: settlement.settlementTrusteeSubmittedAt,
    settlementTrusteeCompletedAt: settlement.settlementTrusteeCompletedAt,
    settlementTrusteeEmailSentAt: settlement.settlementTrusteeEmailSentAt,
  };
}

export interface SettlementPreviewInput {
  paymentId?: string | null;
  receiptAmount?: number;
  receiptDate?: string;
  actualSettlementDate?: string;
  tawidhAmount?: number;
  tawidhInvestorSharePercent?: number;
  gharamahAmount?: number;
}

export interface OverdueLateChargeInput {
  receiptAmount?: number;
  receiptDate?: string;
  actualSettlementDate?: string;
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
export * from "./note-settlement-trustee";
