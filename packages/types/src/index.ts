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

export * from "@cashsouk/config/src/activity-config";
export * from "./admin";
