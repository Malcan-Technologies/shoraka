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
  version: number;
  checkboxWording: string;
  status: LegalChecklistDocStatus;
  checked: boolean;
  opening: boolean;
  canCheck: boolean;
  showCheckbox: boolean;
};

export function legalChecklistStatusLabel(status: LegalChecklistDocStatus): string {
  if (status === "accepted") return "Accepted";
  if (status === "opened") return "Document opened — you can now accept.";
  return "You must open this document before accepting.";
}

export function LegalDocumentChecklistShell({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("w-full rounded-xl border bg-card shadow-sm", className)}>
      <CardHeader className="space-y-1.5 border-b px-5 py-5 md:px-6">
        <CardTitle className="text-xl font-semibold tracking-tight md:text-2xl">{title}</CardTitle>
        {description ? (
          <p className="text-[17px] leading-7 text-muted-foreground">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
      {footer ? (
        <CardFooter className="border-t px-5 py-4 md:px-6">{footer}</CardFooter>
      ) : null}
    </Card>
  );
}

export function LegalDocumentChecklistLoading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <LegalDocumentChecklistShell title={title} description={description}>
      <div className="space-y-4 p-5 md:p-6">
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
  title: string;
  error: string;
  onRetry: () => void;
}) {
  return (
    <LegalDocumentChecklistShell
      title={title}
      description="Something went wrong while loading the documents."
      footer={
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      <div className="px-5 py-5 text-[17px] leading-7 text-destructive md:px-6">{error}</div>
    </LegalDocumentChecklistShell>
  );
}

export function LegalDocumentChecklistRows({
  rows,
  disabled,
  onOpen,
  onCheckedChange,
}: {
  rows: LegalChecklistDocRow[];
  disabled?: boolean;
  onOpen: (id: string) => void;
  onCheckedChange: (id: string, checked: boolean) => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => {
        const checkboxId = `legal-checklist-${row.id}`;
        return (
          <li key={row.id} className="px-5 py-5 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold leading-7 text-foreground">{row.title}</h3>
                <p className="text-sm text-muted-foreground">Version {row.version}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 gap-2 rounded-lg"
                disabled={row.opening || disabled}
                onClick={() => onOpen(row.id)}
              >
                <DocumentTextIcon className="size-4" aria-hidden />
                {row.opening ? "Opening…" : "Open PDF"}
              </Button>
            </div>

            {row.showCheckbox ? (
              <>
                <div className="mt-4 flex items-start gap-3">
                  <Checkbox
                    id={checkboxId}
                    checked={row.checked}
                    disabled={!row.canCheck || row.status === "accepted" || disabled}
                    onCheckedChange={(checked) => onCheckedChange(row.id, checked === true)}
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
                    {row.checkboxWording}
                  </Label>
                </div>

                <p
                  className={cn(
                    "mt-2 text-sm",
                    row.status === "accepted"
                      ? "inline-flex items-center gap-1.5 text-foreground"
                      : "text-muted-foreground"
                  )}
                  role="status"
                >
                  {row.status === "accepted" ? (
                    <CheckCircleIcon className="size-4 text-primary" aria-hidden />
                  ) : null}
                  {legalChecklistStatusLabel(row.status)}
                </p>
              </>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
