import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  LegalAcceptanceAudience,
  LegalAcceptanceStatus,
  LegalDocumentAcceptanceDetail,
  LegalDocumentAcceptanceListItem,
  LegalDocumentType,
  PortalType,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface LegalDocumentAcceptancesParams {
  page: number;
  pageSize?: number;
  search?: string;
  documentType?: LegalDocumentType;
  audience?: LegalAcceptanceAudience;
  organizationId?: string;
  status?: LegalAcceptanceStatus;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "accepted_at" | "created_at";
  sortOrder?: "asc" | "desc";
}

/** Organization detail Acceptances tab: the API takes the organization from the URL. */
export interface OrganizationAcceptanceScope {
  portal: PortalType;
  organizationId: string;
}

export type OrganizationLegalAcceptancesParams = Pick<
  LegalDocumentAcceptancesParams,
  "page" | "pageSize" | "sortBy" | "sortOrder"
>;

function organizationAcceptancesPath(scope: OrganizationAcceptanceScope): string {
  return `/v1/admin/organizations/${scope.portal}/${scope.organizationId}/legal-acceptances`;
}

type ListResponse = {
  acceptances: LegalDocumentAcceptanceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

function buildQueryParams(
  params: LegalDocumentAcceptancesParams,
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
  if (params.audience) query.set("audience", params.audience);
  if (params.organizationId) query.set("organizationId", params.organizationId);
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

export function useLegalDocumentAcceptances(params: LegalDocumentAcceptancesParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-document-acceptances", params],
    queryFn: async () => {
      const query = buildQueryParams(params);
      const result = await apiClient.get<ListResponse>(
        `/v1/admin/legal-document-acceptances?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal acceptances");
      }
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useLegalDocumentAcceptanceDetail(id: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-document-acceptances", "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Acceptance ID is required");
      }
      const result = await apiClient.get<{ acceptance: LegalDocumentAcceptanceDetail }>(
        `/v1/admin/legal-document-acceptances/${id}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load acceptance details");
      }
      return result.data.acceptance;
    },
    enabled: Boolean(id),
  });
}

export function useOrganizationLegalAcceptances(
  scope: OrganizationAcceptanceScope,
  params: OrganizationLegalAcceptancesParams
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "organization-legal-acceptances", scope.portal, scope.organizationId, params],
    queryFn: async () => {
      const query = buildQueryParams(params);
      const result = await apiClient.get<ListResponse>(
        `${organizationAcceptancesPath(scope)}?${query.toString()}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load legal acceptances");
      }
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useOrganizationLegalAcceptanceDetail(
  scope: OrganizationAcceptanceScope | undefined,
  id: string | null
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: [
      "admin",
      "organization-legal-acceptances",
      scope?.portal,
      scope?.organizationId,
      "detail",
      id,
    ],
    queryFn: async () => {
      if (!scope || !id) {
        throw new Error("Acceptance ID is required");
      }
      const result = await apiClient.get<{ acceptance: LegalDocumentAcceptanceDetail }>(
        `${organizationAcceptancesPath(scope)}/${id}`
      );
      if (!result.success) {
        throw new Error(result.error?.message || "Failed to load acceptance details");
      }
      return result.data.acceptance;
    },
    enabled: Boolean(scope && id),
  });
}

export function useExportLegalDocumentAcceptances() {
  const { getAccessToken } = useAuthToken();

  return async (params: Omit<LegalDocumentAcceptancesParams, "page" | "pageSize">) => {
    const query = buildQueryParams({ page: 1, pageSize: 20, ...params }, { format: "csv" });
    const authToken = await getAccessToken();

    const headers: HeadersInit = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const response = await fetch(
      `${API_URL}/v1/admin/legal-document-acceptances/export?${query.toString()}`,
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

export function useDownloadAcceptedVersion() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return async (acceptanceId: string, scope?: OrganizationAcceptanceScope) => {
    const result = await apiClient.get<{
      downloadUrl: string;
      fileName: string;
    }>(
      scope
        ? `${organizationAcceptancesPath(scope)}/${acceptanceId}/download`
        : `/v1/admin/legal-document-acceptances/${acceptanceId}/download`
    );

    if (!result.success) {
      throw new Error(result.error?.message || "Download unavailable");
    }

    const link = document.createElement("a");
    link.href = result.data.downloadUrl;
    link.download = result.data.fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}
