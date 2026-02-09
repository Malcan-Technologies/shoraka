"use client";

import { useAuthToken } from "@cashsouk/config";
import { useQuery } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Fetches a presigned view URL for an S3 key (e.g. product image). Used for image preview. */
export function useS3ViewUrl(s3Key: string | null) {
  const { getAccessToken } = useAuthToken();

  return useQuery({
    queryKey: ["s3-view-url", s3Key],
    queryFn: async () => {
      if (!s3Key) return null;
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/v1/s3/view-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ s3Key }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error?.message || "Failed to get view URL");
      return result.data.viewUrl as string;
    },
    enabled: !!s3Key,
    staleTime: 50 * 60 * 1000,
  });
}
