import { ApplicationStatus, Prisma, ReviewStepStatus } from "@prisma/client";
import type {
  ArchivedOfferSigningRecord,
  OfferSigningRecord,
} from "./types";
import {
  isSignedOfferSigningRecord,
  parseOfferSigningHistory,
} from "./types";

export function buildArchivedSigningEntry(params: {
  offerSigning: OfferSigningRecord;
  offerVersion: number | null;
  archivedByUserId: string;
  archivedAt: string;
}): ArchivedOfferSigningRecord {
  const { offerSigning, offerVersion, archivedByUserId, archivedAt } = params;
  return {
    provider: "signingcloud",
    status: "signed",
    signer_email: offerSigning.signer_email,
    signed_offer_letter_s3_key: offerSigning.signed_offer_letter_s3_key!,
    signed_file_sha256: offerSigning.signed_file_sha256,
    completed_at: offerSigning.completed_at ?? archivedAt,
    initiated_by_user_id: offerSigning.initiated_by_user_id,
    offer_version: offerVersion ?? undefined,
    archived_at: archivedAt,
    archived_by_user_id: archivedByUserId,
    archive_reason: "admin_resign",
  };
}

export function appendOfferSigningHistory(
  existingHistory: Prisma.JsonValue | null | undefined,
  entry: ArchivedOfferSigningRecord
): Prisma.InputJsonValue {
  const prev = parseOfferSigningHistory(existingHistory);
  return [...prev, entry] as unknown as Prisma.InputJsonValue;
}

export function assertCanArchiveForResign(offerSigning: Prisma.JsonValue | null | undefined): OfferSigningRecord {
  if (!isSignedOfferSigningRecord(offerSigning)) {
    throw new Error("NO_SIGNED_OFFER");
  }
  return offerSigning as OfferSigningRecord;
}

export function resetOfferDetailsForResign(
  offer: Record<string, unknown>,
  nowIso: string
): Record<string, unknown> {
  const previousVersion =
    typeof offer.version === "number" && Number.isFinite(offer.version) ? offer.version : 0;
  return {
    ...offer,
    responded_at: null,
    responded_by_user_id: null,
    rejection_reason: undefined,
    sent_at: nowIso,
    version: previousVersion + 1,
  };
}

export function revertContractDetailsAfterResign(
  contractDetails: Record<string, unknown> | null,
  offeredFacility: number
): Record<string, unknown> {
  const cd = contractDetails && typeof contractDetails === "object" ? { ...contractDetails } : {};
  const utilized =
    typeof cd.utilized_facility === "number" && Number.isFinite(cd.utilized_facility)
      ? cd.utilized_facility
      : 0;
  return {
    ...cd,
    approved_facility: 0,
    utilized_facility: utilized,
    available_facility: Math.max(offeredFacility - utilized, 0),
  };
}

export const contractReviewSectionForResign = "contract_details" as const;

export function reviewStatusForResignOffer(): ReviewStepStatus {
  return ReviewStepStatus.OFFER_SENT;
}

export function applicationStatusAfterContractResign(): ApplicationStatus {
  return ApplicationStatus.CONTRACT_SENT;
}
