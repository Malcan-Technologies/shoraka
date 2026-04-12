"use client";

/**
 * SECTION: Tab-level amendment remarks in resubmit comparison
 * WHY: Single "Remark" control; body matches issuer bullet format (no extra admin copy).
 * INPUT: review section, full amendment_remarks from API
 * OUTPUT: Optional Remark button + popover or null
 * WHERE USED: ResubmitComparisonModal inside each ApplicationReviewTabContent
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { amendmentRemarksForReviewTab } from "@/lib/resubmit-amendment-remarks-for-tab";
import type { ReviewSectionId } from "@/components/application-review/review-registry";
import { AmendmentRemarkReadbackPanel } from "@/components/amendment-remark-readback";

export function ResubmitTabAmendmentNotesBar({
  reviewSection,
  remarks,
}: {
  reviewSection: ReviewSectionId;
  remarks: Array<{ scope: string; scope_key: string; remark: string }> | undefined;
}) {
  const notes = React.useMemo(() => {
    if (!remarks?.length) return [];
    const forTab = amendmentRemarksForReviewTab(reviewSection, remarks);
    const withoutPerDocSlots = forTab.filter(
      (r) => !(r.scope === "item" && r.scope_key.startsWith("supporting_documents:"))
    );
    if (reviewSection === "supporting_documents") {
      return withoutPerDocSlots.filter(
        (r) => r.scope === "section" && r.scope_key === "supporting_documents"
      );
    }
    return withoutPerDocSlots;
  }, [remarks, reviewSection]);

  const remarkTexts = React.useMemo(() => notes.map((n) => n.remark), [notes]);

  if (notes.length === 0) return null;

  return (
    <div className="mb-6 w-fit">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="text-[13px]">
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
