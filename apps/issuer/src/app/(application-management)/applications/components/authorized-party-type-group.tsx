"use client";

import type { ReactNode } from "react";

type AuthorizedPartyTypeGroupProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthorizedPartyTypeGroup({
  title,
  description,
  children,
}: AuthorizedPartyTypeGroupProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="text-card-title text-foreground">{title}</p>
        <p className="mt-1 text-meta text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
