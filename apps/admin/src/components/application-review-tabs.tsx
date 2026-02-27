"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import type { ReviewTabDescriptor } from "@/components/application-review/review-registry";

export type { ReviewTabDescriptor } from "@/components/application-review/review-registry";

function StatusDot({ status }: { status: string }) {
  const dotClass =
    status === "APPROVED"
      ? "bg-green-500"
      : status === "AMENDMENT_REQUESTED"
        ? "bg-yellow-500"
        : status === "REJECTED"
          ? "bg-destructive"
          : "bg-muted-foreground";
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
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="inline-flex h-11 w-full rounded-xl bg-muted p-1 gap-1">
        {tabDescriptors.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4"
          >
            <StatusDot status={sectionMap.get(tab.reviewSection) ?? "PENDING"} />
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
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
    <TabsContent value={value} className="mt-6 focus-visible:outline-none focus-visible:ring-0">
      {children}
    </TabsContent>
  );
}
