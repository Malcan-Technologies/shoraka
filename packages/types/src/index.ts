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

export type ActivityCategory = "security" | "onboarding" | "document";

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
}

export interface GetActivitiesParams {
  page: number;
  limit: number;
  search?: string;
  categories?: ActivityCategory[];
  eventTypes?: string[];
  startDate?: string;
  endDate?: string;
}

export interface ActivitiesResponse {
  activities: Activity[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export * from "./admin";
