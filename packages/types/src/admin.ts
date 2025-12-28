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
  user_id: string | null;
  email: string;
  email_verified: boolean;
  cognito_sub: string;
  cognito_username: string;
  roles: UserRole[];
  first_name: string;
  last_name: string;
  phone: string | null;
  investor_account: string[];
  issuer_account: string[];
  investor_organization_count?: number;
  issuer_organization_count?: number;
  password_changed_at: string | null;
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
  | "ONBOARDING"
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
  investorOrgsOnboarded: number;
  issuerOrgsOnboarded: number;
}

export interface UserStatsWithTrend {
  current: number;
  previous: number;
  percentageChange: number;
}

export interface OrganizationTypeStats {
  total: number;
  onboarded: number;
  pending: number;
}

export interface PortalOrganizationStats {
  total: number;
  personal: OrganizationTypeStats;
  company: OrganizationTypeStats;
}

export interface OrganizationStats {
  investor: PortalOrganizationStats;
  issuer: PortalOrganizationStats;
}

export interface OnboardingOperationsMetrics {
  inProgress: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  avgTimeToApprovalMinutes: number | null;
  avgTimeToApprovalChangePercent: number | null;
  avgTimeToOnboardingMinutes: number | null;
  avgTimeToOnboardingChangePercent: number | null;
}

export interface DashboardStatsResponse {
  users: {
    total: UserStatsWithTrend;
    investorsOnboarded: UserStatsWithTrend;
    issuersOnboarded: UserStatsWithTrend;
  };
  signupTrends: SignupTrendItem[];
  organizations: OrganizationStats;
  onboardingOperations?: OnboardingOperationsMetrics;
}

// Admin Management Types
export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  COMPLIANCE_OFFICER = "COMPLIANCE_OFFICER",
  OPERATIONS_OFFICER = "OPERATIONS_OFFICER",
  FINANCE_OFFICER = "FINANCE_OFFICER",
}

export interface AdminUser {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  admin: {
    role_description: AdminRole | null;
    status: "ACTIVE" | "INACTIVE";
    last_login: string | null;
  } | null;
  created_at: string;
}

export interface GetAdminUsersParams extends PaginationParams {
  search?: string;
  roleDescription?: AdminRole;
  status?: "ACTIVE" | "INACTIVE";
}

export interface AdminUsersResponse {
  users: AdminUser[];
  pagination: PaginationResponse;
}

export interface UpdateAdminRoleInput {
  roleDescription: AdminRole;
}

export interface InviteAdminInput {
  email?: string;
  roleDescription: AdminRole;
}

export interface InviteAdminResponse {
  inviteUrl: string;
  messageId?: string;
  emailSent: boolean;
  emailError?: string;
}

export interface AcceptInvitationInput {
  token: string;
}

// Security Logs Types
export type SecurityEventType =
  | "PASSWORD_CHANGED"
  | "EMAIL_CHANGED"
  | "ROLE_ADDED"
  | "ROLE_SWITCHED"
  | "PROFILE_UPDATED";

export interface SecurityLogUser {
  first_name: string;
  last_name: string;
  email: string;
  roles: UserRole[];
}

export interface SecurityLogResponse {
  id: string;
  user_id: string;
  user: SecurityLogUser;
  event_type: SecurityEventType;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetSecurityLogsParams extends PaginationParams {
  search?: string;
  eventType?: SecurityEventType;
  eventTypes?: SecurityEventType[];
  dateRange?: "24h" | "7d" | "30d" | "all";
  userId?: string;
}

export interface SecurityLogsResponse {
  logs: SecurityLogResponse[];
  pagination: PaginationResponse;
}

// Onboarding Logs Types
export type OnboardingEventType =
  | "ONBOARDING_STARTED"
  | "ONBOARDING_COMPLETED"
  | "ONBOARDING_CANCELLED"
  | "ONBOARDING_STATUS_UPDATED"
  | "SOPHISTICATED_STATUS_UPDATED"
  | "FINAL_APPROVAL_COMPLETED"
  | "SSM_APPROVED";

export interface OnboardingLogUser {
  first_name: string;
  last_name: string;
  email: string;
  roles: UserRole[];
}

export interface OnboardingLogResponse {
  id: string;
  user_id: string;
  user: OnboardingLogUser;
  role: UserRole;
  event_type: OnboardingEventType;
  portal: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  device_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetOnboardingLogsParams extends PaginationParams {
  search?: string;
  eventType?: OnboardingEventType;
  eventTypes?: OnboardingEventType[];
  role?: UserRole;
  dateRange?: "24h" | "7d" | "30d" | "all";
  userId?: string;
}

export interface OnboardingLogsResponse {
  logs: OnboardingLogResponse[];
  pagination: PaginationResponse;
}

export interface ExportOnboardingLogsParams
  extends Omit<GetOnboardingLogsParams, "page" | "pageSize"> {
  format?: "csv" | "json";
  eventTypes?: OnboardingEventType[];
}

// Pending Invitations Types
export interface PendingInvitation {
  id: string;
  email: string;
  role_description: AdminRole;
  token: string;
  expires_at: string;
  created_at: string;
  invited_by: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface GetPendingInvitationsParams extends PaginationParams {
  search?: string;
  roleDescription?: AdminRole;
}

export interface PendingInvitationsResponse {
  invitations: PendingInvitation[];
  pagination: PaginationResponse;
}

// Organization Types
export type PortalType = "investor" | "issuer";
export type OrganizationTypeEnum = "PERSONAL" | "COMPANY";
export type OnboardingStatusEnum =
  | "PENDING"
  | "IN_PROGRESS"
  | "PENDING_APPROVAL"
  | "PENDING_AML"
  | "PENDING_SSM_REVIEW"
  | "PENDING_FINAL_APPROVAL"
  | "COMPLETED";

export interface OrganizationOwner {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface OrganizationResponse {
  id: string;
  portal: PortalType;
  type: OrganizationTypeEnum;
  name: string | null;
  registrationNumber: string | null;
  onboardingStatus: OnboardingStatusEnum;
  onboardedAt: string | null;
  owner: OrganizationOwner;
  memberCount: number;
  isSophisticatedInvestor: boolean; // Only applicable for investor portal
  createdAt: string;
  updatedAt: string;
}

export interface GetOrganizationsParams extends PaginationParams {
  search?: string;
  portal?: PortalType;
  type?: OrganizationTypeEnum;
  onboardingStatus?: OnboardingStatusEnum;
}

export interface OrganizationsResponse {
  organizations: OrganizationResponse[];
  pagination: PaginationResponse;
}

// Organization Detail Types (for View More modal)
export interface OrganizationMemberDetail {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "OWNER" | "DIRECTOR" | "MEMBER";
  createdAt: string;
}

export interface OrganizationDetailResponse {
  id: string;
  portal: PortalType;
  type: OrganizationTypeEnum;
  name: string | null;
  registrationNumber: string | null;
  onboardingStatus: OnboardingStatusEnum;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;

  // Owner info
  owner: OrganizationOwner;

  // RegTank extracted personal data
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  nationality: string | null;
  country: string | null;
  idIssuingCountry: string | null;
  gender: string | null;
  address: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;

  // Document info
  documentType: string | null;
  documentNumber: string | null;
  kycId: string | null;

  // JSON fields (form content)
  bankAccountDetails: Record<string, unknown> | null;
  wealthDeclaration: Record<string, unknown> | null;
  complianceDeclaration: Record<string, unknown> | null;
  documentInfo: Record<string, unknown> | null;
  livenessCheckInfo: Record<string, unknown> | null;

  // Members
  members: OrganizationMemberDetail[];

  // Sophisticated investor status (only for investor portal)
  isSophisticatedInvestor: boolean;

  // RegTank portal link (for viewing in RegTank admin)
  regtankPortalUrl: string | null;
  regtankRequestId: string | null;
}

// Onboarding Applications Types (Admin Approval Queue)
export type OnboardingApprovalStatus =
  | "PENDING_ONBOARDING"
  | "PENDING_APPROVAL"
  | "PENDING_AML"
  | "PENDING_SSM_REVIEW"
  | "PENDING_FINAL_APPROVAL"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface OnboardingApplicationResponse {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: OrganizationTypeEnum;
  portal: PortalType;
  organizationId: string;
  organizationName: string | null;
  registrationNumber: string | null;
  regtankRequestId: string | null;
  regtankStatus: string | null;
  regtankSubstatus: string | null;
  regtankPortalUrl: string | null;
  kycPortalUrl: string | null;
  status: OnboardingApprovalStatus;
  ssmVerified: boolean;
  ssmVerifiedAt: string | null;
  ssmVerifiedBy: string | null;
  submittedAt: string;
  completedAt: string | null;
  // Approval workflow flags
  onboardingApproved: boolean;
  amlApproved: boolean;
  tncAccepted: boolean;
  ssmApproved: boolean;
  isCompleted: boolean;
}

export interface GetOnboardingApplicationsParams extends PaginationParams {
  search?: string;
  portal?: PortalType;
  type?: OrganizationTypeEnum;
  status?: OnboardingApprovalStatus;
}

export interface OnboardingApplicationsResponse {
  applications: OnboardingApplicationResponse[];
  pagination: PaginationResponse;
}
