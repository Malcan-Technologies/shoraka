import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { PaymentAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const withdrawalAuditKeys = {
  all: ["admin", "withdrawal-audit"] as const,
  list: (withdrawalId: string | null) => [...withdrawalAuditKeys.all, withdrawalId] as const,
};

export function useWithdrawalAudit(withdrawalId: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: withdrawalAuditKeys.list(withdrawalId),
    queryFn: async () => {
      if (!withdrawalId) throw new Error("Withdrawal ID is required");
      const response = await apiClient.getAdminWithdrawalEvents(withdrawalId);
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load withdrawal audit history");
      }
      return response.data as PaymentAuditLogDto[];
    },
    enabled: Boolean(withdrawalId),
    staleTime: 1000 * 60,
  });
}
