export type OriginationKind = "new_contract" | "existing_contract" | "invoice_only";

export const FACILITY_ORIGINATION_STEPS = [
  "Submitted",
  "Reviewed",
  "Offer accepted",
  "Facility signed",
] as const;

export const INVOICE_ONLY_ORIGINATION_STEPS = [
  "Submitted",
  "Reviewed",
  "Offer accepted",
  "Offer signed",
] as const;

export const DRAWDOWN_ORIGINATION_STEPS = ["Submitted", "Reviewed", "Offer accepted"] as const;

export const NOTE_PIPELINE_STEPS = [
  "Pending listing",
  "Funding in progress",
  "Funds disbursed",
] as const;

export const DASHBOARD_LIST_PAGE_SIZE = 5;

export type PipelineStepState = "done" | "current" | "upcoming" | "failed";

const CLOSED_BADGE_KEYS = new Set([
  "withdrawn",
  "declined",
  "rejected",
  "archived",
  "offer_expired",
]);

export function isClosedApplicationBadge(badgeKey: string): boolean {
  return CLOSED_BADGE_KEYS.has(badgeKey.toLowerCase());
}

export function isInFlightApplicationBadge(badgeKey: string): boolean {
  const key = badgeKey.toLowerCase();
  return key !== "completed" && key !== "draft" && !isClosedApplicationBadge(key);
}

export function originationStepsFor(kind: OriginationKind): readonly string[] {
  if (kind === "invoice_only") return INVOICE_ONLY_ORIGINATION_STEPS;
  if (kind === "existing_contract") return DRAWDOWN_ORIGINATION_STEPS;
  return FACILITY_ORIGINATION_STEPS;
}

export function originationKindLabel(kind: OriginationKind): string {
  if (kind === "invoice_only") return "Invoice financing";
  if (kind === "existing_contract") return "Invoice under a facility";
  return "Facility financing";
}

export function resolveOriginationKind(input: {
  structureType?: string | null;
  type?: string | null;
  contractId?: string | null;
}): OriginationKind {
  const structure = String(input.structureType ?? "").toLowerCase();
  if (structure === "new_contract" || structure === "existing_contract" || structure === "invoice_only") {
    return structure;
  }
  if (input.type === "Invoice financing" || (!input.contractId && input.type !== "Facility financing")) {
    return "invoice_only";
  }
  return "new_contract";
}

/**
 * After a facility is signed, leftover invoice work on the same application
 * follows the drawdown process (no second facility signing).
 */
export function effectiveOriginationKind(input: {
  structureType?: string | null;
  type?: string | null;
  contractId?: string | null;
  facilitySigned: boolean;
  hasOpenInvoiceOrigination: boolean;
}): OriginationKind {
  const kind = resolveOriginationKind(input);
  if (kind === "new_contract" && input.facilitySigned && input.hasOpenInvoiceOrigination) {
    return "existing_contract";
  }
  return kind;
}

export function isOfferAccepted(
  acceptanceStatus: string | null | undefined,
  signed: boolean
): boolean {
  if (signed) return true;
  const status = String(acceptanceStatus ?? "").toUpperCase();
  return (
    status === "PENDING_ADMIN_REVIEW" ||
    status === "APPROVED_FOR_SIGNING" ||
    status === "SIGNING_IN_PROGRESS" ||
    status === "COMPLETED"
  );
}

export function hasOpenInvoiceOrigination(
  invoices: readonly { status?: string | null }[]
): boolean {
  return invoices.some((invoice) => {
    const status = String(invoice.status ?? "").toUpperCase();
    return (
      status === "DRAFT" ||
      status === "SUBMITTED" ||
      status === "AMENDMENT_REQUESTED" ||
      status === "OFFER_SENT" ||
      status === "OFFER_EXPIRED"
    );
  });
}

export function originationBadgeFromInvoiceStatus(status: string): string {
  const key = String(status ?? "").toLowerCase();
  if (key === "amendment_requested") return "amendment_requested";
  if (key === "offer_sent" || key === "offer_expired") return "offer_sent";
  if (key === "approved") return "completed";
  if (key === "draft") return "draft";
  return "under_review";
}

export function shouldShowWhereThingsStandApplication(badgeKey: string): boolean {
  return isInFlightApplicationBadge(badgeKey);
}

export function resolveOriginationPipeline(input: {
  kind: OriginationKind;
  badgeKey: string;
  offerAccepted: boolean;
  signed: boolean;
}): { steps: readonly string[]; currentIndex: number } {
  const steps = originationStepsFor(input.kind);
  const key = input.badgeKey.toLowerCase();
  if (key === "draft") {
    return { steps, currentIndex: 0 };
  }
  if (input.kind === "existing_contract") {
    if (key === "completed" || input.offerAccepted) return { steps, currentIndex: steps.length };
    if (key === "offer_sent") return { steps, currentIndex: 2 };
    if (key === "amendment_requested") return { steps, currentIndex: 1 };
    return { steps, currentIndex: 1 };
  }
  if (input.signed) {
    return { steps, currentIndex: steps.length };
  }
  if (input.offerAccepted) {
    return { steps, currentIndex: 3 };
  }
  if (key === "offer_sent" || key === "amendment_requested") {
    return { steps, currentIndex: 2 };
  }
  return { steps, currentIndex: 1 };
}

export function resolveNotePipeline(status: "pending_listing" | "open" | "funded" | "failed"): {
  steps: readonly string[];
  currentIndex: number;
  failed: boolean;
} {
  const steps = NOTE_PIPELINE_STEPS;
  if (status === "failed") return { steps, currentIndex: 1, failed: true };
  if (status === "funded") return { steps, currentIndex: 2, failed: false };
  if (status === "open") return { steps, currentIndex: 1, failed: false };
  return { steps, currentIndex: 0, failed: false };
}

export function pipelineStepStates(
  stepCount: number,
  currentIndex: number,
  failed = false,
  failedIndex = 1
): PipelineStepState[] {
  return Array.from({ length: stepCount }, (_, index) => {
    if (failed && index === failedIndex) return "failed";
    if (failed && index > failedIndex) return "upcoming";
    if (currentIndex >= stepCount) return "done";
    if (index < currentIndex) return "done";
    if (index === currentIndex) return failed ? "failed" : "current";
    return "upcoming";
  });
}

export function pipelineStepLabel(
  step: string,
  state: PipelineStepState,
  yourTurn = false
): string {
  if (step === "Funding in progress" && state === "failed") return "Funding unsuccessful";
  if (state === "done") {
    if (step === "Pending listing") return "Listed";
    if (step === "Funding in progress") return "Funded";
    return step;
  }
  if (step === "Submitted") return "Submit";
  if (step === "Reviewed") {
    if (state === "current") return yourTurn ? "Make changes" : "Under review";
    return "Review";
  }
  if (step === "Offer accepted") return "Accept offer";
  if (step === "Facility signed") return "Sign facility";
  if (step === "Offer signed") return "Sign offer";
  if (step === "Pending listing") return "Awaiting listing";
  if (step === "Funding in progress") return "Raising funds";
  if (step === "Funds disbursed") return "Awaiting disbursement";
  return step;
}

export type WhereThingsStandItem<TApp, TInvoice> =
  | { kind: "application"; item: TApp }
  | { kind: "invoice"; item: TInvoice };

export function orderWhereThingsStandItems<TApp, TInvoice>(input: {
  yourTurnApps: readonly TApp[];
  waitingApps: readonly TApp[];
  extraInvoices: readonly TInvoice[];
}): WhereThingsStandItem<TApp, TInvoice>[] {
  return [
    ...input.yourTurnApps.map((item) => ({ kind: "application" as const, item })),
    ...input.extraInvoices.map((item) => ({ kind: "invoice" as const, item })),
    ...input.waitingApps.map((item) => ({ kind: "application" as const, item })),
  ];
}

export function takeDashboardPreview<T>(
  items: readonly T[],
  limit = DASHBOARD_LIST_PAGE_SIZE
): { visible: T[]; hiddenCount: number } {
  const visible = items.slice(0, limit);
  return { visible, hiddenCount: Math.max(0, items.length - visible.length) };
}

export function nextDashboardVisibleCount(
  currentVisible: number,
  total: number,
  pageSize = DASHBOARD_LIST_PAGE_SIZE
): number {
  return Math.min(total, currentVisible + pageSize);
}
