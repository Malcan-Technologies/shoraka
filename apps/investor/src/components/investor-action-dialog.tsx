"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function InvestorActionDialogIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      {children}
    </div>
  );
}

export function InvestorActionDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  footnote,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  footnote?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,44rem)] max-w-md gap-0 overflow-y-auto rounded-2xl border-border bg-card p-0 shadow-lg sm:rounded-2xl",
          contentClassName
        )}
      >
        <DialogHeader className="space-y-3 px-6 pb-1 pt-6 pr-12 text-left">
          {icon}
          <div className="space-y-2">
            <DialogTitle className="text-dialog-title text-foreground">{title}</DialogTitle>
            {description ? (
              typeof description === "string" ? (
                <DialogDescription className="text-ui leading-6 text-muted-foreground">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription asChild>
                  <div className="text-ui leading-6 text-muted-foreground">{description}</div>
                </DialogDescription>
              )
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </div>
        </DialogHeader>

        {children ? <div className="space-y-5 px-6 py-5">{children}</div> : null}

        {footer ? (
          <DialogFooter className="flex-row gap-2 border-t border-border px-6 py-4 sm:justify-between sm:space-x-0">
            {footer}
          </DialogFooter>
        ) : null}

        {footnote ? (
          <div className="border-t border-border px-6 py-4 text-center text-meta leading-5 text-muted-foreground">
            {footnote}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
