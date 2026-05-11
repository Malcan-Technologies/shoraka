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
  const title = propsTitle || contextTitle;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {rightContent ?? <NotificationBell />}
      </div>
    </header>
  );
}
