"use client";

import * as React from "react";
import {
  formatCurrency,
  invoiceAmountFromFaceAndRatio,
  invoiceOfferExceedsRequested,
  resolveOfferedAmount,
  resolveOfferedProfitRate,
  resolveOfferedPlatformFeeRatePercent,
  resolveRequestedInvoiceAmount,
  maturityMeetsMinimumMonthsFrom,
  parseInvoiceMaturityDate,
} from "@cashsouk/config";
import {
  FINANCING_TENURE_DAYS_OPTIONS,
  formatFinancingTenureDaysLabel,
  formatInvoiceReference,
  getOfferPhaseDeadlineDisplay,
  isReservedCapacityInvoiceStatus,
  isSoukscoreRiskRating,
  isValidFinancingTenureDays,
  parseFinancingTenureDays,
  previewAcceptanceDeadlineFromWorkflow,
  resolveFinancingTenureDays,
  SOUKSCORE_RISK_RATING_GRADES,
  validateFinancingTenureAgainstDueDate,
  type SoukscoreRiskRating,
} from "@cashsouk/types";
import { useQueryClient } from "@tanstack/react-query";
import { applicationsKeys } from "@/applications/query-keys";
import {
  invoiceOfferFacilityFeeCollectEnabled,
  invoiceOfferConfirmUiBlocked,
  invoiceOfferFeeFingerprint,
  parseInvoiceOfferFeeEditorState,
  resolveDrawdownFeeRateForSend,
  resolveInvoiceOfferConfirmGuard,
  resolveInvoiceOfferConfirmRefreshStart,
  resolveInvoiceOfferConfirmUiMessage,
  resolveInvoiceOfferFacilityFeeRemaining,
  toSendInvoiceOfferFeeFields,
  utilisationFeeSendBlockedReason,
  convertGrandfatherOfferToCurrentV1,
  clampOfferPlatformFeePercent,
  type InvoiceOfferConfirmRefreshStatus,
  type InvoiceOfferFeeEditorState,
  type SendInvoiceOfferUiPayload,
} from "@/components/utilisation-fee-lines";
import {
  FacilityFeeCollectOfferRows,
  InvoiceOfferFeeConfirmRows,
  InvoiceOfferFeeScheduleSection,
} from "@/components/utilisation-fee-lines-editor";
import { resolveInvoiceOfferDisable } from "@/lib/facility-capacity-display";
import { cn } from "@/lib/utils";
import { OfferAcceptanceDeadlineConfirmRows } from "@/components/application-review/offer-acceptance-deadline-confirm-rows";
import { ReviewFieldLabel } from "@/components/application-review/review-field-label";
import { REVIEW_EMPTY_LABEL, reviewLabelClass, reviewRowGridClass, reviewValueClass } from "@/components/application-review/review-section-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@cashsouk/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PROFIT_RATE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

const OFFER_CONTROL_WIDTH_CLASS =
  "h-9 w-full min-w-[5.5rem] max-w-[7rem] rounded-xl border-border bg-background text-ui";

const TENURE_CONTROL_WIDTH_CLASS =
  "h-9 w-full min-w-[7rem] max-w-[9.5rem] rounded-xl border-border bg-background text-ui";

const FINANCING_TENURE_TOOLTIP =
  "How long the issuer has after disbursement to repay. It must cover the time until the customer is due to pay this invoice.";

type OfferedState = { ratio: number; profitRate: number; platformFeeRatePercent: number };

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface InvoiceOfferPanelInvoice {
  id: string;
  displayReference?: string | null;
  details?: unknown;
  status?: string;
  offer_details?: unknown;
  contract_id?: string | null;
  facilityFeeAvailableToReserve?: number | null;
}

export interface InvoiceOfferPanelProps {
  invoice: InvoiceOfferPanelInvoice;
  /** Live application id — used to refetch remaining before Confirm & Send. */
  applicationId?: string;
  reviewItemStatus: string;
  isRowGreyedOut: boolean;
  isAdminRejected: boolean;
  invoiceRatioLimits: { min: number; max: number };
  platformFeeRateCapPercent?: number | null;
  minMonthsReviewToMaturityForOffer?: number | null;
  productWorkflow?: unknown;
  onSendInvoiceOffer?: (payload: SendInvoiceOfferUiPayload) => Promise<void>;
  isSendInvoiceOfferPending?: boolean;
  onResetItemToPending?: (itemId: string) => void;
  isItemActionPending: boolean;
  remainingAvailableFacility?: number;
  remainingAllocation?: number;
  facilityOverLimit?: boolean;
  scopeKey: string;
}

export function InvoiceOfferPanel({
  invoice,
  applicationId,
  reviewItemStatus,
  isRowGreyedOut,
  isAdminRejected,
  invoiceRatioLimits,
  platformFeeRateCapPercent,
  minMonthsReviewToMaturityForOffer,
  productWorkflow,
  onSendInvoiceOffer,
  isSendInvoiceOfferPending,
  onResetItemToPending,
  isItemActionPending,
  remainingAvailableFacility,
  remainingAllocation,
  facilityOverLimit,
  scopeKey,
}: InvoiceOfferPanelProps) {
  const queryClient = useQueryClient();
  const facilityFeeRemaining = resolveInvoiceOfferFacilityFeeRemaining(invoice);
  const collectEnabled = invoiceOfferFacilityFeeCollectEnabled(invoice);
  const details = invoice.details as
    | {
        number?: string | number;
        value?: string | number;
        financing_ratio_percent?: string | number;
        financing_tenure_days?: number | string;
        maturity_date?: string;
        due_date?: string;
      }
    | undefined;
  const businessNumber =
    details?.number != null && String(details.number).trim() !== ""
      ? String(details.number).trim()
      : null;
  const invoiceNo =
    businessNumber ??
    formatInvoiceReference({
      displayReference: invoice.displayReference,
      id: invoice.id,
    });
  const invoiceValue = toNumber(details?.value);
  const financingRatio = toNumber(details?.financing_ratio_percent);
  const issuerFinancingAmount = resolveRequestedInvoiceAmount(
    invoice.details as Record<string, unknown>
  );
  const maturityDate = details?.maturity_date ?? details?.due_date;
  const issuerTenureDays = resolveFinancingTenureDays(null, invoice.details);
  const status = reviewItemStatus;
  const isOfferSent = status === "OFFER_SENT";
  const hasOfferSnapshot = status === "OFFER_SENT" || status === "OFFER_EXPIRED";
  const acceptanceDeadlinePreview = previewAcceptanceDeadlineFromWorkflow(productWorkflow);
  const platformFeeCap = React.useMemo(() => {
    const cap = platformFeeRateCapPercent ?? 3;
    return Number.isFinite(cap) && cap >= 0 ? Math.round(cap * 100) / 100 : 3;
  }, [platformFeeRateCapPercent]);

  const initialOffered = React.useMemo(() => {
    const offer = invoice.offer_details as
      | { offered_ratio_percent?: number; offered_profit_rate_percent?: number }
      | null
      | undefined;
    const ratio =
      typeof offer?.offered_ratio_percent === "number" && Number.isFinite(offer.offered_ratio_percent)
        ? Math.max(invoiceRatioLimits.min, Math.min(invoiceRatioLimits.max, offer.offered_ratio_percent))
        : financingRatio != null
          ? Math.max(invoiceRatioLimits.min, Math.min(invoiceRatioLimits.max, financingRatio))
          : invoiceRatioLimits.min;
    const profitRate =
      typeof offer?.offered_profit_rate_percent === "number" &&
      Number.isFinite(offer.offered_profit_rate_percent) &&
      (PROFIT_RATE_OPTIONS as readonly number[]).includes(offer.offered_profit_rate_percent)
        ? offer.offered_profit_rate_percent
        : 12;
    const platformFeeRatePercent = clampOfferPlatformFeePercent(
      resolveOfferedPlatformFeeRatePercent(invoice.offer_details as Record<string, unknown>),
      0,
      platformFeeCap
    );
    return { ratio, profitRate, platformFeeRatePercent };
  }, [invoice.offer_details, invoiceRatioLimits, financingRatio, platformFeeCap]);

  const [offered, setOfferedState] = React.useState<OfferedState>(initialOffered);
  React.useEffect(() => {
    setOfferedState(initialOffered);
  }, [initialOffered]);

  const setOffered = React.useCallback((updates: Partial<OfferedState>) => {
    setOfferedState((prev) => ({ ...prev, ...updates }));
  }, []);

  const initialRisk = React.useMemo(() => {
    const raw = (invoice.offer_details as Record<string, unknown> | null)?.risk_rating;
    return isSoukscoreRiskRating(raw) ? raw : null;
  }, [invoice.offer_details]);
  const [riskRating, setRiskRating] = React.useState<SoukscoreRiskRating | null>(initialRisk);
  React.useEffect(() => {
    setRiskRating(initialRisk);
  }, [initialRisk]);

  const initialTenureDays = React.useMemo(() => {
    const fromOffer = parseFinancingTenureDays(
      (invoice.offer_details as { financing_tenure_days?: unknown } | null)?.financing_tenure_days
    );
    if (fromOffer != null && isValidFinancingTenureDays(fromOffer)) return fromOffer;
    return issuerTenureDays;
  }, [invoice.offer_details, issuerTenureDays]);
  const [financingTenureDays, setFinancingTenureDays] = React.useState<number | null>(initialTenureDays);
  React.useEffect(() => {
    setFinancingTenureDays(initialTenureDays);
  }, [initialTenureDays]);

  const [financingRatioDraft, setFinancingRatioDraft] = React.useState<string | undefined>(undefined);
  const [financingRatioSliderOpen, setFinancingRatioSliderOpen] = React.useState(false);
  const [platformFeeDraft, setPlatformFeeDraft] = React.useState<string | undefined>(undefined);
  const financingRatioPanelRef = React.useRef<HTMLDivElement | null>(null);
  const feeFingerprint = invoiceOfferFeeFingerprint(invoice.offer_details);
  const feeFingerprintRef = React.useRef(feeFingerprint);
  const [feeEditor, setFeeEditor] = React.useState<InvoiceOfferFeeEditorState>(() =>
    parseInvoiceOfferFeeEditorState(invoice.offer_details)
  );
  React.useEffect(() => {
    if (feeFingerprintRef.current === feeFingerprint) return;
    feeFingerprintRef.current = feeFingerprint;
    setFeeEditor(parseInvoiceOfferFeeEditorState(invoice.offer_details));
  }, [feeFingerprint, invoice.offer_details]);

  const [invoiceOfferConfirm, setInvoiceOfferConfirm] = React.useState<{
    invoiceId: string;
    invoiceNo: string | number;
    offeredAmount: number;
    offeredRatioPercent: number;
    offeredProfitRatePercent: number;
    platformFeeRatePercent: number;
    feeScheduleMode: SendInvoiceOfferUiPayload["feeScheduleMode"];
    facilityFeeCollectAmount: number;
    additionalFees: SendInvoiceOfferUiPayload["additionalFees"];
    invoiceValue: number | null;
    risk_rating: SoukscoreRiskRating;
    financingTenureDays: number;
    offerFingerprint: string;
  } | null>(null);

  React.useEffect(() => {
    if (!financingRatioSliderOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (financingRatioPanelRef.current && !financingRatioPanelRef.current.contains(e.target as Node)) {
        setFinancingRatioSliderOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [financingRatioSliderOpen]);

  const offerDetails = invoice.offer_details as
    | { offered_amount?: number; offered_ratio_percent?: number; offered_profit_rate_percent?: number }
    | null
    | undefined;
  const offeredAmount = hasOfferSnapshot
    ? resolveOfferedAmount(offerDetails) || null
    : invoiceValue !== null
      ? invoiceAmountFromFaceAndRatio(invoiceValue, offered.ratio)
      : null;
  const offeredRatio = hasOfferSnapshot
    ? typeof offerDetails?.offered_ratio_percent === "number" && Number.isFinite(offerDetails.offered_ratio_percent)
      ? offerDetails.offered_ratio_percent
      : offeredAmount !== null && invoiceValue !== null && invoiceValue > 0
        ? Math.round((offeredAmount / invoiceValue) * 100)
        : offered.ratio
    : offered.ratio;
  const offeredProfitRate = hasOfferSnapshot
    ? resolveOfferedProfitRate(offerDetails) ?? offered.profitRate
    : offered.profitRate;
  const offeredPlatformFeePercent = hasOfferSnapshot
    ? resolveOfferedPlatformFeeRatePercent(invoice.offer_details as Record<string, unknown>)
    : offered.platformFeeRatePercent;
  const phaseDeadlineDisplay = hasOfferSnapshot ? getOfferPhaseDeadlineDisplay(invoice.offer_details) : null;
  const reviewDay = new Date();
  reviewDay.setHours(0, 0, 0, 0);
  const maturityParsedForOffer = parseInvoiceMaturityDate(
    typeof maturityDate === "string" ? maturityDate : undefined
  );
  const tenureValidation = validateFinancingTenureAgainstDueDate({
    tenureDays: financingTenureDays,
    maturityDate: typeof maturityDate === "string" ? maturityDate : undefined,
  });
  const sendOfferBlockedByTenure = !isOfferSent && !tenureValidation.ok;
  const sendOfferBlockedByMaturity =
    !isOfferSent &&
    typeof minMonthsReviewToMaturityForOffer === "number" &&
    minMonthsReviewToMaturityForOffer > 0 &&
    (maturityParsedForOffer === null ||
      !maturityMeetsMinimumMonthsFrom(
        maturityParsedForOffer,
        reviewDay,
        minMonthsReviewToMaturityForOffer
      ));
  const exceedsIssuerRequest = invoiceOfferExceedsRequested(offeredAmount, issuerFinancingAmount);
  const reservedInvoice = isReservedCapacityInvoiceStatus(invoice.status);
  const offerDisable = resolveInvoiceOfferDisable({
    isAdminRejected,
    sendOfferBlockedByMaturity,
    offeredAmount,
    invoiceFace: invoiceValue,
    hasRiskRating: Boolean(riskRating),
    remainingCredit: remainingAvailableFacility,
    remainingAllocation,
    invoiceStatus: invoice.status,
    addBackFinancing: reservedInvoice ? (issuerFinancingAmount ?? 0) : 0,
    addBackFace: reservedInvoice ? (invoiceValue ?? 0) : 0,
    facilityOverLimit,
  });
  const drawdownFeeRateForSend = hasOfferSnapshot
    ? offeredPlatformFeePercent
    : resolveDrawdownFeeRateForSend({
        committedPercent: offered.platformFeeRatePercent,
        draft: platformFeeDraft,
        capPercent: platformFeeCap,
      });
  const feeSendBlockedReason =
    offeredAmount != null
      ? utilisationFeeSendBlockedReason({
          offeredAmount,
          platformFeeRatePercent: drawdownFeeRateForSend,
          schedule:
            feeEditor.mode === "v1"
              ? feeEditor.schedule
              : { facilityFeeCollectAmount: 0, additionalFees: [] },
          facilityFeeRemaining,
          collectEnabled: feeEditor.mode === "v1" ? collectEnabled : false,
        })
      : null;

  const [confirmRefreshStatus, setConfirmRefreshStatus] =
    React.useState<InvoiceOfferConfirmRefreshStatus>("idle");
  const confirmRefreshSessionRef = React.useRef(0);

  const closeInvoiceOfferConfirm = React.useCallback(() => {
    confirmRefreshSessionRef.current += 1;
    setInvoiceOfferConfirm(null);
    setConfirmRefreshStatus("idle");
  }, []);

  const refreshConfirmApplication = React.useCallback(async () => {
    const session = ++confirmRefreshSessionRef.current;
    const startStatus = resolveInvoiceOfferConfirmRefreshStart(applicationId);
    setConfirmRefreshStatus(startStatus);
    if (startStatus === "failed" || !applicationId) {
      return;
    }
    try {
      await queryClient.refetchQueries(
        { queryKey: applicationsKeys.detail(applicationId) },
        { throwOnError: true }
      );
      if (confirmRefreshSessionRef.current === session) {
        setConfirmRefreshStatus("ready");
      }
    } catch {
      if (confirmRefreshSessionRef.current === session) {
        setConfirmRefreshStatus("failed");
      }
    }
  }, [applicationId, queryClient]);

  const invoiceOfferConfirmGuard = React.useMemo(() => {
    if (!invoiceOfferConfirm) return null;
    return resolveInvoiceOfferConfirmGuard({ confirm: invoiceOfferConfirm, invoice });
  }, [invoiceOfferConfirm, invoice]);
  const invoiceOfferConfirmFeeBlockedReason = resolveInvoiceOfferConfirmUiMessage({
    refreshStatus: confirmRefreshStatus,
    guard: invoiceOfferConfirmGuard,
  });
  const invoiceOfferConfirmBlocked = invoiceOfferConfirmUiBlocked({
    refreshStatus: confirmRefreshStatus,
    guard: invoiceOfferConfirmGuard,
  });

  React.useEffect(() => {
    if (invoiceOfferConfirmGuard?.fingerprintStale) {
      closeInvoiceOfferConfirm();
    }
  }, [invoiceOfferConfirmGuard, closeInvoiceOfferConfirm]);

  const handleConfirmInvoiceOffer = React.useCallback(async () => {
    if (!onSendInvoiceOffer || !invoiceOfferConfirm || !invoiceOfferConfirmGuard) return;
    if (!invoiceOfferConfirm.risk_rating) {
      alert("Please select a risk rating before sending the offer.");
      return;
    }
    if (offerDisable.disabled || invoiceOfferConfirmBlocked || !applicationId) {
      return;
    }
    await onSendInvoiceOffer({
      invoiceId: invoiceOfferConfirm.invoiceId,
      offeredAmount: invoiceOfferConfirm.offeredAmount,
      offeredRatioPercent: invoiceOfferConfirm.offeredRatioPercent,
      offeredProfitRatePercent: invoiceOfferConfirm.offeredProfitRatePercent,
      platformFeeRatePercent: invoiceOfferConfirm.platformFeeRatePercent,
      risk_rating: invoiceOfferConfirm.risk_rating,
      financingTenureDays: invoiceOfferConfirm.financingTenureDays,
      feeScheduleMode: invoiceOfferConfirm.feeScheduleMode,
      facilityFeeCollectAmount: invoiceOfferConfirm.facilityFeeCollectAmount,
      additionalFees: invoiceOfferConfirm.additionalFees,
    });
    closeInvoiceOfferConfirm();
  }, [
    onSendInvoiceOffer,
    invoiceOfferConfirm,
    invoiceOfferConfirmGuard,
    invoiceOfferConfirmBlocked,
    offerDisable.disabled,
    applicationId,
    closeInvoiceOfferConfirm,
  ]);

  const controlsDisabled = isRowGreyedOut || isAdminRejected;

  return (
    <div className="space-y-4">
      <div className={cn(reviewRowGridClass, "items-start")}>
        <Label className={reviewLabelClass}>Risk rating</Label>
        {isOfferSent ? (
          <div className={reviewValueClass}>
            {(() => {
              const raw = (invoice.offer_details as Record<string, unknown> | null)?.risk_rating;
              if (typeof raw === "string" && raw.trim()) return raw.trim();
              return riskRating ?? REVIEW_EMPTY_LABEL;
            })()}
          </div>
        ) : (
          <Select
            value={riskRating ?? undefined}
            onValueChange={(value) => {
              if (isSoukscoreRiskRating(value)) setRiskRating(value);
            }}
            disabled={controlsDisabled}
          >
            <SelectTrigger aria-label="Risk rating" className={OFFER_CONTROL_WIDTH_CLASS}>
              <SelectValue placeholder="Grade" />
            </SelectTrigger>
            <SelectContent>
              {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Label className={reviewLabelClass}>Profit rate</Label>
        {isOfferSent ? (
          <div className={reviewValueClass}>
            {offeredProfitRate != null ? `${offeredProfitRate}%` : REVIEW_EMPTY_LABEL}
          </div>
        ) : (
          <Select
            value={String(offered.profitRate)}
            onValueChange={(v) => setOffered({ profitRate: parseInt(v, 10) })}
            disabled={controlsDisabled}
          >
            <SelectTrigger className={OFFER_CONTROL_WIDTH_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {PROFIT_RATE_OPTIONS.map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {p}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="space-y-0.5">
          <ReviewFieldLabel tooltip={FINANCING_TENURE_TOOLTIP}>Financing tenure</ReviewFieldLabel>
          {!isOfferSent ? (
            <p className="text-meta text-muted-foreground">Starts on the actual disbursement date.</p>
          ) : null}
        </div>
        {isOfferSent ? (
          <div className={reviewValueClass}>
            {(() => {
              const frozen = resolveFinancingTenureDays(invoice.offer_details, invoice.details);
              return frozen != null ? formatFinancingTenureDaysLabel(frozen) : REVIEW_EMPTY_LABEL;
            })()}
          </div>
        ) : (
          <div className="space-y-1">
            <Select
              value={financingTenureDays != null ? String(financingTenureDays) : undefined}
              onValueChange={(value) => setFinancingTenureDays(Number(value))}
              disabled={controlsDisabled}
            >
              <SelectTrigger aria-label="Financing tenure" className={TENURE_CONTROL_WIDTH_CLASS}>
                <SelectValue placeholder="Select tenure" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {FINANCING_TENURE_DAYS_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {formatFinancingTenureDaysLabel(days)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sendOfferBlockedByTenure ? (
              <p role="alert" className="text-xs leading-snug text-destructive">
                {tenureValidation.ok ? "" : tenureValidation.message}
              </p>
            ) : null}
          </div>
        )}

        <div className="space-y-0.5">
          <Label className={reviewLabelClass}>Drawdown fee</Label>
          {!isOfferSent ? (
            <p className="text-meta text-muted-foreground tabular-nums">0–{platformFeeCap}%</p>
          ) : null}
        </div>
        {isOfferSent ? (
          <div className={reviewValueClass}>{offeredPlatformFeePercent}% at disbursement</div>
        ) : (
          <div className="flex w-full max-w-[7rem] items-center gap-1.5">
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label={`Drawdown fee percent, allowed 0% to ${platformFeeCap}%`}
              className={`${OFFER_CONTROL_WIDTH_CLASS} px-3 text-right tabular-nums shadow-sm`}
              disabled={controlsDisabled}
              value={platformFeeDraft !== undefined ? platformFeeDraft : String(offered.platformFeeRatePercent)}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || /^\d*\.?\d{0,2}$/.test(next)) setPlatformFeeDraft(next);
              }}
              onBlur={() => {
                const draft = platformFeeDraft;
                setPlatformFeeDraft(undefined);
                const fallback = offered.platformFeeRatePercent;
                const clamped = clampOfferPlatformFeePercent(
                  draft === undefined || draft === "" ? fallback : Number(draft.replace(/,/g, "")),
                  fallback,
                  platformFeeCap
                );
                setOffered({ platformFeeRatePercent: clamped });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <span className="shrink-0 text-ui text-muted-foreground">%</span>
          </div>
        )}

        <div className="space-y-0.5">
          <Label className={reviewLabelClass}>Offered financing ratio</Label>
          {!isOfferSent ? (
            <p className="text-meta text-muted-foreground tabular-nums">
              {invoiceRatioLimits.min}–{invoiceRatioLimits.max}%
            </p>
          ) : null}
        </div>
        {isOfferSent ? (
          <div className={cn(reviewValueClass, exceedsIssuerRequest && "text-destructive")}>
            {offeredRatio}%
          </div>
        ) : (
          <div ref={financingRatioPanelRef} className="w-full max-w-md">
            <div className="flex w-full max-w-[7rem] items-center gap-1.5">
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={`Financing ratio percent, allowed ${invoiceRatioLimits.min}% to ${invoiceRatioLimits.max}%`}
                className={`${OFFER_CONTROL_WIDTH_CLASS} px-3 text-right tabular-nums shadow-sm`}
                disabled={controlsDisabled}
                value={financingRatioDraft !== undefined ? financingRatioDraft : String(offered.ratio)}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "" || /^\d{0,3}$/.test(next)) setFinancingRatioDraft(next);
                }}
                onFocus={() => {
                  if (!controlsDisabled) setFinancingRatioSliderOpen(true);
                }}
                onBlur={() => {
                  const draft = financingRatioDraft;
                  setFinancingRatioDraft(undefined);
                  const fallback = offered.ratio;
                  const parsed = draft === undefined || draft === "" ? fallback : parseInt(draft, 10);
                  const clamped = Number.isFinite(parsed)
                    ? Math.min(invoiceRatioLimits.max, Math.max(invoiceRatioLimits.min, Math.round(parsed)))
                    : fallback;
                  setOffered({ ratio: clamped });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <span className="shrink-0 text-ui text-muted-foreground">%</span>
            </div>
            {financingRatioSliderOpen ? (
              <div className="mt-2 w-full" onPointerDown={(e) => e.preventDefault()}>
                <Slider
                  min={invoiceRatioLimits.min}
                  max={invoiceRatioLimits.max}
                  step={1}
                  value={[offered.ratio]}
                  onValueChange={(v) => {
                    setOffered({ ratio: v[0] });
                    setFinancingRatioDraft(undefined);
                  }}
                  disabled={controlsDisabled}
                  className="w-full"
                />
              </div>
            ) : null}
          </div>
        )}

        <Label className={reviewLabelClass}>Offered financing amount</Label>
        <div className="space-y-2 w-full max-w-md">
          <div
            className={cn(
              reviewValueClass,
              "w-full max-w-[11rem] tabular-nums",
              exceedsIssuerRequest && "text-destructive font-semibold"
            )}
          >
            {offeredAmount !== null ? formatCurrency(offeredAmount) : REVIEW_EMPTY_LABEL}
          </div>
          {!isOfferSent && exceedsIssuerRequest ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/35 bg-destructive/5 px-2.5 py-2 text-xs leading-snug text-destructive"
            >
              Exceeds what the issuer requested. Lower the ratio or other offer terms.
            </p>
          ) : null}
        </div>
        {feeEditor.mode === "v1" ? (
          <FacilityFeeCollectOfferRows
            idPrefix={`invoice-offer-${invoice.id}`}
            schedule={feeEditor.schedule}
            onChange={(schedule) => setFeeEditor({ mode: "v1", schedule })}
            facilityFeeRemaining={facilityFeeRemaining}
            collectEnabled={collectEnabled}
            disabled={controlsDisabled}
            readOnly={isOfferSent}
          />
        ) : null}
      </div>

      <InvoiceOfferFeeScheduleSection
        idPrefix={`invoice-offer-${invoice.id}`}
        editor={feeEditor}
        onChange={setFeeEditor}
        onConvertToCurrentV1={() => setFeeEditor(convertGrandfatherOfferToCurrentV1())}
        offeredAmount={offeredAmount}
        platformFeeRatePercent={drawdownFeeRateForSend}
        facilityFeeRemaining={facilityFeeRemaining}
        collectEnabled={collectEnabled}
        disabled={controlsDisabled}
        readOnly={isOfferSent}
        hideCollect
      />

      {!isOfferSent && onSendInvoiceOffer ? (
        isAdminRejected ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full rounded-xl bg-primary text-primary-foreground h-10 opacity-60 sm:w-auto"
              disabled
            >
              Send Offer
            </Button>
            <p className="text-sm text-destructive leading-snug">
              This invoice was rejected. Use Action → Set to pending, then you can send an offer.
            </p>
          </div>
        ) : sendOfferBlockedByMaturity ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full rounded-xl bg-primary text-primary-foreground h-10 opacity-60 sm:w-auto"
              disabled
            >
              Send Offer
            </Button>
            <p className="text-sm text-destructive leading-snug">
              Maturity date must be at least {minMonthsReviewToMaturityForOffer} month(s) after today to send
              an offer.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
          <Button
            type="button"
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 h-10"
            disabled={
              isRowGreyedOut ||
              !!isSendInvoiceOfferPending ||
              offerDisable.disabled ||
              Boolean(feeSendBlockedReason) ||
              sendOfferBlockedByTenure ||
              financingTenureDays == null
            }
            onClick={() => {
              if (offerDisable.disabled || feeSendBlockedReason || sendOfferBlockedByTenure) return;
              if (financingTenureDays == null || !isValidFinancingTenureDays(financingTenureDays)) {
                return;
              }
              const rr = riskRating;
              if (!rr) {
                alert("Please select a risk rating before sending the offer.");
                return;
              }
              const platformFeeRatePercent = resolveDrawdownFeeRateForSend({
                committedPercent: offered.platformFeeRatePercent,
                draft: platformFeeDraft,
                capPercent: platformFeeCap,
              });
              if (platformFeeDraft !== undefined) {
                setPlatformFeeDraft(undefined);
              }
              if (platformFeeRatePercent !== offered.platformFeeRatePercent) {
                setOffered({ platformFeeRatePercent });
              }
              setInvoiceOfferConfirm({
                invoiceId: invoice.id,
                invoiceNo,
                offeredAmount: offeredAmount ?? 0,
                offeredRatioPercent: offered.ratio,
                offeredProfitRatePercent: offered.profitRate,
                platformFeeRatePercent,
                ...toSendInvoiceOfferFeeFields(feeEditor),
                invoiceValue,
                risk_rating: rr,
                financingTenureDays,
                offerFingerprint: feeFingerprint,
              });
              void refreshConfirmApplication();
            }}
          >
            {isSendInvoiceOfferPending ? "Sending..." : "Send Offer"}
          </Button>
          {offerDisable.message &&
          offerDisable.reason !== "rejected" &&
          offerDisable.reason !== "maturity" &&
          offerDisable.reason !== "missing_risk" &&
          offerDisable.reason !== "missing_amount" ? (
            <p role="alert" className="text-sm leading-snug text-destructive">
              {offerDisable.message}
            </p>
          ) : feeSendBlockedReason ? (
            <p role="alert" className="text-sm leading-snug text-destructive">
              {feeSendBlockedReason}
            </p>
          ) : null}
          </div>
        )
      ) : null}

      {phaseDeadlineDisplay ? (
        <p
          className={cn(
            "text-xs tabular-nums",
            phaseDeadlineDisplay.urgency === "past"
              ? "font-medium text-destructive"
              : phaseDeadlineDisplay.urgency === "soon"
                ? "font-medium text-amber-800"
                : "text-muted-foreground"
          )}
        >
          {phaseDeadlineDisplay.summary}
        </p>
      ) : null}

      {isOfferSent && onResetItemToPending ? (
        <Button
          type="button"
          variant="outline"
          className="rounded-xl h-10"
          disabled={isRowGreyedOut || isItemActionPending}
          onClick={() => onResetItemToPending(scopeKey)}
        >
          {isItemActionPending ? "Retracting..." : "Retract Offer"}
        </Button>
      ) : null}

      <Dialog open={!!invoiceOfferConfirm} onOpenChange={(open) => !open && closeInvoiceOfferConfirm()}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Confirm Invoice Offer
              {invoiceOfferConfirm && ` — Invoice ${invoiceOfferConfirm.invoiceNo}`}
            </DialogTitle>
            <DialogDescription>
              Review the offer details below before sending to the issuer.
            </DialogDescription>
          </DialogHeader>
          {invoiceOfferConfirm ? (
            <>
              <div className="grid gap-3 py-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Invoice Number</span>
                  <span className="text-ui font-medium">{invoiceOfferConfirm.invoiceNo}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Invoice Value</span>
                  <span className="text-ui font-medium tabular-nums">
                    {invoiceOfferConfirm.invoiceValue !== null
                      ? formatCurrency(invoiceOfferConfirm.invoiceValue)
                      : REVIEW_EMPTY_LABEL}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Financing Amount</span>
                  <span className="text-ui font-medium tabular-nums">
                    {formatCurrency(invoiceOfferConfirm.offeredAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Financing Ratio</span>
                  <span className="text-ui font-medium tabular-nums">
                    {invoiceOfferConfirm.offeredRatioPercent}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Profit Rate</span>
                  <span className="text-ui font-medium tabular-nums">
                    {invoiceOfferConfirm.offeredProfitRatePercent}%
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Financing tenure</span>
                  <span className="text-ui font-medium tabular-nums">
                    {formatFinancingTenureDaysLabel(invoiceOfferConfirm.financingTenureDays)}
                  </span>
                </div>
                <InvoiceOfferFeeConfirmRows
                  offeredAmount={invoiceOfferConfirm.offeredAmount}
                  platformFeeRatePercent={invoiceOfferConfirm.platformFeeRatePercent}
                  feeScheduleMode={invoiceOfferConfirm.feeScheduleMode}
                  facilityFeeCollectAmount={invoiceOfferConfirm.facilityFeeCollectAmount}
                  additionalFees={invoiceOfferConfirm.additionalFees}
                  liveFacilityFee={{
                    remaining: invoiceOfferConfirmGuard?.facilityFeeRemaining,
                    collectEnabled: invoiceOfferConfirmGuard?.collectEnabled ?? false,
                  }}
                />
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium text-muted-foreground">Risk Rating</span>
                  <span className="text-ui font-medium tabular-nums">
                    {invoiceOfferConfirm.risk_rating}
                  </span>
                </div>
                {acceptanceDeadlinePreview ? (
                  <OfferAcceptanceDeadlineConfirmRows
                    preview={acceptanceDeadlinePreview}
                    labelClassName="text-sm font-medium text-muted-foreground"
                    valueClassName="text-ui font-medium"
                  />
                ) : null}
                {invoiceOfferConfirmFeeBlockedReason ? (
                  <p
                    role={confirmRefreshStatus === "pending" ? "status" : "alert"}
                    className={cn(
                      "rounded-xl border border-border bg-muted/20 px-3 py-2 text-ui",
                      confirmRefreshStatus === "pending" ? "text-muted-foreground" : "text-destructive"
                    )}
                  >
                    {invoiceOfferConfirmFeeBlockedReason}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={closeInvoiceOfferConfirm} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmInvoiceOffer}
                  disabled={
                    !!isSendInvoiceOfferPending ||
                    offerDisable.disabled ||
                    invoiceOfferConfirmBlocked
                  }
                  className="rounded-xl"
                >
                  {isSendInvoiceOfferPending ? "Sending..." : "Confirm & Send Offer"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
