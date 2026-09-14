import type { ReactNode } from "react";

export function DashboardSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-section-title text-primary">{title}</h2>
        <p className="mt-1 text-ui text-muted-foreground">{subtitle}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
