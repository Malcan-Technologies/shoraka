"use client";

import type { ReactNode } from "react";
import { DocumentTextIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../components/card";
import { Checkbox } from "../components/checkbox";
import { Label } from "../components/label";
import { Button } from "../components/button";
import { Skeleton } from "../components/skeleton";
import { cn } from "../lib/utils";

export type LegalChecklistDocStatus = "not_opened" | "opened" | "accepted";

export type LegalChecklistDocRow = {
  id: string;
  title: string;
  checkboxWording: string | readonly string[];
  status: LegalChecklistDocStatus;
  checked: boolean | readonly boolean[];
  opening: boolean;
  canCheck: boolean;
  showCheckbox: boolean;
};

function checkboxItems(
  row: LegalChecklistDocRow
): { wording: string; checked: boolean }[] {
  const wordings = Array.isArray(row.checkboxWording)
    ? row.checkboxWording
    : [row.checkboxWording];
  const checks = Array.isArray(row.checked)
    ? row.checked
    : wordings.map(() => row.checked === true);
  return wordings.map((wording, index) => ({
    wording,
    checked: Boolean(checks[index]),
  }));
}

/** Short status under each acceptance checkbox. */
export function legalChecklistStatusLabel(
  status: LegalChecklistDocStatus
): string {
  if (status === "accepted") return "Accepted";
  if (status === "opened") return "Ready to accept.";
  return "Review the document to enable acceptance.";
}

export function LegalDocumentChecklistShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  /** When omitted, render a content panel without a page-title header (PageShell owns the title). */
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("w-full rounded-2xl border bg-card shadow-sm md:shadow", className)}>
      {title ? (
        <CardHeader className="space-y-1.5 border-b px-6 py-6 md:px-8">
          <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl">{title}</CardTitle>
          {description ? (
            <p className="text-body text-muted-foreground">{description}</p>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className="p-0">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t px-6 py-4 md:px-8">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

export function LegalDocumentChecklistLoading({
  title,
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <LegalDocumentChecklistShell title={title} description={description}>
      <div className="space-y-4 p-6 md:p-8">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </LegalDocumentChecklistShell>
  );
}

export function LegalDocumentChecklistError({
  title,
  error,
  onRetry,
}: {
  title?: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <LegalDocumentChecklistShell
      title={title}
      description={title ? "Something went wrong while loading the documents." : undefined}
      footer={
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      <div className="px-6 py-5 text-body text-destructive md:px-8">{error}</div>
    </LegalDocumentChecklistShell>
  );
}

/** Shown when onboarding has no published legal PDFs — never fall back to markdown T&Cs. */
export function LegalDocumentChecklistEmpty({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <LegalDocumentChecklistShell
      title={title}
      description={description}
      footer={
        onRetry ? (
          <Button type="button" variant="outline" className="h-11 w-full rounded-xl" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <div className="px-6 py-8 text-body text-muted-foreground md:px-8">
        You cannot continue until the required legal documents are available.
      </div>
    </LegalDocumentChecklistShell>
  );
}

export function LegalDocumentChecklistRows({
  rows,
  disabled,
  onOpen,
  onCheckedChange,
  compact = false,
}: {
  rows: LegalChecklistDocRow[];
  disabled?: boolean;
  onOpen: (id: string) => void;
  onCheckedChange: (id: string, checked: boolean, index?: number) => void;
  /** Stack title + review button; skip shell padding. For narrow cards (e.g. signing). */
  compact?: boolean;
}) {
  return (
    <ul className={compact ? undefined : "divide-y divide-border"}>
      {rows.map((row) => {
        const items = checkboxItems(row);
        const helper = legalChecklistStatusLabel(row.status);
        return (
          <li key={row.id} className={compact ? undefined : "px-6 py-5 md:px-8"}>
            <div
              className={cn(
                "flex flex-col gap-3",
                !compact && "sm:flex-row sm:items-start sm:justify-between"
              )}
            >
              <div className="min-w-0">
                <h3 className="text-body font-semibold text-foreground">{row.title}</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size={compact ? "default" : "sm"}
                className={cn("shrink-0 gap-2", compact && "h-11 w-full rounded-xl")}
                disabled={row.opening || disabled}
                onClick={() => onOpen(row.id)}
              >
                <DocumentTextIcon className="size-4" aria-hidden />
                {row.opening ? "Opening…" : "Review document"}
              </Button>
            </div>

            {row.showCheckbox ? (
              <>
                <div className={cn("mt-4 flex flex-col", items.length > 1 && "gap-3")}>
                  {items.map((item, index) => {
                    const checkboxId =
                      items.length > 1
                        ? `legal-checklist-${row.id}-${index}`
                        : `legal-checklist-${row.id}`;
                    return (
                      <div key={checkboxId} className="flex items-start gap-3">
                        <Checkbox
                          id={checkboxId}
                          className="mt-0.5"
                          checked={item.checked}
                          disabled={!row.canCheck || row.status === "accepted" || disabled}
                          onCheckedChange={(checked) =>
                            onCheckedChange(row.id, checked === true, index)
                          }
                        />
                        <Label
                          htmlFor={checkboxId}
                          className={cn(
                            "text-sm leading-relaxed",
                            row.canCheck && row.status !== "accepted"
                              ? "cursor-pointer"
                              : "cursor-not-allowed text-muted-foreground"
                          )}
                        >
                          {item.wording}
                        </Label>
                      </div>
                    );
                  })}
                </div>

                <p
                  className={cn(
                    "mt-2 text-meta leading-5",
                    row.status === "accepted"
                      ? "inline-flex items-center gap-1.5 text-foreground"
                      : "text-muted-foreground"
                  )}
                  role="status"
                >
                  {row.status === "accepted" ? (
                    <CheckCircleIcon className="size-4 text-primary" aria-hidden />
                  ) : null}
                  {helper}
                </p>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
