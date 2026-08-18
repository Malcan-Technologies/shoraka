import { formatContractReference, type NoteDetail } from "@cashsouk/types";

export type NoteSourceLinkage = {
  /** No originating facility: the note came straight off a standalone application. */
  isStandalone: boolean;
  typeLabel: "Standalone note" | "Under facility";
  contractId: string | null;
  contractHref: string | null;
};

export type NoteFacilityLink = {
  href: string;
  label: string;
};

function trimmedContractId(contractId: string | null | undefined): string | null {
  return typeof contractId === "string" && contractId.trim() ? contractId.trim() : null;
}

/** Admin notes table: link to the master facility, or null when the note is standalone. */
export function resolveNoteFacilityLink(input: {
  contractId: string | null | undefined;
  displayReference?: string | null;
}): NoteFacilityLink | null {
  const contractId = trimmedContractId(input.contractId);
  if (!contractId) return null;
  return {
    href: `/contracts/${encodeURIComponent(contractId)}`,
    label: formatContractReference({
      displayReference: input.displayReference,
      id: contractId,
    }),
  };
}

/**
 * A note is either linked to a facility or it is not — there is no second
 * product story. Drives the header type chip and the source rail.
 */
export function resolveNoteSourceLinkage(
  note: Pick<NoteDetail, "sourceContractId">
): NoteSourceLinkage {
  const contractId = trimmedContractId(note.sourceContractId);

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
    typeLabel: "Under facility",
    contractId,
    contractHref: `/contracts/${encodeURIComponent(contractId)}`,
  };
}
