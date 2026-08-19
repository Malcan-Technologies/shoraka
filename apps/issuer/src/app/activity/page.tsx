"use client";

import { IssuerActivityList } from "@/components/activity/issuer-activity-list";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { PageShell } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

export default function ActivityPage() {
  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <PageShell
        title="Activity"
        description="Milestones across your applications and financing."
      >
        <IssuerActivityList />
      </PageShell>
    </div>
  );
}
