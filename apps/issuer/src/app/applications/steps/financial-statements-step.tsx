"use client";

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
import { DateInput } from "@/app/applications/components/date-input";
import { cn } from "@/lib/utils";
import {
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
} from "@/app/applications/components/form-control";
import { MoneyInput } from "@/app/applications/components/money-input";
import { parseMoney, formatMoney } from "@/app/applications/components/money";
import { DebugSkeletonToggle } from "@/app/applications/components/debug-skeleton-toggle";
import { FinancialStatementsSkeleton } from "@/app/applications/components/financial-statements-skeleton";
import { FINANCIAL_FIELD_LABELS } from "@cashsouk/types";

/* ================================================================
   TYPES & CONSTANTS
   ================================================================ */

/** API/DB shape: flat canonical keys */
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
  plyear: number;
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
  plyear: 0,
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
      (out as unknown as Record<string, unknown>)[key] = toNum(val);
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
      out[k] = form.plyear;
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

const radioSelectedLabel = formLabelClassName;
const radioUnselectedLabel = formLabelClassName.replace("text-foreground", "text-muted-foreground");

/* ================================================================
   CUSTOM RADIO
   ================================================================ */

function CustomRadio({
  name,
  value,
  checked,
  onChange,
  label,
  selectedLabelClass,
  unselectedLabelClass,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  selectedLabelClass: string;
  unselectedLabelClass: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none relative block h-5 w-5 shrink-0 rounded-full",
            checked
              ? disabled
                ? "bg-muted border-2 border-muted-foreground/50"
                : "bg-primary"
              : "border-2 border-muted-foreground/50 bg-muted/30"
          )}
          aria-hidden
        >
          {checked && (
            <span
              className={cn(
                "absolute inset-1 rounded-full",
                disabled ? "bg-muted-foreground/60" : "bg-white"
              )}
              aria-hidden
            />
          )}
          {!checked && (
            <span
              className="absolute inset-1.5 rounded-full bg-muted-foreground/40"
              aria-hidden
            />
          )}
        </span>
      </span>
      <span className={checked ? selectedLabelClass : unselectedLabelClass}>{label}</span>
    </label>
  );
}

function ProfitLossRadioGroup({
  value,
  onValueChange,
  disabled,
}: {
  value: "profit" | "loss" | "";
  onValueChange: (v: "profit" | "loss") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-6 items-center">
      <CustomRadio
        name="plyear-type"
        value="profit"
        checked={value === "profit"}
        onChange={() => !disabled && onValueChange("profit")}
        label="Profit"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
        disabled={disabled}
      />
      <CustomRadio
        name="plyear-type"
        value="loss"
        checked={value === "loss"}
        onChange={() => !disabled && onValueChange("loss")}
        label="Loss"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
        disabled={disabled}
      />
    </div>
  );
}

/* ================================================================
   MONEY FIELD ROW
   ================================================================ */

function MoneyFieldRow({
  id,
  label,
  value,
  onValueChange,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  readOnly?: boolean;
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
        inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
        disabled={readOnly}
      />
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
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  const [form, setForm] = React.useState<FinancialStatementsPayload>(DEFAULT_PAYLOAD);
  const [profitLossType, setProfitLossType] = React.useState<"profit" | "loss" | "">("");
  const [profitLossAmount, setProfitLossAmount] = React.useState<string>("");
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
    if (initial.plyear === 0) {
      setProfitLossType("");
      setProfitLossAmount("");
    } else if (initial.plyear < 0) {
      setProfitLossType("loss");
      setProfitLossAmount(formatMoney(Math.abs(initial.plyear)));
    } else {
      setProfitLossType("profit");
      setProfitLossAmount(formatMoney(initial.plyear));
    }
    initialPayloadRef.current = JSON.stringify(toApiPayload(initial));
    setIsInitialized(true);
  }, [application, isInitialized]);

  const handleFieldChange = React.useCallback(
    (field: keyof FinancialStatementsPayload, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handlePlyearTypeChange = React.useCallback((type: "profit" | "loss") => {
    setProfitLossType(type);
  }, []);

  const handlePlyearAmountChange = React.useCallback((v: string) => {
    setProfitLossAmount(v);
  }, []);

  React.useEffect(() => {
    if (profitLossType === "profit" || profitLossType === "loss") {
      const amount = parseMoney(profitLossAmount);
      setForm((prev) => ({ ...prev, plyear: profitLossType === "loss" ? -amount : amount }));
    } else {
      setForm((prev) => ({ ...prev, plyear: 0 }));
    }
  }, [profitLossType, profitLossAmount]);

  const apiPayload = React.useMemo(() => toApiPayload(form), [form]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    return JSON.stringify(apiPayload) !== initialPayloadRef.current;
  }, [apiPayload, isInitialized]);

  /** All fields required. Save and Continue disabled until every field has a value. */
  const isValid = React.useMemo(() => {
    const dateFields: (keyof FinancialStatementsPayload)[] = ["pldd", "bsdd"];
    const moneyFields: (keyof FinancialStatementsPayload)[] = [
      "bsfatot", "othass", "bscatot", "bsclbank", "curlib", "bsslltd", "bsclstd", "bsqpuc",
      "turnover", "plnpbt", "plnpat", "plminin", "plnetdiv",
    ];
    const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
    if (!dateFields.every((k) => hasValue(form[k]))) return false;
    if (!moneyFields.every((k) => hasValue(form[k]))) return false;
    if (profitLossType !== "profit" && profitLossType !== "loss") return false;
    if (!hasValue(profitLossAmount)) return false;
    return true;
  }, [form, profitLossType, profitLossAmount]);

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
            />
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
            <Label className={labelClassName}>Profit / Loss of the Year</Label>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground">Type</span>
                <div className="mt-2">
                  <ProfitLossRadioGroup
                    value={profitLossType}
                    onValueChange={handlePlyearTypeChange}
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="plyear-amount" className={cn(labelClassName, "block mb-2")}>
                  Amount
                </Label>
                <MoneyInput
                  value={profitLossAmount}
                  onValueChange={handlePlyearAmountChange}
                  placeholder="0.00"
                  prefix="RM"
                  inputClassName={cn(inputClassName, "pl-12", (readOnly || profitLossType === "") && formInputDisabledClassName)}
                  disabled={readOnly || profitLossType === ""}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
      <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
