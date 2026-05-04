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

export interface UserOrganizationSummary {
  id: string;
  portal: "investor" | "issuer";
  type: "PERSONAL" | "COMPANY";
  name: string | null;
  registrationNumber: string | null;
  onboardingStatus: string;
  onboardedAt: string | null;
  relationship: "owner" | "member";
  memberRole: string | null;
  memberCount: number;
  isSophisticatedInvestor: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetailResponse extends Omit<UserResponse, "id"> {
  stats: {
    accessLogs: number;
    investments: number;
    loans: number;
    investorOrganizations: number;
    issuerOrganizations: number;
  };
  organizations: {
    investor: UserOrganizationSummary[];
    issuer: UserOrganizationSummary[];
  };
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
  | "USER_COMPLETED"
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
}

export interface ApplicationDashboardMetrics {
  total: number;
  actionRequired: number;
  draft: number;
  contractOrAmendmentCycle: number;
  approvedCompleted: number;
  withdrawnRejectedOrArchived: number;
}

export interface ContractDashboardMetrics {
  total: number;
  actionRequired: number;
  draft: number;
  offerSent: number;
  approved: number;
  rejectedOrWithdrawn: number;
}

export interface NoteDashboardMetrics {
  total: number;
  draft: number;
  live: number;
  repaid: number;
  distressed: number;
  cancelledOrFailedFunding: number;
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
  applicationMetrics?: ApplicationDashboardMetrics;
  contractMetrics?: ContractDashboardMetrics;
  noteMetrics?: NoteDashboardMetrics;
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
  | "ONBOARDING_RESUMED"
  | "ONBOARDING_CANCELLED"
  | "ONBOARDING_STATUS_UPDATED"
  | "ONBOARDING_REJECTED"
  | "SOPHISTICATED_STATUS_UPDATED"
  | "FINAL_APPROVAL_COMPLETED"
  | "FORM_FILLED"
  | "ONBOARDING_APPROVED"
  | "AML_APPROVED"
  | "TNC_APPROVED"
  | "SSM_APPROVED"
  | "TNC_ACCEPTED"
  | "KYC_APPROVED"
  | "KYB_APPROVED";

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
  organizationName?: string | null;
  organizationType?: "PERSONAL" | "COMPANY" | null;
}

export interface GetOnboardingLogsParams extends PaginationParams {
  search?: string;
  eventType?: OnboardingEventType;
  eventTypes?: OnboardingEventType[];
  role?: UserRole;
  dateRange?: "24h" | "7d" | "30d" | "all";
  userId?: string;
  organizationId?: string;
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
  | "COMPLETED"
  | "REJECTED";

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
  depositReceived: boolean; // Only applicable for investor portal
  riskLevel: string | null; // From KYC response: "Low Risk", "Medium Risk", "High Risk"
  riskScore: string | null; // From KYC response: numeric score as string
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
  role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
  createdAt: string;
}

// Organization invitation types
export interface OrganizationInvitation {
  id: string;
  email: string;
  role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
  organizationId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Corporate entities types (from corporate_entities JSON)
export interface Director {
  name: string;
  idNumber: string;
  nationality: string;
  position: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: string;
  idIssuingCountry?: string;
}

export interface IndividualShareholder {
  name: string;
  idNumber: string;
  nationality: string;
  shareholdingPercentage: number;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

export interface BusinessShareholder {
  businessName: string;
  registrationNumber: string;
  country: string;
  shareholdingPercentage: number;
  address?: string;
}

export interface CorporateEntitiesResponse {
  directors: Director[];
  shareholders: IndividualShareholder[];
  corporateShareholders: BusinessShareholder[];
}

// Corporate info (from corporate_onboarding_data JSON)
export interface CorporateInfo {
  tinNumber?: string;
  industry?: string;
  entityType?: string;
  businessName?: string;
  numberOfEmployees?: number;
  ssmRegisterNumber?: string;
  businessAddress?: string;
  registeredAddress?: string;
}

// KYC Response from RegTank AML screening
export interface KycResponse {
  tags: string[];
  status: string;
  assignee: string;
  systemId: string;
  requestId: string;
  riskLevel: string;
  riskScore: string;
  timestamp: string;
  referenceId: string;
  onboardingId: string;
  messageStatus: string;
  possibleMatchCount: number;
  blacklistedMatchCount: number;
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
  kycResponse: KycResponse | null;

  // Members
  members: OrganizationMemberDetail[];

  // Sophisticated investor status (only for investor portal)
  isSophisticatedInvestor: boolean;
  sophisticatedInvestorReason: string | null;

  // RegTank portal link (for viewing in RegTank admin)
  regtankPortalUrl: string | null;
  regtankRequestId: string | null;
  codRequestId: string | null;

  // Applications (issuer only)
  applications?: {
    id: string;
    status: string;
    productVersion: number;
    lastCompletedStep: number;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
    contractId: string | null;
  }[];

  linkedRecords?: {
    applications: {
      id: string;
      status: string;
      productId: string | null;
      submittedAt: string | null;
      createdAt: string;
      updatedAt: string;
      contractId: string | null;
      requestedAmount: number | null;
    }[];
    contracts: {
      id: string;
      title: string | null;
      contractNumber: string | null;
      status: string;
      createdAt: string;
      updatedAt: string;
      contractValue: number | null;
    }[];
    notes: {
      id: string;
      noteReference: string;
      title: string;
      status: string;
      targetAmount: number;
      fundedAmount: number;
      createdAt: string;
      updatedAt: string;
    }[];
    investments: {
      id: string;
      status: string;
      amount: number;
      noteId: string;
      noteReference: string;
      noteTitle: string;
      committedAt: string;
      updatedAt: string;
    }[];
  };

  // Corporate onboarding data (for COMPANY type)
  corporateOnboardingData?: {
    basicInfo?: {
      tinNumber?: string;
      industry?: string;
      entityType?: string;
      businessName?: string;
      numberOfEmployees?: number;
      ssmRegisterNumber?: string;
      annualRevenue?: string;
      website?: string;
      phoneNumber?: string;
    };
    addresses?: {
      business?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        state?: string | null;
        country?: string | null;
      };
      registered?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        state?: string | null;
        country?: string | null;
      };
    };
    personInCharge?: {
      name?: string | null;
      position?: string | null;
      email?: string | null;
      contactNumber?: string | null;
    };
  };

  // Corporate entities (directors, shareholders, corporate shareholders) — COMPANY only
  corporateEntities?: Record<string, unknown> | null;
  latestOrganizationCtosCompanyJson?: Record<string, unknown> | null;
  ctosPartySupplements?: Array<{ partyKey: string; onboardingJson?: unknown }> | null;

  /** Latest CTOS subject report per party (IC/SSM key); COMPANY issuer/investor org detail. */
  latestOrganizationCtosSubjectReports?: Array<{
    id: string;
    subject_ref: string | null;
    fetched_at: string;
    has_report_html: boolean;
  }> | null;

  // Corporate required documents (SSM profile, etc.) — COMPANY only
  corporateRequiredDocuments?: Record<string, unknown>[] | null;

  // Director AML screening status — COMPANY only
  directorAmlStatus?: Record<string, unknown> | null;

  /** Unified CTOS-backed people list (COMPANY only); same shape as onboarding application `people`. */
  people?: import("./application-people-display").ApplicationPersonRow[];

  // Director KYC screening status — COMPANY only
  directorKycStatus?: Record<string, unknown> | null;

  // Business AML screening status — COMPANY only
  businessAmlStatus?: Record<string, unknown> | null;
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

// Filter-only status that represents all pending admin action statuses
export type OnboardingApprovalStatusFilter = OnboardingApprovalStatus | "PENDING_ALL";

export interface DirectorKycStatus {
  eodRequestId: string;
  name: string;
  email: string;
  role: string; // "Director", "Shareholder", etc.
  kycStatus: "PENDING" | "EMAIL_SENT" | "LIVENESS_STARTED" | "LIVENESS_PASSED" | "WAIT_FOR_APPROVAL" | "APPROVED" | "REJECTED";
  kycId?: string;
  /** IC / national ID from RegTank form (Government ID Number) */
  governmentIdNumber?: string;
  lastUpdated: string; // ISO timestamp
}

export interface CorporateDirectorData {
  corpIndvDirectorCount: number;
  corpIndvShareholderCount: number;
  corpBizShareholderCount: number;
  directors: DirectorKycStatus[];
  lastSyncedAt: string; // ISO timestamp
}

export interface DirectorAmlStatus {
  kycId: string;
  name: string;
  email: string;
  role: string; // "Director", "Shareholder", etc.
  governmentIdNumber?: string;
  amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
  amlMessageStatus: "DONE" | "PENDING" | "ERROR";
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  lastUpdated: string; // ISO timestamp
}

export interface BusinessShareholderAmlStatus {
  codRequestId: string;
  kybId: string;
  businessName: string;
  sharePercentage?: number | null;
  amlStatus: "Unresolved" | "Approved" | "Rejected" | "Pending";
  amlMessageStatus: "DONE" | "PENDING" | "ERROR";
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  lastUpdated: string; // ISO timestamp
}

export interface CorporateAmlData {
  directors: DirectorAmlStatus[];
  businessShareholders?: BusinessShareholderAmlStatus[];
  lastSyncedAt: string; // ISO timestamp
}

/** CTOS party supplement row as returned on admin onboarding application (camelCase). */
export interface OnboardingApplicationCtosPartySupplement {
  partyKey: string;
  onboardingJson?: unknown;
}

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
  kybPortalUrl: string | null;
  /** Organization DB onboarding_status (single source of truth for admin flow step). */
  onboardingStatus: OnboardingStatusEnum;
  status: OnboardingApprovalStatus;
  ssmVerified: boolean;
  ssmVerifiedAt: string | null;
  ssmVerifiedBy: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  // Approval workflow flags
  onboardingApproved: boolean;
  amlApproved: boolean;
  tncAccepted: boolean;
  ssmApproved: boolean;
  isCompleted: boolean;
  // Sophisticated investor status (only for investor portal)
  isSophisticatedInvestor?: boolean;
  sophisticatedInvestorReason?: string | null;
  // Director KYC status (only for corporate onboarding)
  directorKycStatus?: CorporateDirectorData;
  // Director AML status (only for corporate onboarding)
  directorAmlStatus?: CorporateAmlData;
  // Corporate entities (directors, shareholders, corporate shareholders) - only for corporate onboarding
  corporateEntities?: {
    directors?: Array<Record<string, unknown>>;
    shareholders?: Array<Record<string, unknown>>;
    corporateShareholders?: Array<Record<string, unknown>>;
  };
  /** Latest org-level CTOS `company_json` (subject_ref null); enables CTOS-backed unified KYC/AML in admin onboarding dialog. */
  latestOrganizationCtosCompanyJson?: unknown | null;
  ctosPartySupplements?: OnboardingApplicationCtosPartySupplement[] | null;
  people?: import("./application-people-display").ApplicationPersonRow[];
  /**
   * Derived from unified `people`: true when `hasActionableDirectorShareholder` (same as resend/notify gate). Name retained for API compatibility.
   */
  directorShareholderAmlPending?: boolean;
}

export interface GetOnboardingApplicationsParams extends PaginationParams {
  search?: string;
  portal?: PortalType;
  type?: OrganizationTypeEnum;
  status?: OnboardingApprovalStatusFilter;
}

export interface OnboardingApplicationsResponse {
  applications: OnboardingApplicationResponse[];
  pagination: PaginationResponse;
}

// Site Document Types
export type SiteDocumentType =
  | "TERMS_AND_CONDITIONS"
  | "PRIVACY_POLICY"
  | "RISK_DISCLOSURE"
  | "PLATFORM_AGREEMENT"
  | "INVESTOR_GUIDE"
  | "ISSUER_GUIDE"
  | "OTHER";

export type DocumentEventType =
  | "DOCUMENT_CREATED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_REPLACED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_RESTORED";

export interface SiteDocumentResponse {
  id: string;
  type: SiteDocumentType;
  title: string;
  description: string | null;
  file_name: string;
  s3_key: string;
  content_type: string;
  file_size: number;
  version: number;
  is_active: boolean;
  show_in_account: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface GetSiteDocumentsParams extends PaginationParams {
  type?: SiteDocumentType;
  includeInactive?: boolean;
  search?: string;
}

export interface SiteDocumentsResponse {
  documents: SiteDocumentResponse[];
  pagination: PaginationResponse;
}

export interface RequestUploadUrlInput {
  type: SiteDocumentType;
  title: string;
  description?: string;
  fileName: string;
  contentType: "application/pdf";
  fileSize: number;
  showInAccount?: boolean;
}

export interface RequestUploadUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  version: number;
}

export interface CreateSiteDocumentInput {
  type: SiteDocumentType;
  title: string;
  description?: string;
  fileName: string;
  s3Key: string;
  contentType: "application/pdf";
  fileSize: number;
  showInAccount?: boolean;
}

export interface UpdateSiteDocumentInput {
  title?: string;
  description?: string | null;
  showInAccount?: boolean;
}

export interface RequestReplaceUrlInput {
  fileName: string;
  contentType: "application/pdf";
  fileSize: number;
}

export interface RequestReplaceUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  previousVersion: number;
  newVersion: number;
}

export interface ConfirmReplaceInput {
  s3Key: string;
  fileName: string;
  fileSize: number;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
  fileName: string;
  contentType: string;
  fileSize: number;
}

// Document Log Types
export interface DocumentLogUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: UserRole[];
}

export interface DocumentLogResponse {
  id: string;
  user_id: string;
  user: DocumentLogUser;
  document_id: string | null;
  event_type: DocumentEventType;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetDocumentLogsParams extends PaginationParams {
  search?: string;
  eventType?: DocumentEventType;
  dateRange?: "24h" | "7d" | "30d" | "all";
}

export interface DocumentLogsResponse {
  logs: DocumentLogResponse[];
  pagination: PaginationResponse;
}

export interface ExportDocumentLogsParams extends Omit<GetDocumentLogsParams, "page" | "pageSize"> {
  eventTypes?: DocumentEventType[];
  format?: "csv" | "json";
}

// Product Logs
export type ProductEventType =
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED";

export interface ProductLogUser {
  first_name: string;
  last_name: string;
  email: string;
}

export interface ProductLogResponse {
  id: string;
  user_id: string;
  user: ProductLogUser;
  product_id: string | null;
  event_type: ProductEventType;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GetProductLogsParams extends PaginationParams {
  search?: string;
  eventType?: ProductEventType;
  dateRange?: "24h" | "7d" | "30d" | "all";
}

export interface ProductLogsResponse {
  logs: ProductLogResponse[];
  pagination: PaginationResponse;
}

export interface ExportProductLogsParams extends Omit<GetProductLogsParams, "page" | "pageSize"> {
  eventTypes?: ProductEventType[];
  format?: "csv" | "json";
}

// Notifications (Admin)
export type AdminNotificationCategory = "AUTHENTICATION" | "SYSTEM" | "MARKETING" | "ANNOUNCEMENT";
export type AdminNotificationPriority = "INFO" | "WARNING" | "CRITICAL";
export type AdminNotificationPortalTarget = "INVESTOR" | "ISSUER";

export interface AdminNotificationType {
  id: string;
  name: string;
  description: string | null;
  category: AdminNotificationCategory;
  default_priority: AdminNotificationPriority;
  portal_targets: AdminNotificationPortalTarget[];
  enabled_platform: boolean;
  enabled_email: boolean;
  user_configurable: boolean;
  retention_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationGroup {
  id: string;
  name: string;
  description: string | null;
  user_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AdminNotificationLog {
  id: string;
  admin_user_id: string;
  target_type: string;
  target_group_id: string | null;
  notification_type_id: string;
  title: string;
  message: string;
  recipient_count: number;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: string | null;
  created_at: string;
  admin: {
    first_name: string;
    last_name: string;
    email: string;
  };
  notification_type: AdminNotificationType | null;
}

export interface AdminNotificationLogPagination {
  total: number;
  limit: number;
  offset: number;
  pages: number;
}

export interface AdminNotificationLogsResponse {
  items: AdminNotificationLog[];
  pagination: AdminNotificationLogPagination;
}

export interface AdminSendNotificationPayload {
  targetType: string;
  userIds?: string[];
  groupId?: string;
  typeId: string;
  title: string;
  message: string;
  linkPath?: string;
  sendToPlatform?: boolean;
  sendToEmail?: boolean;
  expiresAt?: string;
}

export interface AdminUpdateNotificationTypePayload {
  enabled_platform?: boolean;
  enabled_email?: boolean;
  portal_targets?: AdminNotificationPortalTarget[];
}

export interface AdminSeedTypesResponse {
  count: number;
  added: number;
}

// Financing Applications Types
export interface ApplicationListItem {
  id: string;
  issuerOrganizationName: string | null;
  financingTypeLabel: string;
  financingStructureLabel: string;
  requestedAmount: number;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  productId: string | null;
  baseProductId: string | null;
  /**
   * Derived from issuer org unified `people` (not stored on application). True when `hasActionableDirectorShareholder` — issuer may resend/notify per row. Property name is legacy.
   */
  directorShareholderAmlPending?: boolean;
}

export interface GetAdminApplicationsParams extends PaginationParams {
  search?: string;
  status?: string;
  statuses?: string[];
  productId?: string;
}

export interface AdminApplicationsResponse {
  applications: ApplicationListItem[];
  pagination: PaginationResponse;
}

export interface AdminApplicationActionRequiredCountResponse {
  count: number;
  breakdown: {
    submitted: number;
    underReview: number;
    resubmitted: number;
    contractPending: number;
    contractAccepted: number;
    invoicePending: number;
  };
}

export interface ContractListItem {
  id: string;
  contractNumber: string | null;
  title: string | null;
  issuerOrganizationName: string | null;
  contractValue: number;
  status: string;
  updatedAt: string;
}

export interface GetAdminContractsParams extends PaginationParams {
  search?: string;
  status?: string;
  statuses?: string[];
}

export interface AdminContractsResponse {
  contracts: ContractListItem[];
  pagination: PaginationResponse;
}

export interface AdminContractApplicationSummary {
  id: string;
  productId: string | null;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  requestedAmount: number;
}

export interface AdminContractNoteSummary {
  id: string;
  noteReference: string;
  title: string;
  status: string;
  sourceApplicationId: string;
  sourceInvoiceId: string | null;
}

export interface AdminContractDetail {
  id: string;
  contractNumber: string | null;
  title: string | null;
  description: string | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  requestedFacility: number;
  approvedFacility: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  contractDetails: Record<string, unknown> | null;
  offerDetails: Record<string, unknown> | null;
  offerSentByUserName: string | null;
  offerRespondedByUserName: string | null;
  customerDetails: Record<string, unknown> | null;
  applications: AdminContractApplicationSummary[];
  notes: AdminContractNoteSummary[];
}

export interface ApplicationReviewSection {
  id: string;
  application_id: string;
  section: string;
  status: string;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationReviewItem {
  id: string;
  application_id: string;
  item_type: string;
  item_id: string;
  status: string;
  reviewer_user_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationReviewRemark {
  id: string;
  application_id: string;
  scope: string;
  scope_key: string;
  action_type: string;
  remark: string;
  author_user_id: string;
  created_at: string;
  updated_at?: string;
}

export interface ApplicationPendingAmendment {
  id: string;
  application_id: string;
  scope: string;
  scope_key: string;
  remark: string;
  item_type: string | null;
  item_id: string | null;
  author_user_id: string;
  created_at: string;
  updated_at: string;
  author?: { first_name: string; last_name: string };
}

export interface AddPendingAmendmentParams {
  scope: "section" | "item";
  scopeKey?: string;
  remark: string;
  itemType?: "invoice" | "document";
  itemId?: string;
}

export interface ApplicationReviewEvent {
  id: string;
  application_id: string;
  event_type: string;
  scope: string | null;
  scope_key: string | null;
  old_status: string | null;
  new_status: string;
  reviewer_user_id: string | null;
  remark: string | null;
  created_at: string;
}

export interface ReviewItemActionPayload {
  itemType: "invoice" | "document";
  itemId: string;
}

export interface ReviewItemRejectPayload extends ReviewItemActionPayload {
  remark: string;
}

export interface ReviewItemRequestAmendmentPayload extends ReviewItemActionPayload {
  remark: string;
}

// Products
export interface GetProductsParams {
  page: number;
  pageSize: number;
  search?: string;
}

export interface AdminCtosReportListItem {
  id: string;
  issuer_organization_id: string | null;
  investor_organization_id: string | null;
  /** Null = organization CTOS row; set for director/shareholder/corporate subject snapshots. */
  subject_ref?: string | null;
  fetched_at: string;
  created_at: string;
  updated_at: string;
  has_report_html: boolean;
  /** Organization extract: directors with IC/SSM for admin cross-check. Omitted on create until refetch. */
  company_json?: unknown;
  /** Present on list GET; omitted on create response until refetch. */
  financials_json?: unknown;
}
