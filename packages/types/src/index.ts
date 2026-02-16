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

// Application Types
export type ApplicationStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "ARCHIVED";

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
  version: number;
  workflow: any[];
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

export type ContractStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type InvoiceStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface ContractDetails {
  title: string;
  description?: string;
  number: string;
  value: number;
  start_date: string;
  end_date: string;
  approved_facility: number;
  utilized_facility: number;
  available_facility: number;
  document?: {
    s3_key: string;
    file_name: string;
    file_size: number;
  };
}

export interface CustomerDetails {
  name: string;
  entity_type: string;
  ssm_number: string;
  country: string;
  is_related_party: boolean;
  document?: {
    s3_key: string;
    file_name: string;
    file_size: number;
  };
}

export interface Contract {
  id: string;
  application_id: string;
  issuer_organization_id: string;
  status: ContractStatus;
  contract_details?: ContractDetails | null;
  customer_details?: CustomerDetails | null;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
}

export * from "./activity-config";
export * from "./admin";
export * from "./application-steps";
