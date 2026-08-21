"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface AdminHeaderProps {
  rightContent?: ReactNode;
}

/** Top chrome: sidebar toggle and utilities. Page titles live in the page body. */
export function AdminHeader({ rightContent }: AdminHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/75">
      <div className="flex min-w-0 items-center">
        <SidebarTrigger className="-ml-1" />
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">{rightContent}</div>
    </header>
  );
}
