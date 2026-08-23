import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { PaymentAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const reconExceptionAuditKeys = {
  all: ["admin", "recon-exception-audit"] as const,
  list: (exceptionId: string | null) => [...reconExceptionAuditKeys.all, exceptionId] as const,
};

export function useReconExceptionAudit(exceptionId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: reconExceptionAuditKeys.list(exceptionId),
    queryFn: async () => {
      if (!exceptionId) throw new Error("Exception ID is required");
      const response = await apiClient.getAdminGatewayReconExceptionEvents(exceptionId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load reconciliation audit history");
      }
      return response.data as PaymentAuditLogDto[];
    },
    enabled: Boolean(exceptionId),
    staleTime: 1000 * 60,
  });
}
