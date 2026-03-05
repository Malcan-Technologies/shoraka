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

      // Server may return either:
      // - an array of log items, OR
      // - an envelope { items: [], pagination: { total, ... } }
      const raw = payload.data;

      let items: any[] = [];
      let total: number | undefined = undefined;

      if (Array.isArray(raw)) {
        items = raw;
        total = raw.length;
      } else if (raw && Array.isArray(raw.items)) {
        items = raw.items;
        total = raw.pagination?.total ?? raw.items.length;
      }

      // Normalize each item minimally for the UI
      const normalized = items.map((d: any) => ({
        id: d.id,
        event_type: d.event_type,
        activity: d.activity,
        actor_id: d.actor_id ?? d.user_id,
        metadata: (d.metadata ?? null) as Record<string, unknown> | null,
        ip_address: d.ip_address ?? null,
        created_at: d.created_at,
        remark: d.remark ?? null,
        entityId: d.entityId ?? d.entity_id ?? null,
      }));

      return {
        items: normalized,
        pagination: typeof total === "number" ? { total } : undefined,
      };
    },
    enabled: !!applicationId,
    staleTime: 1000 * 60 * 1,
  });

  const qdata = query.data as any;

  return {
    data: (qdata?.items as any[]) ?? [],
    isLoading: query.isLoading,
    error: query.error,
    total: qdata?.pagination?.total as number | undefined,
  };
}

