"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
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
  /** When false, hides Approve action (offer-driven sections). */
  showApprove?: boolean;
  /** When true, keep Approve visible but disabled. */
  approveDisabled?: boolean;
  /** Reason displayed next to disabled Approve item. */
  approveDisabledReason?: string;
  /** When false, hides Reject (use item-level actions instead). */
  showReject?: boolean;
  /** When false, hides Request amendment (use item-level actions instead). */
  showRequestAmendment?: boolean;
  /** When true, menu shows only "View Signed Offer". */
  viewSignedOfferOnly?: boolean;
  onViewSignedOffer?: () => void | Promise<void>;
  /** When false, "View Signed Offer" is hidden (e.g. no signed PDF on file yet). */
  signedOfferLetterAvailable?: boolean;
  /** When the menu would be empty, Action stays visible but disabled. */
  noActionsTooltip?: string;
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
  showApprove = true,
  approveDisabled = false,
  approveDisabledReason,
  showReject = true,
  showRequestAmendment = true,
  viewSignedOfferOnly = false,
  onViewSignedOffer,
  signedOfferLetterAvailable = false,
  noActionsTooltip,
}: SectionActionDropdownProps) {
  if (!isReviewable) return null;

  const showViewSignedOffer = !!onViewSignedOffer && signedOfferLetterAvailable === true;
  const normalizedStatus = (sectionStatus ?? "PENDING").toUpperCase();
  const showApproveAction = showApprove && normalizedStatus !== "APPROVED";
  const canReject = showReject && normalizedStatus !== "REJECTED";
  const canRequestAmendment =
    showRequestAmendment && normalizedStatus !== "AMENDMENT_REQUESTED";

  if (viewSignedOfferOnly && showViewSignedOffer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" disabled={isPending}>
            Action
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem className="rounded-lg" onClick={() => void onViewSignedOffer()}>
            <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
            View Signed Offer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const showResetOption = !!(onResetToPending && sectionStatus && sectionStatus !== "PENDING");
  const hasAnyMenuAction =
    showApproveAction || canReject || canRequestAmendment || showResetOption || showViewSignedOffer;

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

  if (!hasAnyMenuAction) {
    const emptyTooltip =
      noActionsTooltip ??
      "No section-level actions are available. Use the actions on each item below.";
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 opacity-60"
                disabled
                aria-disabled
              >
                Action
                <ChevronDownIcon className="h-4 w-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs bg-muted text-muted-foreground">
            {emptyTooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

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
        {showViewSignedOffer && (
          <>
            <DropdownMenuItem className="rounded-lg" onClick={() => void onViewSignedOffer()}>
              <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
              View Signed Offer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {showApproveAction && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onApprove(section)}
            disabled={isPending || approveDisabled}
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Approve
            {approveDisabled && approveDisabledReason ? (
              <span className="ml-2 text-xs text-muted-foreground">({approveDisabledReason})</span>
            ) : null}
          </DropdownMenuItem>
        )}
        {canReject && (
          <DropdownMenuItem className="rounded-lg" onClick={() => onReject(section)}>
            <XCircleIcon className="h-4 w-4 mr-2" />
            Reject
          </DropdownMenuItem>
        )}
        {canRequestAmendment && (
          <DropdownMenuItem className="rounded-lg" onClick={() => onRequestAmendment(section)}>
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Request amendment
          </DropdownMenuItem>
        )}
        {onResetToPending && sectionStatus && sectionStatus !== "PENDING" && (
          <DropdownMenuItem className="rounded-lg" onClick={() => onResetToPending(section)}>
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Set to Pending
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
