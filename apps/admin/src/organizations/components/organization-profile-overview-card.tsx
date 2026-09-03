"use client";

import {
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import {
  groupInvestorMissingByProfileSection,
  groupIssuerMissingByProfileSection,
  type ComrepProfileCompleteness,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ProfileCompletenessSummary } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { countProfileExternalReview } from "@/organizations/utils/organization-profile-overview";

export function OrganizationProfileOverviewCard({
  completeness,
  parties,
  portal,
  organizationType,
  onCompleteProfile,
  onReviewChanges,
  onSectionClick,
}: {
  completeness: ComrepProfileCompleteness | null | undefined;
  parties: OrganizationPartyProfileDto[] | null | undefined;
  portal: "issuer" | "investor";
  organizationType: "PERSONAL" | "COMPANY";
  onCompleteProfile?: () => void;
  onReviewChanges?: () => void;
  onSectionClick?: (href: string) => void;
}) {
  const percent = completeness?.percent ?? 0;
  const missingCount = completeness?.missing.length ?? 0;
  const complete = completeness?.complete ?? false;
  const review = countProfileExternalReview(parties);
  const needsAttention = !complete || review.total > 0;
  const sections =
    portal === "issuer"
      ? groupIssuerMissingByProfileSection(completeness?.missing ?? [])
      : groupInvestorMissingByProfileSection(completeness?.missing ?? [], organizationType);

  return (
    <Card className={cn("rounded-2xl", needsAttention && ADMIN_ACTION_SURFACE_CLASS)}>
      <AdminDetailCardHeader
        icon={ClipboardDocumentCheckIcon}
        title="Profile completeness"
        description="CashSouk master record for this organization"
      />
      <CardContent className="space-y-4">
        <ProfileCompletenessSummary
          percent={percent}
          remaining={missingCount}
          sections={sections}
          showCompleteSections={!complete}
          onSectionClick={(section) => {
            if (section.href) onSectionClick?.(section.href);
          }}
        />
        <div className="space-y-1">
          <p className="text-meta text-muted-foreground">External review</p>
          {review.total === 0 ? (
            <div className="flex items-center gap-2 text-ui text-muted-foreground">
              <CheckCircleIcon className="h-4 w-4" />
              No CTOS differences
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-body font-semibold">
                {review.total} {review.total === 1 ? "change needs" : "changes need"} attention
              </p>
              <p className="text-meta text-muted-foreground">
                {[
                  review.mismatchCount
                    ? `${review.mismatchCount} CTOS ${review.mismatchCount === 1 ? "difference" : "differences"}`
                    : null,
                  review.newPartyCount
                    ? `${review.newPartyCount} new ${review.newPartyCount === 1 ? "external party" : "external parties"}`
                    : null,
                  review.absentCount
                    ? `${review.absentCount} ${review.absentCount === 1 ? "person" : "people"} missing from latest CTOS`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          )}
        </div>
        {needsAttention ? (
          <div className="flex flex-wrap gap-2">
            {!complete && onCompleteProfile ? (
              <Button type="button" className="h-10" onClick={onCompleteProfile}>
                Complete missing information
              </Button>
            ) : null}
            {review.total > 0 && onReviewChanges ? (
              <Button type="button" variant="outline" className="h-10 gap-1.5" onClick={onReviewChanges}>
                <ExclamationTriangleIcon className="h-4 w-4" />
                Review external changes
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
