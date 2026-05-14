import * as React from "react";
import type { NoteDetail, NoteListItem } from "@cashsouk/types";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeSlashIcon,
  PaperAirplaneIcon,
  TruckIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { Badge } from "./badge";
import { cn } from "../lib/utils";

type Tone =
  | "draft"
  | "info"
  | "warning"
  | "progress"
  | "success"
  | "destructive"
  | "neutral";

/** Tailwind classes aligned with admin notes registry status badges. */
export const NOTE_STATUS_BADGE_TONE_CLASS: Record<Tone, string> = {
  draft:
    "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
  info: "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
  warning:
    "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
  progress:
    "border-transparent bg-status-in-progress-bg text-status-in-progress-text dark:bg-indigo-950/40 dark:text-indigo-300",
  success:
    "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
  destructive:
    "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
  neutral:
    "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
};

export interface DerivedNoteStatus {
  label: string;
  detail?: string;
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
}

/** Issuer sees residual-refund workflow; investor treats that state as settled. */
export type NoteStatusViewer = "issuer" | "investor";

export interface NoteStatusInput {
  status: string;
  listingStatus: string;
  fundingStatus: string;
  servicingStatus: string;
  fundingPercent: number;
  minimumFundingPercent: number;
  hasPostedSettlement: boolean;
  pendingResidual: boolean;
  pendingDisbursement: boolean;
}

export function deriveNoteStatus(input: NoteStatusInput): DerivedNoteStatus {
  if (input.status === "CANCELLED") {
    return { label: "Cancelled", tone: "neutral", icon: ArchiveBoxIcon };
  }
  if (input.status === "FAILED_FUNDING" || input.fundingStatus === "FAILED") {
    return { label: "Funding failed", tone: "destructive", icon: XCircleIcon };
  }
  if (input.hasPostedSettlement && input.pendingResidual) {
    return {
      label: "Awaiting residual refund",
      detail: "Settlement posted",
      tone: "warning",
      icon: TruckIcon,
    };
  }
  if (input.status === "DEFAULTED" || input.servicingStatus === "DEFAULTED") {
    return { label: "Defaulted", tone: "destructive", icon: XCircleIcon };
  }
  if (input.status === "REPAID" || input.servicingStatus === "SETTLED") {
    if (input.pendingResidual) {
      return {
        label: "Awaiting residual refund",
        detail: "Settlement posted",
        tone: "warning",
        icon: TruckIcon,
      };
    }
    return { label: "Settled", tone: "success", icon: CheckBadgeIcon };
  }
  if (input.status === "ARREARS" || input.servicingStatus === "ARREARS") {
    return { label: "Arrears", tone: "warning", icon: ExclamationTriangleIcon };
  }
  if (input.status === "ACTIVE") {
    if (input.hasPostedSettlement && input.pendingResidual) {
      return {
        label: "Awaiting residual refund",
        detail: "Settlement posted",
        tone: "warning",
        icon: TruckIcon,
      };
    }
    if (input.servicingStatus === "LATE") {
      return { label: "Active · late", tone: "warning", icon: ExclamationTriangleIcon };
    }
    if (input.servicingStatus === "PARTIAL") {
      return { label: "Active · partial", tone: "info", icon: ClockIcon };
    }
    if (input.servicingStatus === "ADVANCE_PAID") {
      return { label: "Active · advance paid", tone: "info", icon: CheckCircleIcon };
    }
    return { label: "Active · servicing", tone: "info", icon: CheckCircleIcon };
  }
  if (input.status === "FUNDING" || input.fundingStatus === "FUNDED") {
    return {
      label: "Awaiting disbursement",
      detail: input.pendingDisbursement ? "Trustee letter in flight" : "Funding closed",
      tone: "warning",
      icon: TruckIcon,
    };
  }
  if (input.status === "PUBLISHED") {
    if (input.listingStatus === "UNPUBLISHED") {
      return { label: "Unpublished", tone: "neutral", icon: EyeSlashIcon };
    }
    if (input.fundingStatus === "OPEN") {
      return {
        label: "Funding open",
        detail: `${input.fundingPercent.toFixed(1)}% of ${input.minimumFundingPercent}% minimum`,
        tone: "progress",
        icon: BanknotesIcon,
      };
    }
    return { label: "Published", tone: "info", icon: PaperAirplaneIcon };
  }
  if (input.status === "DRAFT") {
    return { label: "Draft", tone: "draft", icon: ClockIcon };
  }
  return { label: input.status, tone: "neutral", icon: ArchiveBoxIcon };
}

const AWAITING_RESIDUAL_REFUND_LABEL = "Awaiting residual refund";

export function presentNoteStatusForViewer(
  derived: DerivedNoteStatus,
  viewer: NoteStatusViewer
): DerivedNoteStatus {
  if (viewer === "investor" && derived.label === AWAITING_RESIDUAL_REFUND_LABEL) {
    return { label: "Settled", tone: "success", icon: CheckBadgeIcon };
  }
  return derived;
}

function isNoteDetail(note: NoteDetail | NoteListItem): note is NoteDetail {
  return "withdrawals" in note || "settlements" in note;
}

function buildInput(note: NoteDetail | NoteListItem): NoteStatusInput {
  const base = {
    status: note.status,
    listingStatus: note.listingStatus,
    fundingStatus: note.fundingStatus,
    servicingStatus: note.servicingStatus,
    fundingPercent: note.fundingPercent,
    minimumFundingPercent: note.minimumFundingPercent,
  };
  if (isNoteDetail(note)) {
    const hasPostedSettlement = note.settlements.some((s) => s.status === "POSTED");
    const pendingResidual = (note.withdrawals ?? []).some(
      (w) =>
        w.withdrawalType === "ISSUER_RESIDUAL_RETURN" &&
        w.status !== "COMPLETED" &&
        w.status !== "CANCELLED"
    );
    const pendingDisbursement = (note.withdrawals ?? []).some(
      (w) =>
        w.withdrawalType === "ISSUER_DISBURSEMENT" &&
        w.status !== "COMPLETED" &&
        w.status !== "CANCELLED"
    );
    return { ...base, hasPostedSettlement, pendingResidual, pendingDisbursement };
  }

  const hasPostedSettlement = note.settlementSummary != null;
  const residualInFlight =
    "issuerResidualPayout" in note &&
    note.issuerResidualPayout != null &&
    (note.issuerResidualPayout.kind === "pending" || note.issuerResidualPayout.kind === "awaiting");
  const pendingResidual =
    residualInFlight ||
    (hasPostedSettlement &&
      (note.status === "ACTIVE" || note.status === "ARREARS" || note.status === "DEFAULTED"));
  const pendingDisbursement = note.status === "FUNDING";

  return { ...base, hasPostedSettlement, pendingResidual, pendingDisbursement };
}

/** True when the note matches the fully settled NoteStatusBadge label ("Settled"). */
export function isNoteFullySettled(note: NoteDetail | NoteListItem): boolean {
  return deriveNoteStatus(buildInput(note)).label === "Settled";
}

/** Primary label shown on `NoteStatusBadge`; use when filtering so chips and list stay aligned. */
export function getNoteDerivedStatusLabel(
  note: NoteDetail | NoteListItem,
  options?: { viewer?: NoteStatusViewer }
): string {
  const raw = deriveNoteStatus(buildInput(note));
  return presentNoteStatusForViewer(raw, options?.viewer ?? "issuer").label;
}

export interface NoteStatusBadgeProps {
  note: NoteDetail | NoteListItem;
  showDetail?: boolean;
  className?: string;
  viewer?: NoteStatusViewer;
}

export function NoteStatusBadge({
  note,
  showDetail = false,
  className,
  viewer = "issuer",
}: NoteStatusBadgeProps) {
  const status = React.useMemo(() => {
    const raw = deriveNoteStatus(buildInput(note));
    return presentNoteStatusForViewer(raw, viewer);
  }, [note, viewer]);
  const Icon = status.icon;
  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full gap-1 truncate",
        NOTE_STATUS_BADGE_TONE_CLASS[status.tone],
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{status.label}</span>
    </Badge>
  );
  if (!showDetail) return badge;
  return (
    <div className="flex flex-col items-end gap-0.5">
      {badge}
      {status.detail ? (
        <span className="text-[11px] text-muted-foreground">{status.detail}</span>
      ) : null}
    </div>
  );
}

function soukscoreRiskRatingClass(riskRating: string | null | undefined): string {
  const grade = riskRating?.trim().toUpperCase();
  if (grade === "AAA" || grade === "AA") {
    return NOTE_STATUS_BADGE_TONE_CLASS.success;
  }
  if (grade === "A" || grade === "BBB") {
    return NOTE_STATUS_BADGE_TONE_CLASS.info;
  }
  if (grade === "BB") {
    return NOTE_STATUS_BADGE_TONE_CLASS.warning;
  }
  if (grade === "B") {
    return NOTE_STATUS_BADGE_TONE_CLASS.destructive;
  }
  return NOTE_STATUS_BADGE_TONE_CLASS.neutral;
}

export function SoukscoreRiskRatingBadge({
  riskRating,
  className,
}: {
  riskRating: string | null | undefined;
  className?: string;
}) {
  const display = riskRating?.trim() ? riskRating.trim().toUpperCase() : null;
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate", soukscoreRiskRatingClass(display), className)}
    >
      {display ?? "-"}
    </Badge>
  );
}
