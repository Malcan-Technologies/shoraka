"use client";

/**
 * SECTION: Tab-level amendment remarks in resubmit comparison
 * WHY: Single "Remark" control; body matches issuer bullet format (no extra admin copy).
 * INPUT: review section (plus merged sections for Offer & acceptance), full amendment_remarks from API,
 *        optional additional remarks (Documents tab: item remarks no comparison row shows)
 * OUTPUT: Optional Remark button + popover or null
 * WHERE USED: ResubmitComparisonModal inside each ApplicationReviewTabContent
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { resubmitTabBarRemarks } from "@/lib/resubmit-comparison/tab-amendment-notes";
import type { ReviewSectionId } from "@/components/application-review/review-registry";
import { AmendmentRemarkReadbackPanel } from "@/components/amendment-remark-readback";

export function ResubmitTabAmendmentNotesBar({
  reviewSection,
  reviewSections,
  remarks,
  additionalRemarks,
}: {
  reviewSection: ReviewSectionId;
  /** Every section behind the tab (resubmitTabSections(descriptor)). When omitted, reviewSection alone. */
  reviewSections?: readonly ReviewSectionId[];
  remarks: Array<{ scope: string; scope_key: string; remark: string }> | undefined;
  /** Shown after the tab's own remarks (de-duplicated); e.g. document item remarks no row matched. */
  additionalRemarks?: ReadonlyArray<{ scope: string; scope_key: string; remark: string }>;
}) {
  const notes = React.useMemo(
    () => resubmitTabBarRemarks(reviewSection, reviewSections, remarks, additionalRemarks),
    [remarks, reviewSection, reviewSections, additionalRemarks]
  );

  const remarkTexts = React.useMemo(() => notes.map((n) => n.remark), [notes]);

  if (notes.length === 0) return null;

  return (
    <div className="mb-6 w-fit">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Remark
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(22rem,calc(100vw-2rem))] max-h-[min(26rem,75vh)] overflow-y-auto border-border p-3"
          align="start"
          side="bottom"
          sideOffset={8}
        >
          <AmendmentRemarkReadbackPanel remarkTexts={remarkTexts} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
