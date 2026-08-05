"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "./sidebar";
import { Separator } from "./separator";
import { NotificationBell } from "./notification-bell";
import { useHeader } from "./header-provider";

interface HeaderProps {
  title?: string;
  rightContent?: ReactNode;
}

export function Header({ title: propsTitle, rightContent }: HeaderProps) {
  const { title: contextTitle } = useHeader();
  // Explicit empty string suppresses the title (page body owns it via PageShell).
  const title = propsTitle !== undefined ? propsTitle : contextTitle;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/75">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {title ? <h1 className="truncate text-lg font-semibold">{title}</h1> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        {rightContent ?? <NotificationBell />}
      </div>
    </header>
  );
}
