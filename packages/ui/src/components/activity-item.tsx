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
        "flex items-center justify-between py-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors px-2",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-1 flex-1">
        <span className="font-semibold text-[15px]">{activity.activity}</span>
      </div>

      <div className="flex items-center gap-12 w-full max-w-[400px]">
        <div className="flex-1 flex justify-start min-w-[120px]">
          <ActivityBadge 
            category={activity.category} 
            eventType={activity.event_type}
          />
        </div>

        <div className="text-sm text-muted-foreground whitespace-nowrap min-w-[160px] text-right">
          {format(new Date(activity.created_at), "dd-MM-yyyy hh:mm aa")}
        </div>
      </div>
    </div>
  );
}
