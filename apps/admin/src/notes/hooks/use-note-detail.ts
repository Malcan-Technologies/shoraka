import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { notesKeys } from "../query-keys";
// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
import { prospectusUiDiag } from "../prospectus-review/prospectus-ui-diagnostics";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useNoteDetail(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: notesKeys.detail(noteId),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminNoteDetail(noteId);
      if (!response.success) throw new Error(response.error.message);
      // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
      // Skipped while funding is OPEN: that state polls every 5s and is past approval.
      if (response.data.fundingStatus !== "OPEN") {
        prospectusUiDiag("prospectus.ui.note_detail.response", {
          noteId,
          correlationId: response.correlationId ?? null,
          noteStatus: response.data.status,
          publishedAt: response.data.publishedAt ?? null,
          prospectus: response.data.prospectus ?? null,
        });
      }
      return response.data;
    },
    refetchInterval: (query) => (query.state.data?.fundingStatus === "OPEN" ? 5000 : false),
  });
}

export function useNoteLedger(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: [...notesKeys.detail(noteId), "ledger"],
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminNoteLedger(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

