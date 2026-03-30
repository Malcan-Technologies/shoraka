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
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface ItemActionDropdownProps {
  itemId: string;
  status: string;
  isPending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApprove?: (itemId: string) => Promise<void>;
  onReject?: (itemId: string) => void;
  onRequestAmendment?: (itemId: string) => void;
  onResetToPending?: (itemId: string) => void;
  showApprove?: boolean;
  /** When false, hides Reject (e.g. documents locked after a peer document was rejected). */
  showReject?: boolean;
  /** When false, hides Request amendment. */
  showRequestAmendment?: boolean;
  /** When true, menu shows only "View Signed Offer" (e.g. after invoice review is finalized). */
  viewSignedOfferOnly?: boolean;
  onViewSignedOffer?: () => void | Promise<void>;
  /** Shown when the menu would be empty: Action stays visible but disabled. */
  noActionsTooltip?: string;
}

export function ItemActionDropdown({
  itemId,
  status,
  isPending,
  isActionLocked = false,
  actionLockTooltip,
  onApprove = async () => {},
  onReject = () => {},
  onRequestAmendment = () => {},
  onResetToPending,
  showApprove = true,
  showReject = true,
  showRequestAmendment = true,
  viewSignedOfferOnly = false,
  onViewSignedOffer,
  noActionsTooltip,
}: ItemActionDropdownProps) {
  if (viewSignedOfferOnly && onViewSignedOffer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg h-9 gap-1"
            disabled={isPending}
          >
            Action
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem className="rounded-lg" onClick={() => void onViewSignedOffer()}>
            View Signed Offer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const button = (
    <Button
      variant="outline"
      size="sm"
      className="rounded-lg h-9 gap-1"
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

  const showResetOption = !!(onResetToPending && status !== "PENDING");
  const hasAnyMenuItem =
    !!onViewSignedOffer ||
    showApprove ||
    showReject ||
    showRequestAmendment ||
    showResetOption;
  if (!hasAnyMenuItem) {
    const emptyTooltip = noActionsTooltip ?? "No actions available for this item right now.";
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg h-9 gap-1 opacity-60"
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {button}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {onViewSignedOffer && (
          <>
            <DropdownMenuItem className="rounded-lg" onClick={() => void onViewSignedOffer()}>
              View Signed Offer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {showApprove && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onApprove(itemId)}
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Approve
          </DropdownMenuItem>
        )}
        {showReject && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onReject(itemId)}
          >
            <XCircleIcon className="h-4 w-4 mr-2" />
            Reject
          </DropdownMenuItem>
        )}
        {showRequestAmendment && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onRequestAmendment(itemId)}
          >
            <DocumentTextIcon className="h-4 w-4 mr-2" />
            Request Amendment
          </DropdownMenuItem>
        )}
        {showResetOption && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onResetToPending(itemId)}
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Set to Pending
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
