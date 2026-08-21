import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createApiClient } from "../api-client";
import { useAuthTokenIfPresent } from "../auth-context";

/** Presigned inline URL for an S3 object the caller is allowed to view. */
export function useS3ViewUrl(s3Key: string | null) {
  const auth = useAuthTokenIfPresent();
  const getAccessToken = auth?.getAccessToken;
  const apiClient = useMemo(
    () => (getAccessToken ? createApiClient(undefined, getAccessToken) : null),
    [getAccessToken]
  );

  return useQuery({
    queryKey: ["s3-view-url", s3Key],
    queryFn: async () => {
      if (!s3Key || !apiClient) return null;
      const response = await apiClient.getS3ViewUrl(s3Key);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to get view URL");
      }
      return response.data.viewUrl;
    },
    enabled: Boolean(s3Key && apiClient),
    staleTime: 50 * 60 * 1000,
  });
}
