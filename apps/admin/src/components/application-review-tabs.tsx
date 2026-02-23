"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { getSectionsInOrder } from "@/components/application-review/section-registry";
import type { ReviewSectionId } from "@/components/application-review/section-types";

export type { ReviewSectionId } from "@/components/application-review/section-types";

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
  sections: { section: string; status: string }[];
  children: React.ReactNode;
  defaultSection?: ReviewSectionId;
  /** Optional: only show these section ids. If omitted, uses all from registry. */
  visibleSectionIds?: ReviewSectionId[];
}

export function ApplicationReviewTabs({
  sections,
  children,
  defaultSection = "FINANCIAL",
  visibleSectionIds,
}: ApplicationReviewTabsProps) {
  const sectionMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) {
      m.set(s.section, s.status);
    }
    return m;
  }, [sections]);

  const tabSections = React.useMemo(
    () => getSectionsInOrder(visibleSectionIds),
    [visibleSectionIds]
  );

  return (
    <Tabs defaultValue={defaultSection} className="w-full">
      <TabsList className="inline-flex h-11 w-full rounded-xl bg-muted p-1 gap-1">
        {tabSections.map(({ id, label }) => (
          <TabsTrigger
            key={id}
            value={id}
            className="flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4"
          >
            <StatusDot status={sectionMap.get(id) ?? "PENDING"} />
            {label}
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
  value: ReviewSectionId;
  children: React.ReactNode;
}) {
  return (
    <TabsContent value={value} className="mt-6 focus-visible:outline-none focus-visible:ring-0">
      {children}
    </TabsContent>
  );
}
