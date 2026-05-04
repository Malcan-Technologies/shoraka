import { useQuery } from "@tanstack/react-query";
import { useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const applicationLogsKeys = {
  all: ["admin", "application-logs"] as const,
  list: (applicationId: string | null) =>
    [...applicationLogsKeys.all, applicationId] as const,
};

/**
 * useApplicationLogs
 *
 * What this hook does:
 * - Fetches application-scoped logs from /v1/applications/:id/logs.
 * - Normalizes response to a consistent shape.
 * - Returns the array under `data` plus optional `total` when the server provides pagination.
 *
 * Data shape returned:
 * { data: Activity[], isLoading, error, total?: number }
 */
type RawLogItem = Record<string, unknown>;

export type ApplicationLogEntry = {
  id: string;
  event_type: string;
  activity: unknown;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  remark: string | null;
  entityId: string | null;
  review_cycle: number | null;
};

function normalizeLogItem(d: RawLogItem): ApplicationLogEntry {
  return {
    id: typeof d.id === "string" ? d.id : String(d.id ?? ""),
    event_type: typeof d.event_type === "string" ? d.event_type : String(d.event_type ?? ""),
    activity: d.activity,
    actor_id: typeof d.actor_id === "string" ? d.actor_id : typeof d.user_id === "string" ? d.user_id : null,
    metadata: d.metadata != null && typeof d.metadata === "object" && !Array.isArray(d.metadata)
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
    review_cycle: typeof d.review_cycle === "number" ? d.review_cycle : null,
  };
}

export function useApplicationLogs(applicationId: string | null) {
  const { getAccessToken } = useAuthToken();

  const query = useQuery({
    queryKey: applicationLogsKeys.list(applicationId),
    queryFn: async () => {
      if (!applicationId) throw new Error("Application ID is required");
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/v1/applications/${encodeURIComponent(applicationId)}/logs`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Failed to fetch application logs: ${res.status} ${body}`);
      }

      const payload = await res.json();
      if (!payload.success) {
        throw new Error(payload.error?.message || "Failed to fetch application logs");
      }

      const raw = payload.data;

      let items: RawLogItem[] = [];
      let total: number | undefined = undefined;

      if (Array.isArray(raw)) {
        items = raw as RawLogItem[];
        total = raw.length;
      } else if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
        const envelope = raw as { items: RawLogItem[]; pagination?: { total?: number } };
        items = envelope.items;
        total = envelope.pagination?.total ?? envelope.items.length;
      }

      const normalized = items.map((d) => normalizeLogItem(d));

      return {
        items: normalized,
        pagination: typeof total === "number" ? { total } : undefined,
      };
    },
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 1,
  });

  const qdata = query.data;

  return {
    data: qdata?.items ?? [],
    isLoading: query.isLoading,
    error: query.error,
    total: qdata?.pagination?.total,
  };
}

