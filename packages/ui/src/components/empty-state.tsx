import * as React from "react";
import {
  InboxIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { cn } from "../lib/utils";

export type EmptyStateVariant = "no-data" | "no-results";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

const DEFAULTS: Record<
  EmptyStateVariant,
  { title: string; message: string; Icon: typeof InboxIcon }
> = {
  "no-data": {
    title: "Nothing here yet",
    message: "When you add something, it will show up here.",
    Icon: InboxIcon,
  },
  "no-results": {
    title: "No matches",
    message: "Try clearing filters or adjusting your search.",
    Icon: MagnifyingGlassIcon,
  },
};

export function EmptyState({
  variant = "no-data",
  icon,
  title,
  message,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const defaults = DEFAULTS[variant];
  const Icon = defaults.Icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Icon className="h-6 w-6" aria-hidden />}
      </div>
      <div className="max-w-[40ch] space-y-1">
        <p className="text-base font-semibold text-foreground">
          {title ?? defaults.title}
        </p>
        <p className="text-[17px] leading-7 text-muted-foreground">
          {message ?? defaults.message}
        </p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
