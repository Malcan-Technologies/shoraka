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
import { Input } from "@/components/ui/input";
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
import {
  FINANCIAL_FIELD_LABELS,
  getExpectedUnauditedYearsFromQuestionnaire,
  normalizeFinancialStatementsQuestionnaire,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { parse, isValid as isValidDate, startOfDay, format, subMonths } from "date-fns";
import { toast } from "sonner";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

/**
 * Mock data for dev Auto Fill. All 15 fields.
 * - pldd: four-digit financial year; bsdd: date string.
 * - turnover: >= 0; plnpbt, plnpat, plyear: may be negative; plnetdiv: positive.
 * - Decimals randomized (2 dp) to match MoneyInput.
 */
export function generateMockData(): Record<string, unknown> {
  const today = new Date();
  const financialYear = String(subMonths(today, 6).getFullYear());
  const dataUntil = format(subMonths(today, 1), "dd/MM/yyyy");
  const plnpat = 120000.45;
  const plyear = 100000.25;
  return {
    pldd: financialYear,
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

const MIN_FINANCIAL_YEAR = 1900;

function maxFinancialYear(): number {
  return new Date().getFullYear() + 1;
}

/** Load pldd as a four-digit year. Migrates legacy full-date values from JSON. */
function normalizePlddFromSaved(val: unknown): string {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (s === "") return "";
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 4);
  try {
    const parsed = parse(s, "d/M/yyyy", new Date());
    if (isValidDate(parsed)) return String(parsed.getFullYear());
  } catch {
    /* ignore */
  }
  const asDate = new Date(s);
  if (!Number.isNaN(asDate.getTime())) return String(asDate.getFullYear());
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "";
}

function normalizePlddForApi(s: string): string {
  const t = s.trim();
  if (/^\d{4}$/.test(t)) return t;
  return normalizePlddFromSaved(t);
}

function isValidFinancialYear(s: string): boolean {
  const t = s.trim();
  if (!/^\d{4}$/.test(t)) return false;
  const y = parseInt(t, 10);
  return y >= MIN_FINANCIAL_YEAR && y <= maxFinancialYear();
}

function fromSaved(saved: unknown): FinancialStatementsPayload {
  const raw = saved as { input?: Record<string, unknown> } | Record<string, unknown> | null | undefined;
  const data = (raw && typeof raw === "object" && "input" in raw ? raw.input : raw) as Record<string, unknown> | null | undefined;
  if (!data || typeof data !== "object") return { ...DEFAULT_PAYLOAD };

  const out = { ...DEFAULT_PAYLOAD };

  const setVal = (key: keyof FinancialStatementsPayload, val: unknown) => {
    if (val === undefined || val === null) return;
    if (key === "pldd") {
      out.pldd = normalizePlddFromSaved(val);
      return;
    }
    if (key === "bsdd") {
      out.bsdd = String(val);
      return;
    }
    const n = toNum(val);
    (out as unknown as Record<string, unknown>)[key] = formatMoney(n);
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
    if (k === "pldd") {
      out[k] = normalizePlddForApi(form.pldd ?? "");
    } else if (k === "bsdd") {
      out[k] = form.bsdd;
    } else if (k === "plyear") {
      out[k] = parseMoney(form.plyear ?? "");
    } else {
      const val = (form as unknown as Record<string, unknown>)[k];
      out[k] = parseMoney(String(val ?? ""));
    }
  }
  return out;
}

function isV2FinancialSaved(saved: unknown): saved is {
  questionnaire: unknown;
  unaudited_by_year: Record<string, Record<string, unknown>>;
} {
  if (!saved || typeof saved !== "object") return false;
  const o = saved as Record<string, unknown>;
  return (
    o.questionnaire != null &&
    typeof o.questionnaire === "object" &&
    o.unaudited_by_year != null &&
    typeof o.unaudited_by_year === "object" &&
    !Array.isArray(o.unaudited_by_year)
  );
}

function legacyHasAnyInput(data: FinancialStatementsPayload): boolean {
  const keys = Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[];
  for (const k of keys) {
    if (k === "pldd" && normalizePlddFromSaved(data.pldd)) return true;
    if (k !== "pldd" && String(data[k] ?? "").trim() !== "") return true;
  }
  return false;
}

/* ================================================================
   LAYOUT & STYLING
   ================================================================ */

const sectionHeaderClassName = "text-base font-semibold text-foreground";
const labelClassName = cn(formLabelClassName, "font-normal");
const subsectionHeadingClassName = "text-sm font-semibold text-foreground";
const inputClassName = formInputClassName;
/** Label + field columns — same horizontal/vertical gaps as company-details / contract-details. */
const rowGridBaseClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-6 gap-y-4 w-full max-w-[1200px] items-center px-3";
/** First grid under a section header (adds top offset like other steps). */
const rowGridClassName = cn(rowGridBaseClassName, "mt-4");
const sectionWrapperClassName = "w-full max-w-[1200px]";
/** Same outer rhythm as company-details / contract-details steps. */
const formOuterClassName = "w-full max-w-[1200px] space-y-10 px-3";

/** Empty / info states under Financial Details — same shell as declarations-step boxes (border-border bg-background). */
const financialDetailsMessagePanelClassName =
  "rounded-xl border border-border bg-background p-4 sm:p-5 w-full max-w-[1200px]";

/** Big centered helper box: same layout for “complete answers” and “already submitted” messages. */
const financialDetailsCenteredMessageBoxClassName = cn(
  financialDetailsMessagePanelClassName,
  "flex min-h-[140px] items-center justify-center"
);
const financialDetailsCenteredMessageTextClassName =
  "text-center text-sm leading-6 text-muted-foreground px-2 max-w-md";

/* ================================================================
   CUSTOM RADIO (same pattern as business-details-step)
   ================================================================ */

const radioSelectedLabel = formLabelClassName;
const radioUnselectedLabel = formLabelClassName.replace(
  "text-foreground",
  "text-muted-foreground"
);

function FinancialCustomRadio({
  name,
  value,
  checked,
  onChange,
  label,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
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
            <span className="absolute inset-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
          )}
        </span>
      </span>
      <span className={checked ? radioSelectedLabel : radioUnselectedLabel}>{label}</span>
    </label>
  );
}

type YesNoChoice = "yes" | "no" | "";

function FinancialYesNoRadioGroup({
  name,
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  name: string;
  value: YesNoChoice;
  onValueChange: (v: "yes" | "no") => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <div className="flex flex-wrap gap-6 items-center" role="radiogroup" aria-label={ariaLabel}>
      <FinancialCustomRadio
        name={name}
        value="yes"
        checked={value === "yes"}
        onChange={() => !disabled && onValueChange("yes")}
        label="Yes"
        disabled={disabled}
      />
      <FinancialCustomRadio
        name={name}
        value="no"
        checked={value === "no"}
        onChange={() => !disabled && onValueChange("no")}
        label="No"
        disabled={disabled}
      />
    </div>
  );
}

/* ================================================================
   MONEY FIELD ROW
   ================================================================ */

const NEGATIVE_TOOLTIP_TEXT = "Negative values allowed for losses\nExample: -5000";
const FINANCIAL_DATA_UNTIL_TOOLTIP =
  "Latest date your figures are updated to (e.g. management accounts).";

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
      placeholder="eg. 0.00"
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

function emptyQuestionnaireBlock(yearKey: string): FinancialStatementsPayload {
  return { ...DEFAULT_PAYLOAD, pldd: yearKey };
}

function buildV2ApiPayload(
  q: FinancialStatementsQuestionnaire,
  forms: Record<string, FinancialStatementsPayload>
): {
  questionnaire: FinancialStatementsQuestionnaire;
  unaudited_by_year: Record<string, Record<string, unknown>>;
} {
  const expected = getExpectedUnauditedYearsFromQuestionnaire(q);
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const y of expected) {
    const k = String(y);
    const form = forms[k] ?? emptyQuestionnaireBlock(k);
    unaudited_by_year[k] = toApiPayload({ ...form, pldd: k });
  }
  return { questionnaire: q, unaudited_by_year };
}

function parseDateLocal(s: string): Date | null {
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
}

function yearFormIsValid(form: FinancialStatementsPayload): boolean {
  const moneyFields: (keyof FinancialStatementsPayload)[] = [
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
    "plnetdiv",
    "plyear",
  ];
  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
  if (!hasValue(form.pldd) || !isValidFinancialYear(form.pldd ?? "")) return false;
  if (!hasValue(form.bsdd)) return false;
  const d = parseDateLocal(form.bsdd ?? "");
  if (d && startOfDay(d) > startOfDay(new Date())) return false;
  if (!moneyFields.every((k) => hasValue(form[k]))) return false;
  if (parseMoney(form.turnover ?? "") < 0) return false;
  return true;
}

function yearFormValidForButton(form: FinancialStatementsPayload): boolean {
  const moneyFields: (keyof FinancialStatementsPayload)[] = [
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
    "plnetdiv",
    "plyear",
  ];
  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
  if (!hasValue(form.pldd) || !isValidFinancialYear(form.pldd ?? "")) return false;
  if (!hasValue(form.bsdd)) return false;
  if (!moneyFields.every((k) => hasValue(form[k]))) return false;
  if (parseMoney(form.turnover ?? "") < 0) return false;
  return true;
}

export function FinancialStatementsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancialStatementsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const devTools = useDevTools();

  const [fyeInput, setFyeInput] = React.useState("");
  const [qSubmitted, setQSubmitted] = React.useState<boolean | null>(null);
  const [qNextYear, setQNextYear] = React.useState<boolean | null>(null);
  const [formsByYear, setFormsByYear] = React.useState<Record<string, FinancialStatementsPayload>>({});
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

    if (isV2FinancialSaved(saved)) {
      const qNorm = normalizeFinancialStatementsQuestionnaire(saved.questionnaire);
      const map: Record<string, FinancialStatementsPayload> = {};
      for (const [k, v] of Object.entries(saved.unaudited_by_year)) {
        map[k] = fromSaved(v);
        map[k].pldd = k;
      }
      setFormsByYear(map);
      if (qNorm) {
        setFyeInput(String(qNorm.latest_financial_year));
        setQSubmitted(qNorm.submitted_this_financial_year);
        setQNextYear(qNorm.has_data_for_next_financial_year);
        const built = buildV2ApiPayload(qNorm, map);
        initialPayloadRef.current = JSON.stringify(built);
        console.log("Financial step loaded v2; years in payload:", Object.keys(saved.unaudited_by_year));
      } else {
        initialPayloadRef.current = JSON.stringify({
          questionnaire: {
            latest_financial_year: 0,
            submitted_this_financial_year: false,
            has_data_for_next_financial_year: false,
          },
          unaudited_by_year: map,
        });
        console.log("Financial step v2 payload missing valid questionnaire; forms only");
      }
    } else {
      const flat = fromSaved(saved);
      if (legacyHasAnyInput(flat) && normalizePlddFromSaved(flat.pldd)) {
        const y = normalizePlddFromSaved(flat.pldd);
        setFyeInput(y);
        setQSubmitted(false);
        setQNextYear(false);
        setFormsByYear({ [y]: { ...flat, pldd: y } });
        const qLegacy: FinancialStatementsQuestionnaire = {
          latest_financial_year: parseInt(y, 10),
          submitted_this_financial_year: false,
          has_data_for_next_financial_year: false,
        };
        initialPayloadRef.current = JSON.stringify(buildV2ApiPayload(qLegacy, { [y]: { ...flat, pldd: y } }));
        console.log("Financial step loaded legacy flat as single year:", y);
      } else {
        initialPayloadRef.current = JSON.stringify({
          questionnaire: {
            latest_financial_year: 0,
            submitted_this_financial_year: false,
            has_data_for_next_financial_year: false,
          },
          unaudited_by_year: {},
        });
        console.log("Financial step empty — start questionnaire");
      }
    }
    setIsInitialized(true);
  }, [application, isInitialized]);

  const questionnaireDto = React.useMemo((): FinancialStatementsQuestionnaire | null => {
    if (!isValidFinancialYear(fyeInput)) return null;
    if (qSubmitted === null || qNextYear === null) return null;
    return {
      latest_financial_year: parseInt(fyeInput, 10),
      submitted_this_financial_year: qSubmitted,
      has_data_for_next_financial_year: qNextYear,
    };
  }, [fyeInput, qSubmitted, qNextYear]);

  const yearsToShow = React.useMemo(() => {
    if (!questionnaireDto) return [] as number[];
    const years = getExpectedUnauditedYearsFromQuestionnaire(questionnaireDto);
    console.log("Years to show on issuer form:", years);
    return years;
  }, [questionnaireDto]);

  React.useEffect(() => {
    if (yearsToShow.length === 0) return;
    setFormsByYear((prev) => {
      const next = { ...prev };
      for (const y of yearsToShow) {
        const k = String(y);
        if (!next[k]) next[k] = emptyQuestionnaireBlock(k);
        else next[k] = { ...next[k], pldd: k };
      }
      for (const key of Object.keys(next)) {
        if (!yearsToShow.includes(parseInt(key, 10))) delete next[key];
      }
      return next;
    });
  }, [yearsToShow]);

  React.useEffect(() => {
    const raw =
      devTools?.autoFillData?.stepKey === "financial_statements"
        ? devTools.autoFillData.data
        : devTools?.autoFillDataMap?.["financial_statements"];
    if (!raw) return;
    const mock = raw as Partial<FinancialStatementsPayload> & Record<string, unknown>;
    const yStr =
      mock.pldd != null && String(mock.pldd).trim()
        ? normalizePlddFromSaved(mock.pldd)
        : String(subMonths(new Date(), 6).getFullYear());
    const merged: FinancialStatementsPayload = { ...DEFAULT_PAYLOAD, pldd: yStr };
    for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
      if (mock[k] !== undefined && mock[k] !== null) {
        (merged as unknown as Record<string, unknown>)[k] = String(mock[k]);
      }
    }
    setFyeInput(yStr);
    setQSubmitted(false);
    setQNextYear(false);
    setFormsByYear({ [yStr]: merged });
    if (devTools) {
      if (devTools.autoFillData?.stepKey === "financial_statements") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("financial_statements");
    }
    console.log("Financial dev auto-fill applied for year:", yStr);
  }, [devTools]);

  const buildV2ApiPayloadInner = React.useCallback(() => {
    if (!questionnaireDto) {
      throw new Error("INVALID_QUESTIONNAIRE");
    }
    return buildV2ApiPayload(questionnaireDto, formsByYear);
  }, [questionnaireDto, formsByYear]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    type InitialPayloadShape = {
      questionnaire?: unknown;
      unaudited_by_year?: Record<string, unknown>;
    };
    let initialParsed: InitialPayloadShape | null = null;
    try {
      initialParsed = JSON.parse(initialPayloadRef.current) as InitialPayloadShape;
    } catch {
      initialParsed = null;
    }

    if (!questionnaireDto) {
      const initQNorm = normalizeFinancialStatementsQuestionnaire(initialParsed?.questionnaire);
      const initHasRealQ =
        initQNorm != null && initQNorm.latest_financial_year > 0;

      if (!initHasRealQ) {
        const touched =
          fyeInput.trim() !== "" || qSubmitted !== null || qNextYear !== null;
        console.log("Financial step pending (questionnaire draft):", touched);
        return touched;
      }

      const same =
        isValidFinancialYear(fyeInput) &&
        parseInt(fyeInput, 10) === initQNorm.latest_financial_year &&
        qSubmitted === initQNorm.submitted_this_financial_year &&
        qNextYear === initQNorm.has_data_for_next_financial_year;
      const pending = !same;
      console.log("Financial step pending (questionnaire vs loaded):", pending);
      return pending;
    }

    try {
      const now = JSON.stringify(buildV2ApiPayloadInner());
      const pendingFull = now !== initialPayloadRef.current;
      console.log("Financial step pending (v2 payload):", pendingFull);
      return pendingFull;
    } catch {
      return true;
    }
  }, [
    isInitialized,
    questionnaireDto,
    buildV2ApiPayloadInner,
    fyeInput,
    qSubmitted,
    qNextYear,
  ]);

  const caseCInfoOnly = Boolean(questionnaireDto && yearsToShow.length === 0);

  const allYearFormsValid = React.useMemo(() => {
    if (yearsToShow.length === 0) return true;
    return yearsToShow.every((y) => yearFormIsValid(formsByYear[String(y)] ?? emptyQuestionnaireBlock(String(y))));
  }, [yearsToShow, formsByYear]);

  const allYearFormsButtonOk = React.useMemo(() => {
    if (yearsToShow.length === 0) return true;
    return yearsToShow.every((y) =>
      yearFormValidForButton(formsByYear[String(y)] ?? emptyQuestionnaireBlock(String(y)))
    );
  }, [yearsToShow, formsByYear]);

  const questionsAnswered =
    isValidFinancialYear(fyeInput) && qSubmitted !== null && qNextYear !== null;

  const isValidForButton = caseCInfoOnly
    ? questionsAnswered
    : questionsAnswered && allYearFormsButtonOk;

  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    if (!questionnaireDto) {
      toast.error("Please answer all three questions, including a valid 4-digit latest financial year");
      throw new Error("VALIDATION_REQUIRED");
    }
    if (caseCInfoOnly) {
      const payload = {
        questionnaire: questionnaireDto,
        unaudited_by_year: {} as Record<string, Record<string, unknown>>,
      };
      console.log("Saving financial Case C (no unaudited rows):", payload.questionnaire);
      return payload;
    }
    if (!allYearFormsValid) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_REQUIRED");
    }
    const payload = buildV2ApiPayload(questionnaireDto, formsByYear);
    console.log("Saving financial v2 payload keys:", Object.keys(payload.unaudited_by_year));
    return payload;
  }, [questionnaireDto, caseCInfoOnly, allYearFormsValid, formsByYear]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;
    onDataChangeRef.current({
      hasPendingChanges,
      isValid: isValidForButton,
      saveFunction,
    });
  }, [hasPendingChanges, isValidForButton, isInitialized, saveFunction]);

  const updateFormYear = React.useCallback((yearKey: string, field: keyof FinancialStatementsPayload, value: string) => {
    setFormsByYear((prev) => ({
      ...prev,
      [yearKey]: { ...(prev[yearKey] ?? emptyQuestionnaireBlock(yearKey)), [field]: value, pldd: yearKey },
    }));
  }, []);

  const getLabel = (key: keyof FinancialStatementsPayload) => FINANCIAL_FIELD_LABELS[key] ?? key;

  const renderYearBlock = (year: number) => {
    const yearKey = String(year);
    const form = formsByYear[yearKey] ?? emptyQuestionnaireBlock(yearKey);
    const bsddParsed = parseDateLocal(form.bsdd ?? "");
    const bsddFuture =
      bsddParsed != null && startOfDay(bsddParsed) > startOfDay(new Date());

    return (
      <div key={yearKey} className="space-y-3 border border-border rounded-xl p-4 md:p-6">
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Reporting Period</h4>
          <div className={rowGridBaseClassName}>
            <Label className={labelClassName}>Financial Year</Label>
            <Input value={yearKey} disabled className={cn(inputClassName, formInputDisabledClassName)} />
            <div className={cn("flex items-center", fieldTooltipLabelGap)}>
              <Label className={labelClassName}>
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
                onChange={(v) => updateFormYear(yearKey, "bsdd", v)}
                disabled={readOnly}
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                placeholder="eg. 31/12/2025"
                isInvalid={hasSubmitted && bsddFuture}
              />
              {hasSubmitted && bsddFuture && (
                <p className="text-xs text-destructive">Financial data date cannot be in the future.</p>
              )}
            </div>
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Assets</h4>
          <div className={rowGridBaseClassName}>
            {(["bsfatot", "othass", "bscatot", "bsclbank"] as const).map((key) => (
              <MoneyFieldRow
                key={`${yearKey}-${key}`}
                id={`${yearKey}-${key}`}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => updateFormYear(yearKey, key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Liabilities</h4>
          <div className={rowGridBaseClassName}>
            {(["curlib", "bsslltd", "bsclstd"] as const).map((key) => (
              <MoneyFieldRow
                key={`${yearKey}-${key}`}
                id={`${yearKey}-${key}`}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => updateFormYear(yearKey, key, v)}
                readOnly={readOnly}
              />
            ))}
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Equity</h4>
          <div className={rowGridBaseClassName}>
            <MoneyFieldRow
              id={`${yearKey}-bsqpuc`}
              label={getLabel("bsqpuc")}
              value={form.bsqpuc ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "bsqpuc", v)}
              readOnly={readOnly}
            />
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Profit and Loss</h4>
          <div className={rowGridBaseClassName}>
            <MoneyFieldRow
              id={`${yearKey}-turnover`}
              label={getLabel("turnover")}
              value={form.turnover ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "turnover", v)}
              readOnly={readOnly}
              hasError={hasSubmitted && String(form.turnover).trim() !== "" && parseMoney(form.turnover ?? "") < 0}
              errorMessage={
                hasSubmitted && String(form.turnover).trim() !== "" && parseMoney(form.turnover ?? "") < 0
                  ? "Turnover must be 0 or greater"
                  : undefined
              }
            />
            <MoneyFieldRow
              id={`${yearKey}-plnpbt`}
              label={getLabel("plnpbt")}
              value={form.plnpbt ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnpbt", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
            />
            <MoneyFieldRow
              id={`${yearKey}-plnpat`}
              label={getLabel("plnpat")}
              value={form.plnpat ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnpat", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
            />
            <MoneyFieldRow
              id={`${yearKey}-plnetdiv`}
              label={getLabel("plnetdiv")}
              value={form.plnetdiv ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnetdiv", v)}
              readOnly={readOnly}
            />
            <MoneyFieldRow
              id={`${yearKey}-plyear`}
              label={getLabel("plyear")}
              value={form.plyear ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plyear", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
            />
          </div>
        </section>
      </div>
    );
  };

  if (isLoadingApp || !isInitialized || devTools?.showSkeletonDebug) {
    return <FinancialStatementsSkeleton />;
  }

  return (
    <>
      <div className={formOuterClassName}>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <div>
            <h3 className={sectionHeaderClassName}>Financial Overview</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>

          <div className={rowGridClassName}>
            <div className="space-y-2">
              <Label htmlFor="fye-year" className={labelClassName}>
                What Is Your Latest Financial Year?
              </Label>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <Input
                id="fye-year"
                value={fyeInput}
                onChange={(e) => setFyeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={readOnly}
                placeholder="eg. 2025"
                className={inputClassName}
                inputMode="numeric"
                maxLength={4}
                aria-describedby="fye-year-hint"
              />
              <p id="fye-year-hint" className="text-xs text-muted-foreground">
                4 digits
              </p>
            </div>

            <div className="space-y-2">
              <Label className={labelClassName}>Have You Submitted This Financial Year?</Label>
            </div>
            <div className="flex h-11 w-full min-w-0 items-center">
              <FinancialYesNoRadioGroup
                name="financial-statements-q-submitted"
                aria-label="Have You Submitted This Financial Year?"
                value={qSubmitted === null ? "" : qSubmitted ? "yes" : "no"}
                onValueChange={(v) => setQSubmitted(v === "yes")}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label className={labelClassName}>Do You Have Data for the Next Financial Year?</Label>
            </div>
            <div className="flex h-11 w-full min-w-0 items-center">
              <FinancialYesNoRadioGroup
                name="financial-statements-q-next-year"
                aria-label="Do You Have Data for the Next Financial Year?"
                value={qNextYear === null ? "" : qNextYear ? "yes" : "no"}
                onValueChange={(v) => setQNextYear(v === "yes")}
                disabled={readOnly}
              />
            </div>
          </div>
        </section>

        <section className={`${sectionWrapperClassName} w-full space-y-3`}>
          <div className="px-3">
            <h3 className={sectionHeaderClassName}>
              Financial Details{" "}
              <span className="font-normal text-muted-foreground">(Unaudited)</span>
            </h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>

          <div className="space-y-4 px-3">
          {!questionnaireDto ? (
            <div className={financialDetailsCenteredMessageBoxClassName}>
              <p className={financialDetailsCenteredMessageTextClassName}>
                Complete the three answers above, then enter amounts here
              </p>
            </div>
          ) : null}

          {questionnaireDto && caseCInfoOnly ? (
            <div className={financialDetailsCenteredMessageBoxClassName}>
              <p className={financialDetailsCenteredMessageTextClassName}>
                Latest year is already submitted. No figures needed in this step
              </p>
            </div>
          ) : null}

          {questionnaireDto && !caseCInfoOnly && yearsToShow.length === 1 ? (
            <div>{renderYearBlock(yearsToShow[0])}</div>
          ) : null}

          {questionnaireDto && !caseCInfoOnly && yearsToShow.length > 1 ? (
            <div className="w-full max-w-[1200px]">
              <Tabs
                key={yearsToShow.join("-")}
                defaultValue={String(yearsToShow[0])}
                className="w-full"
              >
                <TabsList className="mb-4 h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1 sm:w-auto">
                  {yearsToShow.map((y) => (
                    <TabsTrigger key={y} value={String(y)} className="min-w-[4.5rem]">
                      {y}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {yearsToShow.map((y) => (
                  <TabsContent key={y} value={String(y)} className="mt-0 focus-visible:outline-none">
                    {renderYearBlock(y)}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
