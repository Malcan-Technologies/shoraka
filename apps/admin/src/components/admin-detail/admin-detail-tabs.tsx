"use client";

import * as React from "react";
import { STATUS_BADGE_GROUPS } from "@cashsouk/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import type { StatusToken } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

/**
 * Same hues as application review tabs (`STATUS_BADGE_GROUPS.dotClass`).
 * Yellow uses a brighter amber fill so the 8px circle reads as action-yellow
 * instead of the brown badge-text token.
 */
const TAB_DOT_CLASS: Record<StatusToken, string> = {
  action: "bg-amber-400 dark:bg-amber-300",
  submitted: STATUS_BADGE_GROUPS.admin_action.dotClass,
  "in-progress": STATUS_BADGE_GROUPS.admin_action.dotClass,
  success: STATUS_BADGE_GROUPS.completed.dotClass,
  active: "bg-violet-500 dark:bg-violet-400",
  completed: STATUS_BADGE_GROUPS.completed.dotClass,
  rejected: STATUS_BADGE_GROUPS.expired_closed.dotClass,
  neutral: STATUS_BADGE_GROUPS.neutral.dotClass,
};

function StatusDot({ token }: { token: StatusToken }) {
  return (
    <span
      className={cn("inline-block h-2 w-2 shrink-0 rounded-full", TAB_DOT_CLASS[token])}
      aria-hidden
    />
  );
}

export type AdminDetailTab<TTabId extends string = string> = {
  id: TTabId;
  label: string;
  /** Workflow status colour for the tab dot. */
  statusToken?: StatusToken;
  /** Screen-reader text for the dot, e.g. "Needs action". */
  statusLabel?: string;
};

export type AdminDetailTabsProps<TTabId extends string> = {
  tabs: AdminDetailTab<TTabId>[];
  value: TTabId;
  onValueChange: (value: TTabId) => void;
  children: React.ReactNode;
  /** Keep the pill strip in view while a long panel scrolls. */
  sticky?: boolean;
  className?: string;
};

export function AdminDetailTabs<TTabId extends string>({
  tabs,
  value,
  onValueChange,
  children,
  sticky = true,
  className,
}: AdminDetailTabsProps<TTabId>) {
  return (
    <Tabs
      className={cn("w-full min-w-0", className)}
      value={value}
      onValueChange={(next) => onValueChange(next as TTabId)}
    >
      <div className={cn("bg-background", sticky && "sticky top-0 z-20 py-2")}>
        <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden rounded-xl bg-muted p-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/30">
          <TabsList className="flex h-auto min-h-11 w-max min-w-full flex-nowrap justify-center gap-2 bg-transparent p-0 text-muted-foreground">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 text-ui data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-4"
              >
                {tab.statusToken ? <StatusDot token={tab.statusToken} /> : null}
                <span className="truncate">{tab.label}</span>
                {tab.statusLabel ? (
                  <span className="sr-only">Status: {tab.statusLabel}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>
      {children}
    </Tabs>
  );
}

export function AdminDetailTabPanel({
  value,
  children,
  className,
  preserveMount = false,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Keep inactive panels mounted (and CSS-hidden) so local form state survives
   * tab switches. Radix otherwise unmounts `TabsContent` when it is inactive.
   */
  preserveMount?: boolean;
}) {
  return (
    <TabsContent
      value={value}
      forceMount={preserveMount ? true : undefined}
      className={cn(
        "mt-4 space-y-6 focus-visible:outline-none focus-visible:ring-0",
        preserveMount && "data-[state=inactive]:hidden",
        className
      )}
    >
      {children}
    </TabsContent>
  );
}
