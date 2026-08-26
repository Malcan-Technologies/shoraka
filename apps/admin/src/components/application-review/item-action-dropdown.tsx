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
import { cn } from "@/lib/utils";

const itemActionTriggerBaseClass =
  "inline-flex h-9 items-center justify-center gap-1 rounded-lg";

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
  /** When false, hides Request amendment / Request change. */
  showRequestAmendment?: boolean;
  /** When true, Request change stays visible but cannot be used. */
  requestAmendmentDisabled?: boolean;
  /** Tooltip shown on the disabled Request change item. */
  requestAmendmentDisabledReason?: string;
  /** Menu label for the amendment/change action (acceptance uses "Request change"). */
  requestAmendmentLabel?: string;
  /** When true, menu shows only "View Signed Offer" (e.g. after invoice review is finalized). */
  viewSignedOfferOnly?: boolean;
  onViewSignedOffer?: () => void | Promise<void>;
  /** Shown when the menu would be empty: Action stays visible but disabled. */
  noActionsTooltip?: string;
  /** Merged onto the trigger button (e.g. equal width with sibling View/Download on document rows). */
  triggerClassName?: string;
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
  requestAmendmentDisabled = false,
  requestAmendmentDisabledReason,
  requestAmendmentLabel = "Request Amendment",
  viewSignedOfferOnly = false,
  onViewSignedOffer,
  noActionsTooltip,
  triggerClassName,
}: ItemActionDropdownProps) {
  const normalizedStatus = status.toUpperCase();
  const canApprove = showApprove && normalizedStatus !== "APPROVED";
  const canReject = showReject && normalizedStatus !== "REJECTED";
  const showRequestAmendmentItem =
    showRequestAmendment && normalizedStatus !== "AMENDMENT_REQUESTED";

  if (viewSignedOfferOnly && onViewSignedOffer) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(itemActionTriggerBaseClass, triggerClassName)}
            disabled={isPending}
          >
            Action
            <ChevronDownIcon className="h-4 w-4 shrink-0" />
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

  const button = (
    <Button
      variant="outline"
      size="sm"
      className={cn(itemActionTriggerBaseClass, triggerClassName)}
      disabled={isActionLocked || isPending}
    >
      Action
      <ChevronDownIcon className="h-4 w-4 shrink-0" />
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
    canApprove ||
    canReject ||
    showRequestAmendmentItem ||
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
                className={cn(itemActionTriggerBaseClass, triggerClassName, "opacity-60")}
                disabled
                aria-disabled
              >
                Action
                <ChevronDownIcon className="h-4 w-4 shrink-0" />
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
              <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
              View Signed Offer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {canApprove && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onApprove(itemId)}
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Approve
          </DropdownMenuItem>
        )}
        {canReject && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onReject(itemId)}
          >
            <XCircleIcon className="h-4 w-4 mr-2" />
            Reject
          </DropdownMenuItem>
        )}
        {showRequestAmendmentItem ? (
          requestAmendmentDisabled ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex w-full cursor-not-allowed">
                    <DropdownMenuItem
                      disabled
                      className="w-full rounded-lg"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      {requestAmendmentLabel}
                    </DropdownMenuItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  className="max-w-xs bg-muted text-muted-foreground"
                >
                  {requestAmendmentDisabledReason ??
                    "This change is not available here."}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <DropdownMenuItem
              className="rounded-lg"
              onClick={() => onRequestAmendment(itemId)}
            >
              <DocumentTextIcon className="h-4 w-4 mr-2" />
              {requestAmendmentLabel}
            </DropdownMenuItem>
          )
        ) : null}
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
