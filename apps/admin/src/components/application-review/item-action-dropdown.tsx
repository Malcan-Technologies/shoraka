"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  onApprove: (itemId: string) => Promise<void>;
  onReject: (itemId: string) => void;
  onRequestAmendment: (itemId: string) => void;
  onResetToPending?: (itemId: string) => void;
}

export function ItemActionDropdown({
  itemId,
  status,
  isPending,
  onApprove,
  onReject,
  onRequestAmendment,
  onResetToPending,
}: ItemActionDropdownProps) {
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
        <DropdownMenuItem
          className="rounded-lg"
          onClick={() => onApprove(itemId)}
        >
          <CheckCircleIcon className="h-4 w-4 mr-2" />
          Approve
        </DropdownMenuItem>
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
