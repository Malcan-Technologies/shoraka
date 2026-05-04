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
  formatFinancialFyPeriodDisplay,
  getFinancialYearEndComputationDetails,
  getIssuerFinancialTabYears,
  issuerUnauditedPlddForFyEndYear,
  normalizeFinancialStatementsQuestionnaire,
  type FinancialStatementsQuestionnaire,
} from "@cashsouk/types";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { addDays, format, parseISO, startOfDay, isValid as isValidDate } from "date-fns";
import { toast } from "sonner";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  applicationFlowDateToIso,
  isoToApplicationFlowDateDisplay,
  isApplicationFlowDateStrictlyAfterToday,
  isApplicationFlowDateValid,
} from "@/app/(application-flow)/applications/utils/application-flow-dates";

/** Dev auto-fill: ISO next FY end (not sent as this key). */
export const FINANCIAL_DEV_YEAR_END_KEY = "__financial_year_end";

/**
 * Mock data for dev Auto Fill (money fields). FYE set by effect from key below.
 */
export function generateMockData(): Record<string, unknown> {
  const futureFye = format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd");
  const plnpat = 120000.45;
  const plyear = 100000.25;
  return {
    [FINANCIAL_DEV_YEAR_END_KEY]: futureFye,
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
/** Vertical rhythm between Assets / Liabilities / Equity / P&L inside a year card (business-details uses `space-y-5` per section + larger gaps between blocks). */
const yearBlockSectionStackClassName = "space-y-8 md:space-y-10";
const yearBlockInnerSectionClassName = "space-y-5";
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

/* ================================================================
   MONEY FIELD ROW
   ================================================================ */

const NEGATIVE_TOOLTIP_TEXT = "Negative values are allowed for losses.\nExample: -5000.";

/** Same placeholder style as contract-details money fields (`eg.` + formatted RM). */
const FINANCIAL_MONEY_PLACEHOLDER = `eg. ${formatMoney(500000)}`;

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
      placeholder={FINANCIAL_MONEY_PLACEHOLDER}
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

function emptyQuestionnaireBlock(): FinancialStatementsPayload {
  return { ...DEFAULT_PAYLOAD };
}

function buildV2ApiPayload(
  q: FinancialStatementsQuestionnaire,
  forms: Record<string, FinancialStatementsPayload>
): {
  questionnaire: FinancialStatementsQuestionnaire;
  unaudited_by_year: Record<string, Record<string, unknown>>;
} {
  const ref = new Date();
  const expected = getIssuerFinancialTabYears(q, ref);
  const unaudited_by_year: Record<string, Record<string, unknown>> = {};
  for (const y of expected) {
    const k = String(y);
    const form = forms[k] ?? emptyQuestionnaireBlock();
    const row = toApiPayload(form);
    row.pldd = issuerUnauditedPlddForFyEndYear(y, q);
    unaudited_by_year[k] = row;
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

/** Save gate: money fields filled; pldd must match FY end for this column. */
function yearFormFilledForSaveButton(
  fyEndYear: number,
  q: FinancialStatementsQuestionnaire,
  form: FinancialStatementsPayload
): boolean {
  const expected = issuerUnauditedPlddForFyEndYear(fyEndYear, q);
  if (form.pldd !== expected) {
    return false;
  }
  const hasValue = (v: unknown) => String(v ?? "").trim() !== "";
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

  const [fyeDateInput, setFyeDateInput] = React.useState("");
  const [formsByYear, setFormsByYear] = React.useState<Record<string, FinancialStatementsPayload>>({});
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [activeYearTab, setActiveYearTab] = React.useState("");
  const [initialPayloadSnapshot, setInitialPayloadSnapshot] = React.useState("");

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
        setFyeDateInput(isoToApplicationFlowDateDisplay(qNorm.financial_year_end));
        const built = buildV2ApiPayload(qNorm, map);
        setInitialPayloadSnapshot(JSON.stringify(built));
        console.log("Financial step loaded v2; years in payload:", Object.keys(saved.unaudited_by_year));
      } else {
        setInitialPayloadSnapshot(
          JSON.stringify({
            questionnaire: { financial_year_end: "" },
            unaudited_by_year: map,
          })
        );
        console.log("Financial step v2 payload missing valid questionnaire; forms only");
      }
    } else {
      setInitialPayloadSnapshot(
        JSON.stringify({
          questionnaire: { financial_year_end: "" },
          unaudited_by_year: {},
        })
      );
      console.log("Financial step empty — start questionnaire");
    }
    setIsInitialized(true);
  }, [application, isInitialized]);

  const questionnaireDto = React.useMemo((): FinancialStatementsQuestionnaire | null => {
    const iso = applicationFlowDateToIso(fyeDateInput);
    if (!iso) return null;
    if (!isApplicationFlowDateStrictlyAfterToday(fyeDateInput)) return null;
    return { financial_year_end: iso };
  }, [fyeDateInput]);

  const yearsToShow = React.useMemo(() => {
    if (!questionnaireDto) return [] as number[];
    const ref = new Date();
    const years = getIssuerFinancialTabYears(questionnaireDto, ref);
    const dbg = getFinancialYearEndComputationDetails(questionnaireDto, ref);
    console.log("FYE selected:", dbg.fye);
    console.log("Previous FY End:", dbg.previousFYEndIso);
    console.log("Deadline:", dbg.deadlineIso);
    console.log("Today:", dbg.todayIso);
    console.log("Years to show:", dbg.years);
    return years;
  }, [questionnaireDto]);

  React.useEffect(() => {
    if (!questionnaireDto) return;

    setFormsByYear((prev) => {
      const next = { ...prev };
      for (const y of yearsToShow) {
        const k = String(y);
        const p = issuerUnauditedPlddForFyEndYear(y, questionnaireDto);
        if (!next[k]) next[k] = { ...emptyQuestionnaireBlock(), pldd: p };
        else next[k] = { ...next[k], pldd: p };
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
    const devKey = FINANCIAL_DEV_YEAR_END_KEY as keyof typeof mock;
    const isoFromMock =
      typeof mock[devKey] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(mock[devKey]).trim())
        ? String(mock[devKey]).trim()
        : format(addDays(startOfDay(new Date()), 400), "yyyy-MM-dd");

    const merged: FinancialStatementsPayload = { ...DEFAULT_PAYLOAD };
    for (const k of Object.keys(DEFAULT_PAYLOAD) as (keyof FinancialStatementsPayload)[]) {
      if (mock[k] !== undefined && mock[k] !== null) {
        (merged as unknown as Record<string, unknown>)[k] = String(mock[k]);
      }
    }
    setFyeDateInput(isoToApplicationFlowDateDisplay(isoFromMock));

    const q: FinancialStatementsQuestionnaire = { financial_year_end: isoFromMock };
    const years = getIssuerFinancialTabYears(q, new Date());
    const map: Record<string, FinancialStatementsPayload> = {};
    for (const y of years) {
      const k = String(y);
      map[k] = { ...merged, pldd: issuerUnauditedPlddForFyEndYear(y, q) };
    }
    setFormsByYear(map);

    if (devTools) {
      if (devTools.autoFillData?.stepKey === "financial_statements") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("financial_statements");
    }
    console.log("Dev FYE auto-fill ISO:", isoFromMock);
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
      initialParsed = JSON.parse(initialPayloadSnapshot) as InitialPayloadShape;
    } catch {
      initialParsed = null;
    }

    if (!questionnaireDto) {
      const initQNorm = normalizeFinancialStatementsQuestionnaire(initialParsed?.questionnaire);
      const initHasRealQ = initQNorm != null;

      if (!initHasRealQ) {
        const touched = fyeDateInput.trim() !== "";
        console.log("Financial step pending (questionnaire draft):", touched);
        return touched;
      }

      const fyeIso = applicationFlowDateToIso(fyeDateInput);
      const fyeOk = fyeIso != null && isApplicationFlowDateStrictlyAfterToday(fyeDateInput);
      const same = fyeOk && fyeIso === initQNorm.financial_year_end;
      const pending = !same;
      console.log("Financial step pending (questionnaire vs loaded):", pending);
      return pending;
    }

    try {
      const now = JSON.stringify(buildV2ApiPayloadInner());
      const pendingFull = now !== initialPayloadSnapshot;
      console.log("Financial step pending (v2 payload):", pendingFull);
      return pendingFull;
    } catch {
      return true;
    }
  }, [isInitialized, questionnaireDto, buildV2ApiPayloadInner, fyeDateInput, initialPayloadSnapshot]);

  /** Full validation: used by saveFunction and inline errors after submit (future date, turnover sign, etc.). */
  const allYearFormsValid = React.useMemo(() => {
    if (yearsToShow.length === 0) return true;
    return yearsToShow.every((y) =>
      yearFormIsValid(formsByYear[String(y)] ?? emptyQuestionnaireBlock())
    );
  }, [yearsToShow, formsByYear]);

  /** Save gate: questionnaire complete and all money fields filled per tab. */
  const allYearFormsFilled = React.useMemo(() => {
    if (!questionnaireDto || yearsToShow.length === 0) return true;
    const q = questionnaireDto;
    return yearsToShow.every((y) =>
      yearFormFilledForSaveButton(y, q, formsByYear[String(y)] ?? emptyQuestionnaireBlock())
    );
  }, [yearsToShow, formsByYear, questionnaireDto]);

  const questionsAnswered =
    applicationFlowDateToIso(fyeDateInput) != null && isApplicationFlowDateStrictlyAfterToday(fyeDateInput);

  /** Save enabled when questionnaire + all year rows are “filled”; submit applies strict validation. */
  const isValidForButton = readOnly || (questionsAnswered && allYearFormsFilled);

  React.useEffect(() => {
    if (yearsToShow.length === 0) return;
    setActiveYearTab((prev) => {
      const ids = yearsToShow.map(String);
      if (prev && ids.includes(prev)) return prev;
      return ids[0] ?? "";
    });
  }, [yearsToShow]);

  React.useEffect(() => {
    setHasSubmitted(false);
  }, [fyeDateInput, formsByYear]);

  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    if (!questionnaireDto) {
      console.log("Financial save blocked: questionnaire incomplete", {
        fyeDateInput,
      });
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_REQUIRED");
    }
    if (!allYearFormsValid) {
      const firstBad = yearsToShow.find(
        (y) => !yearFormIsValid(formsByYear[String(y)] ?? emptyQuestionnaireBlock())
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
  }, [questionnaireDto, allYearFormsValid, formsByYear, yearsToShow, fyeDateInput]);

  React.useEffect(() => {
    if (!onDataChangeRef.current) return;
    if (!isInitialized) {
      onDataChangeRef.current({
        hasPendingChanges: false,
        isValid: readOnly,
        saveFunction,
      });
      return;
    }
    onDataChangeRef.current({
      hasPendingChanges,
      isValid: isValidForButton,
      saveFunction,
    });
  }, [hasPendingChanges, isValidForButton, isInitialized, saveFunction, readOnly]);

  const updateFormYear = React.useCallback(
    (yearKey: string, field: keyof FinancialStatementsPayload, value: string) => {
      setFormsByYear((prev) => {
        const y = parseInt(yearKey, 10);
        const base = prev[yearKey] ?? emptyQuestionnaireBlock();
        const nextRow: FinancialStatementsPayload = { ...base, [field]: value };
        if (questionnaireDto) {
          nextRow.pldd = issuerUnauditedPlddForFyEndYear(y, questionnaireDto);
        }
        return { ...prev, [yearKey]: nextRow };
      });
    },
    [questionnaireDto]
  );

  const getLabel = (key: keyof FinancialStatementsPayload) => FINANCIAL_FIELD_LABELS[key] ?? key;

  const FYE_TOOLTIP =
    "Select the next date your company’s financial year will end (must be in the future).";

  const showOverviewErrors = hasSubmitted && !readOnly;
  const fyeFieldError =
    fyeDateInput.trim() === ""
      ? showOverviewErrors
        ? "Required"
        : undefined
      : !isApplicationFlowDateValid(fyeDateInput)
        ? "Enter a valid date"
        : !isApplicationFlowDateStrictlyAfterToday(fyeDateInput)
          ? "Please select a future financial year end date."
          : undefined;

  const renderYearBlock = (year: number) => {
    const yearKey = String(year);
    const form = formsByYear[yearKey] ?? emptyQuestionnaireBlock();
    const showYearFieldErrors = hasSubmitted && !readOnly;
    const yearErrors: YearBlockFieldErrors = showYearFieldErrors
      ? getYearBlockFieldErrors(form)
      : { money: {} };
    const periodLine =
      questionnaireDto != null ? formatFinancialFyPeriodDisplay(questionnaireDto, year) : "";

    return (
      <div key={yearKey} className={cn("border border-border rounded-xl p-4 md:p-6", yearBlockSectionStackClassName)}>
        {periodLine ? (
          <p className="text-sm text-muted-foreground pb-4 border-b border-border mb-4">{periodLine}</p>
        ) : null}
        <section className={cn(sectionWrapperClassName, yearBlockInnerSectionClassName)}>
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
        <section className={cn(sectionWrapperClassName, yearBlockInnerSectionClassName)}>
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
        <section className={cn(sectionWrapperClassName, yearBlockInnerSectionClassName)}>
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
        <section className={cn(sectionWrapperClassName, yearBlockInnerSectionClassName)}>
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
              <Label htmlFor="fye-financial-year-end" className={labelClassName}>
                What is the Financial Year End of your company?
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                  {FYE_TOOLTIP}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <DateInput
                id="fye-financial-year-end"
                value={fyeDateInput}
                onChange={(v) => setFyeDateInput(v)}
                disabled={readOnly}
                placeholder="Enter date"
                className={withFieldError(inputClassName, Boolean(fyeFieldError))}
                isInvalid={Boolean(fyeFieldError)}
              />
              {fyeFieldError ? (
                <p className="text-xs text-destructive">{fyeFieldError}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className={`${sectionWrapperClassName} w-full space-y-3`}>
          <div className="px-3">
            <h3 className={applicationFlowSectionTitleClassName}>Financial Details</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="space-y-4 px-3">
          {!questionnaireDto ? (
            <div className={financialDetailsCenteredMessageBoxClassName}>
              <p className={financialDetailsCenteredMessageTextClassName}>
                Select your financial year end above, then enter amounts here
              </p>
            </div>
          ) : null}

          {questionnaireDto && yearsToShow.length >= 1 ? (
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
                      {`FY${y}`}
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
