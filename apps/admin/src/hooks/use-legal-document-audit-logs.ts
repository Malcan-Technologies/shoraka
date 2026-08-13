import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  LegalAdminAuditEventType,
  LegalAdminAuditLogListItem,
  LegalDocumentType,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface LegalDocumentAuditLogsParams {
  page: number;
  pageSize?: number;
  search?: string;
  action?: LegalAdminAuditEventType;
  documentType?: LegalDocumentType;
  legalDocumentId?: string;
  actorUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}

type ListResponse = {
  logs: LegalAdminAuditLogListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

function buildQueryParams(
  params: LegalDocumentAuditLogsParams,
  extra?: Record<string, string>
): URLSearchParams {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? 20),
  });

  if (params.search) query.set("search", params.search);
  if (params.action) query.set("action", params.action);
  if (params.documentType) query.set("documentType", params.documentType);
  if (params.legalDocumentId) query.set("legalDocumentId", params.legalDocumentId);
  if (params.actorUserId) query.set("actorUserId", params.actorUserId);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      query.set(key, value);
    }
  }

  return query;
}

export function useLegalDocumentAuditLogs(params: LegalDocumentAuditLogsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-document-audit-logs", params],
    queryFn: async () => {
      const query = buildQueryParams(params);
      const result = await apiClient.get<ListResponse>(
        `/v1/admin/legal-document-audit-logs?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal document audit logs");
      }
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useExportLegalDocumentAuditLogs() {
  const { getAccessToken } = useAuthToken();

  return async (params: Omit<LegalDocumentAuditLogsParams, "page" | "pageSize">) => {
    const query = buildQueryParams({ page: 1, pageSize: 20, ...params }, { format: "csv" });
    const authToken = await getAccessToken();

    const headers: HeadersInit = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_URL}/v1/admin/legal-document-audit-logs/export?${query.toString()}`,
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
