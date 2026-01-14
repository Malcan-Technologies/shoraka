import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { ActivityCategory } from "@cashsouk/types";
import { Badge } from "./badge";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent",
  {
    variants: {
      variant: {
        security: "bg-[#E8F0FE] text-[#1967D2]",
        onboarding: "bg-[#E6F4EA] text-[#1E8E3E]",
        document: "bg-[#F3E8FF] text-[#7E22CE]",
        success: "bg-green-500/10 text-green-700 border-green-500/30",
        warning: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
        destructive: "bg-red-500/10 text-red-700 border-red-500/30",
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
  label?: string;
  dotColor?: string;
}

const CATEGORY_CONFIG: Record<ActivityCategory, { label: string; color: string; variant: VariantProps<typeof badgeVariants>["variant"] }> = {
  security: { label: "Security", color: "bg-rose-500", variant: "security" },
  onboarding: { label: "Onboarding", color: "bg-emerald-500", variant: "onboarding" },
  document: { label: "Document", color: "bg-violet-500", variant: "document" },
};

// Map Tailwind color class to CSS color for background using color-mix
const COLOR_MAP: Record<string, string> = {
  "bg-rose-500": "rgb(244 63 94)",
  "bg-emerald-500": "rgb(16 185 129)",
  "bg-violet-500": "rgb(139 92 246)",
  "bg-blue-500": "rgb(59 130 246)",
  "bg-gray-500": "rgb(107 114 128)",
};

export function ActivityBadge({ category, label, dotColor, className, variant, ...props }: ActivityBadgeProps) {
  const config = category ? CATEGORY_CONFIG[category] : null;

  const finalLabel = label || config?.label || category || "Unknown";
  const finalDotColor = dotColor || config?.color || "bg-gray-500";
  const cssColor = COLOR_MAP[finalDotColor] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className={cn("text-xs w-fit whitespace-nowrap px-2 py-0.5", className)}
      style={{
        backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor} 20%, transparent)`,
        color: cssColor,
      }}
      {...props}
    >
      <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", finalDotColor)} />
      {finalLabel}
    </Badge>
  );
}
