"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { StatusBadge, type StatusToken } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isIssuerApplicationActionable, type NormalizedApplication } from "../status";
import {
  badgeKeyToStatusToken,
  countInvoicesNeedingAction,
  formatApplicationDisplayId,
  getIssuerPlainStatusLabel,
} from "./issuer-status-display";

/** Soft card wash (≈45% of badge fill) so attention reads without overpowering content. */
const ATTENTION_SURFACE: Record<StatusToken, string> = {
  action: "border-status-action-text/15 bg-[hsl(var(--status-action-bg)/0.45)]",
  submitted: "border-status-submitted-text/15 bg-[hsl(var(--status-submitted-bg)/0.45)]",
  "in-progress":
    "border-status-in-progress-text/15 bg-[hsl(var(--status-in-progress-bg)/0.45)]",
  success: "border-status-success-text/15 bg-[hsl(var(--status-success-bg)/0.45)]",
  completed: "border-status-completed-text/15 bg-[hsl(var(--status-completed-bg)/0.45)]",
  rejected: "border-status-rejected-text/15 bg-[hsl(var(--status-rejected-bg)/0.45)]",
  neutral: "border-status-neutral-text/15 bg-[hsl(var(--status-neutral-bg)/0.45)]",
};

function headlineAmount(app: NormalizedApplication): string {
  if (app.facilityApplied != null) return formatCurrency(app.facilityApplied);
  if (app.contractValue != null) return formatCurrency(app.contractValue);
  const invoiceSum = app.invoices.reduce((sum, inv) => sum + (inv.appliedFinancing ?? inv.value ?? 0), 0);
  if (invoiceSum > 0) return formatCurrency(invoiceSum);
  return "—";
}

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
  const isDraft = application.status === "draft";
  const hasContract = application.type === "Contract financing";
  const displayId = formatApplicationDisplayId(application.id);
  const statusToken = badgeKeyToStatusToken(cardStatus.badgeKey);
  const needsAttention = isIssuerApplicationActionable(application);
  const statusLabel = getIssuerPlainStatusLabel(
    cardStatus.badgeKey,
    cardStatus.badgeKey === "withdrawn" ||
      cardStatus.badgeKey === "declined" ||
      cardStatus.badgeKey === "offer_expired"
      ? application.withdrawReason
      : undefined
  );
  const invoicesNeedingAction = countInvoicesNeedingAction(application.invoices);
  const invoiceCount = application.invoices.length;
  const subStatus =
    isDraft
      ? "Continue when you are ready"
      : `${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}${
          invoicesNeedingAction > 0
            ? ` · ${invoicesNeedingAction} need${invoicesNeedingAction === 1 ? "s" : ""} action`
            : ""
        }`;

  const showViewSignedContract =
    application.signedContractOfferLetterAvailable &&
    !!application.signedContractOfferLetterS3Key &&
    hasContract &&
    onViewSignedContractOffer;

  const withdrawDisabled = !!isCancelApplicationPending || !!showViewSignedContract;

  let primary: React.ReactNode = (
    <Button size="sm" variant="outline" className="rounded-xl" asChild>
      <Link href={`/applications/${application.id}`}>View application</Link>
    </Button>
  );

  if (isDraft) {
    primary = (
      <Button size="sm" className="rounded-xl" asChild>
        <Link href={`/applications/${application.id}/edit`}>Continue editing</Link>
      </Button>
    );
  } else if (cardStatus.showReviewOffer) {
    primary = (
      <div className="flex flex-col items-end gap-1">
        <div className="rounded-xl bg-status-action-bg p-0.5">
          <Button size="sm" className="rounded-xl" asChild>
            <Link href={`/applications/${application.id}?tab=offer`}>Review offer</Link>
          </Button>
        </div>
        {application.expiresAt ? (
          <span className="text-xs text-muted-foreground">
            Offer valid until {format(new Date(application.expiresAt), "d MMM yyyy")}
          </span>
        ) : null}
      </div>
    );
  } else if (cardStatus.showMakeAmendments) {
    primary = (
      <div className="rounded-xl bg-status-action-bg p-0.5">
        <Button size="sm" className="rounded-xl" asChild>
          <Link href={`/applications/${application.id}/edit`}>Make amendments</Link>
        </Button>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm md:p-5",
        needsAttention
          ? ATTENTION_SURFACE[statusToken]
          : "border-border bg-card"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={statusLabel} status={statusToken} />
            <span className="text-[15px] font-semibold text-foreground">
              {displayId}
              {application.type !== "Generic" ? ` · ${application.type}` : ""}
            </span>
          </div>
          <p className="text-[15px] leading-6 text-foreground">
            {application.customer}
            {" · "}
            {headlineAmount(application)}
            {application.submittedAt
              ? ` · submitted ${format(new Date(application.submittedAt), "d MMM yyyy")}`
              : ""}
          </p>
          <p className="text-[13px] leading-5 text-muted-foreground">{subStatus}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {primary}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-xl"
                aria-label="More actions"
              >
                <EllipsisVerticalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {!isDraft ? (
                <DropdownMenuItem className="cursor-pointer" asChild>
                  <Link href={`/applications/${application.id}`}>View application</Link>
                </DropdownMenuItem>
              ) : null}
              {isDraft ? (
                <>
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link href={`/applications/${application.id}/edit`}>Continue editing</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={() => onDeleteDraft?.(application.id)}
                  >
                    Delete draft
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  {showViewSignedContract ? (
                    <>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => {
                          void onViewSignedContractOffer!(
                            application.signedContractOfferLetterS3Key!
                          );
                        }}
                      >
                        View signed offer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    disabled={withdrawDisabled}
                    onClick={() => {
                      if (!withdrawDisabled) onCancelApplication?.(application.id);
                    }}
                  >
                    {isCancelApplicationPending ? "Withdrawing…" : "Withdraw application"}
                  </DropdownMenuItem>
                  {showViewSignedContract ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Withdraw is not available while a signed offer letter is on file.
                    </p>
                  ) : null}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}
