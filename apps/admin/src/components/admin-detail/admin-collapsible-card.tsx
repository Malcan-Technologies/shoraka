"use client";

import * as React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ADMIN_ACTION_SURFACE_CLASS, ADMIN_WAITING_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export type AdminCollapsibleCardProps = {
  title: string;
  /** One-line orientation copy shown next to the title. */
  description?: React.ReactNode;
  /** Non-interactive header chip (e.g. funding status). */
  status?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Admin must act: yellow wash and open by default. */
  needsAction?: boolean;
  /** Waiting on issuer/investor: blue wash. Ignored when `needsAction` is set. */
  waiting?: boolean;
  /** Overrides the `needsAction` open default. */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Card whose header toggles its body. Used for the Overview stack so secondary
 * detail collapses while anything the admin must act on stays open.
 */
export function AdminCollapsibleCard({
  title,
  description,
  status,
  icon: Icon,
  needsAction = false,
  waiting = false,
  defaultOpen,
  children,
  className,
  contentClassName,
}: AdminCollapsibleCardProps) {
  const [open, setOpen] = React.useState(defaultOpen ?? needsAction);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-2xl border bg-card",
        needsAction && ADMIN_ACTION_SURFACE_CLASS,
        !needsAction && waiting && ADMIN_WAITING_SURFACE_CLASS,
        className
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <span className="flex min-w-0 items-center gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                needsAction
                  ? "bg-status-action-bg text-status-action-text"
                  : waiting
                    ? "bg-status-submitted-bg text-status-submitted-text"
                    : "bg-primary/10 text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-card-title">{title}</span>
              {status}
            </span>
            {description ? (
              <span className="mt-0.5 block text-meta text-muted-foreground">{description}</span>
            ) : null}
          </span>
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("px-5 pb-5", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
