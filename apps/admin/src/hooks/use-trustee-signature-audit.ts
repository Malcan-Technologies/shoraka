import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { NoteAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const trusteeSignatureAuditKeys = {
  all: ["admin", "trustee-signature-audit"] as const,
};

export function useTrusteeSignatureAudit() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: trusteeSignatureAuditKeys.all,
    queryFn: async () => {
      const response = await apiClient.getTrusteeSignatureAudit();
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load trustee signature audit");
      }
      return response.data as NoteAuditLogDto[];
    },
    staleTime: 1000 * 60,
  });
}
