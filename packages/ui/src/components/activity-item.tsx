import Link from "next/link";
import { format } from "date-fns";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";
import {
  getActivityHref,
  getActivityStatusLabel,
  getActivityStatusToken,
  type Activity,
  type ActivityPortal,
} from "@cashsouk/types";
import { StatusBadge } from "./status-badge";

interface ActivityItemProps {
  activity: Activity;
  portal: ActivityPortal;
  compact?: boolean;
  className?: string;
}

export function ActivityItem({
  activity,
  portal,
  compact = false,
  className,
}: ActivityItemProps) {
  const href = getActivityHref(activity, portal);
  const status = getActivityStatusToken(activity.event_type);
  const statusLabel = getActivityStatusLabel(activity.event_type);
  const timestamp = format(new Date(activity.created_at), "dd-MM-yyyy hh:mm aa");

  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-ui font-semibold text-foreground">{activity.title}</span>
        <span
          className={cn(
            "text-ui leading-6 text-muted-foreground",
            compact ? "line-clamp-2" : "max-w-[70ch]"
          )}
        >
          {activity.description}
        </span>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center",
          compact
            ? "gap-3"
            : "w-full justify-between gap-6 sm:w-[20rem] sm:grid sm:grid-cols-[8.5rem_10rem] sm:justify-start"
        )}
      >
        <StatusBadge label={statusLabel} status={status} className="shrink-0" />
        <time
          dateTime={activity.created_at}
          className={cn(
            "whitespace-nowrap text-ui text-muted-foreground",
            !compact && "sm:text-right"
          )}
        >
          {timestamp}
        </time>
        {compact && href ? (
          <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </div>
    </>
  );

  const rowClass = cn(
    "flex flex-col gap-3 py-4 transition-colors sm:flex-row sm:items-start sm:justify-between sm:gap-8",
    href && "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  if (href) {
    return (
      <Link href={href} className={rowClass} aria-label={`${activity.title}. ${statusLabel}`}>
        {body}
      </Link>
    );
  }

  return <div className={rowClass}>{body}</div>;
}
