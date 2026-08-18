import type { NoteDetail } from "@cashsouk/types";

export type NoteSourceLinkage = {
  /** No originating contract: the note came straight off a standalone application. */
  isStandalone: boolean;
  typeLabel: "Standalone note" | "Under contract";
  contractId: string | null;
  contractHref: string | null;
};

/**
 * A note is either linked to a contract or it is not — there is no second
 * product story. Drives the header type chip and the source rail.
 */
export function resolveNoteSourceLinkage(
  note: Pick<NoteDetail, "sourceContractId">
): NoteSourceLinkage {
  const contractId =
    typeof note.sourceContractId === "string" && note.sourceContractId.trim()
      ? note.sourceContractId
      : null;

  if (!contractId) {
    return {
      isStandalone: true,
      typeLabel: "Standalone note",
      contractId: null,
      contractHref: null,
    };
  }

  return {
    isStandalone: false,
    typeLabel: "Under contract",
    contractId,
    contractHref: `/contracts/${encodeURIComponent(contractId)}`,
  };
}
