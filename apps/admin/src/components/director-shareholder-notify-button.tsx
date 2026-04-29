"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DirectorShareholderNotifyButtonProps = {
  /** False when onboarding email is not required for this row (Type A, role rules, etc.). */
  rowActionable: boolean;
  disabled: boolean;
  onNotify: () => void;
  className?: string;
};

export function DirectorShareholderNotifyButton({
  rowActionable,
  disabled,
  onNotify,
  className,
}: DirectorShareholderNotifyButtonProps) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-8", className)}
      disabled={disabled}
      onClick={rowActionable ? onNotify : undefined}
    >
      Notify
    </Button>
  );

  if (rowActionable) {
    return button;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent side="top">Onboarding email not required</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
