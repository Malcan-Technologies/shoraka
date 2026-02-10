import type {
  ApiResponse,
  ApiError,
  GetUsersParams,
  UsersResponse,
  UserResponse,
  UpdateUserRolesInput,
  UpdateUserKycInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
  GetAccessLogsParams,
  AccessLogsResponse,
  AccessLogResponse,
  ExportAccessLogsParams,
  DashboardStatsResponse,
  GetAdminUsersParams,
  AdminUsersResponse,
  UpdateAdminRoleInput,
  InviteAdminInput,
  InviteAdminResponse,
  AcceptInvitationInput,
  GetSecurityLogsParams,
  SecurityLogsResponse,
  GetOnboardingLogsParams,
  OnboardingLogsResponse,
  OnboardingLogResponse,
  ExportOnboardingLogsParams,
  GetPendingInvitationsParams,
  PendingInvitationsResponse,
  GetOrganizationsParams,
  OrganizationDetailResponse,
  OrganizationsResponse,
  GetOnboardingApplicationsParams,
  OnboardingApplicationsResponse,
  OnboardingApplicationResponse,
  GetSiteDocumentsParams,
  SiteDocumentsResponse,
  SiteDocumentResponse,
  RequestUploadUrlInput,
  RequestUploadUrlResponse,
  CreateSiteDocumentInput,
  UpdateSiteDocumentInput,
  RequestReplaceUrlInput,
  RequestReplaceUrlResponse,
  ConfirmReplaceInput,
  DownloadUrlResponse,
  GetDocumentLogsParams,
  DocumentLogsResponse,
  ExportDocumentLogsParams,
  GetProductLogsParams,
  ProductLogsResponse,
  ExportProductLogsParams,
  GetActivitiesParams,
  ActivitiesResponse,
  Product,
  GetProductsResponse,
  Application,
  ApplicationStatus,
  CreateApplicationInput,
  UpdateApplicationStepInput,
  Contract,
  ContractDetails,
  CustomerDetails,
  Invoice,
  InvoiceDetails,
} from "@cashsouk/types";
import { tokenRefreshService } from "./token-refresh-service";

export class ApiClient {
  private baseUrl: string;
  private getAccessToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string, getAccessToken?: () => Promise<string | null>) {
    this.baseUrl = baseUrl;
    this.getAccessToken = getAccessToken || null;
  }

  /**
   * Get auth token with automatic refresh support
   * Delegates to TokenRefreshService for all refresh operations
   */
  private async getAuthToken(): Promise<string | null> {
    if (!this.getAccessToken) {
      return null;
    }

    let token = await this.getAccessToken();

    // If no token or expired, refresh via centralized service
    if (!token || tokenRefreshService.isTokenExpired(token)) {
      // eslint-disable-next-line no-console
      console.log("[ApiClient] Token expired or missing, attempting refresh via service...");
      token = await tokenRefreshService.refreshToken();

      // If refresh succeeded, return the fresh token
      if (token) {
        // eslint-disable-next-line no-console
        console.log("[ApiClient] Using refreshed token");
        return token;
      }

      // Refresh failed, try one more time via Amplify as fallback
      // eslint-disable-next-line no-console
      console.log("[ApiClient] Refresh failed, trying Amplify fallback...");
      token = await this.getAccessToken();
    }

    return token;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    const url = `${this.baseUrl}${endpoint}`;

    // Get auth token from Amplify session
    const authToken = await this.getAuthToken();

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    };

    // Add Authorization header with Cognito access token
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // Make request
    // Token refresh is handled automatically by getAuthToken() if token is expired
    const response = await fetch(url, {
      ...options,
      credentials: "include", // Always send cookies
      headers,
    });

    // If unauthorized, return error
    if (response.status === 401) {
      let errorResponse: ApiError;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorResponse = (await response.json()) as ApiError;
        } else {
          errorResponse = {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Session expired. Please log in again.",
            },
            correlationId: response.headers.get("x-correlation-id") || "",
          } as ApiError;
        }
      } catch {
        errorResponse = {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Session expired. Please log in again.",
          },
          correlationId: response.headers.get("x-correlation-id") || "",
        } as ApiError;
      }
      return errorResponse;
    }

    // Handle non-JSON responses (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return response.json() as Promise<ApiResponse<T> | ApiError>;
    }

    // For non-JSON responses, return success if status is ok
    if (response.ok) {
      return {
        success: true,
        data: {} as T,
        correlationId: response.headers.get("x-correlation-id") || "",
      } as ApiResponse<T>;
    }

    // Return error for failed non-JSON responses
    return {
      success: false,
      error: {
        code: "HTTP_ERROR",
        message: `Request failed with status ${response.status}`,
      },
      correlationId: response.headers.get("x-correlation-id") || "",
    } as ApiError;
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T> | ApiError> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T> | ApiError> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  // Admin - User Management
  async getUsers(params: GetUsersParams): Promise<ApiResponse<UsersResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.role) queryParams.append("role", params.role);
    if (params.kycVerified !== undefined)
      queryParams.append("kycVerified", String(params.kycVerified));
    if (params.investorOnboarded !== undefined)
      queryParams.append("investorOnboarded", String(params.investorOnboarded));
    if (params.issuerOnboarded !== undefined)
      queryParams.append("issuerOnboarded", String(params.issuerOnboarded));

    return this.get<UsersResponse>(`/v1/admin/users?${queryParams.toString()}`);
  }

  // Admin - Organization Management
  async getOrganizations(
    params: GetOrganizationsParams
  ): Promise<ApiResponse<OrganizationsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.portal) queryParams.append("portal", params.portal);
    if (params.type) queryParams.append("type", params.type);
    if (params.onboardingStatus) queryParams.append("onboardingStatus", params.onboardingStatus);

    return this.get<OrganizationsResponse>(`/v1/admin/organizations?${queryParams.toString()}`);
  }

  async getOrganizationDetail(
    portal: "investor" | "issuer",
    id: string
  ): Promise<ApiResponse<OrganizationDetailResponse> | ApiError> {
    return this.get<OrganizationDetailResponse>(`/v1/admin/organizations/${portal}/${id}`);
  }

  async updateSophisticatedStatus(
    organizationId: string,
    isSophisticatedInvestor: boolean,
    reason: string
  ): Promise<ApiResponse<{ success: boolean }> | ApiError> {
    return this.patch<{ success: boolean }>(
      `/v1/admin/organizations/investor/${organizationId}/sophisticated-status`,
      { isSophisticatedInvestor, reason }
    );
  }

  // Admin - Onboarding Applications (Approval Queue)
  async getOnboardingApplications(
    params: GetOnboardingApplicationsParams
  ): Promise<ApiResponse<OnboardingApplicationsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.portal) queryParams.append("portal", params.portal);
    if (params.type) queryParams.append("type", params.type);
    if (params.status) queryParams.append("status", params.status);

    return this.get<OnboardingApplicationsResponse>(
      `/v1/admin/onboarding-applications?${queryParams.toString()}`
    );
  }

  // Get count of pending onboarding applications requiring admin action
  async getPendingApprovalCount(): Promise<ApiResponse<{ count: number }> | ApiError> {
    return this.get<{ count: number }>("/v1/admin/onboarding-applications/pending-count");
  }

  // Get a single onboarding application by ID
  async getOnboardingApplication(
    onboardingId: string
  ): Promise<ApiResponse<{ application: OnboardingApplicationResponse }> | ApiError> {
    return this.get<{ application: OnboardingApplicationResponse }>(
      `/v1/admin/onboarding-applications/${onboardingId}`
    );
  }

  // Request redo onboarding for an application
  // Restart onboarding for an application via RegTank restart API
  async restartOnboarding(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
      verifyLink?: string;
      newRequestId?: string;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
      verifyLink?: string;
      newRequestId?: string;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/restart`, {});
  }

  // Complete final approval for an onboarding application
  async completeFinalApproval(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/complete-final-approval`, {});
  }

  // Approve AML screening for an onboarding application
  async approveAmlScreening(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/approve-aml`, {});
  }

  // Approve SSM verification for a company organization
  async approveSsmVerification(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/approve-ssm`, {});
  }

  // Refresh corporate onboarding status by fetching latest director KYC statuses
  async refreshCorporateStatus(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
      directorsUpdated: number;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
      directorsUpdated: number;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/refresh-corporate-status`, {});
  }

  // Refresh corporate AML status by fetching latest director AML statuses
  async refreshCorporateAmlStatus(onboardingId: string): Promise<
    | ApiResponse<{
      success: boolean;
      message: string;
      directorsUpdated: number;
    }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
      directorsUpdated: number;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/refresh-aml-status`, {});
  }

  async getUser(id: string): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.get<{ user: UserResponse }>(`/v1/admin/users/${id}`);
  }

  async updateUserRoles(
    id: string,
    roles: UpdateUserRolesInput
  ): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/roles`, roles);
  }

  async updateUserKyc(
    id: string,
    kyc: UpdateUserKycInput
  ): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/kyc`, kyc);
  }

  async updateUserOnboarding(
    id: string,
    onboarding: UpdateUserOnboardingInput
  ): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/onboarding`, onboarding);
  }

  async updateUserProfile(
    id: string,
    profile: UpdateUserProfileInput
  ): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/profile`, profile);
  }

  // Self-service profile update (any authenticated user)
  async updateMyProfile(
    profile: UpdateUserProfileInput
  ): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/auth/profile`, profile);
  }

  // Self-service password change (any authenticated user)
  async changePassword(data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<{ success: boolean; sessionRevoked?: boolean }> | ApiError> {
    return this.post<{ success: boolean; sessionRevoked?: boolean }>(
      `/v1/auth/change-password`,
      data
    );
  }

  // Update user's 5-letter ID (admin only)
  async updateUserId(
    userId: string,
    newUserId: string
  ): Promise<ApiResponse<{ user_id: string }> | ApiError> {
    return this.patch<{ user_id: string }>(`/v1/admin/users/${userId}/user-id`, {
      userId: newUserId,
    });
  }

  // Verify email with code (for unverified emails)
  async verifyEmail(data: { code: string }): Promise<ApiResponse<{ success: boolean }> | ApiError> {
    return this.post<{ success: boolean }>(`/v1/auth/verify-email`, data);
  }

  // Admin - Dashboard Statistics
  async getDashboardStats(): Promise<ApiResponse<DashboardStatsResponse> | ApiError> {
    return this.get<DashboardStatsResponse>(`/v1/admin/dashboard/stats`);
  }

  // Admin - Access Logs
  async getAccessLogs(
    params: GetAccessLogsParams
  ): Promise<ApiResponse<AccessLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.status) queryParams.append("status", params.status);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.userId) queryParams.append("userId", params.userId);

    return this.get<AccessLogsResponse>(`/v1/admin/access-logs?${queryParams.toString()}`);
  }

  async getAccessLog(id: string): Promise<ApiResponse<{ log: AccessLogResponse }> | ApiError> {
    return this.get<{ log: AccessLogResponse }>(`/v1/admin/access-logs/${id}`);
  }

  async exportAccessLogs(params: ExportAccessLogsParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.status) queryParams.append("status", params.status);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.userId) queryParams.append("userId", params.userId);
    queryParams.append("format", params.format || "json");

    const url = `${this.baseUrl}/v1/admin/access-logs/export?${queryParams.toString()}`;
    const authToken = await this.getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Admin - Admin User Management
  async getAdminUsers(
    params: GetAdminUsersParams
  ): Promise<ApiResponse<AdminUsersResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.roleDescription) queryParams.append("roleDescription", params.roleDescription);
    if (params.status) queryParams.append("status", params.status);

    return this.get<AdminUsersResponse>(`/v1/admin/admin-users?${queryParams.toString()}`);
  }

  async updateAdminRole(
    id: string,
    data: UpdateAdminRoleInput
  ): Promise<
    ApiResponse<{ user: UserResponse; admin: { role_description: string } | null }> | ApiError
  > {
    return this.put<{ user: UserResponse; admin: { role_description: string } | null }>(
      `/v1/admin/admin-users/${id}/role`,
      data
    );
  }

  async deactivateAdmin(id: string): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.put<{ user: UserResponse }>(`/v1/admin/admin-users/${id}/deactivate`);
  }

  async reactivateAdmin(id: string): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.put<{ user: UserResponse }>(`/v1/admin/admin-users/${id}/reactivate`);
  }

  async generateInviteLink(
    data: InviteAdminInput
  ): Promise<ApiResponse<{ inviteUrl: string }> | ApiError> {
    return this.post<{ inviteUrl: string }>(`/v1/admin/generate-invite-link`, data);
  }

  async inviteAdmin(data: InviteAdminInput): Promise<ApiResponse<InviteAdminResponse> | ApiError> {
    return this.post<InviteAdminResponse>(`/v1/admin/invite`, data);
  }

  async acceptInvitation(
    data: AcceptInvitationInput
  ): Promise<ApiResponse<{ user: UserResponse; admin: { role_description: string } }> | ApiError> {
    return this.post<{ user: UserResponse; admin: { role_description: string } }>(
      `/v1/admin/accept-invitation`,
      data
    );
  }

  async getPendingInvitations(
    params: GetPendingInvitationsParams
  ): Promise<ApiResponse<PendingInvitationsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.roleDescription) queryParams.append("roleDescription", params.roleDescription);

    return this.get<PendingInvitationsResponse>(
      `/v1/admin/invitations/pending?${queryParams.toString()}`
    );
  }

  async resendInvitation(
    invitationId: string
  ): Promise<
    ApiResponse<{ messageId?: string; emailSent: boolean; emailError?: string }> | ApiError
  > {
    return this.post<{ messageId?: string; emailSent: boolean; emailError?: string }>(
      `/v1/admin/invitations/${invitationId}/resend`,
      {}
    );
  }

  async revokeInvitation(
    invitationId: string
  ): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/admin/invitations/${invitationId}/revoke`);
  }

  // Admin - Security Logs
  async getSecurityLogs(
    params: GetSecurityLogsParams
  ): Promise<ApiResponse<SecurityLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.userId) queryParams.append("userId", params.userId);

    return this.get<SecurityLogsResponse>(`/v1/admin/security-logs?${queryParams.toString()}`);
  }

  // Admin - Onboarding Logs
  async getOnboardingLogs(
    params: GetOnboardingLogsParams
  ): Promise<ApiResponse<OnboardingLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.role) queryParams.append("role", params.role);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.userId) queryParams.append("userId", params.userId);

    return this.get<OnboardingLogsResponse>(`/v1/admin/onboarding-logs?${queryParams.toString()}`);
  }

  async getOnboardingLog(
    id: string
  ): Promise<ApiResponse<{ log: OnboardingLogResponse }> | ApiError> {
    return this.get<{ log: OnboardingLogResponse }>(`/v1/admin/onboarding-logs/${id}`);
  }

  async exportOnboardingLogs(params: ExportOnboardingLogsParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.role) queryParams.append("role", params.role);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.userId) queryParams.append("userId", params.userId);
    queryParams.append("format", params.format || "json");

    const url = `${this.baseUrl}/v1/admin/onboarding-logs/export?${queryParams.toString()}`;
    const authToken = await this.getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Admin - Site Documents
  async getSiteDocuments(
    params: GetSiteDocumentsParams
  ): Promise<ApiResponse<SiteDocumentsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.type) queryParams.append("type", params.type);
    if (params.includeInactive !== undefined)
      queryParams.append("includeInactive", String(params.includeInactive));
    if (params.search) queryParams.append("search", params.search);

    return this.get<SiteDocumentsResponse>(
      `/v1/admin/site-documents?${queryParams.toString()}`
    );
  }

  async getSiteDocument(
    id: string
  ): Promise<ApiResponse<{ document: SiteDocumentResponse }> | ApiError> {
    return this.get<{ document: SiteDocumentResponse }>(`/v1/admin/site-documents/${id}`);
  }

  async requestSiteDocumentUploadUrl(
    data: RequestUploadUrlInput
  ): Promise<ApiResponse<RequestUploadUrlResponse> | ApiError> {
    return this.post<RequestUploadUrlResponse>(`/v1/admin/site-documents/upload-url`, data);
  }

  async createSiteDocument(
    data: CreateSiteDocumentInput
  ): Promise<ApiResponse<{ document: SiteDocumentResponse }> | ApiError> {
    return this.post<{ document: SiteDocumentResponse }>(`/v1/admin/site-documents`, data);
  }

  async updateSiteDocument(
    id: string,
    data: UpdateSiteDocumentInput
  ): Promise<ApiResponse<{ document: SiteDocumentResponse }> | ApiError> {
    return this.patch<{ document: SiteDocumentResponse }>(
      `/v1/admin/site-documents/${id}`,
      data
    );
  }

  async requestSiteDocumentReplaceUrl(
    id: string,
    data: RequestReplaceUrlInput
  ): Promise<ApiResponse<RequestReplaceUrlResponse> | ApiError> {
    return this.post<RequestReplaceUrlResponse>(
      `/v1/admin/site-documents/${id}/replace-url`,
      data
    );
  }

  async confirmSiteDocumentReplace(
    id: string,
    data: ConfirmReplaceInput
  ): Promise<ApiResponse<{ document: SiteDocumentResponse }> | ApiError> {
    return this.post<{ document: SiteDocumentResponse }>(
      `/v1/admin/site-documents/${id}/replace`,
      data
    );
  }

  async deleteSiteDocument(
    id: string
  ): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/admin/site-documents/${id}`);
  }

  async restoreSiteDocument(
    id: string
  ): Promise<ApiResponse<{ document: SiteDocumentResponse }> | ApiError> {
    return this.post<{ document: SiteDocumentResponse }>(
      `/v1/admin/site-documents/${id}/restore`,
      {}
    );
  }

  async getAdminDocumentDownloadUrl(
    id: string
  ): Promise<ApiResponse<DownloadUrlResponse> | ApiError> {
    return this.get<DownloadUrlResponse>(
      `/v1/admin/site-documents/${id}/download`
    );
  }

  // User - Site Documents (authenticated users)
  async getActiveDocuments(): Promise<
    ApiResponse<{ documents: SiteDocumentResponse[] }> | ApiError
  > {
    return this.get<{ documents: SiteDocumentResponse[] }>(`/v1/documents`);
  }

  async getAccountDocuments(): Promise<
    ApiResponse<{ documents: SiteDocumentResponse[] }> | ApiError
  > {
    return this.get<{ documents: SiteDocumentResponse[] }>(`/v1/documents/account`);
  }

  async getDocumentDownloadUrl(
    id: string
  ): Promise<ApiResponse<DownloadUrlResponse> | ApiError> {
    return this.get<DownloadUrlResponse>(`/v1/documents/${id}/download`);
  }

  // Admin - Document Logs
  async getDocumentLogs(
    params: GetDocumentLogsParams
  ): Promise<ApiResponse<DocumentLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);

    return this.get<DocumentLogsResponse>(
      `/v1/admin/document-logs?${queryParams.toString()}`
    );
  }

  async exportDocumentLogs(params: ExportDocumentLogsParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    queryParams.append("format", params.format || "json");

    const url = `${this.baseUrl}/v1/admin/document-logs/export?${queryParams.toString()}`;
    const authToken = await this.getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Admin - Product Logs
  async getProductLogs(
    params: GetProductLogsParams
  ): Promise<ApiResponse<ProductLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);

    return this.get<ProductLogsResponse>(
      `/v1/admin/product-logs?${queryParams.toString()}`
    );
  }

  async exportProductLogs(params: ExportProductLogsParams): Promise<Blob> {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    queryParams.append("format", params.format || "json");

    const url = `${this.baseUrl}/v1/admin/product-logs/export?${queryParams.toString()}`;
    const authToken = await this.getAuthToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Activities
  async getActivities(params: GetActivitiesParams): Promise<ApiResponse<ActivitiesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("limit", String(params.limit));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
    if (params.eventTypes && params.eventTypes.length > 0)
      queryParams.append("eventTypes", params.eventTypes.join(","));
    if (params.categories && params.categories.length > 0)
      queryParams.append("categories", params.categories.join(","));
    if (params.dateRange) queryParams.append("dateRange", params.dateRange);
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
    if (params.organizationId) queryParams.append("organizationId", params.organizationId);
    if (params.portalType) queryParams.append("portalType", params.portalType);

    return this.get<ActivitiesResponse>(`/v1/activities?${queryParams.toString()}`);
  }

  // Products
  async getProducts(params: { page: number; pageSize: number; search?: string }): Promise<ApiResponse<GetProductsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);

    return this.get<GetProductsResponse>(`/v1/products?${queryParams.toString()}`);
  }

  async getProduct(id: string): Promise<ApiResponse<Product> | ApiError> {
    return this.get<Product>(`/v1/products/${id}`);
  }

  async createProduct(data: { workflow: unknown[] }): Promise<ApiResponse<Product> | ApiError> {
    return this.post<Product>("/v1/products", data);
  }

  async updateProduct(
    id: string,
    data: { workflow?: unknown[]; completeCreate?: boolean }
  ): Promise<ApiResponse<Product> | ApiError> {
    return this.patch<Product>(`/v1/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<ApiResponse<unknown> | ApiError> {
    return this.delete<unknown>(`/v1/products/${id}`);
  }

  /** Request presigned URL for product image (admin). PNG only, 5MB max. */
  async requestProductImageUploadUrl(
    productId: string,
    body: { fileName: string; contentType: string; fileSize?: number }
  ): Promise<ApiResponse<{ uploadUrl: string; s3Key: string; expiresIn: number }> | ApiError> {
    return this.post<{ uploadUrl: string; s3Key: string; expiresIn: number }>(
      `/v1/products/${productId}/upload-image-url`,
      body
    );
  }

  /** Request presigned URL for product document template (admin). Backend loads product and returns uploadUrl + s3Key for slot. */
  async requestProductTemplateUploadUrl(
    productId: string,
    body: {
      categoryKey: string;
      templateIndex: number;
      fileName: string;
      contentType: string;
      fileSize?: number;
    }
  ): Promise<ApiResponse<{ uploadUrl: string; s3Key: string; expiresIn: number }> | ApiError> {
    return this.post<{ uploadUrl: string; s3Key: string; expiresIn: number }>(
      `/v1/products/${productId}/upload-template-url`,
      body
    );
  }


  // Applications
  async createApplication(data: CreateApplicationInput): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications`, data);
  }

  async getApplication(id: string): Promise<ApiResponse<Application> | ApiError> {
    return this.get<Application>(`/v1/applications/${id}`);
  }

  async updateApplicationStep(id: string, data: UpdateApplicationStepInput): Promise<ApiResponse<Application> | ApiError> {
    return this.patch<Application>(`/v1/applications/${id}/step`, data);
  }

  async updateApplicationStatus(id: string, status: ApplicationStatus): Promise<ApiResponse<Application> | ApiError> {
    return this.patch<Application>(`/v1/applications/${id}/status`, { status });
  }

  async archiveApplication(id: string): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications/${id}/archive`, {});
  }

  // Notifications
  async getNotifications(params: {
    read?: boolean;
    category?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<
    | ApiResponse<{
      items: any[];
      pagination: {
        total: number;
        unreadCount: number;
        limit: number;
        offset: number;
        pages: number;
      };
    }>
    | ApiError
  > {
    const queryParams = new URLSearchParams();
    if (params.read !== undefined) queryParams.append("read", String(params.read));
    if (params.category) queryParams.append("category", params.category);
    if (params.priority) queryParams.append("priority", params.priority);
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.offset) queryParams.append("offset", String(params.offset));

    return this.get<{
      items: any[];
      pagination: {
        total: number;
        unreadCount: number;
        limit: number;
        offset: number;
        pages: number;
      };
    }>(`/v1/notifications?${queryParams.toString()}`);
  }

  async getUnreadNotificationsCount(): Promise<ApiResponse<{ count: number }> | ApiError> {
    return this.get<{ count: number }>("/v1/notifications/unread-count");
  }

  async markNotificationAsRead(id: string): Promise<ApiResponse<any> | ApiError> {
    return this.patch<any>(`/v1/notifications/${id}/read`);
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<{ count: number }> | ApiError> {
    return this.patch<{ count: number }>("/v1/notifications/read-all");
  }

  async getNotificationPreferences(): Promise<ApiResponse<any[]> | ApiError> {
    return this.get<any[]>("/v1/notifications/preferences");
  }

  async updateNotificationPreference(
    typeId: string,
    data: { enabled_platform: boolean; enabled_email: boolean }
  ): Promise<ApiResponse<any> | ApiError> {
    return this.put<any>(`/v1/notifications/preferences/${typeId}`, data);
  }

  // Admin Notifications
  async getAdminNotificationTypes(): Promise<ApiResponse<any[]> | ApiError> {
    return this.get<any[]>("/v1/notifications/admin/types");
  }

  async updateAdminNotificationType(id: string, data: any): Promise<ApiResponse<any> | ApiError> {
    return this.patch<any>(`/v1/notifications/admin/types/${id}`, data);
  }

  async sendAdminNotification(data: any): Promise<ApiResponse<any> | ApiError> {
    return this.post<any>("/v1/notifications/admin/send", data);
  }

  async getAdminNotificationGroups(): Promise<ApiResponse<any[]> | ApiError> {
    return this.get<any[]>("/v1/notifications/admin/groups");
  }

  async getAdminNotificationLogs(params: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    target?: string;
  }): Promise<ApiResponse<{ items: any[]; pagination: any }> | ApiError> {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.offset) queryParams.append("offset", String(params.offset));
    if (params.search) queryParams.append("search", params.search);
    if (params.type) queryParams.append("type", params.type);
    if (params.target) queryParams.append("target", params.target);

    return this.get<{ items: any[]; pagination: any }>(
      `/v1/notifications/admin/logs?${queryParams.toString()}`
    );
  }

  async createAdminNotificationGroup(data: any): Promise<ApiResponse<any> | ApiError> {
    return this.post<any>("/v1/notifications/admin/groups", data);
  }

  async updateAdminNotificationGroup(id: string, data: any): Promise<ApiResponse<any> | ApiError> {
    return this.patch<any>(`/v1/notifications/admin/groups/${id}`, data);
  }

  async deleteAdminNotificationGroup(id: string): Promise<ApiResponse<any> | ApiError> {
    return this.delete<any>(`/v1/notifications/admin/groups/${id}`);
  }

  async seedAdminNotificationTypes(): Promise<ApiResponse<{ count: number }> | ApiError> {
    return this.post<{ count: number }>("/v1/notifications/admin/seed-types");
  }

  // Contracts
  async createContract(applicationId: string): Promise<ApiResponse<Contract> | ApiError> {
    return this.post<Contract>("/v1/contracts", { applicationId });
  }

  async getContract(id: string): Promise<ApiResponse<Contract> | ApiError> {
    return this.get<Contract>(`/v1/contracts/${id}`);
  }

  async updateContract(
    id: string,
    data: {
      contract_details?: ContractDetails;
      customer_details?: CustomerDetails;
      status?: string;
    }
  ): Promise<ApiResponse<Contract> | ApiError> {
    return this.patch<Contract>(`/v1/contracts/${id}`, data);
  }

  async unlinkContract(id: string): Promise<ApiResponse<void> | ApiError> {
    return this.post<void>(`/v1/contracts/${id}/unlink`, {});
  }

  async getApprovedContracts(organizationId: string): Promise<ApiResponse<Contract[]> | ApiError> {
    return this.get<Contract[]>(`/v1/contracts/approved?organizationId=${organizationId}`);
  }

  async requestContractUploadUrl(
    id: string,
    data: {
      fileName: string;
      contentType: string;
      fileSize: number;
      type: "contract" | "consent";
      existingS3Key?: string;
    }
  ): Promise<ApiResponse<{ uploadUrl: string; s3Key: string; expiresIn: number }> | ApiError> {
    return this.post<{ uploadUrl: string; s3Key: string; expiresIn: number }>(
      `/v1/contracts/${id}/upload-url`,
      data
    );
  }

  // Invoices
  async createInvoice(data: {
    applicationId: string;
    contractId?: string;
    details: InvoiceDetails;
  }): Promise<ApiResponse<Invoice> | ApiError> {
    return this.post<Invoice>("/v1/invoices", data);
  }

  async getInvoice(id: string): Promise<ApiResponse<Invoice> | ApiError> {
    return this.get<Invoice>(`/v1/invoices/${id}`);
  }

  async updateInvoice(
    id: string,
    details: Partial<InvoiceDetails> & { contractId?: string | null; document?: any }
  ): Promise<ApiResponse<Invoice> | ApiError> {
    /**
     * UPDATE INVOICE
     *
     * Payload can include:
     * - details: partial invoice details (optional)
     * - document: top-level document field (optional)
     * - contractId: optional, can be null or cuid string
     */
    const { contractId, document, ...detailsRest } = details;
    const body: any = {};
    
    if (Object.keys(detailsRest).length > 0) {
      body.details = detailsRest;
    }
    
    if (document !== undefined) {
      body.document = document;
    }
    
    if (contractId !== undefined) {
      body.contractId = contractId;
    }
    
    return this.patch<Invoice>(`/v1/invoices/${id}`, body);
  }

  async deleteInvoice(id: string): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/invoices/${id}`);
  }

  async getInvoicesByApplication(applicationId: string): Promise<ApiResponse<Invoice[]> | ApiError> {
    return this.get<Invoice[]>(`/v1/invoices/by-application/${applicationId}`);
  }

  async getInvoicesByContract(contractId: string): Promise<ApiResponse<Invoice[]> | ApiError> {
    return this.get<Invoice[]>(`/v1/invoices/by-contract/${contractId}`);
  }

  async requestInvoiceUploadUrl(
    id: string,
    data: {
      fileName: string;
      contentType: string;
      fileSize: number;
      existingS3Key?: string;
    }
  ): Promise<ApiResponse<{ uploadUrl: string; s3Key: string; expiresIn: number }> | ApiError> {
    return this.post<{ uploadUrl: string; s3Key: string; expiresIn: number }>(
      `/v1/invoices/${id}/upload-url`,
      data
    );
  }

  async deleteInvoiceDocument(
    id: string,
    s3Key: string
  ): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/invoices/${id}/document`, {
      body: JSON.stringify({ s3Key }),
    });
  }

  // Invoice APIs removed.
  // Methods related to invoices were deleted because invoice backend was removed.

  async deleteContractDocument(
    id: string,
    s3Key: string
  ): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/contracts/${id}/document`, {
      body: JSON.stringify({ s3Key }),
    });
  }
}

export function createApiClient(
  baseUrl?: string,
  getAccessToken?: () => Promise<string | null>
): ApiClient {
  return new ApiClient(
    baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
    getAccessToken
  );
}
