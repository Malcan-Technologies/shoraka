import type { AdminContractApplicationSummary, AdminContractDetail } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken, pickHighestAdminTabToken } from "@/lib/admin-status-token";
import { resolveContractNoteStatusBadge } from "@/contracts/utils/contract-note-status";

export const CONTRACT_DETAIL_TAB_IDS = [
  "overview",
  "facility-offer",
  "applications",
  "notes",
  "documents",
  "activity",
] as const;

export type ContractDetailTabId = (typeof CONTRACT_DETAIL_TAB_IDS)[number];

export function isContractDetailTabId(value: string): value is ContractDetailTabId {
  return (CONTRACT_DETAIL_TAB_IDS as readonly string[]).includes(value);
}

type ContractApplicationStatus = Pick<AdminContractApplicationSummary, "status">;

/** Applications waiting on CashSouk (yellow in the admin status map). */
export function contractApplicationsNeedingAction(
  applications: ContractApplicationStatus[]
): ContractApplicationStatus[] {
  return applications.filter(
    (application) => getAdminStatusToken(application.status) === "action"
  );
}

/**
 * Dot on the Applications tab. Outstanding work wins over waiting, which wins
 * over finished states, so the dot always answers "is there something to do".
 */
export function resolveContractApplicationsTabToken(
  applications: ContractApplicationStatus[]
): StatusToken {
  if (applications.length === 0) return "neutral";
  return pickHighestAdminTabToken(
    applications.map((application) => getAdminStatusToken(application.status))
  );
}

export function resolveContractOverviewTabToken(status: string): StatusToken {
  return getAdminStatusToken(status);
}

export function resolveContractFacilityOfferTabToken(
  contract: Pick<AdminContractDetail, "status" | "offerDetails">
): StatusToken {
  const offer = contract.offerDetails;
  const hasOffer =
    !!offer &&
    Object.values(offer).some((value) => value !== null && value !== undefined && value !== "");
  if (!hasOffer) {
    const statusToken = getAdminStatusToken(contract.status);
    return statusToken === "action" ? "submitted" : "neutral";
  }
  if (offer.responded_at) return "success";
  return "submitted";
}

export function resolveContractNotesTabToken(
  notes: Array<{ status: string }>
): StatusToken {
  if (notes.length === 0) return "neutral";
  return pickHighestAdminTabToken(notes.map((note) => resolveContractNoteStatusBadge(note).token));
}

export function resolveContractDocumentsTabToken(hasDocument: boolean): StatusToken {
  return hasDocument ? "success" : "neutral";
}

/** Activity is always present and has no workflow status. */
export const CONTRACT_REFERENCE_TAB_TOKEN = "neutral" as const satisfies StatusToken;

export type ContractDetailNextAction = {
  tabId: ContractDetailTabId;
  title: string;
  description: string;
  ctaLabel: string;
};

/**
 * Facilities are read-only here, so the only admin work a facility can surface
 * is a linked application that still needs review.
 */
export function resolveContractDetailNextAction(
  contract: Pick<AdminContractDetail, "applications">
): ContractDetailNextAction | null {
  const pending = contractApplicationsNeedingAction(contract.applications);
  if (pending.length === 0) return null;

  return {
    tabId: "applications",
    title:
      pending.length === 1
        ? "An application on this facility needs review"
        : `${pending.length} applications on this facility need review`,
    description:
      pending.length === 1
        ? "One linked application is waiting on CashSouk. Open it from the Applications tab to continue the review."
        : "Linked applications are waiting on CashSouk. Open them from the Applications tab to continue the reviews.",
    ctaLabel: "Open Applications",
  };
}
