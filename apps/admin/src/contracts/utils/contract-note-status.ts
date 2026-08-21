import type { AdminContractNoteSummary } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { formatNoteStatus } from "@/notes/utils/format-note-status";

export type ContractNoteStatusBadge = {
  label: string;
  token: StatusToken;
};

/**
 * Contract note summaries carry a bare status string, so the shared
 * `NoteStatusBadge` (which derives its label from listing/funding/servicing on a
 * full note payload) cannot be used on this table. Fall back to the admin status
 * map so the colour still answers "does CashSouk have to act".
 */
export function resolveContractNoteStatusBadge(
  note: Pick<AdminContractNoteSummary, "status">
): ContractNoteStatusBadge {
  return {
    label: formatNoteStatus(note.status),
    token: getAdminStatusToken(note.status),
  };
}
