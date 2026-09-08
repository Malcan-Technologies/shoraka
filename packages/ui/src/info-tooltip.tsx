"use client";

import * as React from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "./lib/utils";

interface InfoTooltipProps {
  content: string | React.ReactNode;
  className?: string;
  iconClassName?: string;
}

export function InfoTooltip({ content, className, iconClassName }: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Field information"
          >
            <InformationCircleIcon
              className={cn("h-4 w-4 cursor-help", iconClassName)}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent
          className={cn(
            "max-w-[240px] bg-popover px-2 py-xs text-popover-foreground shadow-md",
            className
          )}
        >
          {typeof content === "string" ? (
            <p className="whitespace-pre-line text-ui">{content}</p>
          ) : (
            content
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
