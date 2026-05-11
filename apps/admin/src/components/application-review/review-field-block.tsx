"use client";

import { reviewSectionHeaderClass } from "./review-section-styles";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fieldTooltipContentClassName, fieldTooltipTriggerClassName } from "@cashsouk/ui";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

export interface ReviewFieldBlockProps {
  title: string;
  children: React.ReactNode;
  /** Optional tooltip shown next to the section title. */
  titleTooltip?: string;
}

/**
 * Section block with header, divider, and content. Matches application flow exactly:
 * business-details/company-details pattern — div with h3 + divider.
 */
export function ReviewFieldBlock({ title, children, titleTooltip }: ReviewFieldBlockProps) {
  return (
    <section className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <h3 className={reviewSectionHeaderClass}>{title}</h3>
          {titleTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={fieldTooltipTriggerClassName}
                  aria-label={`About ${title}`}
                >
                  <InformationCircleIcon className="h-4 w-4" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                {titleTooltip}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <div className="border-b border-border mt-2 mb-4" />
      </div>
      {children}
    </section>
  );
}
