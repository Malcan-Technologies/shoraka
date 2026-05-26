import * as React from "react";
import { cn } from "../lib/utils";
import { ActivityDomain, getActivityDomainConfig } from "@cashsouk/types";
import { Badge } from "./badge";

const ACTIVITY_DOMAIN_BADGE_CLASS: Record<ActivityDomain, string> = {
  onboarding:
    "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
  application:
    "border-transparent bg-status-in-progress-bg text-status-in-progress-text dark:bg-indigo-950/40 dark:text-indigo-300",
  note:
    "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
};

interface ActivityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  domain: ActivityDomain;
  label?: string;
}

export function ActivityBadge({
  domain,
  label,
  className,
  ...props
}: ActivityBadgeProps) {
  const domainConfig = getActivityDomainConfig(domain);
  const finalLabel = label || domainConfig.label;

  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit whitespace-nowrap text-xs",
        ACTIVITY_DOMAIN_BADGE_CLASS[domain],
        className
      )}
      {...props}
    >
      {finalLabel}
    </Badge>
  );
}
