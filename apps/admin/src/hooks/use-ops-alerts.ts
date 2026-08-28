import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { OpsAlertListItem, OpsAlertSeverity, OpsAlertStatus, OpsAlertType } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type OpsAlertsParams = {
  page: number;
  pageSize?: number;
  status?: OpsAlertStatus;
  type?: OpsAlertType;
  severity?: OpsAlertSeverity;
  search?: string;
};

type ListResponse = {
  alerts: OpsAlertListItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

export function useOpsAlerts(params: OpsAlertsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "ops-alerts", params],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("page", String(params.page));
      query.set("pageSize", String(params.pageSize ?? 20));
      if (params.status) query.set("status", params.status);
      if (params.type) query.set("type", params.type);
      if (params.severity) query.set("severity", params.severity);
      if (params.search) query.set("search", params.search);
      const response = await apiClient.get<ListResponse>(
        `/v1/admin/ops-alerts?${query.toString()}`
      );
      if (!response.success) throw new Error("Failed to load ops alerts");
      return response.data;
    },
  });
}

export function useOpsAlertAction() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; action: "acknowledge" | "resolve" | "close" }) => {
      const response = await apiClient.post<{ alert: OpsAlertListItem }>(
        `/v1/admin/ops-alerts/${input.id}/${input.action}`,
        {}
      );
      if (!response.success) throw new Error("Failed to update ops alert");
      return response.data.alert;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "ops-alerts"] });
    },
  });
}
