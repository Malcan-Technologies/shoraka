"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { getReviewStatusPresentation } from "@/components/application-review/status-presentation";
import type { ReviewTabDescriptor } from "@/components/application-review/review-registry";

export type { ReviewTabDescriptor } from "@/components/application-review/review-registry";

function StatusDot({ status }: { status: string }) {
  const { dotClass } = getReviewStatusPresentation(status);
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", dotClass)}
      aria-hidden
    />
  );
}

export interface ApplicationReviewTabsProps {
  /** Backend review section statuses for status dots. Key: step-key based section IDs. */
  sections: { section: string; status: string }[];
  /** Tab descriptors from getReviewTabDescriptorsFromWorkflow (Financial + included steps). */
  tabDescriptors: ReviewTabDescriptor[];
  children: React.ReactNode;
  defaultTabId?: string;
}

export function ApplicationReviewTabs({
  sections,
  tabDescriptors,
  children,
  defaultTabId,
}: ApplicationReviewTabsProps) {
  const sectionMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) {
      m.set(s.section, s.status);
    }
    return m;
  }, [sections]);

  const defaultValue = defaultTabId ?? tabDescriptors[0]?.id ?? "financial";

  return (
    <Tabs defaultValue={defaultValue} className="w-full min-w-0">
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
        <TabsList className="flex h-auto min-h-11 w-max min-w-full flex-nowrap justify-center gap-2 bg-transparent p-0 text-muted-foreground">
          {tabDescriptors.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex shrink-0 items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-3 sm:px-4 text-sm"
            >
              <StatusDot status={sectionMap.get(tab.reviewSection) ?? "PENDING"} />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}

export function ApplicationReviewTabContent({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <TabsContent value={value} className="mt-8 focus-visible:outline-none focus-visible:ring-0">
      {children}
    </TabsContent>
  );
}
