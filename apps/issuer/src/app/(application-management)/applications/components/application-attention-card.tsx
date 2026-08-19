"use client";

import * as React from "react";
import Link from "next/link";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NormalizedApplication } from "../status";
import { ApplicationCardMenu } from "./application-card-menu";
import {
  ATTENTION_SURFACE,
  applicationAttentionHeadline,
  applicationCardSubStatus,
  applicationHeadlineAmount,
  getApplicationCardPrimaryAction,
} from "./application-card-model";
import {
  badgeKeyToStatusToken,
  formatApplicationDisplayId,
  getIssuerCardStatusLabel,
} from "./issuer-status-display";
import { AttentionCardHeading } from "@/components/attention-type-title";
import { attentionKindFromApplicationType } from "@/components/attention-type";

export function ApplicationAttentionCard({
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
  const action = getApplicationCardPrimaryAction(application);
  const statusToken = badgeKeyToStatusToken(application.cardStatus.badgeKey);
  const statusLabel = getIssuerCardStatusLabel(application.cardStatus.badgeKey, {
    withdrawReason:
      application.cardStatus.badgeKey === "withdrawn" ||
      application.cardStatus.badgeKey === "declined" ||
      application.cardStatus.badgeKey === "offer_expired"
        ? application.withdrawReason
        : undefined,
    offerAcceptanceStatus: application.offerAcceptanceStatus,
  });
  const displayId = formatApplicationDisplayId(application.id, application.displayReference);
  const kind = attentionKindFromApplicationType(application.type);
  const ctaLabel =
    action.kind === "reviewOffer" && action.buttonVariant === "default"
      ? "Review offer"
      : action.label;

  return (
    <article
      className={cn(
        "flex h-full min-h-[18.5rem] w-full flex-col rounded-2xl border p-6 shadow-sm md:p-8 md:shadow",
        ATTENTION_SURFACE[statusToken] ?? ATTENTION_SURFACE.action
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge label={statusLabel} status={statusToken} />
        <ApplicationCardMenu
          application={application}
          onViewSignedContractOffer={onViewSignedContractOffer}
          onCancelApplication={onCancelApplication}
          onDeleteDraft={onDeleteDraft}
          isCancelApplicationPending={isCancelApplicationPending}
        />
      </div>

      <AttentionCardHeading kind={kind}>{applicationAttentionHeadline(action)}</AttentionCardHeading>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <p className="truncate text-ui text-muted-foreground" title={application.customer}>
          {application.customer}
        </p>
        <p className="mt-1 text-section-title tabular-nums tracking-tight">
          {applicationHeadlineAmount(application)}
        </p>
        <p className="mt-3 text-ui text-muted-foreground">{displayId}</p>
        <p className="text-ui text-muted-foreground">{applicationCardSubStatus(application)}</p>
        {action.deadlineSummary ? (
          <p className="mt-2 text-ui font-medium text-status-action-text">{action.deadlineSummary}</p>
        ) : null}
        {action.hint ? <p className="mt-1 text-ui text-muted-foreground">{action.hint}</p> : null}

        <div className="mt-auto pt-6">
          <Button size="lg" variant={action.buttonVariant} className="w-full" asChild>
            <Link href={action.href}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
