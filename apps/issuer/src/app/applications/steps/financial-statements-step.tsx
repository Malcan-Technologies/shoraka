"use client";

/**
 * Imports
 *
 * What: Financial statements step UI.
 * Why: Issuers enter financial statement data; computed fields are readonly.
 * Data: Loads from application.financial_statements.input; sends only input to API.
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

/**
 * FINANCIAL STATEMENTS STEP
 *
 * Form for financial statement data. Computed fields update live in UI.
 * Backend computes and stores both input and computed.
 */

interface FinancialStatementsInput {
  financing_year_end: string;
  balance_sheet_financial_year: string;
  fixed_assets: number;
  other_assets: number;
  current_assets: number;
  non_current_assets: number;
  current_liability: number;
  long_term_liability: number;
  non_current_liability: number;
  paid_up: number;
  turnover: number;
  profit_before_tax: number;
  profit_after_tax: number;
  minority_interest: number;
  net_dividend: number;
  profit_and_loss_year: number;
}

const defaultInput: FinancialStatementsInput = {
  financing_year_end: "",
  balance_sheet_financial_year: "",
  fixed_assets: 0,
  other_assets: 0,
  current_assets: 0,
  non_current_assets: 0,
  current_liability: 0,
  long_term_liability: 0,
  non_current_liability: 0,
  paid_up: 0,
  turnover: 0,
  profit_before_tax: 0,
  profit_after_tax: 0,
  minority_interest: 0,
  net_dividend: 0,
  profit_and_loss_year: 0,
};

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function computeFromInput(input: FinancialStatementsInput) {
  const fa = toNum(input.fixed_assets);
  const oa = toNum(input.other_assets);
  const ca = toNum(input.current_assets);
  const nca = toNum(input.non_current_assets);
  const cl = toNum(input.current_liability);
  const ltl = toNum(input.long_term_liability);
  const ncl = toNum(input.non_current_liability);
  const paidUp = toNum(input.paid_up);
  const turnover = toNum(input.turnover);
  const pat = toNum(input.profit_after_tax);

  return {
    total_assets: fa + oa + ca + nca,
    total_liability: cl + ltl + ncl,
    turnover_growth: null as number | null,
    profit_margin: turnover !== 0 ? pat / turnover : null,
    return_of_equity: paidUp !== 0 ? pat / paidUp : null,
    current_ratio: cl !== 0 ? ca / cl : null,
    working_capital: ca - cl,
  };
}

function fromSaved(saved: unknown): FinancialStatementsInput {
  const raw = saved as { input?: Record<string, unknown> } | Record<string, unknown> | null | undefined;
  const input = (raw && typeof raw === "object" && "input" in raw ? raw.input : raw) as Record<string, unknown> | null | undefined;
  if (!input || typeof input !== "object") return { ...defaultInput };

  return {
    financing_year_end: String(input.financing_year_end ?? ""),
    balance_sheet_financial_year: String(input.balance_sheet_financial_year ?? ""),
    fixed_assets: toNum(input.fixed_assets),
    other_assets: toNum(input.other_assets),
    current_assets: toNum(input.current_assets),
    non_current_assets: toNum(input.non_current_assets),
    current_liability: toNum(input.current_liability),
    long_term_liability: toNum(input.long_term_liability),
    non_current_liability: toNum(input.non_current_liability),
    paid_up: toNum(input.paid_up),
    turnover: toNum(input.turnover),
    profit_before_tax: toNum(input.profit_before_tax),
    profit_after_tax: toNum(input.profit_after_tax),
    minority_interest: toNum(input.minority_interest),
    net_dividend: toNum(input.net_dividend),
    profit_and_loss_year: toNum(input.profit_and_loss_year),
  };
}

function toApiPayload(input: FinancialStatementsInput): Record<string, unknown> {
  return {
    financing_year_end: input.financing_year_end,
    balance_sheet_financial_year: input.balance_sheet_financial_year,
    fixed_assets: input.fixed_assets,
    other_assets: input.other_assets,
    current_assets: input.current_assets,
    non_current_assets: input.non_current_assets,
    current_liability: input.current_liability,
    long_term_liability: input.long_term_liability,
    non_current_liability: input.non_current_liability,
    paid_up: input.paid_up,
    turnover: input.turnover,
    profit_before_tax: input.profit_before_tax,
    profit_after_tax: input.profit_after_tax,
    minority_interest: input.minority_interest,
    net_dividend: input.net_dividend,
    profit_and_loss_year: input.profit_and_loss_year,
  };
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

function formatNumForDisplay(v: number | null): string {
  if (v === null) return "";
  return formatMoney(v);
}

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

  const computed = React.useMemo(() => computeFromInput(input), [input]);
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
  const setMoney = (key: keyof FinancialStatementsInput) => (v: string) => {
    update({ [key]: v === "" ? 0 : parseMoney(v) });
  };

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
            <Label htmlFor="financing-year-end" className={labelClassName}>
              Financing Year End
            </Label>
            <DateInput
              value={input.financing_year_end}
              onChange={(v) => update({ financing_year_end: v })}
              disabled={readOnly}
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              placeholder="Enter date"
            />
            <Label htmlFor="balance-sheet-financial-year" className={labelClassName}>
              Balance Sheet Financial Year
            </Label>
            <DateInput
              value={input.balance_sheet_financial_year}
              onChange={(v) => update({ balance_sheet_financial_year: v })}
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
            <Label htmlFor="fixed-assets" className={labelClassName}>
              Fixed Assets
            </Label>
            <MoneyInput
              value={moneyValue(input.fixed_assets)}
              onValueChange={(v) => setMoney("fixed_assets")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="other-assets" className={labelClassName}>
              Other Assets
            </Label>
            <MoneyInput
              value={moneyValue(input.other_assets)}
              onValueChange={(v) => setMoney("other_assets")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="current-assets" className={labelClassName}>
              Current Assets
            </Label>
            <MoneyInput
              value={moneyValue(input.current_assets)}
              onValueChange={(v) => setMoney("current_assets")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="non-current-assets" className={labelClassName}>
              Non Current Assets
            </Label>
            <MoneyInput
              value={moneyValue(input.non_current_assets)}
              onValueChange={(v) => setMoney("non_current_assets")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="total-assets" className={labelClassName}>
              Total Assets
            </Label>
            <Input
              id="total-assets"
              readOnly
              value={formatNumForDisplay(computed.total_assets)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
          </div>
        </section>

        {/* Liabilities */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Liabilities</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="current-liability" className={labelClassName}>
              Current Liability
            </Label>
            <MoneyInput
              value={moneyValue(input.current_liability)}
              onValueChange={(v) => setMoney("current_liability")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="long-term-liability" className={labelClassName}>
              Long Term Liability
            </Label>
            <MoneyInput
              value={moneyValue(input.long_term_liability)}
              onValueChange={(v) => setMoney("long_term_liability")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="non-current-liability" className={labelClassName}>
              Non Current Liability
            </Label>
            <MoneyInput
              value={moneyValue(input.non_current_liability)}
              onValueChange={(v) => setMoney("non_current_liability")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="total-liability" className={labelClassName}>
              Total Liability
            </Label>
            <Input
              id="total-liability"
              readOnly
              value={formatNumForDisplay(computed.total_liability)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
          </div>
        </section>

        {/* Equity */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Equity</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="paid-up" className={labelClassName}>
              Paid Up
            </Label>
            <MoneyInput
              value={moneyValue(input.paid_up)}
              onValueChange={(v) => setMoney("paid_up")(v)}
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
              Turnover
            </Label>
            <MoneyInput
              value={moneyValue(input.turnover)}
              onValueChange={(v) => setMoney("turnover")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="profit-before-tax" className={labelClassName}>
              Profit Before Tax
            </Label>
            <MoneyInput
              value={moneyValue(input.profit_before_tax)}
              onValueChange={(v) => setMoney("profit_before_tax")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="profit-after-tax" className={labelClassName}>
              Profit After Tax
            </Label>
            <MoneyInput
              value={moneyValue(input.profit_after_tax)}
              onValueChange={(v) => setMoney("profit_after_tax")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="minority-interest" className={labelClassName}>
              Minority Interest
            </Label>
            <MoneyInput
              value={moneyValue(input.minority_interest)}
              onValueChange={(v) => setMoney("minority_interest")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="net-dividend" className={labelClassName}>
              Net Dividend
            </Label>
            <MoneyInput
              value={moneyValue(input.net_dividend)}
              onValueChange={(v) => setMoney("net_dividend")(v)}
              placeholder="0.00"
              prefix="RM"
              inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            <Label htmlFor="profit-and-loss-year" className={labelClassName}>
              Profit and Loss Year
            </Label>
            <Input
              id="profit-and-loss-year"
              type="number"
              value={input.profit_and_loss_year === 0 ? "" : input.profit_and_loss_year}
              onChange={(e) => {
                const v = e.target.value;
                update({ profit_and_loss_year: v === "" ? 0 : parseInt(v, 10) || 0 });
              }}
              placeholder="e.g. 2024"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
        </section>

        {/* Financial Ratios (readonly) */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Financial Ratios</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>
          <div className={rowGridClassName}>
            <Label htmlFor="turnover-growth" className={labelClassName}>
              Turnover Growth
            </Label>
            <Input
              id="turnover-growth"
              readOnly
              value={computed.turnover_growth === null ? "" : formatNumForDisplay(computed.turnover_growth)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
            <Label htmlFor="profit-margin" className={labelClassName}>
              Profit Margin
            </Label>
            <Input
              id="profit-margin"
              readOnly
              value={computed.profit_margin === null ? "" : formatNumForDisplay(computed.profit_margin)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
            <Label htmlFor="return-of-equity" className={labelClassName}>
              Return Of Equity
            </Label>
            <Input
              id="return-of-equity"
              readOnly
              value={computed.return_of_equity === null ? "" : formatNumForDisplay(computed.return_of_equity)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
            <Label htmlFor="current-ratio" className={labelClassName}>
              Current Ratio
            </Label>
            <Input
              id="current-ratio"
              readOnly
              value={computed.current_ratio === null ? "" : formatNumForDisplay(computed.current_ratio)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
            <Label htmlFor="working-capital" className={labelClassName}>
              Working Capital
            </Label>
            <Input
              id="working-capital"
              readOnly
              value={formatNumForDisplay(computed.working_capital)}
              className={cn(inputClassName, formInputDisabledClassName, "bg-muted")}
            />
          </div>
        </section>
      </div>
      <DebugSkeletonToggle isSkeletonMode={debugSkeletonMode} onToggle={setDebugSkeletonMode} />
    </>
  );
}
