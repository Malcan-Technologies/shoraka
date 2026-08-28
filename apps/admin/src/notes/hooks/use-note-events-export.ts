import { createApiClient, useAuthToken } from "@cashsouk/config";
import { noteEventToActivityCsvRow } from "@/notes/utils/note-activity-csv";
import type { AdminActivityCsvRow } from "@/components/admin-activity-csv";

/**
 * Full, unlimited note event history for CSV export — the note-detail fetch caps
 * `events` at 50 rows for the timeline's UI performance (noteInclude.events take:50),
 * so the export must hit GET /v1/admin/notes/:id/events (no cap) independently rather
 * than reuse the already-loaded, possibly-truncated `note.events`.
 */
export function useNoteEventsExport(noteId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return async (): Promise<AdminActivityCsvRow[]> => {
    const response = await apiClient.getAdminNoteEvents(noteId);
    if (!response.success) {
      throw new Error(response.error.message);
    }
    return response.data.map(noteEventToActivityCsvRow);
  };
}
