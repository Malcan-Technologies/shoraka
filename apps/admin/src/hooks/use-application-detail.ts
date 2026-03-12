import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { applicationsKeys } from "@/applications/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApplicationDetail(id: string) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    const run = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;

        const response = await fetch(`${API_URL}/v1/applications/${encodeURIComponent(id)}/offers/stream`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let delimiterIndex = buffer.indexOf("\n\n");
          while (delimiterIndex !== -1) {
            const block = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);

            const dataLine = block
              .split("\n")
              .find((line) => line.startsWith("data:"))
              ?.slice(5)
              .trim();

            if (dataLine) {
              try {
                const event = JSON.parse(dataLine) as { applicationId?: string };
                if (event.applicationId === id) {
                  queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(id) });
                  queryClient.invalidateQueries({ queryKey: applicationsKeys.all });
                }
              } catch {
                // Ignore malformed SSE payloads.
              }
            }
            delimiterIndex = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // Ignore stream interruptions; mutation invalidations still keep data consistent.
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [id, getAccessToken, queryClient]);

  return useQuery({
    queryKey: applicationsKeys.detail(id),
    queryFn: async () => {
      const response = await apiClient.getAdminApplicationDetail(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useInvalidateApplicationDetail(id: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(id) });
  };
}
