import type { UserRole } from "./index";

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationResponse {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface GetUsersParams extends PaginationParams {
  search?: string;
  role?: UserRole;
  kycVerified?: boolean;
  investorOnboarded?: boolean;
  issuerOnboarded?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  cognito_sub: string;
  cognito_username: string;
  roles: UserRole[];
  first_name: string;
  last_name: string;
  phone: string | null;
  email_verified: boolean;
  kyc_verified: boolean;
  investor_onboarding_completed: boolean;
  issuer_onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsersResponse {
  users: UserResponse[];
  pagination: PaginationResponse;
}

export interface UpdateUserRolesInput {
  roles: UserRole[];
}

export interface UpdateUserKycInput {
  kycVerified: boolean;
}

export interface UpdateUserOnboardingInput {
  investorOnboarded?: boolean;
  issuerOnboarded?: boolean;
}

export interface UpdateUserProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

export type EventType =
  | "LOGIN"
  | "LOGOUT"
  | "SIGNUP"
  | "ROLE_ADDED"
  | "ROLE_SWITCHED"
  | "ONBOARDING_COMPLETED"
  | "KYC_STATUS_UPDATED"
  | "ONBOARDING_STATUS_UPDATED"
  | "PROFILE_UPDATED"
  | "PASSWORD_CHANGED"
  | "EMAIL_CHANGED";

export interface AccessLogUser {
  first_name: string;
  last_name: string;
  email: string;
  roles: UserRole[];
}

export interface AccessLogResponse {
  id: string;
  user_id: string;
  user: AccessLogUser;
  event_type: EventType;
  portal: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  device_type: string | null;
  cognito_event: Record<string, unknown> | null;
  success: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetAccessLogsParams extends PaginationParams {
  search?: string;
  eventType?: EventType;
  eventTypes?: EventType[];
  status?: "success" | "failed";
  dateRange?: "24h" | "7d" | "30d" | "all";
  userId?: string;
}

export interface AccessLogsResponse {
  logs: AccessLogResponse[];
  pagination: PaginationResponse;
}

export interface ExportAccessLogsParams extends Omit<GetAccessLogsParams, "page" | "pageSize"> {
  format?: "csv" | "json";
  eventTypes?: EventType[];
}

// Dashboard Statistics Types
export interface SignupTrendItem {
  date: string;
  totalSignups: number;
  investorsOnboarded: number;
  issuersOnboarded: number;
}

export interface UserStatsWithTrend {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface DashboardStatsResponse {
  users: {
    total: UserStatsWithTrend;
    investorsOnboarded: UserStatsWithTrend;
    issuersOnboarded: UserStatsWithTrend;
  };
  signupTrends: SignupTrendItem[];
}
