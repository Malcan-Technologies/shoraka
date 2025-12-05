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
} from "@cashsouk/types";

export class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<Response> | null = null;
  private getToken: (() => string | null) | null = null;
  private setToken: ((token: string | null) => void) | null = null;

  constructor(baseUrl: string, getToken?: () => string | null, setToken?: (token: string | null) => void) {
    this.baseUrl = baseUrl;
    this.getToken = getToken || null;
    this.setToken = setToken || null;
  }

  /**
   * Get auth token from memory (via callback)
   * Tokens are stored in Next.js memory (React Context), not localStorage
   */
  private getAuthToken(): string | null {
    if (this.getToken) {
      return this.getToken();
    }
    return null;
  }

  /**
   * Attempt to refresh the access token using refresh token
   * Handles concurrent requests by reusing the same refresh promise
   */
  private async refreshToken(): Promise<boolean> {
    // If already refreshing, wait for that promise
    if (this.refreshPromise) {
      try {
        const response = await this.refreshPromise;
        return response.ok;
      } catch {
        return false;
      }
    }

    // Start refresh request
    // Refresh token is stored in HTTP-only cookie and sent automatically
    // Backend will read refresh_token from cookies
    const refreshHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    this.refreshPromise = fetch(`${this.baseUrl}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send HTTP-Only cookies (includes refresh_token)
      headers: refreshHeaders,
    });

    try {
      const response = await this.refreshPromise;
      const success = response.ok;

      // Clear refresh promise after completion
      this.refreshPromise = null;

      if (success) {
        // Refresh successful - refresh_token cookie is updated automatically
        // Update access_token in memory via callback
        try {
          const data = await response.json();
          // Backend returns tokens in response body
          const accessToken = data.data?.accessToken || data.accessToken;
          if (accessToken && this.setToken) {
            this.setToken(accessToken);
          }
        } catch {
          // Response might not be JSON, that's okay - refresh_token cookie is set automatically
        }
      } else {
        // Refresh failed (401 or 403) - clear access token from memory
        // Don't redirect here - let the portal's auth logic handle redirects
        // This allows each portal (admin, investor, issuer) to redirect to their own login page
        if (this.setToken) {
          this.setToken(null);
        }
      }

      return success;
    } catch (error) {
      this.refreshPromise = null;
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    const url = `${this.baseUrl}${endpoint}`;

    // Don't retry refresh endpoint if it fails
    const isRefreshEndpoint = endpoint === "/v1/auth/refresh";

    // Get auth token from localStorage (for development)
    // In production, tokens are in HTTP-Only cookies and sent automatically
    const authToken = this.getAuthToken();

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> | undefined),
    };

    // Add Authorization header if token exists (for development)
    // In production, token is in HTTP-Only cookie and sent automatically
    if (authToken && !isRefreshEndpoint) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // Make initial request
    let response = await fetch(url, {
      ...options,
      credentials: "include", // Always send cookies (for production)
      headers,
    });

    // If unauthorized and not the refresh endpoint, try to refresh
    if (response.status === 401 && !isRefreshEndpoint) {
      const refreshed = await this.refreshToken();

      if (refreshed) {
        // After refresh, refresh_token cookie is updated automatically
        // Access token is updated in memory via callback
        // Get updated token from memory
        const updatedToken = this.getAuthToken();

        // Update Authorization header with new token (if available)
        const retryHeaders = { ...headers };
        if (updatedToken) {
          retryHeaders["Authorization"] = `Bearer ${updatedToken}`;
        }
        
        // Retry original request with new access token in Authorization header
        response = await fetch(url, {
          ...options,
          credentials: "include", // Send refresh_token cookie
          headers: retryHeaders,
        });
      } else {
        // Refresh failed - try to parse error response
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
  }): Promise<ApiResponse<{ success: boolean }> | ApiError> {
    return this.post<{ success: boolean }>(`/v1/auth/change-password`, data);
  }

  // Self-service email change - Step 1: Initiate (sends verification code)
  async initiateEmailChange(data: {
    newEmail: string;
    password: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }> | ApiError> {
    return this.post<{ success: boolean; message: string }>(`/v1/auth/initiate-email-change`, data);
  }

  // Self-service email change - Step 2: Verify code (completes change)
  async verifyEmailChange(data: {
    code: string;
    newEmail: string;
    password: string;
  }): Promise<ApiResponse<{ success: boolean; newEmail: string }> | ApiError> {
    return this.post<{ success: boolean; newEmail: string }>(`/v1/auth/verify-email-change`, data);
  }

  // Resend email verification code (for unverified emails)
  async resendEmailVerification(data: {
    password: string;
  }): Promise<ApiResponse<{ success: boolean; message: string }> | ApiError> {
    return this.post<{ success: boolean; message: string }>(
      `/v1/auth/resend-email-verification`,
      data
    );
  }

  // Verify email with code (for unverified emails)
  async verifyEmail(data: {
    code: string;
    password: string;
  }): Promise<ApiResponse<{ success: boolean }> | ApiError> {
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
    const authToken = this.getAuthToken();

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
}

export function createApiClient(
  baseUrl?: string,
  getToken?: () => string | null,
  setToken?: (token: string | null) => void
): ApiClient {
  return new ApiClient(
    baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
    getToken,
    setToken
  );
}
