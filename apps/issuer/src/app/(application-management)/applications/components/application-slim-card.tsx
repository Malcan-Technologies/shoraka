"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isIssuerApplicationActionable, type NormalizedApplication } from "../status";
import { ApplicationCardMenu } from "./application-card-menu";
import {
  ATTENTION_SURFACE,
  applicationCardSubStatus,
  applicationHeadlineAmount,
  getApplicationCardPrimaryAction,
} from "./application-card-model";
import {
  badgeKeyToStatusToken,
  formatApplicationDisplayId,
  getIssuerCardStatusLabel,
} from "./issuer-status-display";

export function ApplicationSlimCard({
  application,
  onViewSignedContractOffer,
  onCancelApplication,
  onDeleteDraft,
  isCancelApplicationPending,
}: {
  application: NormalizedApplication;
  onViewSignedContractOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onCancelApplication?: (applicationId: string) => void;
  onDeleteDraft?: (applicationId: string) => void;
  isCancelApplicationPending?: boolean;
}) {
  const { cardStatus } = application;
  const displayId = formatApplicationDisplayId(application.id, application.displayReference);
  const statusToken = badgeKeyToStatusToken(cardStatus.badgeKey);
  const needsAttention = isIssuerApplicationActionable(application);
  const statusLabel = getIssuerCardStatusLabel(cardStatus.badgeKey, {
    withdrawReason:
      cardStatus.badgeKey === "withdrawn" ||
      cardStatus.badgeKey === "declined" ||
      cardStatus.badgeKey === "offer_expired"
        ? application.withdrawReason
        : undefined,
    offerAcceptanceStatus: application.offerAcceptanceStatus,
  });
  const action = getApplicationCardPrimaryAction(application);

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm md:p-5",
        needsAttention ? ATTENTION_SURFACE[statusToken] : "border-border bg-card"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={statusLabel} status={statusToken} />
            <span className="text-ui font-semibold text-foreground">
              {displayId}
              {application.type !== "Generic" ? ` · ${application.type}` : ""}
            </span>
          </div>
          <p className="text-ui leading-6 text-foreground">
            {application.customer}
            {" · "}
            {applicationHeadlineAmount(application)}
            {application.submittedAt
              ? ` · submitted ${format(new Date(application.submittedAt), "d MMM yyyy")}`
              : ""}
          </p>
          <p className="text-ui leading-5 text-muted-foreground">
            {applicationCardSubStatus(application)}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button size="sm" variant={action.buttonVariant} className="rounded-xl" asChild>
              <Link href={action.href}>{action.label}</Link>
            </Button>
            {action.hint ? (
              <span className="max-w-[14rem] text-right text-ui text-muted-foreground">
                {action.hint}
              </span>
            ) : null}
            {action.deadlineSummary ? (
              <span className="text-ui text-muted-foreground">{action.deadlineSummary}</span>
            ) : null}
          </div>
          <ApplicationCardMenu
            application={application}
            onViewSignedContractOffer={onViewSignedContractOffer}
            onCancelApplication={onCancelApplication}
            onDeleteDraft={onDeleteDraft}
            isCancelApplicationPending={isCancelApplicationPending}
            compact
          />
        </div>
      </div>
    </article>
  );
}
