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
  onApprove?: (section: ReviewSectionId) => void;
  onReject?: (section: ReviewSectionId) => void;
  onRequestAmendment?: (section: ReviewSectionId) => void;
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
  onApprove,
  onReject,
  onRequestAmendment,
  children,
}: ReviewSectionCardProps) {
  const showActions =
    section != null &&
    isReviewable === true &&
    onApprove &&
    onReject &&
    onRequestAmendment;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          {showActions && (
            <SectionActionDropdown
              section={section}
              isReviewable={isReviewable!}
              onApprove={onApprove}
              onReject={onReject}
              onRequestAmendment={onRequestAmendment}
              isPending={!!approvePending}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}
