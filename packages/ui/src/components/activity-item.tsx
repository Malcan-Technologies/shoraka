import * as React from "react";
import { cn } from "../lib/utils";
import { Activity } from "@cashsouk/types";
import { ActivityBadge } from "./activity-badge";
import { format } from "date-fns";

interface ActivityItemProps extends React.HTMLAttributes<HTMLDivElement> {
  activity: Activity;
}

export function ActivityItem({ activity, className, ...props }: ActivityItemProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-8 py-4 hover:bg-muted/50 transition-colors px-2",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1 flex-1">
        <span className="font-semibold text-[15px]">{activity.title}</span>
        <span className="max-w-[70ch] text-sm leading-6 text-muted-foreground">
          {activity.description}
        </span>
      </div>

      <div className="grid min-w-[300px] grid-cols-[120px_160px] items-start gap-8">
        <div className="flex justify-start">
          <ActivityBadge domain={activity.domain} />
        </div>

        <div className="text-sm text-muted-foreground whitespace-nowrap text-right">
          {format(new Date(activity.created_at), "dd-MM-yyyy hh:mm aa")}
        </div>
      </div>
    </div>
  );
}
