"use client";

import * as React from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  ADDITIONAL_FEE_KINDS,
  FEE_SCHEDULE_MAX_ADDITIONAL_LINES,
  FEE_SCHEDULE_MAX_NAME_LENGTH,
  type AdditionalFeeKind,
  type AdditionalFeeLine,
  type InvoiceOfferFeeScheduleWriteMode,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { reviewRowGridClass } from "@/components/application-review/review-section-styles";
import {
  additionalFeeKindLabel,
  ADDITIONAL_FEES_SECTION_TOOLTIP,
  CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL,
  emptyAdditionalFeeLine,
  FACILITY_FEE_COLLECT_NONE_LEFT_MESSAGE,
  FACILITY_FEE_COLLECT_NOW_TOOLTIP,
  GRANDFATHER_OFFER_FEE_CALLOUT,
  GRANDFATHER_OFFER_FEE_CONFIRMATION,
  remainingFacilityFeeAfterCollect,
  summariseUtilisationFees,
  utilisationFeeScheduleIssues,
  type InvoiceOfferConfirmLiveFacilityFee,
  type InvoiceOfferFeeEditorState,
  type UtilisationFeeScheduleState,
  type UtilisationFeeThresholdTotals,
} from "./utilisation-fee-lines";
import { ReviewFieldLabel, ReviewInfoTooltip } from "@/components/application-review/review-field-label";

const MONEY_DRAFT = /^\d*\.?\d{0,2}$/;

function kindFromValue(value: string): AdditionalFeeKind {
  return value === "percent_of_funded" ? "percent_of_funded" : "amount";
}

function UtilisationFeeTotalsColumn({
  title,
  totals,
  exceeds,
  showFacilityFee,
}: {
  title: string;
  totals: UtilisationFeeThresholdTotals["full"];
  exceeds: boolean;
  showFacilityFee: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-xl border px-3 py-2.5",
        exceeds ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20"
      )}
    >
      <p className="text-meta font-medium text-muted-foreground">{title}</p>
      <dl className="space-y-1 text-ui">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Drawdown fee</dt>
          <dd className="tabular-nums">{formatCurrency(totals.drawdownFee)}</dd>
        </div>
        {showFacilityFee ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Facility fee</dt>
            <dd className="tabular-nums">{formatCurrency(totals.facilityFee)}</dd>
          </div>
        ) : null}
        {totals.additionalFeeCharges.map((line) => (
          <div key={`${line.name}-${line.kind}`} className="flex justify-between gap-3">
            <dt className="min-w-0 truncate text-muted-foreground">{line.name || "Unnamed fee"}</dt>
            <dd className="shrink-0 tabular-nums">{formatCurrency(line.chargedAmount)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border/60 pt-1.5 font-medium">
          <dt>Total fees</dt>
          <dd className="tabular-nums">{formatCurrency(totals.totalFees)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Net to issuer</dt>
          <dd className={cn("tabular-nums", exceeds && "text-destructive")}>
            {formatCurrency(totals.net)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function UtilisationFeeTotalsSummary({
  offeredAmount,
  platformFeeRatePercent,
  schedule,
  facilityFeeRemaining,
  facilityFeeCollectionWaived,
  collectEnabled = true,
  className,
}: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  schedule: UtilisationFeeScheduleState;
  facilityFeeRemaining?: number;
  facilityFeeCollectionWaived?: boolean;
  collectEnabled?: boolean;
  className?: string;
}) {
  const totals = summariseUtilisationFees({
    offeredAmount,
    platformFeeRatePercent,
    schedule,
    facilityFeeRemaining,
    facilityFeeCollectionWaived,
  });
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">Fee totals</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <UtilisationFeeTotalsColumn
          title="At full funding"
          totals={totals.full}
          exceeds={totals.exceedsAtFull}
          showFacilityFee={collectEnabled}
        />
        <UtilisationFeeTotalsColumn
          title={`At ${totals.minimumPercent}% minimum`}
          totals={totals.minimum}
          exceeds={totals.exceedsAtMinimum}
          showFacilityFee={collectEnabled}
        />
      </div>
      {totals.exceedsAtFull || totals.exceedsAtMinimum ? (
        <p role="alert" className="text-sm leading-snug text-destructive">
          {totals.exceedsAtFull
            ? "Fees cannot exceed the offered amount at full funding."
            : `Fees exceed the note amount at the ${totals.minimumPercent}% minimum funding threshold.`}
        </p>
      ) : null}
    </div>
  );
}

export interface UtilisationFeeLinesEditorProps {
  idPrefix: string;
  schedule: UtilisationFeeScheduleState;
  onChange: (next: UtilisationFeeScheduleState) => void;
  offeredAmount: number | null;
  platformFeeRatePercent: number;
  facilityFeeRemaining?: number;
  collectEnabled?: boolean;
  facilityFeeCollectionWaived?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** When true, collect fields are omitted so the parent can place them in the offer grid. */
  hideCollect?: boolean;
}

export function FacilityFeeCollectOfferRows({
  idPrefix,
  schedule,
  onChange,
  facilityFeeRemaining,
  collectEnabled = true,
  facilityFeeCollectionWaived = false,
  disabled = false,
  readOnly = false,
}: Omit<UtilisationFeeLinesEditorProps, "offeredAmount" | "platformFeeRatePercent" | "hideCollect">) {
  const locked = disabled || readOnly;
  const [collectDraft, setCollectDraft] = React.useState<string | undefined>(undefined);
  const collectIssue = utilisationFeeScheduleIssues({
    schedule,
    facilityFeeRemaining,
    collectEnabled,
  }).find((issue) => issue.path === "facilityFeeCollectAmount");
  const leftoverAfterCollect = remainingFacilityFeeAfterCollect(
    facilityFeeRemaining,
    schedule.facilityFeeCollectAmount
  );
  const nothingLeftToCollect =
    !readOnly &&
    collectEnabled &&
    facilityFeeRemaining === 0 &&
    schedule.facilityFeeCollectAmount == null;

  const commitCollect = React.useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed === "") {
        onChange({ ...schedule, facilityFeeCollectAmount: null });
        return;
      }
      const parsed = Number(trimmed.replace(/,/g, ""));
      const amount = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : null;
      onChange({ ...schedule, facilityFeeCollectAmount: amount });
    },
    [onChange, schedule]
  );

  if (!collectEnabled) return null;

  return (
    <>
      <div className="space-y-0.5">
        <ReviewFieldLabel
          htmlFor={`${idPrefix}-facility-collect`}
          tooltip={FACILITY_FEE_COLLECT_NOW_TOOLTIP}
        >
          Facility fee to collect
        </ReviewFieldLabel>
        {facilityFeeRemaining != null ? (
          <p className="text-meta text-muted-foreground tabular-nums">
            Remaining {formatCurrency(Math.max(0, facilityFeeRemaining))}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {nothingLeftToCollect ? (
          <p className="text-ui text-muted-foreground">{FACILITY_FEE_COLLECT_NONE_LEFT_MESSAGE}</p>
        ) : readOnly ? (
          <p className={cn("min-h-9 text-ui tabular-nums")}>
            {formatCurrency(schedule.facilityFeeCollectAmount ?? 0)}
            {facilityFeeCollectionWaived ? " · collection waived on this note later" : ""}
          </p>
        ) : (
          <div className="flex w-full max-w-[11rem] items-center gap-1.5">
            <span className="shrink-0 text-ui text-muted-foreground">RM</span>
            <Input
              id={`${idPrefix}-facility-collect`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-label="Facility fee to collect from this invoice in ringgit"
              aria-invalid={Boolean(collectIssue)}
              disabled={locked}
              className="h-9 rounded-xl border-border bg-background text-right tabular-nums"
              value={
                collectDraft !== undefined
                  ? collectDraft
                  : schedule.facilityFeeCollectAmount == null
                    ? ""
                    : String(schedule.facilityFeeCollectAmount)
              }
              onChange={(event) => {
                const next = event.target.value;
                if (next === "" || MONEY_DRAFT.test(next)) setCollectDraft(next);
              }}
              onBlur={() => {
                const draft = collectDraft;
                setCollectDraft(undefined);
                if (draft !== undefined) commitCollect(draft);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") (event.target as HTMLInputElement).blur();
              }}
            />
          </div>
        )}
        {collectIssue ? (
          <p role="alert" className="text-sm text-destructive">
            {collectIssue.message}
          </p>
        ) : leftoverAfterCollect != null ? (
          <p className="text-meta text-muted-foreground">
            {leftoverAfterCollect > 0
              ? `${formatCurrency(leftoverAfterCollect)} left for later drawdowns.`
              : "This invoice collects the remaining facility fee."}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function UtilisationFeeLinesEditor({
  idPrefix,
  schedule,
  onChange,
  offeredAmount,
  platformFeeRatePercent,
  facilityFeeRemaining,
  collectEnabled = true,
  facilityFeeCollectionWaived = false,
  disabled = false,
  readOnly = false,
  hideCollect = false,
}: UtilisationFeeLinesEditorProps) {
  const locked = disabled || readOnly;
  const [valueDrafts, setValueDrafts] = React.useState<Record<number, string>>({});
  const issues = utilisationFeeScheduleIssues({
    schedule,
    facilityFeeRemaining,
    collectEnabled,
  });
  const canAdd = !locked && schedule.additionalFees.length < FEE_SCHEDULE_MAX_ADDITIONAL_LINES;

  const updateLine = React.useCallback(
    (index: number, patch: Partial<AdditionalFeeLine>) => {
      onChange({
        ...schedule,
        additionalFees: schedule.additionalFees.map((line, i) =>
          i === index ? { ...line, ...patch } : line
        ),
      });
    },
    [onChange, schedule]
  );

  return (
    <div className="space-y-4">
      {hideCollect || !collectEnabled ? null : (
        <div className={cn(reviewRowGridClass, "items-start")}>
          <FacilityFeeCollectOfferRows
            idPrefix={idPrefix}
            schedule={schedule}
            onChange={onChange}
            facilityFeeRemaining={facilityFeeRemaining}
            collectEnabled={collectEnabled}
            facilityFeeCollectionWaived={facilityFeeCollectionWaived}
            disabled={disabled}
            readOnly={readOnly}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-foreground">Additional fees</p>
            <ReviewInfoTooltip
              label="Additional fees"
              tooltip={ADDITIONAL_FEES_SECTION_TOOLTIP}
            />
          </div>
          {readOnly ? null : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              disabled={!canAdd}
              onClick={() =>
                onChange({
                  ...schedule,
                  additionalFees: [...schedule.additionalFees, emptyAdditionalFeeLine()],
                })
              }
            >
              <PlusIcon className="h-4 w-4" aria-hidden />
              Add fee line
            </Button>
          )}
        </div>
        {schedule.additionalFees.length === 0 ? (
          readOnly ? (
            <p className="text-meta text-muted-foreground">None</p>
          ) : null
        ) : (
          <ul className="space-y-3">
            {schedule.additionalFees.map((line, index) => {
              const nameId = `${idPrefix}-fee-name-${index}`;
              const kindId = `${idPrefix}-fee-kind-${index}`;
              const valueId = `${idPrefix}-fee-value-${index}`;
              const nameIssue = issues.find((issue) => issue.path === `additionalFees.${index}.name`);
              const valueIssue = issues.find(
                (issue) => issue.path === `additionalFees.${index}.value`
              );
              return (
                <li
                  key={`${idPrefix}-line-${index}`}
                  className="space-y-3 rounded-xl border border-border p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_8rem_auto] lg:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor={nameId}>Fee name</Label>
                      {readOnly ? (
                        <p className="min-h-9 text-ui">{line.name || "—"}</p>
                      ) : (
                        <Input
                          id={nameId}
                          value={line.name}
                          maxLength={FEE_SCHEDULE_MAX_NAME_LENGTH}
                          disabled={locked}
                          aria-invalid={Boolean(nameIssue)}
                          onChange={(event) => updateLine(index, { name: event.target.value })}
                          onBlur={() => updateLine(index, { name: line.name.trim() })}
                        />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={kindId}>Kind</Label>
                      {readOnly ? (
                        <p className="min-h-9 text-ui">{additionalFeeKindLabel(line.kind)}</p>
                      ) : (
                        <Select
                          value={line.kind}
                          onValueChange={(value) => updateLine(index, { kind: kindFromValue(value) })}
                          disabled={locked}
                        >
                          <SelectTrigger id={kindId} aria-label={`Fee kind for ${line.name || `line ${index + 1}`}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ADDITIONAL_FEE_KINDS.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {additionalFeeKindLabel(kind)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={valueId}>
                        {line.kind === "percent_of_funded" ? "Percent" : "Amount"}
                      </Label>
                      {readOnly ? (
                        <p className="min-h-9 text-ui tabular-nums">
                          {line.kind === "percent_of_funded"
                            ? `${line.value}%`
                            : formatCurrency(line.value)}
                        </p>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input
                            id={valueId}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={locked}
                            aria-invalid={Boolean(valueIssue)}
                            className="text-right tabular-nums"
                            value={
                              valueDrafts[index] !== undefined
                                ? valueDrafts[index]
                                : String(line.value)
                            }
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next === "" || MONEY_DRAFT.test(next)) {
                                setValueDrafts((prev) => ({ ...prev, [index]: next }));
                              }
                            }}
                            onBlur={() => {
                              const draft = valueDrafts[index];
                              setValueDrafts((prev) => {
                                const next = { ...prev };
                                delete next[index];
                                return next;
                              });
                              const raw = draft ?? String(line.value);
                              const parsed = raw.trim() === "" ? 0 : Number(raw.replace(/,/g, ""));
                              const value = Number.isFinite(parsed)
                                ? Math.max(0, Math.round(parsed * 100) / 100)
                                : 0;
                              updateLine(index, { value });
                            }}
                          />
                          <span className="shrink-0 text-ui text-muted-foreground">
                            {line.kind === "percent_of_funded" ? "%" : "RM"}
                          </span>
                        </div>
                      )}
                    </div>
                    {readOnly ? null : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        aria-label={`Remove ${line.name || `fee line ${index + 1}`}`}
                        disabled={locked}
                        onClick={() =>
                          onChange({
                            ...schedule,
                            additionalFees: schedule.additionalFees.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <TrashIcon className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                  {nameIssue || valueIssue ? (
                    <p role="alert" className="text-sm text-destructive">
                      {nameIssue?.message ?? valueIssue?.message}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {offeredAmount != null && offeredAmount > 0 ? (
        <UtilisationFeeTotalsSummary
          offeredAmount={offeredAmount}
          platformFeeRatePercent={platformFeeRatePercent}
          schedule={schedule}
          facilityFeeRemaining={facilityFeeRemaining}
          facilityFeeCollectionWaived={facilityFeeCollectionWaived}
          collectEnabled={collectEnabled}
        />
      ) : null}
    </div>
  );
}

export function InvoiceOfferFeeScheduleSection({
  editor,
  onChange,
  onConvertToCurrentV1,
  ...editorProps
}: Omit<UtilisationFeeLinesEditorProps, "schedule" | "onChange"> & {
  editor: InvoiceOfferFeeEditorState;
  onChange: (next: InvoiceOfferFeeEditorState) => void;
  onConvertToCurrentV1: () => void;
}) {
  if (editor.mode === "grandfather") {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-3 py-3">
        <p className="text-sm leading-snug text-foreground">{GRANDFATHER_OFFER_FEE_CALLOUT}</p>
        {editorProps.readOnly || editorProps.disabled ? null : (
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={onConvertToCurrentV1}
          >
            {CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL}
          </Button>
        )}
      </div>
    );
  }
  return (
    <UtilisationFeeLinesEditor
      {...editorProps}
      schedule={editor.schedule}
      onChange={(schedule) => onChange({ mode: "v1", schedule })}
    />
  );
}

export function InvoiceOfferFeeConfirmRows({
  offeredAmount,
  platformFeeRatePercent,
  feeScheduleMode,
  facilityFeeCollectAmount,
  additionalFees,
  liveFacilityFee,
}: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  liveFacilityFee: InvoiceOfferConfirmLiveFacilityFee;
}) {
  if (feeScheduleMode === "preserve_grandfather") {
    return (
      <>
        <div className="flex justify-between items-baseline">
          <span className="text-sm font-medium text-muted-foreground">Drawdown fee</span>
          <span className="text-ui font-medium tabular-nums">
            {platformFeeRatePercent}% at disbursement
          </span>
        </div>
        <p
          role="note"
          className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm leading-snug text-foreground"
        >
          {GRANDFATHER_OFFER_FEE_CONFIRMATION}
        </p>
      </>
    );
  }
  const leftoverAfterCollect = remainingFacilityFeeAfterCollect(
    liveFacilityFee.remaining,
    facilityFeeCollectAmount
  );
  return (
    <>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-muted-foreground">Drawdown fee</span>
        <span className="text-ui font-medium tabular-nums">
          {platformFeeRatePercent}% at disbursement
        </span>
      </div>
      {liveFacilityFee.collectEnabled ? (
        <>
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-muted-foreground">Facility fee to collect now</span>
            <span className="text-ui font-medium tabular-nums">
              {formatCurrency(facilityFeeCollectAmount)}
            </span>
          </div>
          {leftoverAfterCollect != null ? (
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-sm font-medium text-muted-foreground">Left for later drawdowns</span>
              <span className="text-ui font-medium tabular-nums">
                {formatCurrency(leftoverAfterCollect)}
              </span>
            </div>
          ) : null}
        </>
      ) : null}
      {additionalFees.map((line) => (
        <div key={`${line.name}-${line.kind}`} className="flex justify-between items-baseline gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {line.name}
          </span>
          <span className="shrink-0 text-ui font-medium tabular-nums">
            {line.kind === "percent_of_funded"
              ? `${line.value}% of funds raised`
              : formatCurrency(line.value)}
          </span>
        </div>
      ))}
      <UtilisationFeeTotalsSummary
        offeredAmount={offeredAmount}
        platformFeeRatePercent={platformFeeRatePercent}
        schedule={{ facilityFeeCollectAmount, additionalFees }}
        facilityFeeRemaining={liveFacilityFee.remaining}
        collectEnabled={liveFacilityFee.collectEnabled}
      />
    </>
  );
}
