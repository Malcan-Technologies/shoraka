import type { ComponentType, ReactNode } from "react";
import { CardHeader, CardTitle } from "@/components/ui/card";

export type AdminDetailCardHeaderProps = {
  title: string;
  description?: ReactNode;
  icon: ComponentType<{ className?: string }>;
  className?: string;
  actions?: ReactNode;
};

/**
 * In-card title row shared by notes and contracts detail: icon well, CardTitle,
 * optional one-line description, optional right-side actions.
 */
export function AdminDetailCardHeader({
  title,
  description,
  icon: Icon,
  className,
  actions,
}: AdminDetailCardHeaderProps) {
  return (
    <CardHeader className={className}>
      <div className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <p className="mt-0.5 text-meta text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions}
      </div>
    </CardHeader>
  );
}
