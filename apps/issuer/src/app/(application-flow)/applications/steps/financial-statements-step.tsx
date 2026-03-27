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
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
  fieldTooltipTriggerInputClassName,
  fieldTooltipLabelGap,
} from "@/app/(application-flow)/applications/components/form-control";
import { MoneyInput } from "@cashsouk/ui";
import { parseMoney, formatMoney } from "@cashsouk/ui";
import { FinancialStatementsSkeleton } from "@/app/(application-flow)/applications/components/financial-statements-skeleton";
import { FINANCIAL_FIELD_LABELS } from "@cashsouk/types";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { parse, isValid as isValidDate, startOfDay, format, subMonths } from "date-fns";
import { toast } from "sonner";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

/**
 * Mock data for dev Auto Fill. All 15 fields.
 * - turnover: >= 0; plnpbt, plnpat, plyear: may be negative; plnetdiv: positive.
 * - Decimals randomized (2 dp) to match MoneyInput.
 */
export function generateMockData(): Record<string, unknown> {
  const today = new Date();
  const fyEnd = format(subMonths(today, 6), "dd/MM/yyyy");
  const dataUntil = format(subMonths(today, 1), "dd/MM/yyyy");
  const plnpat = 120000.45;
  const plyear = 100000.25;
  return {
    pldd: fyEnd,
    bsdd: dataUntil,
    bsfatot: formatMoney(500000.12),
    othass: formatMoney(100000.88),
    bscatot: formatMoney(200000.5),
    bsclbank: formatMoney(50000.33),
    curlib: formatMoney(150000.67),
    bsslltd: formatMoney(80000.99),
    bsclstd: formatMoney(20000.11),
    bsqpuc: formatMoney(100000.44),
    turnover: formatMoney(1200000.56),
    plnpbt: formatMoney(150000.22),
    plnpat: formatMoney(plnpat),
    plnetdiv: formatMoney(50000.77),
    plyear: formatMoney(plyear),
  };
}

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
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 w-full max-w-[1200px] items-center px-3";
const sectionWrapperClassName = "w-full max-w-[1200px]";
const formOuterClassName = "w-full max-w-[1200px] flex flex-col gap-10 px-3";

/* ================================================================
   MONEY FIELD ROW
   ================================================================ */

const NEGATIVE_TOOLTIP_TEXT = "Negative values allowed for losses\nExample: -5000";
const FINANCIAL_DATA_UNTIL_TOOLTIP = "The latest date your financial numbers are updated to (management accounts)";

function MoneyFieldRow({
  id,
  label,
  value,
  onValueChange,
  readOnly,
  allowNegative = false,
  showNegativeTooltip = false,
  hasError = false,
  errorMessage,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  readOnly?: boolean;
  allowNegative?: boolean;
  showNegativeTooltip?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}) {
  const inputEl = (
    <MoneyInput
      value={value}
      onValueChange={onValueChange}
      placeholder="0.00"
      prefix="RM"
      allowNegative={allowNegative}
      inputClassName={cn(
        inputClassName,
        "pl-12",
        showNegativeTooltip && "pr-10",
        readOnly && formInputDisabledClassName,
        hasError && "border-destructive focus-visible:border-2 focus-visible:border-destructive"
      )}
      disabled={readOnly}
    />
  );

  const innerInput = showNegativeTooltip ? (
    <div className="relative">
      {inputEl}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={fieldTooltipTriggerInputClassName}>
            <InformationCircleIcon className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
          {NEGATIVE_TOOLTIP_TEXT}
        </TooltipContent>
      </Tooltip>
    </div>
  ) : (
    inputEl
  );

  const wrappedInput = errorMessage ? (
    <div className="flex flex-col gap-1">
      {innerInput}
      <p className="text-xs text-destructive">{errorMessage}</p>
    </div>
  ) : (
    innerInput
  );

  return (
    <>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      {wrappedInput}
    </>
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
  const devTools = useDevTools();
  const [form, setForm] = React.useState<FinancialStatementsPayload>(DEFAULT_PAYLOAD);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
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

  /** Apply dev-tools Auto Fill when requested (single step or Fill Entire Application). */
  React.useEffect(() => {
    const raw =
      devTools?.autoFillData?.stepKey === "financial_statements"
        ? devTools.autoFillData.data
        : devTools?.autoFillDataMap?.["financial_statements"];
    if (!raw) return;
    const data = raw as Partial<FinancialStatementsPayload>;
    const merged = { ...DEFAULT_PAYLOAD };
    for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
      if (data[k] !== undefined && data[k] !== null) {
        (merged as Record<string, unknown>)[k] = String(data[k]);
      }
    }
    setForm(merged);
    if (devTools) {
      if (devTools.autoFillData?.stepKey === "financial_statements") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("financial_statements");
    }
  }, [devTools]);

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

  /** Parse date string (ISO or d/M/yyyy) to Date or null. */
  const parseDate = (s: string): Date | null => {
    if (!s?.trim()) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(s);
      return isValidDate(d) ? d : null;
    }
    try {
      const parsed = parse(s, "d/M/yyyy", new Date());
      return isValidDate(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  /** bsdd cannot be in the future. */
  const bsddIsFuture = React.useMemo(() => {
    const d = parseDate(form.bsdd ?? "");
    if (!d) return false;
    return startOfDay(d) > startOfDay(new Date());
  }, [form.bsdd]);

  /** Full validation: all fields, turnover >= 0, bsdd not in future. Used by saveFunction. */
  const isValid = React.useMemo(() => {
    const dateFields: (keyof FinancialStatementsPayload)[] = ["pldd", "bsdd"];
    const moneyFields: (keyof FinancialStatementsPayload)[] = [
      "bsfatot", "othass", "bscatot", "bsclbank", "curlib", "bsslltd", "bsclstd", "bsqpuc",
      "turnover", "plnpbt", "plnpat", "plnetdiv", "plyear",
    ];
    if (!dateFields.every((k) => hasValue(form[k]))) return false;
    if (bsddIsFuture) return false;
    if (!moneyFields.every((k) => hasValue(form[k]))) return false;
    const turnoverNum = parseMoney(form.turnover ?? "");
    if (turnoverNum < 0) return false;
    return true;
  }, [form, bsddIsFuture]);

  /** For Save button: exclude bsdd future check so user can click Save and see validation error. */
  const isValidForButton = React.useMemo(() => {
    const dateFields: (keyof FinancialStatementsPayload)[] = ["pldd", "bsdd"];
    const moneyFields: (keyof FinancialStatementsPayload)[] = [
      "bsfatot", "othass", "bscatot", "bsclbank", "curlib", "bsslltd", "bsclstd", "bsqpuc",
      "turnover", "plnpbt", "plnpat", "plnetdiv", "plyear",
    ];
    if (!dateFields.every((k) => hasValue(form[k]))) return false;
    if (!moneyFields.every((k) => hasValue(form[k]))) return false;
    const turnoverNum = parseMoney(form.turnover ?? "");
    if (turnoverNum < 0) return false;
    return true;
  }, [form]);

  /** Runs when parent calls save on Save and Continue. Sets hasSubmitted and throws if invalid. */
  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    if (!isValid) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_REQUIRED");
    }
  }, [isValid]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;
    onDataChangeRef.current({
      ...apiPayload,
      hasPendingChanges,
      isValid: isValidForButton,
      saveFunction,
    });
  }, [apiPayload, hasPendingChanges, isValidForButton, isInitialized, saveFunction]);

  const getLabel = (key: keyof FinancialStatementsPayload) => FINANCIAL_FIELD_LABELS[key] ?? key;

  if (isLoadingApp || !isInitialized || devTools?.showSkeletonDebug) {
    return <FinancialStatementsSkeleton />;
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
            <div className={cn("flex items-center", fieldTooltipLabelGap)}>
              <Label htmlFor="bsdd" className={labelClassName}>
                {getLabel("bsdd")}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                  {FINANCIAL_DATA_UNTIL_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-col gap-1">
              <DateInput
                value={form.bsdd}
                onChange={(v) => handleFieldChange("bsdd", v)}
                disabled={readOnly}
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                placeholder="Enter date"
                isInvalid={hasSubmitted && bsddIsFuture}
              />
              {hasSubmitted && bsddIsFuture && (
                <p className="text-xs text-destructive">Financial data date cannot be in the future.</p>
              )}
            </div>
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
            <MoneyFieldRow
              id="turnover"
              label={getLabel("turnover")}
              value={form.turnover ?? ""}
              onValueChange={(v) => handleFieldChange("turnover", v)}
              readOnly={readOnly}
              hasError={hasSubmitted && hasValue(form.turnover) && parseMoney(form.turnover ?? "") < 0}
              errorMessage={hasSubmitted && hasValue(form.turnover) && parseMoney(form.turnover ?? "") < 0 ? "Turnover must be 0 or greater" : undefined}
            />
            <MoneyFieldRow
              id="plnpbt"
              label={getLabel("plnpbt")}
              value={form.plnpbt ?? ""}
              onValueChange={(v) => handleFieldChange("plnpbt", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
            />
            <MoneyFieldRow
              id="plnpat"
              label={getLabel("plnpat")}
              value={form.plnpat ?? ""}
              onValueChange={(v) => handleFieldChange("plnpat", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
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
              showNegativeTooltip
            />
          </div>
        </section>
      </div>
    </>
  );
}
