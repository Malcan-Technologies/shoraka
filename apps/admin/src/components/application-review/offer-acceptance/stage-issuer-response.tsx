"use client";

import { format } from "date-fns";
import {
  ClockIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  getOfferAcceptanceFromOfferDetails,
  getOfferPhaseDeadlineDisplay,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  ADMIN_ACTION_SURFACE_CLASS,
  ADMIN_WAITING_SURFACE_CLASS,
} from "@/lib/admin-status-token";
import { AcceptanceSection, type AcceptanceSectionProps } from "../sections/acceptance-section";
import { issuerResponseBannerKind } from "./issuer-response-banner";
import { isAcceptanceHubReviewItem } from "./is-acceptance-hub-review-item";

function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "PPpp");
}

export function StageIssuerResponse({
  offerDetails,
  entityStatus,
  offerType,
  showParties,
  reviewItems,
  reviewRemarks,
  acceptanceProps,
}: {
  offerDetails: unknown;
  entityStatus?: string | null;
  offerType: "facility" | "invoice";
  showParties: boolean;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  reviewRemarks?: { scope?: string; scope_key?: string; remark?: string }[];
  acceptanceProps?: AcceptanceSectionProps;
}) {
  const status = (entityStatus ?? "").toUpperCase();
  const offer = (offerDetails && typeof offerDetails === "object"
    ? (offerDetails as Record<string, unknown>)
    : null);
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  const deadline = getOfferPhaseDeadlineDisplay(offerDetails);
  const noun = offerType === "facility" ? "facility" : "invoice";
  const respondedAt = formatTimestamp(offer?.responded_at);
  const submittedAt = formatTimestamp(acceptance?.submitted_at);
  const sentAt = formatTimestamp(offer?.sent_at);
  const rejectionReason =
    typeof offer?.rejection_reason === "string" && offer.rejection_reason.trim()
      ? offer.rejection_reason.trim()
      : null;

  const flagged = reviewItems.filter(
    (item) => item.status === "AMENDMENT_REQUESTED" && isAcceptanceHubReviewItem(item)
  );
  const banner = issuerResponseBannerKind({
    entityStatus: status,
    acceptanceStatus: acceptance?.status,
  });

  return (
    <div className="space-y-4">
      {banner === "not_sent" ? (
        <p className="text-ui text-muted-foreground">
          Nothing here yet — the issuer responds once the {noun} offer is sent.
        </p>
      ) : null}

      {banner === "waiting" ? (
        <div
          className={cn(
            "flex gap-3 rounded-xl border px-4 py-3.5",
            ADMIN_WAITING_SURFACE_CLASS
          )}
        >
          <ClockIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-submitted-text" />
          <div className="min-w-0 text-ui leading-6 text-status-submitted-text">
            <p>
              <span className="font-semibold">Waiting on the issuer.</span>{" "}
              {sentAt ? `Offer sent ${sentAt}. ` : null}
              {deadline?.summary ?? `Nothing for you to do until they accept the ${noun} offer.`}
            </p>
          </div>
        </div>
      ) : null}

      {banner === "declined" ? (
        <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-destructive">
          <XMarkIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 text-ui leading-6">
            <p>
              <span className="font-semibold">
                Issuer declined{respondedAt ? ` ${respondedAt}` : ""}.
              </span>
              {rejectionReason ? ` ${rejectionReason}` : ""}
            </p>
          </div>
        </div>
      ) : null}

      {banner === "expired" ? (
        <div
          className={cn(
            "flex gap-3 rounded-xl border px-4 py-3.5",
            ADMIN_ACTION_SURFACE_CLASS
          )}
        >
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-status-action-text" />
          <div className="min-w-0 text-ui leading-6 text-status-action-text">
            <p>
              <span className="font-semibold">Offer expired.</span>{" "}
              {deadline?.summary ?? `The ${noun} offer expired before the issuer responded.`}
            </p>
          </div>
        </div>
      ) : null}

      {banner === "accepted" ? (
        <p className="text-ui text-muted-foreground">
          {respondedAt ? `Issuer accepted ${respondedAt}.` : "Issuer accepted the offer."}
          {submittedAt ? ` Submitted for review ${submittedAt}.` : ""}
        </p>
      ) : null}

      {banner === "changes" ? (
        <div className={cn("rounded-xl border px-4 py-3.5", ADMIN_ACTION_SURFACE_CLASS)}>
          <p className="text-ui font-semibold text-status-action-text">
            Amendments requested — waiting on the issuer
          </p>
          {flagged.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ui text-foreground">
              {flagged.map((item) => {
                const remark = reviewRemarks?.find(
                  (row) => row.scope_key === item.item_id || row.scope_key?.includes(item.item_id)
                )?.remark;
                return (
                  <li key={`${item.item_type}:${item.item_id}`}>
                    {remark?.trim() || `${item.item_type} ${item.item_id}`}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-ui text-muted-foreground">
              Waiting for the issuer to resubmit flagged representatives or documents.
            </p>
          )}
        </div>
      ) : null}

      {showParties && acceptanceProps ? (
        <AcceptanceSection {...acceptanceProps} contentMode="parties" embedded hideSectionComments hideCapacityTiles />
      ) : null}
    </div>
  );
}
