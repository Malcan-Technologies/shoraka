"use client";

/**
 * Guide: docs/guides/application-flow/financial-statements-step.md — Financial statements step architecture, field mappings, payload format
 */

/**
 * FINANCIAL STATEMENTS STEP
 *
 * Form for financial statement data. Only input fields; no computed metrics in issuer UI.
 * Backend stores flat JSON; computed metrics calculated on-demand via shared utility.
 *
 * Data Flow:
 * 1. Load saved data from application.financial_statements
 * 2. User edits; on change pass payload + hasPendingChanges to parent
 * 3. Parent saves to DB when user clicks "Save and Continue"
 */

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/app/(application-flow)/applications/components/date-input";
import { cn } from "@/lib/utils";
import {
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { MoneyInput } from "@/app/(application-flow)/applications/components/money-input";
import { parseMoney, formatMoney } from "@/app/(application-flow)/applications/components/money";
import { DebugSkeletonToggle } from "@/app/(application-flow)/applications/components/debug-skeleton-toggle";
import { FinancialStatementsSkeleton } from "@/app/(application-flow)/applications/components/financial-statements-skeleton";
import {
  FINANCIAL_FIELD_LABELS,
  calculateProfitMargin,
  calculateReturnOnEquity,
  calculateCurrentRatio,
  calculateWorkingCapital,
  calculateGearing,
} from "@cashsouk/types";

/* ================================================================
   TYPES & CONSTANTS
   ================================================================ */

/** API/DB shape: flat canonical keys. plyear stored as string in form; parsed to number for API. */
interface FinancialStatementsPayload {
  pldd: string;
  bsdd: string;
  bsfatot: string;
  othass: string;
  bscatot: string;
  bsclbank: string;
  curlib: string;
  bsslltd: string;
  bsclstd: string;
  bsqpuc: string;
  turnover: string;
  plnpbt: string;
  plnpat: string;
  plminin: string;
  plnetdiv: string;
  plyear: string;
}

const DEFAULT_PAYLOAD: FinancialStatementsPayload = {
  pldd: "",
  bsdd: "",
  bsfatot: "",
  othass: "",
  bscatot: "",
  bsclbank: "",
  curlib: "",
  bsslltd: "",
  bsclstd: "",
  bsqpuc: "",
  turnover: "",
  plnpbt: "",
  plnpat: "",
  plminin: "",
  plnetdiv: "",
  plyear: "",
};

/** Legacy key mapping for backward compatibility */
const LEGACY_KEY_MAP: Record<string, keyof FinancialStatementsPayload> = {
  financing_year_end: "pldd",
  balance_sheet_financial_year: "bsdd",
  fixed_assets: "bsfatot",
  other_assets: "othass",
  current_assets: "bscatot",
  non_current_assets: "bsclbank",
  current_liability: "curlib",
  long_term_liability: "bsslltd",
  non_current_liability: "bsclstd",
  paid_up: "bsqpuc",
  profit_before_tax: "plnpbt",
  profit_after_tax: "plnpat",
  minority_interest: "plminin",
  net_dividend: "plnetdiv",
  profit_and_loss_year: "plyear",
};

/* ================================================================
   HELPERS
   ================================================================ */

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function fromSaved(saved: unknown): FinancialStatementsPayload {
  const raw = saved as { input?: Record<string, unknown> } | Record<string, unknown> | null | undefined;
  const data = (raw && typeof raw === "object" && "input" in raw ? raw.input : raw) as Record<string, unknown> | null | undefined;
  if (!data || typeof data !== "object") return { ...DEFAULT_PAYLOAD };

  const out = { ...DEFAULT_PAYLOAD };

  const setVal = (key: keyof FinancialStatementsPayload, val: unknown) => {
    if (val === undefined || val === null) return;
    if (key === "pldd" || key === "bsdd") {
      (out as unknown as Record<string, unknown>)[key] = String(val);
    } else if (key === "plyear") {
      const n = toNum(val);
      (out as unknown as Record<string, unknown>)[key] = n === 0 ? "" : formatMoney(n);
    } else {
      const n = toNum(val);
      (out as unknown as Record<string, unknown>)[key] = n === 0 ? "" : formatMoney(n);
    }
  };

  for (const key of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
    setVal(key, data[key]);
  }
  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
    if (out[canonicalKey] === DEFAULT_PAYLOAD[canonicalKey]) {
      setVal(canonicalKey, data[legacyKey]);
    }
  }

  return out;
}

function toApiPayload(form: FinancialStatementsPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
    if (k === "pldd" || k === "bsdd") {
      out[k] = form[k];
    } else if (k === "plyear") {
      out[k] = parseMoney(form.plyear ?? "");
    } else {
      const val = (form as unknown as Record<string, unknown>)[k];
      out[k] = parseMoney(String(val ?? ""));
    }
  }
  return out;
}

/* ================================================================
   LAYOUT & STYLING
   ================================================================ */

const sectionHeaderClassName = "text-base font-semibold text-foreground";
const labelClassName = cn(formLabelClassName, "font-normal");
const inputClassName = formInputClassName;
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 w-full max-w-[1200px] items-start px-3";
const sectionWrapperClassName = "w-full max-w-[1200px]";
const formOuterClassName = "w-full max-w-[1200px] flex flex-col gap-10 px-3";

/* ================================================================
   MONEY FIELD ROW
   ================================================================ */

function MoneyFieldRow({
  id,
  label,
  value,
  onValueChange,
  readOnly,
  allowNegative = false,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  readOnly?: boolean;
  allowNegative?: boolean;
}) {
  return (
    <>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <MoneyInput
        value={value}
        onValueChange={onValueChange}
        placeholder="0.00"
        prefix="RM"
        allowNegative={allowNegative}
        inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
        disabled={readOnly}
      />
    </>
  );
}

/* ================================================================
   CALCULATED METRICS (UI only, never persisted)
   ================================================================ */

function CalculatedMetricsSection({ form }: { form: FinancialStatementsPayload }) {
  const metrics = React.useMemo(() => {
    const bscatot = parseMoney(form.bscatot ?? "");
    const curlib = parseMoney(form.curlib ?? "");
    const bsslltd = parseMoney(form.bsslltd ?? "");
    const bsclstd = parseMoney(form.bsclstd ?? "");
    const bsqpuc = parseMoney(form.bsqpuc ?? "");
    const turnover = parseMoney(form.turnover ?? "");
    const plnpat = parseMoney(form.plnpat ?? "");

    return {
      profitMargin: calculateProfitMargin(plnpat, turnover),
      returnOnEquity: calculateReturnOnEquity(plnpat, bsqpuc),
      currentRatio: calculateCurrentRatio(bscatot, curlib),
      workingCapital: calculateWorkingCapital(bscatot, curlib),
      gearing: calculateGearing(curlib, bsslltd, bsclstd, bsqpuc),
    };
  }, [form.bscatot, form.curlib, form.bsslltd, form.bsclstd, form.bsqpuc, form.turnover, form.plnpat]);

  const fmtPct = (v: number | null) =>
    v == null ? "—" : `${(v * 100).toFixed(2)}%`;

  return (
    <section className={`${sectionWrapperClassName} space-y-3`}>
      <div>
        <h3 className={sectionHeaderClassName}>Calculated Metrics</h3>
        <div className="border-b border-border mt-2 mb-4" />
      </div>
      <div className={rowGridClassName}>
        <Label className={cn(labelClassName, "text-muted-foreground")}>Profit Margin</Label>
        <span className={cn(inputClassName, "py-2")}>{fmtPct(metrics.profitMargin)}</span>
        <Label className={cn(labelClassName, "text-muted-foreground")}>Return on Equity</Label>
        <span className={cn(inputClassName, "py-2")}>{fmtPct(metrics.returnOnEquity)}</span>
        <Label className={cn(labelClassName, "text-muted-foreground")}>Current Ratio</Label>
        <span className={cn(inputClassName, "py-2")}>{metrics.currentRatio != null ? metrics.currentRatio.toFixed(2) : "—"}</span>
        <Label className={cn(labelClassName, "text-muted-foreground")}>Working Capital</Label>
        <span className={cn(inputClassName, "py-2")}>{formatMoney(metrics.workingCapital)}</span>
        <Label className={cn(labelClassName, "text-muted-foreground")}>Gearing</Label>
        <span className={cn(inputClassName, "py-2")}>{fmtPct(metrics.gearing)}</span>
      </div>
    </section>
  );
}

/* ================================================================
   COMPONENT
   ================================================================ */

interface FinancialStatementsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function FinancialStatementsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancialStatementsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  const [form, setForm] = React.useState<FinancialStatementsPayload>(DEFAULT_PAYLOAD);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const initialPayloadRef = React.useRef<string>("");

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    if (application === undefined || isInitialized) return;
    const saved = (application as unknown as Record<string, unknown>)?.financial_statements;
    const initial = fromSaved(saved);
    setForm(initial);
    initialPayloadRef.current = JSON.stringify(toApiPayload(initial));
    setIsInitialized(true);
  }, [application, isInitialized]);

  const handleFieldChange = React.useCallback(
    (field: keyof FinancialStatementsPayload, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const apiPayload = React.useMemo(() => toApiPayload(form), [form]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    return JSON.stringify(apiPayload) !== initialPayloadRef.current;
  }, [apiPayload, isInitialized]);

  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";

  /** All fields required. turnover >= 0. plnpat, bsqpuc, plyear can be negative. */
  const isValid = React.useMemo(() => {
    const dateFields: (keyof FinancialStatementsPayload)[] = ["pldd", "bsdd"];
    const moneyFields: (keyof FinancialStatementsPayload)[] = [
      "bsfatot", "othass", "bscatot", "bsclbank", "curlib", "bsslltd", "bsclstd", "bsqpuc",
      "turnover", "plnpbt", "plnpat", "plminin", "plnetdiv", "plyear",
    ];
    if (!dateFields.every((k) => hasValue(form[k]))) return false;
    if (!moneyFields.every((k) => hasValue(form[k]))) return false;
    const turnoverNum = parseMoney(form.turnover ?? "");
    if (turnoverNum < 0) return false;
    return true;
  }, [form]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;
    onDataChangeRef.current({
      ...apiPayload,
      hasPendingChanges,
      isValid,
    });
  }, [apiPayload, hasPendingChanges, isValid, isInitialized]);

  const getLabel = (key: keyof FinancialStatementsPayload) => FINANCIAL_FIELD_LABELS[key] ?? key;

  if (isLoadingApp || !isInitialized || debugSkeletonMode) {
    return (
      <>
        <FinancialStatementsSkeleton />
        <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
      </>
    );
  }

  return (
    <>
      <div className={formOuterClassName}>
        {/* ===================== FINANCIAL YEAR ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Financial Year</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="pldd" className={labelClassName}>
              {getLabel("pldd")}
            </Label>
            <DateInput
              value={form.pldd}
              onChange={(v) => handleFieldChange("pldd", v)}
              disabled={readOnly}
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              placeholder="Enter date"
            />
            <Label htmlFor="bsdd" className={labelClassName}>
              {getLabel("bsdd")}
            </Label>
            <DateInput
              value={form.bsdd}
              onChange={(v) => handleFieldChange("bsdd", v)}
              disabled={readOnly}
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              placeholder="Enter date"
            />
          </div>
        </section>

        {/* ===================== ASSETS ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Assets</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            {(["bsfatot", "othass", "bscatot", "bsclbank"] as const).map((key) => (
              <MoneyFieldRow
                key={key}
                id={key}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => handleFieldChange(key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>

        {/* ===================== LIABILITIES ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Liabilities</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            {(["curlib", "bsslltd", "bsclstd"] as const).map((key) => (
              <MoneyFieldRow
                key={key}
                id={key}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => handleFieldChange(key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>

        {/* ===================== EQUITY ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Equity</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <MoneyFieldRow
              id="bsqpuc"
              label={getLabel("bsqpuc")}
              value={form.bsqpuc ?? ""}
              onValueChange={(v) => handleFieldChange("bsqpuc", v)}
              readOnly={readOnly}
              allowNegative
            />
          </div>
        </section>

        {/* ===================== PROFIT AND LOSS ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Profit and Loss</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <>
              <MoneyFieldRow
                id="turnover"
                label={getLabel("turnover")}
                value={form.turnover ?? ""}
                onValueChange={(v) => handleFieldChange("turnover", v)}
                readOnly={readOnly}
              />
              {hasValue(form.turnover) && parseMoney(form.turnover ?? "") < 0 && (
                <p className="text-xs text-destructive sm:col-span-2">Turnover must be 0 or greater</p>
              )}
            </>
            <MoneyFieldRow
              id="plnpbt"
              label={getLabel("plnpbt")}
              value={form.plnpbt ?? ""}
              onValueChange={(v) => handleFieldChange("plnpbt", v)}
              readOnly={readOnly}
            />
            <MoneyFieldRow
              id="plnpat"
              label={getLabel("plnpat")}
              value={form.plnpat ?? ""}
              onValueChange={(v) => handleFieldChange("plnpat", v)}
              readOnly={readOnly}
              allowNegative
            />
            <MoneyFieldRow
              id="plminin"
              label={getLabel("plminin")}
              value={form.plminin ?? ""}
              onValueChange={(v) => handleFieldChange("plminin", v)}
              readOnly={readOnly}
            />
            <MoneyFieldRow
              id="plnetdiv"
              label={getLabel("plnetdiv")}
              value={form.plnetdiv ?? ""}
              onValueChange={(v) => handleFieldChange("plnetdiv", v)}
              readOnly={readOnly}
            />
            <MoneyFieldRow
              id="plyear"
              label={getLabel("plyear")}
              value={form.plyear ?? ""}
              onValueChange={(v) => handleFieldChange("plyear", v)}
              readOnly={readOnly}
              allowNegative
            />
          </div>
        </section>

        {/* ===================== CALCULATED METRICS (read-only, never persisted) ===================== */}
        <CalculatedMetricsSection form={form} />
      </div>
      <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
