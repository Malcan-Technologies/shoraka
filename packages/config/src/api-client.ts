import type {
  ApiResponse,
  ApiError,
  SigningEnvelopeDto,
  ExternalSigningSessionDto,
  RecipientBinding,
  GetUsersParams,
  UsersResponse,
  UserDetailResponse,
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
  GetOrganizationLinkedRecordsParams,
  OrganizationLinkedRecordsResponse,
  UpdateAdminOrganizationProfileInput,
  GetOnboardingApplicationsParams,
  OnboardingApplicationsResponse,
  OnboardingApplicationResponse,
  GetAdminApplicationsParams,
  AdminApplicationActionRequiredCountResponse,
  AdminApplicationsResponse,
  GetAdminContractsParams,
  AdminContractsResponse,
  AdminContractDetail,
  AdditionalFeeLine,
  InvoiceOfferFeeScheduleWriteMode,
  DownloadUrlResponse,
  GetProductLogsParams,
  ProductLogsResponse,
  ExportProductLogsParams,
  GetActivitiesParams,
  ActivitiesResponse,
  Product,
  GetProductsResponse,
  Application,
  ApplicationProductVersionCompare,
  IssuerProductLiveCheck,
  ApplicationStatus,
  CreateApplicationInput,
  UpdateApplicationStepInput,
  Contract,
  ContractDetails,
  CustomerDetails,
  Invoice,
  InvoiceDetails,
  AdminNotificationType,
  AdminNotificationGroup,
  AdminNotificationLog,
  AdminNotificationLogPagination,
  AdminSendNotificationPayload,
  AdminUpdateNotificationTypePayload,
  AdminSeedTypesResponse,
  WithdrawReason,
  AdminCtosReportListItem,
  SoukscoreRiskRating,
  RecipientEkycSession,
  RecipientEkycSessionStatus,
  CreateNoteFromApplicationInput,
  CreateNoteInvestmentInput,
  CreateInvestorDepositInput,
  InvestorDepositLimits,
  InvestorDepositResponse,
  CreateIssuerOnboardingFeeInput,
  IssuerOnboardingFeeResponse,
  IssuerOnboardingFeeStatusResponse,
  ApplicationProcessingFeeResponse,
  EligibleNoteInvoicesResponse,
  GetAdminNotesParams,
  MarketplaceNoteDetail,
  NoteDetail,
  NoteSettlementPreviewResult,
  NoteActionRequiredCountResponse,
  GetAdminInvestmentsParams,
  GetAdminInvestmentsResponse,
  PendingIssuerPayoutsResponse,
  PendingInvestorWithdrawalsCountResponse,
  PendingRepaymentsResponse,
  PendingServiceFeeTrusteeLettersResponse,
  NoteEvent,
  NoteLedgerBucketActivityResponse,
  NoteLedgerBucketBalancesResponse,
  NoteLedgerEntry,
  NotesResponse,
  InvestorBalanceActivityResponse,
  ExportInvestorBalanceStatementParams,
  InvestorPortfolioResponse,
  InvestorPortfolioHistoryRange,
  InvestorPortfolioHistoryResponse,
  PlatformFinanceSetting,
  TrusteeSignatureUploadUrlRequest,
  TrusteeSignatureUploadUrlResponse,
  IssuerPaymentEvidenceUploadUrlRequest,
  IssuerPaymentEvidenceUploadUrlResponse,
  RecordNotePaymentInput,
  SettlementPreviewInput,
  UpdateNoteFeaturedInput,
  UpdateNoteDraftInput,
  ProspectusReviewGetResponse,
  ProspectusReviewDetail,
  ProspectusReviewPreviewResponse,
  SaveProspectusReviewDraftInput,
  WithdrawalInstruction,
  ShorakaWithdrawalState,
  ShorakaSubmitOrderStateResponse,
  GatewayPaymentDetailDto,
  GatewayPaymentListResponse,
  GatewayPaymentPendingCountResponse,
  GatewayPaymentReceiptDto,
  GatewayPaymentReceiptListResponse,
  GatewayPaymentReceiptPdfUrlResponse,
  CurlecGatewayAccount,
  GatewayReconExceptionDto,
  GatewayReconExceptionListResponse,
  GatewayReconPendingCountResponse,
  GatewayReconRunStatus,
  GatewayReconRunDetailDto,
  GatewayReconRunListResponse,
} from "@cashsouk/types";
import { tokenRefreshService } from "./token-refresh-service";

type OverdueLateChargeInput = {
  receiptAmount?: number;
  receiptDate?: string;
};

type OverdueLateChargeResult = {
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
  availableLateFeeHeadroomAmount: number | null;
  suggestedTawidhAmount: number;
  suggestedGharamahAmount: number;
  message: string;
};

type AdminApplicationDetail = Application &
  Record<string, unknown> & {
    processingFeePaid?: boolean;
    invoices?: Array<{
      id: string;
      application_id?: string;
      details?: Record<string, unknown>;
      status?: string;
      offer_details?: unknown;
      contract_id?: string | null;
      facilityFeeAvailableToReserve?: number | null;
    }>;
    linked_notes?: Array<{
      id: string;
      note_reference: string;
      title: string;
      status: string;
      source_contract_id: string | null;
      source_invoice_id: string | null;
    }>;
    contract?: {
      id?: string;
      contract_details?: Record<string, unknown> | null;
      customer_details?: Record<string, unknown> | null;
      status?: string;
      invoices?: Array<{
        id: string;
        application_id: string;
        details?: unknown;
        status?: string;
        offer_details?: unknown;
      }>;
    } | null;
    issuer_organization: {
      name: string | null;
      owner: {
        first_name: string;
        last_name: string;
        email: string;
      };
    };
    visible_review_sections?: string[];
    /** Frozen product.workflow for application.product_version (Acceptance / signing). */
    product_workflow?: unknown[] | null;
  };
/** Application activity log row from GET /v1/applications/:id/logs */
export type ApplicationLogEntry = {
  id: string;
  event_type: string;
  activity?: unknown;
  actor_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  remark?: string | null;
  entityId?: string | null;
  entity_id?: string | null;
  review_cycle?: number | null;
};

type AdminApplicationActionResult = Record<string, unknown>;
type PendingAmendmentItem = {
  id: string;
  scope: string;
  scope_key: string;
  remark: string;
  item_type: string | null;
  item_id: string | null;
  author: { first_name: string; last_name: string };
};

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

  async getRecipientEkycSessionStatus(
    token: string
  ): Promise<ApiResponse<RecipientEkycSessionStatus> | ApiError> {
    const query = new URLSearchParams({ token });
    return this.get<RecipientEkycSessionStatus>(`/v1/ekyc/status?${query.toString()}`);
  }

  /** Alias for capture.html polling compatibility. */
  async getEkycSessionStatus(
    token: string
  ): Promise<ApiResponse<RecipientEkycSessionStatus> | ApiError> {
    return this.getRecipientEkycSessionStatus(token);
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

  async getOrganizationLinkedRecords(
    portal: "investor" | "issuer",
    id: string,
    params: GetOrganizationLinkedRecordsParams
  ): Promise<ApiResponse<OrganizationLinkedRecordsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.type) queryParams.append("type", params.type);
    return this.get<OrganizationLinkedRecordsResponse>(
      `/v1/admin/organizations/${portal}/${id}/linked-records?${queryParams.toString()}`
    );
  }

  async getAdminInvestorBalanceActivity(
    organizationId: string,
    params: {
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<ApiResponse<InvestorBalanceActivityResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page ?? 1));
    queryParams.append("pageSize", String(params.pageSize ?? 20));
    return this.get<InvestorBalanceActivityResponse>(
      `/v1/admin/organizations/investor/${encodeURIComponent(organizationId)}/balance-activity?${queryParams.toString()}`
    );
  }

  async updateAdminOrganizationProfile(
    portal: "investor" | "issuer",
    id: string,
    data: UpdateAdminOrganizationProfileInput
  ): Promise<ApiResponse<{ success: true }> | ApiError> {
    return this.patch<{ success: true }>(`/v1/admin/organizations/${portal}/${id}`, data);
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

  async refreshCorporateEntities(
    portal: "investor" | "issuer",
    organizationId: string
  ): Promise<ApiResponse<{ success: boolean; message: string }> | ApiError> {
    return this.post<{ success: boolean; message: string }>(
      `/v1/admin/organizations/${portal}/${organizationId}/refresh-corporate-entities`,
      {}
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

  // Admin - Financing Applications
  async getAdminApplications(
    params: GetAdminApplicationsParams
  ): Promise<ApiResponse<AdminApplicationsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.statuses && params.statuses.length > 0) {
      queryParams.append("statuses", params.statuses.join(","));
    }
    if (params.productId) queryParams.append("productId", params.productId);

    return this.get<AdminApplicationsResponse>(`/v1/admin/applications?${queryParams.toString()}`);
  }

  async getAdminApplicationActionRequiredCount(): Promise<
    ApiResponse<AdminApplicationActionRequiredCountResponse> | ApiError
  > {
    return this.get<AdminApplicationActionRequiredCountResponse>(
      "/v1/admin/applications/action-count"
    );
  }

  async getAdminContracts(
    params: GetAdminContractsParams
  ): Promise<ApiResponse<AdminContractsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.statuses && params.statuses.length > 0) {
      queryParams.append("statuses", params.statuses.join(","));
    }

    return this.get<AdminContractsResponse>(`/v1/admin/contracts?${queryParams.toString()}`);
  }

  async getAdminContractDetail(id: string): Promise<ApiResponse<AdminContractDetail> | ApiError> {
    return this.get<AdminContractDetail>(`/v1/admin/contracts/${id}`);
  }

  async waiveAdminContractFacilityFee(
    id: string,
    reason: string
  ): Promise<ApiResponse<AdminContractDetail> | ApiError> {
    return this.post<AdminContractDetail>(`/v1/admin/contracts/${id}/facility-fee/waive`, { reason });
  }

  async setAdminContractFacilityEnabled(
    id: string,
    enabled: boolean,
    reason?: string
  ): Promise<ApiResponse<AdminContractDetail> | ApiError> {
    return this.post<AdminContractDetail>(`/v1/admin/contracts/${id}/facility/enabled`, {
      enabled,
      ...(reason ? { reason } : {}),
    });
  }

  async getAdminNotes(params: GetAdminNotesParams): Promise<ApiResponse<NotesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.status) queryParams.append("status", params.status);
    if (params.listingStatus) queryParams.append("listingStatus", params.listingStatus);
    if (params.fundingStatus) queryParams.append("fundingStatus", params.fundingStatus);
    if (params.servicingStatus) queryParams.append("servicingStatus", params.servicingStatus);
    if (params.issuerOrganizationId) {
      queryParams.append("issuerOrganizationId", params.issuerOrganizationId);
    }
    if (params.paymaster) queryParams.append("paymaster", params.paymaster);
    if (params.featuredOnly) queryParams.append("featuredOnly", "true");
    if (params.excludeRepaid) queryParams.append("excludeRepaid", "true");
    if (params.excludeFullySettledRegistryNotes) {
      queryParams.append("excludeFullySettledRegistryNotes", "true");
    }

    return this.get<NotesResponse>(`/v1/admin/notes?${queryParams.toString()}`);
  }

  async getAdminNoteDetail(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.get<NoteDetail>(`/v1/admin/notes/${id}`);
  }

  async getAdminNoteSourceInvoices(): Promise<
    ApiResponse<EligibleNoteInvoicesResponse> | ApiError
  > {
    return this.get<EligibleNoteInvoicesResponse>("/v1/admin/notes/source-invoices");
  }

  async createAdminNoteFromApplication(
    applicationId: string,
    data: CreateNoteFromApplicationInput = {}
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/from-application/${applicationId}`, data);
  }

  async createAdminNoteFromInvoice(
    invoiceId: string,
    data: Omit<CreateNoteFromApplicationInput, "sourceInvoiceId"> = {}
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/from-invoice/${invoiceId}`, data);
  }

  async updateAdminNoteDraft(
    id: string,
    data: UpdateNoteDraftInput
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.patch<NoteDetail>(`/v1/admin/notes/${id}/draft`, data);
  }

  async updateAdminNoteFeatured(
    id: string,
    data: UpdateNoteFeaturedInput
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.patch<NoteDetail>(`/v1/admin/notes/${id}/featured`, data);
  }

  async publishAdminNote(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/publish`, {});
  }

  async getAdminProspectusReview(
    id: string
  ): Promise<ApiResponse<ProspectusReviewGetResponse> | ApiError> {
    return this.get<ProspectusReviewGetResponse>(`/v1/admin/notes/${id}/prospectus-review`);
  }

  async saveAdminProspectusReviewDraft(
    id: string,
    data: SaveProspectusReviewDraftInput
  ): Promise<ApiResponse<ProspectusReviewDetail> | ApiError> {
    return this.put<ProspectusReviewDetail>(`/v1/admin/notes/${id}/prospectus-review`, data);
  }

  async approveAdminProspectusReview(
    id: string,
    data?: SaveProspectusReviewDraftInput
  ): Promise<ApiResponse<ProspectusReviewDetail> | ApiError> {
    return this.post<ProspectusReviewDetail>(
      `/v1/admin/notes/${id}/prospectus-review/approve`,
      data ?? {}
    );
  }

  async getAdminNoteProspectus(
    id: string
  ): Promise<
    | ApiResponse<{
        publicationId: string;
        contentVersion: number;
        pdfViewUrl: string;
        pdfExpiresIn: number;
        pdfContentType: "application/pdf";
        pdfFileName: string;
        pdfSha256: string | null;
        pdfSnapshotHash: string | null;
      }>
    | ApiError
  > {
    return this.get(`/v1/admin/notes/${id}/prospectus`);
  }

  async getMarketplaceNoteProspectus(
    noteId: string
  ): Promise<
    | ApiResponse<{
        publicationId: string;
        contentVersion: number;
        pdfViewUrl: string;
        pdfExpiresIn: number;
        pdfContentType: "application/pdf";
        pdfFileName: string;
        pdfSha256: string | null;
        pdfSnapshotHash: string | null;
      }>
    | ApiError
  > {
    return this.get(`/v1/marketplace/notes/${noteId}/prospectus`);
  }

  async getInvestorInvestmentProspectus(
    investmentId: string
  ): Promise<
    | ApiResponse<{
        noteId: string;
        publicationId: string;
        contentVersion: number;
        pdfViewUrl: string;
        pdfExpiresIn: number;
        pdfContentType: "application/pdf";
        pdfFileName: string;
        pdfSha256: string | null;
        pdfSnapshotHash: string | null;
      }>
    | ApiError
  > {
    return this.get(`/v1/investor/investments/${investmentId}/prospectus`);
  }

  async getAdminProspectusReviewPreview(
    id: string
  ): Promise<ApiResponse<ProspectusReviewPreviewResponse> | ApiError> {
    return this.get<ProspectusReviewPreviewResponse>(
      `/v1/admin/notes/${id}/prospectus-review/preview`
    );
  }

  async postAdminProspectusReviewPreview(
    id: string,
    data: SaveProspectusReviewDraftInput
  ): Promise<ApiResponse<ProspectusReviewPreviewResponse> | ApiError> {
    return this.post<ProspectusReviewPreviewResponse>(
      `/v1/admin/notes/${id}/prospectus-review/preview`,
      data
    );
  }

  async unpublishAdminNote(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/unpublish`, {});
  }

  async pauseAdminNoteListing(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/listing/pause`, {});
  }

  async resumeAdminNoteListing(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/listing/resume`, {});
  }

  async closeAdminNoteFunding(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/funding/close`, {});
  }

  async waiveAdminNoteFacilityFeeCollection(
    id: string,
    reason: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/facility-fee-collection/waive`, { reason });
  }

  async failAdminNoteFunding(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/funding/fail`, {});
  }

  async activateAdminNote(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/activate`, {});
  }

  async getAdminNoteEvents(id: string): Promise<ApiResponse<NoteEvent[]> | ApiError> {
    return this.get<NoteEvent[]>(`/v1/admin/notes/${id}/events`);
  }

  async getAdminNoteLedger(id: string): Promise<ApiResponse<NoteLedgerEntry[]> | ApiError> {
    return this.get<NoteLedgerEntry[]>(`/v1/admin/notes/${id}/ledger`);
  }

  async getAdminNoteBucketBalances(): Promise<
    ApiResponse<NoteLedgerBucketBalancesResponse> | ApiError
  > {
    return this.get<NoteLedgerBucketBalancesResponse>("/v1/admin/notes/bucket-balances");
  }

  async getAdminNoteBucketActivity(
    accountCode: string,
    params: { page?: number; pageSize?: number } = {}
  ): Promise<ApiResponse<NoteLedgerBucketActivityResponse> | ApiError> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    const queryString = query.toString();
    return this.get<NoteLedgerBucketActivityResponse>(
      `/v1/admin/notes/bucket-balances/${encodeURIComponent(accountCode)}/activity${queryString ? `?${queryString}` : ""}`
    );
  }

  async getAdminNoteActionRequiredCount(): Promise<
    ApiResponse<NoteActionRequiredCountResponse> | ApiError
  > {
    return this.get<NoteActionRequiredCountResponse>("/v1/admin/notes/action-count");
  }

  async getAdminPendingRepayments(): Promise<ApiResponse<PendingRepaymentsResponse> | ApiError> {
    return this.get<PendingRepaymentsResponse>("/v1/admin/notes/pending-repayments");
  }

  async getAdminPendingIssuerPayouts(): Promise<
    ApiResponse<PendingIssuerPayoutsResponse> | ApiError
  > {
    return this.get<PendingIssuerPayoutsResponse>("/v1/admin/withdrawals/pending-issuer-payouts");
  }

  async getAdminPendingInvestorWithdrawals(): Promise<
    ApiResponse<PendingInvestorWithdrawalsCountResponse> | ApiError
  > {
    return this.get<PendingInvestorWithdrawalsCountResponse>(
      "/v1/admin/withdrawals/pending-investor-withdrawals"
    );
  }

  async getAdminPendingServiceFeeTrusteeLetters(): Promise<
    ApiResponse<PendingServiceFeeTrusteeLettersResponse> | ApiError
  > {
    return this.get<PendingServiceFeeTrusteeLettersResponse>(
      "/v1/admin/notes/pending-service-fee-trustee-letters"
    );
  }

  async getAdminInvestments(
    params: GetAdminInvestmentsParams = {}
  ): Promise<ApiResponse<GetAdminInvestmentsResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set("page", String(params.page));
    if (params.pageSize !== undefined) search.set("pageSize", String(params.pageSize));
    if (params.search) search.set("search", params.search);
    if (params.status) search.set("status", params.status);
    if (params.noteId) search.set("noteId", params.noteId);
    if (params.investorOrganizationId)
      search.set("investorOrganizationId", params.investorOrganizationId);
    const qs = search.toString();
    return this.get<GetAdminInvestmentsResponse>(`/v1/admin/investments${qs ? `?${qs}` : ""}`);
  }

  async recordAdminNotePayment(
    id: string,
    data: RecordNotePaymentInput
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/payments`, data);
  }

  async approveAdminNotePayment(
    id: string,
    paymentId: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/payments/${paymentId}/approve`, {});
  }

  async rejectAdminNotePayment(
    id: string,
    paymentId: string,
    data: { reason?: string | null } = {}
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/payments/${paymentId}/reject`, data);
  }

  async previewAdminNoteSettlement(
    id: string,
    data: SettlementPreviewInput
  ): Promise<ApiResponse<NoteSettlementPreviewResult> | ApiError> {
    return this.post<NoteSettlementPreviewResult>(
      `/v1/admin/notes/${id}/settlements/preview`,
      data
    );
  }

  async approveAdminNoteSettlement(
    id: string,
    settlementId: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/settlements/approve`, { settlementId });
  }

  async postAdminNoteSettlement(
    id: string,
    settlementId: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/settlements/post`, { settlementId });
  }

  async calculateAdminNoteLateCharge(
    id: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<Record<string, unknown>> | ApiError> {
    return this.post<Record<string, unknown>>(`/v1/admin/notes/${id}/late-charge/calculate`, data);
  }

  async checkAdminNoteOverdueLateCharge(
    id: string,
    data: OverdueLateChargeInput = {}
  ): Promise<ApiResponse<OverdueLateChargeResult> | ApiError> {
    return this.post<OverdueLateChargeResult>(
      `/v1/admin/notes/${id}/late-charge/check-overdue`,
      data
    );
  }

  async approveAdminNoteLateCharge(
    id: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<Record<string, unknown>> | ApiError> {
    return this.post<Record<string, unknown>>(`/v1/admin/notes/${id}/late-charge/approve`, data);
  }

  async generateAdminNoteArrearsLetter(
    id: string
  ): Promise<ApiResponse<{ s3Key: string }> | ApiError> {
    return this.post<{ s3Key: string }>(`/v1/admin/notes/${id}/arrears/generate-letter`, {});
  }

  async generateAdminNoteDefaultLetter(
    id: string
  ): Promise<ApiResponse<{ s3Key: string }> | ApiError> {
    return this.post<{ s3Key: string }>(`/v1/admin/notes/${id}/default/generate-letter`, {});
  }

  async generateAdminNoteServiceFeeTrusteeLetter(
    noteId: string,
    settlementId: string
  ): Promise<ApiResponse<{ s3Key: string }> | ApiError> {
    return this.post<{ s3Key: string }>(
      `/v1/admin/notes/${noteId}/settlements/${settlementId}/service-fee/generate-trustee-letter`,
      {}
    );
  }

  async markAdminNoteServiceFeeTrusteeLetterSubmitted(
    noteId: string,
    settlementId: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(
      `/v1/admin/notes/${noteId}/settlements/${settlementId}/service-fee/mark-submitted-to-trustee`,
      {}
    );
  }

  async markAdminNoteServiceFeeTrusteeInstructionCompleted(
    noteId: string,
    settlementId: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(
      `/v1/admin/notes/${noteId}/settlements/${settlementId}/service-fee/mark-completed`,
      {}
    );
  }

  async markAdminNoteDefault(
    id: string,
    reason: string
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/admin/notes/${id}/default/mark`, { reason });
  }

  async getPlatformFinanceSettings(): Promise<ApiResponse<PlatformFinanceSetting> | ApiError> {
    return this.get<PlatformFinanceSetting>("/v1/admin/platform-finance-settings");
  }

  async updatePlatformFinanceSettings(
    data: Partial<PlatformFinanceSetting>
  ): Promise<ApiResponse<PlatformFinanceSetting> | ApiError> {
    return this.patch<PlatformFinanceSetting>("/v1/admin/platform-finance-settings", data);
  }

  async requestPlatformFinanceTrusteeSignatureUploadUrl(
    data: TrusteeSignatureUploadUrlRequest
  ): Promise<ApiResponse<TrusteeSignatureUploadUrlResponse> | ApiError> {
    return this.post<TrusteeSignatureUploadUrlResponse>(
      "/v1/admin/platform-finance-settings/trustee-signature/upload-url",
      data
    );
  }

  async getAdminInvestorWithdrawals(params?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    investorOrganizationId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ApiResponse<import("@cashsouk/types").InvestorWithdrawalsResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.dateFrom) search.set("dateFrom", params.dateFrom);
    if (params?.dateTo) search.set("dateTo", params.dateTo);
    if (params?.investorOrganizationId) {
      search.set("investorOrganizationId", params.investorOrganizationId);
    }
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    const qs = search.toString();
    return this.get(`/v1/admin/withdrawals${qs ? `?${qs}` : ""}`);
  }

  async getAdminWithdrawal(id: string): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.get<WithdrawalInstruction>(`/v1/admin/withdrawals/${id}`);
  }

  async listAdminGatewayPayments(params?: {
    page?: number;
    pageSize?: number;
    gatewayAccount?: CurlecGatewayAccount;
    status?: string;
    purpose?: string;
    organizationType?: string;
    filter?: "needs_attention" | "review" | "refunding" | "refunded" | "completed";
    search?: string;
  }): Promise<ApiResponse<GatewayPaymentListResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.gatewayAccount) search.set("gatewayAccount", params.gatewayAccount);
    if (params?.status) search.set("status", params.status);
    if (params?.purpose) search.set("purpose", params.purpose);
    if (params?.organizationType) search.set("organizationType", params.organizationType);
    if (params?.filter) search.set("filter", params.filter);
    if (params?.search) search.set("search", params.search);
    const qs = search.toString();
    return this.get<GatewayPaymentListResponse>(
      `/v1/admin/gateway-payments${qs ? `?${qs}` : ""}`
    );
  }

  async getAdminGatewayPaymentsExceptionCount(): Promise<
    ApiResponse<GatewayPaymentPendingCountResponse> | ApiError
  > {
    return this.get<GatewayPaymentPendingCountResponse>(
      "/v1/admin/gateway-payments/exceptions/pending-count"
    );
  }

  async getAdminGatewayPayment(id: string): Promise<ApiResponse<GatewayPaymentDetailDto> | ApiError> {
    return this.get<GatewayPaymentDetailDto>(`/v1/admin/gateway-payments/${id}`);
  }

  async listAdminGatewayPaymentReceipts(params?: {
    page?: number;
    pageSize?: number;
    receiptNumber?: string;
    payer?: string;
    purpose?: string;
    status?: string;
    from?: string;
    to?: string;
  }): Promise<ApiResponse<GatewayPaymentReceiptListResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.receiptNumber) search.set("receiptNumber", params.receiptNumber);
    if (params?.payer) search.set("payer", params.payer);
    if (params?.purpose) search.set("purpose", params.purpose);
    if (params?.status) search.set("status", params.status);
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    const qs = search.toString();
    return this.get<GatewayPaymentReceiptListResponse>(
      `/v1/admin/gateway-payments/receipts${qs ? `?${qs}` : ""}`
    );
  }

  async getAdminGatewayPaymentReceipt(
    id: string
  ): Promise<ApiResponse<GatewayPaymentReceiptDto> | ApiError> {
    return this.get<GatewayPaymentReceiptDto>(`/v1/admin/gateway-payments/receipts/${id}`);
  }

  async getAdminGatewayPaymentReceiptByPaymentId(
    gatewayPaymentId: string
  ): Promise<ApiResponse<GatewayPaymentReceiptDto> | ApiError> {
    return this.get<GatewayPaymentReceiptDto>(
      `/v1/admin/gateway-payments/${gatewayPaymentId}/receipt`
    );
  }

  async getAdminGatewayPaymentReceiptPdfUrl(
    id: string,
    mode: "view" | "download" = "view"
  ): Promise<ApiResponse<GatewayPaymentReceiptPdfUrlResponse> | ApiError> {
    return this.get<GatewayPaymentReceiptPdfUrlResponse>(
      `/v1/admin/gateway-payments/receipts/${id}/pdf?mode=${mode}`
    );
  }

  async retryAdminGatewayPaymentReceipt(
    id: string
  ): Promise<ApiResponse<GatewayPaymentReceiptDto> | ApiError> {
    return this.post<GatewayPaymentReceiptDto>(
      `/v1/admin/gateway-payments/receipts/${id}/retry`,
      {}
    );
  }

  async retryAdminGatewayPaymentRefund(
    id: string
  ): Promise<ApiResponse<GatewayPaymentDetailDto> | ApiError> {
    return this.post<GatewayPaymentDetailDto>(
      `/v1/admin/gateway-payments/${id}/retry-refund`,
      {}
    );
  }

  async initiateAdminGatewayPaymentRefund(
    id: string,
    reason: string
  ): Promise<ApiResponse<GatewayPaymentDetailDto> | ApiError> {
    return this.post<GatewayPaymentDetailDto>(
      `/v1/admin/gateway-payments/${id}/refund`,
      { reason }
    );
  }

  async approveAdminGatewayNameCheck(
    id: string
  ): Promise<ApiResponse<GatewayPaymentDetailDto> | ApiError> {
    return this.post<GatewayPaymentDetailDto>(
      `/v1/admin/gateway-payments/${id}/name-check/approve`,
      {}
    );
  }

  async rejectAdminGatewayNameCheck(
    id: string
  ): Promise<ApiResponse<GatewayPaymentDetailDto> | ApiError> {
    return this.post<GatewayPaymentDetailDto>(
      `/v1/admin/gateway-payments/${id}/name-check/reject`,
      {}
    );
  }

  async listAdminGatewayReconRuns(params?: {
    page?: number;
    pageSize?: number;
    gatewayAccount?: CurlecGatewayAccount;
    status?: GatewayReconRunStatus;
    runDate?: string;
  }): Promise<ApiResponse<GatewayReconRunListResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.gatewayAccount) search.set("gatewayAccount", params.gatewayAccount);
    if (params?.status) search.set("status", params.status);
    if (params?.runDate) search.set("runDate", params.runDate);
    const qs = search.toString();
    return this.get<GatewayReconRunListResponse>(
      `/v1/admin/gateway-recon/runs${qs ? `?${qs}` : ""}`
    );
  }

  async getAdminGatewayReconRun(id: string): Promise<ApiResponse<GatewayReconRunDetailDto> | ApiError> {
    return this.get<GatewayReconRunDetailDto>(`/v1/admin/gateway-recon/runs/${id}`);
  }

  async listAdminGatewayReconExceptions(params?: {
    page?: number;
    pageSize?: number;
    resolved?: boolean;
    runId?: string;
    gatewayAccount?: CurlecGatewayAccount;
    type?: string;
  }): Promise<ApiResponse<GatewayReconExceptionListResponse> | ApiError> {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.pageSize) search.set("pageSize", String(params.pageSize));
    if (params?.resolved !== undefined) search.set("resolved", String(params.resolved));
    if (params?.runId) search.set("runId", params.runId);
    if (params?.gatewayAccount) search.set("gatewayAccount", params.gatewayAccount);
    if (params?.type) search.set("type", params.type);
    const qs = search.toString();
    return this.get<GatewayReconExceptionListResponse>(
      `/v1/admin/gateway-recon/exceptions${qs ? `?${qs}` : ""}`
    );
  }

  async getAdminGatewayReconPendingCount(): Promise<
    ApiResponse<GatewayReconPendingCountResponse> | ApiError
  > {
    return this.get<GatewayReconPendingCountResponse>(
      "/v1/admin/gateway-recon/exceptions/pending-count"
    );
  }

  async triggerAdminGatewayReconRun(input?: {
    runDate?: string;
    gatewayAccount?: CurlecGatewayAccount;
  }): Promise<ApiResponse<GatewayReconRunDetailDto> | ApiError> {
    return this.post<GatewayReconRunDetailDto>("/v1/admin/gateway-recon/run", input ?? {});
  }

  async resolveAdminGatewayReconException(
    id: string,
    reason: string
  ): Promise<ApiResponse<GatewayReconExceptionDto> | ApiError> {
    return this.post<GatewayReconExceptionDto>(
      `/v1/admin/gateway-recon/exceptions/${id}/resolve`,
      { reason }
    );
  }

  async requestInvestorWithdrawal(data: {
    amount: number;
    investorOrganizationId: string;
  }): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.post<WithdrawalInstruction>("/v1/investor/balance/withdraw", data);
  }

  async getAdminApplicationDetail(
    id: string
  ): Promise<ApiResponse<AdminApplicationDetail> | ApiError> {
    return this.get<AdminApplicationDetail>(`/v1/admin/applications/${id}`);
  }

  async startAdminApplicationGuarantorAml(
    applicationId: string,
    clientGuarantorId: string
  ): Promise<ApiResponse<{ requestId: string; regtank_portal_url: string }> | ApiError> {
    const enc = encodeURIComponent(clientGuarantorId);
    return this.post<{ requestId: string; regtank_portal_url: string }>(
      `/v1/admin/applications/${encodeURIComponent(applicationId)}/guarantors/${enc}/start-aml`,
      {}
    );
  }

  async getAdminApplicationResubmitComparison(
    applicationId: string,
    reviewCycle: number
  ): Promise<
    | ApiResponse<{
        previous_review_cycle: number;
        next_review_cycle: number;
        previous_snapshot: unknown;
        next_snapshot: unknown;
        previous_submitted_at: string;
        next_submitted_at: string;
        amendment_remarks?: Array<{
          scope: string;
          scope_key: string;
          remark: string;
          author_user_id: string;
          submitted_at: string | null;
        }>;
      }>
    | ApiError
  > {
    const q = new URLSearchParams({ reviewCycle: String(reviewCycle) });
    return this.get(
      `/v1/admin/applications/${encodeURIComponent(applicationId)}/resubmit-comparison?${q.toString()}`
    );
  }

  async listAdminOrganizationCtosReports(
    portal: "issuer" | "investor",
    organizationId: string
  ): Promise<ApiResponse<AdminCtosReportListItem[]> | ApiError> {
    return this.get<AdminCtosReportListItem[]>(
      `/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports`
    );
  }

  async createAdminOrganizationCtosReport(
    portal: "issuer" | "investor",
    organizationId: string,
    options?: { skipDirectorShareholderNotifications?: boolean }
  ): Promise<ApiResponse<AdminCtosReportListItem> | ApiError> {
    const body: Record<string, boolean> = {};
    if (options?.skipDirectorShareholderNotifications) {
      body.skipDirectorShareholderNotifications = true;
    }
    return this.post<AdminCtosReportListItem>(
      `/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-reports`,
      body
    );
  }

  async listAdminOrganizationCtosSubjectReports(
    portal: "issuer" | "investor",
    organizationId: string
  ): Promise<ApiResponse<AdminCtosReportListItem[]> | ApiError> {
    return this.get<AdminCtosReportListItem[]>(
      `/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-subject-reports`
    );
  }

  async createAdminOrganizationCtosSubjectReport(
    portal: "issuer" | "investor",
    organizationId: string,
    body: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      enquiryOverride?: { displayName: string; idNumber: string };
    }
  ): Promise<ApiResponse<AdminCtosReportListItem> | ApiError> {
    return this.post<AdminCtosReportListItem>(
      `/v1/admin/organizations/${portal}/${encodeURIComponent(organizationId)}/ctos-subject-reports`,
      body
    );
  }

  async listAdminOnboardingCtosReports(
    onboardingId: string
  ): Promise<ApiResponse<AdminCtosReportListItem[]> | ApiError> {
    return this.get<AdminCtosReportListItem[]>(
      `/v1/admin/onboarding-applications/${encodeURIComponent(onboardingId)}/ctos-reports`
    );
  }

  async createAdminOnboardingCtosReport(
    onboardingId: string,
    options?: { skipDirectorShareholderNotifications?: boolean }
  ): Promise<ApiResponse<AdminCtosReportListItem> | ApiError> {
    const body: Record<string, boolean> = {};
    if (options?.skipDirectorShareholderNotifications) {
      body.skipDirectorShareholderNotifications = true;
    }
    return this.post<AdminCtosReportListItem>(
      `/v1/admin/onboarding-applications/${encodeURIComponent(onboardingId)}/ctos-reports`,
      body
    );
  }

  async createAdminApplicationCtosReport(
    applicationId: string
  ): Promise<ApiResponse<AdminCtosReportListItem> | ApiError> {
    return this.post<AdminCtosReportListItem>(
      `/v1/admin/applications/${encodeURIComponent(applicationId)}/ctos-reports`,
      {}
    );
  }

  async createAdminApplicationCtosSubjectReport(
    applicationId: string,
    body: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      enquiryOverride?: { displayName: string; idNumber: string };
    }
  ): Promise<ApiResponse<AdminCtosReportListItem> | ApiError> {
    return this.post<AdminCtosReportListItem>(
      `/v1/admin/applications/${encodeURIComponent(applicationId)}/ctos-subject-reports`,
      body
    );
  }

  async notifyIssuerDirectorShareholderActionRequired(
    issuerOrganizationId: string,
    body: { partyKey: string }
  ): Promise<ApiResponse<{ sent: true }> | ApiError> {
    return this.post<{ sent: true }>(
      `/v1/admin/organizations/issuer/${encodeURIComponent(issuerOrganizationId)}/director-shareholders/notify-action-required`,
      body
    );
  }

  async updateAdminApplicationStatus(
    id: string,
    status: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.patch<AdminApplicationActionResult>(`/v1/admin/applications/${id}/status`, {
      status,
    });
  }

  async approveReviewSection(
    applicationId: string,
    section: string,
    remark?: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/sections/${section}/approve`,
      remark ? { remark } : {}
    );
  }

  async rejectReviewSection(
    applicationId: string,
    section: string,
    remark: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/sections/${section}/reject`,
      { remark }
    );
  }

  async requestAmendmentReviewSection(
    applicationId: string,
    section: string,
    remark: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/sections/${section}/request-amendment`,
      { remark }
    );
  }

  async addSectionComment(
    applicationId: string,
    section: string,
    comment: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/sections/${section}/comments`,
      { comment }
    );
  }

  async resetSectionReviewToPending(
    applicationId: string,
    section: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/sections/${section}/reset-to-pending`,
      {}
    );
  }

  async approveReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark?: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/items/approve`,
      remark ? { itemType, itemId, remark } : { itemType, itemId }
    );
  }

  async rejectReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/items/reject`,
      { itemType, itemId, remark }
    );
  }

  async requestAmendmentReviewItem(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string,
    remark: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/items/request-amendment`,
      { itemType, itemId, remark }
    );
  }

  async resetItemReviewToPending(
    applicationId: string,
    itemType: "invoice" | "document",
    itemId: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/items/reset-to-pending`,
      { itemType, itemId }
    );
  }

  async sendContractOffer(
    applicationId: string,
    offeredFacility: number,
    facilityFeeRatePercent?: number | null
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/offers/contracts/send`,
      {
        offeredFacility,
        facilityFeeRatePercent: facilityFeeRatePercent ?? null,
      }
    );
  }

  async extendContractSigningDeadline(
    applicationId: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/offers/contracts/extend-signing-deadline`,
      {}
    );
  }

  async patchContractCustomerLargePrivate(
    applicationId: string,
    body: { is_large_private_company: boolean }
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.patch<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/contract/customer-large-private`,
      body
    );
  }

  async sendInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    payload: {
      offeredAmount: number;
      offeredRatioPercent?: number | null;
      offeredProfitRatePercent?: number | null;
      platformFeeRatePercent?: number | null;
      risk_rating: SoukscoreRiskRating;
      feeScheduleMode?: InvoiceOfferFeeScheduleWriteMode;
      facilityFeeCollectAmount?: number | null;
      additionalFees?: AdditionalFeeLine[];
    }
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/offers/invoices/${invoiceId}/send`,
      {
        offeredAmount: payload.offeredAmount,
        offeredRatioPercent: payload.offeredRatioPercent ?? null,
        offeredProfitRatePercent: payload.offeredProfitRatePercent ?? null,
        platformFeeRatePercent: payload.platformFeeRatePercent ?? null,
        risk_rating: payload.risk_rating,
        ...(payload.feeScheduleMode ? { feeScheduleMode: payload.feeScheduleMode } : {}),
        facilityFeeCollectAmount: payload.facilityFeeCollectAmount ?? 0,
        additionalFees: payload.additionalFees ?? [],
      }
    );
  }

  async extendInvoiceSigningDeadline(
    applicationId: string,
    invoiceId: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/offers/invoices/${invoiceId}/extend-signing-deadline`,
      {}
    );
  }

  async getAdminSignedContractOfferLetterBlob(applicationId: string): Promise<Blob> {
    const url = `${this.baseUrl}/v1/admin/applications/${applicationId}/offers/contracts/signed-letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  async getAdminSignedInvoiceOfferLetterBlob(
    applicationId: string,
    invoiceId: string
  ): Promise<Blob> {
    const id = typeof invoiceId === "string" ? invoiceId.trim() : "";
    if (!id) {
      throw new Error("Invoice ID is required for signed invoice offer letter");
    }
    const url = `${this.baseUrl}/v1/admin/applications/${applicationId}/offers/invoices/${id}/signed-letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  async addPendingAmendment(
    applicationId: string,
    params: {
      scope: "section" | "item";
      scopeKey?: string;
      remark: string;
      itemType?: "invoice" | "document";
      itemId?: string;
    }
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/pending-amendments`,
      params
    );
  }

  async listPendingAmendments(
    applicationId: string
  ): Promise<ApiResponse<PendingAmendmentItem[]> | ApiError> {
    return this.get<PendingAmendmentItem[]>(
      `/v1/admin/applications/${applicationId}/reviews/pending-amendments`
    );
  }

  async updatePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string,
    remark: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.patch<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/pending-amendments/${encodeURIComponent(scope)}/${encodeURIComponent(scopeKey)}`,
      { remark }
    );
  }

  async removePendingAmendment(
    applicationId: string,
    scope: string,
    scopeKey: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.delete<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/pending-amendments/${encodeURIComponent(scope)}/${encodeURIComponent(scopeKey)}`
    );
  }

  async submitAmendmentRequest(
    applicationId: string
  ): Promise<ApiResponse<AdminApplicationActionResult> | ApiError> {
    return this.post<AdminApplicationActionResult>(
      `/v1/admin/applications/${applicationId}/reviews/submit-amendment-request`,
      {}
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

  async approveOnboardingSubmission(onboardingId: string): Promise<
    | ApiResponse<{
        success: boolean;
        message: string;
      }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/approve-onboarding`, {});
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
        onboardingStatus: string;
        amlApproved: boolean;
        advanced: boolean;
      }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
      directorsUpdated: number;
      onboardingStatus: string;
      amlApproved: boolean;
      advanced: boolean;
    }>(`/v1/admin/onboarding-applications/${onboardingId}/refresh-aml-status`, {});
  }

  // Refresh onboarding + AML status from RegTank (personal or company)
  async refreshOnboardingStatus(onboardingId: string): Promise<
    | ApiResponse<{
        success: boolean;
        message: string;
        organizationId: string;
        onboardingStatus: string;
        onboardingApproved: boolean;
        ssmApproved: boolean;
        amlApproved: boolean;
        advanced: boolean;
        onboardingProviderStatus: string | null;
        amlProviderStatus: string | null;
        lastSyncedAt: string | null;
        directorsUpdated: number;
        refreshedSources: string[];
        warnings: string[];
        partialFailures: string[];
      }>
    | ApiError
  > {
    return this.post<{
      success: boolean;
      message: string;
      organizationId: string;
      onboardingStatus: string;
      onboardingApproved: boolean;
      ssmApproved: boolean;
      amlApproved: boolean;
      advanced: boolean;
      onboardingProviderStatus: string | null;
      amlProviderStatus: string | null;
      lastSyncedAt: string | null;
      directorsUpdated: number;
      refreshedSources: string[];
      warnings: string[];
      partialFailures: string[];
    }>(`/v1/admin/onboarding-applications/${onboardingId}/refresh-status`, {});
  }

  async getUser(id: string): Promise<ApiResponse<{ user: UserDetailResponse }> | ApiError> {
    return this.get<{ user: UserDetailResponse }>(`/v1/admin/users/${id}`);
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
    if (params.organizationId) queryParams.append("organizationId", params.organizationId);

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

  async getAccountLegalDocuments(
    audience: "ISSUER" | "INVESTOR"
  ): Promise<
    | ApiResponse<{
        documents: import("@cashsouk/types").AccountLegalDocumentResponse[];
      }>
    | ApiError
  > {
    return this.get<{
      documents: import("@cashsouk/types").AccountLegalDocumentResponse[];
    }>(`/v1/legal-documents/account?audience=${audience}`);
  }

  async getLegalDocumentDownloadUrl(
    versionId: string
  ): Promise<ApiResponse<DownloadUrlResponse> | ApiError> {
    return this.get<DownloadUrlResponse>(
      `/v1/legal-documents/versions/${versionId}/download`
    );
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

    return this.get<ProductLogsResponse>(`/v1/admin/product-logs?${queryParams.toString()}`);
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
  async getActivities(
    params: GetActivitiesParams
  ): Promise<ApiResponse<ActivitiesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("limit", String(params.limit));
    if (params.search) queryParams.append("search", params.search);
    if (params.domains && params.domains.length > 0)
      queryParams.append("domains", params.domains.join(","));
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
  async getProducts(params: {
    page: number;
    pageSize: number;
    search?: string;
    active?: boolean;
    includeDeleted?: boolean;
  }): Promise<ApiResponse<GetProductsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.active !== undefined) queryParams.append("active", String(params.active));
    if (params.includeDeleted !== undefined)
      queryParams.append("includeDeleted", String(params.includeDeleted));

    return this.get<GetProductsResponse>(`/v1/products?${queryParams.toString()}`);
  }

  async getProduct(id: string): Promise<ApiResponse<Product> | ApiError> {
    return this.get<Product>(`/v1/products/${id}`);
  }

  async getIssuerProducts(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<ApiResponse<GetProductsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    queryParams.append("active", "true");

    return this.get<GetProductsResponse>(`/v1/issuer/products?${queryParams.toString()}`);
  }

  async getIssuerProduct(id: string): Promise<ApiResponse<Product> | ApiError> {
    return this.get<Product>(`/v1/issuer/products/${encodeURIComponent(id)}`);
  }

  async getIssuerProductLiveCheck(
    productId: string
  ): Promise<ApiResponse<IssuerProductLiveCheck> | ApiError> {
    const id = encodeURIComponent(productId);
    return this.get<IssuerProductLiveCheck>(`/v1/issuer/products/live-check/${id}`);
  }

  async createProduct(data: {
    workflow: unknown[];
    marketplace_listing_duration_days?: number | null;
    service_fee_rate_percent?: number | null;
    default_facility_fee_rate_percent?: number | null;
    product_code?: string;
  }): Promise<ApiResponse<Product> | ApiError> {
    return this.post<Product>("/v1/products", data);
  }

  async updateProduct(
    id: string,
    data: {
      workflow?: unknown[];
      completeCreate?: boolean;
      marketplace_listing_duration_days?: number | null;
      service_fee_rate_percent?: number | null;
      default_facility_fee_rate_percent?: number | null;
      product_code?: string;
    }
  ): Promise<ApiResponse<Product> | ApiError> {
    return this.patch<Product>(`/v1/products/${id}`, data);
  }

  async deleteProduct(id: string): Promise<ApiResponse<unknown> | ApiError> {
    return this.delete<unknown>(`/v1/products/${id}`);
  }

  /** Rollback failed product creation: soft-delete product and delete orphan S3 files. Only allowed within 5 minutes of creation. */
  async rollbackProductCreate(
    id: string,
    s3Keys: string[]
  ): Promise<ApiResponse<unknown> | ApiError> {
    return this.post<unknown>(`/v1/products/${id}/rollback-create`, { s3Keys });
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
  async createApplication(
    data: CreateApplicationInput
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications`, data);
  }

  async getApplication(id: string): Promise<ApiResponse<Application> | ApiError> {
    return this.get<Application>(`/v1/applications/${id}`);
  }

  /** Application activity logs (issuer + admin). Requires application access. */
  async getApplicationLogs(
    id: string
  ): Promise<ApiResponse<ApplicationLogEntry[]> | ApiError> {
    return this.get<ApplicationLogEntry[]>(`/v1/applications/${id}/logs`);
  }

  async getApplicationProductVersionCompare(
    applicationId: string
  ): Promise<ApiResponse<ApplicationProductVersionCompare> | ApiError> {
    return this.get<ApplicationProductVersionCompare>(
      `/v1/applications/${applicationId}/product-version-compare`
    );
  }

  async updateApplicationStep(
    id: string,
    data: UpdateApplicationStepInput
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.patch<Application>(`/v1/applications/${id}/step`, data);
  }

  async updateApplicationStatus(
    id: string,
    status: Extract<ApplicationStatus, "DRAFT" | "SUBMITTED" | "RESUBMITTED">
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.patch<Application>(`/v1/applications/${id}/status`, { status });
  }

  async archiveApplication(id: string): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications/${id}/archive`, {});
  }

  async cancelApplication(id: string): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications/${id}/cancel`, {});
  }

  async deleteDraftApplication(id: string): Promise<ApiResponse<{ message: string }> | ApiError> {
    return this.delete<{ message: string }>(`/v1/applications/${id}`);
  }

  /** Request presigned download URL for S3 object. Used for document download from document column. */
  async getS3DownloadUrl(
    s3Key: string
  ): Promise<ApiResponse<{ downloadUrl: string; expiresIn: number }> | ApiError> {
    return this.post<{ downloadUrl: string; expiresIn: number }>(`/v1/s3/download-url`, { s3Key });
  }

  // --- Multi-party signing envelopes ---

  /**
   * Issuer: frozen product workflow for an application (application.product_version).
   * Used by configure-signers / post-docs so packages do not pick up later product edits.
   */
  async getIssuerApplicationSigningProductWorkflow(
    applicationId: string
  ): Promise<ApiResponse<{ product_version: number; workflow: unknown[] }> | ApiError> {
    return this.get<{ product_version: number; workflow: unknown[] }>(
      `/v1/signing/applications/${applicationId}/product-workflow`
    );
  }

  /** Issuer: create a draft envelope from the application's product signing template. */
  async createIssuerSigningEnvelope(
    applicationId: string,
    input: {
      title?: string | null;
      contractId?: string | null;
      invoiceId?: string | null;
      bindings: RecipientBinding[];
      expiresAt?: string | null;
    }
  ): Promise<ApiResponse<SigningEnvelopeDto> | ApiError> {
    return this.post<SigningEnvelopeDto>(
      `/v1/signing/applications/${applicationId}/envelopes`,
      input
    );
  }

  /** Issuer: send a draft envelope after post-application document gates pass. */
  async sendIssuerSigningEnvelope(
    envelopeId: string
  ): Promise<ApiResponse<SigningEnvelopeDto> | ApiError> {
    return this.post<SigningEnvelopeDto>(`/v1/signing/envelopes/${envelopeId}/send`, {});
  }

  /** Admin: void an envelope. */
  async voidSigningEnvelope(
    envelopeId: string,
    reason?: string
  ): Promise<ApiResponse<SigningEnvelopeDto> | ApiError> {
    return this.post<SigningEnvelopeDto>(`/v1/admin/signing/envelopes/${envelopeId}/void`, {
      reason,
    });
  }

  /** Admin: nudge a recipient who has not signed yet. */
  async remindSigningRecipient(
    envelopeId: string,
    recipientId: string
  ): Promise<ApiResponse<{ ok: boolean }> | ApiError> {
    return this.post<{ ok: boolean }>(
      `/v1/admin/signing/envelopes/${envelopeId}/recipients/${recipientId}/remind`,
      {}
    );
  }

  /** Admin: list all envelopes for an application. */
  async getAdminSigningEnvelopes(
    applicationId: string
  ): Promise<ApiResponse<SigningEnvelopeDto[]> | ApiError> {
    return this.get<SigningEnvelopeDto[]>(
      `/v1/admin/signing/applications/${applicationId}/envelopes`
    );
  }

  /** Admin: fetch a signed envelope document PDF (server resolves S3 key). */
  async getAdminSignedSigningDocumentBlob(
    applicationId: string,
    documentId: string,
    disposition: "inline" | "attachment" = "inline"
  ): Promise<Blob> {
    const url = `${this.baseUrl}/v1/admin/signing/applications/${applicationId}/documents/${documentId}/signed?disposition=${disposition}`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  /** Issuer: fetch a signed envelope document PDF (server resolves S3 key). */
  async getIssuerSignedSigningDocumentBlob(
    applicationId: string,
    documentId: string,
    disposition: "inline" | "attachment" = "inline"
  ): Promise<Blob> {
    const url = `${this.baseUrl}/v1/signing/applications/${applicationId}/documents/${documentId}/signed?disposition=${disposition}`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  /** Issuer/admin: read a single envelope. */
  async getSigningEnvelope(
    envelopeId: string
  ): Promise<ApiResponse<SigningEnvelopeDto> | ApiError> {
    return this.get<SigningEnvelopeDto>(`/v1/signing/envelopes/${envelopeId}`);
  }

  /** Issuer: list envelopes for an application they can access. */
  async getSigningEnvelopes(
    applicationId: string
  ): Promise<ApiResponse<SigningEnvelopeDto[]> | ApiError> {
    return this.get<SigningEnvelopeDto[]>(`/v1/signing/applications/${applicationId}/envelopes`);
  }

  /** Issuer: nudge a recipient who has not signed yet. */
  async remindIssuerSigningRecipient(
    envelopeId: string,
    recipientId: string
  ): Promise<ApiResponse<{ ok: boolean }> | ApiError> {
    return this.post<{ ok: boolean }>(
      `/v1/signing/envelopes/${envelopeId}/recipients/${recipientId}/remind`,
      {}
    );
  }

  /** External no-auth recipient: read package by secure token. */
  async getExternalSigningEnvelope(
    accessToken: string
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.get<ExternalSigningSessionDto>(`/v1/signing/external/${accessToken}`);
  }

  /** External no-auth recipient: verify IC access code. */
  async verifyExternalSigningAccessCode(
    accessToken: string,
    input: { ic_number: string }
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.post<ExternalSigningSessionDto>(
      `/v1/signing/external/${accessToken}/verify`,
      input
    );
  }

  /** External no-auth recipient: go back to IC entry before eKYC completes. */
  async resetExternalSigningAccessGate(
    accessToken: string
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.post<ExternalSigningSessionDto>(
      `/v1/signing/external/${accessToken}/reset-access`,
      {}
    );
  }

  /** External no-auth recipient: start MyKad eKYC session. */
  async createExternalRecipientEkycSession(
    accessToken: string,
    input?: { confirmedName?: string; force?: boolean }
  ): Promise<ApiResponse<RecipientEkycSession> | ApiError> {
    return this.post<RecipientEkycSession>(
      `/v1/signing/external/${accessToken}/ekyc/session`,
      input ?? {}
    );
  }

  /** External no-auth recipient: start their signing session by secure token. */
  async startExternalEnvelopeSigning(
    accessToken: string,
    input: { documentId: string }
  ): Promise<ApiResponse<{ signingUrl: string; returnSessionId: string }> | ApiError> {
    return this.post<{ signingUrl: string; returnSessionId: string }>(
      `/v1/signing/external/${accessToken}/start-signing`,
      input
    );
  }

  /** External no-auth recipient: confirm signing after SigningCloud return (no token in URL). */
  async confirmSigningReturnSession(
    returnSessionId: string
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.post<ExternalSigningSessionDto>(
      `/v1/signing/return/${returnSessionId}/confirm`,
      {}
    );
  }

  /** External no-auth recipient: confirm signing after SigningCloud backUrl return. */
  async confirmExternalEnvelopeSigned(
    accessToken: string,
    input: { documentId: string }
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.post<ExternalSigningSessionDto>(
      `/v1/signing/external/${accessToken}/confirm-signed`,
      input
    );
  }

  /** External no-auth recipient: refresh statuses from SigningCloud document detail. */
  async syncExternalSigningFromProvider(
    accessToken: string
  ): Promise<ApiResponse<ExternalSigningSessionDto> | ApiError> {
    return this.post<ExternalSigningSessionDto>(
      `/v1/signing/external/${accessToken}/sync-from-provider`,
      {}
    );
  }

  /** Issuer: refresh envelope statuses from SigningCloud document detail. */
  async syncIssuerSigningEnvelopeFromProvider(
    envelopeId: string
  ): Promise<ApiResponse<SigningEnvelopeDto> | ApiError> {
    return this.post<SigningEnvelopeDto>(
      `/v1/signing/envelopes/${envelopeId}/sync-from-provider`,
      {}
    );
  }

  async acceptContractOffer(
    applicationId: string
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(`/v1/applications/${applicationId}/offers/contracts/accept`, {});
  }

  async rejectContractOffer(
    applicationId: string,
    body?: { reason?: string }
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(
      `/v1/applications/${applicationId}/offers/contracts/reject`,
      body ?? {}
    );
  }

  async submitContractOfferAcceptance(
    applicationId: string
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(
      `/v1/applications/${applicationId}/offers/contracts/acceptance`,
      {}
    );
  }

  async acceptInvoiceOffer(
    applicationId: string,
    invoiceId: string
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(
      `/v1/applications/${applicationId}/offers/invoices/${invoiceId}/accept`,
      {}
    );
  }

  async rejectInvoiceOffer(
    applicationId: string,
    invoiceId: string,
    body?: { reason?: string }
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(
      `/v1/applications/${applicationId}/offers/invoices/${invoiceId}/reject`,
      body ?? {}
    );
  }

  async submitInvoiceOfferAcceptance(
    applicationId: string,
    invoiceId: string
  ): Promise<ApiResponse<Application> | ApiError> {
    return this.post<Application>(
      `/v1/applications/${applicationId}/offers/invoices/${invoiceId}/acceptance`,
      {}
    );
  }

  async getContractOfferLetterBlob(applicationId: string): Promise<Blob> {
    const url = `${this.baseUrl}/v1/applications/${applicationId}/offers/contracts/letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  async getInvoiceOfferLetterBlob(applicationId: string, invoiceId: string): Promise<Blob> {
    const id = typeof invoiceId === "string" ? invoiceId.trim() : "";
    if (!id) {
      throw new Error("Invoice ID is required for invoice offer letter download");
    }
    const url = `${this.baseUrl}/v1/applications/${applicationId}/offers/invoices/${id}/letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  async getSignedContractOfferLetterBlob(applicationId: string): Promise<Blob> {
    const url = `${this.baseUrl}/v1/applications/${applicationId}/offers/contracts/signed-letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  async getSignedInvoiceOfferLetterBlob(applicationId: string, invoiceId: string): Promise<Blob> {
    const id = typeof invoiceId === "string" ? invoiceId.trim() : "";
    if (!id) {
      throw new Error("Invoice ID is required for signed invoice offer letter download");
    }
    const url = `${this.baseUrl}/v1/applications/${applicationId}/offers/invoices/${id}/signed-letter`;
    const authToken = await this.getAuthToken();
    const headers: HeadersInit = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const response = await fetch(url, { method: "GET", credentials: "include", headers });
    if (!response.ok) {
      const msg = await this.parseErrorResponse(response);
      throw new Error(msg);
    }
    return response.blob();
  }

  private async parseErrorResponse(response: Response): Promise<string> {
    const text = await response.text();
    if (!text) return response.statusText;
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      const err = body?.error;
      if (
        err &&
        typeof err === "object" &&
        typeof (err as { message?: string }).message === "string"
      ) {
        return (err as { message: string }).message;
      }
      if (typeof body?.message === "string") return body.message;
      if (typeof err === "string") return err;
    } catch {
      // not JSON
    }
    return text.trim() || response.statusText;
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
        items: Record<string, unknown>[];
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
      items: Record<string, unknown>[];
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

  async markNotificationAsRead(
    id: string
  ): Promise<ApiResponse<Record<string, unknown>> | ApiError> {
    return this.patch<Record<string, unknown>>(`/v1/notifications/${id}/read`);
  }

  async markAllNotificationsAsRead(): Promise<ApiResponse<{ count: number }> | ApiError> {
    return this.patch<{ count: number }>("/v1/notifications/read-all");
  }

  async getNotificationPreferences(): Promise<ApiResponse<Record<string, unknown>[]> | ApiError> {
    return this.get<Record<string, unknown>[]>("/v1/notifications/preferences");
  }

  async updateNotificationPreference(
    typeId: string,
    data: { enabled_platform: boolean; enabled_email: boolean }
  ): Promise<ApiResponse<Record<string, unknown>> | ApiError> {
    return this.put<Record<string, unknown>>(`/v1/notifications/preferences/${typeId}`, data);
  }

  // Admin Notifications
  async getAdminNotificationTypes(): Promise<ApiResponse<AdminNotificationType[]> | ApiError> {
    return this.get<AdminNotificationType[]>("/v1/notifications/admin/types");
  }

  async updateAdminNotificationType(
    id: string,
    data: AdminUpdateNotificationTypePayload
  ): Promise<ApiResponse<AdminNotificationType> | ApiError> {
    return this.patch<AdminNotificationType>(`/v1/notifications/admin/types/${id}`, data);
  }

  async sendAdminNotification(
    data: AdminSendNotificationPayload
  ): Promise<ApiResponse<{ sent: number }> | ApiError> {
    return this.post<{ sent: number }>("/v1/notifications/admin/send", data);
  }

  async getAdminNotificationGroups(): Promise<ApiResponse<AdminNotificationGroup[]> | ApiError> {
    return this.get<AdminNotificationGroup[]>("/v1/notifications/admin/groups");
  }

  async getAdminNotificationLogs(params: {
    limit?: number;
    offset?: number;
    search?: string;
    type?: string;
    target?: string;
  }): Promise<
    | ApiResponse<{ items: AdminNotificationLog[]; pagination: AdminNotificationLogPagination }>
    | ApiError
  > {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append("limit", String(params.limit));
    if (params.offset) queryParams.append("offset", String(params.offset));
    if (params.search) queryParams.append("search", params.search);
    if (params.type) queryParams.append("type", params.type);
    if (params.target) queryParams.append("target", params.target);

    return this.get<{ items: AdminNotificationLog[]; pagination: AdminNotificationLogPagination }>(
      `/v1/notifications/admin/logs?${queryParams.toString()}`
    );
  }

  async createAdminNotificationGroup(data: {
    name: string;
    description?: string;
    userIds: string[];
  }): Promise<ApiResponse<AdminNotificationGroup> | ApiError> {
    return this.post<AdminNotificationGroup>("/v1/notifications/admin/groups", data);
  }

  async updateAdminNotificationGroup(
    id: string,
    data: { name?: string; description?: string; userIds?: string[] }
  ): Promise<ApiResponse<AdminNotificationGroup> | ApiError> {
    return this.patch<AdminNotificationGroup>(`/v1/notifications/admin/groups/${id}`, data);
  }

  async deleteAdminNotificationGroup(
    id: string
  ): Promise<ApiResponse<AdminNotificationGroup> | ApiError> {
    return this.delete<AdminNotificationGroup>(`/v1/notifications/admin/groups/${id}`);
  }

  async seedAdminNotificationTypes(): Promise<ApiResponse<AdminSeedTypesResponse> | ApiError> {
    return this.post<AdminSeedTypesResponse>("/v1/notifications/admin/seed-types");
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
      contract_details?: ContractDetails | null;
      customer_details?: CustomerDetails;
      status?: string;
    }
  ): Promise<ApiResponse<Contract> | ApiError> {
    return this.patch<Contract>(`/v1/contracts/${id}`, data);
  }

  async unlinkContract(id: string): Promise<ApiResponse<void> | ApiError> {
    return this.post<void>(`/v1/contracts/${id}/unlink`, {});
  }

  async withdrawContract(id: string): Promise<ApiResponse<Contract> | ApiError> {
    return this.post<Contract>(`/v1/contracts/${id}/withdraw`, {});
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
    details: Partial<InvoiceDetails> & {
      contractId?: string | null;
      document?: Record<string, unknown>;
    }
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
    const body: Record<string, unknown> = {};

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

  async withdrawInvoice(
    id: string,
    reason?: WithdrawReason
  ): Promise<ApiResponse<Invoice> | ApiError> {
    return this.post<Invoice>(`/v1/invoices/${id}/withdraw`, reason ? { reason } : {});
  }

  async getInvoicesByApplication(
    applicationId: string
  ): Promise<ApiResponse<Invoice[]> | ApiError> {
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

  // Marketplace and note servicing
  async getMarketplaceNotes(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      featuredOnly?: boolean;
      includeClosed?: boolean;
    } = {}
  ): Promise<ApiResponse<NotesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page ?? 1));
    queryParams.append("pageSize", String(params.pageSize ?? 12));
    if (params.search) queryParams.append("search", params.search);
    if (params.featuredOnly) queryParams.append("featuredOnly", "true");
    if (params.includeClosed) queryParams.append("includeClosed", "true");
    return this.get<NotesResponse>(`/v1/marketplace/notes?${queryParams.toString()}`);
  }

  async getPublicMarketplaceNotes(
    params: {
      page?: number;
      pageSize?: number;
      search?: string;
      featuredOnly?: boolean;
    } = {}
  ): Promise<ApiResponse<NotesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page ?? 1));
    queryParams.append("pageSize", String(params.pageSize ?? 12));
    if (params.search) queryParams.append("search", params.search);
    if (params.featuredOnly) queryParams.append("featuredOnly", "true");
    return this.get<NotesResponse>(`/v1/public/marketplace/notes?${queryParams.toString()}`);
  }

  async getMarketplaceNote(id: string): Promise<ApiResponse<MarketplaceNoteDetail> | ApiError> {
    return this.get<MarketplaceNoteDetail>(`/v1/marketplace/notes/${id}`);
  }

  async createMarketplaceNoteInvestment(
    id: string,
    data: CreateNoteInvestmentInput
  ): Promise<ApiResponse<MarketplaceNoteDetail> | ApiError> {
    return this.post<MarketplaceNoteDetail>(`/v1/marketplace/notes/${id}/investments`, data);
  }

  async getInvestorInvestments(
    investorOrganizationId?: string
  ): Promise<ApiResponse<NotesResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    if (investorOrganizationId) {
      queryParams.append("investorOrganizationId", investorOrganizationId);
    }
    const suffix = queryParams.toString();
    return this.get<NotesResponse>(`/v1/investor/investments${suffix ? `?${suffix}` : ""}`);
  }

  async getInvestorPortfolio(
    investorOrganizationId?: string
  ): Promise<ApiResponse<InvestorPortfolioResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    if (investorOrganizationId) {
      queryParams.append("investorOrganizationId", investorOrganizationId);
    }
    const suffix = queryParams.toString();
    return this.get<InvestorPortfolioResponse>(
      `/v1/investor/portfolio${suffix ? `?${suffix}` : ""}`
    );
  }

  async getInvestorPortfolioHistory(
    range: InvestorPortfolioHistoryRange = "6M",
    investorOrganizationId?: string
  ): Promise<ApiResponse<InvestorPortfolioHistoryResponse> | ApiError> {
    const queryParams = new URLSearchParams({ range });
    if (investorOrganizationId) {
      queryParams.append("investorOrganizationId", investorOrganizationId);
    }
    return this.get<InvestorPortfolioHistoryResponse>(
      `/v1/investor/portfolio/history?${queryParams.toString()}`
    );
  }

  async getInvestorBalanceActivity(
    params: {
      page?: number;
      pageSize?: number;
      investorOrganizationId?: string;
    } = {}
  ): Promise<ApiResponse<InvestorBalanceActivityResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page ?? 1));
    queryParams.append("pageSize", String(params.pageSize ?? 20));
    if (params.investorOrganizationId) {
      queryParams.append("investorOrganizationId", params.investorOrganizationId);
    }
    return this.get<InvestorBalanceActivityResponse>(
      `/v1/investor/balance/activity?${queryParams.toString()}`
    );
  }

  async exportInvestorBalanceStatement(
    params: ExportInvestorBalanceStatementParams
  ): Promise<Blob> {
    const queryParams = new URLSearchParams();
    queryParams.append("startDate", params.startDate);
    queryParams.append("endDate", params.endDate);
    queryParams.append("format", params.format);
    if (params.investorOrganizationId) {
      queryParams.append("investorOrganizationId", params.investorOrganizationId);
    }

    const url = `${this.baseUrl}/v1/investor/balance/statement?${queryParams.toString()}`;
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
      throw new Error(`Statement export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  async createInvestorDeposit(
    input: CreateInvestorDepositInput
  ): Promise<ApiResponse<InvestorDepositResponse> | ApiError> {
    return this.post<InvestorDepositResponse>("/v1/investor/deposits", input);
  }

  async getInvestorDepositLimits(): Promise<ApiResponse<InvestorDepositLimits> | ApiError> {
    return this.get<InvestorDepositLimits>("/v1/investor/deposits/limits");
  }

  async getInvestorDeposit(id: string): Promise<ApiResponse<InvestorDepositResponse> | ApiError> {
    return this.get<InvestorDepositResponse>(`/v1/investor/deposits/${id}`);
  }

  async createIssuerOnboardingFee(
    input: CreateIssuerOnboardingFeeInput
  ): Promise<ApiResponse<IssuerOnboardingFeeResponse> | ApiError> {
    return this.post<IssuerOnboardingFeeResponse>("/v1/issuer/onboarding-fee", input);
  }

  async getIssuerOnboardingFee(
    id: string
  ): Promise<ApiResponse<IssuerOnboardingFeeResponse> | ApiError> {
    return this.get<IssuerOnboardingFeeResponse>(`/v1/issuer/onboarding-fee/${id}`);
  }

  async getIssuerOnboardingFeeStatus(
    issuerOrganizationId: string
  ): Promise<ApiResponse<IssuerOnboardingFeeStatusResponse> | ApiError> {
    return this.get<IssuerOnboardingFeeStatusResponse>(
      `/v1/issuer/onboarding-fee/status/${encodeURIComponent(issuerOrganizationId)}`
    );
  }

  async createApplicationProcessingFee(
    applicationId: string
  ): Promise<ApiResponse<ApplicationProcessingFeeResponse> | ApiError> {
    return this.post<ApplicationProcessingFeeResponse>(
      `/v1/applications/${encodeURIComponent(applicationId)}/processing-fee`,
      {}
    );
  }

  async getApplicationProcessingFee(
    applicationId: string,
    feePaymentId: string
  ): Promise<ApiResponse<ApplicationProcessingFeeResponse> | ApiError> {
    return this.get<ApplicationProcessingFeeResponse>(
      `/v1/applications/${encodeURIComponent(applicationId)}/processing-fee/${encodeURIComponent(feePaymentId)}`
    );
  }

  async postInvestorBalanceTestTopup(input: {
    investorOrganizationId: string;
    amount: number;
  }): Promise<ApiResponse<InvestorPortfolioResponse> | ApiError> {
    return this.post<InvestorPortfolioResponse>("/v1/investor/balance/test-topup", input);
  }

  async getIssuerNotes(): Promise<ApiResponse<NotesResponse> | ApiError> {
    return this.get<NotesResponse>("/v1/issuer/notes");
  }

  async getIssuerNote(id: string): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.get<NoteDetail>(`/v1/issuer/notes/${id}`);
  }

  async getIssuerNotePaymentInstructions(
    id: string
  ): Promise<ApiResponse<Record<string, unknown>> | ApiError> {
    return this.get<Record<string, unknown>>(`/v1/issuer/notes/${id}/payment-instructions`);
  }

  async getIssuerNoteLedger(id: string): Promise<ApiResponse<NoteLedgerEntry[]> | ApiError> {
    return this.get<NoteLedgerEntry[]>(`/v1/issuer/notes/${id}/ledger`);
  }

  async getIssuerShorakaCertificateViewUrl(
    noteId: string
  ): Promise<ApiResponse<{ viewUrl: string; expiresIn: number }> | ApiError> {
    return this.post<{ viewUrl: string; expiresIn: number }>(
      `/v1/issuer/notes/${noteId}/shoraka-certificate/view-url`,
      {}
    );
  }

  async submitIssuerPaymentOnBehalfOfPaymaster(
    id: string,
    data: RecordNotePaymentInput
  ): Promise<ApiResponse<NoteDetail> | ApiError> {
    return this.post<NoteDetail>(`/v1/issuer/notes/${id}/payments/on-behalf-of-paymaster`, data);
  }

  async requestIssuerPaymentEvidenceUploadUrl(
    id: string,
    data: IssuerPaymentEvidenceUploadUrlRequest
  ): Promise<ApiResponse<IssuerPaymentEvidenceUploadUrlResponse> | ApiError> {
    return this.post<IssuerPaymentEvidenceUploadUrlResponse>(
      `/v1/issuer/notes/${id}/payments/evidence/upload-url`,
      data
    );
  }

  async createWithdrawalInstruction(
    data: Partial<WithdrawalInstruction>
  ): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.post<WithdrawalInstruction>("/v1/admin/withdrawals", data);
  }

  async generateWithdrawalLetter(
    id: string
  ): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.post<WithdrawalInstruction>(`/v1/admin/withdrawals/${id}/generate-letter`, {});
  }

  async markWithdrawalSubmittedToTrustee(
    id: string
  ): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.post<WithdrawalInstruction>(
      `/v1/admin/withdrawals/${id}/mark-submitted-to-trustee`,
      {}
    );
  }

  async markWithdrawalCompleted(
    id: string
  ): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.post<WithdrawalInstruction>(`/v1/admin/withdrawals/${id}/mark-completed`, {});
  }

  async updateWithdrawalBeneficiary(
    id: string,
    beneficiarySnapshot: Record<string, unknown>
  ): Promise<ApiResponse<WithdrawalInstruction> | ApiError> {
    return this.patch<WithdrawalInstruction>(`/v1/admin/withdrawals/${id}/beneficiary`, {
      beneficiarySnapshot,
    });
  }

  async getAdminWithdrawalShoraka(
    id: string
  ): Promise<ApiResponse<ShorakaWithdrawalState | null> | ApiError> {
    return this.get<ShorakaWithdrawalState | null>(`/v1/admin/withdrawals/${id}/shoraka`);
  }

  async submitAdminWithdrawalShorakaSubmitOrder(
    id: string
  ): Promise<ApiResponse<ShorakaSubmitOrderStateResponse> | ApiError> {
    return this.post<ShorakaSubmitOrderStateResponse>(
      `/v1/admin/withdrawals/${id}/shoraka/submit-order`,
      {}
    );
  }

  async queryAdminWithdrawalShorakaStatus(
    id: string
  ): Promise<ApiResponse<ShorakaWithdrawalState> | ApiError> {
    return this.post<ShorakaWithdrawalState>(
      `/v1/admin/withdrawals/${id}/shoraka/query-status`,
      {}
    );
  }

  async fetchAdminWithdrawalShorakaCertificate(
    id: string
  ): Promise<ApiResponse<ShorakaWithdrawalState> | ApiError> {
    return this.post<ShorakaWithdrawalState>(
      `/v1/admin/withdrawals/${id}/shoraka/fetch-certificate`,
      {}
    );
  }

  // Invoice APIs removed.
  // Methods related to invoices were deleted because invoice backend was removed.

  async getS3ViewUrl(
    s3Key: string
  ): Promise<ApiResponse<{ viewUrl: string; expiresIn: number }> | ApiError> {
    return this.post<{ viewUrl: string; expiresIn: number }>("/v1/s3/view-url", { s3Key });
  }

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
