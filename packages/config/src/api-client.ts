import type {
  ApiResponse,
  ApiError,
  GetUsersParams,
  UsersResponse,
  UserResponse,
  UpdateUserRolesInput,
  UpdateUserKycInput,
  UpdateUserOnboardingInput,
  GetAccessLogsParams,
  AccessLogsResponse,
  AccessLogResponse,
  ExportAccessLogsParams,
} from "@cashsouk/types";

export class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<Response> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get auth token from localStorage (for development)
   * In production, tokens are in HTTP-Only cookies and sent automatically
   */
  private getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("auth_token");
  }

  /**
   * Get refresh token from localStorage (for development)
   * In production, refresh token is in HTTP-Only cookies and sent automatically
   */
  private getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("refresh_token");
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
    // In development, cookies don't work across different origins (localhost:4000 vs localhost:3002)
    // So we need to send refresh token in request body
    // Try to get refresh token from localStorage (if stored there for dev mode)
    // Otherwise, rely on cookies (production mode)
    const refreshTokenFromStorage = this.getRefreshToken();
    
    const refreshHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    const refreshBody: { refreshToken?: string } = {};
    
    // For dev mode: send refresh token in body
    if (refreshTokenFromStorage) {
      refreshBody.refreshToken = refreshTokenFromStorage;
    }
    
    this.refreshPromise = fetch(`${this.baseUrl}/v1/auth/refresh`, {
      method: "POST",
      credentials: "include", // Send HTTP-Only cookies (production)
      headers: refreshHeaders,
      body: Object.keys(refreshBody).length > 0 ? JSON.stringify(refreshBody) : undefined,
    });

    try {
      const response = await this.refreshPromise;
      const success = response.ok;

      // Clear refresh promise after completion
      this.refreshPromise = null;

      if (success) {
        // Refresh successful - cookies are updated automatically
        // In dev mode, also update localStorage with new tokens from response
        try {
          const data = await response.json();
          // Backend returns tokens in response.data for dev mode (wrapped in ApiResponse)
          if (data.data?.accessToken) {
            localStorage.setItem("auth_token", data.data.accessToken);
          }
          if (data.data?.refreshToken) {
            localStorage.setItem("refresh_token", data.data.refreshToken);
          }
          // Also check direct properties (in case response structure is different)
          if (data.accessToken && !data.data?.accessToken) {
            localStorage.setItem("auth_token", data.accessToken);
          }
          if (data.refreshToken && !data.data?.refreshToken) {
            localStorage.setItem("refresh_token", data.refreshToken);
          }
        } catch {
          // Response might not be JSON, that's okay - cookies are set automatically
        }
      } else {
        // Refresh failed (401 or 403) - clear tokens and redirect to login
        // Only redirect in production (not in development mode for testing)
        if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("refresh_token");
          
          // Only redirect if we're not already on the landing/login page
          const currentPath = window.location.pathname;
          if (!currentPath.includes("/welcome") && !currentPath.includes("/login")) {
            const landingUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000";
            window.location.href = landingUrl;
          }
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
        // After refresh, cookies are updated automatically
        // In dev mode, localStorage is also updated with new tokens
        // Get updated token from localStorage (dev mode) or use cookies (production)
        const updatedToken = this.getAuthToken();
        
        // Update Authorization header with new token (if available)
        const retryHeaders = { ...headers };
        if (updatedToken) {
          retryHeaders["Authorization"] = `Bearer ${updatedToken}`;
        }
        
        // Retry original request (cookies will be sent automatically, or use Authorization header)
        response = await fetch(url, {
          ...options,
          credentials: "include", // Send updated cookies
          headers: retryHeaders,
        });
      } else {
        // Refresh failed - try to parse error response
        let errorResponse: ApiError;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            errorResponse = await response.json() as ApiError;
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

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T> | ApiError> {
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
    if (params.kycVerified !== undefined) queryParams.append("kycVerified", String(params.kycVerified));
    if (params.investorOnboarded !== undefined) queryParams.append("investorOnboarded", String(params.investorOnboarded));
    if (params.issuerOnboarded !== undefined) queryParams.append("issuerOnboarded", String(params.issuerOnboarded));

    return this.get<UsersResponse>(`/v1/admin/users?${queryParams.toString()}`);
  }

  async getUser(id: string): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.get<{ user: UserResponse }>(`/v1/admin/users/${id}`);
  }

  async updateUserRoles(id: string, roles: UpdateUserRolesInput): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/roles`, roles);
  }

  async updateUserKyc(id: string, kyc: UpdateUserKycInput): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/kyc`, kyc);
  }

  async updateUserOnboarding(id: string, onboarding: UpdateUserOnboardingInput): Promise<ApiResponse<{ user: UserResponse }> | ApiError> {
    return this.patch<{ user: UserResponse }>(`/v1/admin/users/${id}/onboarding`, onboarding);
  }

  // Admin - Access Logs
  async getAccessLogs(params: GetAccessLogsParams): Promise<ApiResponse<AccessLogsResponse> | ApiError> {
    const queryParams = new URLSearchParams();
    queryParams.append("page", String(params.page));
    queryParams.append("pageSize", String(params.pageSize));
    if (params.search) queryParams.append("search", params.search);
    if (params.eventType) queryParams.append("eventType", params.eventType);
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

    const headers: HeadersInit = {};
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

export function createApiClient(baseUrl?: string): ApiClient {
  return new ApiClient(baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
}

