import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  LegalDocumentType,
  LegalExternalAcceptanceDetail,
  LegalExternalAcceptanceListItem,
  LegalExternalAcceptanceStatus,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface LegalExternalAcceptancesParams {
  page: number;
  pageSize?: number;
  search?: string;
  documentType?: LegalDocumentType;
  status?: LegalExternalAcceptanceStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "accepted_at" | "created_at";
  sortOrder?: "asc" | "desc";
}

type ListResponse = {
  acceptances: LegalExternalAcceptanceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

function buildQueryParams(
  params: LegalExternalAcceptancesParams,
  extra?: Record<string, string>
): URLSearchParams {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 20),
    sortBy: params.sortBy ?? "accepted_at",
    sortOrder: params.sortOrder ?? "desc",
  });

  if (params.search) query.set("search", params.search);
  if (params.documentType) query.set("documentType", params.documentType);
  if (params.status) query.set("status", params.status);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      query.set(key, value);
    }
  }

  return query;
}

export function useLegalExternalAcceptances(params: LegalExternalAcceptancesParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-external-acceptances", params],
    queryFn: async () => {
      const query = buildQueryParams(params);
      const response = await apiClient.get<ListResponse>(
        `/v1/admin/legal-external-acceptances?${query.toString()}`
      );
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load external acceptances");
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useLegalExternalAcceptanceDetail(id: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-external-acceptances", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Acceptance ID is required");
      }
      const result = await apiClient.get<{ acceptance: LegalExternalAcceptanceDetail }>(
        `/v1/admin/legal-external-acceptances/${id}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load acceptance details");
      }
      return result.data.acceptance;
    },
    enabled: Boolean(id),
  });
}

export function useExportLegalExternalAcceptances() {
  const { getAccessToken } = useAuthToken();

  return async (params: Omit<LegalExternalAcceptancesParams, "page" | "pageSize">) => {
    const query = buildQueryParams({ page: 1, pageSize: 20, ...params }, { format: "csv" });
    const authToken = await getAccessToken();

    const headers: HeadersInit = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_URL}/v1/admin/legal-external-acceptances/export?${query.toString()}`,
      {
        method: "GET",
        credentials: "include",
        headers,
      }
    );

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  };
}
