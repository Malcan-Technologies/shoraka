"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowPathIcon, CheckCircleIcon, ChevronDownIcon, DocumentTextIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { ReviewSectionId } from "./section-types";

export interface SectionActionDropdownProps {
  section: ReviewSectionId;
  isReviewable: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onResetToPending?: (section: ReviewSectionId) => void;
  isPending: boolean;
  /** Current section status; when not PENDING, shows "Set to Pending" option. */
  sectionStatus?: string;
  /** When true, the dropdown is disabled and shows tooltip explaining why. */
  isActionLocked?: boolean;
  /** Tooltip text when isActionLocked is true. */
  actionLockTooltip?: string;
}

export function SectionActionDropdown({
  section,
  isReviewable,
  onApprove,
  onReject,
  onRequestAmendment,
  onResetToPending,
  isPending,
  sectionStatus,
  isActionLocked = false,
  actionLockTooltip,
}: SectionActionDropdownProps) {
  if (!isReviewable) return null;

  const button = (
    <Button
      variant="outline"
      size="sm"
      className="rounded-xl gap-1.5"
      disabled={isActionLocked || isPending}
    >
      Action
      <ChevronDownIcon className="h-4 w-4" />
    </Button>
  );

  if (isActionLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">{button}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
            {actionLockTooltip ?? "Complete previous sections first"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onApprove(section)}
          disabled={isPending}
        >
          <CheckCircleIcon className="h-4 w-4 mr-2" />
          Approve
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onReject(section)}
        >
          <XCircleIcon className="h-4 w-4 mr-2" />
          Reject (leave remark)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onRequestAmendment(section)}
        >
          <DocumentTextIcon className="h-4 w-4 mr-2" />
          Request amendment
        </DropdownMenuItem>
        {onResetToPending && sectionStatus && sectionStatus !== "PENDING" && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onResetToPending(section)}
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Set to Pending
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
