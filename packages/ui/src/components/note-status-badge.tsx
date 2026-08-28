import * as React from "react";
import type { NoteDetail, NoteListItem } from "@cashsouk/types";
import {
  isSettlementWrappingUpFromSettlements,
  isSettlementWrappingUpFromSummary,
  isMarcSmeGrade,
  marcBandForGrade,
} from "@cashsouk/types";
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
import { StatusBadge, type StatusToken } from "./status-badge";
import { cn } from "../lib/utils";

type Tone =
  | "draft"
  | "info"
  | "warning"
  | "progress"
  | "success"
  | "active"
  | "destructive"
  | "neutral";

/** Tailwind classes aligned with StatusBadge tokens (viewer-centric). */
export const NOTE_STATUS_BADGE_TONE_CLASS: Record<Tone, string> = {
  draft:
    "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
  info: "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
  warning:
    "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
  progress:
    "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
  success:
    "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
  active: "border-transparent bg-status-active-bg text-status-active-text",
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

/** Issuer sees residual-refund workflow; investor sees simplified settlement labels. */
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
  settlementTrusteePending: boolean;
  pendingDisbursement: boolean;
}

const AWAITING_RESIDUAL_REFUND_LABEL = "Awaiting residual refund";
const INVESTOR_SETTLEMENT_PROCESSING_LABEL = "Settlement processing";

function awaitingResidualRefundStatus(): DerivedNoteStatus {
  return {
    label: AWAITING_RESIDUAL_REFUND_LABEL,
    detail: "Settlement posted",
    tone: "info",
    icon: TruckIcon,
  };
}

export function deriveNoteStatus(input: NoteStatusInput): DerivedNoteStatus {
  if (input.status === "CANCELLED") {
    return { label: "Cancelled", tone: "neutral", icon: ArchiveBoxIcon };
  }
  if (input.status === "FAILED_FUNDING" || input.fundingStatus === "FAILED") {
    return { label: "Funding failed", tone: "destructive", icon: XCircleIcon };
  }
  if (input.hasPostedSettlement && input.pendingResidual) {
    return awaitingResidualRefundStatus();
  }
  if (input.status === "DEFAULTED" || input.servicingStatus === "DEFAULTED") {
    return { label: "Defaulted", tone: "destructive", icon: XCircleIcon };
  }
  if (input.status === "REPAID" || input.servicingStatus === "SETTLED") {
    if (input.pendingResidual) {
      return awaitingResidualRefundStatus();
    }
    if (input.settlementTrusteePending) {
      return { label: "Active · servicing", tone: "active", icon: CheckCircleIcon };
    }
    return { label: "Settled", tone: "success", icon: CheckBadgeIcon };
  }
  if (input.status === "ARREARS" || input.servicingStatus === "ARREARS") {
    return { label: "Arrears", tone: "destructive", icon: ExclamationTriangleIcon };
  }
  if (input.status === "ACTIVE") {
    if (input.hasPostedSettlement && input.pendingResidual) {
      return awaitingResidualRefundStatus();
    }
    if (input.servicingStatus === "LATE") {
      return { label: "Active · late", tone: "warning", icon: ExclamationTriangleIcon };
    }
    if (input.servicingStatus === "PARTIAL") {
      return { label: "Active · partial", tone: "info", icon: ClockIcon };
    }
    if (input.servicingStatus === "ADVANCE_PAID") {
      return { label: "Active · advance paid", tone: "active", icon: CheckCircleIcon };
    }
    return { label: "Active · servicing", tone: "active", icon: CheckCircleIcon };
  }
  if (input.status === "FUNDING" || input.fundingStatus === "FUNDED") {
    return {
      label: "Awaiting disbursement",
      detail: input.pendingDisbursement ? "Trustee letter in flight" : "Funding closed",
      tone: "info",
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

export function presentNoteStatusForViewer(
  derived: DerivedNoteStatus,
  viewer: NoteStatusViewer,
  input?: NoteStatusInput
): DerivedNoteStatus {
  if (viewer === "investor" && derived.label === AWAITING_RESIDUAL_REFUND_LABEL) {
    return { label: "Settled", tone: "success", icon: CheckBadgeIcon };
  }
  if (
    viewer === "investor" &&
    input?.settlementTrusteePending &&
    !input.pendingResidual &&
    derived.label === "Active · servicing"
  ) {
    return {
      label: INVESTOR_SETTLEMENT_PROCESSING_LABEL,
      tone: "progress",
      icon: ClockIcon,
    };
  }
  if (viewer === "issuer" && derived.label === "Active · partial") {
    return { ...derived, tone: "warning" };
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
    const settlementTrusteePending = isSettlementWrappingUpFromSettlements(
      note.settlements ?? []
    );
    const pendingDisbursement = (note.withdrawals ?? []).some(
      (w) =>
        w.withdrawalType === "ISSUER_DISBURSEMENT" &&
        w.status !== "COMPLETED" &&
        w.status !== "CANCELLED"
    );
    return {
      ...base,
      hasPostedSettlement,
      pendingResidual,
      settlementTrusteePending,
      pendingDisbursement,
    };
  }

  const hasPostedSettlement = note.settlementSummary != null;
  const settlementTrusteePending = isSettlementWrappingUpFromSummary(note.settlementSummary);
  const issuerResidualPayout =
    "issuerResidualPayout" in note ? note.issuerResidualPayout : undefined;
  const pendingResidual =
    issuerResidualPayout?.kind === "awaiting" ||
    (issuerResidualPayout?.kind === "pending" && !settlementTrusteePending);
  const pendingDisbursement = note.status === "FUNDING";

  return {
    ...base,
    hasPostedSettlement,
    pendingResidual,
    settlementTrusteePending,
    pendingDisbursement,
  };
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
  const input = buildInput(note);
  const raw = deriveNoteStatus(input);
  return presentNoteStatusForViewer(raw, options?.viewer ?? "issuer", input).label;
}

/** Status token for the derived note badge (admin row highlighting). */
export function getNoteDerivedStatusToken(
  note: NoteDetail | NoteListItem,
  options?: { viewer?: NoteStatusViewer }
): StatusToken {
  const input = buildInput(note);
  const raw = deriveNoteStatus(input);
  return noteToneToStatusToken(
    presentNoteStatusForViewer(raw, options?.viewer ?? "issuer", input).tone
  );
}

function noteToneToStatusToken(tone: Tone): StatusToken {
  switch (tone) {
    case "draft":
    case "neutral":
      return "neutral";
    case "success":
      return "success";
    case "active":
      return "active";
    case "destructive":
      return "rejected";
    case "info":
    case "progress":
      return "submitted";
    default:
      return "action";
  }
}

export { noteToneToStatusToken };

export interface NoteStatusBadgeProps {
  note: NoteDetail | NoteListItem;
  showDetail?: boolean;
  className?: string;
  viewer?: NoteStatusViewer;
  marker?: "icon" | "dot";
}

export function NoteStatusBadge({
  note,
  showDetail = false,
  className,
  viewer = "issuer",
  marker = "icon",
}: NoteStatusBadgeProps) {
  const status = React.useMemo(() => {
    const input = buildInput(note);
    const raw = deriveNoteStatus(input);
    return presentNoteStatusForViewer(raw, viewer, input);
  }, [note, viewer]);
  const Icon = status.icon;
  const badge =
    marker === "dot" ? (
      <StatusBadge
        label={status.label}
        status={noteToneToStatusToken(status.tone)}
        className={cn("max-w-full truncate", className)}
      />
    ) : (
      <Badge
        variant="outline"
        className={cn(
          "max-w-full gap-1 truncate text-ui",
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
        <span className="text-meta text-muted-foreground">{status.detail}</span>
      ) : null}
    </div>
  );
}

function soukscoreRiskRatingClass(riskRating: string | null | undefined): string {
  const raw = riskRating?.trim();
  if (isMarcSmeGrade(raw)) {
    const key = marcBandForGrade(raw)?.key;
    if (key === "a" || key === "b") return NOTE_STATUS_BADGE_TONE_CLASS.success;
    if (key === "c") return NOTE_STATUS_BADGE_TONE_CLASS.info;
    if (key === "d") return NOTE_STATUS_BADGE_TONE_CLASS.warning;
    return NOTE_STATUS_BADGE_TONE_CLASS.destructive;
  }
  const grade = raw?.toUpperCase();
  if (grade === "A" || grade === "B") {
    return NOTE_STATUS_BADGE_TONE_CLASS.success;
  }
  if (grade === "C") {
    return NOTE_STATUS_BADGE_TONE_CLASS.info;
  }
  if (grade === "D") {
    return NOTE_STATUS_BADGE_TONE_CLASS.warning;
  }
  if (grade === "E" || grade === "F") {
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
  const display = isMarcSmeGrade(riskRating?.trim())
    ? riskRating!.trim()
    : riskRating?.trim()
      ? riskRating.trim()
      : null;
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate text-ui", soukscoreRiskRatingClass(display), className)}
    >
      {display ?? "-"}
    </Badge>
  );
}
