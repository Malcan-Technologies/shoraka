"use client";

import type { ComponentType } from "react";
import {
  ArrowPathIcon,
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  PauseIcon,
  PlayIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import { buildInvestorCampaignUrl, formatCurrency } from "@cashsouk/config";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildNoteLifecycleActionPlan,
  getNoteListingAutoCloseInfo,
  isNoteFeatureEligible,
  type NoteLifecycleAction,
} from "@/notes/utils/note-lifecycle-actions";
import { isNoteLifecycleVisuallyComplete } from "@/notes/utils/settlement-trustee-workflow";

const ACTION_ICONS: Record<NoteLifecycleAction, ComponentType<{ className?: string }>> = {
  publish: GlobeAltIcon,
  unpublish: ArrowUturnLeftIcon,
  pauseListing: PauseIcon,
  resumeListing: PlayIcon,
  closeFunding: ArrowRightCircleIcon,
  failFunding: ExclamationTriangleIcon,
};

type NoteCampaignActionsProps = {
  note: NoteDetail;
  pending: Partial<Record<NoteLifecycleAction, boolean>>;
  onRequestAction: (action: NoteLifecycleAction) => void;
  canManage?: boolean;
  featuredEnabled: boolean;
  featuredPending?: boolean;
  onToggleFeatured: (nextValue: boolean) => void;
};

export function NoteCampaignActions({
  note,
  pending,
  onRequestAction,
  canManage = true,
  featuredEnabled,
  featuredPending = false,
  onToggleFeatured,
}: NoteCampaignActionsProps) {
  const isComplete = isNoteLifecycleVisuallyComplete(note);
  const { primary, secondary, contextHelper, isListingLive, isListingPaused } =
    buildNoteLifecycleActionPlan(note);
  const anyPending = Object.values(pending).some(Boolean);
  const autoClose = isListingLive ? getNoteListingAutoCloseInfo(note) : null;
  const terminal = note.status === "FAILED_FUNDING" || note.status === "CANCELLED";
  const campaignUrl = isListingLive ? buildInvestorCampaignUrl(note.id) : null;
  const showListingActions =
    !isComplete &&
    !terminal &&
    (primary != null || secondary.length > 0 || autoClose != null || isListingPaused);
  const featureEligible = isNoteFeatureEligible(note);
  const featuredLocked = featuredPending || !canManage || !featureEligible;
  const featuredLockReason = !canManage
    ? "You do not have permission to perform this action."
    : !featureEligible
      ? "Only notes that are published and open for funding can be featured."
      : null;

  const featuredSwitch = (
    <Switch
      id="note-featured-toggle"
      checked={featuredEnabled}
      onCheckedChange={(checked) => onToggleFeatured(Boolean(checked))}
      disabled={featuredLocked}
    />
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <StarIcon className="h-4 w-4" aria-hidden />
            </span>
            <CardTitle>Featured listing</CardTitle>
          </div>
          {featuredLockReason ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">{featuredSwitch}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  {featuredLockReason}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            featuredSwitch
          )}
        </div>
        <p className="text-ui text-muted-foreground pl-12">
          {featureEligible
            ? "Pin this note on the investor marketplace."
            : "Featured listings are only available while the note is published and open for funding."}
        </p>
        {campaignUrl ? (
          <a
            href={campaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pl-12 inline-flex items-center gap-1.5 text-ui text-primary hover:underline"
          >
            View live campaign
            <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden />
          </a>
        ) : null}
      </CardHeader>

      {showListingActions ? (
        <CardContent className="space-y-4">
          {isListingPaused ? (
            <p className="text-ui text-muted-foreground">
              Campaign is paused. The listing is hidden from investors. Existing commitments
              are held and funds have not been returned.
            </p>
          ) : null}

          {autoClose ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 text-ui",
                autoClose.fullyFunded
                  ? "text-status-success-text"
                  : autoClose.overdue
                    ? "text-status-action-text"
                    : "text-muted-foreground"
              )}
            >
              <ClockIcon className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "font-medium",
                    autoClose.fullyFunded ? "text-status-success-text" : "text-foreground"
                  )}
                >
                  {autoClose.label}
                </div>
                <div
                  className={cn(
                    "text-meta",
                    autoClose.fullyFunded ? "text-status-success-text/80" : "text-muted-foreground"
                  )}
                >
                  {autoClose.fullyFunded
                    ? `Target ${formatCurrency(note.targetAmount)} reached. Funding is being closed automatically; you can also close manually to proceed immediately.`
                    : autoClose.overdue
                      ? "The hourly auto-close job will finalise the listing on its next run. You can close or fail manually now to override."
                      : `Listing closes automatically at this time or as soon as the target ${formatCurrency(note.targetAmount)} is fully funded. Closing or failing manually overrides the schedule.`}
                </div>
              </div>
            </div>
          ) : null}

          {primary || secondary.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-meta uppercase tracking-wider text-muted-foreground">
                  {primary ? "Next Step" : "Actions"}
                </div>
                <div className="mt-1 text-ui font-medium">
                  {primary ? primary.label : contextHelper ?? "No forward action available"}
                </div>
                {primary?.helper ? (
                  <p className="mt-1 text-meta text-muted-foreground">{primary.helper}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {secondary.map((action) => {
                  const Icon = ACTION_ICONS[action.key];
                  const btn = (
                    <Button
                      key={action.key}
                      size="sm"
                      variant={action.variant}
                      onClick={() => onRequestAction(action.key)}
                      disabled={anyPending || !canManage}
                      className="gap-1.5"
                    >
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </Button>
                  );
                  if (!canManage) {
                    return (
                      <TooltipProvider key={action.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex cursor-not-allowed">{btn}</span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            You do not have permission to perform this action.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }
                  return btn;
                })}
                {primary ? (
                  (() => {
                    const PrimaryIcon = ACTION_ICONS[primary.key];
                    const btn = (
                      <Button
                        size="sm"
                        variant={primary.variant}
                        onClick={() => onRequestAction(primary.key)}
                        disabled={anyPending || pending[primary.key] || !canManage}
                        className="gap-1.5"
                      >
                        {pending[primary.key] ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <PrimaryIcon className="h-4 w-4" />
                        )}
                        {primary.label}
                      </Button>
                    );
                    if (!canManage) {
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex cursor-not-allowed">{btn}</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              You do not have permission to perform this action.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    }
                    return btn;
                  })()
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
