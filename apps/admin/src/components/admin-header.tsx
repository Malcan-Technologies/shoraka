"use client";

import type { ReactNode } from "react";
import { useHeader } from "@cashsouk/ui";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface AdminHeaderProps {
  title?: string;
  rightContent?: ReactNode;
}

export function AdminHeader({ title: propsTitle, rightContent }: AdminHeaderProps) {
  const { title: contextTitle } = useHeader();
  const title = propsTitle !== undefined ? propsTitle : contextTitle;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-sm supports-[backdrop-filter]:bg-background/75">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {title ? <h1 className="truncate text-lg font-semibold">{title}</h1> : null}
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">{rightContent}</div>
    </header>
  );
}
