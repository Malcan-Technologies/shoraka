"use client";

import { IssuerActivityList } from "@/components/activity/issuer-activity-list";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

/**
 * Legacy activity page — permanently redirected to /?tab=activity.
 * Kept so the route module remains valid if the redirect is bypassed in tests.
 */
export default function ActivityPage() {
  return (
    <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
      <IssuerActivityList />
    </div>
  );
}
