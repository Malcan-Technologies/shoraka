import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetAdminInvestmentsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useInvestmentsApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export const adminInvestmentsKeys = {
  all: ["admin-investments"] as const,
  list: (params: GetAdminInvestmentsParams) => [...adminInvestmentsKeys.all, "list", params] as const,
};

/** Note detail Investors panel: note-scoped route on notes.view (not /admin/investments). */
export function useAdminNoteInvestments(
  noteId: string,
  params: { page: number; pageSize: number }
) {
  const apiClient = useInvestmentsApiClient();
  return useQuery({
    queryKey: [...adminInvestmentsKeys.all, "note", noteId, params] as const,
    queryFn: async () => {
      const response = await apiClient.getAdminNoteInvestments(noteId, params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled: Boolean(noteId),
  });
}

export function useAdminInvestments(params: GetAdminInvestmentsParams) {
  const apiClient = useInvestmentsApiClient();
  return useQuery({
    queryKey: adminInvestmentsKeys.list(params),
    queryFn: async () => {
      const response = await apiClient.getAdminInvestments(params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}
