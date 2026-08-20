import { useMemo } from "react";
import { createApiClient, useAuthToken, type ApplicationLogEntry } from "@cashsouk/config";
import { useQueries, useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type { ApplicationLogEntry };

export const issuerApplicationLogsKeys = {
  all: ["issuer", "application-logs"] as const,
  list: (applicationId: string | null) =>
    [...issuerApplicationLogsKeys.all, applicationId] as const,
};

function normalizeLogItem(d: Record<string, unknown>): ApplicationLogEntry {
  const actor =
    d.actor && typeof d.actor === "object" && !Array.isArray(d.actor)
      ? (d.actor as Record<string, unknown>)
      : null;
  const metadata =
    d.metadata != null && typeof d.metadata === "object" && !Array.isArray(d.metadata)
      ? (d.metadata as Record<string, unknown>)
      : null;
  const remarks =
    typeof metadata?.remarks === "string"
      ? metadata.remarks
      : typeof d.remark === "string"
        ? d.remark
        : null;
  const target = d.target && typeof d.target === "object" && !Array.isArray(d.target)
    ? (d.target as Record<string, unknown>)
    : null;
  return {
    id: typeof d.id === "string" ? d.id : String(d.id ?? ""),
    event_type:
      typeof d.eventType === "string"
        ? d.eventType
        : typeof d.event_type === "string"
          ? d.event_type
          : String(d.event_type ?? ""),
    activity: d.activity,
    actor_id:
      typeof actor?.userId === "string"
        ? actor.userId
        : typeof d.actor_id === "string"
          ? d.actor_id
          : typeof d.user_id === "string"
            ? d.user_id
            : null,
    user_id: typeof d.user_id === "string" ? d.user_id : typeof actor?.userId === "string" ? actor.userId : null,
    metadata,
    ip_address:
      typeof d.ipAddress === "string"
        ? d.ipAddress
        : typeof d.ip_address === "string"
          ? d.ip_address
          : null,
    created_at:
      typeof d.occurredAt === "string"
        ? d.occurredAt
        : typeof d.createdAt === "string"
          ? d.createdAt
          : typeof d.created_at === "string"
            ? d.created_at
            : String(d.created_at ?? ""),
    remark: remarks,
    entityId:
      typeof target?.id === "string"
        ? target.id
        : typeof d.entityId === "string"
          ? d.entityId
          : typeof d.entity_id === "string"
            ? d.entity_id
            : null,
    entity_id:
      typeof target?.id === "string"
        ? target.id
        : typeof d.entity_id === "string"
          ? d.entity_id
          : null,
    review_cycle: typeof d.review_cycle === "number" ? d.review_cycle : null,
  };
}

async function fetchApplicationLogs(
  apiClient: ReturnType<typeof createApiClient>,
  applicationId: string
): Promise<ApplicationLogEntry[]> {
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
}

export function useApplicationLogs(applicationId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const query = useQuery({
    queryKey: issuerApplicationLogsKeys.list(applicationId),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      return fetchApplicationLogs(apiClient, applicationId);
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

export function useApplicationLogsMany(applicationIds: readonly string[]) {
  const uniqueIds = useMemo(
    () => [...new Set(applicationIds.filter((id) => id.trim().length > 0))].sort(),
    [applicationIds]
  );
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const queries = useQueries({
    queries: uniqueIds.map((applicationId) => ({
      queryKey: issuerApplicationLogsKeys.list(applicationId),
      queryFn: () => fetchApplicationLogs(apiClient, applicationId),
      staleTime: 60_000,
    })),
  });

  return {
    data: queries.flatMap((query) => query.data ?? []),
    isLoading: uniqueIds.length > 0 && queries.some((query) => query.isPending),
  };
}
