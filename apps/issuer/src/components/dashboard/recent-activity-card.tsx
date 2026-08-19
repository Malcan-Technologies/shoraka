"use client";

import { getDefaultActivityDomains } from "@cashsouk/types";
import { useOrganization } from "@cashsouk/config";
import { ActivityItem, Card } from "@cashsouk/ui";
import { useActivities } from "@/hooks/use-activities";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

export function RecentActivityCard() {
  const { activeOrganization } = useOrganization();
  const onboardingComplete = activeOrganization?.onboardingStatus === "COMPLETED";
  const defaultDomains = getDefaultActivityDomains("issuer", { onboardingComplete });

  const { data, isLoading } = useActivities({
    page: 1,
    limit: PREVIEW_LIMIT,
    domains: defaultDomains.length > 0 ? defaultDomains : undefined,
  });

  const activities = data?.activities ?? [];

  return (
    <Card className={cn("flex h-full flex-col")}>
      <RecentSectionHeader title="Latest activity" viewAllHref="/activity" />
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-body leading-7 text-muted-foreground">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="py-4 text-body leading-7 text-muted-foreground">
            Milestones from your applications and financing will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {activities.map((activity) => (
              <li key={activity.id}>
                <ActivityItem
                  activity={activity}
                  portal="issuer"
                  compact
                  className="px-4 py-3"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
