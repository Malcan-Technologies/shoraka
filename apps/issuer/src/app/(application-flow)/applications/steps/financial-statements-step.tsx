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
  applicationFlowLabelCellAlignInputClassName,
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
  fieldLabelWithTooltipRowClassName,
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
  fieldTooltipTriggerInputClassName,
  withFieldError,
} from "@/app/(application-flow)/applications/components/form-control";
import { MoneyInput } from "@cashsouk/ui";
import { parseMoney, formatMoney } from "@cashsouk/ui";
import { FinancialStatementsSkeleton } from "@/app/(application-flow)/applications/components/financial-statements-skeleton";
import {
  FINANCIAL_FIELD_LABELS,
  getIssuerFinancialInputYearsFromQuestionnaire,
  normalizeFinancialStatementsQuestionnaire,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { isValid as isValidDate, format, subMonths, parseISO, getYear } from "date-fns";
import { toast } from "sonner";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

/** Dev auto-fill: optional SSM flag for questionnaire (not sent as this key). */
export const FINANCIAL_DEV_SUBMITTED_SSM_KEY = "__financial_dev_submitted_ssm";

/**
 * Mock data for dev Auto Fill (money fields). Questionnaire date/SSM set by effect from keys below.
 */
export function generateMockData(): Record<string, unknown> {
  const today = new Date();
  const isoClosing = format(subMonths(today, 1), "yyyy-MM-dd");
  const plnpat = 120000.45;
  const plyear = 100000.25;
  return {
    __financial_last_closing_date: isoClosing,
    [FINANCIAL_DEV_SUBMITTED_SSM_KEY]: false,
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

/* ================================================================
   HELPERS
   ================================================================ */

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function normalizePlddIsoFromSaved(val: unknown): string {
  const s = String(val ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = parseISO(s);
  return isValidDate(d) ? s : "";
}

function isValidIsoDate(s: string): boolean {
  return normalizePlddIsoFromSaved(s) !== "";
}

function fromSaved(saved: unknown): FinancialStatementsPayload {
  const raw = saved as { input?: Record<string, unknown> } | Record<string, unknown> | null | undefined;
  const data = (raw && typeof raw === "object" && "input" in raw ? raw.input : raw) as Record<string, unknown> | null | undefined;
  if (!data || typeof data !== "object") return { ...DEFAULT_PAYLOAD };

  const out = { ...DEFAULT_PAYLOAD };

  const setVal = (key: keyof FinancialStatementsPayload, val: unknown) => {
    if (val === undefined || val === null) return;
    if (key === "pldd") {
      out.pldd = normalizePlddIsoFromSaved(val);
      return;
    }
    const n = toNum(val);
    (out as unknown as Record<string, unknown>)[key] = formatMoney(n);
  };

  for (const key of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
    setVal(key, data[key]);
  }

  return out;
}

function toApiPayload(form: FinancialStatementsPayload): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.pldd = String(form.pldd ?? "").trim();
  for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
    if (k === "pldd") continue;
    if (k === "plyear") {
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

/* ================================================================
   LAYOUT & STYLING
   ================================================================ */

const labelClassName = cn(formLabelClassName, "font-normal");
const labelCellClassName = cn(labelClassName, applicationFlowLabelCellAlignInputClassName, "justify-self-start min-w-0");
const subsectionHeadingClassName = "text-sm font-semibold text-foreground";
const inputClassName = formInputClassName;
/** Two-column form grid — contract-details-step (`sm:grid-cols-2`, `items-start`). */
const stepFormRowGridClassName =
  "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 w-full items-start";
/** Financial Overview grid under section title (horizontal inset matches contract). */
const overviewFormRowGridClassName = cn(stepFormRowGridClassName, "mt-4 px-3");
const sectionWrapperClassName = "w-full";
/** Same outer rhythm as company-details / contract-details steps. */
const formOuterClassName = applicationFlowStepOuterClassName;

/** Empty / info states under Financial Details — same shell as declarations-step boxes (border-border bg-background). */
const financialDetailsMessagePanelClassName =
  "rounded-xl border border-border bg-background p-4 sm:p-5 w-full";

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

const NEGATIVE_TOOLTIP_TEXT = "Negative values are allowed for losses.\nExample: -5000.";

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
      <Label htmlFor={id} className={labelCellClassName}>
        {label}
      </Label>
      <div className="min-w-0">{wrappedInput}</div>
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

function emptyQuestionnaireBlock(closingIso: string): FinancialStatementsPayload {
  return { ...DEFAULT_PAYLOAD, pldd: closingIso };
}

function buildV2ApiPayload(
  q: FinancialStatementsQuestionnaire,
  forms: Record<string, FinancialStatementsPayload>
): {
  questionnaire: FinancialStatementsQuestionnaire;
  unaudited_by_year: Record<string, Record<string, unknown>>;
} {
  const expected = getIssuerFinancialInputYearsFromQuestionnaire(q);
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const y of expected) {
    const k = String(y);
    const form = forms[k] ?? emptyQuestionnaireBlock(q.last_closing_date);
    unaudited_by_year[k] = toApiPayload({ ...form, pldd: q.last_closing_date });
  }
  return { questionnaire: q, unaudited_by_year };
}

const YEAR_MONEY_FIELDS: (keyof FinancialStatementsPayload)[] = [
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

type YearBlockFieldErrors = {
  money: Partial<Record<keyof FinancialStatementsPayload, string>>;
};

function getYearBlockFieldErrors(form: FinancialStatementsPayload): YearBlockFieldErrors {
  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
  const money: Partial<Record<keyof FinancialStatementsPayload, string>> = {};

  for (const k of YEAR_MONEY_FIELDS) {
    if (!hasValue(form[k])) {
      money[k] = "Required";
    }
  }
  if (hasValue(form.turnover) && parseMoney(form.turnover ?? "") < 0) {
    money.turnover = "Turnover must be 0 or greater";
  }
  return { money };
}

function yearFormIsValid(form: FinancialStatementsPayload): boolean {
  const e = getYearBlockFieldErrors(form);
  if (Object.keys(e.money).length > 0) return false;
  return true;
}

/** Save gate: all money fields filled (pldd is set from questionnaire, read-only). */
function yearFormFilledForSaveButton(form: FinancialStatementsPayload): boolean {
  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
  if (!hasValue(form.pldd) || !isValidIsoDate(String(form.pldd ?? ""))) return false;
  for (const k of YEAR_MONEY_FIELDS) {
    if (!hasValue(form[k])) return false;
  }
  return true;
}

export function FinancialStatementsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancialStatementsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const devTools = useDevTools();

  const [lastClosingDate, setLastClosingDate] = React.useState("");
  const [qSubmitted, setQSubmitted] = React.useState<boolean | null>(null);
  const [formsByYear, setFormsByYear] = React.useState<Record<string, FinancialStatementsPayload>>({});
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [activeYearTab, setActiveYearTab] = React.useState("");
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
      }
      setFormsByYear(map);
      if (qNorm) {
        setLastClosingDate(qNorm.last_closing_date);
        setQSubmitted(qNorm.is_submitted_to_ssm);
        const built = buildV2ApiPayload(qNorm, map);
        initialPayloadRef.current = JSON.stringify(built);
        console.log("Financial step loaded v2; years in payload:", Object.keys(saved.unaudited_by_year));
      } else {
        initialPayloadRef.current = JSON.stringify({
          questionnaire: { last_closing_date: "", is_submitted_to_ssm: false },
          unaudited_by_year: map,
        });
        console.log("Financial step v2 payload missing valid questionnaire; forms only");
      }
    } else {
      initialPayloadRef.current = JSON.stringify({
        questionnaire: { last_closing_date: "", is_submitted_to_ssm: false },
        unaudited_by_year: {},
      });
      console.log("Financial step empty — start questionnaire");
    }
    setIsInitialized(true);
  }, [application, isInitialized]);

  const questionnaireDto = React.useMemo((): FinancialStatementsQuestionnaire | null => {
    if (!isValidIsoDate(lastClosingDate.trim())) return null;
    if (qSubmitted === null) return null;
    return {
      last_closing_date: lastClosingDate.trim(),
      is_submitted_to_ssm: qSubmitted,
    };
  }, [lastClosingDate, qSubmitted]);

  const yearsToShow = React.useMemo(() => {
    if (!questionnaireDto) return [] as number[];
    const years = getIssuerFinancialInputYearsFromQuestionnaire(questionnaireDto);
    console.log("Years to show on issuer form:", years);
    return years;
  }, [questionnaireDto]);

  React.useEffect(() => {
    if (!questionnaireDto) return;
    const cy = getYear(parseISO(questionnaireDto.last_closing_date));
    console.log("Last Closing Date:", questionnaireDto.last_closing_date);
    console.log("Derived Current Year:", cy);
    console.log("Submitted to SSM:", questionnaireDto.is_submitted_to_ssm);
  }, [questionnaireDto]);

  React.useEffect(() => {
    if (!questionnaireDto) return;
    const closing = questionnaireDto.last_closing_date;

    setFormsByYear((prev) => {
      const next = { ...prev };
      for (const y of yearsToShow) {
        const k = String(y);
        if (!next[k]) next[k] = emptyQuestionnaireBlock(closing);
        else next[k] = { ...next[k], pldd: closing };
      }
      for (const key of Object.keys(next)) {
        if (!yearsToShow.includes(parseInt(key, 10))) delete next[key];
      }
      return next;
    });
  }, [yearsToShow, questionnaireDto]);

  React.useEffect(() => {
    const raw =
      devTools?.autoFillData?.stepKey === "financial_statements"
        ? devTools.autoFillData.data
        : devTools?.autoFillDataMap?.["financial_statements"];
    if (!raw) return;
    const mock = raw as Partial<FinancialStatementsPayload> & Record<string, unknown>;
    const isoFromMock =
      typeof mock.__financial_last_closing_date === "string" && isValidIsoDate(mock.__financial_last_closing_date)
        ? mock.__financial_last_closing_date
        : format(subMonths(new Date(), 1), "yyyy-MM-dd");
    const submittedKey = FINANCIAL_DEV_SUBMITTED_SSM_KEY as keyof typeof mock;
    const submitted =
      typeof mock[submittedKey] === "boolean" ? (mock[submittedKey] as boolean) : false;

    const merged: FinancialStatementsPayload = { ...DEFAULT_PAYLOAD, pldd: isoFromMock };
    for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
      if (mock[k] !== undefined && mock[k] !== null) {
        (merged as unknown as Record<string, unknown>)[k] = String(mock[k]);
      }
    }
    setLastClosingDate(isoFromMock);
    setQSubmitted(submitted);

    const q: FinancialStatementsQuestionnaire = {
      last_closing_date: isoFromMock,
      is_submitted_to_ssm: submitted,
    };
    const years = getIssuerFinancialInputYearsFromQuestionnaire(q);
    const map: Record<string, FinancialStatementsPayload> = {};
    for (const y of years) {
      const k = String(y);
      map[k] = { ...merged, pldd: isoFromMock };
    }
    setFormsByYear(map);

    if (devTools) {
      if (devTools.autoFillData?.stepKey === "financial_statements") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("financial_statements");
    }
    const cy = getYear(parseISO(isoFromMock));
    console.log("Last Closing Date:", isoFromMock, "Derived Current Year:", cy, "Submitted to SSM:", submitted);
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
      const initHasRealQ = initQNorm != null && isValidIsoDate(initQNorm.last_closing_date);

      if (!initHasRealQ) {
        const touched = lastClosingDate.trim() !== "" || qSubmitted !== null;
        console.log("Financial step pending (questionnaire draft):", touched);
        return touched;
      }

      const same =
        isValidIsoDate(lastClosingDate.trim()) &&
        lastClosingDate.trim() === initQNorm.last_closing_date &&
        qSubmitted === initQNorm.is_submitted_to_ssm;
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
  }, [isInitialized, questionnaireDto, buildV2ApiPayloadInner, lastClosingDate, qSubmitted]);

  const closingForBlocks = isValidIsoDate(lastClosingDate.trim()) ? lastClosingDate.trim() : "";

  /** Full validation: used by saveFunction and inline errors after submit (future date, turnover sign, etc.). */
  const allYearFormsValid = React.useMemo(() => {
    if (yearsToShow.length === 0) return true;
    return yearsToShow.every((y) =>
      yearFormIsValid(formsByYear[String(y)] ?? emptyQuestionnaireBlock(closingForBlocks))
    );
  }, [yearsToShow, formsByYear, closingForBlocks]);

  /** Save gate: questionnaire complete and all money fields filled per tab. */
  const allYearFormsFilled = React.useMemo(() => {
    if (yearsToShow.length === 0) return true;
    return yearsToShow.every((y) =>
      yearFormFilledForSaveButton(formsByYear[String(y)] ?? emptyQuestionnaireBlock(closingForBlocks))
    );
  }, [yearsToShow, formsByYear, closingForBlocks]);

  const questionsAnswered = isValidIsoDate(lastClosingDate.trim()) && qSubmitted !== null;

  /** Save enabled when questionnaire + all year rows are “filled”; submit applies strict validation. */
  const isValidForButton = readOnly || (questionsAnswered && allYearFormsFilled);

  React.useEffect(() => {
    if (yearsToShow.length <= 1) return;
    setActiveYearTab((prev) => {
      const ids = yearsToShow.map(String);
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [yearsToShow]);

  React.useEffect(() => {
    setHasSubmitted(false);
  }, [lastClosingDate, qSubmitted, formsByYear]);

  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    if (!questionnaireDto) {
      console.log("Financial save blocked: questionnaire incomplete", {
        lastClosingDate,
        qSubmitted,
      });
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_REQUIRED");
    }
    if (!allYearFormsValid) {
      const firstBad = yearsToShow.find(
        (y) => !yearFormIsValid(formsByYear[String(y)] ?? emptyQuestionnaireBlock(questionnaireDto.last_closing_date))
      );
      if (firstBad != null) {
        setActiveYearTab(String(firstBad));
        console.log("Financial save blocked: switching to first invalid year tab", firstBad);
      }
      console.log("Financial save blocked: year forms invalid", { yearsToShow });
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_REQUIRED");
    }
    const payload = buildV2ApiPayload(questionnaireDto, formsByYear);
    console.log("Saving financial v2 payload keys:", Object.keys(payload.unaudited_by_year));
    return payload;
  }, [questionnaireDto, allYearFormsValid, formsByYear, yearsToShow]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;
    onDataChangeRef.current({
      hasPendingChanges,
      isValid: isValidForButton,
      saveFunction,
    });
  }, [hasPendingChanges, isValidForButton, isInitialized, saveFunction]);

  const updateFormYear = React.useCallback(
    (yearKey: string, field: keyof FinancialStatementsPayload, value: string) => {
      const closing = lastClosingDate.trim();
      const plddVal = isValidIsoDate(closing) ? closing : "";
      setFormsByYear((prev) => ({
        ...prev,
        [yearKey]: {
          ...(prev[yearKey] ?? emptyQuestionnaireBlock(plddVal || closing)),
          [field]: value,
          pldd: plddVal || (prev[yearKey]?.pldd ?? ""),
        },
      }));
    },
    [lastClosingDate]
  );

  const getLabel = (key: keyof FinancialStatementsPayload) => FINANCIAL_FIELD_LABELS[key] ?? key;

  const LAST_CLOSE_TOOLTIP =
    "Select the last day your company completed a financial year.\nExample: If your accounts run from 1 April 2025 to 31 March 2026, select 31 March 2026.";
  const SSM_TOOLTIP =
    "Select 'Yes' if you have already submitted your accounts to SSM.\nSelect 'No' if they are still being prepared or not submitted yet.";

  const showOverviewErrors = hasSubmitted && !readOnly;
  const closingFieldError = showOverviewErrors
    ? lastClosingDate.trim() === ""
      ? "Required"
      : !isValidIsoDate(lastClosingDate.trim())
        ? "Use a valid date (YYYY-MM-DD)"
        : undefined
    : undefined;
  const qSubmittedFieldError =
    showOverviewErrors && qSubmitted === null ? "Please select Yes or No" : undefined;

  const renderYearBlock = (year: number) => {
    const yearKey = String(year);
    const closing = questionnaireDto?.last_closing_date ?? closingForBlocks;
    const form = formsByYear[yearKey] ?? emptyQuestionnaireBlock(closing);
    const showYearFieldErrors = hasSubmitted && !readOnly;
    const yearErrors: YearBlockFieldErrors = showYearFieldErrors
      ? getYearBlockFieldErrors(form)
      : { money: {} };

    return (
      <div key={yearKey} className="space-y-3 border border-border rounded-xl p-4 md:p-6">
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Reporting Period</h4>
          <div className={stepFormRowGridClassName}>
            <Label className={labelCellClassName}>Financial year (figures)</Label>
            <div className="flex min-w-0 flex-col gap-1">
              <Input value={yearKey} disabled className={cn(inputClassName, formInputDisabledClassName)} />
            </div>
            <div className={fieldLabelWithTooltipRowClassName}>
              <Label className={labelClassName}>When did you last close your accounts?</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                  {LAST_CLOSE_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <DateInput
                value={form.pldd}
                onChange={() => {}}
                disabled
                className={cn(inputClassName, formInputDisabledClassName)}
                placeholder="YYYY-MM-DD"
              />
            </div>
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Assets</h4>
          <div className={stepFormRowGridClassName}>
            {(["bsfatot", "othass", "bscatot", "bsclbank"] as const).map((key) => (
              <MoneyFieldRow
                key={`${yearKey}-${key}`}
                id={`${yearKey}-${key}`}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => updateFormYear(yearKey, key, v)}
                readOnly={readOnly}
                hasError={Boolean(yearErrors.money[key])}
                errorMessage={yearErrors.money[key]}
              />
            ))}
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Liabilities</h4>
          <div className={stepFormRowGridClassName}>
            {(["curlib", "bsslltd", "bsclstd"] as const).map((key) => (
              <MoneyFieldRow
                key={`${yearKey}-${key}`}
                id={`${yearKey}-${key}`}
                label={getLabel(key)}
                value={form[key] ?? ""}
                onValueChange={(v) => updateFormYear(yearKey, key, v)}
                readOnly={readOnly}
                hasError={Boolean(yearErrors.money[key])}
                errorMessage={yearErrors.money[key]}
              />
            ))}
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Equity</h4>
          <div className={stepFormRowGridClassName}>
            <MoneyFieldRow
              id={`${yearKey}-bsqpuc`}
              label={getLabel("bsqpuc")}
              value={form.bsqpuc ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "bsqpuc", v)}
              readOnly={readOnly}
              hasError={Boolean(yearErrors.money.bsqpuc)}
              errorMessage={yearErrors.money.bsqpuc}
            />
          </div>
        </section>
        <section className={`${sectionWrapperClassName} space-y-3`}>
          <h4 className={subsectionHeadingClassName}>Profit and Loss</h4>
          <div className={stepFormRowGridClassName}>
            <MoneyFieldRow
              id={`${yearKey}-turnover`}
              label={getLabel("turnover")}
              value={form.turnover ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "turnover", v)}
              readOnly={readOnly}
              hasError={Boolean(yearErrors.money.turnover)}
              errorMessage={yearErrors.money.turnover}
            />
            <MoneyFieldRow
              id={`${yearKey}-plnpbt`}
              label={getLabel("plnpbt")}
              value={form.plnpbt ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnpbt", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
              hasError={Boolean(yearErrors.money.plnpbt)}
              errorMessage={yearErrors.money.plnpbt}
            />
            <MoneyFieldRow
              id={`${yearKey}-plnpat`}
              label={getLabel("plnpat")}
              value={form.plnpat ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnpat", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
              hasError={Boolean(yearErrors.money.plnpat)}
              errorMessage={yearErrors.money.plnpat}
            />
            <MoneyFieldRow
              id={`${yearKey}-plnetdiv`}
              label={getLabel("plnetdiv")}
              value={form.plnetdiv ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plnetdiv", v)}
              readOnly={readOnly}
              hasError={Boolean(yearErrors.money.plnetdiv)}
              errorMessage={yearErrors.money.plnetdiv}
            />
            <MoneyFieldRow
              id={`${yearKey}-plyear`}
              label={getLabel("plyear")}
              value={form.plyear ?? ""}
              onValueChange={(v) => updateFormYear(yearKey, "plyear", v)}
              readOnly={readOnly}
              allowNegative
              showNegativeTooltip
              hasError={Boolean(yearErrors.money.plyear)}
              errorMessage={yearErrors.money.plyear}
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
            <h3 className={applicationFlowSectionTitleClassName}>Financial Overview</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className={overviewFormRowGridClassName}>
            <div className={fieldLabelWithTooltipRowClassName}>
              <Label htmlFor="last-closing-date" className={labelClassName}>
                When did you last close your accounts?
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                  {LAST_CLOSE_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <DateInput
                id="last-closing-date"
                value={lastClosingDate}
                onChange={(v) => setLastClosingDate(v)}
                disabled={readOnly}
                placeholder="YYYY-MM-DD"
                className={withFieldError(inputClassName, Boolean(closingFieldError))}
                isInvalid={Boolean(closingFieldError)}
              />
              {closingFieldError ? (
                <p className="text-xs text-destructive">{closingFieldError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Stored as YYYY-MM-DD</p>
              )}
            </div>

            <div className={fieldLabelWithTooltipRowClassName}>
              <Label className={labelClassName}>Have you submitted your accounts to SSM?</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                  {SSM_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 w-full flex-col gap-1">
              <div className="flex h-11 w-full min-w-0 items-center">
                <FinancialYesNoRadioGroup
                  name="financial-statements-q-ssm"
                  aria-label="Have you submitted your accounts to SSM?"
                  value={qSubmitted === null ? "" : qSubmitted ? "yes" : "no"}
                  onValueChange={(v) => setQSubmitted(v === "yes")}
                  disabled={readOnly}
                />
              </div>
              {qSubmittedFieldError ? (
                <p className="text-xs text-destructive">{qSubmittedFieldError}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className={`${sectionWrapperClassName} w-full space-y-3`}>
          <div className="px-3">
            <h3 className={applicationFlowSectionTitleClassName}>
              Financial Details{" "}
              <span className="font-normal text-muted-foreground">(Unaudited)</span>
            </h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="space-y-4 px-3">
          {!questionnaireDto ? (
            <div className={financialDetailsCenteredMessageBoxClassName}>
              <p className={financialDetailsCenteredMessageTextClassName}>
                Complete the two answers above, then enter amounts here
              </p>
            </div>
          ) : null}

          {questionnaireDto && yearsToShow.length === 1 ? (
            <div>{renderYearBlock(yearsToShow[0])}</div>
          ) : null}

          {questionnaireDto && yearsToShow.length > 1 ? (
            <div className="w-full">
              <Tabs
                key={yearsToShow.join("-")}
                value={activeYearTab || String(yearsToShow[0])}
                onValueChange={setActiveYearTab}
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
