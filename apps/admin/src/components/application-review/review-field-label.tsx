"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { fieldTooltipContentClassName, fieldTooltipTriggerClassName } from "@cashsouk/ui";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { reviewLabelClass } from "./review-section-styles";

export function ReviewInfoTooltip({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={fieldTooltipTriggerClassName} aria-label={`About ${label}`}>
            <InformationCircleIcon className="h-4 w-4" aria-hidden />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ReviewFieldLabel({
  htmlFor,
  children,
  tooltip,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  tooltip?: string;
  className?: string;
}) {
  const labelText = typeof children === "string" ? children : "this field";
  return (
    <Label
      htmlFor={htmlFor}
      className={cn(reviewLabelClass, "inline-flex items-center gap-1", className)}
    >
      <span>{children}</span>
      {tooltip ? <ReviewInfoTooltip label={labelText} tooltip={tooltip} /> : null}
    </Label>
  );
}
