"use client";

import * as React from "react";
import { StatusBadge } from "@cashsouk/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { toTitleCase } from "@cashsouk/types";
import { getAdminStatusToken } from "@/lib/admin-status-token";
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
                    <StatusBadge
                      label={displayText}
                      status={getAdminStatusToken(s.status)}
                    />
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
