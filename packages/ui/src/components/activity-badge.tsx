import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { ActivityCategory, getEventConfig } from "@cashsouk/types";
import { Badge } from "./badge";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ActivityBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  category?: ActivityCategory;
  eventType?: string;
  label?: string;
  dotColor?: string;
}

// Map Tailwind color class to CSS color for background using color-mix
const COLOR_MAP: Record<string, string> = {
  "bg-rose-500": "rgb(244 63 94)",
  "bg-emerald-500": "rgb(16 185 129)",
  "bg-violet-500": "rgb(139 92 246)",
  "bg-blue-500": "rgb(59 130 246)",
  "bg-gray-500": "rgb(107 114 128)",
  "bg-gray-400": "rgb(156 163 175)",
  "bg-yellow-500": "rgb(234 179 8)",
  "bg-teal-500": "rgb(20 184 166)",
  "bg-red-600": "rgb(220 38 38)",
  "bg-red-500": "rgb(239 68 68)",
  "bg-orange-500": "rgb(249 115 22)",
  "bg-orange-400": "rgb(251 146 60)",
  "bg-cyan-500": "rgb(6 182 212)",
  "bg-lime-500": "rgb(132 204 22)",
  "bg-indigo-500": "rgb(99 102 241)",
  "bg-blue-400": "rgb(96 165 250)",
  "bg-sky-500": "rgb(14 165 233)",
  "bg-green-500": "rgb(34 197 94)",
  "bg-green-400": "rgb(74 222 128)",
  "bg-purple-500": "rgb(168 85 247)",
};

export function ActivityBadge({ category, eventType, label, dotColor, className, variant, ...props }: ActivityBadgeProps) {
  // If we have an event type, get its config
  const eventConfig = eventType ? getEventConfig(eventType) : null;

  const finalLabel = label || eventConfig?.label || category || "Unknown";
  const finalDotColor = dotColor || eventConfig?.dotColor || "bg-gray-500";
  const cssColor = COLOR_MAP[finalDotColor] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className={cn("text-xs w-fit whitespace-nowrap", className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor} 30%, transparent)`,
      }}
      {...props}
    >
      <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", finalDotColor)} />
      {finalLabel}
    </Badge>
  );
}
