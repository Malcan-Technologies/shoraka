"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowPathIcon, DocumentTextIcon, PencilSquareIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { formatApplicationReference } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AdminEntityHeader,
  AdminEntitySummaryCard,
} from "@/components/admin-detail";
import { ApplicationStatusBadge } from "@/components/application-review";
import { CopyableText } from "@/organizations/components/organization-profile-helpers";
import { ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL, ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT } from "@/lib/admin-director-shareholder-review-message";
import { getAdminStatusToken } from "@/lib/admin-status-token";

export function ApplicationDetailHero({
  productKey,
  title,
  applicationId,
  displayReference,
  productName,
  status,
  structureLabel,
  directorPending,
  requestedAmount,
  ownerName,
  email,
  paymaster,
  productVersion,
  submittedAt,
  updatedAt,
  isReviewable,
  canAppManage,
  pendingAmendmentCount,
  allSectionsApproved,
  hasRejectedSection,
  actionPending,
  onResetToUnderReview,
  onRequestAmendment,
  onRejectApplication,
  rejectBlockedByPhase,
  statusLabel,
}: {
  productKey: string;
  title: string;
  applicationId: string;
  displayReference?: string | null;
  productName?: string;
  status: string;
  structureLabel: string;
  directorPending: boolean;
  requestedAmount: number;
  ownerName: string;
  email: string;
  paymaster: string;
  productVersion: string;
  submittedAt: string | null;
  updatedAt: string;
  isReviewable: boolean;
  canAppManage: boolean;
  pendingAmendmentCount: number;
  allSectionsApproved: boolean;
  hasRejectedSection: boolean;
  actionPending: boolean;
  onResetToUnderReview: () => void;
  onRequestAmendment: () => void;
  onRejectApplication: () => void;
  rejectBlockedByPhase: boolean;
  statusLabel?: string;
}) {
  const isAmendmentRequested = status === "AMENDMENT_REQUESTED";
  const amendmentDisabled =
    isAmendmentRequested || pendingAmendmentCount === 0 || !canAppManage;
  const rejectDisabled =
    status === "REJECTED" ||
    allSectionsApproved ||
    !hasRejectedSection ||
    !canAppManage ||
    rejectBlockedByPhase;
  const reference = formatApplicationReference({
    displayReference: displayReference ?? null,
    id: applicationId,
  });
  const subtitle = productName ? `${reference} · ${productName}` : reference;

  const amendmentTooltip = isAmendmentRequested
    ? "Amendment already requested; issuer must respond first"
    : pendingAmendmentCount === 0
      ? "Request amendment on at least one section first"
      : "Review and send amendment request to issuer";
  const rejectTooltip =
    status === "REJECTED"
      ? "Application already rejected"
      : rejectBlockedByPhase
        ? "Cannot reject after a facility or invoice has been approved"
        : allSectionsApproved
          ? "Cannot reject when all sections are approved"
          : !hasRejectedSection
            ? "Reject at least one section first"
            : "Reject the application and notify the issuer";

  return (
    <AdminEntityHeader
      variant="hero"
      tone={getAdminStatusToken(status)}
      backHref={`/applications/${productKey}`}
      backLabel="Applications"
      eyebrow="Application detail"
      title={title}
      subtitle={subtitle}
      icon={DocumentTextIcon}
      chips={
        <>
          <ApplicationStatusBadge status={status} label={statusLabel} />
          {structureLabel !== "—" ? (
            <StatusBadge label={structureLabel} status="neutral" showDot={false} />
          ) : null}
          {directorPending ? (
            <StatusBadge
              label={ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL}
              status="action"
              title={ADMIN_DIRECTOR_SHAREHOLDER_REVIEW_HINT}
            />
          ) : null}
        </>
      }
      summaryCards={[
        <AdminEntitySummaryCard
          key="requested-facility"
          label="Requested facility"
          value={formatCurrency(Math.ceil(requestedAmount), { decimals: 0 })}
        />,
      ]}
      actions={
        isReviewable ? (
          <TooltipProvider>
            {isAmendmentRequested ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={!canAppManage || actionPending}
                      title={
                        !canAppManage
                          ? "You do not have permission to perform this action."
                          : undefined
                      }
                      onClick={onResetToUnderReview}
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      Reset to Under Review
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                  Clear application status so it can be reviewed again
                </TooltipContent>
              </Tooltip>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={amendmentDisabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={amendmentDisabled}
                    title={
                      !canAppManage
                        ? "You do not have permission to perform this action."
                        : undefined
                    }
                    onClick={onRequestAmendment}
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    Request Amendment
                    {pendingAmendmentCount > 0 ? (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                        {pendingAmendmentCount}
                      </Badge>
                    ) : null}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                {amendmentTooltip}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={rejectDisabled ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                  <Button
                    variant="destructive"
                    className="gap-2"
                    disabled={rejectDisabled}
                    title={
                      !canAppManage
                        ? "You do not have permission to perform this action."
                        : undefined
                    }
                    onClick={onRejectApplication}
                  >
                    <XCircleIcon className="h-4 w-4" />
                    Reject
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
                {rejectTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : undefined
      }
      metrics={[
        { label: "Owner", value: ownerName },
        {
          label: "Email",
          value: email.trim() ? <CopyableText value={email.trim()} label="Email" truncate /> : "—",
        },
        { label: "Paymaster", value: paymaster },
        { label: "Product version", value: productVersion },
        {
          label: "Submitted",
          value: submittedAt ? format(new Date(submittedAt), "dd MMM yyyy, p") : "Not submitted",
        },
        { label: "Updated", value: format(new Date(updatedAt), "dd MMM yyyy, p") },
      ]}
    />
  );
}
