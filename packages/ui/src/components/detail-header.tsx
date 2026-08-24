import * as React from "react";
import { cn } from "../lib/utils";

export type DetailHeaderContextRow = {
  label: string;
  value: string;
};

export interface DetailHeaderProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumb?: React.ReactNode;
  title: string;
  status?: React.ReactNode;
  facts?: React.ReactNode;
  /** Labeled prose under identity (e.g. purpose of contract / invoice). */
  contextRows?: DetailHeaderContextRow[];
  actions?: React.ReactNode;
}

function DetailHeaderContextRows({ rows }: { rows: DetailHeaderContextRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-2 pt-1">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-meta text-muted-foreground">{row.label}</dt>
          <dd className="line-clamp-3 break-words text-ui text-foreground" title={row.value}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailHeader({
  breadcrumb,
  title,
  status,
  facts,
  contextRows,
  actions,
  className,
  ...props
}: DetailHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 flex-col gap-4 border-b border-border pb-6",
        className
      )}
      {...props}
    >
      {breadcrumb ? (
        <div className="text-ui text-muted-foreground">{breadcrumb}</div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-page-title">
              {title}
            </h1>
            {status}
          </div>
          {facts ? (
            <div className="text-ui text-muted-foreground">
              {facts}
            </div>
          ) : null}
          {contextRows && contextRows.length > 0 ? (
            <DetailHeaderContextRows rows={contextRows} />
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
