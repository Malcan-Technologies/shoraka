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

export type ActivityType =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "NEW_DEVICE_LOGIN"
  | "PASSWORD_CHANGED"
  | "EMAIL_VERIFIED"
  | "SECURITY_ALERT"
  | "PROFILE_UPDATED"
  | "SETTINGS_CHANGED"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "INVESTMENT"
  | "TRANSACTION_COMPLETED"
  | "ONBOARDING_STARTED"
  | "ONBOARDING_COMPLETED"
  | "KYC_SUBMITTED";

export interface Activity {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  metadata: any | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
}

export interface GetActivitiesParams {
  page: number;
  limit: number;
  search?: string;
  type?: ActivityType;
  types?: ActivityType[];
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

