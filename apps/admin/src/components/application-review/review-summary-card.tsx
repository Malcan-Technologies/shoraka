"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { getReviewTabLabel } from "./review-registry";

export interface ReviewSummaryCardProps {
  sections: { section: string; status: string }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
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
              <div key={s.section} className="flex items-center justify-between text-sm">
                <span>{getReviewTabLabel(s.section)}</span>
                <Badge
                  variant="secondary"
                  className={
                    s.status === "APPROVED"
                      ? "bg-primary/10 text-primary"
                      : s.status === "REJECTED" || s.status === "AMENDMENT_REQUESTED"
                        ? "bg-destructive/10 text-destructive"
                        : ""
                  }
                >
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
