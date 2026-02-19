"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "FINANCIAL", label: "Financial" },
  { id: "JUSTIFICATION", label: "Justification" },
  { id: "DOCUMENTS", label: "Document" },
] as const;

export type ReviewSectionId = (typeof SECTIONS)[number]["id"];

function StatusDot({ status }: { status: string }) {
  const isApproved = status === "APPROVED";
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        isApproved ? "bg-primary" : "bg-destructive"
      )}
      aria-hidden
    />
  );
}

interface ApplicationReviewTabsProps {
  sections: { section: string; status: string }[];
  children: React.ReactNode;
  defaultSection?: ReviewSectionId;
}

export function ApplicationReviewTabs({
  sections,
  children,
  defaultSection = "FINANCIAL",
}: ApplicationReviewTabsProps) {
  const sectionMap = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) {
      m.set(s.section, s.status);
    }
    return m;
  }, [sections]);

  return (
    <Tabs defaultValue={defaultSection} className="w-full">
      <TabsList className="inline-flex h-11 w-full rounded-xl bg-muted p-1 gap-1">
        {SECTIONS.map(({ id, label }) => (
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
    <TabsContent value={value} className="mt-6 focus-visible:outline-none">
      {children}
    </TabsContent>
  );
}
