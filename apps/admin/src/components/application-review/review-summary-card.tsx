"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { toTitleCase } from "@cashsouk/types";
import { getReviewTabLabel } from "./review-registry";
import { getReviewStatusPresentation } from "./status-presentation";

export interface ReviewSummaryCardProps {
  sections: { section: string; status: string }[];
}

export function ReviewSummaryCard({ sections }: ReviewSummaryCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-primary" />
          <CardTitle className="text-base font-semibold">Review Summary</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Section Status
          </h4>
          <div className="space-y-1.5">
            {sections.map((s) => (
              (() => {
                const presentation = getReviewStatusPresentation(s.status);
                const label =
                  s.status === "AMENDMENT_REQUESTED" ? "Amendment" : presentation.label;
                const displayText = toTitleCase(label) || label;
                return (
                  <div key={s.section} className="flex items-center justify-between text-sm">
                    <span>{getReviewTabLabel(s.section)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-6 px-2.5 text-[11px] font-semibold tracking-wide gap-1.5",
                        presentation.badgeClass
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "inline-block h-2 w-2 rounded-full shrink-0",
                          presentation.dotClass
                        )}
                      />
                      {displayText}
                    </Badge>
                  </div>
                );
              })()
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
