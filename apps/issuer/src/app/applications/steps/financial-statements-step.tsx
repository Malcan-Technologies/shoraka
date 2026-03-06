"use client";

/**
 * Imports
 *
 * What: Financial statements step UI. Flat storage; only input fields shown.
 * Why: Issuers enter raw data; computed metrics calculated on-demand in admin/analytics.
 * Data: Loads from application.financial_statements (flat); sends flat payload to API.
 */
import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
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

/**
 * FINANCIAL STATEMENTS STEP
 *
 * Form for financial statement data. Only input fields; no computed metrics in issuer UI.
 * Backend stores flat JSON; computed metrics calculated on-demand via shared utility.
 */

const INPUT_KEYS = [
  "pldd",
  "bsdd",
  "bsfatot",
  "othass",
  "bscatot",
  "bsclbank",
  "curlib",
  "bsslltd",
  "bsclstd",
  "bsqpuc",
  "turnover",
  "plnpbt",
  "plnpat",
  "plminin",
  "plnetdiv",
  "plyear",
] as const;

type FinancialStatementsInputKey = (typeof INPUT_KEYS)[number];

interface FinancialStatementsInput {
  pldd: string;
  bsdd: string;
  bsfatot: number;
  othass: number;
  bscatot: number;
  bsclbank: number;
  curlib: number;
  bsslltd: number;
  bsclstd: number;
  bsqpuc: number;
  turnover: number;
  plnpbt: number;
  plnpat: number;
  plminin: number;
  plnetdiv: number;
  plyear: number;
}

const defaultInput: FinancialStatementsInput = {
  pldd: "",
  bsdd: "",
  bsfatot: 0,
  othass: 0,
  bscatot: 0,
  bsclbank: 0,
  curlib: 0,
  bsslltd: 0,
  bsclstd: 0,
  bsqpuc: 0,
  turnover: 0,
  plnpbt: 0,
  plnpat: 0,
  plminin: 0,
  plnetdiv: 0,
  plyear: 0,
};

const OLD_TO_NEW: Record<string, FinancialStatementsInputKey> = {
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

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function fromSaved(saved: unknown): FinancialStatementsInput {
  const raw = saved as { input?: Record<string, unknown> } | Record<string, unknown> | null | undefined;
  const data = (raw && typeof raw === "object" && "input" in raw ? raw.input : raw) as Record<string, unknown> | null | undefined;
  if (!data || typeof data !== "object") return { ...defaultInput };

  const out = { ...defaultInput };
  for (const newKey of INPUT_KEYS) {
    const val = data[newKey];
    if (val !== undefined && val !== null) {
      if (newKey === "pldd" || newKey === "bsdd") {
        (out as Record<string, unknown>)[newKey] = String(val);
      } else {
        (out as Record<string, unknown>)[newKey] = toNum(val);
      }
    }
  }
  for (const [oldKey, newKey] of Object.entries(OLD_TO_NEW)) {
    const val = data[oldKey];
    if (val !== undefined && val !== null && out[newKey] === defaultInput[newKey]) {
      if (newKey === "pldd" || newKey === "bsdd") {
        (out as Record<string, unknown>)[newKey] = String(val);
      } else {
        (out as Record<string, unknown>)[newKey] = toNum(val);
      }
    }
  }
  return out;
}

function toApiPayload(input: FinancialStatementsInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of INPUT_KEYS) {
    out[k] = input[k];
  }
  return out;
}

interface FinancialStatementsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

const sectionHeaderClassName = "text-base font-semibold text-foreground";
const labelClassName = cn(formLabelClassName, "font-normal");
const inputClassName = formInputClassName;
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 w-full max-w-[1200px] items-start px-3";
const sectionWrapperClassName = "w-full max-w-[1200px]";
const formOuterClassName = "w-full max-w-[1200px] flex flex-col gap-10 px-3";

export function FinancialStatementsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancialStatementsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const [debugSkeletonMode, setDebugSkeletonMode] = React.useState(false);
  const [input, setInput] = React.useState<FinancialStatementsInput>(defaultInput);
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
    setInput(initial);
    initialPayloadRef.current = JSON.stringify(toApiPayload(initial));
    setIsInitialized(true);
  }, [application, isInitialized]);

  const apiPayload = React.useMemo(() => toApiPayload(input), [input]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    return JSON.stringify(apiPayload) !== initialPayloadRef.current;
  }, [apiPayload, isInitialized]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;
    onDataChangeRef.current({
      ...apiPayload,
      hasPendingChanges,
      isValid: true,
    });
  }, [apiPayload, hasPendingChanges, isInitialized]);

  const update = (updates: Partial<FinancialStatementsInput>) => {
    setInput((prev) => ({ ...prev, ...updates }));
  };

  const moneyValue = (n: number) => (n === 0 ? "" : formatMoney(n));
  const setMoney = (key: FinancialStatementsInputKey) => (v: string) => {
    update({ [key]: v === "" ? 0 : parseMoney(v) });
  };

  const label = (key: FinancialStatementsInputKey) => FINANCIAL_FIELD_LABELS[key] ?? key;

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
        {/* Financial Year */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Financial Year</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="pldd" className={labelClassName}>
              {label("pldd")}
            </Label>
            <DateInput
              value={input.pldd}
              onChange={(v) => update({ pldd: v })}
              disabled={readOnly}
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              placeholder="Enter date"
            />
            <Label htmlFor="bsdd" className={labelClassName}>
              {label("bsdd")}
            </Label>
            <DateInput
              value={input.bsdd}
              onChange={(v) => update({ bsdd: v })}
              disabled={readOnly}
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              placeholder="Enter date"
            />
          </div>
        </section>

        {/* Assets */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Assets</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            {(["bsfatot", "othass", "bscatot", "bsclbank"] as const).map((key) => (
              <React.Fragment key={key}>
                <Label htmlFor={key} className={labelClassName}>
                  {label(key)}
                </Label>
                <MoneyInput
                  value={moneyValue(input[key])}
                  onValueChange={(v) => setMoney(key)(v)}
                  placeholder="0.00"
                  prefix="RM"
                  inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
                  disabled={readOnly}
                />
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Liabilities */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Liabilities</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            {(["curlib", "bsslltd", "bsclstd"] as const).map((key) => (
              <React.Fragment key={key}>
                <Label htmlFor={key} className={labelClassName}>
                  {label(key)}
                </Label>
                <MoneyInput
                  value={moneyValue(input[key])}
                  onValueChange={(v) => setMoney(key)(v)}
                  placeholder="0.00"
                  prefix="RM"
                  inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
                  disabled={readOnly}
                />
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* Equity */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Equity</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="bsqpuc" className={labelClassName}>
              {label("bsqpuc")}
            </Label>
            <MoneyInput
              value={moneyValue(input.bsqpuc)}
              onValueChange={(v) => setMoney("bsqpuc")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
        </section>

        {/* Profit and Loss */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Profit and Loss</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="turnover" className={labelClassName}>
              {label("turnover")}
            </Label>
            <MoneyInput
              value={moneyValue(input.turnover)}
              onValueChange={(v) => setMoney("turnover")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="plnpbt" className={labelClassName}>
              {label("plnpbt")}
            </Label>
            <MoneyInput
              value={moneyValue(input.plnpbt)}
              onValueChange={(v) => setMoney("plnpbt")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="plnpat" className={labelClassName}>
              {label("plnpat")}
            </Label>
            <MoneyInput
              value={moneyValue(input.plnpat)}
              onValueChange={(v) => setMoney("plnpat")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="plminin" className={labelClassName}>
              {label("plminin")}
            </Label>
            <MoneyInput
              value={moneyValue(input.plminin)}
              onValueChange={(v) => setMoney("plminin")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="plnetdiv" className={labelClassName}>
              {label("plnetdiv")}
            </Label>
            <MoneyInput
              value={moneyValue(input.plnetdiv)}
              onValueChange={(v) => setMoney("plnetdiv")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="plyear" className={labelClassName}>
              {label("plyear")}
            </Label>
            <Input
              id="plyear"
              type="number"
              value={input.plyear === 0 ? "" : input.plyear}
              onChange={(e) => {
                const v = e.target.value;
                update({ plyear: v === "" ? 0 : parseInt(v, 10) || 0 });
              }}
              placeholder="e.g. 2024"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
        </section>
      </div>
      <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
