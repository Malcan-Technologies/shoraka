"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionActionDropdown } from "./section-action-dropdown";
import type { ReviewSectionId } from "./section-types";
import type { ComponentType } from "react";

export interface ReviewSectionCardProps {
  title: string;
  icon: ComponentType<{ className?: string }>;
  section?: ReviewSectionId;
  isReviewable?: boolean;
  approvePending?: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetToPending?: (section: ReviewSectionId) => void;
  onApprove?: (section: ReviewSectionId) => void;
  onReject?: (section: ReviewSectionId) => void;
  onRequestAmendment?: (section: ReviewSectionId) => void;
  /** When true, hides Approve/Reject/Amendment dropdown (used for offer-driven sections). */
  hideSectionActions?: boolean;
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
  onResetToPending,
  onApprove,
  onReject,
  onRequestAmendment,
  hideSectionActions = false,
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
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showActions ? (
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
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}
