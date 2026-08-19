"use client";

import * as React from "react";
import Link from "next/link";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NormalizedApplication } from "../status";

export function ApplicationCardMenu({
  application,
  onViewSignedContractOffer,
  onCancelApplication,
  onDeleteDraft,
  isCancelApplicationPending,
  compact = false,
}: {
  application: NormalizedApplication;
  onViewSignedContractOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onCancelApplication?: (applicationId: string) => void;
  onDeleteDraft?: (applicationId: string) => void;
  isCancelApplicationPending?: boolean;
  compact?: boolean;
}) {
  const isDraft = application.status === "draft";
  const hasContract = application.type === "Facility financing";
  const showViewSignedContract =
    application.signedContractOfferLetterAvailable &&
    !!application.signedContractOfferLetterS3Key &&
    hasContract &&
    onViewSignedContractOffer;
  const withdrawDisabled = !!isCancelApplicationPending || !!showViewSignedContract;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={compact ? "h-8 w-8" : undefined}
          aria-label="More actions"
        >
          <EllipsisVerticalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        {!isDraft ? (
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href={`/applications/${application.id}`}>View application</Link>
          </DropdownMenuItem>
        ) : null}
        {isDraft ? (
          <>
            <DropdownMenuItem className="cursor-pointer" asChild>
              <Link href={`/applications/${application.id}/edit`}>Continue editing</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={() => onDeleteDraft?.(application.id)}
            >
              Delete draft
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {showViewSignedContract ? (
              <>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    void onViewSignedContractOffer!(application.signedContractOfferLetterS3Key!);
                  }}
                >
                  View signed offer
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              disabled={withdrawDisabled}
              onClick={() => {
                if (!withdrawDisabled) onCancelApplication?.(application.id);
              }}
            >
              {isCancelApplicationPending ? "Withdrawing…" : "Withdraw application"}
            </DropdownMenuItem>
            {showViewSignedContract ? (
              <p className="px-2 py-1.5 text-ui text-muted-foreground">
                Withdraw is not available while a signed offer letter is on file.
              </p>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
