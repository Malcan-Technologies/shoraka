import * as React from "react";
import { StatusBadge } from "./status-badge";
import { getActivityDomainConfig, type ActivityDomain } from "@cashsouk/types";
import { cn } from "../lib/utils";

interface ActivityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  domain: ActivityDomain;
  label?: string;
}

/** Type chip for activity domain — identity only, no workflow colour. */
export function ActivityBadge({
  domain,
  label,
  className,
  ...props
}: ActivityBadgeProps) {
  const domainConfig = getActivityDomainConfig(domain);
  const finalLabel = label || domainConfig.label;

  return (
    <StatusBadge
      label={finalLabel}
      status="neutral"
      showDot={false}
      className={cn("text-meta", className)}
      {...props}
    />
  );
}
