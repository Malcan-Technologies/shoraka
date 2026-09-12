/** Exclusive Issuer response banners. Entity can stay OFFER_SENT after the issuer submits. */

export type IssuerResponseBannerKind =
  | "not_sent"
  | "waiting"
  | "accepted"
  | "declined"
  | "expired"
  | "changes"
  | "review";

const NOT_SENT_STATUSES = new Set(["", "SUBMITTED", "PENDING", "DRAFT"]);
const ISSUER_ACCEPTED_PHASES = new Set([
  "COMPLETED",
  "PENDING_ADMIN_REVIEW",
  "APPROVED_FOR_SIGNING",
  "SIGNING_IN_PROGRESS",
]);

export function issuerResponseBannerKind(input: {
  entityStatus?: string | null;
  acceptanceStatus?: string | null;
}): IssuerResponseBannerKind {
  const status = (input.entityStatus ?? "").toUpperCase();
  const acceptance = (input.acceptanceStatus ?? "").toUpperCase();

  if (NOT_SENT_STATUSES.has(status)) return "not_sent";
  if (status === "WITHDRAWN" || acceptance === "DECLINED") return "declined";
  if (status === "OFFER_EXPIRED") return "expired";
  if (status === "CHANGES_REQUESTED" || acceptance === "CHANGES_REQUESTED") return "changes";
  if (status === "APPROVED" || ISSUER_ACCEPTED_PHASES.has(acceptance)) return "accepted";
  if (status === "OFFER_SENT" && (!acceptance || acceptance === "PENDING_ISSUER")) return "waiting";
  return "review";
}
