import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { NoteAuditLogDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useNoteAuditHistory(noteId: string | null, page = 1, pageSize = 15) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "note-audit-history", noteId, page, pageSize],
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getNoteAuditHistory(noteId, { page, pageSize });
      if (!response.success) {
        throw new Error(response.error?.message || "Failed to load note audit history");
      }
      return response.data as {
        logs: NoteAuditLogDto[];
        pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
      };
    },
    enabled: Boolean(noteId),
    staleTime: 1000 * 60,
  });
}
