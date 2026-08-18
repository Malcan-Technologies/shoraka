import type { StatusToken } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";

type NoteFundingFields = {
  status?: string;
  fundingStatus: string;
};

export function isNoteFundingOpen(fundingStatus: string) {
  return fundingStatus === "OPEN";
}

export function isNoteFundingFailed(note: NoteFundingFields) {
  return note.status === "FAILED_FUNDING" || note.fundingStatus === "FAILED";
}

/** Funding window has ended (successful close or failed close). */
export function isNoteFundingComplete(note: NoteFundingFields) {
  return (
    note.status === "REPAID" ||
    note.fundingStatus === "FUNDED" ||
    note.fundingStatus === "CLOSED" ||
    isNoteFundingFailed(note)
  );
}

/** Track behind the fill. Pair with `getNoteFundingIndicatorClass`. */
export function getNoteFundingProgressClass(note: NoteFundingFields) {
  if (isNoteFundingFailed(note)) {
    return "bg-status-rejected-bg";
  }
  if (isNoteFundingOpen(note.fundingStatus)) {
    return "bg-status-submitted-bg";
  }
  return "bg-muted";
}

/** Fill colour — same tokens as the note-detail funding bar. */
export function getNoteFundingIndicatorClass(note: NoteFundingFields) {
  if (isNoteFundingFailed(note)) {
    return "bg-status-rejected-text";
  }
  if (isNoteFundingOpen(note.fundingStatus)) {
    return "bg-status-submitted-text";
  }
  if (isNoteFundingComplete(note)) {
    return "bg-status-success-text";
  }
  return "bg-status-neutral-text";
}

/** Accent for funded amounts / progress copy. */
export function getNoteFundingAccentClass(note: NoteFundingFields) {
  if (isNoteFundingFailed(note)) return "text-status-rejected-text";
  if (isNoteFundingOpen(note.fundingStatus)) return "text-status-submitted-text";
  if (
    note.status === "REPAID" ||
    note.fundingStatus === "FUNDED" ||
    note.fundingStatus === "CLOSED"
  ) {
    return "text-status-success-text";
  }
  return undefined;
}

/**
 * Funding chips on note surfaces. OPEN matches the Funding Open badge (blue /
 * waiting on investors). FUNDED/CLOSED are green — not `getAdminStatusToken`
 * (FUNDED is yellow on disbursement queues).
 */
export function getNoteFundingStatusToken(note: NoteFundingFields): StatusToken {
  if (isNoteFundingOpen(note.fundingStatus)) return "submitted";
  if (note.fundingStatus === "FUNDED" || note.fundingStatus === "CLOSED") {
    return "success";
  }
  return getAdminStatusToken(note.fundingStatus);
}

export function getNoteFundingStatusLabel(note: NoteFundingFields) {
  if (isNoteFundingOpen(note.fundingStatus)) return "Funding Open";
  if (note.fundingStatus === "CLOSED" || note.fundingStatus === "FUNDED") {
    return "Funding Closed";
  }
  return note.fundingStatus.replace(/_/g, " ");
}

/**
 * Live (funded) loan in servicing or later. Draft, listed, and disbursing notes
 * should not show settlement amount / payment due — those facts are not in force yet.
 */
export function isNoteActiveLoan(note: { status?: string }) {
  return (
    note.status === "ACTIVE" ||
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.status === "REPAID"
  );
}
