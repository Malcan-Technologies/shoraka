"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reviewCardTitleClass } from "./review-section-styles";
import { SectionActionDropdown } from "./section-action-dropdown";
import type { ReviewSectionId } from "./section-types";
import type { ComponentType, ReactNode } from "react";

export interface ReviewSectionCardProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  section?: ReviewSectionId;
  isReviewable?: boolean;
  approvePending?: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  /** Optional node rendered in the header right area, next to the Action dropdown. */
  headerRight?: ReactNode;
  onResetToPending?: (section: ReviewSectionId) => void;
  onApprove?: (section: ReviewSectionId) => void;
  onReject?: (section: ReviewSectionId) => void;
  onRequestAmendment?: (section: ReviewSectionId) => void;
  /** When true, hides Approve/Reject/Amendment dropdown (used for offer-driven sections). */
  hideSectionActions?: boolean;
  showApprove?: boolean;
  approveDisabled?: boolean;
  approveDisabledReason?: string;
  viewSignedOfferOnly?: boolean;
  onViewSignedOffer?: () => void | Promise<void>;
  /** When true, "View Signed Offer" appears in the Action menu (signed PDF on file). */
  signedOfferLetterAvailable?: boolean;
  children: React.ReactNode;
}

/**
 * Shared card shell for review sections: rounded card, header with icon + title,
 * optional SectionActionDropdown, and CardContent with standard spacing.
 */
export function ReviewSectionCard({
  title,
  icon: Icon,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  headerRight,
  onResetToPending,
  onApprove,
  onReject,
  onRequestAmendment,
  hideSectionActions = false,
  showApprove = true,
  approveDisabled = false,
  approveDisabledReason,
  viewSignedOfferOnly = false,
  onViewSignedOffer,
  signedOfferLetterAvailable = false,
  children,
}: ReviewSectionCardProps) {
  const showActions =
    !hideSectionActions &&
    section != null &&
    isReviewable === true &&
    onApprove &&
    onReject &&
    onRequestAmendment;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className={reviewCardTitleClass}>{title}</CardTitle>
          </div>
          <div className="flex items-start gap-3 shrink-0">
            {headerRight ? <div>{headerRight}</div> : null}
            {showActions ? (
              <>
                {headerRight ? <div className="h-9 w-px bg-border/60 self-stretch" /> : null}
                <SectionActionDropdown
                  section={section}
                  isReviewable={isReviewable!}
                  onApprove={onApprove}
                  onReject={onReject}
                  onRequestAmendment={onRequestAmendment}
                  isPending={!!approvePending}
                  isActionLocked={isActionLocked}
                  actionLockTooltip={actionLockTooltip}
                  sectionStatus={sectionStatus}
                  onResetToPending={onResetToPending}
                  showApprove={showApprove}
                  approveDisabled={approveDisabled}
                  approveDisabledReason={approveDisabledReason}
                  viewSignedOfferOnly={viewSignedOfferOnly}
                  onViewSignedOffer={onViewSignedOffer}
                  signedOfferLetterAvailable={signedOfferLetterAvailable}
                />
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-10">{children}</CardContent>
    </Card>
  );
}
