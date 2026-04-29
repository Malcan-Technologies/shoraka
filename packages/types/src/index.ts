export type UserRole = "INVESTOR" | "ISSUER" | "ADMIN";

export type LoanStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "FUNDED"
  | "ACTIVE"
  | "COMPLETED"
  | "DEFAULTED"
  | "REJECTED";

export interface ApiResponse<T> {
  success: true;
  data: T;
  correlationId: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId: string;
}

export interface User {
  id: string;
  user_id?: string | null;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  kycVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  borrowerId: string;
  amount: number;
  interestRate: number;
  durationMonths: number;
  purpose: string;
  status: LoanStatus;
  fundedAmount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  fundedAt?: string;
}

export interface Investment {
  id: string;
  investorId: string;
  loanId: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export type ActivityCategory = "organization";

export interface Activity {
  id: string;
  user_id: string;
  category: ActivityCategory;
  event_type: string; // Displayed as "Event" in UI
  activity: string;   // Displayed as "Activity" in UI (human-readable)
  metadata: any | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string; // Displayed as "Time" in UI
  source_table: string;
  status?: "success" | "failed";
}

export interface GetActivitiesParams {
  page: number;
  limit: number;
  search?: string;
  categories?: ActivityCategory[];
  eventType?: string;
  eventTypes?: string[];
  status?: "success" | "failed";
  startDate?: string;
  endDate?: string;
  dateRange?: "24h" | "7d" | "30d" | "all";
  organizationId?: string;
  portalType?: "investor" | "issuer";
}

export interface ActivitiesResponse {
  activities: Activity[];
  pagination: {
    total: number;
    unfilteredTotal: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Application Types - runtime enums for backend use
export enum ApplicationStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  CONTRACT_PENDING = "CONTRACT_PENDING",
  CONTRACT_SENT = "CONTRACT_SENT",
  CONTRACT_ACCEPTED = "CONTRACT_ACCEPTED",
  INVOICE_PENDING = "INVOICE_PENDING",
  INVOICES_SENT = "INVOICES_SENT",
  AMENDMENT_REQUESTED = "AMENDMENT_REQUESTED",
  RESUBMITTED = "RESUBMITTED",
  APPROVED = "APPROVED",
  COMPLETED = "COMPLETED",
  WITHDRAWN = "WITHDRAWN",
  REJECTED = "REJECTED",
  ARCHIVED = "ARCHIVED",
}

export enum WithdrawReason {
  USER_CANCELLED = "USER_CANCELLED",
  OFFER_EXPIRED = "OFFER_EXPIRED",
  OFFER_REJECTED = "OFFER_REJECTED",
}

export function formatWithdrawLabel(reason?: WithdrawReason): string {
  switch (reason) {
    case WithdrawReason.OFFER_EXPIRED:
      return "Withdrawn (Offer expired)";
    case WithdrawReason.USER_CANCELLED:
      return "Withdrawn (User cancelled)";
    case WithdrawReason.OFFER_REJECTED:
      return "Withdrawn (Offer rejected)";
    default:
      return "Withdrawn";
  }
}

export type ReviewStepStatus =
  | "PENDING"
  | "OFFER_SENT"
  | "APPROVED"
  | "REJECTED"
  | "AMENDMENT_REQUESTED"
  | "WITHDRAWN";

export type ApplicationProductVersionCompareOutcome =
  | "NO_PRODUCT_ID"
  | "PRODUCT_UNAVAILABLE"
  | "COMPARE";

/** Issuer version modal / guard: two user-facing cases plus null (no block). */
export type IssuerProductBlockReason = "PRODUCT_UNAVAILABLE" | "PRODUCT_VERSION_CHANGED" | null;

export interface ApplicationProductVersionCompare {
  outcome: ApplicationProductVersionCompareOutcome;
  compare_version?: number;
}

export type IssuerProductLiveCheckOutcome = "PRODUCT_UNAVAILABLE" | "COMPARE";

export interface IssuerProductLiveCheck {
  outcome: IssuerProductLiveCheckOutcome;
  compare_version?: number;
  resolved_product_id?: string;
}

export interface Application {
  id: string;
  issuer_organization_id: string;
  product_version: number;
  status: ApplicationStatus;
  last_completed_step: number;
  financing_type?: any;
  financing_structure?: any;
  contract_details?: any;
  invoice_details?: any;
  company_details?: any;
  business_details?: any;
  /** Present when loaded via GET /applications/:id (relational guarantors for hydration). */
  application_guarantors?: unknown[];
  supporting_documents?: any;
  declarations?: any;
  review_and_submit?: any;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
}

export interface CreateApplicationInput {
  productId: string;
  issuerOrganizationId: string;
}

export interface UpdateApplicationStepInput {
  stepNumber: number;
  stepId: string;
  data: Record<string, any>;
  forceRewindToStep?: number;
}

export interface Product {
  id: string;
  base_id?: string | null;
  version: number;
  status?: string;
  workflow: any[];
  offer_expiry_days?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GetProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export enum ContractStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  OFFER_SENT = "OFFER_SENT",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  AMENDMENT_REQUESTED = "AMENDMENT_REQUESTED",
  WITHDRAWN = "WITHDRAWN",
}

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  OFFER_SENT = "OFFER_SENT",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  AMENDMENT_REQUESTED = "AMENDMENT_REQUESTED",
  WITHDRAWN = "WITHDRAWN",
}

export interface ContractDetails {
  title: string;
  description?: string;
  number: string;
  value: number;
  financing: number;
  start_date: string;
  end_date: string;
  approved_facility: number | null;
  utilized_facility: number | null;
  available_facility: number | null;
  document?: {
    s3_key: string;
    file_name: string;
    file_size?: number;
    uploaded_at?: string;
  };
}

export interface CustomerDetails {
  name: string;
  entity_type: string;
  ssm_number: string;
  country: string;
  is_related_party: boolean;
  is_large_private_company?: boolean;
  document?: {
    s3_key: string;
    file_name: string;
    file_size?: number;
    uploaded_at?: string;
  };
}

export interface Contract {
  id: string;
  application_id: string;
  issuer_organization_id: string;
  status: ContractStatus;
  contract_details?: ContractDetails | null;
  offer_details?: ContractOfferDetails | null;
  customer_details?: CustomerDetails | null;
  created_at: string;
  updated_at: string;
}

export interface ContractOfferDetails {
  requested_facility: number;
  offered_facility: number;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  sent_by_user_id: string | null;
  responded_by_user_id: string | null;
  version: number;
}

export interface InvoiceDetails {
  number: string;
  value: number;
  maturity_date: string;
  financing_ratio_percent?: number;
  document?: {
    s3_key: string;
    file_name: string;
    file_size: number;
  };
}

export interface Invoice {
  id: string;
  contract_id?: string | null;
  application_id: string;
  status: InvoiceStatus;
  details: InvoiceDetails;
  offer_details?: InvoiceOfferDetails | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceOfferDetails {
  requested_amount: number;
  offered_amount: number;
  requested_ratio_percent: number | null;
  offered_ratio_percent: number | null;
  offered_profit_rate_percent: number | null;
  /** Manual SoukScore placeholder (v1: A | B | C). Present on offers sent after this feature. */
  risk_rating?: import("./invoice-offer-risk-rating").SoukscoreRiskRating | null;
  expires_at: string | null;
  sent_at: string | null;
  responded_at: string | null;
  sent_by_user_id: string | null;
  responded_by_user_id: string | null;
  version: number;
}

export * from "./invoice-offer-risk-rating";
export * from "./activity-config";
export * from "./admin";
export * from "./application-steps";
export * from "./financial-calculator";
export * from "./financial-field-labels";
export * from "./ctos-report-table-math";
export * from "./financial-unaudited-ctos-validation";
export * from "./review-scope";
export * from "./resubmit-path-utils";
export * from "./resubmit-meaningful-field-path";
export * from "./application-people-display";
export * from "./director-kyc-gov-id";
export * from "./director-shareholder-single-status-display";
export * from "./director-shareholder-display";
export * from "./director-shareholder-party-type-a";
export * from "./regtank-onboarding-status";
export * from "./status-normalization";
export * from "./title-case";
export * from "./onboarding-readiness";
export * from "./ctos-party-supplement-json";
export * from "./regtank-iso3166-countries";
