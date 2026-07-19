"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export {
  PROSPECTUS_INFO_OMIT_ITEM,
  PROSPECTUS_INFO_WORDING_AND_OMIT,
  PROSPECTUS_INFO_WORDING_UNDER_REVIEW,
} from "./section-info";

type SectionHeadingProps = {
  title: string;
  info?: string;
};

/**
 * Compact section title with underline. Optional muted info icon opens a tooltip.
 */
export function ProspectusSectionHeading({ title, info }: SectionHeadingProps) {
  return (
    <div className="mb-4 border-b border-border pb-2">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {info ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex shrink-0 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`About ${title}`}
                >
                  <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
}
