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
import {
  additionalFeeKindLabel,
  CONVERT_TO_CURRENT_FEE_SCHEDULE_LABEL,
  emptyAdditionalFeeLine,
  FACILITY_FEE_AVAILABLE_FOR_OFFER_LABEL,
  GRANDFATHER_OFFER_FEE_CALLOUT,
  GRANDFATHER_OFFER_FEE_CONFIRMATION,
  summariseUtilisationFees,
  utilisationFeeScheduleIssues,
  type InvoiceOfferFeeEditorState,
  type UtilisationFeeScheduleState,
  type UtilisationFeeThresholdTotals,
} from "./utilisation-fee-lines";

const MONEY_DRAFT = /^\d*\.?\d{0,2}$/;

function kindFromValue(value: string): AdditionalFeeKind {
  return value === "percent_of_funded" ? "percent_of_funded" : "amount";
}

function UtilisationFeeTotalsColumn({
  title,
  totals,
  exceeds,
}: {
  title: string;
  totals: UtilisationFeeThresholdTotals["full"];
  exceeds: boolean;
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
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Facility fee</dt>
          <dd className="tabular-nums">{formatCurrency(totals.facilityFee)}</dd>
        </div>
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
  className,
}: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  schedule: UtilisationFeeScheduleState;
  facilityFeeRemaining?: number;
  facilityFeeCollectionWaived?: boolean;
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
        />
        <UtilisationFeeTotalsColumn
          title={`At ${totals.minimumPercent}% minimum`}
          totals={totals.minimum}
          exceeds={totals.exceedsAtMinimum}
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
}: UtilisationFeeLinesEditorProps) {
  const locked = disabled || readOnly;
  const [collectDraft, setCollectDraft] = React.useState<string | undefined>(undefined);
  const [valueDrafts, setValueDrafts] = React.useState<Record<number, string>>({});
  const issues = utilisationFeeScheduleIssues({
    schedule,
    facilityFeeRemaining,
    collectEnabled,
  });
  const collectIssue = issues.find((issue) => issue.path === "facilityFeeCollectAmount");
  const canAdd = !locked && schedule.additionalFees.length < FEE_SCHEDULE_MAX_ADDITIONAL_LINES;

  const commitCollect = React.useCallback(
    (raw: string) => {
      const parsed = raw.trim() === "" ? 0 : Number(raw.replace(/,/g, ""));
      const amount = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
      onChange({ ...schedule, facilityFeeCollectAmount: amount });
    },
    [onChange, schedule]
  );

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

  const remainingLabel =
    facilityFeeRemaining == null ? null : formatCurrency(Math.max(0, facilityFeeRemaining));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-start">
        <div className="space-y-0.5">
          <Label htmlFor={`${idPrefix}-facility-collect`} className="text-sm font-medium">
            Facility fee collected
          </Label>
          {remainingLabel ? (
            <p className="text-meta text-muted-foreground">
              {FACILITY_FEE_AVAILABLE_FOR_OFFER_LABEL} {remainingLabel}
            </p>
          ) : null}
        </div>
        {readOnly ? (
          <p className="min-h-9 text-ui tabular-nums">
            {formatCurrency(schedule.facilityFeeCollectAmount)}
            {facilityFeeCollectionWaived ? " · collection waived on this note later" : ""}
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex w-full max-w-[11rem] items-center gap-1.5">
              <span className="shrink-0 text-ui text-muted-foreground">RM</span>
              <Input
                id={`${idPrefix}-facility-collect`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label="Facility fee collected in ringgit"
                aria-invalid={Boolean(collectIssue)}
                disabled={locked || !collectEnabled}
                className="h-9 rounded-xl border-border bg-background text-right tabular-nums"
                value={
                  collectDraft !== undefined
                    ? collectDraft
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
            {!collectEnabled ? (
              <p className="text-meta text-muted-foreground">
                Facility fee collection can only be set on a facility-linked invoice.
              </p>
            ) : collectIssue ? (
              <p role="alert" className="text-sm text-destructive">
                {collectIssue.message}
              </p>
            ) : (
              <p className="text-meta text-muted-foreground">
                RM amount collected from this drawdown against the facility fee. Frozen after the
                issuer accepts.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Additional fees</p>
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
          <p className="text-meta text-muted-foreground">
            Optional named lines. Kind is a fixed RM amount or a percent of actual funds raised.
          </p>
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
  facilityFeeRemaining,
}: {
  offeredAmount: number;
  platformFeeRatePercent: number;
  feeScheduleMode: InvoiceOfferFeeScheduleWriteMode;
  facilityFeeCollectAmount: number;
  additionalFees: AdditionalFeeLine[];
  facilityFeeRemaining?: number;
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
  return (
    <>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-muted-foreground">Drawdown fee</span>
        <span className="text-ui font-medium tabular-nums">
          {platformFeeRatePercent}% at disbursement
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-muted-foreground">Facility fee collected</span>
        <span className="text-ui font-medium tabular-nums">
          {formatCurrency(facilityFeeCollectAmount)}
        </span>
      </div>
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
        facilityFeeRemaining={facilityFeeRemaining}
      />
    </>
  );
}
