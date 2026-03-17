"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  onApprove: (itemId: string) => Promise<void>;
  onReject: (itemId: string) => void;
  onRequestAmendment: (itemId: string) => void;
  onResetToPending?: (itemId: string) => void;
  showApprove?: boolean;
}

export function ItemActionDropdown({
  itemId,
  status,
  isPending,
  isActionLocked = false,
  actionLockTooltip,
  onApprove,
  onReject,
  onRequestAmendment,
  onResetToPending,
  showApprove = true,
}: ItemActionDropdownProps) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {button}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {showApprove && (
          <DropdownMenuItem
            className="rounded-lg"
            onClick={() => onApprove(itemId)}
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Approve
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onReject(itemId)}
        >
          <XCircleIcon className="h-4 w-4 mr-2" />
          Reject
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onRequestAmendment(itemId)}
        >
          <DocumentTextIcon className="h-4 w-4 mr-2" />
          Request Amendment
        </DropdownMenuItem>
        {onResetToPending && status !== "PENDING" && (
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
