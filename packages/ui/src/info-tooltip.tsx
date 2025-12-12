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
          <InformationCircleIcon
            className={cn("h-4 w-4 text-muted-foreground cursor-help", iconClassName)}
          />
        </TooltipTrigger>
        <TooltipContent
          className={cn(
            "max-w-[240px] bg-popover px-2 py-xs text-popover-foreground shadow-md",
            className
          )}
        >
          {typeof content === "string" ? <p className="text-sm">{content}</p> : content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
