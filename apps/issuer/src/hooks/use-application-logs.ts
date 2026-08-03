import { createApiClient, useAuthToken, type ApplicationLogEntry } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type { ApplicationLogEntry };

export const issuerApplicationLogsKeys = {
  all: ["issuer", "application-logs"] as const,
  list: (applicationId: string | null) =>
    [...issuerApplicationLogsKeys.all, applicationId] as const,
};

function normalizeLogItem(d: Record<string, unknown>): ApplicationLogEntry {
  return {
    id: typeof d.id === "string" ? d.id : String(d.id ?? ""),
    event_type: typeof d.event_type === "string" ? d.event_type : String(d.event_type ?? ""),
    activity: d.activity,
    actor_id:
      typeof d.actor_id === "string"
        ? d.actor_id
        : typeof d.user_id === "string"
          ? d.user_id
          : null,
    user_id: typeof d.user_id === "string" ? d.user_id : null,
    metadata:
      d.metadata != null && typeof d.metadata === "object" && !Array.isArray(d.metadata)
        ? (d.metadata as Record<string, unknown>)
        : null,
    ip_address: typeof d.ip_address === "string" ? d.ip_address : null,
    created_at: typeof d.created_at === "string" ? d.created_at : String(d.created_at ?? ""),
    remark: typeof d.remark === "string" ? d.remark : null,
    entityId:
      typeof d.entityId === "string"
        ? d.entityId
        : typeof d.entity_id === "string"
          ? d.entity_id
          : null,
    entity_id: typeof d.entity_id === "string" ? d.entity_id : null,
    review_cycle: typeof d.review_cycle === "number" ? d.review_cycle : null,
  };
}

export function useApplicationLogs(applicationId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const query = useQuery({
    queryKey: issuerApplicationLogsKeys.list(applicationId),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const response = await apiClient.getApplicationLogs(applicationId);
      if (!response.success) {
        throw new Error(response.error.message || "Failed to fetch application logs");
      }

      const raw = response.data;
      let items: Record<string, unknown>[] = [];

      if (Array.isArray(raw)) {
        items = raw as Record<string, unknown>[];
      } else if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
        items = (raw as { items: Record<string, unknown>[] }).items;
      }

      return items.map(normalizeLogItem);
    },
    enabled: !!applicationId,
    staleTime: 60_000,
  });

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
