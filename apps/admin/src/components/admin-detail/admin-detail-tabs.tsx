"use client";

import * as React from "react";
import {
  STATUS_TOKEN_BG_CLASS,
  STATUS_TOKEN_DOT_CLASS,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cashsouk/ui";
import type { StatusToken } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

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
          <TabsList className="flex h-auto min-h-10 w-max min-w-full flex-nowrap items-center justify-start gap-1 bg-transparent p-0 text-muted-foreground">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex shrink-0 items-center gap-2 rounded-lg px-3 text-ui data-[state=active]:bg-background data-[state=active]:shadow-sm sm:px-4"
              >
                {tab.statusToken ? (
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                      STATUS_TOKEN_BG_CLASS[tab.statusToken]
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        STATUS_TOKEN_DOT_CLASS[tab.statusToken]
                      )}
                    />
                  </span>
                ) : null}
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
