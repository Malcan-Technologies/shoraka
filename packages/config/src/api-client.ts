import type { ApiResponse, ApiError } from "@cashsouk/types";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<ApiResponse<T> | ApiError> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    return response.json() as Promise<ApiResponse<T> | ApiError>;
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
}

export function createApiClient(baseUrl?: string): ApiClient {
  return new ApiClient(baseUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000");
}

