"use client";

import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MinusIcon,
} from "@heroicons/react/24/solid";
import {
  resolvePartyCtosComparison,
  type OrganizationPartyProfileDto,
  type PartyCtosComparison,
} from "@cashsouk/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/tooltip";
import { cn } from "./lib/utils";

/**
 * CTOS verification indicator means the current master person matches
 * the latest CTOS comparison.
 *
 * It does NOT merely mean the record originally came from CTOS.
 */
export function partyCtosComparisonFor(
  party: Pick<
    OrganizationPartyProfileDto,
    "membershipStatus" | "absentFromLatestExternal" | "externalObservation" | "mismatches"
  > | null | undefined
): PartyCtosComparison {
  return resolvePartyCtosComparison(party);
}

const STATE_CLASS: Record<PartyCtosComparison["state"], string> = {
  MATCHED: "text-status-success-text",
  DIFFERS: "text-status-action-text",
  NOT_FOUND: "text-status-action-text",
  NO_COMPARISON: "text-muted-foreground",
};

function CtosStateIcon({ state }: { state: PartyCtosComparison["state"] }) {
  if (state === "MATCHED") {
    return <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  if (state === "DIFFERS") {
    return <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  if (state === "NOT_FOUND") {
    return <MinusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />;
  }
  return null;
}

export function PartyCtosIndicator({
  party,
  className,
}: {
  party: Pick<
    OrganizationPartyProfileDto,
    "membershipStatus" | "absentFromLatestExternal" | "externalObservation" | "mismatches"
  > | null | undefined;
  className?: string;
}) {
  const comparison = resolvePartyCtosComparison(party);
  const prefix =
    comparison.state === "MATCHED" ? "✓ " : comparison.state === "DIFFERS" ? "! " : comparison.state === "NOT_FOUND" ? "– " : "";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-sm text-meta font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              STATE_CLASS[comparison.state],
              className
            )}
            aria-label={comparison.tooltip}
          >
            <CtosStateIcon state={comparison.state} />
            <span className="truncate">
              {prefix}
              {comparison.label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] bg-popover px-2 py-xs text-popover-foreground shadow-md">
          <p className="whitespace-pre-line text-ui">{comparison.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
