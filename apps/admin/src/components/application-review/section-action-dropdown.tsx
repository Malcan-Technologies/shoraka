"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckCircleIcon, ChevronDownIcon, DocumentTextIcon, XCircleIcon } from "@heroicons/react/24/outline";
import type { ReviewSectionId } from "./section-types";

export interface SectionActionDropdownProps {
  section: ReviewSectionId;
  isReviewable: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  isPending: boolean;
}

export function SectionActionDropdown({
  section,
  isReviewable,
  onApprove,
  onReject,
  onRequestAmendment,
  isPending,
}: SectionActionDropdownProps) {
  if (!isReviewable) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5">
          Action
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
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
          className="rounded-lg text-destructive focus:text-destructive"
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
