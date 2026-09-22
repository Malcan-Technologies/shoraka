import type { AdminContractNoteSummary } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
import { noteDisplayFundedAmount } from "@/notes/utils/funding-progress";

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

/** Contract note summaries omit fundingStatus; Fail Funding still sets status FAILED_FUNDING. */
export function contractNoteDisplayFundedAmount(
  note: Pick<AdminContractNoteSummary, "status" | "fundedAmount">
): number {
  return noteDisplayFundedAmount({
    status: note.status,
    fundingStatus: "",
    fundedAmount: note.fundedAmount,
  });
}
